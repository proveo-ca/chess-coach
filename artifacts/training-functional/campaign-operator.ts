// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, renameSync, writeFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { isDeepStrictEqual as same } from "node:util";
import { byteRefShape } from "../../packages/contracts/src/training-state";
import type { ByteRef, TrainingBindings } from "../../packages/contracts/src/training-state";
import { modelConfigShape } from "../../packages/contracts/src/learning-channel";
import { TrainingCampaign } from "../../packages/runtime/src/training-campaign";
import type { CampaignCoordinator } from "../../packages/runtime/src/training-campaign";
import type { RecordedCorpus } from "../../packages/runtime/src/corpus";
import type { StrategicApi } from "../../packages/runtime/src/strategic";
import type { AttemptSetup } from "../../packages/runtime/src/training-coordinator";
import { boundedQualificationCommand, GPU_QUERY, validateQualificationInputs } from "./qualification-operator";
import type { CommandResult, OperatorIO, PreparedInputManifest } from "./qualification-operator";
import { campaignCheck as check, campaignInvocation, campaignPlan, checkCampaignApproval, checkCampaignInvocation,
  CAMPAIGN_ADDITIONS, CAMPAIGN_ENTRY, SELECTED_CAMPAIGN_BUDGET } from "./campaign-plan";
import type { CampaignApproval, CampaignInvocation, CampaignPlan } from "./campaign-plan";
import { openCampaignReadback, validateCampaignResult } from "./campaign-evidence";
import type { CampaignEvidence, CampaignReadback } from "./campaign-evidence";

const MIB = 1048576, DOCKER = ["docker", "--host=unix:///var/run/docker.sock"];
const ref = (bytes: Uint8Array): ByteRef => ({ byteLength: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
const encode = (value: unknown) => Buffer.from(JSON.stringify(value) + "\n");
function json<T>(bytes: Uint8Array, cap = MIB): T {
  check(bytes instanceof Uint8Array && bytes.byteLength > 0 && bytes.byteLength <= cap, "JSON_BOUND");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as T;
}
function clean(r: CommandResult): boolean { return r.exitCode === 0 && r.signal === null && r.exited && r.reaped && r.stdoutEOF && r.stderrEOF && !r.forced && r.error === null; }
export type CampaignRequest = { version: "chess-coach.training-campaign-request.v1" | "chess-coach.training-campaign-request.v2"; plan: CampaignPlan; preparedInputManifest: ByteRef;
  sourceManifest: ByteRef; bindingDocuments: ByteRef; verification: ByteRef; trainingExecutionAuthorized: false; publicationAuthorized: false };
export function decodeCampaignRequest(bytes: Uint8Array): CampaignRequest {
  const request = json<CampaignRequest>(bytes);
  check(request && typeof request === "object" && !Array.isArray(request) && Object.keys(request).sort().join() ===
    ["version", "plan", "preparedInputManifest", "sourceManifest", "bindingDocuments", "verification", "trainingExecutionAuthorized", "publicationAuthorized"].sort().join(), "REQUEST_SCHEMA");
  const generation = request.version === "chess-coach.training-campaign-request.v2" ? 2 : 1;
  check((request.version === "chess-coach.training-campaign-request.v1" || request.version === "chess-coach.training-campaign-request.v2") &&
    request.trainingExecutionAuthorized === false && request.publicationAuthorized === false && request.plan?.budget &&
    same(request.plan, campaignPlan(request.plan.budget, generation)), "REQUEST_PLAN");
  for (const key of ["preparedInputManifest", "sourceManifest", "bindingDocuments", "verification"] as const) byteRefShape.parse(request[key]);
  return request;
}
export type CampaignProgress = { version: "chess-coach.campaign-progress.v1"; phase: "work" | "validation"; completed: number };
type BaseIO = Pick<OperatorIO, "now" | "alarm" | "context" | "read" | "write" | "command" | "alias"> & {
  execution: "MOCK" | "NATIVE"; validateInputs: typeof validateCampaignInputs; capacity(path: string): Promise<CampaignCapacity> };
export type CampaignWorkerIO = BaseIO & { loadCorpus(): Promise<RecordedCorpus>; loadStrategic(): Promise<StrategicApi>;
  createCoordinator(root: string, bindings: TrainingBindings): CampaignCoordinator;
  createFactory(corpus: RecordedCorpus, strategic: StrategicApi): { create: AttemptSetup };
  progress(value: CampaignProgress): void; openReadback(root: string): CampaignReadback; validate: typeof validateCampaignResult };
export type CampaignOperatorIO = OperatorIO & Pick<BaseIO, "validateInputs" | "capacity"> & { execution: "MOCK" | "NATIVE";
  usage(path: string, deadlineMs: number): Promise<number>;
  telemetry(value: { ordinal: number; observedMs: number; freeMiB: number }): void; closeTelemetry(): void };
export type CampaignCapacity = { type: bigint; bsize: bigint; bavail: bigint; files: bigint; ffree: bigint };
const CAPACITY_KEYS = ["type", "bsize", "bavail", "files", "ffree"] as const;
export function assessCampaignStorage(plan: CampaignPlan, capacity: CampaignCapacity) {
  check(plan.budget && capacity && CAPACITY_KEYS.every(key => typeof capacity[key] === "bigint"), "CAPACITY_SCHEMA");
  const usableBytes = capacity.bsize > 0n && capacity.bavail >= 0n ? capacity.bsize * capacity.bavail : null;
  const freeEntries = capacity.files >= 0n && capacity.ffree >= 0n && !(capacity.files === 0n && capacity.ffree === 0n) ? capacity.ffree : null;
  const bytesSufficient = usableBytes === null ? null : usableBytes >= BigInt(plan.budget.minimumFreeBytes);
  const entriesSufficient = freeEntries === null ? null : freeEntries >= BigInt(plan.storageAdmission.requiredFreeEntries);
  const policy = plan.version === "chess-coach.training-campaign-plan.v2" ? plan.entryPolicy : "FIXED_COUNTER";
  const policyAcceptedUnknownEntries = bytesSufficient === true && policy === "BTRFS_DYNAMIC_ACKNOWLEDGED" &&
    capacity.type === 0x9123683en && capacity.files === 0n && capacity.ffree === 0n;
  return { version: "chess-coach.campaign-storage-admission.v1", policy,
    raw: { type: String(capacity.type), bsize: String(capacity.bsize), bavail: String(capacity.bavail), files: String(capacity.files), ffree: String(capacity.ffree) },
    usableBytes: usableBytes?.toString() ?? null, requiredUsableBytes: String(plan.budget.minimumFreeBytes),
    freeEntries: freeEntries?.toString() ?? null, requiredFreeEntries: String(plan.storageAdmission.requiredFreeEntries),
    bytesSufficient, entriesSufficient, entryCapacityVerified: entriesSufficient === true, policyAcceptedUnknownEntries,
    entryAdmissionBasis: entriesSufficient === true ? "REPORTED_FREE_ENTRIES" : policyAcceptedUnknownEntries ? "ACKNOWLEDGED_BTRFS_ZERO_COUNTERS" : "NOT_ADMITTED",
    admitted: bytesSufficient === true && (entriesSufficient === true || policyAcceptedUnknownEntries) } as const;
}
export type CampaignStorageAdmission = ReturnType<typeof assessCampaignStorage>;
function checkWorkerStorageAdmission(plan: CampaignPlan, admission: CampaignStorageAdmission | undefined): void {
  check(admission && admission.raw, "WORKER_STORAGE_ADMISSION"); const capacity = {} as CampaignCapacity;
  for (const key of CAPACITY_KEYS) { const value = admission.raw[key];
    check(typeof value === "string" && /^-?(?:0|[1-9][0-9]{0,19})$/.test(value), "WORKER_STORAGE_COUNTER"); capacity[key] = BigInt(value); }
  const expected = assessCampaignStorage(plan, capacity); check(expected.admitted && same(expected, admission), "WORKER_STORAGE_ADMISSION");
}
function monotonic(io: Pick<BaseIO, "now">) {
  let last = -1, failed = false;
  return () => { try { const value = io.now(); check(!failed && Number.isFinite(value) && value >= 0 && value >= last, "CLOCK"); last = value; return value; }
    catch (error) { failed = true; throw error; } };
}
async function within<T>(io: Pick<BaseIO, "alarm">, now: () => number, deadline: number, action: () => Promise<T>): Promise<T> {
  check(now() < deadline, "DEADLINE"); let cancel = () => {};
  try { const value = await Promise.race([action(), new Promise<never>((_, reject) => { cancel = io.alarm(Math.max(0, deadline - now()), () => reject(new Error("Campaign packet: DEADLINE"))); })]); check(now() < deadline, "DEADLINE"); return value; }
  finally { cancel(); }
}
export async function validateCampaignInputs(request: CampaignRequest, io: Pick<OperatorIO, "read" | "alias">, roots: { app: string; reference: string; documents: string }): Promise<TrainingBindings> {
  const physical = await io.read(`${roots.documents}/input-manifest.json`, 8 * MIB);
  check(same(ref(physical), request.preparedInputManifest), "PREPARED_MANIFEST_REF");
  const manifest = json<PreparedInputManifest>(physical, 8 * MIB), bindings = await validateQualificationInputs(io, roots);
  check(same(bindings.source, request.sourceManifest) && same(bindings.tests, request.verification), "SOURCE_TEST_BINDINGS");
  const documentBytes = await io.read(`${roots.documents}/binding-documents.json`, MIB);
  check(same(ref(documentBytes), request.bindingDocuments), "DOCUMENT_MANIFEST_REF");
  check(same(json<{ documents: unknown }>(documentBytes).documents, manifest.documents), "DOCUMENT_MANIFEST_MEMBERSHIP");
  const source = json<{ fileCount: number; files: PreparedInputManifest["source"] }>(await io.read(`${roots.documents}/source.bin`, MIB));
  const expectedSourceFiles = 108 + CAMPAIGN_ADDITIONS.length;
  check(source.fileCount === expectedSourceFiles && source.files.length === expectedSourceFiles && new Set(source.files.map(r => r.path)).size === expectedSourceFiles &&
    CAMPAIGN_ADDITIONS.every(path => source.files.some(r => r.path === path)), "CAMPAIGN_SOURCE_CLOSURE");
  const code = manifest.source.filter(r => !r.path.startsWith("node_modules/zod/"));
  check(code.length === expectedSourceFiles && source.files.every(row => code.some(r => same(r, row))), "CAMPAIGN_PHYSICAL_SOURCE");
  const runtime = json<{ version?: unknown; budget: unknown; resources: unknown; limits: unknown; entryPolicy?: unknown; root?: unknown; mounts?: unknown }>(await io.read(`${roots.documents}/runtimeConfiguration.bin`, MIB));
  const recipe = json<{ plan: unknown }>(await io.read(`${roots.documents}/recipe.bin`, MIB));
  check(same(runtime.budget, request.plan.budget) && same(runtime.resources, request.plan.resources) && same(runtime.limits, request.plan.limits) && same(recipe.plan, request.plan), "CAMPAIGN_RUNTIME_DOCUMENTS");
  if (request.plan.version === "chess-coach.training-campaign-plan.v2") check(runtime.version === "chess-coach.campaign-runtime-configuration.v2" &&
    runtime.entryPolicy === request.plan.entryPolicy && runtime.root === request.plan.root && same(runtime.mounts, request.plan.mounts), "CAMPAIGN_RUNTIME_POLICY");
  return bindings;
}
export type CampaignWorkerReport = { scope: "FULL_CAMPAIGN_WORKER"; execution: "MOCK" | "NATIVE"; status: "PASS" | "FAIL";
  failures: string[]; verifiedAttempts: number; finalizationCalls: number; closeCalls: number;
  validation: CampaignEvidence | null; trainingExecuted: boolean; storageAdmission?: CampaignStorageAdmission };
export async function runCampaignWorker(launch: { requestBytes: Uint8Array; approval: CampaignApproval | null; invocation: CampaignInvocation }, io: CampaignWorkerIO): Promise<CampaignWorkerReport> {
  const report: CampaignWorkerReport = { scope: "FULL_CAMPAIGN_WORKER", execution: io.execution, status: "FAIL", failures: [], verifiedAttempts: 0,
    finalizationCalls: 0, closeCalls: 0, validation: null, trainingExecuted: false };
  const now = monotonic(io); let coordinator: CampaignCoordinator | null = null, handedOff = false, acquired = false;
  let end = 0;
  try {
    const request = decodeCampaignRequest(launch.requestBytes), plan = request.plan;
    checkCampaignApproval(launch.approval, ref(launch.requestBytes)); checkCampaignInvocation(plan, launch.invocation); end = launch.invocation.cleanupDeadlineMs;
    const workEnd = launch.invocation.workDeadlineMs, clockNs = () => BigInt(Math.floor(now() * 1000000));
    check(now() >= launch.invocation.originMs && now() < workEnd, "WORKER_ORIGINAL_DEADLINE");
    const preparationEnd = Math.min(workEnd, launch.invocation.originMs + plan.budget!.inactivityMs);
    const context = await within(io, now, preparationEnd, () => io.context());
    check(context.cwd === "/app" && context.realpath === "/app" && context.executable === "/usr/local/bin/bun" && context.entrypoint === `/app/${CAMPAIGN_ENTRY}`, "WORKER_CONTEXT");
    const bindings = await within(io, now, preparationEnd, () => io.validateInputs(request, io, { app: "/app", reference: "/app/reference", documents: "/app/qualification-inputs" })); acquired = true;
    if (plan.version === "chess-coach.training-campaign-plan.v2") {
      report.storageAdmission = assessCampaignStorage(plan, await within(io, now, preparationEnd, () => io.capacity("/state")));
      check(report.storageAdmission.admitted, "WORKER_STORAGE_ADMISSION");
    }
    const [corpus, strategic] = await within(io, now, Math.min(now() + 10000, workEnd), () => Promise.all([io.loadCorpus(), io.loadStrategic()]));
    const factory = io.createFactory(corpus, strategic); coordinator = io.createCoordinator("/state/run", bindings);
    const owned = coordinator;
    const forwarded: CampaignCoordinator = {
      initializeMaster: (master, model) => { check(now() < workEnd, "WORK_DEADLINE"); return owned.initializeMaster(master, model); },
      runAttempt: async (...args) => {
        check(now() < workEnd, "WORK_DEADLINE"); const state = await owned.runAttempt(...args); check(now() < workEnd, "WORK_DEADLINE");
        const expected = (state.master - 101) * 1000 + state.counters.verifiedCompleted;
        check(expected === report.verifiedAttempts + 1 && state.counters.started === state.counters.verifiedCompleted, "VERIFIED_PROGRESS");
        report.verifiedAttempts = expected; io.progress({ version: "chess-coach.campaign-progress.v1", phase: "work", completed: expected }); return state;
      },
      finalize: timing => { check(++report.finalizationCalls === 1 && now() < workEnd, "FINALIZATION_COUNT_OR_DEADLINE"); return owned.finalize(timing); },
      close: () => { check(++report.closeCalls === 1, "CLOSE_COUNT"); return owned.close(); },
    };
    const campaign = new TrainingCampaign({ coordinator: forwarded, createOwned: factory.create, clockNs,
      initialRecord: async (master, timing) => {
        const initialized = await io.command(["/usr/local/bin/policy-initialize", String(master)], { deadlineMs: Math.min(Number(timing.startupDeadlineNs) / 1000000, workEnd),
          cleanupDeadlineMs: Math.min(Number(timing.startupDeadlineNs + 1000000000n) / 1000000, end), stdoutBytes: MIB, stderrBytes: 65536, now });
        check(clean(initialized) && initialized.stdout.byteLength > 0 && initialized.stdout.byteLength <= MIB, "CPU_INITIALIZER");
        await io.write(`/evidence/initializer-${master}.json`, encode({ master, execution: io.execution, exitCode: initialized.exitCode, recordRef: ref(initialized.stdout) }));
        return { record: Uint8Array.from(initialized.stdout), config: modelConfigShape.parse({ version: "chess-coach.model-config.v1", architecture: "mlp-relu-32",
          featureVersion: "chess-coach.features.v1", inputFeatures: 2271, hiddenUnits: 32, recordSha256: ref(initialized.stdout).sha256 }) };
      } });
    handedOff = true; report.trainingExecuted = io.execution === "NATIVE";
    const result = await campaign.run(); check(report.closeCalls === 1 && report.finalizationCalls === 1 && report.verifiedAttempts === 5000, "CAMPAIGN_LIFETIME");
    const validationEnd = Math.min(launch.invocation.validationDeadlineMs, now() + plan.budget!.validationMs);
    check(now() < validationEnd, "VALIDATION_DEADLINE");
    report.validation = io.validate(result, io.openReadback("/state/run"), bindings, completed => {
      check(now() < validationEnd, "VALIDATION_DEADLINE"); io.progress({ version: "chess-coach.campaign-progress.v1", phase: "validation", completed });
    });
    check(now() < validationEnd && report.validation.status === "PASS_CAMPAIGN_RETAINED_RESULT_VALIDATION", "RESULT_VALIDATION");
    await within(io, now, end, () => io.write("/evidence/experiment-result.json", encode(result))); report.status = "PASS";
  } catch (error) { report.failures.push(String(error).slice(0, 4096)); }
  finally {
    if (coordinator !== null && !handedOff) { try { check(++report.closeCalls === 1, "CLOSE_COUNT"); await coordinator.close(); } catch (error) { report.failures.push(String(error).slice(0, 4096)); } }
    if (report.failures.length) report.status = "FAIL";
    if (acquired) { try { const bytes = encode(report); check(bytes.byteLength <= MIB, "REPORT_BOUND"); await within(io, now, end, () => io.write("/evidence/campaign-worker.json", bytes)); }
      catch (error) { report.status = "FAIL"; report.failures.push(String(error).slice(0, 4096)); } }
  }
  return report;
}
export function campaignDockerCreate(plan: CampaignPlan): string[] {
  check(plan.budget && plan.limits, "BUDGET_REQUIRED");
  return [...DOCKER, "create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=1000:1000", "--runtime=nvidia", `--gpus=device=${plan.gpu}`,
    "--workdir=/app", "--env=PATH=/usr/local/bin:/usr/bin:/bin", "--env=HOME=/scratch/home", "--env=TMPDIR=/tmp", "--env=RAYON_NUM_THREADS=2", "--env=BUN_RUNTIME_TRANSPILER_CACHE_PATH=0",
    ...plan.mounts.flatMap(m => ["--mount", `type=bind,src=${m.source},dst=${m.target}${m.readonly ? ",readonly" : ""}`]), plan.image,
    "/usr/local/bin/bun", "--no-env-file", "--no-install", `/app/${CAMPAIGN_ENTRY}`, plan.version === "chess-coach.training-campaign-plan.v2" ? "worker-v2" : "worker"];
}
export type CampaignOperatorReport = { scope: "FULL_CAMPAIGN_OPERATOR"; execution: "MOCK" | "NATIVE"; status: "PASS" | "FAIL"; failures: string[];
  invocation: CampaignInvocation | null; cid: string | null; aborted: boolean; cleanup: "NOT_ACQUIRED" | "UNCONFIRMED" | "REMOVED";
  queries: number; minimumFreeMiB: number | null; dockerCommands: number; progress: { work: number; validation: number }; trainingExecuted: boolean; storageAdmission?: CampaignStorageAdmission };
export async function runCampaignOperator(launch: { requestBytes: Uint8Array; approval: CampaignApproval | null }, io: CampaignOperatorIO): Promise<CampaignOperatorReport> {
  const report: CampaignOperatorReport = { scope: "FULL_CAMPAIGN_OPERATOR", execution: io.execution, status: "FAIL", failures: [], invocation: null, cid: null,
    aborted: false, cleanup: "NOT_ACQUIRED", queries: 0, minimumFreeMiB: null, dockerCommands: 0, progress: { work: 0, validation: 0 }, trainingExecuted: false };
  const now = monotonic(io); let acquired = false, done = false, stopAttempted = false;
  let plan: CampaignPlan | null = null, end = 0;
  const command = async (argv: readonly string[], deadline: number, cleanup: number, cap = 65536) => {
    check(now() < deadline && cleanup <= end, "COMMAND_DEADLINE"); if (argv[0] === "docker") check(++report.dockerCommands <= 7, "DOCKER_COMMAND_CAP");
    const result = await io.command(argv, { deadlineMs: deadline, cleanupDeadlineMs: cleanup, stdoutBytes: cap, stderrBytes: 65536, now });
    check(result.stdout.byteLength <= cap && result.stderr.byteLength <= 65536, "COMMAND_OUTPUT_BOUND"); return result;
  };
  const stop = async () => {
    if (!report.cid || stopAttempted) return; stopAttempted = true;
    try { const stopped = await command([...DOCKER, "stop", "--time=2", report.cid], Math.min(now() + 5000, end - 2000), Math.min(now() + 6000, end - 1000)); if (clean(stopped)) return; } catch {}
    try { check(clean(await command([...DOCKER, "kill", report.cid], Math.min(now() + 5000, end - 2000), Math.min(now() + 6000, end - 1000))), "OWNED_KILL"); }
    catch (error) { report.failures.push(String(error).slice(0, 4096)); }
  };
  try {
    const request = decodeCampaignRequest(launch.requestBytes); plan = request.plan;
    checkCampaignApproval(launch.approval, ref(launch.requestBytes)); const timing = campaignInvocation(plan, now()); report.invocation = timing; end = timing.cleanupDeadlineMs;
    const limits = plan.limits!, budget = plan.budget!, p = plan;
    const preparationEnd = Math.min(timing.workDeadlineMs, timing.originMs + budget.inactivityMs);
    const context = await within(io, now, preparationEnd, () => io.context());
    check(context.cwd === plan.host && context.realpath === plan.host && context.executable === plan.cachedBun && context.entrypoint === `${plan.source}/${CAMPAIGN_ENTRY}`, "OPERATOR_CONTEXT");
    await within(io, now, preparationEnd, async () => {
      await io.absent(p.root); await io.validateInputs(request, io, { app: p.source, reference: p.reference, documents: p.documents });
      const admission = assessCampaignStorage(p, await io.capacity(dirname(p.root)));
      if (p.version === "chess-coach.training-campaign-plan.v2") report.storageAdmission = admission;
      check(admission.admitted, "STORAGE_ADMISSION");
      for (const mount of p.mounts.filter(m => m.readonly)) await io.requirePath(mount.source,
        [p.cachedBun, "policy-score", "policy-channel", "policy-initialize", "qualification-policy-score.ts", "qualification-policy-channel.ts"].some(s => mount.source.endsWith(s)) ? "executable" : "directory");
    });
    let queryAt = -Infinity, lastProgress = timing.originMs, lastUsage = now();
    const query = async (minimum: number) => {
      check(++report.queries <= limits.queryCapacity, "GPU_QUERY_CAP"); const started = now(), until = Math.min(started + limits.queryMs, timing.validationDeadlineMs);
      const result = await command(GPU_QUERY, until, Math.min(until + 1000, end), 4096);
      check(clean(result) && now() - started <= limits.queryMs, "GPU_QUERY_FAILED_OR_STALE");
      const match = new TextDecoder().decode(result.stdout).match(/^(GPU-[a-f0-9-]+),\s*([0-9]+)\s*\n?$/), free = match ? Number(match[2]) : NaN;
      check(match && match[1] === p.gpu && Number.isSafeInteger(free) && free >= minimum, "GPU_FREE_POLICY");
      report.minimumFreeMiB = Math.min(report.minimumFreeMiB ?? free, free); queryAt = started;
      if (acquired) io.telemetry({ ordinal: report.queries, observedMs: started, freeMiB: free });
    };
    await query(3072); check(now() - queryAt <= limits.maxAgeMs, "ADMISSION_STALE");
    await io.mkdir(p.root); acquired = true; for (const name of ["state", "tmp", "home", "evidence"]) await io.mkdir(`${p.root}/${name}`);
    await io.write(`${p.root}/evidence/invocation.json`, encode(timing)); await io.write(`${p.root}/evidence/progress.json`, encode({ version: "chess-coach.campaign-progress.v1", phase: "work", completed: 0 }));
    io.telemetry({ ordinal: report.queries, observedMs: queryAt, freeMiB: report.minimumFreeMiB! });
    check(now() - queryAt <= limits.maxAgeMs, "ADMISSION_STALE");
    const created = await command(campaignDockerCreate(p), Math.min(now() + 10000, timing.workDeadlineMs), Math.min(now() + 11000, end), 4096);
    const cid = new TextDecoder().decode(created.stdout); check(/^[a-f0-9]{64}\n?$/.test(cid), "OWNED_CID_UNCONFIRMED"); report.cid = cid.trim(); report.cleanup = "UNCONFIRMED";
    check(clean(created) && now() - queryAt <= limits.maxAgeMs, "CREATE_OR_ADMISSION_STALE");
    let finish!: () => void; const completed = new Promise<void>(resolve => { finish = resolve; });
    const running = command([...DOCKER, "start", "-a", report.cid], timing.validationDeadlineMs, Math.min(timing.validationDeadlineMs + 1000, end), MIB)
      .finally(() => { done = true; finish(); }); report.trainingExecuted = io.execution === "NATIVE";
    const monitor = (async () => {
      while (!done) {
        await Promise.race([io.wait(limits.intervalMs), completed]); if (done) return;
        check(now() - queryAt <= limits.maxAgeMs && now() < timing.validationDeadlineMs, "GPU_MONITOR_STALE_OR_DEADLINE"); await query(2048);
        const progress = json<CampaignProgress>(await within(io, now, Math.min(queryAt + limits.maxAgeMs, timing.validationDeadlineMs),
          () => io.read(`${p.root}/evidence/progress.json`, limits.progressBytes)), limits.progressBytes);
        check(progress.version === "chess-coach.campaign-progress.v1" && (progress.phase === "work" || progress.phase === "validation") &&
          Number.isInteger(progress.completed) && progress.completed >= 0 && progress.completed <= 5000, "PROGRESS_SCHEMA");
        check(progress.phase !== "work" || report.progress.validation === 0, "PROGRESS_PHASE_REGRESSION");
        check(progress.phase !== "validation" || report.progress.work === 5000 || progress.completed > 0, "VALIDATION_PROGRESS");
        check(progress.completed >= report.progress[progress.phase], "PROGRESS_REGRESSION");
        if (progress.completed > report.progress[progress.phase]) { report.progress[progress.phase] = progress.completed; lastProgress = now(); }
        check(now() - lastProgress < budget.inactivityMs, "INACTIVITY");
        check(progress.phase !== "work" || now() < timing.workDeadlineMs, "WORK_DEADLINE");
      }
    })();
    const workspace = (async () => {
      while (!done) {
        await Promise.race([io.wait(limits.workspaceCheckMs), completed]); if (done) return;
        const usageEnd = Math.min(now() + limits.workspaceCheckMs, end);
        check(now() >= lastUsage && await within(io, now, usageEnd, () => io.usage(p.root, usageEnd)) <= budget.workspaceBytes, "WORKSPACE_SOFT_BUDGET"); lastUsage = now();
      }
    })();
    try { await Promise.race([running, monitor, workspace]); check(clean(await running), "CONTAINER_NOT_NATURAL_ZERO"); }
    catch (error) { report.aborted = true; report.failures.push(String(error).slice(0, 4096)); await stop(); try { await running; } catch {} }
    finally { done = true; finish(); for (const result of await Promise.allSettled([monitor, workspace])) if (result.status === "rejected") { report.aborted = true; report.failures.push(String(result.reason).slice(0, 4096)); } }
    check(!report.aborted && !stopAttempted, "OPERATOR_ABORTED");
  } catch (error) { report.aborted = true; report.failures.push(String(error).slice(0, 4096)); await stop(); }
  finally {
    if (report.cid !== null) {
      try {
        const inspected = await command([...DOCKER, "inspect", "--format={{json .State}}", report.cid], Math.min(now() + 5000, end - 2000), Math.min(now() + 6000, end - 1000));
        check(clean(inspected), "INSPECT"); const state = json<{ Running: boolean; Status: string; ExitCode: number; OOMKilled: boolean; Dead: boolean; Error: string }>(inspected.stdout);
        check(!state.Running && state.Status === "exited" && state.ExitCode === 0 && !state.OOMKilled && !state.Dead && state.Error === "" && !report.aborted && !stopAttempted, "FINAL_CONTAINER_STATE");
        const worker = json<CampaignWorkerReport>(await within(io, now, Math.min(now() + 5000, end - 6000),
          () => io.read(`${plan!.root}/evidence/campaign-worker.json`, MIB)));
        check(worker.scope === "FULL_CAMPAIGN_WORKER" && worker.execution === io.execution && worker.status === "PASS" && worker.failures.length === 0 &&
          worker.verifiedAttempts === 5000 && worker.finalizationCalls === 1 && worker.closeCalls === 1 && worker.validation?.status === "PASS_CAMPAIGN_RETAINED_RESULT_VALIDATION", "WORKER_RESULT");
        if (plan!.version === "chess-coach.training-campaign-plan.v2") checkWorkerStorageAdmission(plan!, worker.storageAdmission);
        report.status = "PASS";
      } catch (error) { report.aborted = true; report.failures.push(String(error).slice(0, 4096)); await stop(); }
      try { check(clean(await command([...DOCKER, "rm", report.cid], Math.min(now() + 5000, end - 1000), end)), "REMOVE"); report.cleanup = "REMOVED"; }
      catch (error) { report.failures.push(String(error).slice(0, 4096)); }
    }
    if (acquired) { try { io.closeTelemetry(); } catch (error) { report.failures.push(String(error).slice(0, 4096)); } }
    if (report.failures.length) report.status = "FAIL";
    if (acquired) { try { await within(io, now, end, () => io.write(`${plan!.root}/evidence/campaign-operator.json`, encode(report))); }
      catch (error) { report.status = "FAIL"; report.failures.push(String(error).slice(0, 4096)); } }
  }
  return report;
}
async function parents(path: string): Promise<void> {
  for (let p = dirname(path); ; p = dirname(p)) { const s = await fs.lstat(p); check(s.isDirectory() && !s.isSymbolicLink(), "PHYSICAL_PARENT"); if (p === dirname(p)) return; }
}
async function read(path: string, cap: number, progressSnapshot = false): Promise<Uint8Array> {
  await parents(path); const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try { const a = await handle.stat({ bigint: true }); check(a.isFile() && a.size <= BigInt(cap), "FILE_BOUND"); const bytes = Buffer.alloc(Number(a.size) + 1); let count = 0;
    while (count < bytes.length) { const { bytesRead } = await handle.read(bytes, count, bytes.length - count, null); if (!bytesRead) break; count += bytesRead; }
    const b = await handle.stat({ bigint: true }); check(count === Number(a.size) && a.size === b.size && a.mtimeNs === b.mtimeNs &&
      (a.ctimeNs === b.ctimeNs || progressSnapshot && b.nlink === 0n), "FILE_DRIFT"); return bytes.subarray(0, count);
  } finally { await handle.close(); }
}
export function readCampaignProgress(path: string, cap: number): Promise<Uint8Array> { return read(path, cap, true); }
export function openCampaignTelemetry(path: string, maximumBytes: number) {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  let identity;
  try { identity = fstatSync(fd, { bigint: true }); } catch (error) { closeSync(fd); throw error; }
  let total = 0, closed = false;
  return {
    append(value: { ordinal: number; observedMs: number; freeMiB: number }) {
      check(!closed, "TELEMETRY_CLOSED"); const bytes = encode(value); check((total += bytes.byteLength) <= maximumBytes, "TELEMETRY_BOUND");
      for (let offset = 0; offset < bytes.byteLength;) { const count = writeSync(fd, bytes, offset, bytes.byteLength - offset);
        check(count > 0 && count <= bytes.byteLength - offset, "TELEMETRY_SHORT_WRITE"); offset += count; }
    },
    close() {
      if (closed) return; closed = true;
      try { fsyncSync(fd); const retained = lstatSync(path, { bigint: true });
        check(retained.isFile() && !retained.isSymbolicLink() && retained.dev === identity.dev && retained.ino === identity.ino && retained.size === BigInt(total), "TELEMETRY_REPLACED");
      } finally { closeSync(fd); }
    },
  };
}
export async function campaignWorkspaceUsage(root: string, maximumBytes: number, deadline: number, now: () => number): Promise<number> {
  let bytes = 0, entries = 0; const pending = [root];
  while (pending.length) {
    check(now() < deadline, "WORKSPACE_DEADLINE"); const directory = pending.pop()!;
    let children;
    try { children = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (directory !== root && (error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    for (const entry of children) {
      check(now() < deadline, "WORKSPACE_DEADLINE"); const path = `${directory}/${entry.name}`; let stat;
      try { stat = await fs.lstat(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
      check(++entries <= 1000000, "WORKSPACE_ENTRIES"); bytes += stat.size;
      if (bytes > maximumBytes) return bytes; if (stat.isDirectory() && !stat.isSymbolicLink()) pending.push(path);
    }
  }
  return bytes;
}
function productionIO(plan: CampaignPlan): CampaignOperatorIO {
  let telemetry: ReturnType<typeof openCampaignTelemetry> | null = null;
  return { execution: "NATIVE", now: () => Number(process.hrtime.bigint()) / 1000000,
    alarm: (ms, callback) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); }, wait: ms => new Promise(resolve => { setTimeout(resolve, ms).unref(); }),
    context: async () => ({ cwd: process.cwd(), realpath: await fs.realpath(process.cwd()), executable: process.execPath, entrypoint: import.meta.path }),
    read: (path, cap) => path === `${plan.root}/evidence/progress.json` ? readCampaignProgress(path, cap) : read(path, cap),
    command: boundedQualificationCommand, validateInputs: validateCampaignInputs,
    write: async (path, bytes) => { await parents(path); const file = await fs.open(path, "wx", 0o600); try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); } },
    alias: async (path, target) => { check((await fs.lstat(path)).isSymbolicLink() && await fs.realpath(path) === target, "WORKSPACE_ALIAS"); },
    absent: async path => { await parents(path); try { await fs.lstat(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; } throw new Error("Campaign packet: ROOT_EXISTS"); },
    mkdir: async path => { await parents(path); await fs.mkdir(path, { mode: 0o700 }); },
    requirePath: async (path, kind) => { await parents(path); const s = await fs.lstat(path); check(!s.isSymbolicLink() && (kind === "directory" ? s.isDirectory() : s.isFile() && (s.mode & 0o111) !== 0), "RETAINED_PATH"); },
    capacity: campaignCapacity,
    usage: (root, deadline) => campaignWorkspaceUsage(root, plan.budget!.workspaceBytes, deadline, () => Number(process.hrtime.bigint()) / 1000000),
    telemetry: value => { telemetry ??= openCampaignTelemetry(`${plan.root}/evidence/gpu-telemetry.ndjson`, plan.limits!.telemetryBytes); telemetry.append(value); },
    closeTelemetry: () => { telemetry?.close(); },
  };
}
export async function campaignCapacity(path: string): Promise<CampaignCapacity> {
  const value = await fs.statfs(path, { bigint: true });
  return { type: value.type, bsize: value.bsize, bavail: value.bavail, files: value.files, ffree: value.ffree };
}
async function productionWorkerIO(plan: CampaignPlan): Promise<CampaignWorkerIO> {
  const [{ FixedAttemptFactory }, { TrainingCoordinator }, { loadCapturedCorpus }, { loadCapturedStrategicApi }] = await Promise.all([
    import("../../packages/runtime/src/fixed-attempt"), import("../../packages/runtime/src/training-coordinator"), import("../../packages/runtime/src/corpus"), import("../../packages/runtime/src/strategic")]);
  return { ...productionIO(plan), loadCorpus: loadCapturedCorpus, loadStrategic: loadCapturedStrategicApi,
    createFactory: (corpus, strategic) => new FixedAttemptFactory(corpus, strategic), createCoordinator: (root, bindings) => new TrainingCoordinator(root, bindings),
    progress: value => { const path = "/evidence/progress.json", temporary = "/evidence/progress.next"; check(lstatSync(dirname(path)).isDirectory(), "PROGRESS_PARENT");
      writeFileSync(temporary, encode(value), { flag: "wx", mode: 0o600 }); renameSync(temporary, path); },
    openReadback: openCampaignReadback, validate: validateCampaignResult };
}
export type CampaignMode = "plan" | "operator" | "worker" | "plan-v2" | "operator-v2" | "worker-v2";
export function campaignMode(main: boolean, args: readonly string[]): CampaignMode | null {
  return main && args.length === 1 && ["plan", "operator", "worker", "plan-v2", "operator-v2", "worker-v2"].includes(args[0]!) ? args[0] as CampaignMode : null;
}
if (import.meta.main) {
  try {
    const mode = campaignMode(true, Bun.argv.slice(2)), generation = mode?.endsWith("-v2") ? 2 : 1, plan = campaignPlan(SELECTED_CAMPAIGN_BUDGET, generation);
    if (mode === "plan" || mode === "plan-v2") console.log("Executor: " + JSON.stringify(plan));
    else if (mode === "operator" || mode === "worker" || mode === "operator-v2" || mode === "worker-v2") {
      const host = mode === "operator" || mode === "operator-v2", documents = host ? plan.documents : "/app/qualification-inputs";
      const requestBytes = await read(`${documents}/campaign-request.json`, MIB);
      check(decodeCampaignRequest(requestBytes).plan.version === plan.version, "CLI_GENERATION");
      const approval = json<CampaignApproval>(await read(`${documents}/execution-approval.json`, 4096));
      const report = host ? await runCampaignOperator({ requestBytes, approval }, productionIO(plan)) :
        await runCampaignWorker({ requestBytes, approval, invocation: json<CampaignInvocation>(await read("/evidence/invocation.json", 4096)) }, await productionWorkerIO(plan));
      console.log("Executor: " + JSON.stringify(report)); process.exitCode = report.status === "PASS" ? 0 : 1;
    } else { console.error("Executor: usage: campaign-operator.ts plan|operator|worker|plan-v2|operator-v2|worker-v2"); process.exitCode = 2; }
  } catch (error) { console.error("Executor: " + String(error)); process.exitCode = 1; }
}
