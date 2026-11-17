// SPEC: _spec/runtime-protocol.puml
import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as https from "node:https";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectVerifiedArchive } from "../../_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source2/capture.ts";

export { inspectVerifiedArchive };
const FILE = fileURLToPath(import.meta.url), ROOT = resolve(dirname(FILE), "../..");
const P = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1";
const OP = resolve(ROOT, "artifacts/training-functional/scratch/reference-prep-1"), REPORT = resolve(ROOT, "artifacts/training-functional/reference-prep-1");
const MIB = 1048576, REFERENCE = "b4b241481fb12de4a7344e6dba8eda775af57675";
const INPUT_PINS = { "local-inputs-1": ["bb03f45257fae1d8ca11710b53547936c3042380188ab10117b704b692d39fb0", "2b13f0daad567013823ea2859a0107818ee9b09766347c2190ec3dfe47949506"], "corpus-inputs-1": ["25c53eae03508b523fc36a962984c4aad23a0f0784b6c71123ac6e320f335460", "b95bbe9c1568d8169c91d6ce3cb174afceab37ab65f973f66fbc62bb32f4841b"] };
const ENTRIES = ["challenge/admission.ts", "challenge/corpus.ts", "challenge/r3Session.ts", "players/strategic.ts", "run/bank.ts"].map(p => `packages/starchess-arena/src/${p}`).concat("packages/starchess-core/src/index.ts");
export const JSSHA: Parameters<typeof inspectVerifiedArchive>[1] = {
  name: "jssha", version: "3.3.2", url: "https://registry.npmjs.org/jssha/-/jssha-3.3.2.tgz", archiveFile: "jssha-3.3.2.tgz",
  integrity: "sha512-0RhFxzijV4W0qTXa97D5b6twAWXX7SEOpw8qzAZyZ+oeGOP9e84PnDSLjl7SBB1vBQ+chSUwsZR06i1AzA+nEA==",
  requiredMembers: [{ member: "package/package.json", retainedFile: "jssha-3.3.2-package.json", futureRelativePath: "node_modules/jssha/package.json" },
    { member: "package/dist/sha256.mjs", retainedFile: "jssha-3.3.2-dist-sha256.mjs", futureRelativePath: "node_modules/jssha/dist/sha256.mjs" }],
  optionalLicenseMembersInPreferenceOrder: ["package/LICENSE", "package/LICENSE.md", "package/LICENSE.txt"], maximumLicenseFiles: 1, licenseRetainedFilePrefix: "jssha-3.3.2-",
};
function check(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const json = <T>(b: Uint8Array): T => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(b)) as T;
const encoded = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2) + "\n");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function safe(path: string): string { check(typeof path === "string" && !isAbsolute(path) && !/[\\\0]/.test(path) && path.split("/").every(p => p && p !== "." && p !== ".."), "unsafe-path"); return path; }
function parents(path: string): void { for (let p = dirname(resolve(path)); ; p = dirname(p)) { const s = fs.lstatSync(p); check(s.isDirectory() && !s.isSymbolicLink(), "unsafe-parent"); if (p === dirname(p)) break; } }
function read(path: string, cap = MIB, installed = false): Buffer {
  parents(path); const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try { const a = fs.fstatSync(fd, { bigint: true }); check(a.isFile() && (installed || a.nlink === 1n) && a.size <= BigInt(cap), "regular-file-bound");
    const b = Buffer.alloc(Number(a.size) + 1); let n = 0, k = 0;
    while ((k = fs.readSync(fd, b, n, b.length - n, null)) > 0) { n += k; check(n <= Number(a.size), "file-growth"); }
    const z = fs.fstatSync(fd, { bigint: true }); check(n === Number(a.size) && a.size === z.size && a.mtimeNs === z.mtimeNs && a.ctimeNs === z.ctimeNs, "read-drift"); return b.subarray(0, n);
  } finally { fs.closeSync(fd); }
}
function write(path: string, b: Uint8Array, mode = 0o600, cap = MIB): void { check(b.length <= cap, "write-bound"); parents(path); const fd = fs.openSync(path, "wx", mode); try { fs.writeFileSync(fd, b); fs.fchmodSync(fd, mode); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function put(root: string, path: string, b: Uint8Array, mode = 0o644): void { const dest = resolve(root, safe(path)); fs.mkdirSync(dirname(dest), { recursive: true, mode: 0o700 }); write(dest, b, mode, 16 * MIB); }
export function claimFresh(root: string) { parents(root); fs.mkdirSync(root, { mode: 0o700 }); const marker = { id: randomUUID(), pid: process.pid, started: new Date().toISOString(), automaticRetry: false }; write(resolve(root, "attempt.json"), encoded(marker)); return marker; }
interface InputEntry { path: string; expectedBytes?: number; bytes?: number; sourceMode?: string; mode?: string; gitBlobOid?: string }
interface Row { path: string; bytes: number; sha256: string; sourceMode: string; gitBlobOid?: string }
interface InputManifest { reference: string; sourceRoot: string; entries: InputEntry[] }
interface Materialization { reference: string; inputManifestSha256: string; files: Row[] }
interface InputCheck { reference: string; inputManifestSha256: string; materializationSha256: string; check: string }
export function mapInputRows(manifest: InputManifest, material: Materialization, count: number, bytes: number): Row[] {
  check(manifest.reference === REFERENCE && material.reference === REFERENCE && Array.isArray(manifest.entries) && Array.isArray(material.files), "input-reference");
  check(manifest.entries.length === count && material.files.length === count, "input-count");
  const mapped = new Map(material.files.map(r => [safe(r.path), r])); check(mapped.size === count, "duplicate-material"); const seen = new Set<string>();
  const rows = manifest.entries.map(e => { const path = safe(e.path), r = mapped.get(path), mode = e.sourceMode ?? e.mode, size = e.expectedBytes ?? e.bytes;
    check(!seen.has(path) && r && r.bytes === size && r.sourceMode === mode && r.gitBlobOid === e.gitBlobOid, "input-membership"); seen.add(path);
    check(Number.isSafeInteger(size) && size! >= 0 && size! <= 16 * MIB && /^(100644|100755)$/.test(mode!) && /^[a-f0-9]{64}$/.test(r.sha256) && (e.gitBlobOid === undefined || /^[a-f0-9]{40}$/.test(e.gitBlobOid)), "input-fields"); return { ...r };
  }); check(rows.reduce((n, r) => n + r.bytes, 0) === bytes, "input-total"); return rows;
}
function tree(root: string, prefix = "", allowLink = false): string[] { parents(resolve(root, "leaf")); return fs.readdirSync(root, { withFileTypes: true }).flatMap(d => { const p = prefix + d.name; if (allowLink && p === "node_modules/@chess-coach/starchess-core" && d.isSymbolicLink()) return []; check(d.isDirectory() || d.isFile(), "input-not-regular"); return d.isDirectory() ? tree(resolve(root, d.name), p + "/", allowLink) : [p]; }); }
export function validateRow(root: string, row: Row): Buffer {
  check(/^(100644|100755)$/.test(row.sourceMode) && Number.isSafeInteger(row.bytes) && row.bytes >= 0 && row.bytes <= 16 * MIB && /^[a-f0-9]{64}$/.test(row.sha256), "source-row-fields");
  const path = resolve(root, safe(row.path)), b = read(path, 16 * MIB); check(b.length === row.bytes && sha(b) === row.sha256 && (fs.lstatSync(path).mode & 0o777) === parseInt(row.sourceMode, 8) % 0o1000, "source-hash-mode");
  if (row.gitBlobOid !== undefined) check(createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex") === row.gitBlobOid, "source-git-blob"); return b;
}
function loadInputs(kind: keyof typeof INPUT_PINS, count: number, bytes: number) {
  const base = resolve(ROOT, P, kind), m = read(resolve(base, "input-manifest.json")), t = read(resolve(base, "materialization.json")), c = read(resolve(base, "check.json"));
  const pin = json<InputCheck>(c), manifest = json<InputManifest>(m), material = json<Materialization>(t);
  check(pin.reference === REFERENCE && pin.check.startsWith("PASS_EXACT_") && sha(m) === pin.inputManifestSha256 && sha(t) === pin.materializationSha256 && material.inputManifestSha256 === sha(m), "input-document-hash");
  check(same([pin.inputManifestSha256, pin.materializationSha256], INPUT_PINS[kind]), "input-current-pins");
  check(manifest.sourceRoot === `${P}/${kind}/inputs/reference`, "input-root"); const root = resolve(ROOT, safe(manifest.sourceRoot)), rows = mapInputRows(manifest, material, count, bytes);
  check(same(tree(root).sort(), rows.map(r => r.path).sort()), "input-exact-tree");
  return { root, rows, documents: { kind, checkSha256: sha(c), inputManifestSha256: sha(m), materializationSha256: sha(t) } };
}
export interface Response { status: number; encoding?: string | string[]; body: AsyncIterable<Uint8Array> }
export type Transport = (signal: AbortSignal) => Promise<Response>;
export async function download(transport: Transport, sink: (b: Buffer) => void, durationMs = 30000): Promise<Buffer> {
  check(Number.isFinite(durationMs) && durationMs > 0 && durationMs <= 30000, "get-duration");
  const abort = new AbortController(), chunks: Buffer[] = []; let total = 0, timer: ReturnType<typeof setTimeout> | undefined;
  const cutoff = performance.now() + durationMs, active = () => check(!abort.signal.aborted && performance.now() < cutoff, "get-deadline");
  try { return await Promise.race([(async () => {
    active(); const response = await transport(abort.signal); active(); check(response.status === 200, "http-status-no-redirect"); check(response.encoding === undefined || response.encoding === "identity", "http-encoding");
    for await (const value of response.body) { active(); check(value instanceof Uint8Array && total + value.length <= 2 * MIB, "stream-bound-or-abort"); const b = Buffer.from(value); total += b.length; sink(b); active(); chunks.push(b); }
    active(); return Buffer.concat(chunks, total);
  })(), new Promise<never>((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new Error("get-deadline")); }, durationMs); })]);
  } finally { if (timer) clearTimeout(timer); abort.abort(); }
}
const tls: Transport = signal => new Promise((accept, reject) => {
  const request = https.request(JSSHA.url, { method: "GET", agent: false, rejectUnauthorized: true, signal, maxHeaderSize: 8192, headers: { "Accept-Encoding": "identity", Connection: "close" } }, response => {
    response.on("error", () => {}); signal.addEventListener("abort", () => { response.destroy(); response.socket?.destroy(); }, { once: true });
    accept({ status: response.statusCode ?? 0, encoding: response.headers["content-encoding"], body: response });
  }); signal.addEventListener("abort", () => { request.destroy(); request.socket?.destroy(); }, { once: true }); request.on("error", reject); request.end();
});
function archiveSpec() {
  const raw = read(resolve(ROOT, P, "package-acquisition-proposal-2/plan.json"));
  const row = json<{ archives: (typeof JSSHA)[] }>(raw).archives.find(a => a.name === "jssha"); check(row, "plan-jssha");
  for (const key of Object.keys(JSSHA) as (keyof typeof JSSHA)[]) check(same(row[key], JSSHA[key]), "plan-archive-map"); return { spec: JSSHA, planSha256: sha(raw) };
}
async function acquireWorker() {
  const { spec, planSha256 } = archiveSpec(), fd = fs.openSync(resolve(OP, "raw", spec.archiveFile), "wx", 0o600); let bytes: Buffer;
  try { console.log(JSON.stringify({ event: "GET_INVOKED", url: JSSHA.url, requests: 1 })); bytes = await download(tls, b => { fs.writeFileSync(fd, b); }); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const inspected = inspectVerifiedArchive(bytes, spec), files = inspected.files.map(f => { write(resolve(OP, "selected", safe(f.retainedFile)), f.data, 0o644); return { path: f.retainedFile, member: f.member, bytes: f.data.length, sha256: sha(f.data), sourceMode: "100644", license: f.license }; });
  write(resolve(OP, "selected/acquisition.json"), encoded({ actualGetRequests: 1, url: spec.url, integrity: spec.integrity, archiveSha256: sha(bytes), archiveBytes: bytes.length, planSha256, files, licenseMember: inspected.licenseMember, legalClearance: false }));
}
interface Acquisition { actualGetRequests: number; url: string; integrity: string; archiveSha256: string; archiveBytes: number; files: (Row & { member: string; license: boolean })[]; licenseMember: string | null }
function acquired() {
  const a = json<Acquisition>(read(resolve(OP, "selected/acquisition.json"))), raw = read(resolve(OP, "raw", JSSHA.archiveFile), 2 * MIB), inspected = inspectVerifiedArchive(raw, JSSHA);
  check(a.actualGetRequests === 1 && a.url === JSSHA.url && a.integrity === JSSHA.integrity && a.archiveSha256 === sha(raw) && a.archiveBytes === raw.length && a.licenseMember === inspected.licenseMember, "acquisition-binding");
  check(same(a.files, inspected.files.map(f => ({ path: f.retainedFile, member: f.member, bytes: f.data.length, sha256: sha(f.data), sourceMode: "100644", license: f.license }))), "selected-membership");
  for (const r of a.files) validateRow(resolve(OP, "selected"), r); return a;
}
function assemble() {
  const inputs = [loadInputs("local-inputs-1", 427, 3850400), loadInputs("corpus-inputs-1", 2, 671849)], acquisition = acquired(), source = resolve(OP, "source"), rows: Row[] = [];
  fs.mkdirSync(source, { mode: 0o700 }); const add = (row: Row, b: Buffer) => { check(!rows.some(r => r.path === row.path), "assembled-duplicate"); put(source, row.path, b, parseInt(row.sourceMode, 8) % 0o1000); rows.push(row); };
  for (const input of inputs) for (const row of input.rows) add(row, validateRow(input.root, row));
  const fflate = resolve(ROOT, "node_modules/.pnpm/fflate@0.8.3/node_modules/fflate"), pkg = read(resolve(fflate, "package.json"), MIB, true);
  const manifest = json<{ name: string; version: string; exports: unknown }>(pkg); check(manifest.name === "fflate" && manifest.version === "0.8.3", "fflate-identity");
  for (const path of ["package.json", "esm/index.mjs", "LICENSE"]) { const b = path === "package.json" ? pkg : read(resolve(fflate, path), MIB, true), mode = fs.lstatSync(resolve(fflate, path)).mode & 0o777; check(mode === 0o644 || mode === 0o755, "fflate-file-mode"); add({ path: `node_modules/fflate/${path}`, bytes: b.length, sha256: sha(b), sourceMode: "100" + mode.toString(8) }, b); }
  for (const row of acquisition.files) { const b = validateRow(resolve(OP, "selected"), row); add({ path: `node_modules/jssha/${row.member.slice("package/".length)}`, bytes: b.length, sha256: sha(b), sourceMode: "100644" }, b); }
  const jssha = json<{ exports: Record<string, unknown> }>(read(resolve(source, "node_modules/jssha/package.json")));
  check((jssha.exports?.["./sha256"] as { import?: unknown } | undefined)?.import === "./dist/sha256.mjs", "jssha-sha256-export");
  fs.mkdirSync(resolve(source, "node_modules/@chess-coach"), { mode: 0o700 }); fs.symlinkSync("../../packages/starchess-core", resolve(source, "node_modules/@chess-coach/starchess-core"));
  check(fs.realpathSync(resolve(source, "node_modules/@chess-coach/starchess-core")) === resolve(source, "packages/starchess-core"), "workspace-link");
  write(resolve(OP, "selected/input-manifest.json"), encoded({ reference: REFERENCE, files: rows, documents: inputs.map(i => i.documents), acquisition, fflate: { origin: relative(ROOT, fflate), archiveSRIverified: false, exports: manifest.exports }, jsshaExports: jssha.exports, workspaceLink: "../../packages/starchess-core", referenceCodeEvaluated: false, trainingReady: false }));
}
export function verifyReference(source: string, bundles: string, metadata: Uint8Array) {
  interface File { path: string; byteLength: number; sha256: string }
  check(metadata.length <= MIB, "reference-metadata-bound");
  const doc = json<{ version: string; reference: string; bunVersion: string; inventory: { entry: string; inputs: File[]; output: File }[] }>(metadata);
  check(doc.version === "chess-coach.reference-bundles.v1" && doc.reference === REFERENCE && doc.bunVersion === "1.4.0" && Array.isArray(doc.inventory) && doc.inventory.length === 6, "reference-identity-six");
  check(same(doc.inventory.map(i => i.entry).sort(), [...ENTRIES].sort()), "reference-membership");
  const inspect = (root: string, f: File) => { check(Number.isSafeInteger(f.byteLength) && f.byteLength >= 0 && f.byteLength <= 16 * MIB && /^[a-f0-9]{64}$/.test(f.sha256), "reference-file-fields"); const b = read(resolve(root, safe(f.path)), 16 * MIB); check(b.length === f.byteLength && sha(b) === f.sha256, "reference-file-hash"); };
  for (const item of doc.inventory) { check(item.output.path === item.entry && Array.isArray(item.inputs) && item.inputs.length > 0 && item.inputs.length <= 4096 && new Set(item.inputs.map(i => i.path)).size === item.inputs.length, "reference-input-membership"); inspect(bundles, item.output); for (const f of item.inputs) inspect(source, f); }
  return doc;
}
function buildWorker() {
  const cutoff = performance.now() + 240000; assemble(); const remaining = Math.floor(cutoff - performance.now()); check(remaining > 0, "build-deadline");
  const result = Bun.spawnSync([process.execPath, "--no-env-file", "--no-install", resolve(ROOT, "tooling/build-reference.ts"), resolve(OP, "source"), resolve(OP, "bundles")], { cwd: ROOT, env: environment(), stdout: "inherit", stderr: "inherit", timeout: remaining });
  check(result.exitCode === 0 && !result.signalCode && performance.now() < cutoff, "builder-failed-or-deadline"); verifyReference(resolve(OP, "source"), resolve(OP, "bundles"), read(resolve(OP, "bundles/selected-reference.json"))); check(performance.now() < cutoff, "build-postverify-deadline");
}
function environment() { return { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(OP, "logs/home"), TMPDIR: resolve(OP, "logs/home"), CI: "1", TERM: "dumb", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0" }; }
async function phase(mode: "acquire-worker" | "build-worker", start: number, budgetMs: number) {
  const fds: number[] = []; let reason: string | null = null;
  const counts = [0, 0], eof = [false, false]; let exitCode: number | null = null, child: ReturnType<typeof Bun.spawn> | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  const stop = (why: string) => { reason ??= why; if (child) { try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} } } };
  try {
    check(performance.now() < start + budgetMs, "phase-preflight-deadline"); for (const s of ["stdout", "stderr"]) fds.push(fs.openSync(resolve(OP, `logs/${mode}.${s}`), "wx", 0o600));
    child = Bun.spawn([process.execPath, "--no-env-file", "--no-install", FILE, mode], { cwd: ROOT, env: environment(), stdin: "ignore", stdout: "pipe", stderr: "pipe", detached: true });
    timer = setTimeout(() => stop("phase-deadline"), Math.max(1, budgetMs - (performance.now() - start)));
    const drain = async (stream: ReadableStream<Uint8Array>, index: number) => { const reader = stream.getReader(); try { while (true) { const { value, done } = await reader.read(); if (done) { eof[index] = true; break; } const kept = Math.max(0, Math.min(value.length, MIB - counts[index]!)); if (kept) fs.writeFileSync(fds[index]!, value.subarray(0, kept)); counts[index]! += value.length; if (counts[index]! > MIB) stop("phase-output-cap"); } } catch { stop("phase-pipe-error"); } finally { reader.releaseLock(); } };
    const results = await Promise.allSettled([child.exited, drain(child.stdout as ReadableStream<Uint8Array>, 0), drain(child.stderr as ReadableStream<Uint8Array>, 1)]);
    exitCode = results[0]!.status === "fulfilled" ? results[0]!.value as number : null;
  } finally { for (const fd of fds) { try { fs.fsyncSync(fd); } catch { reason ??= "phase-log-sync"; } try { fs.closeSync(fd); } catch { reason ??= "phase-log-close"; } } if (timer) clearTimeout(timer); }
  const durationMs = Math.ceil(performance.now() - start); if (durationMs >= budgetMs) reason ??= "phase-deadline";
  return { mode, budgetMs, durationMs, exitCode, signalCode: child?.signalCode ?? null, reason, stdoutBytes: counts[0], stderrBytes: counts[1], stdoutEOF: eof[0], stderrEOF: eof[1], status: exitCode === 0 && !child?.signalCode && !reason && eof.every(Boolean) ? "PASS" : "FAIL" };
}
function freshPlan() {
  const b = read(resolve(REPORT, "plan.json")), p = json<{ reference: string; bunVersion: string; acquisition: { maximumGets: number; url: string; integrity: string; archiveBytes: number; getMs: number; phaseMs: number }; assembly: { applicationManifestSha256: string; applicationMaterializationSha256: string; corpusManifestSha256: string; corpusMaterializationSha256: string }; build: { assemblyAndBuildPhaseMs: number }; freshScratchRoot: string; trackedEvidenceRoot: string; trainingReady: boolean }>(b);
  check(p.reference === REFERENCE && p.bunVersion === "1.4.0" && p.acquisition.maximumGets === 1 && p.acquisition.url === JSSHA.url && p.acquisition.integrity === JSSHA.integrity && p.acquisition.archiveBytes === 2 * MIB && p.acquisition.getMs === 30000 && p.acquisition.phaseMs === 120000 && p.build.assemblyAndBuildPhaseMs === 240000 && p.freshScratchRoot === relative(ROOT, OP) && p.trackedEvidenceRoot === relative(ROOT, REPORT) && p.trainingReady === false, "fresh-plan-bindings");
  check(same([p.assembly.applicationManifestSha256, p.assembly.applicationMaterializationSha256], INPUT_PINS["local-inputs-1"]) && same([p.assembly.corpusManifestSha256, p.assembly.corpusMaterializationSha256], INPUT_PINS["corpus-inputs-1"]), "fresh-plan-input-pins"); return sha(b);
}
function verifyInputs(bytes: Buffer) {
  const inventory = json<{ reference: string; files: Row[]; workspaceLink: string; referenceCodeEvaluated: boolean; trainingReady: boolean }>(bytes), source = resolve(OP, "source");
  check(inventory.reference === REFERENCE && inventory.files.length >= 434 && inventory.files.length <= 435 && new Set(inventory.files.map(r => r.path)).size === inventory.files.length && inventory.referenceCodeEvaluated === false && inventory.trainingReady === false, "assembled-inventory");
  check(same(tree(source, "", true).sort(), inventory.files.map(r => r.path).sort()), "assembled-exact-tree");
  for (const row of inventory.files) validateRow(source, row);
  check(inventory.workspaceLink === "../../packages/starchess-core" && fs.readlinkSync(resolve(source, "node_modules/@chess-coach/starchess-core")) === inventory.workspaceLink && fs.realpathSync(resolve(source, "node_modules/@chess-coach/starchess-core")) === resolve(source, "packages/starchess-core"), "assembled-link"); return inventory;
}
async function run() {
  const acquisitionOrigin = performance.now(), attempt = claimFresh(OP), phases: Awaited<ReturnType<typeof phase>>[] = []; let status = "FAIL", error: string | null = null, buildOrigin = 0, planSha256: string | null = null;
  const proofs: { path: string; sha256: string; bytes: number }[] = [];
  try {
    parents(resolve(REPORT, "receipt.json")); planSha256 = freshPlan(); for (const name of ["raw", "selected", "logs", "logs/home"]) fs.mkdirSync(resolve(OP, name), { mode: 0o700 });
    const acquisition = await phase("acquire-worker", acquisitionOrigin, 120000); phases.push(acquisition); check(acquisition.status === "PASS", "acquire-worker-failed");
    buildOrigin = performance.now(); const build = await phase("build-worker", buildOrigin, 240000); phases.push(build); check(build.status === "PASS", "build-worker-failed");
    const inputs = read(resolve(OP, "selected/input-manifest.json")), bundles = read(resolve(OP, "bundles/selected-reference.json")); verifyInputs(inputs); verifyReference(resolve(OP, "source"), resolve(OP, "bundles"), bundles); acquired();
    for (const [path, b] of [["input-manifest.json", inputs], ["selected-reference.json", bundles]] as const) { check(performance.now() < buildOrigin + 240000, "final-build-deadline"); write(resolve(REPORT, path), b); proofs.push({ path, sha256: sha(b), bytes: b.length }); } check(performance.now() < buildOrigin + 240000, "final-build-deadline"); status = "PASS";
  } catch (e) { error = String(e).slice(0, 4096); }
  try { for (const p of phases) for (const stream of ["stdout", "stderr"]) { const path = `${p.mode}.${stream}`, b = read(resolve(OP, "logs", path)); write(resolve(REPORT, path), b); proofs.push({ path, sha256: sha(b), bytes: b.length }); } } catch (e) { status = "FAIL"; error ??= String(e).slice(0, 4096); }
  if (status === "PASS" && performance.now() >= buildOrigin + 240000) { status = "FAIL"; error = "final-build-deadline"; }
  const receipt = { version: "chess-coach.reference-prep.v1", scope: "REFERENCE_PREPARATION_NOT_FUNCTIONAL_QUALIFICATION", reference: REFERENCE, bunVersion: Bun.version, status, attempt, phases, proofs, planSha256, error, operationRoot: relative(ROOT, OP), actualGetRequests: phases[0]?.status === "PASS" ? 1 : null, referenceCodeEvaluated: false, trainingReady: false, strictEscapedProcessAssurance: false };
  write(resolve(REPORT, "receipt.json"), encoded(receipt)); console.log(JSON.stringify(receipt)); if (status !== "PASS") process.exitCode = 1;
}
function verify() {
  const receipt = json<{ version: string; status: string; attempt: unknown; phases: { mode: string; status: string }[]; proofs: { path: string; sha256: string; bytes: number }[]; planSha256: string; actualGetRequests: number; referenceCodeEvaluated: boolean; trainingReady: boolean }>(read(resolve(REPORT, "receipt.json")));
  check(receipt.version === "chess-coach.reference-prep.v1" && receipt.status === "PASS" && receipt.actualGetRequests === 1 && receipt.referenceCodeEvaluated === false && receipt.trainingReady === false && same(receipt.attempt, json(read(resolve(OP, "attempt.json")))) && same(receipt.phases.map(p => [p.mode, p.status]), [["acquire-worker", "PASS"], ["build-worker", "PASS"]]), "receipt-not-passing");
  check(sha(read(resolve(REPORT, "plan.json"))) === receipt.planSha256, "receipt-plan-hash");
  const names = ["input-manifest.json", "selected-reference.json", "acquire-worker.stdout", "acquire-worker.stderr", "build-worker.stdout", "build-worker.stderr"];
  check(same(receipt.proofs.map(p => p.path).sort(), names.sort()), "receipt-proof-membership");
  for (const proof of receipt.proofs) { const b = read(resolve(REPORT, safe(proof.path))); check(b.length === proof.bytes && sha(b) === proof.sha256, "receipt-proof-hash"); }
  verifyInputs(read(resolve(REPORT, "input-manifest.json"))); verifyReference(resolve(OP, "source"), resolve(OP, "bundles"), read(resolve(REPORT, "selected-reference.json"))); acquired();
  console.log(JSON.stringify({ status: "PASS_READ_ONLY_RECHECK", actualGetRequests: 0, referenceCodeEvaluated: false, trainingReady: false }));
}
if (import.meta.main) {
  try {
    check(process.argv.length === 3 && ROOT === "/home/gu1lty/Projects/proveo/chess-coach-integration" && process.cwd() === ROOT && resolve(process.argv[1]!) === FILE && Bun.version === "1.4.0" && process.execArgv.includes("--no-env-file") && process.execArgv.includes("--no-install"), "exact-bun-cli-context");
    const mode = process.argv[2]; check(["run", "acquire-worker", "build-worker", "verify"].includes(mode!), "unknown-mode");
    if (mode === "run") await run(); else if (mode === "verify") verify(); else { const attempt = json<{ pid: number }>(read(resolve(OP, "attempt.json"))); check(attempt.pid === process.ppid, "worker-parent"); if (mode === "acquire-worker") await acquireWorker(); else buildWorker(); }
  } catch (e) { console.error(String(e).slice(0, 4096)); process.exitCode = 1; }
}
