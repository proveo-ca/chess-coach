// SPEC: _spec/gpu-qualification.puml
import { createHash } from "node:crypto";
import { lstat, mkdir, open, opendir, readFile, readlink, realpath, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { repository, work } from "../provision";
import { runBounded } from "../verify";

export const prefix = "/home/agent/toolchains/linux-amd64/.local/share/mise/installs/github-tracel-ai-tracel-llvm/23.1.0-4";
const directory = resolve(work, "runs/gpu-qualification-input-inventory-1");
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Metadata = { kind: "directory" | "file" | "symlink" | "other"; bytes: number; mode: number; uid: number; gid: number; links: number };
export type MetadataIO = { root(): Promise<string>; stat(path: string): Promise<Metadata>; entries(path: string): AsyncIterable<string>; link(path: string): Promise<string>; emit(line: string): Promise<void> };

export async function inventoryMetadata(io: MetadataIO, limits: { entries: number; bytes: number }) {
  let entries = 0, bytes = 0, apparentRegularFileBytes = 0;
  let root: string | null = null, failure: string | null = null;
  const counts = { directory: 0, file: 0, symlink: 0, other: 0 };
  async function record(path: string, metadata: Metadata) {
    if (entries >= limits.entries) throw Error("METADATA_ENTRY_LIMIT");
    if (!Number.isSafeInteger(metadata.bytes) || metadata.bytes < 0) throw Error("INVALID_METADATA_SIZE");
    const target = metadata.kind === "symlink" ? await io.link(path) : undefined;
    const line = JSON.stringify({ path: relative(root!, path) || ".", ...metadata, ...(target === undefined ? {} : { target }) }) + "\n";
    const size = Buffer.byteLength(line);
    if (bytes + size > limits.bytes) throw Error("METADATA_OUTPUT_LIMIT");
    await io.emit(line);
    bytes += size; entries++; counts[metadata.kind]++;
    if (metadata.kind === "file") {
      apparentRegularFileBytes += metadata.bytes;
      if (!Number.isSafeInteger(apparentRegularFileBytes)) throw Error("APPARENT_SIZE_OVERFLOW");
    }
  }
  try {
    root = await io.root();
    const rootStat = await io.stat(root);
    await record(root, rootStat);
    if (rootStat.kind !== "directory") throw Error("DIRECTORY_ROOT_REQUIRED");
    const directories = [root];
    while (directories.length) {
      const current = directories.pop()!;
      for await (const name of io.entries(current)) {
        if (entries >= limits.entries) throw Error("METADATA_ENTRY_LIMIT");
        if (!name || name === "." || name === ".." || name.includes("/")) throw Error("DIRECT_ENTRY_NAME_REQUIRED");
        const path = join(current, name), metadata = await io.stat(path);
        await record(path, metadata);
        if (metadata.kind === "directory") directories.push(path);
      }
    }
  } catch (error) { failure = String(error).slice(0, 1024); }
  return { kind: "inventory-summary", complete: failure === null, root, entries, metadataBytes: bytes, apparentRegularFileBytes,
    apparentBytesCountEachDirectoryEntry: true, allocatedStorageEstablished: false, counts, failure, payloadsRead: false, nestedSymlinksFollowed: false };
}

async function scan() {
  if (process.env.SCOPED_LLVM_METADATA_WORKER !== "1") throw Error("SCOPED_METADATA_WORKER_REQUIRED");
  const marker = await open(resolve(directory, ".inventory-started"), "wx"); await marker.close();
  const result = await inventoryMetadata({ root: () => realpath(prefix), stat: async path => {
    const value = await lstat(path);
    return { kind: value.isDirectory() ? "directory" : value.isFile() ? "file" : value.isSymbolicLink() ? "symlink" : "other",
      bytes: value.size, mode: value.mode, uid: value.uid, gid: value.gid, links: value.nlink };
  }, entries: async function* (path) { for await (const entry of await opendir(path)) yield entry.name; }, link: readlink,
  emit: line => new Promise<void>((done, reject) => { process.stdout.write(line, error => error ? reject(error) : done()); }),
  }, { entries: 20_000, bytes: 4 * 1024 * 1024 - 65536 });
  console.log(JSON.stringify(result));
  process.exitCode = result.complete ? 0 : 1;
}

async function main() {
  if (Bun.argv.length !== 2 || resolve(process.cwd()) !== resolve(repository)) throw Error("INPUT_INVENTORY_CONTEXT_REQUIRED");
  const request = JSON.parse(await readFile(resolve(work, "qualification/input-request.json"), "utf8"));
  if (request.llvm.prefix !== prefix || request.llvm.maximumInvocations !== 1 || request.llvm.deadlineMs !== 60_000
    || request.llvm.maximumEntries !== 20_000 || request.llvm.maximumRetainedOutputBytes !== 10485760 || request.llvm.payloadReadsAuthorized !== false) throw Error("EXACT_INPUT_INVENTORY_SCOPE_REQUIRED");
  await mkdir(directory);
  const paths = ["qualification/input-request.json", "qualification/input-inventory.ts", "verify.ts", "command-supervisor.ts"];
  const sources = await Promise.all(paths.map(async path => ({ path: relative(repository, resolve(work, path)), sha256: digest(await readFile(resolve(work, path))) })));
  await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx" });
  let result: Awaited<ReturnType<typeof runBounded>> | null = null, failure: string | null = null, summary: unknown = null;
  try {
    result = await runBounded([process.execPath, "--no-env-file", "--no-install", resolve(work, "qualification/input-inventory.ts"), "--scan"], directory, 60_000,
      { cwd: repository, environment: { PATH: "/usr/local/bin:/usr/bin:/bin", SCOPED_LLVM_METADATA_WORKER: "1", LANG: "C", LC_ALL: "C" } });
    const lines = (await readFile(resolve(directory, "command.stdout"), "utf8")).trim().split("\n");
    const last = JSON.parse(lines.at(-1)!);
    if (last.kind === "inventory-summary") summary = last;
  } catch (error) { failure = String(error).slice(0, 1024); }
  const streams = [];
  for (const stream of ["stdout", "stderr"]) {
    const path = resolve(directory, `command.${stream}`);
    try { const bytes = await readFile(path); streams.push({ path: relative(repository, path), bytes: bytes.length, sha256: digest(bytes) }); }
    catch (error) { failure ??= String(error).slice(0, 1024); }
  }
  let sourceChanged = false;
  try { sourceChanged = (await Promise.all(sources.map(async source => digest(await readFile(resolve(repository, source.path))) !== source.sha256))).some(Boolean); }
  catch { sourceChanged = true; }
  const status = !failure && !sourceChanged && result?.status === "PASS" && (summary as { complete?: boolean } | null)?.complete === true ? "PASS_METADATA_ONLY" : "FAIL_OR_INCOMPLETE_METADATA";
  await writeFile(resolve(directory, "receipt.json"), JSON.stringify({ version: "chess-coach.gpu-qualification-input-inventory.v1", status, failure, sourceChanged, result, summary, streams,
    invocationsConsumed: 1, remainingInvocations: 0, automaticRetryAuthorized: false, inventoryComplete: status === "PASS_METADATA_ONLY", nativeLlvmExecuted: false,
    prefixPayloadsRead: false, prefixCopied: false, prefixSelected: false, operatorHostPacketExecuted: false, compilationPerformed: false, gpuExecutionPerformed: false,
    trainingReady: false }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status, summary, receipt: relative(repository, resolve(directory, "receipt.json")) }));
  process.exitCode = status === "PASS_METADATA_ONLY" ? 0 : 1;
}

if (import.meta.main) {
  if (Bun.argv.length === 3 && Bun.argv[2] === "--scan") await scan();
  else await main();
}
