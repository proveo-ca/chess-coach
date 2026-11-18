// SPEC: _spec/gpu-input-transfer.puml
import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, open, readFile, readlink, statfs, symlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import request from "./request.json";
import { inspectNewArchive, extractMember } from "./archive";
import { repository, work } from "../../provision";
import { runBounded } from "../../verify";
import { sourceInputPaths, sourceInventory } from "../../../../tooling/runtime/qualification";

export const workspace = resolve(repository, request.workspace);
export const evidence = resolve(repository, request.evidence);
const context = resolve(workspace, "context");
const provider = resolve(workspace, "provider-libnvvm-13.0.48.tar.xz");
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
type InputRow = { path: string; kind: string; bytes: number; mode: number; target?: string };
type RegistryEntry = { name: string; version: string; source: string; checksum: string };
type FileRecord = { path: string; kind: string; bytes: number; sha256?: string; target?: string };

export class ByteBudget {
  used = 0;
  constructor(readonly maximum: number) {}
  charge(bytes: number) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || this.used + bytes > this.maximum) throw Error("PAYLOAD_BYTE_BUDGET");
    this.used += bytes;
  }
}

export function relativeInput(path: string) {
  if (!path || isAbsolute(path) || path.split("/").some(part => part === ".." || part === "") || /[\x00-\x1f\x7f]/.test(path)) throw Error("RELATIVE_INPUT_PATH_REQUIRED");
  return path;
}

export function sparsePath(name: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw Error("REGISTRY_PACKAGE_NAME_REQUIRED");
  const key = name.toLowerCase();
  return key.length === 1 ? `1/${key}` : key.length === 2 ? `2/${key}` : key.length === 3 ? `3/${key[0]}/${key}` : `${key.slice(0, 2)}/${key.slice(2, 4)}/${key}`;
}

export function nativeDestination(path: string) {
  relativeInput(path);
  return `${path.startsWith("tooling/") || path.startsWith("_work/") ? "qualification-tools" : "current-native"}/${path}`;
}

export function requireReviewedNativePaths(currentPaths: string[], sources: { path: string; sha256: string }[]) {
  const reviewed = new Set(sources.map(source => source.path));
  if (currentPaths.some(path => !reviewed.has(path))) throw Error("UNREVIEWED_NATIVE_INPUT");
}

export function parseLlvmInventory(text: string): InputRow[] {
  const rows = text.trimEnd().split("\n").map(line => JSON.parse(line));
  const summary = rows.pop();
  if (summary?.kind !== "inventory-summary" || summary.complete !== true || summary.root !== request.llvm.prefix || rows.length !== request.llvm.maximumEntries
    || summary.entries !== rows.length || new Set(rows.map(row => row.path)).size !== rows.length) throw Error("APPROVED_COMPLETE_LLVM_METADATA_REQUIRED");
  for (const row of rows) {
    if (row.path !== ".") relativeInput(row.path);
    if (!["directory", "file", "symlink"].includes(row.kind) || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || !Number.isSafeInteger(row.mode)) throw Error("LLVM_METADATA_ROW_REQUIRED");
    if (row.kind === "symlink" && (typeof row.target !== "string" || row.target !== "lld" || !["bin/ld64.lld", "bin/lld-link"].includes(row.path))) throw Error("RECORDED_LLVM_LINK_REQUIRED");
  }
  return rows;
}

export function validateRegistry(entries: RegistryEntry[], lockText: string) {
  if (!Array.isArray(entries) || entries.length !== request.cargo.maximumRegistryEntries) throw Error("FROZEN_REGISTRY_MANIFEST_REQUIRED");
  const identities = new Set<string>();
  for (const entry of entries) {
    sparsePath(entry.name);
    if (!/^[0-9A-Za-z.+_-]+$/.test(entry.version) || entry.source !== "registry+https://github.com/rust-lang/crates.io-index" || !/^[a-f0-9]{64}$/.test(entry.checksum)) throw Error("FROZEN_REGISTRY_IDENTITY_REQUIRED");
    const identity = `${entry.name}@${entry.version}`;
    if (identities.has(identity)) throw Error("DUPLICATE_REGISTRY_IDENTITY");
    identities.add(identity);
  }
  if (hash(lockText) !== request.cargo.lockSha256) throw Error("FROZEN_CARGO_LOCK_REQUIRED");
  const locked = Bun.TOML.parse(lockText) as { package: RegistryEntry[] };
  const identity = (entry: RegistryEntry) => `${entry.name}@${entry.version}:${entry.source}:${entry.checksum}`;
  const expected = locked.package.filter(entry => entry.source !== undefined).map(identity).sort();
  if (JSON.stringify(expected) !== JSON.stringify(entries.map(identity).sort())) throw Error("REGISTRY_MANIFEST_DIFFERS_FROM_LOCK");
}

export async function hashFile(path: string, deadline?: number) {
  const file = await open(path, "r"), digest = createHash("sha256");
  let bytes = 0;
  try { for await (const chunk of file.createReadStream({ autoClose: false })) {
    if (deadline !== undefined && performance.now() >= deadline) throw Error("FILE_HASH_DEADLINE");
    digest.update(chunk); bytes += chunk.length;
  } }
  finally { await file.close(); }
  return { bytes, sha256: digest.digest("hex") };
}

export async function checkSourceGate(path: string) {
  if (!/^_work\/gpu-owner-recovery\/runs\/gpu-input-transfer-source-[1-9][0-9]*\/receipt\.json$/.test(path)) throw Error("REVIEWED_TRANSFER_SOURCE_GATE_REQUIRED");
  const bytes = await readFile(resolve(repository, path));
  const gate = JSON.parse(bytes.toString()) as { status: string; sourceChanged: boolean; sources: { path: string; sha256: string }[] };
  if (gate.status !== "PASS_TRANSFER_SOURCE_ONLY" || gate.sourceChanged !== false || !Array.isArray(gate.sources)) throw Error("PASSING_TRANSFER_SOURCE_GATE_REQUIRED");
  requireReviewedNativePaths(await sourceInputPaths(repository), gate.sources);
  for (const source of gate.sources) {
    relativeInput(source.path);
    if (hash(await readFile(resolve(repository, source.path))) !== source.sha256) throw Error(`TRANSFER_SOURCE_CHANGED:${source.path}`);
  }
  return { path, sha256: hash(bytes), sources: gate.sources };
}

async function downloadWorker() {
  const marker = await open(resolve(evidence, ".download-started"), "wx"); await marker.close();
  const file = await open(provider, "wx", 0o600), digest = createHash("sha256");
  let bytes = 0, failure: string | null = null, httpStatus: number | null = null;
  try {
    const response = await fetch(request.archive.url, { redirect: "error" });
    httpStatus = response.status;
    if (response.status !== 200 || !response.body) throw Error("EXACT_ARCHIVE_HTTP_200_REQUIRED");
    const declared = response.headers.get("content-length");
    if (declared !== null && Number(declared) !== request.archive.bytes) throw Error("DECLARED_ARCHIVE_SIZE_MISMATCH");
    for await (const chunk of response.body) {
      if (bytes + chunk.byteLength > request.archive.bytes) throw Error("ARCHIVE_DOWNLOAD_SIZE_LIMIT");
      await file.writeFile(chunk); digest.update(chunk); bytes += chunk.byteLength;
    }
    await file.sync();
  } catch (error) { failure = String(error); }
  finally { await file.close(); }
  const sha256 = digest.digest("hex");
  const verified = failure === null && bytes === request.archive.bytes && sha256 === request.archive.sha256;
  await writeFile(resolve(evidence, "download.json"), JSON.stringify({ status: verified ? "PASS_EXACT_ARCHIVE_DOWNLOAD" : "FAIL_EXACT_ARCHIVE_DOWNLOAD", httpStatus, bytes, sha256, failure,
    expectedBytes: request.archive.bytes, expectedSha256: request.archive.sha256, invocationsConsumed: 1, automaticRetryAuthorized: false }, null, 2) + "\n", { flag: "wx" });
  if (!verified) throw Error(failure ?? "EXACT_ARCHIVE_BYTES_AND_HASH_REQUIRED");
  console.log(JSON.stringify({ status: "PASS_EXACT_ARCHIVE_DOWNLOAD", bytes, sha256 }));
}

async function prepareWorker() {
  const marker = await open(resolve(evidence, ".preparation-started"), "wx"); await marker.close();
  const downloaded = JSON.parse(await readFile(resolve(evidence, "download.json"), "utf8"));
  const providerHash = await hashFile(provider);
  if (downloaded.status !== "PASS_EXACT_ARCHIVE_DOWNLOAD" || providerHash.bytes !== request.archive.bytes || providerHash.sha256 !== request.archive.sha256) throw Error("VERIFIED_PROVIDER_ARCHIVE_REQUIRED");
  const selected = await inspectNewArchive(provider, evidence);
  const records: FileRecord[] = [];
  const total = new ByteBudget(request.limits.contextBytes);
  const sourceBudget = new ByteBudget(request.limits.sourceBytes);
  const llvmBudget = new ByteBudget(request.llvm.maximumPayloadBytes);
  const cargoBudget = new ByteBudget(request.cargo.maximumPayloadBytes);
  await mkdir(context);
  async function copy(source: string, destination: string, budget: ByteBudget, expectedSha256?: string, expectedBytes?: number, mode?: number) {
    relativeInput(destination);
    const sourceStat = await lstat(source);
    if (!sourceStat.isFile() || expectedBytes !== undefined && sourceStat.size !== expectedBytes) throw Error("REGULAR_UNCHANGED_COPY_INPUT_REQUIRED");
    budget.charge(sourceStat.size); total.charge(sourceStat.size);
    const target = resolve(context, destination);
    await mkdir(dirname(target), { recursive: true });
    const input = await open(source, "r"), output = await open(target, "wx", mode === undefined ? 0o644 : mode & 0o777);
    const digest = createHash("sha256"); let bytes = 0;
    try {
      for await (const chunk of input.createReadStream({ autoClose: false })) {
        if (bytes + chunk.length > sourceStat.size) throw Error("COPY_INPUT_GREW");
        await output.writeFile(chunk); digest.update(chunk); bytes += chunk.length;
      }
      await output.sync();
    } finally { await input.close(); await output.close(); }
    const sha256 = digest.digest("hex");
    if (bytes !== sourceStat.size || expectedSha256 !== undefined && sha256 !== expectedSha256) throw Error("COPIED_SIZE_OR_HASH_MISMATCH");
    if (mode !== undefined) await chmod(target, mode & 0o777);
    records.push({ path: destination, kind: "file", bytes, sha256 });
  }
  async function json(destination: string, value: unknown) {
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
    sourceBudget.charge(bytes.length); total.charge(bytes.length);
    await mkdir(dirname(resolve(context, destination)), { recursive: true });
    await writeFile(resolve(context, destination), bytes, { flag: "wx" });
    records.push({ path: destination, kind: "file", bytes: bytes.length, sha256: hash(bytes) });
  }
  const bitcodeDestination = "gpu-runtime/rootfs/usr/local/cuda/nvvm/libdevice/libdevice.10.bc";
  await mkdir(dirname(resolve(context, bitcodeDestination)), { recursive: true });
  const bitcode = await extractMember(provider, selected.bitcode, resolve(context, bitcodeDestination), evidence, "libdevice");
  total.charge(bitcode.bytes);
  records.push({ path: bitcodeDestination, kind: "file", bytes: bitcode.bytes, sha256: bitcode.sha256 });
  const licenses = [];
  for (const [index, member] of selected.licenses.entries()) {
    const path = `gpu-runtime/rootfs/usr/local/share/licenses/chess-coach-libdevice/${index}-${member.name.split("/").at(-1)}`;
    await mkdir(dirname(resolve(context, path)), { recursive: true });
    const extracted = await extractMember(provider, member, resolve(context, path), evidence, `license-${index}`);
    total.charge(extracted.bytes); records.push({ path, kind: "file", bytes: extracted.bytes, sha256: extracted.sha256 });
    licenses.push({ member: member.name, path, bytes: extracted.bytes, sha256: extracted.sha256 });
  }
  const native = await sourceInventory(repository);
  const sourceGate = JSON.parse(await readFile(resolve(evidence, "source-gate.json"), "utf8"));
  requireReviewedNativePaths(native.map(source => source.path), sourceGate.sources);
  for (const source of native) if (!sourceGate.sources.some((reviewed: { path: string; sha256: string }) => reviewed.path === source.path && reviewed.sha256 === source.sha256)) throw Error("NATIVE_INPUT_CHANGED_BEFORE_COPY");
  for (const source of native) await copy(resolve(repository, source.path), nativeDestination(source.path), sourceBudget, source.sha256);
  await json("qualification-tools/qualification/source-manifest.json", native);
  const llvmRows = parseLlvmInventory(await readFile(resolve(repository, request.llvm.inventory), "utf8"));
  for (const row of llvmRows) {
    const source = resolve(request.llvm.prefix, row.path), destination = "gpu-build/llvm" + (row.path === "." ? "" : "/" + row.path);
    const current = await lstat(source);
    if (row.kind === "directory") {
      if (!current.isDirectory()) throw Error("LLVM_DIRECTORY_METADATA_CHANGED");
      await mkdir(resolve(context, destination), { recursive: true });
      await chmod(resolve(context, destination), row.mode & 0o777);
      records.push({ path: destination, kind: "directory", bytes: 0 });
    } else if (row.kind === "file") {
      if (current.mode !== row.mode) throw Error("LLVM_FILE_MODE_CHANGED");
      await copy(source, destination, llvmBudget, undefined, row.bytes, row.mode);
    } else {
      if (!current.isSymbolicLink() || await readlink(source) !== row.target) throw Error("LLVM_LINK_METADATA_CHANGED");
      await mkdir(dirname(resolve(context, destination)), { recursive: true });
      await symlink(row.target!, resolve(context, destination));
      total.charge(Buffer.byteLength(row.target!));
      records.push({ path: destination, kind: "symlink", bytes: Buffer.byteLength(row.target!), target: row.target });
    }
  }
  const lockText = await readFile(resolve(repository, "Cargo.lock"), "utf8");
  if (hash(lockText) !== request.cargo.lockSha256) throw Error("FROZEN_CARGO_LOCK_REQUIRED");
  const registry = JSON.parse(await readFile(resolve(repository, request.cargo.registryManifest), "utf8")) as RegistryEntry[];
  validateRegistry(registry, lockText);
  const home = resolve(repository, request.cargo.home), identity = request.cargo.registryIdentity;
  const config = `registry/index/${identity}/config.json`;
  const registryConfig = JSON.parse(await readFile(resolve(home, config), "utf8"));
  if (registryConfig.dl !== "https://static.crates.io/crates" || registryConfig.api !== "https://crates.io") throw Error("PUBLIC_CRATES_IO_METADATA_REQUIRED");
  await copy(resolve(home, config), "cargo-home/" + config, cargoBudget);
  let cachedCrates = 0, metadataFiles = 0;
  const missingArchives = [], missingMetadata = [];
  const copiedNames = new Set<string>();
  for (const entry of registry) {
    const archive = `registry/cache/${identity}/${entry.name}-${entry.version}.crate`;
    const present = await lstat(resolve(home, archive)).catch(error => { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; });
    if (present) { await copy(resolve(home, archive), "cargo-home/" + archive, cargoBudget, entry.checksum); cachedCrates++; }
    else missingArchives.push(`${entry.name}@${entry.version}`);
    if (!copiedNames.has(entry.name)) {
      copiedNames.add(entry.name);
      const path = `registry/index/${identity}/.cache/${sparsePath(entry.name)}`;
      const present = await lstat(resolve(home, path)).catch(error => { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; });
      if (present) { await copy(resolve(home, path), "cargo-home/" + path, cargoBudget); metadataFiles++; }
      else missingMetadata.push(entry.name);
    }
  }
  if (!cachedCrates || !metadataFiles) throw Error("EXISTING_LOCKED_CACHE_INPUTS_REQUIRED");
  records.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const inventoryBytes = Buffer.from(JSON.stringify(records, null, 2) + "\n");
  await writeFile(resolve(evidence, "context-manifest.json"), inventoryBytes, { flag: "wx" });
  const roots = ["current-native", "qualification-tools", "cargo-home", "gpu-build/llvm", "gpu-runtime/rootfs"];
  for (const root of roots) await mkdir(resolve(context, root), { recursive: true });
  const fileList = Buffer.from([...new Set([...roots, ...records.map(record => record.path)])].sort().join("\0") + "\0");
  const listPath = resolve(workspace, "context-files.nul");
  await writeFile(listPath, fileList, { flag: "wx" });
  const bundlePath = resolve(workspace, request.assets[0]!);
  const output = await open(bundlePath, "wx", 0o600);
  const child = Bun.spawn(["/usr/bin/tar", "--create", "--gzip", "--no-recursion", "--file=-", "--directory", context, "--null", "--files-from", listPath],
    { env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", TMPDIR: resolve(workspace, "tmp") }, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  let bundleBytes = 0, failure: string | null = null, stderrBytes = 0;
  const stderr = await open(resolve(evidence, "package.stderr"), "wx", 0o600);
  const digest = createHash("sha256");
  const tasks = [
    (async () => { for await (const chunk of child.stdout as ReadableStream<Uint8Array>) {
      if (bundleBytes + chunk.byteLength > request.limits.bundleBytes) { child.kill("SIGKILL"); throw Error("COMPRESSED_BUNDLE_LIMIT"); }
      await output.writeFile(chunk); digest.update(chunk); bundleBytes += chunk.byteLength;
    } })(),
    (async () => { for await (const chunk of child.stderr as ReadableStream<Uint8Array>) {
      if (stderrBytes + chunk.byteLength > 262144) { child.kill("SIGKILL"); throw Error("PACKAGE_STDERR_LIMIT"); }
      await stderr.writeFile(chunk); stderrBytes += chunk.byteLength;
    } })(),
  ];
  try { await Promise.all(tasks); if (await child.exited !== 0) throw Error("CONTEXT_PACKAGING_FAILED"); await output.sync(); }
  catch (error) { child.kill("SIGKILL"); await child.exited; await Promise.allSettled(tasks); failure = String(error); }
  finally { await output.close(); await stderr.close(); }
  if (failure) throw Error(failure);
  const bundleSha256 = digest.digest("hex");
  const workspaceBytes = request.archive.bytes + total.used + bundleBytes + fileList.length + inventoryBytes.length;
  if (workspaceBytes > request.limits.workspaceBytes) throw Error("WORKSPACE_PAYLOAD_BUDGET");
  const prepared = { version: "chess-coach.prepared-qualification-inputs.v1", status: "PASS_INPUT_PREPARATION_ONLY", workspace: request.workspace,
    context: relative(repository, context), contextManifest: relative(repository, resolve(evidence, "context-manifest.json")), contextManifestSha256: hash(inventoryBytes),
    nativeSourceInventory: native, nativeSourceCount: native.length, sourceBytes: sourceBudget.used, contextBytes: total.used, llvmBytes: llvmBudget.used,
    cargoBytes: cargoBudget.used, cachedCrateArchives: cachedCrates, registryMetadataFiles: metadataFiles, missingArchives, missingMetadata,
    completeOfflineBuildCoverageQualified: false, providerArchive: { bytes: providerHash.bytes, sha256: providerHash.sha256 },
    libdevice: { member: selected.bitcode.name, bytes: bitcode.bytes, sha256: bitcode.sha256 }, licenses,
    bundle: { path: relative(repository, bundlePath), name: request.assets[0], bytes: bundleBytes, sha256: bundleSha256 },
    workspacePayloadBytes: workspaceBytes, workspaceIsFilesystemQuota: false, llvmExecuted: false, newCargoFetchPerformed: false,
    operatorDownloadAuthorized: false, compilationPerformed: false, gpuExecuted: false, trainingReady: false };
  await writeFile(resolve(evidence, "preparation.json"), JSON.stringify(prepared, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: prepared.status, contextBytes: total.used, bundleBytes, bundleSha256, nativeSources: native.length, cachedCrates }));
}

async function main() {
  const [gatePath] = Bun.argv.slice(2);
  if (Bun.argv.length !== 3 || resolve(process.cwd()) !== resolve(repository)) throw Error("SCOPED_TRANSFER_CONTEXT_REQUIRED");
  const gate = await checkSourceGate(gatePath!);
  await mkdir(evidence);
  const attempts: { stage: string; attempted: boolean; result?: Awaited<ReturnType<typeof runBounded>>; streams?: { path: string; bytes: number; sha256: string }[] }[] = [];
  let status = "FAIL_PREFLIGHT", failure: string | null = null;
  try {
    await writeFile(resolve(evidence, "source-gate.json"), JSON.stringify(gate, null, 2) + "\n", { flag: "wx" });
    const space = await statfs(dirname(workspace));
    if (Number(space.bavail) * Number(space.bsize) < request.limits.minimumFreeBytes) throw Error("MINIMUM_FREE_WORKSPACE_REQUIRED");
    await mkdir(workspace); await mkdir(resolve(workspace, "tmp")); await mkdir(resolve(evidence, "home"));
    for (const [stage, timeoutMs] of [["download", request.limits.downloadMs], ["prepare", request.limits.prepareMs]] as const) {
      const step = resolve(evidence, stage); await mkdir(step);
      const attempt: typeof attempts[number] = { stage, attempted: true }; attempts.push(attempt);
      status = `FAIL_${stage.toUpperCase()}`;
      const result = await runBounded([process.execPath, "--no-env-file", "--no-install", resolve(work, "qualification/transfer/prepare.ts"), `--${stage}-worker`], step, timeoutMs,
        { cwd: repository, environment: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(evidence, "home"), TMPDIR: resolve(workspace, "tmp"), LANG: "C", LC_ALL: "C", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0" } });
      attempt.result = result;
      attempt.streams = await Promise.all(["stdout", "stderr"].map(async stream => { const path = resolve(step, `command.${stream}`), bytes = await readFile(path); return { path: relative(repository, path), bytes: bytes.length, sha256: hash(bytes) }; }));
      if (result.status !== "PASS") throw Error(`TRANSFER_${stage.toUpperCase()}_FAILED`);
    }
    status = "FAIL_POST_PREPARATION_SOURCE_CHECK";
    await checkSourceGate(gatePath!);
    status = "PASS_PREPARATION_ONLY_PUBLICATION_PENDING";
  } catch (error) { failure = String(error); }
  await writeFile(resolve(evidence, "receipt.json"), JSON.stringify({ version: "chess-coach.qualification-transfer-preparation.v1", status, failure, sourceGate: gate, attempts,
    automaticRetryAuthorized: false, downloadInvocationsConsumed: attempts.some(attempt => attempt.stage === "download") ? 1 : 0,
    preparationInvocationsConsumed: attempts.some(attempt => attempt.stage === "prepare") ? 1 : 0, publicationPerformed: false,
    publicationContinuationAuthorized: status === "PASS_PREPARATION_ONLY_PUBLICATION_PENDING",
    llvmExecuted: false, cargoExecuted: false, hostExecuted: false, compilationPerformed: false, gpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status, failure, receipt: relative(repository, resolve(evidence, "receipt.json")) }));
  process.exitCode = status === "PASS_PREPARATION_ONLY_PUBLICATION_PENDING" ? 0 : 1;
}

if (import.meta.main) {
  if (Bun.argv.length === 3 && Bun.argv[2] === "--download-worker") await downloadWorker();
  else if (Bun.argv.length === 3 && Bun.argv[2] === "--prepare-worker") await prepareWorker();
  else await main();
}
