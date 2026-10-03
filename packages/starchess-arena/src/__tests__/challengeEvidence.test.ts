import { describe, expect, it } from "vitest";
import { CHALLENGE_CONFIG } from "../challenge/config";
import { loadPinnedCorpus } from "../challenge/corpus";
import { classifyScheduledEvidence, executionIntegrity, normalizeEvidence, summarize } from "../challenge/evidence";
import { runChallengeMatch } from "../challenge/runChallengeMatch";
import { buildSchedule, expectedMatch, loadTrustedExecutionContext } from "../challenge/schedule";
import { runSupervised } from "../challenge/supervisor";

describe("baseline execution evidence", () => {
  it("compares semantic boards/resolves/outcomes and retains deterministic event IDs", async () => {
    const request = buildSchedule(loadPinnedCorpus())[0]!;
    const first = await runChallengeMatch(request);
    const second = await runChallengeMatch(request);
    expect(normalizeEvidence(second)).toBe(normalizeEvidence(first));
    expect(executionIntegrity(first)).toBe(true);
    const altered = structuredClone(second);
    altered.resolves[0]!.events[0]!.id = "changed-event";
    expect(normalizeEvidence(altered)).not.toBe(normalizeEvidence(first));
  });

  it("never turns baseline, historical labels, exhaustion, or caps into learned wins", async () => {
    const request = buildSchedule(loadPinnedCorpus())[0]!;
    const run = await runChallengeMatch(request, { limits: { maxWindows: 0, maxRecordedPlies: 0 } });
    expect(run.outcome).toBeNull();
    const context = loadTrustedExecutionContext("corpus");
    const summary = summarize([run], context);
    expect(summary.corpus.scheduled).toBe(18);
    expect(summary.corpus.wins).toBe(0);
    expect(summary.corpus.wins + summary.corpus.losses + summary.corpus.draws + summary.corpus.failures).toBe(18);
    expect(run.learnedGateEligible).toBe(false);
    const fabricated = { ...run, outcome: { winner: "b" as const, draw: false as const }, stop: { ...run.stop, kind: "terminal" as const } };
    expect(executionIntegrity(fabricated)).toBe(false);
    expect(summarize([fabricated], context).corpus.wins).toBe(0);
    const protocolFailure = { ...run, stop: { ...run.stop, kind: "script-contract" as const } };
    expect(executionIntegrity(protocolFailure)).toBe(false);
  });

  it("detects changed debits, out-of-range banks, and contradictory resolve bodies", async () => {
    const run = await runChallengeMatch(buildSchedule(loadPinnedCorpus())[0]!);
    const ledger = structuredClone(run);
    ledger.bankTrail[0]!.b = 99;
    expect(executionIntegrity(ledger)).toBe(false);
    const resolve = structuredClone(run);
    resolve.resolves[0]!.resolved.moves = [];
    expect(executionIntegrity(resolve)).toBe(false);
    const bank = structuredClone(run);
    bank.finalBank.b = 0;
    expect(executionIntegrity(bank)).toBe(false);
  });

  it("rejects a real corpus execution relabelled as a different pinned White trace", async () => {
    const schedule = buildSchedule(loadPinnedCorpus());
    const run = await runChallengeMatch(schedule[0]!);
    expect(executionIntegrity(run)).toBe(true);
    expect(executionIntegrity({ ...run, match: schedule[1]! })).toBe(false);
    const changedOrdinal = structuredClone(run);
    changedOrdinal.stop.planningOrdinal++;
    expect(executionIntegrity(changedOrdinal)).toBe(false);
    const forged = structuredClone(run);
    forged.match.trace!.traceSha256 = "0".repeat(64);
    forged.match.trace!.windows[0]!.actions = [];
    expect(executionIntegrity(forged)).toBe(false);
    expect(() => expectedMatch({ version: "trusted-execution-context-v1" }, run.match.key)).toThrow("untrusted execution context");
  });

  it("fails a known case locally and the whole roster for an unattributable row", async () => {
    const context = loadTrustedExecutionContext("corpus");
    const schedule = buildSchedule(loadPinnedCorpus());
    const run = await runChallengeMatch(schedule[0]!);
    const local = classifyScheduledEvidence([run, structuredClone(run)], context);
    expect(local.acceptanceValid).toBe(false);
    expect(local.cases.find((entry) => entry.key === run.match.key)?.failureReason?.kind).toBe("duplicate-record");
    expect(local.cases.filter((entry) => entry.key !== run.match.key).every((entry) => entry.failureReason?.kind === "missing-record")).toBe(true);
    const global = classifyScheduledEvidence([run, { match: { key: "not-a-roster-id" } }], context);
    expect(global.acceptanceValid).toBe(false);
    expect(global.anomalies).toEqual([{ kind: "unattributable", key: "not-a-roster-id" }]);
    expect(global.cases.every((entry) => entry.bucket === "failure" && entry.failureReason?.kind === "schedule-anomaly")).toBe(true);
    expect(global.cases.reduce((sum, entry) => sum + 1, 0)).toBe(18);
  });

  it("keeps trace-owned rejection witnesses compatible while validating their contents", async () => {
    const context = loadTrustedExecutionContext("corpus");
    const request = buildSchedule(loadPinnedCorpus())[0]!;
    const current = await runChallengeMatch(request);
    expect(current.stop).toMatchObject({ kind: "queue-rejected", side: "w" });
    expect(current.stop.rejectedQueue).toBeDefined();
    const historical = structuredClone(current);
    delete historical.stop.rejectedQueue;
    expect(executionIntegrity(current, true, context)).toBe(true);
    expect(executionIntegrity(historical, true, context)).toBe(true);
    expect(normalizeEvidence(current)).toBe(normalizeEvidence(historical));
    const forged = structuredClone(current);
    forged.stop.rejectedQueue = [];
    expect(executionIntegrity(forged, true, context)).toBe(false);
    const reference = structuredClone(current);
    reference.stop.sourcePlyIndex!++;
    expect(normalizeEvidence(reference)).not.toBe(normalizeEvidence(current));
    const otherSide = structuredClone(current);
    otherSide.stop.side = "b";
    const otherWithoutWitness = structuredClone(otherSide);
    delete otherWithoutWitness.stop.rejectedQueue;
    expect(normalizeEvidence(otherSide)).not.toBe(normalizeEvidence(otherWithoutWitness));
  });

  it("runs the production supervised worker with pinned config and matches in-process semantics", async () => {
    const request = buildSchedule(loadPinnedCorpus())[0]!;
    const expected = await runChallengeMatch(request);
    const actual = await runSupervised(request);
    expect(actual.stop.kind).not.toBe("script-contract");
    expect(normalizeEvidence(actual)).toBe(normalizeEvidence(expected));
    expect(CHALLENGE_CONFIG.feed).toBe("off");
  }, 20000);
});
