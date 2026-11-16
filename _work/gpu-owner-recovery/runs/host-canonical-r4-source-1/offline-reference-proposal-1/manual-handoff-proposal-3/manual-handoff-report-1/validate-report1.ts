// SPEC: _spec/manual-handoff-implementation-3.puml
import * as fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const P = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3", R = `${P}/manual-handoff-report-1`;
function read(path: string): Buffer {
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd, { bigint: true }); assert(before.isFile() && before.size >= 0n && before.size <= 1048576n);
    const b = Buffer.alloc(Number(before.size) + 1); let offset = 0;
    while (offset < b.length) { const n = fs.readSync(fd, b, offset, b.length - offset, null); if (!n) break; offset += n; }
    const after = fs.fstatSync(fd, { bigint: true }); assert.equal(offset, Number(before.size));
    for (const key of ["dev", "ino", "size", "mtimeNs", "ctimeNs"] as const) assert.equal(before[key], after[key]); return b.subarray(0, offset);
  } finally { fs.closeSync(fd); }
}
const identity = (bytes: Buffer) => ({ bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), gitBlobOid: createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") });
const json = (path: string): any => JSON.parse(read(path).toString("utf8"));
function pin(path: string) { return { path, ...identity(read(path)) }; }
function emit(path: string, value: unknown) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + "\n"); assert(bytes.length <= 1048576);
  const fd = fs.openSync(path, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW | fs.constants.O_WRONLY, 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } return pin(path);
}
const report = json(`${R}/operator-report.json`), consumption = json(`${R}/consumption.json`), transcript = read(report.consoleRecord.path).toString("utf8");
const events = transcript.split("\n").filter(line => line.startsWith("{")).map(line => JSON.parse(line));
assert.deepEqual(events.map(row => row.phase), ["preflight", "claimed", "request-start", "http-status", "http-wait", "http-wait", "http-wait", "validated", "materializing", "sealed", "inner-caller-launch", "terminal"]);
assert.equal(events.filter(row => row.phase === "claimed").length, 1); assert.equal(events[1].attemptsConsumed, 1);
assert.equal(events[3].statusCode, 200); assert.equal(events[7].files, 66);
const progress = events.filter(row => row.phase === "http-wait"); assert.deepEqual(progress.map(({ phase: _phase, statusCode: _status, ...row }) => row), report.reportedSourceResponse.progress);
for (let i = 1; i < progress.length; i++) { assert(progress[i].elapsedMs > progress[i - 1].elapsedMs); assert(progress[i].remainingMs < progress[i - 1].remainingMs); assert(progress[i].receivedBytes > progress[i - 1].receivedBytes); }
assert.equal(report.reportedSourceResponse.finalResponseBytes, null); assert.equal(events[9].status, report.reportedSealStatus);
assert.equal(events[10].remainingMs, null); const { phase: _launchPhase, ...launch } = events[10]; assert.deepEqual(launch, report.reportedInnerCallerLaunch);
const { phase: _terminalPhase, ...terminal } = events[11]; assert.deepEqual(terminal, report.reportedTerminal);
assert(transcript.endsWith("launcher_exit_status=1\n")); assert.equal(report.reportedLauncherExitStatus, 1);
assert.equal(report.evidenceScope, "REPORT"); assert.equal(report.consoleRecord.originalHostStreamBytesOrChannelSeparationClaimed, false);
assert.deepEqual(consumption.consumedUnderAcceptedReport, { handoffAttempts: 1, anonymousSourceGets: 1 }); assert.deepEqual(consumption.remainingUnderAcceptedReport, { handoffAttempts: 0, anonymousSourceGets: 0 });
assert.equal(consumption.innerConsumptionFromThisReport, "UNCONFIRMED"); assert.equal(consumption.innerClaimOrConsumptionInferredFromLaunchAnnouncement, false);
assert.equal(consumption.retryOrReplayAuthorized, false); assert.equal(consumption.newHandoffSourceInnerOrPublicationAllowanceAdded, 0);
assert.equal(report.actualOwnedResourceLeakEstablished, false); assert.equal(report.trainingReady, false);
assert.equal(pin(`${P}/approval3.json`).sha256, "5e8edc68ad5936cc9d919a9adb7030536ecf0da854b263c170ebec08a06cc121");
assert.equal(json(`${P}/source-review-result-6.json`).readyCount, 12); assert.equal(json(`${P}/source-review-result-8.json`).readyCount, 4);
fs.mkdirSync(`${R}/spec-baseline1`, { mode: 0o700 });
const goals = ["_spec/manual-handoff-implementation-3.puml", "_spec/.spec-index.json", "_spec/runtime-protocol.puml"].map((path, i) => ({ originalPath: path, ...emit(`${R}/spec-baseline1/${["spec-goal.puml", "spec-index.json", "runtime-discovery.puml"][i]}`, read(path)) }));
const baseline = emit(`${R}/spec-baseline1/manifest.json`, { version: "chess-coach.h3-host-report-goal-baseline.v1", nonAuthorizing: true, goals, currentPublishedCommandCommit: report.publishedCommandCommitOid, sourceAndAuthorityFilesModified: false });
const receipt = emit(`${R}/report-validation1.json`, { version: "chess-coach.h3-host-report-validation.v1", status: "PASS_REPORT_TRANSCRIPTION_ACCOUNTING_AND_FROZEN_ISSUANCE_CONSISTENCY", evidenceScope: "REPORT", nonAuthorizing: true, report: pin(`${R}/operator-report.json`), console: pin(report.consoleRecord.path), consumption: pin(`${R}/consumption.json`), phaseRecords: events.length, consoleOrderAndTerminalMatch: true, lastProgressBytesNotFinalResponseTotal: true, sourceAndHandoffBalances: { handoffAttempts: 0, anonymousSourceGets: 0 }, innerConsumption: "UNCONFIRMED", historicalSourceVerdictsAndIssuanceSnapshotsUnchanged: true, originalHostCaptureRequiredForReportAcceptance: false, privateHostOutcomeReadByAssistant: false, goalBaseline: baseline, actualHandoffOrAcquisitionReplayed: false, publicationAuthorityAdded: 0, trainingReady: false });
process.stdout.write(JSON.stringify({ status: "PASS_H3_REPORT_ACCEPTANCE_AND_ACCOUNTING", receipt, baseline, handoffBalance: 0, sourceGetBalance: 0, innerConsumption: "UNCONFIRMED", trainingReady: false }) + "\n");
