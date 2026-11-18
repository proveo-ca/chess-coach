// SPEC: _spec/qualification-bootstrap.puml
import { afterAll, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { boundedBootstrapCommand, prepareQualification, prepareQualificationWorker, qualificationBootstrapMode, qualificationBootstrapPlan, spawnBootstrapChild, validateBootstrapReferenceRow } from "./qualification-bootstrap.ts";
import type { BootstrapContext, BootstrapIO, BootstrapReceipt, ChildHandle, ChildIO, ChildResult, CommandRequest, FileInfo, PayloadRow, ReferenceRow } from "./qualification-bootstrap.ts";

const spawn = spyOn(Bun, "spawn").mockImplementation(() => { throw new Error("FORBIDDEN_REAL_PROCESS"); });
const spawnSync = spyOn(Bun, "spawnSync").mockImplementation(() => { throw new Error("FORBIDDEN_REAL_PROCESS"); });
const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((() => { throw new Error("FORBIDDEN_NETWORK"); }) as unknown as typeof fetch);
afterAll(() => { expect(spawn).not.toHaveBeenCalled(); expect(spawnSync).not.toHaveBeenCalled(); expect(fetchSpy).not.toHaveBeenCalled(); spawn.mockRestore(); spawnSync.mockRestore(); fetchSpy.mockRestore(); });
const plan = qualificationBootstrapPlan(), { host: H, delivery: D, source: S, inputs: I, qualification: R, launcher: L, bun: B } = plan;
const COMMIT = "a".repeat(40), Q = "artifacts/training-functional/qualification-packet-1/source-3", PREP = "artifacts/training-functional/reference-prep-2";
const P = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1", REF = "b4b241481fb12de4a7344e6dba8eda775af57675";
const ZOD = `${H}/node_modules/.pnpm/zod@4.6.7/node_modules/zod`, MIB = 1048576;
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value) + "\n"), sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const pin = (path: string, b: Uint8Array): PayloadRow => ({ path, byteLength: b.byteLength, sha256: sha(b) });
const pass = (stdout = new Uint8Array(), extra: Partial<ChildResult> = {}): ChildResult => ({ stdout, stderr: new Uint8Array(), exitCode: 0, signal: null, exited: true, reaped: true, stdoutEOF: true, stderrEOF: true, forced: false, error: null, ...extra });
const context = (worker = false): BootstrapContext => ({ cwd: H, realpath: H, executable: B, entrypoint: worker ? `${S}/${plan.entry}` : L, version: "1.4.0", flags: ["--no-env-file", "--no-install"], pid: worker ? 20 : 10, ppid: worker ? 10 : 1 });
type Node = FileInfo & { data?: Uint8Array; target?: string };
type Manifest = { version: string; documents: { role: string; source: PayloadRow; futurePath: string }[]; source: PayloadRow[]; reference: PayloadRow[] };
function memory(worker = false) {
  const nodes = new Map<string, Node>(), events: string[] = [], commands: CommandRequest[] = [], alarms: { ms: number; fire(): void; cancelled: boolean }[] = [];
  let time = 0;
  const seedDir = (path: string) => { for (let p = path; ; p = dirname(p)) { if (!nodes.has(p)) nodes.set(p, { kind: "directory", mode: 0o755, size: 0 }); if (p === dirname(p)) break; } };
  const seed = (path: string, data: Uint8Array, mode = 0o644) => { seedDir(dirname(path)); nodes.set(path, { kind: "file", data: Uint8Array.from(data), mode, size: data.byteLength }); };
  const parents = (path: string) => { for (let p = dirname(path); ; p = dirname(p)) { if (nodes.get(p)?.kind !== "directory") throw new Error(`PHYSICAL_PARENT:${p}`); if (p === dirname(p)) return; } };
  const io: BootstrapIO = {
    now: () => time, alarm: (ms, fire) => { const alarm = { ms, fire, cancelled: false }; alarms.push(alarm); return () => { alarm.cancelled = true; }; }, context: async () => context(worker),
    absent: async path => { events.push(`absent:${path}`); parents(path); if (nodes.has(path)) throw new Error("ROOT_EXISTS"); },
    mkdir: async path => { parents(path); if (nodes.has(path)) throw new Error(`EXCLUSIVE_DIRECTORY:${path}`); nodes.set(path, { kind: "directory", mode: 0o700, size: 0 }); events.push(`mkdir:${path}`); },
    read: async (path, cap) => { events.push(`read:${path}`); parents(path); const n = nodes.get(path); if (n?.kind !== "file" || !n.data || n.size > cap || n.data.byteLength > cap) throw new Error(`REGULAR_READ_BOUND:${path}`); return Uint8Array.from(n.data); },
    write: async (path, data, mode) => { parents(path); if (nodes.has(path)) throw new Error(`EXCLUSIVE_FILE:${path}`); seed(path, data, mode); events.push(`write:${path}`); },
    stat: async path => { parents(path); const n = nodes.get(path); if (!n) throw new Error(`MISSING_STAT:${path}`); return { ...n }; },
    entries: async function* (path) { events.push(`entries:${path}`); parents(`${path}/leaf`); for (const [p, n] of nodes) if (p !== path && dirname(p) === path) yield { name: p.slice(path.length + 1), kind: n.kind }; },
    symlink: async (path, target) => { parents(path); if (nodes.has(path)) throw new Error("EXCLUSIVE_ALIAS"); nodes.set(path, { kind: "symlink", mode: 0o777, size: target.length, target }); events.push(`symlink:${path}`); },
    alias: async (path, target) => { parents(path); const n = nodes.get(path); if (n?.kind !== "symlink" || resolve(dirname(path), n.target!) !== target || nodes.get(target)?.kind !== "directory") throw new Error("ALIAS"); events.push(`alias:${path}`); },
    chmod: async (path, mode) => { parents(path); const n = nodes.get(path); if (n?.kind !== "file") throw new Error("CHMOD_REGULAR"); n.mode = mode; events.push(`chmod:${path}`); },
    loadModule: async path => { throw new Error(`UNEXPECTED_MODULE:${path}`); }, command: async request => { commands.push(request); throw new Error("UNEXPECTED_COMMAND"); },
  };
  seedDir(dirname(D));
  return { io, nodes, events, commands, alarms, seed, seedDir, setTime: (n: number) => { time = n; }, time: () => time,
    json: <T>(path: string): T => JSON.parse(Buffer.from(nodes.get(path)!.data!).toString()) as T,
    mutate: (path: string, value: unknown) => seed(path, bytes(value)) };
}
function worker() {
  const env = memory(true), { io, seed, seedDir } = env, cfg = structuredClone(plan.contract);
  seedDir(D); for (const name of ["logs", "home", "tmp"]) seedDir(`${D}/${name}`);
  seed(`${D}/attempt.json`, bytes({ publicationCommit: COMMIT, parentPid: 10 }));
  const sourceFiles = ["artifacts/training-functional/qualification-operator.ts", "artifacts/training-functional/qualification-policy-score.ts", "artifacts/training-functional/qualification-policy-channel.ts",
    "packages/contracts/package.json", "packages/policy/package.json", "packages/starchess-core/package.json", "packages/runtime/src/fixed-attempt.ts"].map(path => {
    const b = Buffer.from(`MOCK_SOURCE_NOT_EVALUATED:${path}`); seed(`${S}/${path}`, b); return pin(path, b);
  });
  const sourceBytes = bytes({ files: sourceFiles, fileCount: sourceFiles.length, byteLength: sourceFiles.reduce((n, r) => n + r.byteLength, 0) });
  const verification = bytes({ status: "PASS_SOURCE_PREPARATION_ONLY", totalTests: 811, gates: 12, typechecks: 3, documentPins: [{ path: "_spec/historical.puml", sha256: "f".repeat(64) }] });
  seed(`${S}/${Q}/source-manifest.json`, sourceBytes); seed(`${S}/${Q}/verification.json`, verification);
  const localPaths = ["pnpm-lock.yaml", "packages/starchess-core/src/index.ts", "captured-only.ts"];
  const corpusPaths = cfg.referenceFiles.slice(6, 8).map(row => row.path), inputData = new Map<string, Uint8Array>();
  const makeRow = (path: string, data: Uint8Array, git = true): ReferenceRow => { inputData.set(path, data); return { path, bytes: data.byteLength, sha256: sha(data), sourceMode: "100644",
    ...(git ? { gitBlobOid: createHash("sha1").update(`blob ${data.byteLength}\0`).update(data).digest("hex") } : {}) }; };
  const local = localPaths.map(path => makeRow(path, Buffer.from(`CAPTURED_OLD:${path}`))), corpus = corpusPaths.map(path => makeRow(path, Buffer.from(`CORPUS:${path}`)));
  const flatPaths = ["node_modules/fflate/package.json", "node_modules/fflate/esm/index.mjs", "node_modules/fflate/LICENSE", "node_modules/jssha/package.json", "node_modules/jssha/dist/sha256.mjs", "node_modules/jssha/LICENSE"];
  const flat = flatPaths.map(path => makeRow(path, path.endsWith("package.json") ? bytes({ name: path.split("/")[1], exports: { "./sha256": { import: { default: "./dist/sha256.mjs" } }, ".": { node: { import: { default: "./esm/index.mjs" } } } } }) : Buffer.from(`FLAT:${path}`), false));
  const canonical = [...local, ...corpus, ...flat], canonicalBytes = bytes({ reference: REF, files: canonical });
  cfg.canonical = pin(`${PREP}/input-manifest.json`, canonicalBytes); seed(`${S}/${cfg.canonical.path}`, canonicalBytes);
  cfg.groups = [local, corpus].map((rows, n) => {
    const kind = n === 0 ? "local-inputs-1" : "corpus-inputs-1", base = `${S}/${P}/${kind}`;
    const m = bytes({ reference: REF, sourceRoot: `${P}/${kind}/inputs/reference`, entries: rows.map(row => ({ path: row.path, expectedBytes: row.bytes, sourceMode: row.sourceMode, gitBlobOid: row.gitBlobOid })) });
    const t = bytes({ reference: REF, inputManifestSha256: sha(m), files: rows });
    const k = bytes({ reference: REF, check: "PASS_EXACT_MOCKED_BYTES", inputManifestSha256: sha(m), materializationSha256: sha(t) });
    seed(`${base}/input-manifest.json`, m); seed(`${base}/materialization.json`, t); seed(`${base}/check.json`, k);
    for (const row of rows) seed(`${base}/inputs/reference/${row.path}`, inputData.get(row.path)!);
    return { kind, count: rows.length, bytes: rows.reduce((n, r) => n + r.bytes, 0), input: sha(m), material: sha(t), check: sha(k) };
  });
  const flatFiles = flat.map((row, n) => { const path = `artifacts/training-functional/reference-inputs/flat-${n}.bin`; seed(`${S}/${path}`, inputData.get(row.path)!); return { ...row, source: row.path, path }; });
  const flatManifest = { sourceManifest: { path: cfg.canonical.path, sha256: sha(canonicalBytes) }, files: flatFiles };
  seed(`${S}/artifacts/training-functional/reference-inputs/manifest.json`, bytes(flatManifest));
  const outputs = cfg.referenceFiles.slice(0, 6).map(row => pin(row.path, Buffer.from(`MOCK_BUNDLE_NOT_EVALUATED:${row.path}`)));
  const metadata = { version: "chess-coach.reference-bundles.v1", reference: REF, bunVersion: "1.4.0", inventory: outputs.map(output => ({ entry: output.path, inputs: canonical.map(row => ({ path: row.path, byteLength: row.bytes, sha256: row.sha256 })), output })) };
  const metaBytes = bytes(metadata); cfg.referenceFiles = [...outputs, ...corpus.map(row => ({ path: row.path, byteLength: row.bytes, sha256: row.sha256 })), pin("selected-reference.json", metaBytes)];
  cfg.sourceCount = sourceFiles.length; cfg.sourceBytes = sourceFiles.reduce((n, r) => n + r.byteLength, 0); cfg.referenceInputs = canonical.length;
  cfg.flatCount = flat.length; cfg.flatBytes = flat.reduce((n, r) => n + r.bytes, 0); cfg.appFiles = 32; cfg.appBytes = 65536; cfg.fileBytes = 4096; cfg.treeEntries = 32;
  seed(`${S}/${PREP}/selected-reference.json`, metaBytes);
  const roleDocs = ["source", "tests", "closure", "dependencyLock", "image", "runtimeConfiguration", "coreRules", "strategicSource", "corpusManifest", "corpusSource", "recipe", "featureLayout", "fixtureManifest", "hostConfiguration"].map(role => {
    let path = `fixtures/${role}.json`, data = bytes({ role, mocked: true });
    if (role === "source") { path = `${Q}/source-manifest.json`; data = sourceBytes; }
    else if (role === "tests") { path = `${Q}/verification.json`; data = verification; }
    else if (role === "closure") { path = `${PREP}/selected-reference.json`; data = metaBytes; }
    else if (role === "dependencyLock") { path = "pnpm-lock.yaml"; data = Buffer.from("QUALIFICATION_CURRENT_LOCK_NOT_CAPTURED_OLD_LOCK"); }
    else if (role === "strategicSource") { path = "artifacts/training-functional/scratch/reference-prep-2/bundles/strategic.ts"; data = Buffer.from(`MOCK_BUNDLE_NOT_EVALUATED:${outputs[3]!.path}`); }
    else if (role === "corpusManifest" || role === "corpusSource") { const row = corpus[role === "corpusManifest" ? 0 : 1]!; path = `${P}/corpus-inputs-1/inputs/reference/${row.path}`; data = Buffer.from(inputData.get(row.path)!); }
    if (role !== "strategicSource") seed(`${S}/${path}`, data);
    return { role, source: pin(path, data), futurePath: `/app/qualification-inputs/${role}.bin` };
  });
  const bindings = { scope: "FOURTEEN_ACTUAL_DOCUMENT_REFS_NOT_STAGED_NOT_EXECUTION_AUTHORITY", documents: roleDocs }, bindingBytes = bytes(bindings);
  seed(`${S}/${Q}/binding-documents.json`, bindingBytes);
  cfg.documents = [pin(`${Q}/source-manifest.json`, sourceBytes), pin(`${Q}/verification.json`, verification), pin(`${Q}/binding-documents.json`, bindingBytes)];
  seed(`${ZOD}/package.json`, bytes({ name: "zod", version: "4.6.7" })); seed(`${ZOD}/index.js`, Buffer.from("MOCK_ZOD_NOT_EVALUATED")); seed(`${ZOD}/v4/index.js`, Buffer.from("MOCK_ZOD_CHILD"));
  const helperCalls = { map: 0, verify: 0, validate: 0 }, helpers = {
    mapInputRows: (m: { reference: string; entries: { path: string; expectedBytes: number; sourceMode: string; gitBlobOid: string }[] }, t: { reference: string; files: ReferenceRow[] }, count: number, size: number) => {
      helperCalls.map++; expect(m.reference).toBe(REF); expect(t.reference).toBe(REF); expect(m.entries).toHaveLength(count); expect(t.files).toHaveLength(count);
      const rows = m.entries.map(e => { const r = t.files.find(r => r.path === e.path)!; expect(r.bytes).toBe(e.expectedBytes); expect(r.sourceMode).toBe(e.sourceMode); expect(r.gitBlobOid).toBe(e.gitBlobOid); return { ...r }; });
      expect(rows.reduce((n, r) => n + r.bytes, 0)).toBe(size); return rows;
    },
    verifyReference: (source: string, bundles: string, raw: Uint8Array) => { helperCalls.verify++; const doc = JSON.parse(Buffer.from(raw).toString()) as typeof metadata;
      for (const item of doc.inventory) for (const [root, rows] of [[bundles, [item.output]], [source, item.inputs]] as const) for (const row of rows) {
        const data = env.nodes.get(`${root}/${row.path}`)?.data; if (!data || data.byteLength !== row.byteLength || sha(data) !== row.sha256) throw new Error("MOCK_VERIFIED_HASH"); }
      return doc;
    },
  };
  const operator = {
    qualificationInputManifest: (b: typeof bindings, rows: PayloadRow[]): Manifest => ({ version: "chess-coach.qualification-inputs.v1", documents: structuredClone(b.documents), source: structuredClone(rows), reference: structuredClone(cfg.referenceFiles) }),
    validateQualificationInputs: async (fs: Pick<BootstrapIO, "read" | "alias">, roots: { app: string; reference: string; documents: string }) => {
      helperCalls.validate++; const doc = JSON.parse(Buffer.from(await fs.read(`${roots.documents}/input-manifest.json`, 8 * MIB)).toString()) as Manifest;
      expect(doc.documents).toHaveLength(14); expect(doc.reference).toEqual(cfg.referenceFiles);
      for (const item of doc.documents) { const data = await fs.read(`${roots.documents}/${item.role}.bin`, item.source.byteLength); expect(pin(item.source.path, data)).toEqual(item.source); }
      for (const [root, rows] of [[roots.app, doc.source], [roots.reference, doc.reference]] as const) for (const row of rows) expect(pin(row.path, await fs.read(`${root}/${row.path}`, row.byteLength))).toEqual(row);
      for (const name of ["contracts", "policy", "starchess-core"]) await fs.alias(`${roots.app}/node_modules/@chess-coach/${name}`, `${roots.app}/packages/${name}`);
      return {};
    },
  };
  io.loadModule = async path => { env.events.push(`load:${path}`); if (path === `${S}/artifacts/training-functional/reference-retry.ts`) return helpers;
    if (path === `${I}/app/artifacts/training-functional/qualification-operator.ts`) return operator; throw new Error(`FORBIDDEN_MODULE:${path}`); };
  io.command = async request => { env.commands.push(request); env.events.push("builder");
    expect(request.argv).toEqual([B, "--no-env-file", "--no-install", `${S}/tooling/build-reference.ts`, `${D}/reference-source`, `${D}/reference-bundles`]);
    expect(env.nodes.has(`${D}/reference-bundles`)).toBe(false); seedDir(`${D}/reference-bundles`);
    for (const row of outputs) seed(`${D}/reference-bundles/${row.path}`, Buffer.from(`MOCK_BUNDLE_NOT_EVALUATED:${row.path}`));
    seed(`${D}/reference-bundles/selected-reference.json`, metaBytes); seed(`${D}/reference-bundles/metafile-0.json`, bytes({ mocked: true })); return pass();
  };
  const repinDocument = (index: number, value: unknown) => { const row = cfg.documents[index]!, b = bytes(value); seed(`${S}/${row.path}`, b); cfg.documents[index] = pin(row.path, b); };
  const repinCanonical = () => { const b = bytes({ reference: REF, files: canonical }); cfg.canonical = pin(`${PREP}/input-manifest.json`, b); seed(`${S}/${cfg.canonical.path}`, b); flatManifest.sourceManifest.sha256 = sha(b); seed(`${S}/artifacts/training-functional/reference-inputs/manifest.json`, bytes(flatManifest)); };
  return { ...env, cfg, sourceFiles, bindings, canonical, flatManifest, metadata, operator, helpers, helperCalls, inputData, repinDocument, repinCanonical,
    run: () => prepareQualificationWorker(COMMIT, io, cfg) };
}
function parent() {
  const env = memory(), launcher = Buffer.from("MOCK_IMMUTABLE_LAUNCHER_BYTES"); env.seed(L, launcher);
  const builderResult = pass(), { stdout, stderr, ...result } = builderResult;
  const manifest = bytes({ version: "chess-coach.qualification-inputs.v1" });
  const workerReceipt: BootstrapReceipt = { version: "chess-coach.qualification-bootstrap.v1", phase: "preparation", scope: "OFFLINE_PREPARATION_NOT_QUALIFICATION", status: "PASS", publicationCommit: COMMIT,
    inputManifest: pin(`${I}/qualification-inputs/input-manifest.json`, manifest), referenceBuilds: 6, qualified: false, trainingReady: false, failures: [], preparationReceipt: null,
    commands: [{ argv: [B, "--no-env-file", "--no-install", `${S}/tooling/build-reference.ts`, `${D}/reference-source`, `${D}/reference-bundles`], cwd: S, deadlineMs: 240000, cleanupDeadlineMs: 245000,
      result, stdout: pin(`${D}/logs/reference-builder.stdout`, stdout), stderr: pin(`${D}/logs/reference-builder.stderr`, stderr) }] };
  let hook: (request: CommandRequest, n: number) => Promise<ChildResult | undefined> = async () => undefined;
  env.io.command = async request => { const n = env.commands.length; env.commands.push(request); const override = await hook(request, n); if (override) return override;
    if (n === 0) { env.seedDir(S); env.seed(`${S}/${plan.entry}`, launcher); }
    if (n === 3) return pass(Buffer.from(COMMIT + "\n"));
    if (n === 4) { env.seed(`${D}/preparation-receipt.json`, bytes(workerReceipt)); env.seed(`${I}/qualification-inputs/input-manifest.json`, manifest); }
    return pass();
  };
  return { ...env, workerReceipt, hook: (next: typeof hook) => { hook = next; }, run: () => prepareQualification(COMMIT, env.io) };
}

test("MOCK inert standalone imports and explicit pin-only mode parsing", () => {
  expect(spawn).not.toHaveBeenCalled(); expect(spawnSync).not.toHaveBeenCalled(); expect(fetchSpy).not.toHaveBeenCalled();
  for (const args of [[], ["prepare"], ["run", COMMIT], ["operator", COMMIT], ["prepare", "A".repeat(40)], ["prepare", "1".repeat(39)], ["prepare", COMMIT, "extra"], ["prepare", "a; echo x"], ["prepare-worker", COMMIT, "--approved"]]) expect(qualificationBootstrapMode(true, args)).toBeNull();
  expect(qualificationBootstrapMode(false, ["prepare", COMMIT])).toBeNull(); expect(qualificationBootstrapMode(true, ["prepare", COMMIT])).toBe("prepare"); expect(qualificationBootstrapMode(true, ["prepare-worker", COMMIT])).toBe("prepare-worker");
});
test("MOCK production constants retain all historical pins and exact totals without mutable plan state", () => {
  expect(plan).toMatchObject({ gitMs: 120000, preparationMs: 240000, cleanupMs: 5000, qualified: false, trainingReady: false });
  expect(plan.contract).toMatchObject({ sourceCount: 108, sourceBytes: 641523, flatCount: 6, flatBytes: 113300, referenceInputs: 95, appFiles: 4096, appBytes: 128 * MIB, fileBytes: 16 * MIB });
  expect(plan.contract.groups.reduce((n, row) => n + row.count, 6)).toBe(435); expect(plan.contract.groups.reduce((n, row) => n + row.bytes, 113300)).toBe(4635549);
  expect(plan.contract.referenceFiles).toHaveLength(9); expect(plan.contract.referenceFiles.reduce((n, row) => n + row.byteLength, 0)).toBe(1714635);
  expect(plan.contract.referenceFiles.slice(0, 6).map(row => row.byteLength)).toEqual([77587, 81433, 315327, 115300, 51664, 297812]);
  const other = qualificationBootstrapPlan(); other.contract.sourceCount = 1; expect(qualificationBootstrapPlan().contract.sourceCount).toBe(108);
});
test("MOCK invalid commit rejects before any IO", async () => {
  const env = parent(); env.io.now = () => { throw new Error("UNEXPECTED_CLOCK"); }; env.io.context = async () => { throw new Error("UNEXPECTED_CONTEXT"); };
  for (const commit of ["", "A".repeat(40), "b".repeat(41), COMMIT + ";sh"]) expect((await prepareQualification(commit, env.io)).failures.join()).toContain("COMMIT");
  expect(env.events).toHaveLength(0); expect(env.commands).toHaveLength(0);
});
for (const field of ["cwd", "realpath", "executable", "entrypoint", "version", "flags"] as const) test(`MOCK exact retained Bun context rejects ${field}`, async () => {
  const env = parent(); env.io.context = async () => ({ ...context(), [field]: field === "flags" ? ["--no-install"] : "/wrong" });
  expect((await env.run()).failures.join()).toContain("CONTEXT"); expect(env.events).toHaveLength(0); expect(env.commands).toHaveLength(0);
});
for (const root of [D, I, R]) test(`MOCK collision at ${root.split("/").at(-1)} stops before writes or network`, async () => {
  const env = parent(); env.seedDir(root); const result = await env.run(); expect(result.status).toBe("FAIL"); expect(env.commands).toHaveLength(0);
  expect(env.events.every(e => e.startsWith("absent:"))).toBe(true); expect(env.nodes.has(`${D}/attempt.json`)).toBe(false);
});
test("MOCK four literal git operations share the original deadline including setup", async () => {
  const env = parent(), old = env.io.mkdir; env.io.mkdir = async path => { env.setTime(env.time() + 10); await old(path); };
  const report = await env.run(); expect(report.status).toBe("PASS"); expect(report).toMatchObject({ referenceBuilds: 6, qualified: false, trainingReady: false });
  expect(env.commands).toHaveLength(5); const git = env.commands.slice(0, 4);
  expect(git.map(r => r.argv.filter(arg => ["init", "fetch", "checkout", "rev-parse"].includes(arg))[0])).toEqual(["init", "fetch", "checkout", "rev-parse"]);
  expect(git.every(r => r.deadlineMs === 120000 && r.cleanupDeadlineMs === 125000 && r.cwd === H)).toBe(true);
  expect(git[0]!.argv.slice(-2)).toEqual(["init", S]); expect(git[1]!.argv.slice(-7)).toEqual(["-C", S, "fetch", "--depth=1", "--no-tags", "https://github.com/proveo-ca/chess-coach.git", COMMIT]);
  expect(git[2]!.argv.slice(-3)).toEqual(["checkout", "--detach", "FETCH_HEAD"]); expect(git[3]!.argv.slice(-3)).toEqual(["rev-parse", "--verify", "HEAD"]);
  expect(git.every(r => r.argv.includes("core.autocrlf=false") && r.stdoutBytes === MIB && r.stderrBytes === MIB)).toBe(true);
  expect(env.commands[4]!.argv).toEqual([B, "--no-env-file", "--no-install", `${S}/${plan.entry}`, "prepare-worker", COMMIT]);
  expect(env.commands[4]!.deadlineMs).toBe(240040); expect(env.commands[4]!.env.HOME).toBe(`${D}/home`); expect(env.commands[4]!.env.TMPDIR).toBe(`${D}/tmp`); expect(env.commands.every(r => r.detached)).toBe(true);
  expect(Object.keys(env.commands[4]!.env)).not.toContain("AWS_SECRET_ACCESS_KEY"); expect(report.commands).toHaveLength(5);
  expect(env.json<BootstrapReceipt>(`${D}/bootstrap-receipt.json`).status).toBe("PASS");
});
test("MOCK HEAD mismatch suppresses preparation and preserves the new checkout", async () => {
  const env = parent(); env.hook(async (_r, n) => n === 3 ? pass(Buffer.from("b".repeat(40) + "\n")) : undefined);
  expect((await env.run()).failures.join()).toContain("HEAD_MISMATCH"); expect(env.commands).toHaveLength(4); expect(env.nodes.has(S)).toBe(true); expect(env.nodes.has(I)).toBe(false);
});
test("MOCK launcher mismatch rejects before loading any fresh module or worker", async () => {
  const env = parent(); env.hook(async (_r, n) => { if (n === 1) env.seed(`${S}/${plan.entry}`, Buffer.from("OTHER_PIN")); return undefined; });
  expect((await env.run()).failures.join()).toContain("BYTE_PIN"); expect(env.commands).toHaveLength(4);
});
test("MOCK one original git deadline rejects slow setup and later operations without renewal", async () => {
  const setup = parent(), old = setup.io.mkdir; setup.io.mkdir = async path => { await old(path); setup.setTime(120000); };
  expect((await setup.run()).status).toBe("FAIL"); expect(setup.commands).toHaveLength(0);
  const env = parent(); env.hook(async (_r, n) => { env.setTime((n + 1) * 40000); return undefined; });
  expect((await env.run()).status).toBe("FAIL"); expect(env.commands).toHaveLength(3); expect(env.commands.every(r => r.deadlineMs === 120000)).toBe(true);
});
for (const fault of [{ reaped: false }, { exited: false }, { stdoutEOF: false }, { stderrEOF: false }, { forced: true }, { signal: "SIGTERM" }, { exitCode: 1 }, { error: "unknown" }]) test(`MOCK git lifecycle uncertainty ${JSON.stringify(fault)} never passes`, async () => {
  const env = parent(); env.hook(async (_r, n) => n === 0 ? pass(new Uint8Array(), fault) : undefined);
  const result = await env.run(); expect(result.status).toBe("FAIL"); expect(result.commands).toHaveLength(1); expect(env.commands).toHaveLength(1); expect(env.nodes.has(I)).toBe(false);
});
test("MOCK attempted child exceptions and bounded prefix logs remain visible without retries", async () => {
  const env = parent(); env.hook(async () => { throw new Error("MOCK_SPAWN_FAILED"); });
  const result = await env.run(); expect(result.status).toBe("FAIL"); expect(result.commands[0]!.argv).toContain("init"); expect(result.commands[0]!.result.error).toBe("COMMAND_NOT_SETTLED"); expect(env.commands).toHaveLength(1);
  const cap = parent(); cap.hook(async () => pass(new Uint8Array(MIB + 1))); expect((await cap.run()).failures.join()).toContain("COMMAND_OUTPUT_BOUND"); expect(cap.commands).toHaveLength(1);
});
test("MOCK preparation watchdog covers worker, parent manifest readback and final receipt", async () => {
  for (const stage of ["worker", "readback", "receipt"]) {
    const env = parent(), read = env.io.read, write = env.io.write;
    env.hook(async (_r, n) => { if (n === 4 && stage === "worker") env.setTime(240000); return undefined; });
    env.io.read = async (path, cap) => { const b = await read(path, cap); if (stage === "readback" && path === `${I}/qualification-inputs/input-manifest.json`) env.setTime(240000); return b; };
    env.io.write = async (path, data, mode) => { await write(path, data, mode); if (stage === "receipt" && path.endsWith("/bootstrap-receipt.json")) env.setTime(240000); };
    const result = await env.run(); expect(result.status).toBe("FAIL"); expect(env.commands[4]!.deadlineMs).toBe(240000); expect(env.commands[4]!.cleanupDeadlineMs).toBe(245000);
  }
});
test("MOCK asynchronous parent readback stall uses injected original deadline alarm", async () => {
  const env = parent(), read = env.io.read; let reached!: () => void; const reachedRead = new Promise<void>(r => { reached = r; });
  env.io.read = async (path, cap) => { if (path.endsWith("/preparation-receipt.json")) { reached(); return new Promise(() => {}); } return read(path, cap); };
  const pending = env.run(); await reachedRead; await Promise.resolve(); const alarm = env.alarms.find(a => !a.cancelled)!;
  expect(alarm.ms).toBe(240000); env.setTime(240000); alarm.fire(); expect((await pending).status).toBe("FAIL");
});
test("MOCK late readback cannot reverse a latched deadline failure or continue validation", async () => {
  const env = parent(), read = env.io.read; let reached!: () => void, release!: (b: Uint8Array) => void;
  const reachedRead = new Promise<void>(r => { reached = r; }), delayed = new Promise<Uint8Array>(r => { release = r; });
  env.io.read = async (path, cap) => { if (path.endsWith("/preparation-receipt.json")) { reached(); return delayed; } return read(path, cap); };
  const pending = env.run(); await reachedRead; await Promise.resolve(); env.setTime(240000); env.alarms.find(a => !a.cancelled)!.fire();
  const result = await pending; expect(result.status).toBe("FAIL"); release(bytes(env.workerReceipt)); for (let n = 0; n < 20; n++) await Promise.resolve();
  expect(result.status).toBe("FAIL"); expect(env.events).not.toContain(`read:${I}/qualification-inputs/input-manifest.json`); expect(env.json<BootstrapReceipt>(`${D}/bootstrap-receipt.json`).status).toBe("FAIL");
});
for (const change of [{ publicationCommit: "b".repeat(40) }, { qualified: true }, { trainingReady: true }, { referenceBuilds: 5 }, { status: "FAIL" }, { failures: ["partial"] }, { phase: "bootstrap" }]) test(`MOCK parent binds retained worker report ${JSON.stringify(change)}`, async () => {
  const env = parent(); Object.assign(env.workerReceipt, change); expect((await env.run()).status).toBe("FAIL"); expect(env.commands).toHaveLength(5);
});
test("MOCK parent rejects a changed input manifest hash or non-natural worker exit", async () => {
  const changed = parent(); changed.workerReceipt.inputManifest!.sha256 = "e".repeat(64); expect((await changed.run()).failures.join()).toContain("BYTE_PIN");
  const env = parent(); env.hook(async (_r, n) => n === 4 ? pass(new Uint8Array(), { stdoutEOF: false }) : undefined); expect((await env.run()).status).toBe("FAIL");
});
test("MOCK failed worker readback retains verified build count and attempted child evidence", async () => {
  const env = parent(); env.workerReceipt.status = "FAIL"; env.workerReceipt.failures = ["MOCK_STAGING_FAILED_AFTER_BUILDS"];
  env.hook(async (_r, n) => { if (n !== 4) return undefined; env.seed(`${D}/preparation-receipt.json`, bytes(env.workerReceipt)); return pass(Buffer.from("partial-worker-output"), { exitCode: 1 }); });
  const result = await env.run(); expect(result.status).toBe("FAIL"); expect(result.referenceBuilds).toBe(6); expect(result.preparationReceipt).not.toBeNull(); expect(result.commands).toHaveLength(5);
  expect(Buffer.from(env.nodes.get(`${D}/logs/prepare-worker.stdout`)!.data!).toString()).toBe("partial-worker-output"); expect(result.commands[4]!.result.exitCode).toBe(1);
});
test("MOCK preparation's single deadline starts before pinned launcher readback", async () => {
  const env = parent(), read = env.io.read; env.io.read = async (path, cap) => { const value = await read(path, cap); if (path === `${S}/${plan.entry}`) env.setTime(239999); return value; };
  const result = await env.run(); expect(result.status).toBe("PASS"); expect(env.commands[4]!.deadlineMs).toBe(240000); expect(env.alarms.filter(a => a.ms === 1).length).toBeGreaterThan(0);
});
for (const n of [NaN, Infinity, -1, "0" as unknown as number]) test(`MOCK parent rejects non-finite or invalid clock ${n}`, async () => {
  const env = parent(); env.setTime(n); expect((await env.run()).failures.join()).toContain("CLOCK"); expect(env.commands).toHaveLength(0); expect(env.events).toHaveLength(0);
});
test("MOCK regressing clock latches failure before a command", async () => {
  const env = parent(); let n = 0; env.io.now = () => n++ ? 9 : 10; expect((await env.run()).failures.join()).toContain("CLOCK"); expect(env.commands).toHaveLength(0);
});

test("MOCK fresh worker reconstructs disjoint reference inputs, six verified outputs and physical delivery", async () => {
  const env = worker(), result = await env.run(); expect(result.failures).toEqual([]); expect(result.status).toBe("PASS"); expect(result).toMatchObject({ referenceBuilds: 6, qualified: false, trainingReady: false });
  expect(env.helperCalls).toEqual({ map: 2, verify: 1, validate: 1 }); expect(env.commands).toHaveLength(1); expect(env.commands[0]!.cwd).toBe(S); expect(env.commands[0]!.detached).toBe(false);
  const manifest = env.json<Manifest>(`${I}/qualification-inputs/input-manifest.json`); expect(manifest.source.length).toBe(env.cfg.sourceCount + 3); expect(manifest.reference).toHaveLength(9);
  expect(manifest.source.filter(r => r.path.startsWith("node_modules/zod/")).map(r => r.path).sort()).toEqual(["node_modules/zod/index.js", "node_modules/zod/package.json", "node_modules/zod/v4/index.js"]);
  expect(manifest.source.some(row => row.path.endsWith("qualification-bootstrap.ts"))).toBe(false); expect(manifest.source.some(row => row.path.includes("@chess-coach"))).toBe(false);
  expect([...env.nodes].filter(([p, n]) => p.startsWith(`${I}/reference/`) && n.kind === "file")).toHaveLength(9);
  expect(env.nodes.has(`${I}/reference/metafile-0.json`)).toBe(false); expect(env.nodes.has(R)).toBe(false); expect(env.nodes.has(`${I}/app/state`)).toBe(false);
  for (const name of ["reference", "qualification-inputs"]) expect([...env.nodes.keys()].filter(p => p.startsWith(`${I}/app/${name}/`))).toHaveLength(0);
  for (const name of ["fflate", "jssha"]) expect(env.nodes.get(`${D}/notices/${name}-LICENSE`)!.data).toEqual(env.inputData.get(`node_modules/${name}/LICENSE`));
  expect(env.json<BootstrapReceipt>(`${D}/preparation-receipt.json`).status).toBe("PASS");
});
test("MOCK module order stages dependencies and aliases before importing only the inert staged operator", async () => {
  const env = worker(); expect((await env.run()).status).toBe("PASS"); const load = env.events.indexOf(`load:${I}/app/artifacts/training-functional/qualification-operator.ts`);
  for (const path of [`${I}/app/node_modules/zod/package.json`, `${I}/app/node_modules/zod/v4/index.js`]) expect(env.events.indexOf(`write:${path}`)).toBeLessThan(load);
  for (const name of ["contracts", "policy", "starchess-core"]) expect(env.events.indexOf(`symlink:${I}/app/node_modules/@chess-coach/${name}`)).toBeLessThan(load);
  expect(env.events.filter(e => e.startsWith("load:"))).toEqual([`load:${S}/artifacts/training-functional/reference-retry.ts`, `load:${I}/app/artifacts/training-functional/qualification-operator.ts`]);
  expect(env.events.some(e => e.includes("_spec/historical.puml"))).toBe(false);
});
test("MOCK exact source bytes stay unchanged and chmod touches only fresh adapter copies", async () => {
  const env = worker(), before = env.sourceFiles.map(row => Uint8Array.from(env.nodes.get(`${S}/${row.path}`)!.data!)); expect((await env.run()).status).toBe("PASS");
  for (const [n, row] of env.sourceFiles.entries()) { expect(env.nodes.get(`${S}/${row.path}`)!.data).toEqual(before[n]!); expect(env.nodes.get(`${I}/app/${row.path}`)!.data).toEqual(before[n]!); }
  expect(env.events.filter(e => e.startsWith("chmod:"))).toEqual(["score", "channel"].map(name => `chmod:${I}/app/artifacts/training-functional/qualification-policy-${name}.ts`));
  expect(env.events.filter(e => e.startsWith("write:") || e.startsWith("mkdir:") || e.startsWith("symlink:")).every(e => { const p = e.slice(e.indexOf(":") + 1); return p.startsWith(D + "/") || p === I || p.startsWith(I + "/"); })).toBe(true);
});
test("MOCK binding documents preserve fourteen role bytes and redirect only strategic source and closure", async () => {
  const env = worker(); expect((await env.run()).status).toBe("PASS");
  for (const doc of env.bindings.documents) expect(pin(doc.source.path, env.nodes.get(`${I}/qualification-inputs/${doc.role}.bin`)!.data!)).toEqual(doc.source);
  expect(env.events.some(e => e.startsWith("read:") && e.includes("/scratch/reference-prep-2/"))).toBe(false);
  expect(env.events).toContain(`read:${D}/reference-bundles/${env.cfg.referenceFiles[3]!.path}`);
  expect(env.nodes.get(`${D}/reference-source/pnpm-lock.yaml`)!.data).not.toEqual(env.nodes.get(`${I}/qualification-inputs/dependencyLock.bin`)!.data);
  for (const name of ["fflate", "jssha"]) expect(env.nodes.get(`${D}/reference-source/node_modules/${name}/package.json`)!.data).toEqual(env.inputData.get(`node_modules/${name}/package.json`));
});
for (const root of [I, R, `${D}/reference-source`, `${D}/reference-bundles`]) test(`MOCK worker does not adopt existing ${root.split("/").at(-1)}`, async () => {
  const env = worker(); env.seedDir(root); expect((await env.run()).status).toBe("FAIL"); expect(env.commands).toHaveLength(0); expect(env.events.some(e => e.startsWith("mkdir:"))).toBe(false);
});
test("MOCK worker requires the fresh pinned checkout entrypoint and matching parent marker", async () => {
  for (const mode of ["entry", "commit", "parent"]) { const env = worker(); if (mode === "entry") env.io.context = async () => context(false);
    else env.seed(`${D}/attempt.json`, bytes({ publicationCommit: mode === "commit" ? "b".repeat(40) : COMMIT, parentPid: mode === "parent" ? 11 : 10 }));
    expect((await env.run()).status).toBe("FAIL"); expect(env.commands).toHaveLength(0); expect(env.events.some(e => e.startsWith("write:"))).toBe(false); }
});
test("MOCK worker rejects regressing and non-finite clocks without launching a builder", async () => {
  for (const value of [NaN, Infinity, -1]) { const env = worker(); env.setTime(value); expect((await env.run()).failures.join()).toContain("CLOCK"); expect(env.commands).toHaveLength(0); }
  const env = worker(); let calls = 0; env.io.now = () => calls++ ? 0 : 1; expect((await env.run()).failures.join()).toContain("CLOCK"); expect(env.commands).toHaveLength(0);
});
for (const n of [0, 1, 2]) test(`MOCK changed immutable generation document ${n} fails before preparation`, async () => {
  const env = worker(); env.seed(`${S}/${env.cfg.documents[n]!.path}`, Buffer.from("DIFFERENT_METADATA")); expect((await env.run()).failures.join()).toContain("BYTE_PIN"); expect(env.commands).toHaveLength(0); expect(env.nodes.has(I)).toBe(false);
});
test("MOCK no synthetic data can pass the unchanged production contract", async () => {
  const env = worker(); const result = await prepareQualificationWorker(COMMIT, env.io); expect(result.status).toBe("FAIL"); expect(result.failures.join()).toContain("BYTE_PIN"); expect(env.commands).toHaveLength(0);
});
test("MOCK source closure count, hash, unsafe paths and physical parent symlinks suppress builds", async () => {
  for (const mode of ["count", "hash", "unsafe", "parent", "mode"]) {
    const env = worker();
    if (mode === "count") env.cfg.sourceCount++;
    if (mode === "hash") env.seed(`${S}/${env.sourceFiles[0]!.path}`, Buffer.from("CHANGED_SOURCE"));
    if (mode === "unsafe") { const doc = env.json<{ files: PayloadRow[]; fileCount: number; byteLength: number }>(`${S}/${Q}/source-manifest.json`); doc.files[0]!.path = "../escape.ts"; env.repinDocument(0, doc); }
    if (mode === "parent") env.nodes.set(`${S}/packages/runtime`, { kind: "symlink", mode: 0o777, size: 1, target: "/elsewhere" });
    if (mode === "mode") env.nodes.get(`${S}/${env.sourceFiles[0]!.path}`)!.mode = 0o666;
    expect((await env.run()).status).toBe("FAIL"); expect(env.commands).toHaveLength(0); expect(env.nodes.has(I)).toBe(false);
  }
});
test("MOCK partition membership rejects duplicate canonical or flat aliases and wrong flat paths", async () => {
  for (const mode of ["canonical", "flat", "path", "hash", "mode", "blob"]) {
    const env = worker();
    if (mode === "canonical") { env.canonical[1]!.path = env.canonical[0]!.path; env.repinCanonical(); }
    if (mode === "flat") env.flatManifest.files[0]!.source = env.canonical[0]!.path;
    if (mode === "path") env.flatManifest.files[0]!.path = "packages/ambient.ts";
    if (mode === "hash") env.canonical[0]!.sha256 = "e".repeat(64);
    if (mode === "mode") env.canonical[0]!.sourceMode = "100755";
    if (mode === "blob") env.canonical[0]!.gitBlobOid = "f".repeat(40);
    if (["hash", "mode", "blob"].includes(mode)) env.repinCanonical();
    env.seed(`${S}/artifacts/training-functional/reference-inputs/manifest.json`, bytes(env.flatManifest));
    expect((await env.run()).status).toBe("FAIL"); expect(env.commands).toHaveLength(0); expect(env.nodes.has(I)).toBe(false);
  }
});
test("MOCK captured check and manifest pins reject before reconstruction", async () => {
  for (const leaf of ["check.json", "input-manifest.json", "materialization.json"]) { const env = worker(); env.seed(`${S}/${P}/local-inputs-1/${leaf}`, bytes({ fabricated: true }));
    expect((await env.run()).failures.join()).toContain("CAPTURED_DOCUMENT_PIN"); expect(env.commands).toHaveLength(0); expect(env.nodes.has(`${D}/reference-source`)).toBe(false); }
});
test("MOCK physical captured reference bytes, Git blob IDs and modes use real hashes", async () => {
  for (const mode of ["sha", "mode", "blob", "symlink"]) { const env = worker(), row = env.canonical[0]!, path = `${S}/${P}/local-inputs-1/inputs/reference/${row.path}`;
    if (mode === "sha") env.seed(path, Buffer.from("OTHER_CAPTURED_BYTES"));
    if (mode === "mode") env.nodes.get(path)!.mode = 0o755;
    if (mode === "symlink") env.nodes.set(path, { kind: "symlink", mode: 0o777, size: 1, target: "/other" });
    if (mode === "blob") { await expect(validateBootstrapReferenceRow(env.io, path, { ...row, gitBlobOid: "e".repeat(40) })).rejects.toThrow("GIT_BLOB"); continue; }
    const result = await env.run(); expect(result.status).toBe("FAIL"); expect(result.referenceBuilds).toBe(0); expect(env.commands).toHaveLength(0); expect(env.nodes.has(`${D}/reference-source`)).toBe(true);
  }
});
test("MOCK readonly source and captured reference modes remain strict outside installed Zod", async () => {
  const env = worker(); env.nodes.get(`${S}/${env.sourceFiles[0]!.path}`)!.mode = 0o444;
  expect((await env.run()).failures.join()).toContain("SOURCE_MODE"); expect(env.commands).toHaveLength(0);
  const row = env.canonical[0]!, path = `${S}/${P}/local-inputs-1/inputs/reference/${row.path}`;
  for (const [mode, sourceMode] of [[0o444, "100644"], [0o600, "100644"], [0o555, "100755"], [0o700, "100755"], [0o4755, "100755"]] as const) {
    env.nodes.get(path)!.mode = mode; await expect(validateBootstrapReferenceRow(env.io, path, { ...row, sourceMode })).rejects.toThrow("REFERENCE_MODE");
  }
});
test("MOCK no current checkout code or root lock can replace captured reference input bytes", async () => {
  const env = worker(); const path = `${S}/${P}/local-inputs-1/inputs/reference/pnpm-lock.yaml`; env.nodes.delete(path); env.seed(`${S}/captured-only.ts`, Buffer.from("AMBIENT_CURRENT_SOURCE"));
  const result = await env.run(); expect(result.status).toBe("FAIL"); expect(env.events).not.toContain(`read:${S}/captured-only.ts`); expect(env.commands).toHaveLength(0);
});
test("MOCK one builder attempt cannot pass partial output or changed selected metadata", async () => {
  for (const mode of ["nonzero", "bundle", "metadata", "published", "inputs"]) {
    const env = worker(), build = env.io.command; env.io.command = async request => { const r = await build(request);
      if (mode === "nonzero") return pass(new Uint8Array(), { exitCode: 1 });
      if (mode === "bundle") env.seed(`${D}/reference-bundles/${env.cfg.referenceFiles[2]!.path}`, Buffer.from("CHANGED_BUNDLE"));
      if (mode === "metadata") env.seed(`${D}/reference-bundles/selected-reference.json`, bytes({ changed: true }));
      if (mode === "published") env.seed(`${S}/${PREP}/selected-reference.json`, bytes({ changed: true }));
      if (mode === "inputs") env.seed(`${D}/reference-source/${env.canonical[0]!.path}`, Buffer.from("CHANGED_BUILD_INPUT")); return r;
    };
    const result = await env.run(); expect(result.status).toBe("FAIL"); expect(env.commands).toHaveLength(1); expect(result.commands).toHaveLength(1); expect(env.nodes.has(I)).toBe(false);
    expect(result.referenceBuilds).toBe(mode === "nonzero" ? 0 : mode === "bundle" ? 2 : 6); expect(env.nodes.has(`${D}/reference-bundles`)).toBe(true);
  }
});
test("MOCK six bundle input inventory verification rejects missing unique hashes", async () => {
  const env = worker(), verify = env.helpers.verifyReference; env.helpers.verifyReference = (s, b, raw) => { const doc = verify(s, b, raw); doc.inventory.forEach(i => { i.inputs = i.inputs.slice(1); }); return doc; };
  const result = await env.run(); expect(result.status).toBe("FAIL"); expect(result.referenceBuilds).toBe(6); expect(env.nodes.has(I)).toBe(false);
});
for (const mode of ["wrong-version", "wrong-name", "unreadable", "symlink", "package-link", "other-type", "file-bound", "app-files", "app-bytes", "entries", "parent-link"]) test(`MOCK bounded physical Zod copy rejects ${mode}`, async () => {
  const env = worker();
  if (mode === "wrong-version" || mode === "wrong-name") env.seed(`${ZOD}/package.json`, bytes({ name: mode === "wrong-name" ? "other" : "zod", version: mode === "wrong-version" ? "3.0.0" : "4.6.7" }));
  if (mode === "unreadable") env.nodes.delete(`${ZOD}/package.json`);
  if (mode === "symlink" || mode === "package-link") env.nodes.set(`${ZOD}/${mode === "symlink" ? "index.js" : "package.json"}`, { kind: "symlink", mode: 0o777, size: 1, target: "/other" });
  if (mode === "other-type") env.nodes.set(`${ZOD}/index.js`, { kind: "other", mode: 0o644, size: 0 });
  if (mode === "file-bound") env.nodes.get(`${ZOD}/index.js`)!.size = env.cfg.fileBytes + 1;
  if (mode === "app-files") env.cfg.appFiles = env.cfg.sourceCount + 1;
  if (mode === "app-bytes") env.cfg.appBytes = env.cfg.sourceBytes + 1;
  if (mode === "entries") env.cfg.treeEntries = 1;
  if (mode === "parent-link") env.nodes.set(dirname(ZOD), { kind: "symlink", mode: 0o777, size: 1, target: "/other" });
  const result = await env.run(); expect(result.status).toBe("FAIL"); expect(env.helperCalls.validate).toBe(0); expect(env.events).not.toContain(`load:${I}/app/artifacts/training-functional/qualification-operator.ts`);
  expect(env.commands).toHaveLength(1); expect(result.referenceBuilds).toBe(6);
});
test("MOCK readable readonly installed Zod preserves bytes and normalizes only fresh copies to 0644", async () => {
  const env = worker(), installed = [["package.json", 0o444], ["index.js", 0o444], ["v4/index.js", 0o555]] as const;
  const before = installed.map(([path, mode]) => { env.nodes.get(`${ZOD}/${path}`)!.mode = mode; return Uint8Array.from(env.nodes.get(`${ZOD}/${path}`)!.data!); });
  const result = await env.run(); expect(result.failures).toEqual([]); expect(result.status).toBe("PASS");
  const manifest = env.json<Manifest>(`${I}/qualification-inputs/input-manifest.json`);
  for (const [n, [path, mode]] of installed.entries()) {
    expect((await env.io.stat(`${ZOD}/${path}`)).mode).toBe(mode); expect((await env.io.stat(`${I}/app/node_modules/zod/${path}`)).mode).toBe(0o644);
    expect(env.nodes.get(`${ZOD}/${path}`)!.data).toEqual(before[n]!); expect(env.nodes.get(`${I}/app/node_modules/zod/${path}`)!.data).toEqual(before[n]!);
    expect(manifest.source.find(row => row.path === `node_modules/zod/${path}`)).toEqual(pin(`node_modules/zod/${path}`, before[n]!));
  }
  expect(env.events.filter(e => e.startsWith("chmod:"))).toEqual(["score", "channel"].map(name => `chmod:${I}/app/artifacts/training-functional/qualification-policy-${name}.ts`));
});
test("MOCK installed Zod read errors fail despite regular valid mode before operator loading", async () => {
  const env = worker(), read = env.io.read; expect((await env.io.stat(`${ZOD}/index.js`)).mode).toBe(0o644);
  env.io.read = async (path, cap) => { if (path === `${ZOD}/index.js`) throw new Error("MOCK_EACCES_ZOD"); return read(path, cap); };
  const result = await env.run(); expect(result.status).toBe("FAIL"); expect(result.failures.join()).toContain("MOCK_EACCES_ZOD"); expect(result.inputManifest).toBeNull();
  expect(env.helperCalls.validate).toBe(0); expect(env.events).not.toContain(`load:${I}/app/artifacts/training-functional/qualification-operator.ts`);
  expect(env.nodes.has(`${I}/app/node_modules/zod/index.js`)).toBe(false); expect(env.nodes.has(R)).toBe(false); expect(result.qualified).toBe(false); expect(result.trainingReady).toBe(false);
});
test("MOCK physical app budgets include both immutable source files and installed Zod", async () => {
  const env = worker(); env.cfg.appFiles = env.cfg.sourceCount + 3; expect((await env.run()).status).toBe("PASS");
  const over = worker(); over.cfg.appFiles = over.cfg.sourceCount + 2; const result = await over.run(); expect(result.status).toBe("FAIL"); expect(result.failures.join()).toContain("APP_BOUND"); expect(over.nodes.has(`${I}/app/node_modules/zod/package.json`)).toBe(true);
});
test("MOCK Zod traversal limits directory depth without allocating an unbounded tree", async () => {
  const env = worker(); env.seed(`${ZOD}/${Array.from({ length: 33 }, () => "d").join("/")}/index.js`, Buffer.from("MOCK_DEEP_FILE")); env.cfg.treeEntries = 128;
  const result = await env.run(); expect(result.status).toBe("FAIL"); expect(result.failures.join()).toContain("ZOD_DIRECTORY"); expect(env.helperCalls.validate).toBe(0);
});
for (const mode of ["role", "duplicate", "future", "bytes", "strategic"]) test(`MOCK role binding rejects ${mode} without qualification`, async () => {
  const env = worker();
  if (mode === "role") env.bindings.documents[0]!.role = "invented";
  if (mode === "duplicate") env.bindings.documents[1] = env.bindings.documents[0]!;
  if (mode === "future") env.bindings.documents[0]!.futurePath = "/app/wrong/source.bin";
  if (mode === "bytes") env.seed(`${S}/fixtures/image.json`, bytes({ other: true }));
  if (mode === "strategic") env.bindings.documents.find(d => d.role === "strategicSource")!.source.sha256 = "e".repeat(64);
  if (mode !== "bytes") env.repinDocument(2, env.bindings);
  const result = await env.run(); expect(result.status).toBe("FAIL"); expect(result.qualified).toBe(false); expect(env.nodes.has(I)).toBe(false);
});
test("MOCK staging failures preserve partial trees and never call operator, Docker, GPU or native programs", async () => {
  const env = worker(), write = env.io.write; env.io.write = async (path, data, mode) => { if (path === `${I}/app/node_modules/zod/index.js`) throw new Error("MOCK_DISK_FULL"); await write(path, data, mode); };
  const result = await env.run(); expect(result.status).toBe("FAIL"); expect(env.nodes.has(`${I}/app/artifacts/training-functional/qualification-operator.ts`)).toBe(true);
  expect(env.nodes.has(`${D}/reference-source`)).toBe(true); expect(env.commands).toHaveLength(1);
  expect(env.commands.every(r => r.argv[0] === B && r.argv[3] === `${S}/tooling/build-reference.ts`)).toBe(true); expect(result.trainingReady).toBe(false); expect(env.nodes.has(R)).toBe(false);
});
test("MOCK generated manifests must retain physical rows, exact nine references and fourteen bindings", async () => {
  for (const mode of ["source", "reference", "documents", "readback", "validator"]) {
    const env = worker(), make = env.operator.qualificationInputManifest, read = env.io.read;
    env.operator.qualificationInputManifest = (b, rows) => { const doc = make(b, rows); if (mode === "source") doc.source[0]!.sha256 = "e".repeat(64); if (mode === "reference") doc.reference.pop(); if (mode === "documents") doc.documents[0]!.source.sha256 = "f".repeat(64); return doc; };
    if (mode === "readback") env.io.read = async (path, cap) => path === `${I}/qualification-inputs/input-manifest.json` ? bytes({ changed: true }) : read(path, cap);
    if (mode === "validator") env.operator.validateQualificationInputs = async () => { throw new Error("MOCK_MODEL_SHAPE_FAILED"); };
    const result = await env.run(); expect(result.status).toBe("FAIL"); expect(result.inputManifest).toBeNull(); expect(env.nodes.has(R)).toBe(false);
  }
});
test("MOCK worker's original budget includes synchronous orchestration, copy and receipt checks", async () => {
  for (const stage of ["reconstruct", "build", "copy", "validate", "receipt"]) {
    const env = worker(), write = env.io.write, builder = env.io.command, validate = env.operator.validateQualificationInputs;
    env.io.write = async (path, data, mode) => { await write(path, data, mode); if ((stage === "reconstruct" && path.endsWith("reference-source/pnpm-lock.yaml")) || (stage === "copy" && path.endsWith("app/node_modules/zod/index.js")) || (stage === "receipt" && path.endsWith("/preparation-receipt.json"))) env.setTime(240000); };
    env.io.command = async request => { const r = await builder(request); if (stage === "build") env.setTime(240000); return r; };
    env.operator.validateQualificationInputs = async (fs, roots) => { const result = await validate(fs, roots); if (stage === "validate") env.setTime(240000); return result; };
    const result = await env.run(); expect(result.status).toBe("FAIL"); expect(result.failures.join()).toContain("DEADLINE");
    if (stage === "reconstruct") expect(env.commands).toHaveLength(0); else expect(env.commands).toHaveLength(1);
  }
});

function childHarness() {
  let time = 0, kills = 0, unrefs = 0, exit!: (n: number) => void; const alarms: { ms: number; fire(): void; cancelled: boolean }[] = [];
  const stdout: { controller?: ReadableStreamDefaultController<Uint8Array> } = {}, stderr: typeof stdout = {};
  const handle: ChildHandle = { stdout: new ReadableStream({ start: c => { stdout.controller = c; } }), stderr: new ReadableStream({ start: c => { stderr.controller = c; } }),
    exited: new Promise<number>(r => { exit = r; }), signal: () => null, kill: () => { kills++; }, unref: () => { unrefs++; } };
  const request: CommandRequest = { argv: [B, "--no-env-file", "--no-install", `${S}/${plan.entry}`, "prepare-worker", COMMIT], cwd: H, env: {}, detached: true, deadlineMs: 240000, cleanupDeadlineMs: 245000, stdoutBytes: 8, stderrBytes: 8, now: () => time };
  const io: ChildIO = { spawn: () => handle, alarm: (ms, fire) => { const alarm = { ms, fire, cancelled: false }; alarms.push(alarm); return () => { alarm.cancelled = true; }; } };
  const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
  return { io, request, handle, stdout, stderr, exit, alarms, flush, setTime: (n: number) => { time = n; }, kills: () => kills, unrefs: () => unrefs,
    finish: () => { stdout.controller!.close(); stderr.controller!.close(); exit(0); } };
}
test("MOCK Git spawn inherits 0022 only synchronously and creates strict modes inside private fresh source", async () => {
  const env = memory(), child = childHarness(), data = Buffer.from("MOCK_GIT_CHECKOUT_BYTES"), events: string[] = []; let mask = 0o077, deferredMask = -1;
  await env.io.mkdir(D); const request = { ...child.request, argv: ["git", "-C", S, "checkout", "--detach", "FETCH_HEAD"] };
  const spawned = spawnBootstrapChild(request, {
    umask: next => { events.push(`umask:${next.toString(8)}`); const old = mask; mask = next; return old; },
    spawn: actual => { expect(actual).toBe(request); events.push(`spawn:${mask.toString(8)}`); env.seedDir(S);
      env.seed(`${S}/git-regular.ts`, data, 0o666 & ~mask); env.seed(`${S}/git-executable.ts`, data, 0o777 & ~mask);
      void Promise.resolve().then(() => { deferredMask = mask; }); return child.handle; },
  });
  expect(spawned).toBe(child.handle); expect(mask).toBe(0o077); expect(events).toEqual(["umask:22", "spawn:22", "umask:77"]); expect(env.nodes.get(D)!.mode).toBe(0o700);
  await Promise.resolve(); expect(deferredMask).toBe(0o077);
  for (const [path, mode, sourceMode] of [["git-regular.ts", 0o644, "100644"], ["git-executable.ts", 0o755, "100755"]] as const) {
    expect(env.nodes.get(`${S}/${path}`)!.mode).toBe(mode);
    expect(await validateBootstrapReferenceRow(env.io, `${S}/${path}`, { path, bytes: data.byteLength, sha256: sha(data), sourceMode })).toEqual(Uint8Array.from(data));
  }
  child.finish();
});
test("MOCK Git spawn restores the original umask synchronously after an exception", () => {
  const child = childHarness(), request = { ...child.request, argv: ["git", "init", S] };
  for (const original of [0o077, 0o027]) { let mask = original; const calls: number[] = [], failure = new Error("MOCK_GIT_SPAWN_FAILED");
    expect(() => spawnBootstrapChild(request, { umask: next => { calls.push(next); const old = mask; mask = next; return old; },
      spawn: actual => { expect(actual).toBe(request); expect(mask).toBe(0o022); throw failure; } })).toThrow(failure);
    expect(mask).toBe(original); expect(calls).toEqual([0o022, original]);
  }
  child.finish();
});
test("MOCK worker and builder spawn inherit private 0077 without any umask calls, including errors", () => {
  const child = childHarness(), workerArgv = child.request.argv, builderArgv = [B, "--no-env-file", "--no-install", `${S}/tooling/build-reference.ts`, `${D}/reference-source`, `${D}/reference-bundles`];
  for (const argv of [workerArgv, builderArgv]) for (const throws of [false, true]) {
    let mask = 0o077, calls = 0; const request = { ...child.request, argv, cwd: argv === builderArgv ? S : H, detached: argv !== builderArgv };
    const invoke = () => spawnBootstrapChild(request, { umask: next => { calls++; const old = mask; mask = next; return old; },
      spawn: actual => { expect(actual).toBe(request); expect(mask).toBe(0o077); if (throws) throw new Error("MOCK_NON_GIT_SPAWN_FAILED"); return child.handle; } });
    if (throws) expect(invoke).toThrow("MOCK_NON_GIT_SPAWN_FAILED"); else expect(invoke()).toBe(child.handle);
    expect(mask).toBe(0o077); expect(calls).toBe(0);
  }
  child.finish();
});
test("MOCK ordinary child supervisor requires natural exit, reap and both real EOFs", async () => {
  const env = childHarness(), pending = boundedBootstrapCommand(env.request, env.io); env.stdout.controller!.enqueue(Buffer.from("out")); env.stderr.controller!.enqueue(Buffer.from("err")); env.finish();
  const r = await pending; expect(r).toMatchObject({ exitCode: 0, exited: true, reaped: true, stdoutEOF: true, stderrEOF: true, forced: false, error: null }); expect(Buffer.from(r.stdout).toString()).toBe("out"); expect(Buffer.from(r.stderr).toString()).toBe("err");
  expect(env.alarms.map(a => a.ms)).toEqual([240000, 245000]); expect(env.kills()).toBe(0); expect(env.unrefs()).toBe(1);
});
for (const stream of ["stdout", "stderr"] as const) test(`MOCK ${stream} overflow retains prefix, kills once and cannot report clean PASS`, async () => {
  const env = childHarness(), pending = boundedBootstrapCommand(env.request, env.io); env[stream].controller!.enqueue(Buffer.from("0123456789")); env.finish(); const r = await pending;
  expect(Buffer.from(r[stream]).toString()).toBe("01234567"); expect(r.error).toBe("OUTPUT_CAP"); expect(r.forced).toBe(true); expect(env.kills()).toBe(1); expect(r.exited).toBe(true); expect(r.stdoutEOF && r.stderrEOF).toBe(true);
});
test("MOCK outer parent timer interrupts a blocked worker until bounded cleanup without fabricating reap", async () => {
  const env = childHarness(), pending = boundedBootstrapCommand(env.request, env.io); await env.flush(); env.setTime(240000); env.alarms[0]!.fire(); await env.flush();
  expect(env.kills()).toBe(1); env.setTime(245000); env.alarms[1]!.fire(); const r = await pending;
  expect(r).toMatchObject({ forced: true, exited: false, reaped: false, stdoutEOF: false, stderrEOF: false }); expect(r.error).toContain("COMMAND_DEADLINE"); expect(env.kills()).toBe(1);
  env.exit(0); await env.flush(); expect(r.reaped).toBe(false);
});
for (const mode of ["missing-eof", "missing-exit", "kill-error", "pipe-error"]) test(`MOCK child lifecycle ${mode} remains uncertain after cleanup`, async () => {
  const env = childHarness(); if (mode === "kill-error") env.handle.kill = () => { throw new Error("MOCK_KILL_UNCONFIRMED"); };
  const pending = boundedBootstrapCommand(env.request, env.io);
  if (mode === "missing-eof") env.exit(0);
  if (mode === "missing-exit") { env.stdout.controller!.close(); env.stderr.controller!.close(); }
  if (mode === "pipe-error") env.stdout.controller!.error(new Error("MOCK_PIPE_FAILED"));
  await env.flush(); env.setTime(240000); env.alarms[0]!.fire(); env.setTime(245000); env.alarms[1]!.fire(); const r = await pending;
  expect(r.forced).toBe(true); expect(r.error).not.toBeNull(); if (mode === "missing-eof") { expect(r.reaped).toBe(true); expect(r.stdoutEOF).toBe(false); }
  if (mode === "missing-exit") { expect(r.stdoutEOF && r.stderrEOF).toBe(true); expect(r.reaped).toBe(false); }
  if (mode === "kill-error") expect(r.error).toContain("MOCK_KILL_UNCONFIRMED");
});
test("MOCK non-finite clock, invalid caps and deadline extension reject before spawn", async () => {
  for (const change of [{ now: () => NaN }, { now: () => Infinity }, { stdoutBytes: MIB + 1 }, { stderrBytes: 0 }, { cleanupDeadlineMs: 245001 }, { deadlineMs: 0 }]) {
    const env = childHarness(); let spawned = 0; env.io.spawn = () => { spawned++; return env.handle; };
    const r = await boundedBootstrapCommand({ ...env.request, ...change }, env.io); expect(r.error).not.toBeNull(); expect(spawned).toBe(0);
  }
});
test("MOCK child supervision latches regressing clock and preserves partial output on nonzero exit", async () => {
  const backward = childHarness(); let ticks = 0; backward.request.now = () => ticks++ ? 9 : 10; const r = await boundedBootstrapCommand(backward.request, backward.io); expect(r.error).toContain("CLOCK"); expect(r.forced).toBe(true);
  const env = childHarness(), pending = boundedBootstrapCommand(env.request, env.io); env.stdout.controller!.enqueue(Buffer.from("partial")); env.stdout.controller!.close(); env.stderr.controller!.close(); env.exit(2);
  const nonzero = await pending; expect(nonzero.exitCode).toBe(2); expect(Buffer.from(nonzero.stdout).toString()).toBe("partial"); expect(nonzero.reaped).toBe(true); expect(env.kills()).toBe(1); expect(nonzero.error).toBe("CHILD_EXIT");
});
test("MOCK signal-only exit and detach cleanup uncertainty cannot become clean success", async () => {
  const signalled = childHarness(); signalled.handle.signal = () => "SIGKILL"; const pending = boundedBootstrapCommand(signalled.request, signalled.io); signalled.finish();
  const r = await pending; expect(r.signal).toBe("SIGKILL"); expect(r.forced).toBe(true); expect(signalled.kills()).toBe(1);
  const env = childHarness(); env.handle.unref = () => { throw new Error("MOCK_UNREF_FAILED"); }; const other = boundedBootstrapCommand(env.request, env.io); env.finish();
  const failed = await other; expect(failed.forced).toBe(true); expect(failed.error).toContain("MOCK_UNREF_FAILED");
});
