// SPEC: _spec/runtime-protocol.puml
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { runBounded } from "../../../../verify.ts";
import type { CommandResult } from "../../../../verify.ts";
import { ROOT, R, SOURCE, SOURCE_FILES, OP, RAW, OUTPUT, BUN, GRANT, CAPS, PINS, authority, sourceHashes, encoded, sha, fresh, exclusive, readRegular, now, clockDomain, assessCapture, equal } from "../package-acquisition-bun-source1/capture.ts";
import type { Identity, OuterWitness } from "../package-acquisition-bun-source1/capture.ts";
import { CALLER_FILES, ENVIRONMENT, INVOCATION, READY, CLOCK_CONTRACT, invocationHashes, validateInvocationReady, runSyntheticInvocation } from "./invoke-approved-bun.ts";
import type { ReadinessEvidence, SyntheticInvocation } from "./invoke-approved-bun.ts";
import { assessVerification, bindingDataState, productionAbsent } from "./invoke-approved-bun-verify.ts";
import type { VerificationRun } from "./invoke-approved-bun-verify.ts";

const fixtureRoot = process.env["INVOCATION_TEST_ROOT"];
assert.ok(fixtureRoot && /^invocation-verification-(?:[2-9]|[1-9][0-9]+)\/fixtures$/.test(relative(join(ROOT, R), resolve(fixtureRoot))));
const fixtures = fixtureRoot;
let serial = 0;
function fixture(): string { const path = join(fixtures, `case_${++serial}`); fresh(path); return path; }
function identity(): Identity { return { ...authority(), sourceHashes: sourceHashes(), bindings: PINS, executionBindingSha256: "d".repeat(64) }; }
const clone = <T>(value: T): T => JSON.parse(encoded(value).toString("utf8")) as T;
function completion(id: Identity, changes: Record<string, unknown> = {}, supervisorOrigin = 2000, workerStart = 5000): { receipt: Buffer; stdout: Buffer } {
  const supervisorDomain = clockDomain("offline-outer-only", "supervisor", 211), workerDomain = clockDomain("offline-outer-only", "worker", 212);
  const receipt = encoded({ version: "chess-coach.bun-acquisition-receipt.v1", grantId: GRANT, terminalState: "PROVISIONAL_PASS", failure: null,
    offlineSynthetic: false, interrupted: false, identity: id, attemptId: "offline-outer-only", supervisorPid: 211, supervisorDomain, workerPid: 212, workerDomain,
    origin: supervisorOrigin, operationDeadline: supervisorOrigin + CAPS.operationMs, workDeadline: supervisorOrigin + CAPS.workMs,
    deadlineSnapshot: { clockDomain: supervisorDomain, observedMonoMs: supervisorOrigin + 100, operationDeadlineMonoMs: supervisorOrigin + CAPS.operationMs, observedExceeded: false },
    workerTiming: { clockDomain: workerDomain, workerStartMonoMs: workerStart, requestStartsMonoMs: [workerStart + 100, workerStart + 200] },
    clockFailure: false, cleanupFailure: false, pipesDestroyed: true, workerReaped: true, workerExitCode: 0, workerStdoutEof: true, workerStderrEof: true, doneEvidenceReceived: true,
    termAttempted: false, killAttempted: false, termSent: false, killSent: false, reapingUnresolved: false,
    eligibilityRevalidated: true, selectedHashesAndMembershipVerified: true, bindingRechecked: true, combinedAttemptsConsumed: 1, remainingCombinedAttempts: 0,
    urlStartsConsumed: 2, actualGetRequests: 2, confirmedGetInvocations: 2, responsesCompleted: 2, urlsCompleted: 2, remainingGetSlots: 0, automaticRetryAuthorized: false,
    artifactsPreserved: true, retriesPerformed: 0, strictOsSchedulingOrDurabilityDeadlineGuarantee: false, trainingReady: false, selectedManifestSha256: "e".repeat(64), ...changes });
  const stdout = Buffer.concat([encoded({ type: "COMPLETION_CANDIDATE", attemptId: "offline-outer-only", consumptionReceiptSha256: sha(receipt), supervisorDomain, originMonoMs: supervisorOrigin,
    operationDeadlineMonoMs: supervisorOrigin + CAPS.operationMs, candidatePreparationMonoMs: supervisorOrigin + 200 }), Buffer.from("\n")]);
  return { receipt, stdout };
}
interface Case { base: string; id: Identity; context: SyntheticInvocation; calls: number; time: number; result: CommandResult; receipt: Buffer | null; stdout: Buffer; stderr: Buffer }
function scenario(): Case {
  const base = fixture(), id = identity(), candidate = completion(id), hashes = invocationHashes();
  const ready: ReadinessEvidence = { readySha256: "a".repeat(64), invocationProof: { path: `${R}/invocation-verification-999/receipt.json`, sha256: "b".repeat(64) },
    captureProof: { path: `${SOURCE}/verification-999/receipt.json`, sha256: "c".repeat(64) }, hashes, identitySha256: sha(encoded(id)) };
  const state = { base, id, calls: 0, time: 1000, result: { status: "PASS", exitCode: 0, failure: null, stdoutBytes: candidate.stdout.length, stderrBytes: 0 } as CommandResult,
    receipt: candidate.receipt as Buffer | null, stdout: candidate.stdout, stderr: Buffer.alloc(0), context: undefined as unknown as SyntheticInvocation };
  state.context = { scope: "OFFLINE_SYNTHETIC", base, clock: () => state.time, eligibility: () => clone(id), readiness: () => clone(ready),
    runner: async (argv, directory, timeout, options) => {
      state.calls++;
      assert.deepEqual(argv, [BUN, "--no-env-file", "--no-install", join(ROOT, SOURCE, "capture.ts"), "execute"]);
      assert.equal(directory, join(base, "observer")); assert.equal(timeout, 112000);
      assert.deepEqual(options, { cwd: ROOT, environment: { LANG: "C", LC_ALL: "C", TZ: "UTC" } });
      if (state.receipt !== null) { fresh(join(base, "synthetic-operation")); exclusive(join(base, "synthetic-operation/consumption-receipt.json"), state.receipt, CAPS.receipt + 1); }
      exclusive(join(directory, "command.stdout"), state.stdout, CAPS.frame + 1); exclusive(join(directory, "command.stderr"), state.stderr, CAPS.stderr + 1);
      state.time = 3000; return state.result;
    } };
  return state;
}
function install(s: Case, c: { receipt: Buffer; stdout: Buffer }): void { s.receipt = c.receipt; s.stdout = c.stdout; s.result.stdoutBytes = c.stdout.length; }
function candidate(s: Case, change: (value: Record<string, unknown>) => void): void {
  const value = JSON.parse(s.stdout.toString("utf8")) as Record<string, unknown>; change(value);
  s.stdout = Buffer.concat([encoded(value), Buffer.from("\n")]); s.result.stdoutBytes = s.stdout.length;
}
function readyFiles(): { id: Identity; files: Map<string, Buffer>; read: (path: string, cap: number) => Buffer; ready: Record<string, unknown>; caller: Record<string, unknown> } {
  const files = new Map<string, Buffer>();
  const hashes = invocationHashes((path, cap) => { const data = readRegular(join(ROOT, path), cap); files.set(path, data); return data; });
  const id = identity(), captureProof = { path: `${SOURCE}/verification-999/receipt.json`, sha256: "" };
  const capture = encoded({ status: "PASS_OFFLINE_ONLY", sourceHashes: id.sourceHashes }); captureProof.sha256 = sha(capture); files.set(captureProof.path, capture);
  const binding = encoded({ verificationReceipt: captureProof }); files.set(`${SOURCE}/execution-binding1.json`, binding); id.executionBindingSha256 = sha(binding);
  const invocationProof = { path: `${R}/invocation-verification-999/receipt.json`, sha256: "" };
  const manifest = encoded(hashes); files.set(`${dirname(invocationProof.path)}/source-manifest.json`, manifest);
  const caller: Record<string, unknown> = { version: "chess-coach.bun-invocation-verification.v1", status: "PASS_OFFLINE_ONLY", hashes, readchecksMatch: true,
    clockContract: CLOCK_CONTRACT, captureProof, captureProofMatchesSource: true, productionAbsent: true, actualGetRequests: 0, productionEntryInvoked: false, testsPassed: 1, testsFailed: 0, typecheckExitCode: 0, sourceManifestSha256: sha(manifest) };
  const callerBytes = encoded(caller); invocationProof.sha256 = sha(callerBytes); files.set(invocationProof.path, callerBytes);
  const ready: Record<string, unknown> = { version: "chess-coach.bun-invocation-readiness.v1", nonAuthorizing: true, grantId: GRANT, hashes,
    identitySha256: sha(encoded(id)), captureProof, invocationProof, reviews: { caller: "READY", capture: { backend: "READY", devops: "READY", adversarial: "READY", security: "READY" } } };
  files.set(READY, encoded(ready));
  return { id, files, ready, caller, read: (path, cap) => { const data = files.get(path); assert.ok(data, `missing synthetic ${path}`); assert.ok(data.length <= cap); return data; } };
}

test("imports leave operational paths absent without forbidding binding data", () => {
  assert.equal(productionAbsent(), true); bindingDataState(READY); bindingDataState(`${SOURCE}/execution-binding1.json`);
  assert.deepEqual(ENVIRONMENT, { LANG: "C", LC_ALL: "C", TZ: "UTC" });
  assert.equal(CALLER_FILES.length, 4); assert.equal(SOURCE_FILES.length, 5);
});
test("exact synthetic completion qualifies with fixed argv, destination, budget and environment", async () => {
  const s = scenario(), result = await runSyntheticInvocation(s.context);
  assert.equal(result.assessment, "PASS"); assert.equal(s.calls, 1);
  assert.match(result.invocationInstanceId, /^[A-Za-z0-9_-]{1,128}$/); assert.equal(result.callerPid, process.pid);
  assert.equal(result.clockDomain, `${result.invocationInstanceId}:outer:${process.pid}`);
  assert.deepEqual(result.outerWitness, { clockDomain: result.clockDomain, exitCode: 0, stdoutEof: true, stderrEof: true, stderrBytes: 0, startedMonoMs: 1000, completionObservedMonoMs: 3000, timedOut: false });
  assert.equal(result.phase, "POST_OPERATION"); assert.equal(result.offlineSynthetic, true); assert.equal(result.postWritesWithinOperationDeadlineClaimed, false);
  const receipt = JSON.parse(s.receipt!.toString("utf8")) as Record<string, unknown>;
  assert.equal(receipt["termAttempted"], false); assert.equal(receipt["killAttempted"], false); assert.equal(receipt["workerReaped"], true);
  assert.deepEqual(JSON.parse(readRegular(join(s.base, "observer/observation.json"), CAPS.receipt).toString()), result);
});
test("eligibility rejection performs no invocation or observer preparation", async () => {
  const s = scenario(); s.context.eligibility = () => { throw Error("ineligible"); };
  await assert.rejects(runSyntheticInvocation(s.context), /ineligible/); assert.equal(s.calls, 0); assert.equal(fs.existsSync(join(s.base, "observer")), false);
});
test("readiness rejection performs no invocation or observer preparation", async () => {
  const s = scenario(); s.context.readiness = () => { throw Error("not-reviewed"); };
  await assert.rejects(runSyntheticInvocation(s.context), /not-reviewed/); assert.equal(s.calls, 0); assert.equal(fs.existsSync(join(s.base, "observer")), false);
});
test("existing observer blocks even before eligibility", async () => {
  const s = scenario(); fresh(join(s.base, "observer")); s.context.eligibility = () => { throw Error("must-not-run"); };
  await assert.rejects(runSyntheticInvocation(s.context), /replay-blocked/); assert.equal(s.calls, 0);
});
test("existing operation blocks replay", async () => {
  const s = scenario(); fresh(join(s.base, "synthetic-operation")); await assert.rejects(runSyntheticInvocation(s.context), /replay-blocked/); assert.equal(s.calls, 0);
});
test("second caller invocation never retries a completed launcher", async () => {
  const s = scenario(); await runSyntheticInvocation(s.context); await assert.rejects(runSyntheticInvocation(s.context), /replay-blocked/); assert.equal(s.calls, 1);
});
for (const base of [join(ROOT, INVOCATION), join(ROOT, R), join(ROOT, R, "invocation-verification-1/fixtures/new_case"), `${fixtures}/../escape`, `${fixtures}/case/../escape/child`, `${fixtures}/nested/child`]) {
  test(`synthetic scope rejects ${relative(join(ROOT, R), base)}`, async () => { const s = scenario(); s.context.base = base; await assert.rejects(runSyntheticInvocation(s.context), /synthetic-root-only/); assert.equal(s.calls, 0); });
}
test("synthetic export rejects missing context", async () => { await assert.rejects(runSyntheticInvocation(undefined as unknown as SyntheticInvocation), /synthetic-context-required/); });
test("synthetic context rejects the real acquisition runner", async () => {
  const s = scenario(); s.context.runner = runBounded; await assert.rejects(runSyntheticInvocation(s.context), /injected-runner-required/);
});
test("prelaunch identity drift stops before the runner", async () => {
  const s = scenario(); let calls = 0; s.context.eligibility = () => ({ ...clone(s.id), executionBindingSha256: ++calls === 1 ? s.id.executionBindingSha256 : "f".repeat(64) });
  await assert.rejects(runSyntheticInvocation(s.context), /prelaunch-drift/); assert.equal(s.calls, 0);
});
for (const phase of ["setup", "open", "sync"]) {
  test(`whole-call ${phase} delay rejects late runner PASS`, async () => {
    const s = scenario(), runner = s.context.runner; s.context.runner = async (...args) => { const result = await runner(...args); s.time = 121000; return result; };
    const result = await runSyntheticInvocation(s.context); assert.equal(result.assessment, "FAIL"); assert.equal(result.outerWitness?.completionObservedMonoMs, 121000);
    assert.equal(result.runner?.status, "PASS"); assert.equal(result.completionObservedMonoMs, 121000);
  });
}
for (const observed of [121000, 121001]) {
  test(`outer elapsed boundary ending at ${observed} never qualifies`, async () => {
    const s = scenario(), runner = s.context.runner; s.context.runner = async (...args) => { const result = await runner(...args); s.time = observed; return result; };
    assert.equal((await runSyntheticInvocation(s.context)).assessment, "FAIL");
  });
}
for (const [failure, timedOut] of [["COMMAND_DEADLINE", true], ["COMMAND_OUTPUT_BOUND", false], ["COMMAND_SUPERVISOR_EXIT", false], [null, false]] as const) {
  test(`runner FAIL preserves ${String(failure)} without inventing EOF`, async () => {
    const s = scenario(); s.result = { ...s.result, status: "FAIL", exitCode: -1, failure };
    const result = await runSyntheticInvocation(s.context); assert.equal(result.assessment, "FAIL"); assert.equal(s.calls, 1);
    assert.equal(result.outerWitness?.exitCode, -1); assert.equal(result.outerWitness?.stdoutEof, false); assert.equal(result.outerWitness?.stderrEof, false); assert.equal(result.outerWitness?.timedOut, timedOut);
    assert.deepEqual(result.runner, s.result); assert.equal(result.automaticRetryAuthorized, false); assert.equal(result.captureConsumptionInferredFromLaunch, false);
  });
}
test("launcher throw preserves partial artifacts, unknown witness and no retry", async () => {
  const s = scenario(), runner = s.context.runner; s.context.runner = async (...args) => { await runner(...args); throw Error("launcher-open-failed"); };
  const result = await runSyntheticInvocation(s.context); assert.notEqual(result.assessment, "PASS"); assert.equal(s.calls, 1); assert.equal(result.outerWitness, null);
  assert.equal(result.runnerThrown, "launcher-open-failed"); assert.equal(result.runner, null); assert.equal(result.completionObservedMonoMs, 3000);
  assert.equal(fs.existsSync(join(s.base, "synthetic-operation/consumption-receipt.json")), true);
  await assert.rejects(runSyntheticInvocation(s.context), /replay-blocked/); assert.equal(s.calls, 1);
});
test("launch failure before capture never establishes consumption", async () => {
  const s = scenario(); s.context.runner = async () => { s.calls++; throw Error("spawn-failed"); };
  const result = await runSyntheticInvocation(s.context); assert.equal(result.assessment, "FAIL"); assert.equal(result.captureConsumptionInferredFromLaunch, false);
  assert.equal(fs.existsSync(join(s.base, "synthetic-operation")), false); assert.equal(s.calls, 1);
});
test("missing receipt never qualifies", async () => { const s = scenario(); s.receipt = null; assert.equal((await runSyntheticInvocation(s.context)).assessment, "FAIL"); });
test("receipt over 64 KiB rejects before loading", async () => { const s = scenario(); s.receipt = Buffer.alloc(CAPS.receipt + 1); const r = await runSyntheticInvocation(s.context); assert.equal(r.assessment, "FAIL"); assert.equal(r.receiptSha256, null); assert.ok(r.failures.includes("regular-file-cap")); });
test("stdout over 4 KiB rejects before loading", async () => { const s = scenario(); s.stdout = Buffer.alloc(CAPS.frame + 1); s.result.stdoutBytes = s.stdout.length; const r = await runSyntheticInvocation(s.context); assert.equal(r.assessment, "FAIL"); assert.equal(r.stdoutSha256, null); assert.ok(r.failures.includes("regular-file-cap")); });
test("stderr metadata over bound never qualifies", async () => { const s = scenario(); s.stderr = Buffer.alloc(CAPS.stderr + 1); s.result.stderrBytes = s.stderr.length; const r = await runSyntheticInvocation(s.context); assert.equal(r.assessment, "FAIL"); assert.equal(r.stderrObservedBytes, null); });
test("actual stderr mismatch never qualifies", async () => { const s = scenario(); s.stderr = Buffer.from("x"); const r = await runSyntheticInvocation(s.context); assert.equal(r.assessment, "FAIL"); assert.equal(r.stderrObservedBytes, 1); assert.equal(r.outerWitness?.stderrBytes, 0); });
test("returned stderr byte count stays exact", async () => { const s = scenario(); s.stderr = Buffer.from("xyz"); s.result.stderrBytes = 3; const r = await runSyntheticInvocation(s.context); assert.equal(r.assessment, "FAIL"); assert.equal(r.outerWitness?.stderrBytes, 3); });
test("stdout metadata mismatch never qualifies", async () => { const s = scenario(); s.result.stdoutBytes++; assert.equal((await runSyntheticInvocation(s.context)).assessment, "FAIL"); });
test("completion receipt hash mismatch never qualifies", async () => { const s = scenario(); s.receipt = Buffer.concat([s.receipt!, Buffer.from(" ")]); assert.equal((await runSyntheticInvocation(s.context)).assessment, "FAIL"); });
test("receipt identity drift never replaces the expected identity", async () => {
  const s = scenario(), different = { ...clone(s.id), executionBindingSha256: "f".repeat(64) }, c = completion(different); s.receipt = c.receipt; s.stdout = c.stdout; s.result.stdoutBytes = c.stdout.length;
  const r = await runSyntheticInvocation(s.context); assert.equal(r.assessment, "FAIL"); assert.deepEqual(r.expectedIdentity, s.id);
});
test("postlaunch identity drift rejects even valid completion", async () => {
  const s = scenario(); let calls = 0; s.context.eligibility = () => ({ ...clone(s.id), executionBindingSha256: ++calls < 3 ? s.id.executionBindingSha256 : "f".repeat(64) });
  const r = await runSyntheticInvocation(s.context); assert.equal(r.assessment, "FAIL"); assert.deepEqual(r.expectedIdentity, s.id); assert.ok(r.failures.includes("invocation-postlaunch-drift"));
});
test("postlaunch observer or caller binding drift rejects", async () => {
  const s = scenario(), readiness = s.context.readiness; let calls = 0;
  s.context.readiness = id => ({ ...readiness(id), readySha256: ++calls < 3 ? "a".repeat(64) : "f".repeat(64) });
  assert.equal((await runSyntheticInvocation(s.context)).assessment, "FAIL");
});
for (const [key, value] of [["workerReaped", false], ["workerExitCode", 9], ["workerStdoutEof", false], ["workerStderrEof", false], ["doneEvidenceReceived", false], ["interrupted", true], ["selectedManifestSha256", null], ["bindingRechecked", false],
  ["clockFailure", true], ["cleanupFailure", true], ["pipesDestroyed", false], ["clockFailure", undefined], ["cleanupFailure", undefined], ["pipesDestroyed", undefined]] as const) {
  test(`capture ${key}=${String(value)} never qualifies`, async () => { const s = scenario(), c = completion(s.id, { [key]: value }); s.receipt = c.receipt; s.stdout = c.stdout; s.result.stdoutBytes = c.stdout.length; assert.equal((await runSyntheticInvocation(s.context)).assessment, "FAIL"); });
}
for (const exitCode of [1, 137, -1]) {
  test(`nonzero exit ${exitCode} stays exact and never qualifies`, async () => { const s = scenario(); s.result = { ...s.result, status: "FAIL", exitCode }; const r = await runSyntheticInvocation(s.context); assert.equal(r.assessment, "FAIL"); assert.equal(r.outerWitness?.exitCode, exitCode); });
}
test("contradictory runner PASS never establishes EOF", async () => { const s = scenario(); s.result.exitCode = 9; const r = await runSyntheticInvocation(s.context); assert.notEqual(r.assessment, "PASS"); assert.equal(r.outerWitness, null); });
test("fresh invocation identities distinguish two observations by the same actual caller PID", async () => {
  const first = await runSyntheticInvocation(scenario().context), second = await runSyntheticInvocation(scenario().context);
  assert.equal(first.callerPid, second.callerPid); assert.notEqual(first.invocationInstanceId, second.invocationInstanceId); assert.notEqual(first.clockDomain, second.clockDomain);
});
for (const [outerStart, supervisorOrigin, workerStart] of [[0, 9000000000000, 1], [9000000000000, 1, 5000], [3, 2000, 8000000000000], [4000000000, 7000000000, 100], [7000000000, 4000000000, 9000000000]]) {
  for (const elapsed of [1, 119999, 120000, 120001]) {
    test(`independent outer/supervisor/worker epochs ${outerStart}/${supervisorOrigin}/${workerStart} with outer elapsed ${elapsed}`, async () => {
      const s = scenario(); install(s, completion(s.id, {}, supervisorOrigin, workerStart)); s.time = outerStart!;
      const runner = s.context.runner; s.context.runner = async (...args) => { const result = await runner(...args); s.time = outerStart! + elapsed; return result; };
      const result = await runSyntheticInvocation(s.context);
      assert.equal(result.assessment, elapsed < 120000 ? "PASS" : "FAIL"); assert.equal(result.startedMonoMs, outerStart); assert.equal(result.completionObservedMonoMs, outerStart! + elapsed);
      const receipt = JSON.parse(s.receipt!.toString("utf8")) as Record<string, unknown>;
      assert.equal(receipt["origin"], supervisorOrigin); assert.deepEqual(result.expectedIdentity, s.id);
    });
  }
}
test("equal outer readings remain truthful but cannot qualify as positive elapsed time", async () => {
  const s = scenario(), runner = s.context.runner; s.context.runner = async (...args) => { const result = await runner(...args); s.time = 1000; return result; };
  const result = await runSyntheticInvocation(s.context); assert.equal(result.assessment, "FAIL"); assert.equal(result.clockFailure, null);
  assert.equal(result.outerWitness?.startedMonoMs, 1000); assert.equal(result.outerWitness?.completionObservedMonoMs, 1000); assert.ok(result.failures.includes("invocation-outer-elapsed"));
});
test("outer elapsed arithmetic remains local near the largest safe timestamp", async () => {
  const s = scenario(), runner = s.context.runner; s.time = Number.MAX_SAFE_INTEGER - 1;
  s.context.runner = async (...args) => { const result = await runner(...args); s.time = Number.MAX_SAFE_INTEGER; return result; };
  const result = await runSyntheticInvocation(s.context); assert.equal(result.assessment, "PASS"); assert.equal(result.completionObservedMonoMs! - result.startedMonoMs!, 1);
});
test("equal adjacent inner-domain samples remain valid with positive independent outer elapsed time", async () => {
  const s = scenario(), c = completion(s.id, { workerTiming: { clockDomain: clockDomain("offline-outer-only", "worker", 212), workerStartMonoMs: 0, requestStartsMonoMs: [0, 0] },
    deadlineSnapshot: { clockDomain: clockDomain("offline-outer-only", "supervisor", 211), observedMonoMs: 2000, operationDeadlineMonoMs: 122000, observedExceeded: false } });
  install(s, c); candidate(s, value => { value["candidatePreparationMonoMs"] = 2000; });
  assert.equal((await runSyntheticInvocation(s.context)).assessment, "PASS");
});
for (const invalid of [NaN, Infinity, -Infinity, -1, 0.25, Number.MAX_SAFE_INTEGER + 1, "1" as unknown as number, null as unknown as number]) {
  test(`invalid outer start ${String(invalid)} prevents invocation`, async () => {
    const s = scenario(); s.context.clock = () => invalid;
    const result = await runSyntheticInvocation(s.context); assert.equal(result.assessment, "FAIL"); assert.equal(s.calls, 0); assert.equal(result.startedMonoMs, null);
    assert.equal(result.outerWitness, null); assert.equal(result.runnerThrown, null); assert.equal(result.clockFailure, "clock-invalid-or-regressed");
    assert.equal(fs.existsSync(join(s.base, "synthetic-operation")), false);
  });
}
for (const invalid of [NaN, Infinity, -Infinity, -1, 999, 1000.5, Number.MAX_SAFE_INTEGER + 1]) {
  test(`invalid or regressed outer completion ${String(invalid)} cannot be replaced by a later sample`, async () => {
    const s = scenario(), runner = s.context.runner; let reads = 0;
    s.context.clock = () => ++reads === 1 ? 1000 : reads === 2 ? invalid : 3000;
    s.context.runner = async (...args) => runner(...args);
    const result = await runSyntheticInvocation(s.context); assert.equal(result.assessment, "FAIL"); assert.equal(result.runner?.status, "PASS"); assert.equal(s.calls, 1);
    assert.equal(reads, 2); assert.equal(result.startedMonoMs, 1000); assert.equal(result.completionObservedMonoMs, null); assert.equal(result.outerWitness, null);
    assert.equal(result.runnerThrown, null); assert.equal(result.clockFailure, "clock-invalid-or-regressed");
  });
}
test("runner throw with regressed completion keeps both failures without retry or invented witness", async () => {
  const s = scenario(); let reads = 0; s.context.clock = () => ++reads === 1 ? 1000 : 999;
  s.context.runner = async () => { s.calls++; throw Error("owned-launcher-failure"); };
  const result = await runSyntheticInvocation(s.context); assert.equal(result.assessment, "FAIL"); assert.equal(reads, 2); assert.equal(s.calls, 1);
  assert.equal(result.runnerThrown, "owned-launcher-failure"); assert.equal(result.clockFailure, "clock-invalid-or-regressed"); assert.equal(result.outerWitness, null);
});
test("post-operation work cannot replace completion time or extend the outer bracket", async () => {
  const s = scenario(), readiness = s.context.readiness; let readinessCalls = 0, clockReads = 0;
  s.context.clock = () => { clockReads++; return s.time; };
  s.context.readiness = id => { if (++readinessCalls === 3) s.time = 9000000000000; return readiness(id); };
  const result = await runSyntheticInvocation(s.context); assert.equal(result.assessment, "PASS"); assert.equal(result.completionObservedMonoMs, 3000); assert.equal(clockReads, 2);
  assert.equal(result.postWritesWithinOperationDeadlineClaimed, false);
});
for (const domain of ["", "shared-epoch", "clock:supervisor:211", "clock:worker:212", "clock:outer:0", "clock:outer:-1", "clock:outer:1.5", `clock:outer:${Number.MAX_SAFE_INTEGER + 1}`, `${"x".repeat(129)}:outer:1`, "clock:outer:1:offset"]) {
  test(`assessor rejects invalid outer provenance domain ${domain}`, () => {
    const id = identity(), c = completion(id), outer: OuterWitness = { clockDomain: domain, exitCode: 0, stdoutEof: true, stderrEof: true, stderrBytes: 0, startedMonoMs: 9000000000000, completionObservedMonoMs: 9000000000001, timedOut: false };
    assert.equal(assessCapture(c.receipt, c.stdout, outer, id), "FAIL");
  });
}
test("legacy outer witness without a domain cannot qualify", () => {
  const id = identity(), c = completion(id), outer = { exitCode: 0, stdoutEof: true, stderrEof: true, stderrBytes: 0, startedMonoMs: 1000, completionObservedMonoMs: 3000, timedOut: false } as OuterWitness;
  assert.equal(assessCapture(c.receipt, c.stdout, outer, id), "FAIL");
});
for (const change of ["supervisor-domain", "worker-domain", "snapshot-domain", "worker-timing-domain", "worker-order", "snapshot-order", "candidate-domain", "candidate-order", "legacy-candidate", "legacy-receipt"]) {
  test(`caller rejects ${change} independently of timely local outer clocks`, async () => {
    const s = scenario(), receipt = JSON.parse(s.receipt!.toString("utf8")) as Record<string, unknown>;
    if (change === "supervisor-domain") receipt["supervisorDomain"] = "wrong:supervisor:211";
    else if (change === "worker-domain") receipt["workerDomain"] = "wrong:worker:212";
    else if (change === "snapshot-domain") (receipt["deadlineSnapshot"] as Record<string, unknown>)["clockDomain"] = receipt["workerDomain"];
    else if (change === "worker-timing-domain") (receipt["workerTiming"] as Record<string, unknown>)["clockDomain"] = receipt["supervisorDomain"];
    else if (change === "worker-order") (receipt["workerTiming"] as Record<string, unknown>)["requestStartsMonoMs"] = [5000, 4999];
    else if (change === "snapshot-order") (receipt["deadlineSnapshot"] as Record<string, unknown>)["observedMonoMs"] = 122000;
    else if (change === "legacy-receipt") { delete receipt["supervisorDomain"]; delete receipt["workerDomain"]; delete receipt["workerTiming"]; delete (receipt["deadlineSnapshot"] as Record<string, unknown>)["clockDomain"]; }
    s.receipt = encoded(receipt);
    candidate(s, value => {
      value["consumptionReceiptSha256"] = sha(s.receipt!);
      if (change === "candidate-domain") value["supervisorDomain"] = receipt["workerDomain"];
      else if (change === "candidate-order") value["candidatePreparationMonoMs"] = 122000;
      else if (change === "legacy-candidate") delete value["supervisorDomain"];
    });
    const result = await runSyntheticInvocation(s.context); assert.equal(result.assessment, "FAIL"); assert.equal(result.outerWitness?.completionObservedMonoMs, 3000);
  });
}
test("missing completion stdout never qualifies and preserves the remaining evidence", async () => {
  const s = scenario(), runner = s.context.runner;
  s.context.runner = async (...args) => { const result = await runner(...args); fs.renameSync(join(s.base, "observer/command.stdout"), join(s.base, "observer/partial.stdout")); return result; };
  const result = await runSyntheticInvocation(s.context); assert.equal(result.assessment, "FAIL"); assert.equal(result.stdoutSha256, null); assert.equal(fs.existsSync(join(s.base, "observer/partial.stdout")), true);
});
test("nondeadline failure text cannot establish a timeout or EOF", async () => {
  const s = scenario(); s.result = { ...s.result, status: "FAIL", failure: "Error: COMMAND_DEADLINE" };
  const result = await runSyntheticInvocation(s.context); assert.equal(result.assessment, "FAIL"); assert.equal(result.outerWitness?.exitCode, 0);
  assert.equal(result.outerWitness?.timedOut, false); assert.equal(result.outerWitness?.stdoutEof, false); assert.equal(result.outerWitness?.stderrEof, false);
});
test("valid readiness binds source, observer, caller and both proofs without writing a binding", () => {
  const before = bindingDataState(READY), s = readyFiles(); assert.equal(validateInvocationReady(s.id, s.read).identitySha256, sha(encoded(s.id)));
  assert.deepEqual(bindingDataState(READY), before);
});
for (const change of ["missing", "authorizing", "caller-review", "capture-review", "identity", "caller-hash", "observer-hash", "source-hash", "capture-proof", "invocation-proof", "manifest", "typecheck", "tests", "production", "old-clock-proof", "capture-proof-mismatch", "unmatched-source-proof", "extra-key"]) {
  test(`readiness rejects ${change}`, () => {
    const s = readyFiles(), ready = s.ready, invocationProof = ready["invocationProof"] as { path: string; sha256: string };
    if (change === "missing") s.files.delete(READY);
    else if (change === "authorizing") ready["nonAuthorizing"] = false;
    else if (change === "caller-review") (ready["reviews"] as Record<string, unknown>)["caller"] = "NOT_READY";
    else if (change === "capture-review") ((ready["reviews"] as Record<string, unknown>)["capture"] as Record<string, unknown>)["security"] = "NOT_READY";
    else if (change === "identity") ready["identitySha256"] = "f".repeat(64);
    else if (change.endsWith("-hash")) { const kind = change.split("-")[0] as "caller" | "observer" | "source"; const path = Object.keys(invocationHashes()[kind])[0]!; s.files.set(path, Buffer.from("drift")); }
    else if (change === "capture-proof") s.files.set((ready["captureProof"] as { path: string }).path, Buffer.from("{}"));
    else if (change === "invocation-proof") s.files.set(invocationProof.path, Buffer.from("{}"));
    else if (change === "manifest") s.files.set(`${dirname(invocationProof.path)}/source-manifest.json`, Buffer.from("{}"));
    else if (["typecheck", "tests", "production", "old-clock-proof", "capture-proof-mismatch", "unmatched-source-proof"].includes(change)) {
      if (change === "old-clock-proof") delete s.caller["clockContract"];
      else if (change === "capture-proof-mismatch") s.caller["captureProof"] = { path: `${SOURCE}/verification-998/receipt.json`, sha256: "f".repeat(64) };
      else if (change === "unmatched-source-proof") s.caller["captureProofMatchesSource"] = false;
      else s.caller[change === "typecheck" ? "typecheckExitCode" : change === "tests" ? "testsFailed" : "productionEntryInvoked"] = change === "production" ? true : 1;
      const bytes = encoded(s.caller); s.files.set(invocationProof.path, bytes); invocationProof.sha256 = sha(bytes);
    }
    else ready["extra"] = true;
    if (change !== "missing") s.files.set(READY, encoded(ready));
    assert.throws(() => validateInvocationReady(s.id, s.read));
  });
}
function verificationRun(): VerificationRun {
  const text = "66 pass\n0 fail\n";
  return { result: { status: "PASS", exitCode: 0, failure: null, stdoutBytes: Buffer.byteLength(text), stderrBytes: 0 }, thrown: null, readFailure: null,
    stdoutBytes: Buffer.byteLength(text), stderrBytes: 0, stdoutSha256: sha(Buffer.from(text)), stderrSha256: sha(Buffer.alloc(0)), text };
}
test("offline binding data may exist but synthetic content mutation fails verification", () => {
  const base = fixture(), path = join(base, "binding-data.json"), rel = relative(ROOT, path);
  exclusive(path, encoded({ nonAuthorizing: true, value: "before" }));
  const before = bindingDataState(rel); assert.deepEqual(bindingDataState(rel), before);
  fs.writeFileSync(path, encoded({ nonAuthorizing: true, value: "after" }));
  const matches = equal(before, bindingDataState(rel)); assert.equal(matches, false);
  assert.equal(assessVerification(verificationRun(), verificationRun(), matches, true, true).status, "FAIL_OFFLINE_ONLY");
});
test("unchanged binding bytes do not conceal synthetic metadata mutation", () => {
  const base = fixture(), path = join(base, "binding-data.json"), rel = relative(ROOT, path);
  exclusive(path, encoded({ nonAuthorizing: true })); const before = bindingDataState(rel);
  fs.utimesSync(path, 0, 0); const after = bindingDataState(rel);
  assert.equal(equal(before, after), false);
  assert.equal(assessVerification(verificationRun(), verificationRun(), equal(before, after), true, true).status, "FAIL_OFFLINE_ONLY");
});
test("optional absent binding data does not grant permission or become an operational path", () => {
  const rel = relative(ROOT, join(fixture(), "absent-binding.json")); assert.deepEqual(bindingDataState(rel), { exists: false });
  const seen: string[] = [];
  assert.equal(productionAbsent(path => { seen.push(path); return { exists: false }; }), true);
  assert.deepEqual(seen, [OP, RAW, OUTPUT, INVOCATION]);
});
for (const path of [OP, RAW, OUTPUT, INVOCATION]) {
  test(`offline verification still rejects operational presence at ${path}`, () => {
    const absent = productionAbsent(candidate => ({ exists: candidate === path })); assert.equal(absent, false);
    assert.equal(assessVerification(verificationRun(), verificationRun(), true, absent, true).status, "FAIL_OFFLINE_ONLY");
  });
}
test("binding data remains bounded before loading", () => {
  const path = join(fixture(), "overcap-binding.json"); exclusive(path, Buffer.alloc(CAPS.receipt + 1), CAPS.receipt + 1);
  assert.throws(() => bindingDataState(relative(ROOT, path)), /regular-file-cap/);
});
test("binding data rejects synthetic directories", () => {
  const path = join(fixture(), "directory-binding"); fresh(path); assert.throws(() => bindingDataState(relative(ROOT, path)), /regular-file-cap/);
});
test("binding data rejects synthetic symlinks", () => {
  const base = fixture(), target = join(base, "regular.json"), link = join(base, "binding-link.json"); exclusive(target, encoded({ nonAuthorizing: true }));
  fs.symlinkSync(target, link); assert.throws(() => bindingDataState(relative(ROOT, link)));
});
test("verification assessment reports only observed counts and documented complete command results", () => {
  assert.deepEqual(assessVerification(verificationRun(), verificationRun(), true, true, true), { status: "PASS_OFFLINE_ONLY", testsPassed: 66, testsFailed: 0 });
});
for (const change of ["runner-fail", "exit", "deadline", "throw", "output-read", "stdout-count", "stderr-count", "missing-output-hash", "invalid-output-count", "source-drift", "production-present", "source-proof-mismatch", "typecheck-fail", "missing-summary", "duplicate-summary", "noninteger-summary", "unsafe-summary", "zero-tests", "failed-tests"]) {
  test(`verification assessment cannot convert ${change} into PASS`, () => {
    const tests = verificationRun(), types = verificationRun(); let readchecks = true, absent = true, proofMatches = true;
    if (change === "runner-fail") tests.result!.status = "FAIL";
    else if (change === "exit") tests.result!.exitCode = 1;
    else if (change === "deadline") tests.result!.failure = "COMMAND_DEADLINE";
    else if (change === "throw") tests.thrown = "launcher-failed";
    else if (change === "output-read") tests.readFailure = "regular-file-cap";
    else if (change === "stdout-count") tests.result!.stdoutBytes++;
    else if (change === "stderr-count") tests.result!.stderrBytes++;
    else if (change === "missing-output-hash") tests.stdoutSha256 = null;
    else if (change === "invalid-output-count") { tests.stdoutBytes = -1; tests.result!.stdoutBytes = -1; }
    else if (change === "source-drift") readchecks = false;
    else if (change === "production-present") absent = false;
    else if (change === "source-proof-mismatch") proofMatches = false;
    else if (change === "typecheck-fail") types.result!.status = "FAIL";
    else if (change === "missing-summary") tests.text = "";
    else if (change === "duplicate-summary") tests.text += "66 pass\n0 fail\n";
    else if (change === "noninteger-summary") tests.text = "66.5 pass\n0 fail\n";
    else if (change === "unsafe-summary") tests.text = "9007199254740992 pass\n0 fail\n";
    else if (change === "zero-tests") tests.text = "0 pass\n0 fail\n";
    else tests.text = "66 pass\n1 fail\n";
    const result = assessVerification(tests, types, readchecks, absent, proofMatches); assert.equal(result.status, "FAIL_OFFLINE_ONLY");
    if (["missing-summary", "duplicate-summary", "noninteger-summary", "unsafe-summary"].includes(change)) assert.equal(result.testsPassed, null);
  });
}
test("existing bounded runner kills an owned offline hanging Bun fixture", async () => {
  const base = fixture(), evidence = join(base, "bounded-timeout"); fresh(evidence);
  const child = join(base, "owned-hanging-child.ts"), heartbeat = join(base, "heartbeat");
  exclusive(child, Buffer.from('import { appendFileSync } from "node:fs";\nconst file = process.argv[2]!;\nappendFileSync(file, "start\\n");\nsetInterval(() => appendFileSync(file, "tick\\n"), 20);\n'));
  const started = now(), result = await runBounded([BUN, "--no-env-file", "--no-install", child, heartbeat], evidence, 500, { cwd: ROOT, environment: { ...ENVIRONMENT } });
  assert.equal(result.status, "FAIL"); assert.equal(result.failure, "COMMAND_DEADLINE"); assert.ok(now() - started < 5000);
  assert.equal(fs.existsSync(heartbeat), true); const size = fs.statSync(heartbeat).size;
  await new Promise<void>(resolveWait => setTimeout(resolveWait, 100)); assert.equal(fs.statSync(heartbeat).size, size);
  exclusive(join(base, "timeout-result.json"), encoded(result));
});
