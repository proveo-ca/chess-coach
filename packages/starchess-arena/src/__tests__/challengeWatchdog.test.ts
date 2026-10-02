// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { describe, expect, it } from "vitest";
import { beginScTurn, endScTurn, formatScFen, normalizeSnapGas, parseScFen } from "@chess-coach/starchess-core";
import { seedBankForOpening, grantStoredIncome } from "../run/bank";
import { commitPair, stageQueue } from "../challenge/admission";
import { runSupervised } from "../challenge/supervisor";
import { replayExecutionIntegrity } from "../challenge/integrity";
import type { ChallengeEvidence, ScheduledMatch } from "../challenge/types";

const opening = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
const request = (key: string): ScheduledMatch => ({
  key, suite: "live-strategic", candidateSide: "w", arenaSeed: 42, inferenceSeed: 0, opening,
});
const workerUrl = new URL("./fixtures/challengeWorker.ts", import.meta.url);
const budgets = { startupMs: 3000, planMs: 100, matchMs: 1500 };
const run = (key: string, override: Partial<typeof budgets> = {}) =>
  runSupervised(request(key), { workerUrl, budgets: { ...budgets, ...override } });
const expectFailure = (evidence: ChallengeEvidence, key: string) => {
  expect(evidence.match).toEqual(request(key));
  expect(evidence).toMatchObject({
    outcome: null, policy: "baseline-v1", modelArtifact: null,
    learnedGateEligible: false, fallbackCount: 0,
  });
  expect(evidence.stop.reason).toEqual(expect.any(String));
  expect(evidence.scfens.length).toBe(evidence.resolves.length + 1);
  expect(evidence.bankTrail.length).toBe(evidence.resolves.length);
};

describe("challenge child watchdog", () => {
  it("rejects a child announcement that cancels an unfinished decision", async () => {
    const evidence = await runSupervised(request("announcement-escape"), {
      workerUrl: new URL("./fixtures/challengeAnnouncementEscape.ts", import.meta.url),
      budgets: { ...budgets, matchMs: 300 },
    });
    expect(evidence.stop.kind).toBe("script-contract");
  });
  it("reaps a child that never becomes ready", async () => {
    const evidence = await runSupervised(request("startup-hang"), {
      workerUrl: new URL("./fixtures/challengeStartupHang.ts", import.meta.url),
      budgets: { ...budgets, startupMs: 500 },
    });
    expectFailure(evidence, "startup-hang");
    expect(evidence.stop).toMatchObject({ kind: "watchdog", phase: "startup", reason: "startup timeout" });
    expect(evidence.resolves).toEqual([]);
  });

  it.each(["plan-loop", "plan-promise"])("interrupts %s at the planning deadline", async (key) => {
    const evidence = await run(key);
    expectFailure(evidence, key);
    expect(evidence.stop).toMatchObject({
      kind: "watchdog", phase: key.includes("promise") ? "strategic-plan" : "candidate-plan",
      reason: "plan timeout", planningOrdinal: 0, turn: 0, side: key.includes("promise") ? "b" : "w",
    });
  });

  it("rejects a matching decision that arrives after the original deadline", async () => {
    const evidence = await run("late-decision");
    expectFailure(evidence, "late-decision");
    expect(evidence.stop).toMatchObject({ kind: "watchdog", reason: "plan timeout", side: "w" });
  });

  it("uses the match deadline outside a planning phase", async () => {
    const evidence = await run("match-loop", { matchMs: 200 });
    expectFailure(evidence, "match-loop");
    expect(evidence.stop).toMatchObject({ kind: "watchdog", phase: "ready", reason: "match timeout" });
  });

  it("does not renew the plan deadline for repeated phase messages", async () => {
    const evidence = await run("repeat-plan", { matchMs: 500 });
    expectFailure(evidence, "repeat-plan");
    expect(evidence.stop.reason).toBe("plan timeout");
  });

  it("does not renew the match deadline for progress messages", async () => {
    const evidence = await run("match-chatter", { matchMs: 200 });
    expectFailure(evidence, "match-chatter");
    expect(evidence.stop.reason).toBe("match timeout");
  });

  it("returns evidence when the child crashes", async () => {
    const evidence = await run("crash");
    expectFailure(evidence, "crash");
    expect(evidence.stop).toMatchObject({ kind: "exception", phase: "ready", planningOrdinal: 0, turn: 0 });
  });

  it.each([
    "malformed-identity", "malformed-arrays", "malformed-resolve", "malformed-outcome",
    "malformed-policy", "malformed-ply-prefix", "malformed-resolve-body", "malformed-scfens", "malformed-final-bank",
    "fabricated-terminal", "wrong-ledger", "altered-resolve", "invalid-stop",
  ])("rejects %s completion", async (key) => {
    const evidence = await run(key);
    expectFailure(evidence, key);
    expect(evidence.stop).toMatchObject({ kind: "script-contract", reason: "worker protocol error: malformed completion" });
  });

  it.each(["duplicate-ready", "malformed-phase", "malformed-ply", "unknown-message", "oversized-ply", "duplicate-ply", "oversized-frame"])("rejects %s IPC", async (key) => {
    const evidence = await run(key);
    expectFailure(evidence, key);
    expect(evidence.stop.kind).toBe("script-contract");
  });

  it("rejects progress before ready", async () => {
    const evidence = await runSupervised(request("before-ready"), {
      workerUrl: new URL("./fixtures/challengeBeforeReady.ts", import.meta.url), budgets,
    });
    expectFailure(evidence, "before-ready");
    expect(evidence.stop).toMatchObject({ kind: "script-contract", reason: "worker protocol error: message before ready" });
  });

  it.each(["ply-loop", "ply-promise", "ply-crash"])("preserves completed plies after %s", async (key) => {
    const evidence = await run(key);
    expectFailure(evidence, key);
    const snapshot = parseScFen(opening);
    const begun = beginScTurn(snapshot);
    const initialBank = seedBankForOpening(snapshot);
    const white = stageQueue(begun.next, initialBank, "w", [], 0);
    const black = stageQueue(begun.next, initialBank, "b", [], 0);
    if (!white.ok || !black.ok) throw new Error("fixture settlement did not admit");
    const committed = commitPair(begun.next, initialBank, white.staged, black.staged);
    const resolved = endScTurn(committed.snapshot, { skipTurnStartChecks: true });
    expect(evidence.scfens).toEqual([
      formatScFen(normalizeSnapGas(snapshot)), formatScFen(normalizeSnapGas(resolved.next)),
    ]);
    expect(evidence.resolves).toEqual([resolved]);
    expect(evidence.bankTrail).toEqual([grantStoredIncome(committed.bank, resolved.next.turn)]);
    expect(evidence.finalBank).toEqual(evidence.bankTrail[0]);
    expect(evidence.stop).toMatchObject({ planningOrdinal: 1, turn: resolved.next.turn });
  });

  it("derives failure counters from an accepted ply before the next phase arrives", async () => {
    const evidence = await run("ply-before-phase-crash");
    expectFailure(evidence, "ply-before-phase-crash");
    expect(evidence.stop).toMatchObject({ kind: "exception", phase: "settlement", planningOrdinal: 1, turn: 1 });
    expect(evidence.resolves).toHaveLength(1);
    expect(replayExecutionIntegrity(evidence, request("ply-before-phase-crash"))).toBe(true);
  });

  it("accepts normal completion only after reaping the child", async () => {
    const evidence = await run("normal") as ChallengeEvidence & { workerPid: number };
    expect(evidence.stop.kind).toBe("exception");
    expect(evidence.match).toEqual(request("normal"));
    expect(evidence.resolves).toHaveLength(1);
    expect(evidence.bankTrail).toHaveLength(1);
    expect(() => process.kill(evidence.workerPid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
  });

  it("returns evidence for launch configuration errors", async () => {
    const evidence = await runSupervised(request("bad-url"), {
      workerUrl: new URL("https://invalid.example/worker.ts"), budgets,
    });
    expectFailure(evidence, "bad-url");
    expect(evidence.stop.kind).toBe("exception");
  });
});
