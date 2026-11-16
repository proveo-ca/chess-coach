// SPEC: _spec/manual-handoff-implementation-3.puml
import { test } from "bun:test";
import assert from "node:assert/strict";
import { R, json, read, validate, type RecordValue } from "./acquisition-report1.ts";

const fixture = () => ({ observation: json(`${R}/observation.report.json`), attempt: json(`${R}/attempt.report.json`), receipt: json(`${R}/receipt.report.json`), bytes: read(`${R}/receipt.report.json`) });
test("REPORT consistency preserves failure and exhausted combined allowance", () => {
  const f = fixture(), result = validate(f.observation, f.attempt, f.receipt, f.bytes);
  assert.equal(result.evidenceScope, "REPORT"); assert.equal(result.retryAuthorized, false);
  assert.equal(result.outerElapsedMs, 30245); assert.equal(result.remainingCombinedAttempts, 0);
  assert.equal(result.npmGetsConsumed, 1); assert.equal(result.unusedGetSlots, 1); assert.equal(result.trainingReady, false);
});
const cases: Array<[string, (f: ReturnType<typeof fixture>) => void, unknown]> = [
  ["attempt identity", f => { f.attempt.attemptId = "wrong"; }, "wrong"],
  ["receipt attempt binding", f => { f.receipt.supervisorPid = 1; }, 1],
  ["observer receipt binding", f => { f.observation.receiptSha256 = "0".repeat(64); }, "0".repeat(64)],
  ["caller failure promotion", f => { f.observation.assessment = "PASS"; }, "PASS"],
  ["empty failure array does not imply runner PASS", f => { f.observation.runner.status = "PASS"; }, undefined],
  ["combined allowance refund", f => { f.receipt.remainingCombinedAttempts = 1; f.attempt.remainingCombinedAttempts = 1; }, 1],
  ["unused slot is not another GET", f => { f.receipt.actualGetRequests = 2; }, 2],
  ["response completion is not URL completion", f => { f.receipt.urlsCompleted = 1; }, 1],
  ["worker clock cannot become supervisor clock", f => { f.receipt.workerTiming.clockDomain = f.attempt.supervisorDomain; }, undefined],
  ["deadline snapshot stays supervisor-local", f => { f.receipt.deadlineSnapshot.clockDomain = f.receipt.workerDomain; }, undefined],
  ["global timeout cannot be invented", f => { f.observation.outerWitness.timedOut = true; }, true],
  ["EOF cannot be invented", f => { f.receipt.workerStdoutEof = true; }, true],
  ["null worker exit cannot be rewritten", f => { f.receipt.workerExitCode = 0; }, 0],
  ["selected output qualification cannot be invented", f => { f.receipt.selectedHashesAndMembershipVerified = true; }, true],
  ["retry remains unauthorized", f => { f.receipt.automaticRetryAuthorized = true; }, true],
  ["training remains blocked", f => { f.observation.trainingReady = true; }, true],
  ["nested source identity mismatch", f => { f.receipt.identity.bindings.plan = "0".repeat(64); }, undefined],
  ["same-length receipt mutation breaks observer hash", f => { f.bytes = Buffer.from(f.bytes.toString().replace('"terminalState":"FAIL"', '"terminalState":"PAIL"')); }, undefined]
];
for (const [name, mutate, expectedActual] of cases) test(`reject ${name}`, () => {
  const f = fixture(); mutate(f);
  assert.throws(() => validate(f.observation, f.attempt, f.receipt, f.bytes), error => {
    assert(error instanceof assert.AssertionError);
    if (expectedActual !== undefined) assert.deepEqual(error.actual, expectedActual);
    return true;
  });
});
test("reconstructed records do not claim original HOST captures", () => {
  const report = json(`${R}/acquisition-diagnostic-report-1.json`);
  assert.equal(report.originalsAreHostByteCaptures, false);
  for (const artifact of report.artifacts as RecordValue[]) { assert.equal(artifact.originalHostByteCapture, false); assert.equal(artifact.reportedBytes, artifact.localReconstruction.bytes); }
  assert.equal(report.observationAndAttemptOriginalHostHashesReported, false);
});
