// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBounded } from "../../../../verify.ts";
import type { CommandResult } from "../../../../verify.ts";
import { ROOT, R, SOURCE, SOURCE_FILES, OP, BUN, GRANT, CAPS, validateEligibility, now, assessCapture,
  readRegular, sha, encoded, equal, requireThat, fresh, exclusive, validateReviewGate, clockDomain, guardClock, ELIGIBILITY_STATIC_READS } from "../package-acquisition-bun-source2/capture.ts";
import type { Identity, OuterWitness } from "../package-acquisition-bun-source2/capture.ts";
import { productionRootContext, validateBunRuntime, READ_ROOT, MANUAL_CALLER_ARGS } from "../package-acquisition-bun-source2/root-context.ts";
export { MANUAL_CALLER_ARGS };

export const CALLER_FILES = ["invoke-approved-bun.ts", "invoke-approved-bun.test.ts", "invoke-approved-bun.tsconfig.json", "invoke-approved-bun-verify.ts"] as const;
export const OBSERVER_FILES = ["_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts"] as const;
export const INVOCATION = `${R}/acquisition-invocation-1`;
export const READY = `${R}/invocation-ready2.json`;
export const ENVIRONMENT = Object.freeze({ LANG: "C", LC_ALL: "C", TZ: "UTC" });
export const CLOCK_CONTRACT = "PROCESS_LOCAL_DURATION_V1";
export const RUNTIME_STATIC_READS = Object.freeze([...ELIGIBILITY_STATIC_READS, ...CALLER_FILES.map(name => `${R}/${name}`), ...OBSERVER_FILES, READY]);
export function runtimeEligibilityReads(captureReceipt: string, callerReceipt: string): readonly string[] {
  requireThat(new RegExp(`^${SOURCE}/fullverification-[1-9][0-9]*/receipt\\.json$`).test(captureReceipt) && new RegExp(`^${R}/invocation-verification-[1-9][0-9]*/receipt\\.json$`).test(callerReceipt), "runtime-proof-closure-location");
  return Object.freeze([...new Set([...RUNTIME_STATIC_READS, captureReceipt, `${dirname(captureReceipt)}/source-manifest.json`, callerReceipt, `${dirname(callerReceipt)}/source-manifest.json`])]);
}
const LIMIT_MS = 112000;
const FILE_CAP = 256 * 1024;
const HEX = /^[a-f0-9]{64}$/;
type Assessment = ReturnType<typeof assessCapture>;
type Reader = (relativePath: string, cap: number) => Buffer;
type Proof = { path: string; sha256: string };
export interface InvocationHashes { caller: Record<string, string>; source: Record<string, string>; observer: Record<string, string> }
export interface ReadinessEvidence { readySha256: string; invocationProof: Proof; captureProof: Proof; hashes: InvocationHashes; identitySha256: string }
export interface SyntheticInvocation {
  scope: "OFFLINE_SYNTHETIC";
  base: string;
  eligibility: () => Identity;
  readiness: (identity: Identity) => ReadinessEvidence;
  runner: typeof runBounded;
  clock: () => number;
}
export interface InvocationObservation {
  version: "chess-coach.bun-invocation-observation.v1";
  phase: "POST_OPERATION";
  offlineSynthetic: boolean;
  invocationInstanceId: string;
  callerPid: number;
  clockDomain: string;
  assessment: Assessment;
  expectedIdentity: Identity;
  readiness: ReadinessEvidence;
  runner: CommandResult | null;
  runnerThrown: string | null;
  clockFailure: string | null;
  outerWitness: OuterWitness | null;
  startedMonoMs: number | null;
  completionObservedMonoMs: number | null;
  receiptSha256: string | null;
  stdoutSha256: string | null;
  stderrObservedBytes: number | null;
  failures: string[];
  automaticRetryAuthorized: false;
  retriesPerformed: 0;
  captureConsumptionInferredFromLaunch: false;
  postWritesWithinOperationDeadlineClaimed: false;
  trainingReady: false;
}
const localRead: Reader = (path, cap) => readRegular(join(productionRootContext().readRoot, path), cap);
const decode = (bytes: Buffer): unknown => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
function object(value: unknown): Record<string, unknown> {
  requireThat(value !== null && typeof value === "object" && !Array.isArray(value), "invocation-object");
  return value as Record<string, unknown>;
}
function keys(value: object, names: string[]): void {
  requireThat(equal(Object.keys(value).sort(), names.sort()), "invocation-schema");
}
function proof(value: unknown, prefix: string): Proof {
  const p = object(value); keys(p, ["path", "sha256"]);
  requireThat(typeof p["path"] === "string" && p["path"].startsWith(`${prefix}/`) &&
    new RegExp(`^${prefix}/(?:invocation-|full)verification-[1-9][0-9]*/receipt\\.json$`).test(p["path"]) &&
    typeof p["sha256"] === "string" && HEX.test(p["sha256"]), "invocation-proof-location");
  return { path: p["path"], sha256: p["sha256"] };
}
export function invocationHashes(read: Reader = localRead): InvocationHashes {
  const hashes = (paths: readonly string[]) => Object.fromEntries(paths.map(path => [path, sha(read(path, FILE_CAP))]));
  return { caller: hashes(CALLER_FILES.map(name => `${R}/${name}`)), source: hashes(SOURCE_FILES.map(name => `${SOURCE}/${name}`)), observer: hashes(OBSERVER_FILES) };
}
export function validateInvocationReady(identity: Identity, read: Reader = localRead): ReadinessEvidence {
  const hashes = invocationHashes(read), identitySha256 = sha(encoded(identity));
  requireThat(equal(Object.fromEntries(SOURCE_FILES.map(name => [name, hashes.source[`${SOURCE}/${name}`]])), identity.sourceHashes), "invocation-source-identity");
  const readyBytes = read(READY, CAPS.receipt), ready = object(decode(readyBytes));
  keys(ready, ["version", "nonAuthorizing", "grantId", "hashes", "identitySha256", "invocationProof", "captureProof", "reviews"]);
  requireThat(ready["version"] === "chess-coach.bun-invocation-readiness.v1" && ready["nonAuthorizing"] === true && ready["grantId"] === GRANT && equal(ready["hashes"], hashes) && ready["identitySha256"] === identitySha256, "invocation-readiness-binding");
  const reviews = object(ready["reviews"]); keys(reviews, ["caller", "capture"]);
  requireThat(reviews["caller"] === "READY", "caller-review-required"); validateReviewGate(reviews["capture"]);
  const captureProof = proof(ready["captureProof"], SOURCE), invocationProof = proof(ready["invocationProof"], R);
  requireThat(captureProof.path.startsWith(`${SOURCE}/fullverification-`) && invocationProof.path.startsWith(`${R}/invocation-verification-`), "invocation-proof-kind");
  const bindingBytes = read(`${SOURCE}/execution-binding2.json`, CAPS.receipt), binding = object(decode(bindingBytes));
  requireThat(sha(bindingBytes) === identity.executionBindingSha256 && equal(binding["verificationReceipt"], captureProof), "invocation-capture-binding");
  const captureBytes = read(captureProof.path, CAPS.receipt), callerBytes = read(invocationProof.path, CAPS.receipt);
  requireThat(sha(captureBytes) === captureProof.sha256 && sha(callerBytes) === invocationProof.sha256, "invocation-proof-hash");
  const capture = object(decode(captureBytes)), caller = object(decode(callerBytes));
  requireThat(capture["status"] === "PASS_OFFLINE_ONLY" && equal(capture["sourceHashes"], identity.sourceHashes), "invocation-capture-proof");
  requireThat(caller["version"] === "chess-coach.bun-invocation-verification.v1" && caller["status"] === "PASS_OFFLINE_ONLY" && equal(caller["hashes"], hashes) &&
    caller["clockContract"] === CLOCK_CONTRACT && equal(caller["captureProof"], captureProof) && caller["captureProofMatchesSource"] === true &&
    caller["readchecksMatch"] === true && caller["productionAbsent"] === true && caller["actualGetRequests"] === 0 && caller["productionEntryInvoked"] === false &&
    typeof caller["testsPassed"] === "number" && caller["testsPassed"] > 0 && caller["testsFailed"] === 0 && caller["typecheckExitCode"] === 0, "invocation-offline-proof");
  const manifest = read(`${dirname(invocationProof.path)}/source-manifest.json`, CAPS.receipt);
  requireThat(sha(manifest) === caller["sourceManifestSha256"] && equal(decode(manifest), hashes), "invocation-proof-manifest");
  return { readySha256: sha(readyBytes), invocationProof, captureProof, hashes, identitySha256 };
}
export const validateInvocationReady2 = validateInvocationReady;
function exists(path: string): boolean {
  try { fs.lstatSync(path); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return false; throw e; }
}
function stderrSize(path: string): number {
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const s = fs.fstatSync(fd);
    requireThat(s.isFile() && s.nlink === 1 && s.size <= CAPS.stderr, "invocation-stderr-metadata-bound");
    return s.size;
  } finally { fs.closeSync(fd); }
}
function message(e: unknown): string { return e instanceof Error ? e.message.slice(0, 192) : "unknown-invocation-failure"; }
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function validCommand(result: CommandResult): void {
  requireThat((result.status === "PASS" || result.status === "FAIL") && Number.isSafeInteger(result.exitCode) &&
    (result.failure === null || typeof result.failure === "string") && Number.isSafeInteger(result.stdoutBytes) && result.stdoutBytes >= 0 &&
    Number.isSafeInteger(result.stderrBytes) && result.stderrBytes >= 0, "invocation-runner-facts");
  requireThat(result.status !== "PASS" || (result.exitCode === 0 && result.failure === null), "invocation-runner-pass");
}
async function invoke(test?: SyntheticInvocation): Promise<InvocationObservation> {
  if (test) {
    requireThat(test.scope === "OFFLINE_SYNTHETIC" && /^invocation-verification-(?:[2-9]|[1-9][0-9]+)\/fixtures\/[a-zA-Z0-9_-]+$/.test(relative(join(ROOT, R), resolve(test.base))), "invocation-synthetic-root-only");
    requireThat(test.runner !== runBounded, "invocation-injected-runner-required");
  } else {
    const context = productionRootContext(); validateBunRuntime();
    requireThat(fileURLToPath(import.meta.url) === join(context.readRoot, R, CALLER_FILES[0]) && resolve(process.cwd()) === context.readRoot, "invocation-fixed-runtime");
  }
  const sampledClock = guardClock(test?.clock ?? now);
  let envelopeOrigin: number | null = null, initialClockFailure: string | null = null;
  const clock = (): number => {
    if (initialClockFailure) throw new Error(initialClockFailure);
    try { return sampledClock(); } catch (e) { initialClockFailure = message(e); throw e; }
  };
  try { envelopeOrigin = clock(); } catch (e) { initialClockFailure = message(e); }
  const observer = test ? join(test.base, "observer") : productionRootContext().observerRoot;
  const operation = test ? join(test.base, "synthetic-operation") : join(ROOT, OP);
  requireThat(!exists(observer) && !exists(operation), "invocation-replay-blocked");
  const eligibility = test?.eligibility ?? validateEligibility, readiness = test?.readiness ?? validateInvocationReady;
  const expectedIdentity = freeze(decode(encoded(eligibility())) as Identity);
  const ready = freeze(decode(encoded(readiness(expectedIdentity))) as ReadinessEvidence);
  fresh(observer);
  requireThat(equal(eligibility(), expectedIdentity) && equal(readiness(expectedIdentity), ready), "invocation-prelaunch-drift");
  const invocationInstanceId = randomBytes(16).toString("hex"), callerPid = process.pid;
  const domain = clockDomain(invocationInstanceId, "outer", callerPid);
  const runner = test?.runner ?? runBounded;
  const argv = [test ? BUN : validateBunRuntime(), "--no-env-file", "--no-install", join(test ? ROOT : READ_ROOT, SOURCE, "capture.ts"), "execute"];
  const options = { cwd: test ? ROOT : READ_ROOT, environment: { ...ENVIRONMENT } };
  let result: CommandResult | null = null, runnerThrown: string | null = null, clockFailure: string | null = initialClockFailure;
  let startedMonoMs: number | null = null, completionObservedMonoMs: number | null = null;
  try {
    if (initialClockFailure) throw new Error(initialClockFailure);
    requireThat(envelopeOrigin !== null, "invocation-origin-unconfirmed");
    startedMonoMs = envelopeOrigin;
    const remainingMs = Math.min(LIMIT_MS, CAPS.operationMs - (clock() - envelopeOrigin));
    requireThat(remainingMs > 0, "invocation-eligibility-exhausted-envelope");
    result = await runner(argv, observer, remainingMs, options);
    completionObservedMonoMs = clock();
  } catch (e) {
    if (startedMonoMs !== null && result === null) {
      try { completionObservedMonoMs = clock(); } catch (clockError) { clockFailure = message(clockError); }
      runnerThrown = message(e);
    } else clockFailure = message(e);
  }
  const failures: string[] = [];
  if (clockFailure) failures.push(clockFailure);
  let outer: OuterWitness | undefined, receipt: Buffer | undefined, stdout: Buffer | undefined, observedStderr: number | null = null;
  if (result) {
    try {
      validCommand(result);
      requireThat(startedMonoMs !== null && completionObservedMonoMs !== null && clockFailure === null, "invocation-clock-unconfirmed");
      outer = { clockDomain: domain, exitCode: result.exitCode, stdoutEof: result.status === "PASS", stderrEof: result.status === "PASS", stderrBytes: result.stderrBytes,
        startedMonoMs, completionObservedMonoMs, timedOut: result.failure === "COMMAND_DEADLINE" };
      const elapsed = completionObservedMonoMs - startedMonoMs;
      requireThat(elapsed > 0 && elapsed < CAPS.operationMs, "invocation-outer-elapsed");
      requireThat(result.stdoutBytes <= CAPS.frame && result.stderrBytes <= CAPS.stderr, "invocation-runner-byte-bound");
    } catch (e) { failures.push(message(e)); }
  } else failures.push(startedMonoMs === null ? "invocation-runner-not-started" : "invocation-runner-threw");
  try { receipt = readRegular(join(operation, "consumption-receipt.json"), CAPS.receipt); } catch (e) { failures.push(message(e)); }
  try {
    stdout = readRegular(join(observer, "command.stdout"), CAPS.frame);
    observedStderr = stderrSize(join(observer, "command.stderr"));
    requireThat(result !== null && stdout.length === result.stdoutBytes && observedStderr === result.stderrBytes, "invocation-output-metadata-mismatch");
  } catch (e) { failures.push(message(e)); }
  try { requireThat(equal(eligibility(), expectedIdentity) && equal(readiness(expectedIdentity), ready), "invocation-postlaunch-drift"); }
  catch (e) { failures.push(message(e)); }
  const candidateAssessment = receipt && stdout ? assessCapture(receipt, stdout, outer, expectedIdentity) : "FAIL";
  const assessment = clockFailure ? "FAIL" : failures.length || result?.status !== "PASS" ? (candidateAssessment === "PROVISIONAL" ? "PROVISIONAL" : "FAIL") : candidateAssessment;
  const observation: InvocationObservation = { version: "chess-coach.bun-invocation-observation.v1", phase: "POST_OPERATION", offlineSynthetic: Boolean(test),
    invocationInstanceId, callerPid, clockDomain: domain, assessment, expectedIdentity, readiness: ready, runner: result, runnerThrown, clockFailure, outerWitness: outer ?? null, startedMonoMs, completionObservedMonoMs,
    receiptSha256: receipt ? sha(receipt) : null, stdoutSha256: stdout ? sha(stdout) : null, stderrObservedBytes: observedStderr, failures,
    automaticRetryAuthorized: false, retriesPerformed: 0, captureConsumptionInferredFromLaunch: false, postWritesWithinOperationDeadlineClaimed: false, trainingReady: false };
  exclusive(join(observer, "observation.json"), encoded(observation));
  return observation;
}
export async function runSyntheticInvocation(context: SyntheticInvocation): Promise<InvocationObservation> {
  requireThat(context?.scope === "OFFLINE_SYNTHETIC", "invocation-synthetic-context-required");
  return invoke(context);
}
if (import.meta.main) {
  try {
    requireThat(process.argv.length === 3 && process.argv[2] === "execute", "invocation-explicit-execute-required");
    const observation = await invoke();
    process.stdout.write(`${observation.assessment} ${INVOCATION}/observation.json\n`);
    process.exitCode = observation.assessment === "PASS" ? 0 : 1;
  } catch (e) { process.stderr.write(`${message(e)}\n`); process.exitCode = 1; }
}
