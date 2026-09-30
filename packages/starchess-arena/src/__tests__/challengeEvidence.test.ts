import { describe, expect, it } from "vitest";
import { CHALLENGE_CONFIG } from "../challenge/config";
import { loadPinnedCorpus } from "../challenge/corpus";
import { executionIntegrity, normalizeEvidence, summarize } from "../challenge/evidence";
import { runChallengeMatch } from "../challenge/runChallengeMatch";
import { buildSchedule } from "../challenge/schedule";
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
    expect(summarize([run]).corpus).toMatchObject({ scheduled: 1, wins: 0, failures: 1 });
    expect(run.learnedGateEligible).toBe(false);
    const fabricated = { ...run, outcome: { winner: "b" as const, draw: false as const }, stop: { ...run.stop, kind: "terminal" as const } };
    expect(executionIntegrity(fabricated)).toBe(false);
    expect(summarize([fabricated]).corpus.wins).toBe(0);
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
