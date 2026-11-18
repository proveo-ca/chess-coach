// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPOSITORY = fileURLToPath(new URL("../../../", import.meta.url));
export const PACKET1 = "artifacts/training-functional/full-training-packet-1";
export const PACKET2 = "artifacts/training-functional/full-training-packet-2";
export const BASE_COMMIT = "5b47be42b0378198750992b1547915b43f9cea99";
export const CHANGED_CANDIDATES = ["campaign-plan.ts", "campaign-operator.ts", "campaign-plan.test.ts", "campaign-operator.e2e.test.ts"]
  .map(name => `artifacts/training-functional/${name}`);
export const HARNESS_TEST = "artifacts/training-functional/campaign-evidence.test.ts";
export const HARNESS_ARCHIVE = `${PACKET2}/preserved-test-harness/campaign-evidence.test.ts.source`;
export type Pin = { path: string; byteLength: number; sha256: string };
type Preserved = Pin & { gitBlob: string | null; gitMatches: boolean; archive: Pin | null };
type Preservation = { version: string; baseCommit: string; sourceManifest: Pin; packet1Files: Pin[]; workerSource: Preserved[];
  changedCandidates: { original: Pin; archive: Pin }[]; scope: string; hostPreparationExecuted: false; trainingExecuted: false };
export function ensure(value: unknown, code: string): asserts value { if (!value) throw new Error(`Packet2: ${code}`); }
export function sha(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function relative(path: string): string {
  ensure(/^[a-zA-Z0-9_./-]+$/.test(path) && !path.startsWith("/") && path.split("/").every(p => p && p !== "." && p !== ".."), "RELATIVE_PATH");
  return path;
}
export function readBytes(path: string, cap = 4 * 1048576): Buffer {
  const full = resolve(REPOSITORY, relative(path)), stat = lstatSync(full);
  ensure(stat.isFile() && !stat.isSymbolicLink() && stat.size <= cap, `REGULAR_BOUNDED_FILE:${path}`);
  const bytes = readFileSync(full); ensure(bytes.length === stat.size, `READ_SIZE_DRIFT:${path}`); return bytes;
}
export function pin(path: string): Pin { const bytes = readBytes(path); return { path, byteLength: bytes.length, sha256: sha(bytes) }; }
export function readJson<T>(path: string): T { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(readBytes(path))) as T; }
export function assertPin(expected: Pin, actualPath = expected.path): void {
  const actual = pin(actualPath); ensure(actual.byteLength === expected.byteLength && actual.sha256 === expected.sha256, `PIN:${actualPath}`);
}
export function createPacketDirectory(path: string, exclusive = false): void {
  relative(path); ensure(path === PACKET2 || path.startsWith(PACKET2 + "/"), "PACKET2_WRITE_ONLY");
  const root = resolve(REPOSITORY); ensure(realpathSync(root) === root && lstatSync(root).isDirectory(), "PHYSICAL_REPOSITORY");
  let current = "";
  for (const part of path.split("/")) {
    current = current ? `${current}/${part}` : part; const full = resolve(root, current); let existed = true;
    try { const stat = lstatSync(full); ensure(stat.isDirectory() && !stat.isSymbolicLink(), "PHYSICAL_OUTPUT_PARENT"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      ensure(current === PACKET2 || current.startsWith(PACKET2 + "/"), "PACKET2_CREATE_ONLY");
      mkdirSync(full, { mode: 0o700 }); existed = false;
    }
    ensure(realpathSync(full) === full, "PHYSICAL_OUTPUT_PARENT");
    ensure(!exclusive || current !== path || !existed, "OUTPUT_DIRECTORY_EXISTS");
  }
}
export function writeNew(path: string, bytes: Uint8Array | string): void {
  relative(path); ensure(path.startsWith(PACKET2 + "/"), "PACKET2_WRITE_ONLY");
  createPacketDirectory(dirname(path)); writeFileSync(resolve(REPOSITORY, path), bytes, { flag: "wx", mode: 0o600 });
}
export function writeJson(path: string, value: unknown): void { writeNew(path, JSON.stringify(value, null, 2) + "\n"); }
function git(args: string[], input?: Buffer, allowFailure = false) {
  const result = Bun.spawnSync(["git", "--no-optional-locks", ...args], { cwd: REPOSITORY,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", GIT_TERMINAL_PROMPT: "0" }, stdin: input ?? "ignore", stdout: "pipe", stderr: "pipe", timeout: 10000 });
  ensure(allowFailure || result.exitCode === 0, "LOCAL_GIT_QUERY"); ensure(result.stdout.length <= 4 * 1048576, "GIT_OUTPUT_BOUND"); return result;
}
function tree(directory: string): Pin[] {
  const files: Pin[] = []; let total = 0;
  function walk(path: string): void {
    for (const name of readdirSync(resolve(REPOSITORY, path)).sort()) {
      const child = `${path}/${name}`, stat = lstatSync(resolve(REPOSITORY, child)); ensure(!stat.isSymbolicLink(), "PACKET1_SYMLINK");
      if (stat.isDirectory()) walk(child);
      else { const row = pin(child); ensure(files.length < 1000 && (total += row.byteLength) <= 32 * 1048576, "PACKET1_TREE_BOUND"); files.push(row); }
    }
  }
  walk(directory); return files.sort((a, b) => a.path.localeCompare(b.path));
}
function snapshot(path: string): Pin {
  const destination = `${PACKET2}/preserved-packet-1/${relative(path)}.source`;
  writeNew(destination, readBytes(path)); return pin(destination);
}
export function preservePacket1(): Preservation {
  ensure(new TextDecoder().decode(git(["rev-parse", "HEAD"]).stdout).trim() === BASE_COMMIT, "BASE_COMMIT");
  const manifestPath = `${PACKET1}/source-manifest.json`, manifest = readJson<{ fileCount: number; files: Pin[] }>(manifestPath);
  ensure(manifest.fileCount === 112 && manifest.files.length === 112, "OLD_WORKER_COUNT");
  const packet1Files = tree(PACKET1), sourceManifest = pin(manifestPath), archives = new Map<string, Pin>();
  const changedCandidates = CHANGED_CANDIDATES.map(path => { const original = pin(path), archive = snapshot(path); archives.set(path, archive); return { original, archive }; });
  const checked = git(["cat-file", "--batch-check"], Buffer.from(manifest.files.map(row => `${BASE_COMMIT}:${relative(row.path)}`).join("\n") + "\n"));
  const objects = new TextDecoder().decode(checked.stdout).trimEnd().split("\n"); ensure(objects.length === manifest.files.length, "GIT_MEMBER_COUNT");
  const workerSource = manifest.files.map((row, index): Preserved => {
    assertPin(row); const object = /^([a-f0-9]{40}) blob ([0-9]+)$/.exec(objects[index]!);
    const gitBlob = object?.[1] ?? null, sameSize = object !== null && Number(object[2]) === row.byteLength;
    const gitMatches = sameSize && sha(git(["cat-file", "blob", gitBlob!]).stdout) === row.sha256;
    let archive = archives.get(row.path) ?? null;
    if (!gitMatches && archive === null) { archive = snapshot(row.path); archives.set(row.path, archive); }
    return { ...row, gitBlob, gitMatches, archive };
  });
  const record: Preservation = { version: "chess-coach.packet2-packet1-preservation.v1", baseCommit: BASE_COMMIT, sourceManifest, packet1Files,
    workerSource, changedCandidates, scope: "OLD_112_WORKER_BYTES_RECOVERABLE_FROM_VERIFIED_GIT_OR_EXACT_ARCHIVE_DEPENDENCY_AND_HOST_USABILITY_NOT_ATTESTED",
    hostPreparationExecuted: false, trainingExecuted: false };
  writeJson(`${PACKET2}/preservation.json`, record); checkPreservedPacket1(); return record;
}
export function checkPreservedPacket1(): Preservation {
  const record = readJson<Preservation>(`${PACKET2}/preservation.json`);
  ensure(record.version === "chess-coach.packet2-packet1-preservation.v1" && record.baseCommit === BASE_COMMIT && record.workerSource.length === 112, "PRESERVATION_IDENTITY");
  assertPin(record.sourceManifest);
  const currentTree = tree(PACKET1); ensure(JSON.stringify(currentTree) === JSON.stringify(record.packet1Files), "IMMUTABLE_PACKET1_DRIFT");
  for (const row of record.workerSource) {
    if (row.archive !== null) { assertPin(row.archive); assertPin(row, row.archive.path); }
    else { ensure(row.gitMatches && row.gitBlob !== null && /^[a-f0-9]{40}$/.test(row.gitBlob), "OLD_SOURCE_RECOVERY");
      const bytes = git(["cat-file", "blob", row.gitBlob]).stdout; ensure(bytes.length === row.byteLength && sha(bytes) === row.sha256, "OLD_GIT_SOURCE_DRIFT"); }
    if (!CHANGED_CANDIDATES.includes(row.path)) assertPin(row);
  }
  ensure(record.changedCandidates.length === CHANGED_CANDIDATES.length && CHANGED_CANDIDATES.every(path => record.changedCandidates.some(row => row.original.path === path)), "DECLARED_SOURCE_CANDIDATES");
  for (const row of record.changedCandidates) { assertPin(row.archive); assertPin(row.original, row.archive.path); }
  return record;
}
export function checkTestHarnessAdjustment() {
  const record = readJson<{ status: string; original: Pin; current: Pin; changes: { line: number; before: string; after: string }[] }>(`${PACKET2}/test-harness-adjustment.json`);
  ensure(record.status === "PASS_EXACT_THREE_SYNTHETIC_TEST_TIMEOUT_ARGUMENT_DELTAS_ONLY" && record.current.path === HARNESS_TEST && record.original.path === HARNESS_ARCHIVE,
    "HARNESS_ADJUSTMENT_IDENTITY"); assertPin(record.original); assertPin(record.current);
  ensure(record.original.sha256 === "768182e11dfa08eeec0816a39bc6cfa066fe818f07b0c5d56e0589f7f1e25234", "ORIGINAL_EVIDENCE_TEST_PIN");
  const before = readBytes(HARNESS_ARCHIVE).toString("utf8").split("\n"), after = readBytes(HARNESS_TEST).toString("utf8").split("\n");
  const changes = before.flatMap((line, index) => line === after[index] ? [] : [{ line: index + 1, before: line, after: after[index] }]);
  ensure(before.length === after.length && changes.length === 3 && changes.every(row => row.before.replace(/30000\);$/, "60000);") === row.after) &&
    JSON.stringify(changes) === JSON.stringify(record.changes), "ONLY_THREE_TEST_TIMEOUT_ARGUMENTS"); return record;
}
if (import.meta.main) {
  try {
    ensure(Bun.argv.length === 3 && ["--baseline", "--check"].includes(Bun.argv[2]!), "USAGE_PRESERVE_BASELINE_OR_CHECK");
    const record = Bun.argv[2] === "--baseline" ? preservePacket1() : checkPreservedPacket1();
    console.log("Executor: " + JSON.stringify({ status: "PASS_PACKET1_BYTES_PRESERVED", workerSourceFiles: record.workerSource.length,
      gitMatches: record.workerSource.filter(row => row.gitMatches).length, archivedWorkerFiles: record.workerSource.filter(row => row.archive !== null).length,
      archivedChangeCandidates: record.changedCandidates.length, immutablePacket1Files: record.packet1Files.length, hostPreparationExecuted: false }));
  } catch (error) { console.error("Executor: " + String(error)); process.exitCode = 1; }
}
