// SPEC: _spec/qualification-bootstrap.puml
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

const H = "/home/gu1lty/Projects/proveo/chess-coach", RUNS = `${H}/_work/gpu-owner-recovery/runs`;
const D = `${RUNS}/training-qualification-delivery-1`, S = `${D}/source`, I = `${RUNS}/training-qualification-inputs-1`;
const R = `${RUNS}/training-qualification-1`, L = `${RUNS}/training-qualification-launcher-1.ts`;
const B = `${H}/_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun`, ENTRY = "artifacts/training-functional/qualification-bootstrap.ts";
const Q = "artifacts/training-functional/qualification-packet-1/source-3", PREP = "artifacts/training-functional/reference-prep-2";
const P = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1";
const REFERENCE = "b4b241481fb12de4a7344e6dba8eda775af57675", MIB = 1048576;
const FLAGS = ["--no-env-file", "--no-install"], SCOPE = "OFFLINE_PREPARATION_NOT_QUALIFICATION";
const ROLES = ["source", "tests", "closure", "dependencyLock", "image", "runtimeConfiguration", "coreRules", "strategicSource",
  "corpusManifest", "corpusSource", "recipe", "featureLayout", "fixtureManifest", "hostConfiguration"];
const ADAPTERS = ["score", "channel"].map(name => `artifacts/training-functional/qualification-policy-${name}.ts`);
export type ByteRef = { byteLength: number; sha256: string };
export type PayloadRow = ByteRef & { path: string };
export type ReferenceRow = { path: string; bytes: number; sha256: string; sourceMode: string; gitBlobOid?: string };
type Document = { role: string; source: PayloadRow; futurePath: string };
type Bindings = { scope: string; documents: Document[] };
type Metadata = { version: string; reference: string; bunVersion: string; inventory: { entry: string; inputs: PayloadRow[]; output: PayloadRow }[] };
type Helpers = { mapInputRows(manifest: unknown, material: unknown, count: number, bytes: number): ReferenceRow[];
  verifyReference(source: string, bundles: string, bytes: Uint8Array): Metadata };
type Operator = { qualificationInputManifest(bindings: Bindings, rows: readonly PayloadRow[]): { version: string; documents: Document[]; source: PayloadRow[]; reference: PayloadRow[] };
  validateQualificationInputs(io: Pick<BootstrapIO, "read" | "alias">, roots: { app: string; reference: string; documents: string }): Promise<unknown> };
export type FileInfo = { kind: "file" | "directory" | "symlink" | "other"; size: number; mode: number };
export type BootstrapContext = { cwd: string; realpath: string; executable: string; entrypoint: string; version: string; flags: string[]; pid: number; ppid: number };
export type ChildResult = { stdout: Uint8Array; stderr: Uint8Array; exitCode: number | null; signal: string | null;
  exited: boolean; reaped: boolean; stdoutEOF: boolean; stderrEOF: boolean; forced: boolean; error: string | null };
export type CommandRequest = { argv: readonly string[]; cwd: string; env: Record<string, string>; detached: boolean; deadlineMs: number; cleanupDeadlineMs: number;
  stdoutBytes: number; stderrBytes: number; now(): number };
export type BootstrapIO = {
  now(): number; alarm(ms: number, callback: () => void): () => void; context(): Promise<BootstrapContext>;
  absent(path: string): Promise<void>; mkdir(path: string): Promise<void>; read(path: string, cap: number): Promise<Uint8Array>;
  write(path: string, bytes: Uint8Array, mode: number): Promise<void>; stat(path: string): Promise<FileInfo>;
  entries(path: string): AsyncIterable<{ name: string; kind: FileInfo["kind"] }>;
  symlink(path: string, target: string): Promise<void>; alias(path: string, target: string): Promise<void>; chmod(path: string, mode: number): Promise<void>;
  loadModule(path: string): Promise<unknown>; command(request: CommandRequest): Promise<ChildResult>;
};
type CommandProof = { argv: readonly string[]; cwd: string; deadlineMs: number; cleanupDeadlineMs: number;
  result: Omit<ChildResult, "stdout" | "stderr">; stdout: PayloadRow; stderr: PayloadRow };
export type BootstrapReceipt = { version: "chess-coach.qualification-bootstrap.v1"; phase: "bootstrap" | "preparation"; scope: typeof SCOPE;
  status: "PASS" | "FAIL"; publicationCommit: string; inputManifest: PayloadRow | null; referenceBuilds: number; qualified: false; trainingReady: false;
  commands: CommandProof[]; failures: string[]; preparationReceipt: PayloadRow | null };
type Group = { kind: string; count: number; bytes: number; input: string; material: string; check: string };
export type BootstrapContract = { documents: PayloadRow[]; sourceCount: number; sourceBytes: number; canonical: PayloadRow; groups: Group[];
  flatCount: number; flatBytes: number; referenceFiles: PayloadRow[]; referenceInputs: number; appFiles: number; appBytes: number; fileBytes: number; treeEntries: number };
const contract: BootstrapContract = {
  documents: [["source-manifest.json", 20258, "9820e6bfb34f5891117379b207cfd193330d5bd1efbf6c8d36f6ff6e0328836b"],
    ["verification.json", 15082, "5edf5fa735abbf8be5b38c7389a580199d947e7b845ce3a2a31ecbcc43a45f75"],
    ["binding-documents.json", 5087, "5cd45f5cad1b5f08e07a54cbfd68834ff00eda4f0d6c40f02922bac07d3ca7fe"]].map(([name, n, hash]) => ({ path: `${Q}/${name}`, byteLength: Number(n), sha256: String(hash) })),
  sourceCount: 108, sourceBytes: 641523,
  canonical: { path: `${PREP}/input-manifest.json`, byteLength: 128630, sha256: "51b6e846ec9c9e0fa645b4f309a667e5a95842306f8f610a06123b2cf9af97d7" },
  groups: [{ kind: "local-inputs-1", count: 427, bytes: 3850400, input: "bb03f45257fae1d8ca11710b53547936c3042380188ab10117b704b692d39fb0", material: "2b13f0daad567013823ea2859a0107818ee9b09766347c2190ec3dfe47949506", check: "acca1e84beb0ebfacf3fb0a7967ffe5d16552861b0da98a4f7e6b4367cee9c63" },
    { kind: "corpus-inputs-1", count: 2, bytes: 671849, input: "25c53eae03508b523fc36a962984c4aad23a0f0784b6c71123ac6e320f335460", material: "b95bbe9c1568d8169c91d6ce3cb174afceab37ab65f973f66fbc62bb32f4841b", check: "663a17aafd8b3ee4eb2db83e0c58e2074b113c6b99e07fa96d3d6e6733d86f8d" }],
  flatCount: 6, flatBytes: 113300, referenceInputs: 95, appFiles: 4096, appBytes: 128 * MIB, fileBytes: 16 * MIB, treeEntries: 8192,
  referenceFiles: [["packages/starchess-arena/src/challenge/admission.ts", 77587, "50255867609e615113aa7dbb1e9d315b7194494a03219b5d9b3aaff737889c26"],
    ["packages/starchess-arena/src/challenge/corpus.ts", 81433, "9a59255f598343896d1d42d8566cb4facdbfa7354e673d0c4e3adcf6fd3d431c"],
    ["packages/starchess-arena/src/challenge/r3Session.ts", 315327, "f22b0322b03400a14fe1fc41af3091610d2d5ad60169e1f67df1a4e396d431e3"],
    ["packages/starchess-arena/src/players/strategic.ts", 115300, "f48eb1a6016202272d609f373718c33ca2f4dba13b7d9ebe7499be4960b36499"],
    ["packages/starchess-arena/src/run/bank.ts", 51664, "f03b36d791e4d68d3784b6702b83c1b85ede43ea8ab38b94ee779cffe98ef1c6"],
    ["packages/starchess-core/src/index.ts", 297812, "5b7e795c733da1f6ffadbe04c0c1a9763b52933de0cd44e547eae8bf3c787024"],
    ["_spec/corpora/ml-adjutant-corpus.manifest.json", 7309, "31ac6f865340a95f8e85c2c1577aaea0aada87feb92a37637cda90aee288cc3f"],
    ["starchess-match-history-20260929-203446.json", 664540, "e6770cb032aa76dc05432c7a49e61c4905d1a1f7b859aa860a090821213e7ae6"],
    ["selected-reference.json", 103663, "09cd6b6dd97fd1b3984b71b5f0d3f540e21b38285897062148e16c0e388fc45a"]].map(([path, n, hash]) => ({ path: String(path), byteLength: Number(n), sha256: String(hash) })),
};
export function qualificationBootstrapPlan() {
  return { host: H, bun: B, launcher: L, delivery: D, source: S, inputs: I, qualification: R, entry: ENTRY,
    repository: "https://github.com/proveo-ca/chess-coach.git", gitMs: 120000, preparationMs: 240000, cleanupMs: 5000,
    scope: SCOPE, qualified: false, trainingReady: false, contract: structuredClone(contract) } as const;
}
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const encode = (value: unknown) => Buffer.from(JSON.stringify(value) + "\n");
const decode = <T>(bytes: Uint8Array): T => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as T;
function check(value: unknown, code: string): asserts value { if (!value) throw new Error(`Bootstrap: ${code}`); }
function safe(path: string): string { check(typeof path === "string" && path.length <= 512 && !/[\\\0,]/.test(path) && path.split("/").every(p => p && p !== "." && p !== ".."), "PATH"); return path; }
function pin(bytes: Uint8Array, expected: ByteRef): void { check(bytes.byteLength === expected.byteLength && sha(bytes) === expected.sha256, "BYTE_PIN"); }
function ref(path: string, bytes: Uint8Array): PayloadRow { return { path, byteLength: bytes.byteLength, sha256: sha(bytes) }; }
function clock(io: Pick<BootstrapIO, "now">) {
  let last = -1, failed = false;
  return () => { try { const n = io.now(); check(!failed && typeof n === "number" && Number.isFinite(n) && n >= 0 && n >= last, "CLOCK"); last = n; return n; }
    catch (error) { failed = true; throw error; } };
}
async function within<T>(io: Pick<BootstrapIO, "alarm">, now: () => number, end: number, action: () => Promise<T>): Promise<T> {
  check(now() < end, "DEADLINE"); let cancel = () => {};
  try { const result = await Promise.race([action(), new Promise<never>((_, reject) => { cancel = io.alarm(Math.max(0, end - now()), () => reject(new Error("Bootstrap: DEADLINE"))); })]); check(now() < end, "DEADLINE"); return result; }
  finally { cancel(); }
}
const natural = (r: ChildResult) => r.exited && r.reaped && r.stdoutEOF && r.stderrEOF && r.exitCode === 0 && r.signal === null && !r.forced && r.error === null;
const receipt = (commit: string, phase: BootstrapReceipt["phase"]): BootstrapReceipt => ({ version: "chess-coach.qualification-bootstrap.v1", phase, scope: SCOPE,
  status: "FAIL", publicationCommit: commit, inputManifest: null, referenceBuilds: 0, qualified: false, trainingReady: false, commands: [], failures: [], preparationReceipt: null });
const failure = (r: BootstrapReceipt, error: unknown) => { r.status = "FAIL"; if (r.failures.length < 8) r.failures.push(String(error).slice(0, 4096)); };
function environment() { return { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: `${D}/home`, TMPDIR: `${D}/tmp`, CI: "1", TERM: "dumb", LANG: "C.UTF-8", LC_ALL: "C.UTF-8",
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0", GIT_NO_LAZY_FETCH: "1", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0" }; }
async function context(io: BootstrapIO, worker: boolean): Promise<BootstrapContext> {
  const c = await io.context(); check(c.cwd === H && c.realpath === H && c.executable === B && c.version === "1.4.0" &&
    c.entrypoint === (worker ? `${S}/${ENTRY}` : L) && JSON.stringify(c.flags) === JSON.stringify(FLAGS), "CONTEXT"); return c;
}
async function command(io: BootstrapIO, report: BootstrapReceipt, argv: readonly string[], cwd: string, end: number, now: () => number, label: string): Promise<ChildResult> {
  check(now() < end && report.commands.length < 5, "COMMAND_DEADLINE_OR_COUNT");
  const proof: CommandProof = { argv: [...argv], cwd, deadlineMs: end, cleanupDeadlineMs: end + 5000,
    result: { exitCode: null, signal: null, exited: false, reaped: false, stdoutEOF: false, stderrEOF: false, forced: false, error: "COMMAND_NOT_SETTLED" },
    stdout: ref(`${D}/logs/${label}.stdout`, new Uint8Array()), stderr: ref(`${D}/logs/${label}.stderr`, new Uint8Array()) };
  report.commands.push(proof);
  const r = await io.command({ argv, cwd, env: environment(), detached: cwd !== S, deadlineMs: end, cleanupDeadlineMs: end + 5000, stdoutBytes: MIB, stderrBytes: MIB, now });
  check(r.stdout instanceof Uint8Array && r.stderr instanceof Uint8Array && r.stdout.byteLength <= MIB && r.stderr.byteLength <= MIB, "COMMAND_OUTPUT_BOUND");
  const { stdout, stderr, ...result } = r, out = ref(`${D}/logs/${label}.stdout`, stdout), err = ref(`${D}/logs/${label}.stderr`, stderr);
  Object.assign(proof, { result, stdout: out, stderr: err });
  await io.write(out.path, r.stdout, 0o600); await io.write(err.path, r.stderr, 0o600);
  check(natural(r), "CHILD_NOT_NATURAL_ZERO"); check(now() < end, "COMMAND_DEADLINE"); return r;
}
export async function prepareQualification(publicationCommit: string, io: BootstrapIO): Promise<BootstrapReceipt> {
  const report = receipt(publicationCommit, "bootstrap"), now = clock(io); let claimed = false, prepEnd = 0;
  try {
    check(/^[a-f0-9]{40}$/.test(publicationCommit), "COMMIT"); const gitEnd = now() + 120000, c = await context(io, false);
    for (const path of [D, I, R]) await io.absent(path);
    check(now() < gitEnd, "GIT_DEADLINE"); await io.mkdir(D); claimed = true;
    for (const name of ["logs", "home", "tmp"]) await io.mkdir(`${D}/${name}`);
    await io.write(`${D}/attempt.json`, encode({ publicationCommit, parentPid: c.pid }), 0o600);
    const git = ["git", "--no-replace-objects", "--no-optional-locks", "-c", "core.autocrlf=false", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-c", "init.templateDir=/dev/null"];
    const operations = [[...git, "init", S], [...git, "-C", S, "fetch", "--depth=1", "--no-tags", "https://github.com/proveo-ca/chess-coach.git", publicationCommit],
      [...git, "-C", S, "checkout", "--detach", "FETCH_HEAD"], [...git, "-C", S, "rev-parse", "--verify", "HEAD"]];
    let head = "";
    for (const [n, argv] of operations.entries()) head = new TextDecoder("utf-8", { fatal: true }).decode((await command(io, report, argv, H, gitEnd, now, `git-${n}`)).stdout);
    check(head === `${publicationCommit}\n`, "HEAD_MISMATCH");
    prepEnd = now() + 240000;
    const active = () => check(report.failures.length === 0 && now() < prepEnd, "PREPARATION_DEADLINE");
    await within(io, now, prepEnd, async () => { const running = await io.read(L, MIB); active(); const fresh = await io.read(`${S}/${ENTRY}`, MIB); active(); pin(fresh, ref(L, running)); });
    let workerError: unknown = null;
    try { await command(io, report, [B, ...FLAGS, `${S}/${ENTRY}`, "prepare-worker", publicationCommit], H, prepEnd, now, "prepare-worker"); } catch (error) { workerError = error; }
    await within(io, now, prepEnd, async () => {
      const bytes = await io.read(`${D}/preparation-receipt.json`, MIB); active(); const worker = decode<BootstrapReceipt>(bytes);
      check(worker.version === report.version && worker.phase === "preparation" && worker.scope === SCOPE && worker.publicationCommit === publicationCommit &&
        worker.qualified === false && worker.trainingReady === false && Number.isSafeInteger(worker.referenceBuilds) && worker.referenceBuilds >= 0 && worker.referenceBuilds <= 6, "WORKER_BINDING");
      report.referenceBuilds = worker.referenceBuilds; report.preparationReceipt = ref(`${D}/preparation-receipt.json`, bytes);
      if (workerError !== null) throw workerError;
      check(worker.status === "PASS" && worker.referenceBuilds === 6 && Array.isArray(worker.failures) && worker.failures.length === 0 && worker.commands.length === 1 && natural({ ...worker.commands[0]!.result, stdout: new Uint8Array(), stderr: new Uint8Array() }) &&
        worker.inputManifest?.path === `${I}/qualification-inputs/input-manifest.json`, "WORKER_NOT_PASS");
      const manifest = await io.read(worker.inputManifest.path, 8 * MIB); active(); pin(manifest, worker.inputManifest);
      check(decode<{ version: string }>(manifest).version === "chess-coach.qualification-inputs.v1", "MANIFEST_VERSION"); report.inputManifest = worker.inputManifest; report.status = "PASS";
    });
  } catch (error) { failure(report, error); }
  if (claimed) {
    try { if (report.status === "PASS") await within(io, now, prepEnd, () => io.write(`${D}/bootstrap-receipt.json`, encode(report), 0o600));
      else await io.write(`${D}/bootstrap-receipt.json`, encode(report), 0o600); }
    catch (error) { failure(report, error); }
  }
  return report;
}
function directoryWriter(io: BootstrapIO) {
  const made = new Set<string>([D]);
  const dir = async (path: string): Promise<void> => { if (made.has(path)) return; check(path.startsWith(D + "/") || path === I || path.startsWith(I + "/"), "WRITE_ROOT");
    if (path !== I) await dir(dirname(path)); await io.mkdir(path); made.add(path); };
  const put = async (root: string, path: string, bytes: Uint8Array, mode = 0o644) => { const out = `${root}/${safe(path)}`; await dir(dirname(out)); await io.write(out, bytes, mode); };
  return { dir, put };
}
async function payload(io: BootstrapIO, base: string, row: PayloadRow, cap = 16 * MIB): Promise<Uint8Array> {
  safe(row.path); check(Number.isSafeInteger(row.byteLength) && row.byteLength > 0 && row.byteLength <= cap && /^[a-f0-9]{64}$/.test(row.sha256), "PAYLOAD_ROW");
  const bytes = await io.read(`${base}/${row.path}`, cap); pin(bytes, row); return bytes;
}
export async function validateBootstrapReferenceRow(io: Pick<BootstrapIO, "read" | "stat">, path: string, row: ReferenceRow): Promise<Uint8Array> {
  safe(row.path); check(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && row.bytes <= 16 * MIB && /^(100644|100755)$/.test(row.sourceMode) && /^[a-f0-9]{64}$/.test(row.sha256), "REFERENCE_ROW");
  const info = await io.stat(path), bytes = await io.read(path, 16 * MIB);
  check(info.kind === "file" && info.size === row.bytes && (info.mode & 0o7777) === parseInt(row.sourceMode, 8) % 0o1000, "REFERENCE_MODE");
  pin(bytes, { byteLength: row.bytes, sha256: row.sha256 });
  if (row.gitBlobOid !== undefined) check(/^[a-f0-9]{40}$/.test(row.gitBlobOid) && createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex") === row.gitBlobOid, "GIT_BLOB"); return bytes;
}
export async function prepareQualificationWorker(publicationCommit: string, io: BootstrapIO, expected: BootstrapContract = contract): Promise<BootstrapReceipt> {
  const report = receipt(publicationCommit, "preparation"), now = clock(io); let end = 0, owned = false;
  try {
    check(/^[a-f0-9]{40}$/.test(publicationCommit), "COMMIT"); end = now() + 240000; const c = await context(io, true);
    const attempt = decode<{ publicationCommit: string; parentPid: number }>(await io.read(`${D}/attempt.json`, 4096));
    check(attempt.publicationCommit === publicationCommit && attempt.parentPid === c.ppid, "WORKER_PARENT"); owned = true;
    for (const path of [I, R, `${D}/reference-source`, `${D}/reference-bundles`]) await io.absent(path);
    const docs = await Promise.all(expected.documents.map(row => payload(io, S, row, MIB)));
    check(docs.length === 3, "GENERATION_DOCUMENTS"); const source = decode<{ files: PayloadRow[]; fileCount: number; byteLength: number }>(docs[0]!);
    const bindings = decode<Bindings>(docs[2]!);
    check(source.fileCount === expected.sourceCount && source.files.length === expected.sourceCount && source.byteLength === expected.sourceBytes &&
      source.files.reduce((n, row) => n + row.byteLength, 0) === expected.sourceBytes && new Set(source.files.map(r => r.path)).size === source.files.length, "SOURCE_CLOSURE");
    check(bindings.scope === "FOURTEEN_ACTUAL_DOCUMENT_REFS_NOT_STAGED_NOT_EXECUTION_AUTHORITY" && bindings.documents.length === 14 &&
      new Set(bindings.documents.map(d => d.role)).size === 14 && bindings.documents.every(d => ROLES.includes(d.role) && d.futurePath === `/app/qualification-inputs/${d.role}.bin`), "BINDING_ROLES");
    for (const row of source.files) { await payload(io, S, row); const st = await io.stat(`${S}/${safe(row.path)}`); check(st.kind === "file" && [0o644, 0o755].includes(st.mode & 0o7777), "SOURCE_MODE"); }
    const canonicalBytes = await payload(io, S, expected.canonical, MIB), canonical = decode<{ reference: string; files: ReferenceRow[] }>(canonicalBytes);
    check(canonical.reference === REFERENCE && canonical.files.length === expected.groups.reduce((n, g) => n + g.count, expected.flatCount) &&
      canonical.files.reduce((n, r) => n + r.bytes, 0) === expected.groups.reduce((n, g) => n + g.bytes, expected.flatBytes) && new Set(canonical.files.map(r => r.path)).size === canonical.files.length, "CANONICAL_INPUTS");
    const helpers = await io.loadModule(`${S}/artifacts/training-functional/reference-retry.ts`) as Helpers;
    check(typeof helpers.mapInputRows === "function" && typeof helpers.verifyReference === "function", "REFERENCE_HELPERS");
    const mapped = new Map<string, { row: ReferenceRow; path: string }>();
    const add = (row: ReferenceRow, path: string) => { safe(row.path); check(!mapped.has(row.path), "DISJOINT_MAPPING"); mapped.set(row.path, { row, path }); };
    for (const group of expected.groups) {
      const base = `${S}/${P}/${safe(group.kind)}`, m = await io.read(`${base}/input-manifest.json`, MIB), t = await io.read(`${base}/materialization.json`, MIB), k = await io.read(`${base}/check.json`, MIB);
      check(sha(m) === group.input && sha(t) === group.material && sha(k) === group.check, "CAPTURED_DOCUMENT_PIN");
      const manifest = decode<{ sourceRoot: string }>(m), material = decode<{ inputManifestSha256: string }>(t), checked = decode<{ reference: string; check: string; inputManifestSha256: string; materializationSha256: string }>(k);
      check(manifest.sourceRoot === `${P}/${group.kind}/inputs/reference` && material.inputManifestSha256 === group.input && checked.reference === REFERENCE && checked.check.startsWith("PASS_EXACT_") &&
        checked.inputManifestSha256 === group.input && checked.materializationSha256 === group.material, "CAPTURED_BINDING");
      const rows = helpers.mapInputRows(decode(m), decode(t), group.count, group.bytes);
      check(rows.length === group.count && rows.every(row => row.gitBlobOid !== undefined), "CAPTURED_GIT_ROWS");
      for (const row of rows) add(row, `${base}/inputs/reference/${safe(row.path)}`);
    }
    const flat = decode<{ sourceManifest: { path: string; sha256: string }; files: (ReferenceRow & { source: string })[] }>(await io.read(`${S}/artifacts/training-functional/reference-inputs/manifest.json`, MIB));
    check(flat.sourceManifest.path === expected.canonical.path && flat.sourceManifest.sha256 === sha(canonicalBytes) && flat.files.length === expected.flatCount && flat.files.reduce((n, row) => n + row.bytes, 0) === expected.flatBytes, "FLAT_MANIFEST");
    for (const row of flat.files) { check(safe(row.path).startsWith("artifacts/training-functional/reference-inputs/") && row.gitBlobOid === undefined, "FLAT_PATH");
      const { source: path, ...rest } = row; add({ ...rest, path: safe(path) }, `${S}/${row.path}`); }
    check(mapped.size === canonical.files.length, "MAPPING_COUNT");
    for (const row of canonical.files) { const item = mapped.get(safe(row.path)); check(item && item.row.bytes === row.bytes && item.row.sha256 === row.sha256 && item.row.sourceMode === row.sourceMode && item.row.gitBlobOid === row.gitBlobOid, "MAPPING_ROW"); }
    check(now() < end, "PREPARATION_DEADLINE"); const { dir, put } = directoryWriter(io), referenceSource = `${D}/reference-source`, bundles = `${D}/reference-bundles`;
    await dir(referenceSource);
    for (const row of canonical.files) { const b = await validateBootstrapReferenceRow(io, mapped.get(row.path)!.path, row); await put(referenceSource, row.path, b, parseInt(row.sourceMode, 8) % 0o1000); check(now() < end, "PREPARATION_DEADLINE"); }
    await dir(`${referenceSource}/node_modules/@chess-coach`); await io.symlink(`${referenceSource}/node_modules/@chess-coach/starchess-core`, "../../packages/starchess-core");
    await io.alias(`${referenceSource}/node_modules/@chess-coach/starchess-core`, `${referenceSource}/packages/starchess-core`);
    await command(io, report, [B, ...FLAGS, `${S}/tooling/build-reference.ts`, referenceSource, bundles], S, end, now, "reference-builder");
    for (const row of expected.referenceFiles.slice(0, 6)) { await payload(io, bundles, row); report.referenceBuilds++; }
    const metadataRow = expected.referenceFiles.at(-1)!;
    const generated = await payload(io, bundles, metadataRow, MIB), published = await payload(io, `${S}/${PREP}`, { ...metadataRow, path: "selected-reference.json" }, MIB); pin(generated, ref("published", published));
    const verified = helpers.verifyReference(referenceSource, bundles, generated);
    check(verified.version === "chess-coach.reference-bundles.v1" && verified.reference === REFERENCE && verified.bunVersion === "1.4.0" && verified.inventory.length === 6 &&
      new Set(verified.inventory.flatMap(row => row.inputs.map(f => safe(f.path)))).size === expected.referenceInputs &&
      JSON.stringify(verified.inventory.map(row => row.output).sort((a, b) => a.path.localeCompare(b.path))) === JSON.stringify([...expected.referenceFiles.slice(0, 6)].sort((a, b) => a.path.localeCompare(b.path))), "REFERENCE_INVENTORY");
    const zod = `${H}/node_modules/.pnpm/zod@4.6.7/node_modules/zod`, zodPackage = decode<{ name: string; version: string }>(await io.read(`${zod}/package.json`, 65536));
    check(zodPackage.name === "zod" && zodPackage.version === "4.6.7", "ZOD_PACKAGE");
    const roleBytes = new Map<string, Uint8Array>();
    for (const doc of bindings.documents) { const root = doc.role === "strategicSource" ? bundles : doc.role === "closure" ? bundles : S;
      const path = doc.role === "strategicSource" ? expected.referenceFiles[3]!.path : doc.role === "closure" ? "selected-reference.json" : safe(doc.source.path);
      roleBytes.set(doc.role, await payload(io, root, { ...doc.source, path }, 8 * MIB)); }
    check(now() < end, "PREPARATION_DEADLINE"); await io.absent(I); await io.absent(R); await dir(I);
    for (const name of ["app", "reference", "qualification-inputs", "app/reference", "app/qualification-inputs"]) await dir(`${I}/${name}`);
    const physical: PayloadRow[] = [], seen = new Set<string>(); let total = 0, nodes = 0;
    const copy = async (path: string, bytes: Uint8Array, mode: number) => { safe(path); check(!seen.has(path) && physical.length < expected.appFiles && bytes.byteLength <= expected.fileBytes && (total += bytes.byteLength) <= expected.appBytes, "APP_BOUND");
      seen.add(path); await put(`${I}/app`, path, bytes, mode); physical.push(ref(path, bytes)); check(now() < end, "PREPARATION_DEADLINE"); };
    for (const row of source.files) { const path = safe(row.path); check(!path.startsWith("node_modules/") && !/^(reference|qualification-inputs)(\/|$)/.test(path), "SOURCE_LAYOUT");
      await copy(path, await payload(io, S, row), (await io.stat(`${S}/${path}`)).mode & 0o7777); }
    const walk = async (prefix: string, depth: number): Promise<void> => {
      check(depth <= 32 && (await io.stat(`${zod}${prefix ? "/" + prefix : ""}`)).kind === "directory", "ZOD_DIRECTORY");
      await dir(`${I}/app/node_modules/zod${prefix ? "/" + prefix : ""}`);
      for await (const item of io.entries(`${zod}${prefix ? "/" + prefix : ""}`)) {
        check(++nodes <= expected.treeEntries && !item.name.includes("/"), "TREE_BOUND"); const path = safe(prefix ? `${prefix}/${item.name}` : item.name);
        if (item.kind === "directory") await walk(path, depth + 1);
        else { check(item.kind === "file", "ZOD_REGULAR"); const st = await io.stat(`${zod}/${path}`); check(st.kind === "file" && st.size <= expected.fileBytes, "ZOD_FILE");
          await copy(`node_modules/zod/${path}`, await io.read(`${zod}/${path}`, expected.fileBytes), 0o644); }
      }
    };
    await walk("", 0);
    for (const name of ["contracts", "policy", "starchess-core"]) { await dir(`${I}/app/node_modules/@chess-coach`); await io.symlink(`${I}/app/node_modules/@chess-coach/${name}`, `../../packages/${name}`); await io.alias(`${I}/app/node_modules/@chess-coach/${name}`, `${I}/app/packages/${name}`); }
    for (const path of ADAPTERS) { check(seen.has(path), "ADAPTER_MISSING"); await io.chmod(`${I}/app/${path}`, 0o755); }
    for (const row of expected.referenceFiles) { const root = expected.referenceFiles.slice(6, 8).some(r => r.path === row.path) ? referenceSource : bundles; await put(`${I}/reference`, row.path, await payload(io, root, row)); }
    for (const doc of bindings.documents) await put(`${I}/qualification-inputs`, `${doc.role}.bin`, roleBytes.get(doc.role)!, 0o600);
    for (const path of ["node_modules/fflate/LICENSE", "node_modules/jssha/LICENSE"]) await put(`${D}/notices`, path.split("/")[1]! + "-LICENSE", await io.read(`${referenceSource}/${path}`, MIB));
    const operator = await io.loadModule(`${I}/app/artifacts/training-functional/qualification-operator.ts`) as Operator;
    check(typeof operator.qualificationInputManifest === "function" && typeof operator.validateQualificationInputs === "function", "OPERATOR_EXPORTS");
    const manifest = operator.qualificationInputManifest(bindings, physical.sort((a, b) => a.path.localeCompare(b.path)));
    check(manifest.version === "chess-coach.qualification-inputs.v1" && JSON.stringify(manifest.source) === JSON.stringify(physical) && manifest.reference.length === 9 &&
      JSON.stringify(manifest.documents) === JSON.stringify(bindings.documents) && JSON.stringify(manifest.reference) === JSON.stringify(expected.referenceFiles), "GENERATED_MANIFEST");
    const bytes = encode(manifest); check(bytes.byteLength <= 8 * MIB, "MANIFEST_BOUND"); const path = `${I}/qualification-inputs/input-manifest.json`;
    await io.write(path, bytes, 0o600); pin(await io.read(path, 8 * MIB), ref(path, bytes));
    await operator.validateQualificationInputs(io, { app: `${I}/app`, reference: `${I}/reference`, documents: `${I}/qualification-inputs` });
    check(now() < end, "PREPARATION_DEADLINE"); report.inputManifest = ref(path, bytes); report.status = "PASS";
  } catch (error) { failure(report, error); }
  if (owned) { try { if (report.status === "PASS") check(now() < end, "PREPARATION_DEADLINE"); await io.write(`${D}/preparation-receipt.json`, encode(report), 0o600); if (report.status === "PASS") check(now() < end, "PREPARATION_DEADLINE"); } catch (error) { failure(report, error); } }
  return report;
}

export type ChildHandle = { stdout: ReadableStream<Uint8Array>; stderr: ReadableStream<Uint8Array>; exited: Promise<number>;
  signal(): string | null; kill(): void; unref(): void };
export function spawnBootstrapChild(request: CommandRequest, io: { umask(mask: number): number; spawn(request: CommandRequest): ChildHandle }): ChildHandle {
  if (request.argv[0] !== "git") return io.spawn(request);
  const old = io.umask(0o022);
  try { return io.spawn(request); } finally { io.umask(old); }
}
export type ChildIO = { alarm(ms: number, callback: () => void): () => void; spawn(request: CommandRequest): ChildHandle };
export async function boundedBootstrapCommand(request: CommandRequest, io: ChildIO): Promise<ChildResult> {
  const result: ChildResult = { stdout: new Uint8Array(), stderr: new Uint8Array(), exitCode: null, signal: null, exited: false, reaped: false, stdoutEOF: false, stderrEOF: false, forced: false, error: null };
  const streams = [0, 1].map(() => ({ chunks: [] as Uint8Array[], bytes: 0 })); let child: ChildHandle | null = null, stopped = false, settled = false;
  let cancel = () => {}, cleanup = () => {}; const readers: ReadableStreamDefaultReader<Uint8Array>[] = [], now = clock({ now: request.now });
  const stop = (why: string) => { result.error ??= why; result.forced = true; if (stopped || !child) return; stopped = true; try { child.kill(); } catch (error) { result.error += `; ${String(error).slice(0, 1024)}`; } };
  try {
    check([request.deadlineMs, request.cleanupDeadlineMs].every(Number.isFinite) && now() < request.deadlineMs && request.cleanupDeadlineMs >= request.deadlineMs && request.cleanupDeadlineMs <= request.deadlineMs + 5000 &&
      [request.stdoutBytes, request.stderrBytes].every(n => Number.isSafeInteger(n) && n > 0 && n <= MIB), "COMMAND_LIMITS");
    child = io.spawn(request); const active = child;
    cancel = io.alarm(Math.max(0, request.deadlineMs - now()), () => stop("COMMAND_DEADLINE"));
    const drains = [child.stdout, child.stderr].map(async (stream, n) => {
      const reader = stream.getReader(); readers.push(reader);
      try { for (;;) { const value = await reader.read(); if (settled) return; if (value.done) { if (n === 0) result.stdoutEOF = true; else result.stderrEOF = true; return; }
        check(value.value instanceof Uint8Array, "PIPE_CHUNK"); const state = streams[n]!, cap = n === 0 ? request.stdoutBytes : request.stderrBytes, take = Math.min(value.value.byteLength, Math.max(0, cap - state.bytes));
        if (take) state.chunks.push(Uint8Array.from(value.value.subarray(0, take))); state.bytes = Math.min(cap + 1, state.bytes + value.value.byteLength); if (state.bytes > cap) stop("OUTPUT_CAP"); }
      } catch (error) { if (!settled) stop(String(error).slice(0, 4096)); }
    });
    const exited = child.exited.then(code => { if (!settled) { result.exited = true; result.reaped = true; result.exitCode = code; result.signal = active.signal(); if (code !== 0 || result.signal !== null) stop("CHILD_EXIT"); } }, error => { if (!settled) stop(String(error).slice(0, 4096)); });
    await Promise.race([Promise.all([exited, ...drains]), new Promise<never>((_, reject) => { cleanup = io.alarm(Math.max(0, request.cleanupDeadlineMs - now()), () => { stop("CLEANUP_UNCONFIRMED"); reject(new Error("Bootstrap: CLEANUP_UNCONFIRMED")); }); })]);
    check(now() < request.deadlineMs, "COMMAND_DEADLINE");
  } catch (error) { stop(String(error).slice(0, 4096)); }
  finally { settled = true; cancel(); cleanup(); for (const reader of readers) void reader.cancel().catch(() => {}); try { child?.unref(); } catch (error) { stop(String(error).slice(0, 4096)); } result.stdout = Buffer.concat(streams[0]!.chunks); result.stderr = Buffer.concat(streams[1]!.chunks); }
  return { ...result };
}
function parents(path: string): void { for (let p = dirname(path), n = 0; ; p = dirname(p)) { check(++n <= 128, "PARENT_BOUND"); const s = fs.lstatSync(p); check(s.isDirectory() && !s.isSymbolicLink(), "PHYSICAL_PARENT"); if (p === dirname(p)) return; } }
function physicalRead(path: string, cap: number): Uint8Array {
  parents(path); const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try { const a = fs.fstatSync(fd, { bigint: true }); check(a.isFile() && a.size <= BigInt(cap), "READ_BOUND"); const b = Buffer.alloc(Number(a.size) + 1); let size = 0;
    for (;;) { const n = fs.readSync(fd, b, size, b.length - size, null); if (!n) break; size += n; check(size <= Number(a.size), "READ_GROWTH"); }
    const z = fs.fstatSync(fd, { bigint: true }); check(size === Number(a.size) && a.size === z.size && a.mtimeNs === z.mtimeNs && a.ctimeNs === z.ctimeNs, "READ_DRIFT"); return b.subarray(0, size);
  } finally { fs.closeSync(fd); }
}
const timers = { alarm: (ms: number, callback: () => void) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); } };
function productionIO(): BootstrapIO {
  const kind = (s: fs.Stats): FileInfo["kind"] => s.isSymbolicLink() ? "symlink" : s.isFile() ? "file" : s.isDirectory() ? "directory" : "other";
  return { now: () => performance.now(), ...timers,
    context: async () => ({ cwd: process.cwd(), realpath: fs.realpathSync(process.cwd()), executable: process.execPath, entrypoint: import.meta.path,
      version: Bun.version, flags: process.execArgv, pid: process.pid, ppid: process.ppid }),
    absent: async path => { parents(path); try { fs.lstatSync(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; } throw new Error("Bootstrap: ROOT_EXISTS"); },
    mkdir: async path => { parents(path); fs.mkdirSync(path, { mode: 0o700 }); }, read: async (path, cap) => physicalRead(path, cap),
    write: async (path, bytes, mode) => { check(bytes.byteLength <= 16 * MIB, "WRITE_BOUND"); parents(path); const fd = fs.openSync(path, "wx", mode); try { fs.writeFileSync(fd, bytes); fs.fchmodSync(fd, mode); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } },
    stat: async path => { parents(path); const s = fs.lstatSync(path); return { kind: kind(s), size: s.size, mode: s.mode }; },
    entries: async function* (path) { parents(`${path}/leaf`); const directory = fs.opendirSync(path); try { for (;;) { const item = directory.readSync(); if (!item) break;
      yield { name: item.name, kind: item.isSymbolicLink() ? "symlink" : item.isDirectory() ? "directory" : item.isFile() ? "file" : "other" }; } } finally { directory.closeSync(); } },
    symlink: async (path, target) => { parents(path); fs.symlinkSync(target, path); },
    alias: async (path, target) => { parents(path); check(fs.lstatSync(path).isSymbolicLink() && fs.realpathSync(path) === target, "ALIAS"); },
    chmod: async (path, mode) => { parents(path); const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); try { check(fs.fstatSync(fd).isFile(), "CHMOD_REGULAR"); fs.fchmodSync(fd, mode); } finally { fs.closeSync(fd); } },
    loadModule: path => import(pathToFileURL(path).href) as Promise<unknown>,
    command: request => boundedBootstrapCommand(request, { ...timers, spawn: request => spawnBootstrapChild(request, { umask: mask => process.umask(mask), spawn: request => {
      const child = Bun.spawn([...request.argv], { cwd: request.cwd, env: request.env, detached: request.detached, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
      return { stdout: child.stdout, stderr: child.stderr, exited: child.exited, signal: () => child.signalCode === null ? null : String(child.signalCode), unref: () => child.unref(),
        kill: () => { if (!request.detached) { child.kill("SIGKILL"); return; } try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); } } };
    } }) }),
  };
}
export function qualificationBootstrapMode(main: boolean, args: readonly string[]): "prepare" | "prepare-worker" | null {
  return main && args.length === 2 && ["prepare", "prepare-worker"].includes(args[0]!) && /^[a-f0-9]{40}$/.test(args[1]!) ? args[0] as "prepare" | "prepare-worker" : null;
}
if (import.meta.main) {
  const args = Bun.argv.slice(2), mode = qualificationBootstrapMode(true, args);
  if (mode === null) { console.error("Executor: usage: qualification-bootstrap.ts prepare LOWERCASE_40_HEX_PUBLICATION_COMMIT"); process.exitCode = 2; }
  else { const report = await (mode === "prepare" ? prepareQualification(args[1]!, productionIO()) : prepareQualificationWorker(args[1]!, productionIO()));
    console.log("Executor: " + JSON.stringify(report)); process.exitCode = report.status === "PASS" ? 0 : 1; }
}
