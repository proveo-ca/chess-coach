// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

export const ROOT = "/home/gu1lty/Projects/proveo/chess-coach";
export const P = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/";
export const D = `${P}offline-reference-proposal-1/`;
export const R = `${D}package-acquisition-proposal-2/`;
export const Q = `${R}publication-1/`;
export const BASE = "6fdc92c7eb90eb625e6d54c6a448009d5db34423";
export const TARGET = "https://github.com/proveo-ca/chess-coach.git";
export const REF = "refs/heads/feat-ml-adjuntant-ii-continuation-2b24d9c5a";
export const BRANCH = "refs/heads/feat-ml-adjuntant-ii";
const CPU = "_work/gpu-owner-recovery/runs/host-cpu-regression-delivery-source-1/";
export const ROOTS = [P, `${CPU}cpu39-pass-report-1/`, `${CPU}publication-redelivery-execution-1/`];
export const SPECS = [".spec-index.json", "gate-closure.md", "gpu-full-qualification.puml", "gpu-qualification.puml", "gpu-readiness.md", "readiness.md", "runtime-protocol.puml"].map(name => `_spec/${name}`);
export const CONTROLS = ["cohort.json", "paths.nul", "freeze-observation.json"].map(name => `${Q}${name}`);
const LATE = new Set([...CONTROLS, ...["inventory-draft.json", "stage-check.json", "commit.stdout", "commit.stderr", "commit-exit.txt", "commit-intent.json", "push.stdout", "push.stderr", "push-exit.txt", "push-intent.json", "published.json", "operator-command.fish", "operator-command.stdout", "operator-command.stderr", "operator-command-exit.txt"].map(n => `${Q}${n}`)]);
const EXT = /(?:\.(?:json|jsonl|ts|tsx|source|stdout|stderr|txt|md|puml|py|diff|patch|toml|yaml|yml|html|css|js|mjs|xml|svg|sh|fish|lock|snap)|\/(?:\.gitignore|\.operation))$/;
type Pin = { bytes: number; sha256: string; gitBlobOid: string };
type Row = Pin & { path: string; classification: string; mode: string };
export function pin(bytes: Buffer): Pin {
  return { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), gitBlobOid: createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") };
}
const encode = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2) + "\n");
export function safe(path: string): void {
  assert(path.length > 0 && path.length <= 2048 && /^[A-Za-z0-9_./-]+$/.test(path));
  assert(path.split("/").every(p => p !== "" && p !== "." && p !== ".."));
}
export function classify(path: string, payloads: ReadonlySet<string>): string | null {
  safe(path);
  if (payloads.has(path)) return "ORIGINAL_PINNED_APPLICATION_OR_CORPUS_INPUT";
  if (SPECS.includes(path)) return "SPEC_PROJECTION";
  if (!ROOTS.some(root => path.startsWith(root)) || LATE.has(path)) return null;
  if (path.split("/").some(p => ["fixtures", "compiler-output", "__pycache__", "home", "tmp", "cache", "target", "node_modules", "scratch"].includes(p))) return null;
  assert(EXT.test(path), `unclassified-member:${path}`);
  return path.startsWith(P) ? "TASK_SOURCE_AND_HISTORICAL_TEXT_EVIDENCE" : "ACCEPTED_CPU_REPORT_OR_PUBLICATION_EVIDENCE";
}
function read(path: string): { bytes: Buffer; mode: string } {
  safe(path); assert(ROOTS.some(r => path.startsWith(r)) || SPECS.includes(path));
  let parent = dirname(path);
  while (parent !== ".") { const s = fs.lstatSync(join(ROOT, parent)); assert(s.isDirectory() && !s.isSymbolicLink()); parent = dirname(parent); }
  const s = fs.lstatSync(join(ROOT, path)); assert(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && s.size <= 16 * 1024 * 1024);
  const fd = fs.openSync(join(ROOT, path), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let bytes: Buffer;
  try { const t = fs.fstatSync(fd); assert(t.dev === s.dev && t.ino === s.ino && t.size === s.size); bytes = fs.readFileSync(fd); assert(bytes.length === s.size); }
  finally { fs.closeSync(fd); }
  if (!path.endsWith("/paths.nul")) { new TextDecoder("utf-8", { fatal: true }).decode(bytes); assert(!bytes.includes(0), `binary-member:${path}`); }
  return { bytes, mode: s.mode & 0o111 ? "100755" : "100644" };
}
function git(args: string[], input?: Buffer): Buffer {
  const r = spawnSync("git", args, { cwd: ROOT, input, encoding: "buffer", timeout: 30000, maxBuffer: 128 * 1024 * 1024 });
  assert(r.status === 0 && !r.error, `git-failed:${args[0]}:${r.stderr?.toString().slice(0, 1024)}`); return r.stdout;
}
function nul(bytes: Buffer): string[] { const text = bytes.toString("utf8"); assert(text === "" || text.endsWith("\0")); return text.split("\0").filter(Boolean); }
function create(path: string, bytes: Buffer): void {
  const fd = fs.openSync(join(ROOT, path), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const dir = fs.openSync(join(ROOT, dirname(path)), fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}
function baseline(stagedState = false): void {
  assert.equal(git(["rev-parse", "--verify", "HEAD"]).toString().trim(), BASE);
  assert.equal(git(["symbolic-ref", "--quiet", "HEAD"]).toString().trim(), BRANCH);
  assert.equal(git(["ls-remote", "--get-url", TARGET]).toString().trim(), TARGET);
  assert.deepEqual(nul(git(["diff", "--name-only", "-z"])).sort(), stagedState ? [] : [...SPECS].sort());
  const hp = spawnSync("git", ["config", "--get", "core.hooksPath"], { cwd: ROOT, encoding: "utf8", timeout: 10000 });
  assert(hp.status === 1 && hp.stdout === "", "custom-hooks-path");
  for (const name of ["pre-commit", "prepare-commit-msg", "commit-msg", "post-commit", "pre-push"]) assert(!fs.existsSync(join(ROOT, ".git/hooks", name)), `unexpected-hook:${name}`);
  const signing = spawnSync("git", ["config", "--bool", "--get", "commit.gpgsign"], { cwd: ROOT, encoding: "utf8", timeout: 10000 });
  assert(signing.status === 1 || (signing.status === 0 && signing.stdout.trim() === "false"), "unreviewed-commit-signing");
}
function attributes(paths: string[]): void {
  const values = nul(git(["check-attr", "-z", "filter", "working-tree-encoding", "text", "eol", "--stdin"], Buffer.from(paths.join("\0") + "\0")));
  assert.equal(values.length, paths.length * 12);
  for (let i = 0; i < values.length; i += 3) assert.equal(values[i + 2], "unspecified", `git-transformation:${values[i]}:${values[i + 1]}`);
}
function payloadPins(): Map<string, Pin> {
  const pins = new Map<string, Pin>();
  for (const [label, digest, count] of [["local-inputs-1", "2b13f0daad567013823ea2859a0107818ee9b09766347c2190ec3dfe47949506", 427], ["corpus-inputs-1", "b95bbe9c1568d8169c91d6ce3cb174afceab37ab65f973f66fbc62bb32f4841b", 2]] as const) {
    const bytes = read(`${D}${label}/materialization.json`).bytes; assert.equal(pin(bytes).sha256, digest);
    const m = JSON.parse(bytes.toString()); assert.equal(m.files.length, count);
    for (const r of m.files) { const path = `${D}${label}/inputs/reference/${r.path}`; safe(path); assert(!pins.has(path)); pins.set(path, { bytes: r.bytes, sha256: r.sha256, gitBlobOid: r.gitBlobOid }); }
  }
  assert.equal(pins.size, 429); assert.equal([...pins.values()].reduce((n, r) => n + r.bytes, 0), 4522249); return pins;
}
function selected(): { rows: Row[]; exclusions: number } {
  const payloads = payloadPins(), set = new Set(payloads.keys());
  const listed = nul(git(["ls-files", "--others", "--exclude-standard", "-z", "--", ...ROOTS])); assert(listed.length <= 20000);
  const paths = [...new Set([...listed.filter(p => classify(p, set) !== null), ...set, ...SPECS])].sort(); assert(paths.length <= 4000);
  const rows = paths.map(path => { const f = read(path), identity = pin(f.bytes), expected = payloads.get(path); if (expected) assert.deepEqual(identity, expected); return { path, classification: classify(path, set)!, mode: f.mode, ...identity }; });
  assert(rows.reduce((n, r) => n + r.bytes, 0) <= 128 * 1024 * 1024); attributes(paths);
  return { rows, exclusions: listed.filter(p => classify(p, set) === null).length };
}
export function parseBatch(bytes: Buffer, expected: readonly Row[]): void {
  let offset = 0;
  for (const row of expected) {
    const end = bytes.indexOf(10, offset); assert(end >= 0);
    assert.equal(bytes.subarray(offset, end).toString(), `${row.gitBlobOid} blob ${row.bytes}`);
    const start = end + 1, stop = start + row.bytes; assert(stop < bytes.length && bytes[stop] === 10);
    assert.deepEqual(pin(bytes.subarray(start, stop)), { bytes: row.bytes, sha256: row.sha256, gitBlobOid: row.gitBlobOid }); offset = stop + 1;
  }
  assert.equal(offset, bytes.length);
}
function freeze(): void {
  baseline(); assert.equal(git(["diff", "--cached", "--name-only", "-z"]).length, 0);
  for (const p of CONTROLS) assert(!fs.existsSync(join(ROOT, p)), "cohort-already-frozen");
  const { rows, exclusions } = selected();
  const manifest = encode({ version: "chess-coach.r2-publication-cohort.v1", scope: "EXACT_CONTENT_COHORT_PLUS_THREE_NAMED_CONTROL_FILES", baseline: BASE, branch: BRANCH, target: TARGET, destinationRef: REF, contentFiles: rows.length, contentBytes: rows.reduce((n, r) => n + r.bytes, 0), pinnedPayloadFiles: 429, pinnedPayloadBytes: 4522249, excludedGeneratedOrLatePaths: exclusions, controls: CONTROLS, members: rows, historicalFixtureReproducibilityClaimed: false, hostPacketMemberCount: 48, trainingReady: false });
  const paths = [...rows.map(r => r.path), ...CONTROLS].sort();
  const pathspec = Buffer.from(paths.join("\0") + "\0");
  create(CONTROLS[0]!, manifest); create(CONTROLS[1]!, pathspec);
  create(CONTROLS[2]!, encode({ version: "chess-coach.r2-publication-freeze.v1", status: "FROZEN_NOT_STAGED_OR_PUBLISHED", contentFiles: rows.length, stagedPathCount: paths.length, cohort: { path: CONTROLS[0], ...pin(manifest) }, pathspec: { path: CONTROLS[1], ...pin(pathspec) }, controlSelfHashExcluded: true, activeHooks: [], applicableAttributes: "ALL_UNSPECIFIED", normalCommitsConsumed: 0, httpsPushesConsumed: 0 }));
  process.stdout.write(JSON.stringify({ status: "FROZEN_NOT_STAGED_OR_PUBLISHED", files: paths.length, contentBytes: rows.reduce((n, r) => n + r.bytes, 0), controls: CONTROLS.map(path => ({ path, ...pin(read(path).bytes) })) }) + "\n");
}
function staged(): void {
  baseline(true); const manifestBytes = read(CONTROLS[0]!).bytes, pathspec = read(CONTROLS[1]!).bytes, observation = JSON.parse(read(CONTROLS[2]!).bytes.toString());
  assert.deepEqual(observation.cohort, { path: CONTROLS[0], ...pin(manifestBytes) }); assert.deepEqual(observation.pathspec, { path: CONTROLS[1], ...pin(pathspec) });
  const manifest = JSON.parse(manifestBytes.toString()); assert.equal(manifest.baseline, BASE); assert.deepEqual(manifest.controls, CONTROLS);
  const rows: Row[] = manifest.members; assert.equal(rows.length, manifest.contentFiles); assert(rows.length > 0 && rows.length <= 4000);
  for (const row of rows) { const f = read(row.path); assert.deepEqual({ mode: f.mode, ...pin(f.bytes) }, { mode: row.mode, bytes: row.bytes, sha256: row.sha256, gitBlobOid: row.gitBlobOid }); }
  const all: Row[] = [...rows, ...CONTROLS.map(path => { const f = read(path); return { path, classification: "PUBLICATION_CONTROL", mode: f.mode, ...pin(f.bytes) }; })].sort((a, b) => a.path.localeCompare(b.path, "en"));
  const expectedPaths = all.map(r => r.path).sort(); assert.deepEqual(nul(pathspec), expectedPaths);
  assert.deepEqual(nul(git(["diff", "--cached", "--name-only", "-z", "--no-renames"])).sort(), expectedPaths);
  const entries = nul(git(["ls-files", "--stage", "-z", "--", ...ROOTS, ...SPECS])); const wanted = new Map(all.map(r => [r.path, r])); let matched = 0;
  for (const entry of entries) { const tab = entry.indexOf("\t"), path = entry.slice(tab + 1), row = wanted.get(path); if (!row) continue; assert.equal(entry.slice(0, tab), `${row.mode} ${row.gitBlobOid} 0`); matched++; }
  assert.equal(matched, all.length); attributes(expectedPaths);
  parseBatch(git(["cat-file", "--batch"], Buffer.from(all.map(r => r.gitBlobOid).join("\n") + "\n")), all);
  git(["diff", "--cached", "--check", "--", ...SPECS, `${Q}verify-publication.ts`, `${Q}verify-publication.test.ts`]);
  create(`${Q}stage-check.json`, encode({ version: "chess-coach.r2-publication-stage-check.v1", status: "PASS_EXACT_STAGED_PATHS_RAW_BLOBS_MODES_AND_SOURCE_BYTES", baseline: BASE, files: all.length, bytes: all.reduce((n, r) => n + r.bytes, 0), pinnedPayloadFiles: 429, hostPacketMemberCount: 48, cohort: observation.cohort, pathspec: observation.pathspec, allStagedSha256Verified: true, applicableAttributes: "ALL_UNSPECIFIED", activeHooks: [], whitespaceScope: "SEVEN_SPECS_AND_PUBLICATION_SOURCES_NOT_HISTORICAL_OR_PINNED_SOURCE_BYTES", normalCommitsConsumed: 0, httpsPushesConsumed: 0 }));
  process.stdout.write(`PASS_EXACT_STAGED_PATHS_RAW_BLOBS_MODES_AND_SOURCE_BYTES ${all.length}\n`);
}
if (import.meta.main) {
  assert.equal(process.cwd(), ROOT); assert.equal(process.versions["bun"], "1.4.0"); assert(process.execArgv.includes("--no-env-file") && process.execArgv.includes("--no-install"));
  assert.equal(process.argv.length, 3); const mode = process.argv[2]; assert(mode === "inventory" || mode === "freeze" || mode === "staged");
  if (mode === "inventory") { const { rows, exclusions } = selected(); process.stdout.write(JSON.stringify({ files: rows.length, bytes: rows.reduce((n, r) => n + r.bytes, 0), excludedGeneratedOrLatePaths: exclusions, ignoredPayloadExceptions: [], members: rows }, null, 2) + "\n"); }
  else if (mode === "freeze") freeze(); else staged();
}
