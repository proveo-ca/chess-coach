// SPEC: _spec/gpu-input-transfer.puml
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, readlink, statfs, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const receivePlan = {
  repository: "proveo-ca/chess-coach", assetSourceCommit: "f3e277dbbf33c0aa69172cca1890792656d4cd09", releaseId: 439935095,
  manifest: { id: 730048215, name: "host-feasibility-inputs-1.manifest.json", bytes: 868843, sha256: "2676780f2b932d0453fef05ad39581152f47efeaea11ae22b9079875fece1829" },
  bundle: { id: 730047564, name: "host-feasibility-inputs-1.tar.gz", bytes: 140694281, sha256: "9001bfeb88ce5433138d5f0fd23b3c7ab0590cc0bd47900cc1c0a1d6923c65f7" },
  workspace: "_work/gpu-owner-recovery/cache/host-receive-1", evidence: "_work/gpu-owner-recovery/runs/host-input-receive-1",
  limits: { downloadsMs: 600000, extractAndVerifyMs: 180000, totalMs: 900000, contextBytes: 3221225472, minimumFreeBytes: 8589934592, workspaceBytes: 8589934592 },
  contextBytes: 429218730, contextFiles: 3800, recordedDirectories: 137, recordedLinks: 2, nativeInputs: 65,
} as const;
type Asset = { id: number; name: string; bytes: number; sha256: string };
export type InputRow = { path: string; kind: "file" | "directory" | "symlink"; bytes: number; sha256?: string; target?: string };
type Source = { path: string; sha256: string };
export type Manifest = { sourceCommit: string; bundle: { name: string; bytes: number; sha256: string }; files: InputRow[]; nativeSourceInventory: Source[];
  cachedCrateArchives: number; registryMetadataFiles: number; missingArchives: string[]; missingMetadata: string[]; completeOfflineBuildCoverageQualified: false };
type Digest = { bytes: number; sha256: string };
export type ContextResult = { bytes: number; files: number; directories: number; links: number; nativeInputs: number; nativeManifestSha256: string };
export type ReceiveIO = {
  now(): number;
  download(asset: Asset, remainingMs: number): Promise<Digest>;
  manifest(): Promise<unknown>;
  list(remainingMs: number): Promise<string>;
  extract(remainingMs: number): Promise<void>;
  verify(manifest: Manifest, remainingMs: number): Promise<ContextResult>;
};
export type ReceiveResult = { version: string; status: string; failure: string | null; stage: string; elapsedMs: number;
  attempts: { downloads: number; listing: number; extraction: number; verification: number }; assets: { name: string; bytes: number; sha256: string }[];
  context: ContextResult | null; missingArchives: string[]; missingMetadata: string[]; completeOfflineBuildCoverageQualified: false;
  compilationPerformed: false; llvmOrCargoExecuted: false; gpuExecuted: false; trainingReady: false };
const roots = ["current-native", "qualification-tools", "cargo-home", "gpu-build/llvm", "gpu-runtime/rootfs"];
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
export function hostCommandEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const environment = { ...source, GH_PROMPT_DISABLED: "1", GH_DEBUG: "", MISE_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false" };
  delete (environment as NodeJS.ProcessEnv).TAR_OPTIONS;
  return environment;
}
export async function writeRetained(writer: { write(bytes: Uint8Array): Promise<{ bytesWritten: number }> }, bytes: Uint8Array, retained: (part: Uint8Array) => void) {
  let offset = 0;
  while (offset < bytes.length) {
    const result = await writer.write(bytes.subarray(offset));
    check(Number.isInteger(result.bytesWritten) && result.bytesWritten > 0 && result.bytesWritten <= bytes.length - offset, "FILE_WRITE_PROGRESS_REQUIRED");
    retained(bytes.subarray(offset, offset + result.bytesWritten)); offset += result.bytesWritten;
  }
}
export function inputPath(path: string) {
  check(typeof path === "string" && path.length > 0 && !path.startsWith("/") && !/[\x00-\x20\x7f\\]/.test(path)
    && path.split("/").every(part => part !== "" && part !== "." && part !== ".."), "RELATIVE_CONTEXT_PATH_REQUIRED");
  return path;
}
export const nativePath = (path: string) => (path.startsWith("tooling/") || path.startsWith("_work/") ? "qualification-tools/" : "current-native/") + inputPath(path);

export function validateManifest(value: unknown): Manifest {
  const manifest = value as Manifest | null;
  check(manifest !== null && typeof manifest === "object" && manifest.sourceCommit === receivePlan.assetSourceCommit, "ASSET_SOURCE_COMMIT_MISMATCH");
  check(JSON.stringify(manifest!.bundle) === JSON.stringify({ name: receivePlan.bundle.name, bytes: receivePlan.bundle.bytes, sha256: receivePlan.bundle.sha256 }), "MANIFEST_BUNDLE_MISMATCH");
  check(Array.isArray(manifest!.files) && Array.isArray(manifest!.nativeSourceInventory) && manifest!.nativeSourceInventory.length === receivePlan.nativeInputs, "MANIFEST_INPUTS_REQUIRED");
  let bytes = 0, files = 0, directories = 0, links = 0;
  const paths = new Set<string>();
  for (const row of manifest!.files) {
    inputPath(row.path);
    check(!paths.has(row.path) && roots.some(root => row.path === root || row.path.startsWith(root + "/")), "UNEXPECTED_OR_DUPLICATE_CONTEXT_PATH");
    paths.add(row.path);
    check(Number.isSafeInteger(row.bytes) && row.bytes >= 0, "CONTEXT_SIZE_REQUIRED"); bytes += row.bytes;
    if (row.kind === "file") { check(typeof row.sha256 === "string" && /^[a-f0-9]{64}$/.test(row.sha256), "FILE_DIGEST_REQUIRED"); files++; }
    else if (row.kind === "directory") { check(row.bytes === 0, "DIRECTORY_BYTES_REQUIRED"); directories++; }
    else {
      check(row.kind === "symlink" && row.target === "lld" && ["gpu-build/llvm/bin/ld64.lld", "gpu-build/llvm/bin/lld-link"].includes(row.path) && row.bytes === 3, "RECORDED_LLVM_LINK_REQUIRED"); links++;
    }
  }
  check(bytes === receivePlan.contextBytes && bytes <= receivePlan.limits.contextBytes && files === receivePlan.contextFiles
    && directories === receivePlan.recordedDirectories && links === receivePlan.recordedLinks, "PREPARED_CONTEXT_TOTALS_MISMATCH");
  const native = new Set<string>();
  for (const source of manifest!.nativeSourceInventory) {
    inputPath(source.path); check(!native.has(source.path) && /^[a-f0-9]{64}$/.test(source.sha256), "NATIVE_INPUT_IDENTITY_REQUIRED"); native.add(source.path);
    check(manifest!.files.some(row => row.path === nativePath(source.path) && row.kind === "file" && row.sha256 === source.sha256), "NATIVE_INPUT_NOT_BOUND");
  }
  check(Array.isArray(manifest!.missingArchives) && manifest!.missingArchives.length === 103 && Array.isArray(manifest!.missingMetadata) && manifest!.missingMetadata.length === 0
    && manifest!.cachedCrateArchives === 568 && manifest!.registryMetadataFiles === 618 && manifest!.completeOfflineBuildCoverageQualified === false, "OFFLINE_BUILD_LIMITATION_REQUIRED");
  return manifest!;
}

export function verifyListing(text: string, manifest: Manifest) {
  check(text.length > 0 && text.length <= 2 * 1024 * 1024 && text.endsWith("\n"), "BOUNDED_ARCHIVE_LIST_REQUIRED");
  const paths = text.slice(0, -1).split("\n").map(path => inputPath(path.endsWith("/") ? path.slice(0, -1) : path));
  const expected = [...new Set([...roots, ...manifest.files.map(row => row.path)])].sort();
  check(new Set(paths).size === paths.length && JSON.stringify([...paths].sort()) === JSON.stringify(expected), "ARCHIVE_MEMBER_SET_MISMATCH");
  return paths.length;
}

export async function receive(io: ReceiveIO): Promise<ReceiveResult> {
  const result: ReceiveResult = { version: "chess-coach.operator-input-receive.v1", status: "FAIL_RECEIVE", failure: null, stage: "start", elapsedMs: 0,
    attempts: { downloads: 0, listing: 0, extraction: 0, verification: 0 }, assets: [], context: null, missingArchives: [], missingMetadata: [],
    completeOfflineBuildCoverageQualified: false, compilationPerformed: false, llvmOrCargoExecuted: false, gpuExecuted: false, trainingReady: false };
  const start = io.now(); let last = start;
  const remaining = (phaseDeadline: number) => {
    const now = io.now(); check(Number.isFinite(now) && now >= last, "MONOTONIC_HOST_CLOCK_REQUIRED"); last = now; result.elapsedMs = now - start;
    const ms = Math.floor(Math.min(start + receivePlan.limits.totalMs, phaseDeadline) - now); check(ms > 0, "HOST_RECEIVE_DEADLINE"); return ms;
  };
  try {
    check(Number.isFinite(start), "MONOTONIC_HOST_CLOCK_REQUIRED");
    const downloadDeadline = start + receivePlan.limits.downloadsMs;
    let manifest: Manifest | null = null;
    for (const asset of [receivePlan.manifest, receivePlan.bundle]) {
      result.stage = "download:" + asset.name; const ms = remaining(downloadDeadline); result.attempts.downloads++;
      const actual = await io.download(asset, ms);
      check(actual.bytes === asset.bytes && actual.sha256 === asset.sha256, "EXACT_ASSET_SIZE_AND_HASH_REQUIRED");
      result.assets.push({ name: asset.name, ...actual });
      remaining(downloadDeadline);
      if (asset.id === receivePlan.manifest.id) { result.stage = "manifest"; manifest = validateManifest(await io.manifest()); remaining(downloadDeadline); }
    }
    const phaseDeadline = io.now() + receivePlan.limits.extractAndVerifyMs;
    result.stage = "listing"; let ms = remaining(phaseDeadline); result.attempts.listing++;
    verifyListing(await io.list(ms), manifest!);
    result.stage = "extraction"; ms = remaining(phaseDeadline); result.attempts.extraction++;
    await io.extract(ms);
    result.stage = "verification"; ms = remaining(phaseDeadline); result.attempts.verification++;
    result.context = await io.verify(manifest!, ms);
    check(result.context.bytes === receivePlan.contextBytes && result.context.files === receivePlan.contextFiles && result.context.directories === receivePlan.recordedDirectories
      && result.context.links === receivePlan.recordedLinks && result.context.nativeInputs === receivePlan.nativeInputs, "EXTRACTED_CONTEXT_TOTALS_MISMATCH");
    remaining(phaseDeadline);
    result.missingArchives = manifest!.missingArchives; result.missingMetadata = manifest!.missingMetadata;
    result.status = "PASS_HOST_RECEIVE_AND_EXTRACT_ONLY"; result.stage = "complete";
  } catch (error) { result.failure = error instanceof Error ? error.message : "HOST_RECEIVE_FAILED"; }
  const end = io.now();
  if (Number.isFinite(end) && end >= last && Number.isFinite(start)) result.elapsedMs = Math.max(result.elapsedMs, end - start);
  return result;
}

async function fileDigest(path: string, deadline: number): Promise<Digest> {
  const file = await open(path, "r"), digest = createHash("sha256"); let bytes = 0;
  try { for await (const chunk of file.createReadStream({ autoClose: false })) { check(performance.now() < deadline, "HOST_RECEIVE_DEADLINE"); digest.update(chunk); bytes += chunk.length; } }
  finally { await file.close(); }
  return { bytes, sha256: digest.digest("hex") };
}

async function main() {
  const [grant, helperCommit] = Bun.argv.slice(2);
  check(Bun.argv.length === 4 && grant === "--approved-host-receive-1" && /^[a-f0-9]{40}$/.test(helperCommit ?? ""), "APPROVED_HOST_RECEIVE_COMMAND_REQUIRED");
  check(Bun.version === "1.4.0", "EXISTING_BUN_1_4_0_REQUIRED");
  check(hash(await readFile("Cargo.lock")) === "77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955", "HOST_REPOSITORY_CONTEXT_REQUIRED");
  const workspace = resolve(receivePlan.workspace), evidence = resolve(receivePlan.evidence), context = resolve(workspace, "context");
  await mkdir(evidence);
  let outcome: ReceiveResult | { status: string; failure: string } = { status: "FAIL_PREFLIGHT", failure: "PREFLIGHT_NOT_FINISHED" };
  const artifacts: { path: string; bytes: number; sha256: string; exitCode: number | null }[] = [];
  try {
    await mkdir(dirname(workspace), { recursive: true });
    const space = await statfs(dirname(workspace));
    check(Number(space.bavail) * Number(space.bsize) >= receivePlan.limits.minimumFreeBytes, "HOST_MINIMUM_FREE_BYTES_REQUIRED");
    await mkdir(workspace); await mkdir(context);
    const environment = hostCommandEnvironment(process.env);
    async function command(label: string, argv: string[], stdoutPath: string, maximumBytes: number, ms: number, binary = false): Promise<{ digest: Digest; text: string }> {
      const output = await open(stdoutPath, "wx", 0o600), stderrPath = resolve(evidence, label + ".stderr"), stderr = await open(stderrPath, "wx", 0o600);
      const child = spawn(argv[0]!, argv.slice(1), { env: environment, stdio: ["ignore", "pipe", "pipe"], timeout: ms, killSignal: "SIGKILL" });
      const done = new Promise<number | null>((resolveDone, rejectDone) => { child.once("error", rejectDone); child.once("close", code => resolveDone(code)); });
      let bytes = 0, errorBytes = 0, exitCode: number | null = null;
      const digest = createHash("sha256"), errorDigest = createHash("sha256"), chunks: Buffer[] = [];
      const tasks = [
        (async () => { for await (const chunk of child.stdout!) { check(bytes + chunk.length <= maximumBytes, "HOST_COMMAND_STDOUT_BYTE_LIMIT"); await writeRetained(output, chunk, part => { digest.update(part); bytes += part.length; }); if (!binary) chunks.push(Buffer.from(chunk)); } })(),
        (async () => { for await (const chunk of child.stderr!) { check(errorBytes + chunk.length <= 262144, "HOST_COMMAND_STDERR_BYTE_LIMIT"); await writeRetained(stderr, chunk, part => { errorDigest.update(part); errorBytes += part.length; }); } })(),
      ];
      try { const results = await Promise.all([...tasks, done]); exitCode = results[2] as number | null; check(exitCode === 0, "HOST_COMMAND_NONZERO:" + label); }
      catch (error) { child.kill("SIGKILL"); await Promise.allSettled([...tasks, done]); throw error; }
      finally {
        await output.close(); await stderr.close();
        artifacts.push({ path: binary ? receivePlan.workspace + "/" + stdoutPath.split("/").at(-1) : receivePlan.evidence + "/" + stdoutPath.split("/").at(-1), bytes, sha256: digest.copy().digest("hex"), exitCode });
        artifacts.push({ path: receivePlan.evidence + "/" + label + ".stderr", bytes: errorBytes, sha256: errorDigest.digest("hex"), exitCode });
      }
      return { digest: { bytes, sha256: digest.digest("hex") }, text: Buffer.concat(chunks).toString("utf8") };
    }
    outcome = await receive({ now: () => performance.now(),
      download: async (asset, ms) => (await command("download-" + asset.id, ["gh", "api", "--hostname", "github.com", "--method", "GET", "--header", "Accept: application/octet-stream", `repos/${receivePlan.repository}/releases/assets/${asset.id}`], resolve(workspace, asset.name), asset.bytes, ms, true)).digest,
      manifest: async () => JSON.parse(await readFile(resolve(workspace, receivePlan.manifest.name), "utf8")),
      list: async ms => (await command("archive-list", ["tar", "--list", "--gzip", "--file", resolve(workspace, receivePlan.bundle.name)], resolve(evidence, "archive-list.stdout"), 2 * 1024 * 1024, ms)).text,
      extract: async ms => { await command("extract", ["tar", "--extract", "--gzip", "--no-same-owner", "--file", resolve(workspace, receivePlan.bundle.name), "--directory", context], resolve(evidence, "extract.stdout"), 262144, ms); },
      verify: async (manifest, ms) => {
        const deadline = performance.now() + ms;
        let bytes = 0, files = 0, directories = 0, links = 0;
        for (const row of manifest.files) {
          check(performance.now() < deadline, "HOST_RECEIVE_DEADLINE");
          const path = resolve(context, inputPath(row.path)), metadata = await lstat(path);
          if (row.kind === "file") {
            check(metadata.isFile() && metadata.size === row.bytes, "EXTRACTED_FILE_SIZE_MISMATCH:" + row.path);
            const actual = await fileDigest(path, deadline); check(actual.sha256 === row.sha256 && actual.bytes === row.bytes, "EXTRACTED_FILE_HASH_MISMATCH:" + row.path); files++;
          } else if (row.kind === "directory") { check(metadata.isDirectory(), "EXTRACTED_DIRECTORY_MISMATCH"); directories++; }
          else { check(metadata.isSymbolicLink() && await readlink(path) === row.target, "EXTRACTED_LINK_MISMATCH"); links++; }
          bytes += row.bytes;
        }
        const nativeBytes = await readFile(resolve(context, "qualification-tools/qualification/source-manifest.json"));
        check(JSON.stringify(JSON.parse(nativeBytes.toString())) === JSON.stringify(manifest.nativeSourceInventory), "EMBEDDED_NATIVE_MANIFEST_MISMATCH");
        check(bytes + receivePlan.manifest.bytes + receivePlan.bundle.bytes <= receivePlan.limits.workspaceBytes, "HOST_WORKSPACE_SOFT_BYTE_LIMIT");
        return { bytes, files, directories, links, nativeInputs: manifest.nativeSourceInventory.length, nativeManifestSha256: hash(nativeBytes) };
      },
    });
  } catch (error) { outcome = { status: "FAIL_PREFLIGHT", failure: error instanceof Error ? error.message : "HOST_RECEIVE_PREFLIGHT_FAILED" }; }
  const receipt = { ...outcome, helperSourceCommit: helperCommit, helperSha256: hash(await readFile(Bun.main)), assetSourceCommit: receivePlan.assetSourceCommit,
    releaseId: receivePlan.releaseId, workspace: receivePlan.workspace, evidence: receivePlan.evidence, artifacts, automaticRetryAuthorized: false,
    workspaceIsFilesystemQuota: false, compilationPerformed: false, llvmOrCargoExecuted: false, gpuExecuted: false, trainingReady: false };
  await writeFile(resolve(evidence, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: receipt.status, failure: receipt.failure, receipt: receivePlan.evidence + "/receipt.json", assetSourceCommit: receivePlan.assetSourceCommit,
    helperSourceCommit: helperCommit, trainingReady: false }));
  process.exitCode = receipt.status === "PASS_HOST_RECEIVE_AND_EXTRACT_ONLY" ? 0 : 1;
}

if (import.meta.main) await main();
