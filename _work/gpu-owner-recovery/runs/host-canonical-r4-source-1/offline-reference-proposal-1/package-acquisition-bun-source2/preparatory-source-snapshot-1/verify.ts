// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./cache-parent.ts";

const D = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1";
const R1 = `${D}/package-acquisition-proposal-1`, R2 = `${D}/package-acquisition-proposal-2`;
const S1 = `${D}/package-acquisition-bun-source1`, S2 = `${D}/package-acquisition-bun-source2`;
const BUN = "/usr/local/bin/bun", TEXT_CAP = 256 * 1024, RECORD_CAP = 4 * 1024 * 1024;
const SOURCE_FILES = ["cache-parent.ts", "cache-parent.test.ts", "verify.ts", "tsconfig.json", ".gitignore"] as const;
const MANUAL_FILES = [`${R2}/manual-handoff-request1.json`, `${R2}/manual-handoff-plan1.json`] as const;
const PACKET_FILES = [`${R2}/request.json`, `${R2}/plan.json`, ...MANUAL_FILES, ...SOURCE_FILES.map(name => `${S2}/${name}`)];
const HANDOFF = "_work/gpu-owner-recovery/runs/reference-package-handoff-2";
const CONTEXT_FILES = [`${D}/ready-retry-publication-selection1.json`, "_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts"];
const IMMUTABLE_PREPARATION_PINS = {
  [`${R2}/request.json`]: "c0288e1e34e24d2f7a81e12ee1967ffafbd2768b4c2a5bc2ba15826b6384ff3f",
  [`${R2}/plan.json`]: "7f6a90ca105d6a7c5a45951b508d4a1ecdd5e217625d1cefe08da23557847405",
  [`${S2}/cache-parent.ts`]: "62db5298937cf1c752a76b39f42fa19876e36e637d9d21dba6de323de347b27c",
  [`${S2}/freshverification-3/receipt.json`]: "236c1ef31e4e5a587abd5f513f44c559f7a99bf3dbcb3d7d372ac09022be50fd"
};
const ABSENT = ["_work/gpu-owner-recovery/cache", "_work/gpu-owner-recovery/cache/reference-package-inputs-1", "_work/gpu-owner-recovery/cache/reference-package-inputs-2", `${D}/package-inputs-1`, `${D}/package-inputs-2`, `${D}/package-inputs-2/files`, `${R2}/acquisition-execution-1`, `${R2}/acquisition-invocation-1`, `${R2}/approval1.json`, `${R2}/approval2.json`, `${R2}/invoke-approved-bun.ts`, `${R2}/invocation-ready1.json`, `${R2}/invocation-ready2.json`, `${S2}/capture.ts`, `${S2}/caller.ts`, `${S2}/execution-binding1.json`, `${S2}/execution-binding2.json`, HANDOFF, `${HANDOFF}/snapshot`, `${HANDOFF}/evidence`, `${HANDOFF}/snapshot/${R2}/acquisition-invocation-1`];
const EXISTING = [`${R1}/acquisition-execution-1`, `${R1}/acquisition-invocation-1`];
type RecordValue = Record<string, unknown>;
function requireValue(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function sha(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function encoded(value: unknown): Buffer {
  const data = Buffer.from(JSON.stringify(value, null, 2) + "\n");
  requireValue(data.length <= RECORD_CAP, "record-size-cap"); return data;
}
function object(value: unknown): RecordValue {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), "record-required"); return value as RecordValue;
}
function safeParents(path: string): void {
  const parents: string[] = [];
  for (let parent = dirname(resolve(path)); ; parent = dirname(parent)) { parents.push(parent); if (dirname(parent) === parent) break; }
  for (const parent of parents.reverse()) { const stat = fs.lstatSync(parent); requireValue(stat.isDirectory() && !stat.isSymbolicLink(), "unsafe-record-parent"); }
}
function readRecord(relative: string): Buffer {
  requireValue(!relative.startsWith("/") && !relative.split("/").some(part => ["..", "cache", "fixtures", "compiler-output", "__pycache__"].includes(part)), "record-source-only-no-cache-or-fixtures");
  requireValue([".json", ".jsonl", ".ts", ".py", ".stdout", ".stderr"].includes(extname(relative)) || relative.endsWith("/.gitignore"), "record-source-extension");
  const path = join(ROOT, relative); safeParents(path);
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    requireValue(before.isFile() && before.nlink === 1n && before.size <= BigInt(RECORD_CAP), "bounded-regular-record");
    const buffer = Buffer.alloc(Number(before.size) + 1);
    let size = 0, count: number;
    while ((count = fs.readSync(fd, buffer, size, buffer.length - size, null)) !== 0) {
      size += count; requireValue(size <= Number(before.size), "record-growth");
    }
    const after = fs.fstatSync(fd, { bigint: true });
    requireValue(size === Number(before.size) && before.ino === after.ino && before.size === after.size && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs, "record-read-drift");
    return buffer.subarray(0, size);
  } finally { fs.closeSync(fd); }
}
function json(relative: string): RecordValue { return object(JSON.parse(readRecord(relative).toString("utf8"))); }
function pathState(relative: string): RecordValue {
  try {
    const s = fs.lstatSync(join(ROOT, relative), { bigint: true });
    return { exists: true, directory: s.isDirectory(), regularFile: s.isFile(), symlink: s.isSymbolicLink(), dev: String(s.dev), ino: String(s.ino), mode: String(s.mode), nlink: String(s.nlink), uid: String(s.uid), gid: String(s.gid), size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) };
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { exists: false }; throw error; }
}
function packetHashes(): Record<string, string> { return Object.fromEntries(PACKET_FILES.map(path => [path, sha(readRecord(path))])); }
function historicalSnapshot(): RecordValue {
  const records: RecordValue = {}, metadata: RecordValue = {};
  const walk = (relative: string): void => {
    const state = pathState(relative); metadata[relative] = state;
    requireValue(state["exists"] && !state["symlink"], "historical-record-missing-or-symlink");
    if (state["directory"]) {
      if (["fixtures", "compiler-output", "__pycache__"].includes(relative.split("/").at(-1) ?? "")) return;
      for (const name of fs.readdirSync(join(ROOT, relative)).sort()) walk(`${relative}/${name}`);
    } else {
      requireValue(state["regularFile"], "historical-nonregular-record");
      records[relative] = sha(readRecord(relative));
    }
  };
  for (const relative of [R1, S1, `${D}/package-acquisition-source1`]) walk(relative);
  for (const path of [`${D}/plan.json`, `${D}/selection.json`, `${D}/local-inputs-1/check.json`, `${D}/local-inputs-1/inputs/reference/pnpm-lock.yaml`]) {
    metadata[path] = pathState(path);
    if (path.endsWith("pnpm-lock.yaml")) {
      safeParents(join(ROOT, path));
      const stat = fs.lstatSync(join(ROOT, path));
      requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size < RECORD_CAP, "bounded-local-lock");
      records[path] = sha(fs.readFileSync(join(ROOT, path)));
      requireValue(records[path] === "1d05ed3d8de5a94873f26a2fb51b88c080704d2e90bf942f9f0bb2ce75a504e0", "old-lock-drift");
    } else records[path] = sha(readRecord(path));
  }
  return { hashes: records, metadata, ignoredHistoricalFixtureContentsRead: false, rawArchivesOrCachePayloadsRead: false };
}
function checkHistoricalProofs(): RecordValue {
  const proof10 = json(`${S1}/verification-10/receipt.json`), caller4 = json(`${R1}/invocation-verification-4/receipt.json`);
  requireValue(proof10["status"] === "PASS_OFFLINE_ONLY" && caller4["status"] === "PASS_OFFLINE_ONLY", "historical-proof-status");
  const sourceHashes = object(proof10["sourceHashes"]);
  for (const [name, expected] of Object.entries(sourceHashes)) requireValue(sha(readRecord(`${S1}/${name}`)) === expected, "old-source-proof10-drift");
  for (const group of Object.values(object(caller4["hashes"]))) for (const [path, expected] of Object.entries(object(group))) requireValue(sha(readRecord(path)) === expected, "old-caller-proof4-drift");
  const result = json(`${R1}/acquisition-result1.json`);
  requireValue(result["status"] === "FAIL_COMBINED_ATTEMPT_CONSUMED_BEFORE_NETWORK" && result["combinedAttemptsConsumed"] === 1 && result["actualGetRequests"] === 0 && result["remainingAuthorizedCombinedAttempts"] === 0 && result["remainingAuthorizedGetRequests"] === 0 && result["unusedUrlSlotsRemainIndependentlyReusable"] === false, "old-grant-not-spent");
  const evidence = result["evidence"];
  requireValue(Array.isArray(evidence) && evidence.length === 6, "old-failure-six-records");
  for (const entry of evidence) {
    const row = object(entry); requireValue(typeof row["path"] === "string", "failure-record-path");
    const bytes = readRecord(row["path"]);
    requireValue(bytes.length === row["bytes"] && sha(bytes) === row["sha256"], "old-failure-record-drift");
  }
  requireValue(sha(readRecord(`${R1}/approval1.json`)) === "62af17fc6199b5537c3488c10680b9269baf170a05a322facfdfad3737fea945", "old-issued-approval-drift");
  requireValue(json(`${R1}/acquisition-result-check-1/receipt.json`)["status"] === "PASS_FAILURE_AND_CONSUMPTION_RECORDS_ONLY", "old-result-check-status");
  return { sourceProof10Sha256: sha(readRecord(`${S1}/verification-10/receipt.json`)), callerProof4Sha256: sha(readRecord(`${R1}/invocation-verification-4/receipt.json`)), failureEvidenceFilesVerified: evidence.length, oldApprovalSha256: sha(readRecord(`${R1}/approval1.json`)), oldCombinedAttemptsConsumed: 1, oldRemainingCombinedAttempts: 0, oldRemainingGetRequests: 0, oldUnusedUrlSlotsAreAuthority: false };
}
function preparationBaseline(): RecordValue {
  const paths = [...Object.keys(IMMUTABLE_PREPARATION_PINS), ...[1, 2, 3].flatMap(index => ["receipt.json", "source-manifest.json", "readchecks-before.json", "readchecks-after.json", "tests.stdout", "tests.stderr", "typecheck.stdout", "typecheck.stderr"].map(name => `${S2}/freshverification-${index}/${name}`))];
  const hashes = Object.fromEntries([...new Set(paths)].map(path => [path, sha(readRecord(path))]));
  for (const [path, expected] of Object.entries(IMMUTABLE_PREPARATION_PINS)) requireValue(hashes[path] === expected, "immutable-initial-r2-preparation-drift");
  const proof3 = json(`${S2}/freshverification-3/receipt.json`);
  requireValue(proof3["status"] === "PASS_OFFLINE_PREPARATION_ONLY" && proof3["testsPassed"] === 228 && proof3["typecheckExitCode"] === 0, "initial-228-proof-drift");
  return { hashes, metadata: Object.fromEntries(Object.keys(hashes).map(path => [path, pathState(path)])), initialIsolatedTestsPassed: 228, initialProofRemainsHistorical: true };
}
function manualScopeChecks(): RecordValue {
  const request = json(MANUAL_FILES[0]), plan = json(MANUAL_FILES[1]);
  for (const value of [request, plan]) {
    requireValue(value["status"] === "UNAPPROVED_COMPOSITE_MANUAL_AND_ACQUISITION_SCOPE" && value["newGrantIssued"] === false && value["currentLiveAcquisitionGrant"] === 0 && value["executionReadinessClaimed"] === false, "manual-scope-must-remain-unapproved");
    const inputs = object(value["immutableAcquisitionInputs"]);
    for (const name of ["request", "plan"]) {
      const binding = object(inputs[name]), path = `${R2}/${name}.json`;
      requireValue(binding["path"] === path && binding["sha256"] === IMMUTABLE_PREPARATION_PINS[path as keyof typeof IMMUTABLE_PREPARATION_PINS] && sha(readRecord(path)) === binding["sha256"], "manual-input-pin-drift");
    }
  }
  const selection = json(CONTEXT_FILES[0]!);
  requireValue(selection["maximumNormalCommits"] === 1 && selection["maximumHttpsPushes"] === 1 && selection["freshActualRetryApprovalStillRequired"] === true && selection["newAcquisitionGrantIssuedByThisSelection"] === false && selection["manualCommandExecutionByAssistantApproved"] === false, "conditional-publication-not-acquisition-authority");
  return { status: request["status"], manualAddendumHashes: Object.fromEntries(MANUAL_FILES.map(path => [path, sha(readRecord(path))])), contextHashes: Object.fromEntries(CONTEXT_FILES.map(path => [path, sha(readRecord(path))])), contextMetadata: Object.fromEntries(CONTEXT_FILES.map(path => [path, pathState(path)])), actualCompositeApprovalExists: false, literalSourceClosureFrozen: false, fullTransferImplementationPresent: false };
}
function checks(): RecordValue {
  const states = Object.fromEntries([...ABSENT, ...EXISTING].map(path => [path, pathState(path)]));
  for (const path of ABSENT) requireValue(states[path]?.["exists"] === false, `must-stay-absent:${path}`);
  for (const path of EXISTING) requireValue(states[path]?.["exists"] === true && states[path]?.["directory"] === true && states[path]?.["symlink"] === false, `preserve-old-directory:${path}`);
  const historical = historicalSnapshot();
  requireValue(JSON.stringify(historical) === JSON.stringify(json(`${S2}/freshverification-3/source-manifest.json`)["historical"]), "original-352-historical-records-or-metadata-drift");
  return { packetHashes: packetHashes(), productionAndDeferredPaths: states, historical, historicalProofs: checkHistoricalProofs(), initialPreparationBaseline: preparationBaseline(), manualScope: manualScopeChecks() };
}
function write(evidence: string, name: string, bytes: Uint8Array): void {
  requireValue(bytes.length <= RECORD_CAP && /^[a-z][a-z0-9.-]+$/.test(name), "bounded-evidence-name");
  const fd = fs.openSync(join(evidence, name), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
interface Run { args: string[]; exitCode: number | null; signal: string | null; reaped: boolean; pipesCompleted: boolean; failure: string | null; stdoutBytes: number; stderrBytes: number; stdoutSha256: string; stderrSha256: string; text: string }
async function wait(promise: Promise<void>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise.then(() => true), new Promise<false>(resolveWait => { timer = setTimeout(() => resolveWait(false), ms); })]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
async function run(args: string[], evidence: string, label: string): Promise<Run> {
  const stdout: Buffer[] = [], stderr: Buffer[] = [];
  let out = 0, err = 0, exitCode: number | null = null, signal: string | null = null, reaped = false, pipesCompleted = false, failure: string | null = null;
  const child = spawn(BUN, args, { cwd: ROOT, env: { LANG: "C", LC_ALL: "C" }, stdio: ["ignore", "pipe", "pipe"], shell: false });
  const collect = (chunks: Buffer[], data: Buffer, isOut: boolean): void => {
    const current = isOut ? out : err, accepted = Math.min(data.length, TEXT_CAP - current);
    if (accepted > 0) chunks.push(Buffer.from(data.subarray(0, accepted)));
    if (isOut) out += accepted; else err += accepted;
    if (accepted !== data.length) { failure ??= "verification-text-cap"; child.kill("SIGKILL"); }
  };
  child.stdout.on("data", (data: Buffer) => collect(stdout, data, true));
  child.stderr.on("data", (data: Buffer) => collect(stderr, data, false));
  child.once("exit", (code, sig) => { exitCode = code; signal = sig; reaped = true; });
  child.once("error", error => { failure ??= error.message; });
  const closed = new Promise<void>(resolveClose => { child.once("close", () => { pipesCompleted = true; resolveClose(); }); });
  if (!(await wait(closed, 60000))) {
    failure ??= "verification-timeout"; child.kill("SIGTERM");
    if (!(await wait(closed, 1000))) { child.kill("SIGKILL"); if (!(await wait(closed, 3000))) failure = "verification-reap-or-pipes-unconfirmed"; }
  }
  child.stdout.destroy(); child.stderr.destroy();
  const outBytes = Buffer.concat(stdout), errBytes = Buffer.concat(stderr);
  write(evidence, `${label}.stdout`, outBytes); write(evidence, `${label}.stderr`, errBytes);
  return { args, exitCode, signal, reaped, pipesCompleted, failure, stdoutBytes: outBytes.length, stderrBytes: errBytes.length, stdoutSha256: sha(outBytes), stderrSha256: sha(errBytes), text: outBytes.toString("utf8") + "\n" + errBytes.toString("utf8") };
}
function withoutText({ text: _text, ...value }: Run): Omit<Run, "text"> { return value; }
export async function verify(): Promise<void> {
  requireValue(process.cwd() === ROOT && process.execPath === BUN && process.versions["bun"] === "1.4.0", "pinned-bun-required");
  requireValue(object(JSON.parse(fs.readFileSync(fs.realpathSync(join(ROOT, "node_modules/typescript/package.json")), "utf8")))["version"] === "5.9.3", "pinned-typescript-required");
  safeParents(join(ROOT, S2, "freshverification-1"));
  let evidence = "";
  for (let index = 1; index <= 999; index++) {
    const candidate = join(ROOT, S2, `freshverification-${index}`);
    try { fs.mkdirSync(candidate, { mode: 0o700 }); evidence = candidate; break; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
  requireValue(evidence !== "", "fresh-verification-labels-exhausted");
  const before = checks(), hashes = packetHashes();
  const manifest = encoded({ version: "chess-coach.retry-preparation-source-manifest.v1", packetHashes: hashes, historical: before["historical"], historicalProofs: before["historicalProofs"], initialPreparationBaseline: before["initialPreparationBaseline"], manualScope: before["manualScope"], productionAdapterInstantiated: false });
  write(evidence, "source-manifest.json", manifest); write(evidence, "readchecks-before.json", encoded(before));
  const tests = await run(["--no-env-file", "--no-install", "test", join(ROOT, S2, "cache-parent.test.ts"), "--timeout", "10000"], evidence, "tests");
  const typecheck = await run(["--no-env-file", "--no-install", join(ROOT, "node_modules/typescript/bin/tsc"), "-p", join(ROOT, S2, "tsconfig.json")], evidence, "typecheck");
  let after: RecordValue;
  try { after = checks(); } catch (error) { after = { readcheckError: error instanceof Error ? error.message : String(error) }; }
  write(evidence, "readchecks-after.json", encoded(after));
  const readchecksMatch = JSON.stringify(before) === JSON.stringify(after);
  const passed = tests.text.match(/^\s*(\d+) pass\s*$/m), failed = tests.text.match(/^\s*(\d+) fail\s*$/m);
  const testsPassed = passed ? Number(passed[1]) : null, testsFailed = failed ? Number(failed[1]) : null;
  const success = [tests, typecheck].every(value => value.exitCode === 0 && value.reaped && value.pipesCompleted && value.failure === null) && readchecksMatch && testsPassed !== null && testsPassed > 0 && testsFailed === 0;
  const receipt = {
    version: "chess-coach.retry-preparation-offline-verification.v1", status: success ? "PASS_OFFLINE_PREPARATION_ONLY" : "FAIL_OFFLINE_PREPARATION_ONLY",
    scope: "Original 228 isolated preparation cases plus manual-handoff static/synthetic JSON contracts only; no full transfer, capture/caller, or end-to-end integration qualification",
    runtime: { path: BUN, bun: "1.4.0", typescript: "5.9.3", flags: ["--no-env-file", "--no-install"], strictNoEmit: true },
    packetHashes: hashes, sourceManifestSha256: sha(manifest), readchecksBeforeSha256: sha(encoded(before)), readchecksAfterSha256: sha(encoded(after)), readchecksMatch,
    testsPassed, testsFailed, typecheckExitCode: typecheck.exitCode, tests: withoutText(tests), typecheck: withoutText(typecheck),
    historicalProofs: before["historicalProofs"], preservedHistoricalRecordCount: Object.keys(object(object(before["historical"])["hashes"])).length,
    initialPreparationBaseline: before["initialPreparationBaseline"], manualScope: before["manualScope"],
    syntheticFixtureScope: "In-memory maps only; no real filesystem adapter or production mkdir", actualGetRequests: 0, networkOperationsPerformed: 0,
    productionAdapterInstantiated: false, acquisitionEntrypointPresent: false, productionEntryInvoked: false, productionWorkerInvoked: false, productionCacheParentCreated: false, productionDestinationsCreated: false,
    oldEvidenceSourcesBindingsAndMetadataUnchanged: readchecksMatch, oldRawFilesOrCachePayloadsRead: false, oldLlvmPipelineOrFailedFull1Used: false,
    realNetworkUsed: false, listenersStarted: false, nativeCompilation: false, packageExecution: false, installInvoked: false, f64FloatmathChanged: false, gitMutationOrPublicationPerformed: false,
    compositeApprovalStatus: "UNAPPROVED_COMPOSITE_MANUAL_AND_ACQUISITION_SCOPE", currentLiveGrant: 0, currentLiveAcquisitionGrant: 0, currentAuthorizedAcquisitionAttempts: 0, currentAuthorizedManualHandoffAttempts: 0, newGrantIssued: false, newAcquisitionGrantIssued: false, executionReadinessClaimed: false, trainingReady: false,
    actualGitHubRequests: 0, actualManualHandoffs: 0, fullTransferImplementationPresent: false, manualCommandGenerated: false,
    deferred: ["fresh actual composite approval binding original R2 pair plus both manual addenda hashes", "real approval SHA pin", "full S2 capture/caller and task delivery implementation", "real OP2-bound adapter with separate SNAPSHOT read roots", "fresh full tests and end-to-end qualification", "backend/DevOps/adversarial/security proposal and implementation reviews", "execution bindings and readiness records", "literal finite source closure seal", "conditional one normal commit and one HTTPS continuation push after readiness", "literal Fish command only after successful publication"],
    mockPhaseGuardQualifiesFullIntegration: false
  };
  write(evidence, "receipt.json", encoded(receipt));
  process.stdout.write(`${receipt.status} ${evidence}/receipt.json\n`);
  process.exitCode = success ? 0 : 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await verify(); } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : "offline-verification-failed"}\n`); process.exitCode = 1; }
}
