// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import { bindingsShape } from "../../packages/contracts/src/training-state";
import { modelConfigShape } from "../../packages/contracts/src/learning-channel";
import type { ByteRef, TrainingBindings } from "../../packages/contracts/src/training-state";
import type { NativeObservation, NativeObserver } from "../../packages/runtime/src/fixed-attempt";
import type { NativeRecord } from "../../packages/runtime/src/training-store";
import type { RecordedCorpus } from "../../packages/runtime/src/corpus";
import type { StrategicApi } from "../../packages/runtime/src/strategic";
import type { AttemptSetup } from "../../packages/runtime/src/training-coordinator";
import type { observeCanonical } from "./qualification";
import type { R4Coordinator, R4Input, R4Observation } from "./r4-observation";
import type { QualificationReadback, checkQualificationEvidence } from "./qualification-evidence";

const H = "/home/gu1lty/Projects/proveo/chess-coach", K = `${H}/_work/gpu-owner-recovery/cache`;
const ROOT = `${H}/_work/gpu-owner-recovery/runs/training-qualification-1`;
const INPUTS = `${H}/_work/gpu-owner-recovery/runs/training-qualification-inputs-1`;
const ENTRY = "artifacts/training-functional/qualification-operator.ts";
const IMAGE = "docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb";
const GPU = "GPU-713c95e0-6952-a576-794b-9ef1fb527ff0", BUN = `${K}/host-gpu-native-build-1/bun`;
const MIB = 1048576, SCOPE = "QUALIFICATION_PACKET_OBSERVATION_NOT_FUNCTIONAL_ACCEPTANCE";
export const QUALIFICATION_LIMITS = Object.freeze({ outerMs: 800000, cleanupMs: 30000, queryMs: 1000,
  intervalMs: 2000, maxAgeMs: 4000, queries: 401, admissionMiB: 3072, runningMiB: 2048,
  dockerCommands: 7, nativeEvents: 800, nativeBytes: 1024 * MIB, reportBytes: MIB, readbackAndReceiptMs: 60000 });
export const BINDING_ROLES = Object.freeze(["source", "tests", "closure", "dependencyLock", "image", "runtimeConfiguration",
  "coreRules", "strategicSource", "corpusManifest", "corpusSource", "recipe", "featureLayout", "fixtureManifest", "hostConfiguration"] as const);
type Row = ByteRef & { path: string };
export type BindingDocument = { role: keyof TrainingBindings; source: Row; futurePath: string };
export type PreparedInputManifest = { version: "chess-coach.qualification-inputs.v1";
  documents: BindingDocument[]; source: Row[]; reference: Row[] };
export const REFERENCE_FILES: readonly Row[] = Object.freeze([
  ["packages/starchess-arena/src/challenge/admission.ts", 77587, "50255867609e615113aa7dbb1e9d315b7194494a03219b5d9b3aaff737889c26"],
  ["packages/starchess-arena/src/challenge/corpus.ts", 81433, "9a59255f598343896d1d42d8566cb4facdbfa7354e673d0c4e3adcf6fd3d431c"],
  ["packages/starchess-arena/src/challenge/r3Session.ts", 315327, "f22b0322b03400a14fe1fc41af3091610d2d5ad60169e1f67df1a4e396d431e3"],
  ["packages/starchess-arena/src/players/strategic.ts", 115300, "f48eb1a6016202272d609f373718c33ca2f4dba13b7d9ebe7499be4960b36499"],
  ["packages/starchess-arena/src/run/bank.ts", 51664, "f03b36d791e4d68d3784b6702b83c1b85ede43ea8ab38b94ee779cffe98ef1c6"],
  ["packages/starchess-core/src/index.ts", 297812, "5b7e795c733da1f6ffadbe04c0c1a9763b52933de0cd44e547eae8bf3c787024"],
  ["_spec/corpora/ml-adjutant-corpus.manifest.json", 7309, "31ac6f865340a95f8e85c2c1577aaea0aada87feb92a37637cda90aee288cc3f"],
  ["starchess-match-history-20260929-203446.json", 664540, "e6770cb032aa76dc05432c7a49e61c4905d1a1f7b859aa860a090821213e7ae6"],
  ["selected-reference.json", 103663, "09cd6b6dd97fd1b3984b71b5f0d3f540e21b38285897062148e16c0e388fc45a"],
].map(([path, byteLength, sha256]) => Object.freeze({ path: String(path), byteLength: Number(byteLength), sha256: String(sha256) })));
export function qualificationInputManifest(bindings: { scope: string; documents: BindingDocument[] }, sourcePayload: readonly Row[]): PreparedInputManifest {
  check(bindings.scope === "FOURTEEN_ACTUAL_DOCUMENT_REFS_NOT_STAGED_NOT_EXECUTION_AUTHORITY", "BINDING_DOCUMENT_SCOPE");
  return { version: "chess-coach.qualification-inputs.v1", documents: structuredClone(bindings.documents), source: structuredClone([...sourcePayload]), reference: REFERENCE_FILES.map(row => ({ ...row })) };
}
export function qualificationPlan() {
  const ro = (source: string, target: string) => ({ source, target, readonly: true });
  return { scope: SCOPE, qualified: false, trainingReady: false, delivery: "INPUTS_PENDING", host: H, cachedBun: BUN,
    root: ROOT, inputs: INPUTS, source: `${INPUTS}/app`, reference: `${INPUTS}/reference`, documents: `${INPUTS}/qualification-inputs`,
    sourcePreparation: "LATER_FRESH_SOURCE_PIN_MANIFEST_CODE_PAYLOAD_ZOD_4.6.7_WORKSPACE_ALIASES_EXECUTABLE_STAGED_ADAPTERS",
    inputManifestPreparation: "PURE_qualificationInputManifest_BINDING_DOCUMENTS_PLUS_PHYSICAL_SOURCE_ROWS_THEN_SEPARATE_MANUAL_STAGING",
    sourceMountpoints: ["app/reference", "app/qualification-inputs"],
    referencePreparation: "DELIVERY_PENDING_SEPARATE_APPROVAL_NO_ACQUISITION_OR_BUILD_HERE",
    rootPolicy: "MUST_BE_ABSENT_EXCLUSIVE_CREATE_NO_RETRY_NO_ADOPTION", limits: QUALIFICATION_LIMITS,
    image: IMAGE, gpu: GPU, reservation: false, commandCount: { natural: 4, withStopAndKill: 6, maximum: 7 },
    watchdogScope: "ORDINARY_CHILD_WATCHDOG_NOT_STRICT_ESCAPED_OS_CONTAINMENT_OR_FULL_HARDENING",
    mounts: [ro(`${INPUTS}/app`, "/app"), ro(`${INPUTS}/reference`, "/app/reference"), ro(`${INPUTS}/qualification-inputs`, "/app/qualification-inputs"),
      ro(BUN, "/usr/local/bin/bun"), ...["score", "channel"].flatMap(kind => [
        ro(`${K}/host-gpu-native-build-1/native/target-gpu/x86_64-unknown-linux-gnu/release/policy-${kind}`, `/opt/retained-gpu/policy-${kind}`),
        ro(`${INPUTS}/app/artifacts/training-functional/qualification-policy-${kind}.ts`, `/usr/local/bin/policy-${kind}`)]),
      ro(`${K}/host-cpu39-1/native/target-cpu/x86_64-unknown-linux-gnu/release/policy-initialize`, "/usr/local/bin/policy-initialize"),
      ro(`${K}/host-receive-2/context/gpu-build/llvm`, "/opt/tracel-data/tracel/tracel-llvm-23.1.0-4"),
      ro(`${K}/host-receive-2/context/gpu-runtime/rootfs/usr/local/cuda`, "/usr/local/cuda"),
      ...[["state", "/state"], ["tmp", "/tmp"], ["home", "/scratch/home"], ["evidence", "/evidence"]].map(([name, target]) => ({ source: `${ROOT}/${name}`, target: target!, readonly: false }))],
  } as const;
}
export type Context = { cwd: string; realpath: string; executable: string; entrypoint: string };
export type CommandLimits = { deadlineMs: number; cleanupDeadlineMs: number; stdoutBytes: number; stderrBytes: number; now: () => number };
export type CommandResult = { stdout: Uint8Array; stderr: Uint8Array; exitCode: number | null; signal: string | null;
  exited: boolean; reaped: boolean; stdoutEOF: boolean; stderrEOF: boolean; forced: boolean; error: string | null };
export type QualificationIO = {
  now(): number; alarm(ms: number, callback: () => void): () => void; wait(ms: number): Promise<void>;
  context(): Promise<Context>; read(path: string, cap: number): Promise<Uint8Array>; write(path: string, bytes: Uint8Array): Promise<void>;
  command(argv: readonly string[], limits: CommandLimits): Promise<CommandResult>;
};
export type OperatorIO = QualificationIO & { absent(path: string): Promise<void>; mkdir(path: string): Promise<void>;
  requirePath(path: string, kind: "directory" | "executable"): Promise<void>; alias(path: string, target: string): Promise<void> };
type Canonical = Awaited<ReturnType<typeof observeCanonical>>;
type Evidence = ReturnType<typeof checkQualificationEvidence>;
export type WorkerIO = QualificationIO & Pick<OperatorIO, "alias"> & {
  writeChunks(path: string, chunks: Iterable<Uint8Array>): Promise<void>;
  observeCanonical(input: Parameters<typeof observeCanonical>[0]): Promise<Canonical>;
  loadCorpus(): Promise<RecordedCorpus>; loadStrategic(): Promise<StrategicApi>;
  createCoordinator(root: string, bindings: TrainingBindings): R4Coordinator;
  createFactory(corpus: RecordedCorpus, strategic: StrategicApi, layout: undefined, observer: NativeObserver): { create: AttemptSetup };
  observeR4(input: R4Input): Promise<R4Observation>; readback(root: string): QualificationReadback;
  checkEvidence(input: Parameters<typeof checkQualificationEvidence>[0]): Evidence;
};
export const WORKER_INPUT = Object.freeze({ app: "/app", reference: "/app/reference", documents: "/app/qualification-inputs" });
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const encode = (value: unknown) => Buffer.from(JSON.stringify(value, (_, v: unknown) => typeof v === "bigint" ? String(v) : v instanceof Error ? { name: v.name, message: v.message } : v) + "\n");
const decode = <T>(bytes: Uint8Array): T => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as T;
const text = (bytes: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
function check(value: unknown, code: string): asserts value { if (!value) throw new Error(`Qualification: ${code}`); }
function clock(io: Pick<QualificationIO, "now">) {
  let last = -1, failed = false;
  return () => { try { const value = io.now(); if (failed || typeof value !== "number" || !Number.isFinite(value) || value < 0 || value < last) throw new Error("Qualification: CLOCK"); last = value; return value; }
    catch (error) { failed = true; throw error; } };
}
async function within<T>(io: Pick<QualificationIO, "alarm">, now: () => number, end: number, action: () => Promise<T>): Promise<T> {
  check(now() < end, "DEADLINE"); let cancel = () => {};
  try { const result = await Promise.race([action(), new Promise<never>((_, reject) => { cancel = io.alarm(Math.max(0, end - now()), () => reject(new Error("Qualification: DEADLINE"))); })]); check(now() < end, "DEADLINE"); return result; }
  finally { cancel(); }
}
function clean(result: CommandResult): boolean { return result.exited && result.reaped && result.stdoutEOF && result.stderrEOF && result.exitCode === 0 && result.signal === null && !result.forced && result.error === null; }
function safe(path: string): string { check(typeof path === "string" && path.length <= 512 && !/[\\\0,]/.test(path) && path.split("/").every(p => p && p !== "." && p !== ".."), "INPUT_PATH"); return path; }
function row(value: Row): void { safe(value.path); check(Number.isSafeInteger(value.byteLength) && value.byteLength > 0 && value.byteLength <= 16 * MIB && /^[a-f0-9]{64}$/.test(value.sha256), "INPUT_REF"); }
async function retainedWrite(io: Pick<QualificationIO, "write">, path: string, value: unknown, cap = MIB): Promise<void> { const bytes = encode(value); check(bytes.byteLength <= cap, "EVIDENCE_BOUND"); await io.write(path, bytes); }
export async function validateQualificationInputs(io: Pick<OperatorIO, "read" | "alias">, roots: { app: string; reference: string; documents: string }): Promise<TrainingBindings> {
  const manifest = decode<PreparedInputManifest>(await io.read(`${roots.documents}/input-manifest.json`, 8 * MIB));
  check(manifest.version === "chess-coach.qualification-inputs.v1" && Array.isArray(manifest.documents) && manifest.documents.length === 14, "INPUTS_NOT_PREPARED");
  const bindings: Partial<TrainingBindings> = {}, seen = new Set<string>(); let documentBytes = 0;
  for (const item of manifest.documents) {
    check(BINDING_ROLES.includes(item.role) && !seen.has(item.role) && item.futurePath === `/app/qualification-inputs/${item.role}.bin`, "BINDING_MEMBERSHIP"); seen.add(item.role);
    row(item.source); check(item.source.byteLength <= 8 * MIB && (documentBytes += item.source.byteLength) <= 16 * MIB, "BINDING_BOUND");
    const bytes = await io.read(`${roots.documents}/${item.role}.bin`, item.source.byteLength);
    check(bytes.byteLength === item.source.byteLength && sha(bytes) === item.source.sha256, "BINDING_HASH"); bindings[item.role] = { byteLength: bytes.byteLength, sha256: sha(bytes) };
  }
  check(Array.isArray(manifest.source) && manifest.source.length > 0 && manifest.source.length <= 4096 && Array.isArray(manifest.reference), "PHYSICAL_MANIFEST");
  check(manifest.reference.length === REFERENCE_FILES.length && REFERENCE_FILES.every(pin => manifest.reference.some(r => r.path === pin.path && r.byteLength === pin.byteLength && r.sha256 === pin.sha256)), "REFERENCE_PINS");
  for (const [root, rows] of [[roots.app, manifest.source], [roots.reference, manifest.reference]] as const) {
    const paths = new Set<string>(); let total = 0;
    for (const item of rows) { row(item); check(!paths.has(item.path) && (total += item.byteLength) <= 128 * MIB, "PHYSICAL_MEMBERSHIP"); paths.add(item.path);
      const bytes = await io.read(`${root}/${item.path}`, item.byteLength); check(bytes.byteLength === item.byteLength && sha(bytes) === item.sha256, "PHYSICAL_HASH"); }
  }
  const required = [ENTRY, "qualification.ts", "r4-observation.ts", "qualification-evidence.ts", "qualification-policy-score.ts", "qualification-policy-channel.ts"].map(p => p.includes("/") ? p : `artifacts/training-functional/${p}`);
  required.push("node_modules/zod/package.json", "packages/runtime/src/fixed-attempt.ts", "packages/runtime/src/training-coordinator.ts");
  check(required.every(path => manifest.source.some(r => r.path === path)), "SOURCE_PAYLOAD");
  const zod = decode<{ name: string; version: string }>(await io.read(`${roots.app}/node_modules/zod/package.json`, 65536));
  check(zod.name === "zod" && zod.version === "4.6.7", "PHYSICAL_ZOD");
  for (const name of ["contracts", "policy", "starchess-core"]) await io.alias(`${roots.app}/node_modules/@chess-coach/${name}`, `${roots.app}/packages/${name}`);
  return bindingsShape.parse(bindings);
}
export function createQualificationTrace(limits: { events: number; bytes: number } = { events: QUALIFICATION_LIMITS.nativeEvents, bytes: QUALIFICATION_LIMITS.nativeBytes }) {
  check(Number.isSafeInteger(limits.events) && limits.events > 0 && limits.events <= 800 && Number.isSafeInteger(limits.bytes) && limits.bytes > 0 && limits.bytes <= QUALIFICATION_LIMITS.nativeBytes, "TRACE_LIMIT");
  const events: NativeObservation[] = []; let bytes = 0, failed = false;
  const observe: NativeObserver = event => { const size = encode(event).byteLength;
    if (failed || events.length >= limits.events || bytes + size > limits.bytes) { failed = true; throw new Error("Qualification: TRACE_BOUND"); }
    events.push(structuredClone(event)); bytes += size;
  };
  return { events, observe, get failed() { return failed; }, bytes: () => bytes };
}
export type WorkerReport = { scope: typeof SCOPE; qualified: false; trainingReady: false; status: "PASS" | "FAIL"; failures: string[];
  canonical: "PASS" | "FAIL" | null; r4: "PASS" | "FAIL" | null; functional: Evidence["status"] | null; rawQualified: false;
  nativeTrace: "COMPLETE" | "INCOMPLETE_EVIDENCE" };
export async function runQualificationWorker(input: typeof WORKER_INPUT, io: WorkerIO): Promise<WorkerReport> {
  const now = clock(io), clockNs = () => BigInt(Math.floor(now() * 1000000)), trace = createQualificationTrace();
  const report: WorkerReport = { scope: SCOPE, qualified: false, trainingReady: false, status: "FAIL", failures: [], canonical: null, r4: null, functional: null, rawQualified: false, nativeTrace: "COMPLETE" };
  let canonical: Canonical | null = null, r4: R4Observation | null = null, acquired = false;
  let receiptEnd: number | null = null, receiptExpired = false, expiry: Promise<never> | null = null, cancelReceipt = () => {};
  const failure = (error: unknown) => { report.status = "FAIL"; report.failures.push(String(error).slice(0, 4096)); };
  const beginReceipt = () => {
    if (receiptEnd !== null) return; receiptEnd = now() + QUALIFICATION_LIMITS.readbackAndReceiptMs;
    expiry = new Promise<never>((_, reject) => { cancelReceipt = io.alarm(Math.max(0, receiptEnd! - now()), () => { receiptExpired = true; reject(new Error("Qualification: READBACK_RECEIPT_DEADLINE")); }); });
    void expiry.catch(() => {});
  };
  const receiptCheck = () => { beginReceipt(); check(!receiptExpired && now() < receiptEnd!, "READBACK_RECEIPT_DEADLINE"); };
  const output = async (action: () => Promise<void>) => { receiptCheck(); await Promise.race([action(), expiry!]); receiptCheck(); };
  try {
    check(input.app === "/app" && input.reference === "/app/reference" && input.documents === "/app/qualification-inputs", "WORKER_INPUT");
    const context = await io.context(); check(context.cwd === "/app" && context.realpath === "/app" && context.executable === "/usr/local/bin/bun" && context.entrypoint === `/app/${ENTRY}`, "WORKER_CONTEXT");
    const bindings = await validateQualificationInputs(io, input); acquired = true;
    canonical = await io.observeCanonical({ sessionId: "qualification-canonical-1", clockNs }); report.canonical = canonical.status;
    check(canonical.status === "PASS", "CANONICAL_FAILED");
    const start = now(), initialized = await io.command(["/usr/local/bin/policy-initialize", "101"], { deadlineMs: start + 10000, cleanupDeadlineMs: start + 11000, stdoutBytes: MIB, stderrBytes: 65536, now });
    await retainedWrite(io, "/evidence/initializer.json", { ...initialized, stdout: undefined, stderr: text(initialized.stderr) });
    check(clean(initialized) && initialized.stdout.byteLength > 0 && initialized.stdout.byteLength <= MIB, "INITIALIZER");
    const initialRecord: NativeRecord = { record: Uint8Array.from(initialized.stdout), config: modelConfigShape.parse({ version: "chess-coach.model-config.v1", architecture: "mlp-relu-32",
      featureVersion: "chess-coach.features.v1", inputFeatures: 2271, hiddenUnits: 32, recordSha256: sha(initialized.stdout) }) };
    await io.write("/evidence/initial-native.bin", initialRecord.record); await retainedWrite(io, "/evidence/initial-config.json", initialRecord.config);
    const preparationEnd = now() + 10000;
    const [corpus, strategic] = await within(io, now, preparationEnd, () => Promise.all([io.loadCorpus(), io.loadStrategic()])); check(now() < preparationEnd, "PREPARATION_DEADLINE");
    const factory = io.createFactory(corpus, strategic, undefined, trace.observe), coordinator = io.createCoordinator("/state/run", bindings);
    const close = coordinator.close.bind(coordinator); let closeCalls = 0, closed = false;
    coordinator.close = async () => { check(++closeCalls === 1, "CLOSE_COUNT"); await close(); closed = true; };
    let observed = false;
    try { check(now() < preparationEnd, "PREPARATION_DEADLINE"); observed = true;
      r4 = await io.observeR4({ coordinator, initialRecord, createOwned: factory.create, clockNs }); report.r4 = r4.status; }
    finally { const missedClose = closeCalls === 0; if (missedClose) await coordinator.close(); beginReceipt(); if (observed && missedClose) throw new Error("Qualification: OBSERVER_CLOSE_CONTRACT"); }
    check(closeCalls === 1 && closed && r4.close.status === "PASS", "COORDINATOR_CLOSE"); check(!trace.failed, "INCOMPLETE_NATIVE_TRACE_EVIDENCE");
    receiptCheck(); const readback = io.readback("/state/run"); receiptCheck();
    const functional = io.checkEvidence({ canonical, r4, native: trace.events, readback }); receiptCheck(); report.functional = functional.status;
    await output(() => retainedWrite(io, "/evidence/functional-evidence.json", functional));
    check(canonical.status === "PASS" && r4.status === "PASS" && functional.status === "PASS_RETAINED_FUNCTIONAL_EVIDENCE", "FUNCTIONAL_EVIDENCE"); report.status = "PASS";
  } catch (error) { failure(error); }
  finally {
    if (acquired) {
      if (trace.failed) report.nativeTrace = "INCOMPLETE_EVIDENCE";
      for (const [name, value, cap] of [["canonical.json", canonical, MIB], ["r4.json", r4, MIB]] as const) {
        try { await output(() => retainedWrite(io, `/evidence/${name}`, value, cap)); } catch (error) { failure(error); }
      }
      function* chunks() { let total = 0; for (const event of trace.events) { receiptCheck(); const bytes = encode(event); total += bytes.byteLength; check(total <= QUALIFICATION_LIMITS.nativeBytes, "INCOMPLETE_NATIVE_TRACE_EVIDENCE"); yield bytes; } }
      try { await output(() => io.writeChunks("/evidence/native.ndjson", chunks())); }
      catch (error) { report.nativeTrace = "INCOMPLETE_EVIDENCE"; failure(error); }
      try { await output(() => retainedWrite(io, "/evidence/worker-report.json", report)); } catch (error) { failure(error); }
    }
    cancelReceipt();
  }
  return report;
}
export const GPU_QUERY = Object.freeze(["nvidia-smi", "--id", GPU, "--query-gpu=uuid,memory.free", "--format=csv,noheader,nounits"]);
const DOCKER = ["docker", "--host=unix:///var/run/docker.sock"];
export function qualificationDockerCreate(): string[] {
  const plan = qualificationPlan();
  return [...DOCKER, "create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=1000:1000", "--runtime=nvidia", `--gpus=device=${GPU}`,
    "--workdir=/app", "--env=PATH=/usr/local/bin:/usr/bin:/bin", "--env=HOME=/scratch/home", "--env=TMPDIR=/tmp", "--env=RAYON_NUM_THREADS=2", "--env=BUN_RUNTIME_TRANSPILER_CACHE_PATH=0",
    ...plan.mounts.flatMap(m => ["--mount", `type=bind,src=${m.source},dst=${m.target}${m.readonly ? ",readonly" : ""}`]), IMAGE,
    "/usr/local/bin/bun", "--no-env-file", "--no-install", `/app/${ENTRY}`, "worker"];
}
export type OperatorReport = { scope: typeof SCOPE; status: "PASS" | "FAIL"; qualified: false; trainingReady: false; originMs: number; deadlineMs: number;
  cid: string | null; aborted: boolean; queries: number; commands: { argv: readonly string[]; result: Omit<CommandResult, "stdout" | "stderr"> & { stdout: string; stderr: string } }[];
  failures: string[]; cleanup: "NOT_ACQUIRED" | "UNCONFIRMED" | "REMOVED"; elapsedMs: number };
export async function runQualificationOperator(io: OperatorIO): Promise<OperatorReport> {
  const now = clock(io); let origin = 0;
  const report: OperatorReport = { scope: SCOPE, status: "FAIL", qualified: false, trainingReady: false, originMs: 0, deadlineMs: 0, cid: null,
    aborted: false, queries: 0, commands: [], failures: [], cleanup: "NOT_ACQUIRED", elapsedMs: 0 };
  let acquired = false, done = false, forced = false, commandCount = 0, stopAttempted = false;
  let end = 0, workEnd = 0, queryAt = 0;
  const command = async (argv: readonly string[], deadline: number, cleanup: number, cap = 65536) => {
    check(now() < deadline && cleanup <= end, "OUTER_DEADLINE");
    if (argv[0] === "docker") check(++commandCount <= 7, "DOCKER_COMMAND_CAP");
    const result = await io.command(argv, { deadlineMs: deadline, cleanupDeadlineMs: cleanup, stdoutBytes: cap, stderrBytes: 65536, now });
    check(result.stdout.byteLength <= cap && result.stderr.byteLength <= 65536, "COMMAND_BOUND");
    report.commands.push({ argv, result: { ...result, stdout: text(result.stdout), stderr: text(result.stderr) } }); return result;
  };
  const query = async (minimum: number) => {
    check(report.queries < 401, "GPU_QUERY_CAP"); report.queries++;
    const started = now(), deadline = Math.min(started + 1000, workEnd);
    const result = await command(GPU_QUERY, deadline, Math.min(deadline + 1000, end), 4096);
    check(clean(result) && now() - started <= 1000, "GPU_QUERY_FAILED_OR_STALE");
    const match = text(result.stdout).match(/^(GPU-[a-f0-9-]+),\s*([0-9]+)\s*\n?$/);
    check(match && match[1] === GPU && Number.isSafeInteger(Number(match[2])) && Number(match[2]) * MIB >= minimum * MIB, "GPU_FREE_POLICY"); queryAt = started;
  };
  const stopOwned = async () => {
    if (report.cid === null || stopAttempted) return; stopAttempted = true; forced = true;
    const until = () => Math.min(now() + 5000, end - 2000);
    try { const stopped = await command([...DOCKER, "stop", "--time=2", report.cid], until(), Math.min(now() + 6000, end - 1000)); if (clean(stopped)) return; }
    catch (error) { report.failures.push(String(error).slice(0, 4096)); }
    try { const killed = await command([...DOCKER, "kill", report.cid], until(), Math.min(now() + 6000, end - 1000)); check(clean(killed), "OWNED_KILL_UNCONFIRMED"); }
    catch (error) { report.failures.push(String(error).slice(0, 4096)); }
  };
  try {
    origin = now(); end = origin + 800000; workEnd = end - 30000; report.originMs = origin; report.deadlineMs = end;
    const context = await within(io, now, workEnd, () => io.context());
    check(context.cwd === H && context.realpath === H && context.executable === BUN && context.entrypoint === `${INPUTS}/app/${ENTRY}`, "OPERATOR_CONTEXT");
    await within(io, now, workEnd, async () => {
      await io.absent(ROOT); await validateQualificationInputs(io, { app: `${INPUTS}/app`, reference: `${INPUTS}/reference`, documents: `${INPUTS}/qualification-inputs` });
      for (const kind of ["score", "channel"]) await io.requirePath(`${INPUTS}/app/artifacts/training-functional/qualification-policy-${kind}.ts`, "executable");
      for (const name of ["reference", "qualification-inputs"]) await io.requirePath(`${INPUTS}/app/${name}`, "directory");
      for (const mount of qualificationPlan().mounts.filter(m => m.readonly && !m.source.startsWith(INPUTS))) await io.requirePath(mount.source, [BUN, "policy-score", "policy-channel", "policy-initialize"].some(p => mount.source.endsWith(p)) ? "executable" : "directory");
    });
    await query(3072); check(now() - queryAt <= 4000, "GPU_ADMISSION_STALE");
    await io.mkdir(ROOT); acquired = true;
    for (const name of ["state", "tmp", "home", "evidence"]) await io.mkdir(`${ROOT}/${name}`);
    check(now() - queryAt <= 4000, "GPU_ADMISSION_STALE");
    const created = await command(qualificationDockerCreate(), Math.min(now() + 10000, workEnd), Math.min(now() + 11000, end), 4096);
    const raw = text(created.stdout); check(/^[a-f0-9]{64}\n?$/.test(raw), "OWNED_CID_UNCONFIRMED"); report.cid = raw.trim(); report.cleanup = "UNCONFIRMED";
    check(clean(created), "DOCKER_CREATE"); check(now() - queryAt <= 4000, "GPU_ADMISSION_STALE");
    let finished!: () => void; const completion = new Promise<void>(resolve => { finished = resolve; });
    const running = command([...DOCKER, "start", "-a", report.cid], workEnd, workEnd + 1000, MIB).finally(() => { done = true; finished(); });
    const monitor = (async () => {
      try { while (!done) {
        await Promise.race([io.wait(2000), completion]); if (done) return;
        check(now() - queryAt <= 4000 && now() < workEnd, "GPU_MONITOR_STALE_OR_DEADLINE"); await query(2048);
      } } catch (error) { report.aborted = true; throw error; }
    })();
    try { await Promise.race([running, monitor]); const result = await running; check(clean(result), "CONTAINER_NOT_NATURAL_ZERO"); }
    catch (error) { report.aborted = true; report.failures.push(String(error).slice(0, 4096)); await stopOwned(); try { await running; } catch {} }
    finally { done = true; finished(); await monitor.catch(() => {}); }
    check(!report.aborted && !forced, "OPERATOR_ABORTED");
  } catch (error) { report.aborted = true; report.failures.push(String(error).slice(0, 4096)); if (report.cid !== null) await stopOwned(); }
  finally {
    if (report.cid !== null) {
      try {
        const inspected = await command([...DOCKER, "inspect", "--format={{json .State}}", report.cid], Math.min(now() + 5000, end - 2000), Math.min(now() + 6000, end - 1000));
        check(clean(inspected), "INSPECT_UNCONFIRMED"); const state = decode<{ Running: boolean; ExitCode: number; OOMKilled: boolean; Dead: boolean; Error: string; Status: string }>(inspected.stdout);
        if (state.Running) { report.aborted = true; await stopOwned(); }
        check(state.Running === false && state.Status === "exited" && state.ExitCode === 0 && state.OOMKilled === false && state.Dead === false && state.Error === "" && !forced && !report.aborted, "FINAL_CONTAINER_STATE");
        const worker = decode<WorkerReport>(await io.read(`${ROOT}/evidence/worker-report.json`, MIB));
        const evidence = decode<Evidence>(await io.read(`${ROOT}/evidence/functional-evidence.json`, MIB));
        check(worker.scope === SCOPE && worker.status === "PASS" && worker.qualified === false && worker.trainingReady === false && worker.rawQualified === false && worker.canonical === "PASS" && worker.r4 === "PASS" && worker.functional === "PASS_RETAINED_FUNCTIONAL_EVIDENCE" && worker.failures.length === 0 &&
          evidence.status === "PASS_RETAINED_FUNCTIONAL_EVIDENCE" && evidence.scope === "INPUTS_UNATTESTED_FUNCTIONAL_EVIDENCE_ONLY" && evidence.qualified === false && evidence.failures.length === 0, "RETAINED_FUNCTIONAL_CHECK"); report.status = "PASS";
      } catch (error) { report.aborted = true; report.failures.push(String(error).slice(0, 4096)); await stopOwned(); }
      try { const removed = await command([...DOCKER, "rm", report.cid], Math.min(now() + 5000, end - 1000), end); check(clean(removed), "REMOVE_UNCONFIRMED"); report.cleanup = "REMOVED"; }
      catch (error) { report.failures.push(String(error).slice(0, 4096)); }
    }
    try { report.elapsedMs = now() - origin; check(now() < end, "OUTER_DEADLINE"); } catch (error) { report.failures.push(String(error).slice(0, 4096)); }
    if (report.failures.length) report.status = "FAIL";
    if (acquired) { try { await within(io, now, end, () => retainedWrite(io, `${ROOT}/evidence/operator-report.json`, report)); } catch (error) { report.status = "FAIL"; report.failures.push(String(error).slice(0, 4096)); } }
  }
  return report;
}

async function parents(path: string): Promise<void> {
  for (let p = dirname(path); ; p = dirname(p)) { const value = await fs.lstat(p); check(value.isDirectory() && !value.isSymbolicLink(), "PHYSICAL_PARENT"); if (p === dirname(p)) return; }
}
async function readPhysical(path: string, cap: number): Promise<Uint8Array> {
  await parents(path); const file = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try { const a = await file.stat({ bigint: true }); check(a.isFile() && a.size <= BigInt(cap), "REGULAR_FILE_BOUND"); const bytes = Buffer.alloc(Number(a.size) + 1); let size = 0;
    for (;;) { const { bytesRead } = await file.read(bytes, size, bytes.length - size, null); if (!bytesRead) break; size += bytesRead; check(size <= Number(a.size), "FILE_GROWTH"); }
    const b = await file.stat({ bigint: true }); check(size === Number(a.size) && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs, "FILE_DRIFT"); return bytes.subarray(0, size);
  } finally { await file.close(); }
}
export async function writeQualificationChunks(path: string, chunks: Iterable<Uint8Array>): Promise<void> {
  await parents(path); const file = await fs.open(path, "wx", 0o600); let total = 0;
  try {
    for (const chunk of chunks) { check(chunk instanceof Uint8Array && (total += chunk.byteLength) <= QUALIFICATION_LIMITS.nativeBytes, "TRACE_WRITE_BOUND");
      for (let offset = 0; offset < chunk.byteLength;) { const { bytesWritten } = await file.write(chunk, offset, chunk.byteLength - offset, null);
        check(Number.isSafeInteger(bytesWritten) && bytesWritten > 0 && bytesWritten <= chunk.byteLength - offset, "SHORT_WRITE"); offset += bytesWritten; }
    }
    await file.sync();
  } finally { await file.close(); }
}
export async function boundedQualificationCommand(argv: readonly string[], limits: CommandLimits): Promise<CommandResult> {
  const result: CommandResult = { stdout: new Uint8Array(), stderr: new Uint8Array(), exitCode: null, signal: null, exited: false, reaped: false, stdoutEOF: false, stderrEOF: false, forced: false, error: null };
  let proc: ReturnType<typeof Bun.spawn> | null = null, cancel = () => {}, cancelled = false;
  let readers: ReadableStreamDefaultReader<Uint8Array>[] = [];
  const streams = [0, 1].map(() => ({ chunks: [] as Uint8Array[], bytes: 0 }));
  const kill = () => { result.forced = true; if (proc) { try { process.kill(-proc.pid, "SIGKILL"); } catch { try { proc.kill("SIGKILL"); } catch (error) { result.error ??= String(error).slice(0, 4096); } } } };
  try {
    check(limits.now() < limits.deadlineMs && limits.deadlineMs <= limits.cleanupDeadlineMs, "COMMAND_DEADLINE");
    proc = Bun.spawn([...argv], { cwd: argv[0] === "/usr/local/bin/policy-initialize" ? "/app" : H, detached: true, stdin: "ignore", stdout: "pipe", stderr: "pipe",
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", DOCKER_CONFIG: "/nonexistent", RAYON_NUM_THREADS: "2", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0" } });
    const active = proc; readers = [(active.stdout as ReadableStream<Uint8Array>).getReader(), (active.stderr as ReadableStream<Uint8Array>).getReader()];
    const drains = readers.map(async (reader, index) => {
      try { for (;;) { const next = await reader.read(); if (next.done) { if (!cancelled) { if (index === 0) result.stdoutEOF = true; else result.stderrEOF = true; } return; }
        const stream = streams[index]!, cap = index === 0 ? limits.stdoutBytes : limits.stderrBytes, take = Math.min(next.value.byteLength, Math.max(0, cap - stream.bytes));
        if (take) stream.chunks.push(Uint8Array.from(next.value.subarray(0, take))); stream.bytes += next.value.byteLength;
        if (stream.bytes > cap) { result.error ??= "OUTPUT_CAP"; kill(); } }
      } catch (error) { result.error ??= String(error).slice(0, 4096); kill(); }
    });
    const exited = active.exited.then(code => { result.exited = true; result.reaped = true; result.exitCode = code; result.signal = active.signalCode === null ? null : String(active.signalCode); });
    cancel = timerIO.alarm(Math.max(0, limits.deadlineMs - limits.now()), () => { result.error ??= "DEADLINE"; kill(); });
    try { await within(timerIO, limits.now, limits.cleanupDeadlineMs, () => Promise.all([exited, ...drains])); }
    catch (error) { result.error ??= String(error).slice(0, 4096); kill(); }
  } catch (error) { result.error ??= String(error).slice(0, 4096); kill(); }
  finally { cancel(); cancelled = true; for (const reader of readers) void reader.cancel().catch(() => {}); proc?.unref(); result.stdout = Buffer.concat(streams[0]!.chunks); result.stderr = Buffer.concat(streams[1]!.chunks); }
  return { ...result };
}
const timerIO = { alarm: (ms: number, callback: () => void) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); } };
function productionIO(): OperatorIO {
  return { now: () => performance.now(), ...timerIO, wait: ms => new Promise(resolve => { setTimeout(resolve, ms); }),
    context: async () => ({ cwd: process.cwd(), realpath: await fs.realpath(process.cwd()), executable: process.execPath, entrypoint: import.meta.path }),
    read: readPhysical, command: boundedQualificationCommand,
    write: async (path, bytes) => { await parents(path); const file = await fs.open(path, "wx", 0o600); try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); } },
    absent: async path => { await parents(path); try { await fs.lstat(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; } throw new Error("Qualification: ROOT_EXISTS"); },
    mkdir: async path => { await parents(path); await fs.mkdir(path, { mode: 0o700 }); },
    requirePath: async (path, kind) => { await parents(path); const value = await fs.lstat(path); check(!value.isSymbolicLink() && (kind === "directory" ? value.isDirectory() : value.isFile() && (value.mode & 0o111) !== 0), "RETAINED_TOOL_PATH"); },
    alias: async (path, target) => { await parents(path); check((await fs.lstat(path)).isSymbolicLink() && await fs.realpath(path) === target, "WORKSPACE_ALIAS"); },
  };
}
async function productionWorkerIO(): Promise<WorkerIO> {
  const [{ observeCanonical }, { observeR4 }, { FixedAttemptFactory }, { TrainingCoordinator }, { loadCapturedCorpus }, { loadCapturedStrategicApi }, evidence] = await Promise.all([
    import("./qualification"), import("./r4-observation"), import("../../packages/runtime/src/fixed-attempt"), import("../../packages/runtime/src/training-coordinator"),
    import("../../packages/runtime/src/corpus"), import("../../packages/runtime/src/strategic"), import("./qualification-evidence")]);
  return { ...productionIO(), writeChunks: writeQualificationChunks, observeCanonical, observeR4, loadCorpus: loadCapturedCorpus, loadStrategic: loadCapturedStrategicApi,
    createFactory: (corpus, strategic, layout, observer) => new FixedAttemptFactory(corpus, strategic, layout, observer),
    createCoordinator: (root, bindings) => new TrainingCoordinator(root, bindings), readback: evidence.readQualificationReadback, checkEvidence: evidence.checkQualificationEvidence };
}
export function qualificationMode(main: boolean, args: readonly string[]): "operator" | "worker" | null { return main && args.length === 1 && (args[0] === "operator" || args[0] === "worker") ? args[0] : null; }
if (import.meta.main) {
  const mode = qualificationMode(true, Bun.argv.slice(2));
  if (mode === null) { console.error("Executor: usage: qualification-operator.ts operator|worker"); process.exitCode = 2; }
  else { try { const report = mode === "operator" ? await runQualificationOperator(productionIO()) : await runQualificationWorker(WORKER_INPUT, await productionWorkerIO()); console.log("Executor: " + JSON.stringify(report)); process.exitCode = report.status === "PASS" ? 0 : 1; }
    catch (error) { console.error("Executor: " + String(error)); process.exitCode = 1; } }
}
