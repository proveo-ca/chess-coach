// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { describe, expect, it, vi } from "vitest";
import { energyForTurn, parseScFen, placementToMap, type ScActionInput } from "@chess-coach/starchess-core";
import { commitPair, stageQueue } from "../challenge/admission";
import { loadPinnedCorpus } from "../challenge/corpus";
import { runChallengeMatch } from "../challenge/runChallengeMatch";
import type { CandidatePolicy, ScheduledMatch } from "../challenge/types";
import { debitSpend, grantStoredIncome } from "../run/bank";

const corpus = loadPinnedCorpus();
const opening = corpus.manifest.openingScfen;
const live = (turn = 0): ScheduledMatch => ({
  key: "ledger-integrity", suite: "live-strategic", candidateSide: "b", arenaSeed: 0, inferenceSeed: 0,
  opening: `SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|${turn}|33|P|G:${energyForTurn(turn)}${energyForTurn(turn)}:${energyForTurn(turn)}${energyForTurn(turn)}|B:3:3|Q:w:;b:`,
});
const pass: CandidatePolicy = { name: "ledger-pass", choose: () => [] };
const strategicPass = { name: "ledger-strategic-pass", play: (snapshot: ReturnType<typeof parseScFen>) => ({ snapshot, spendMinerals: 0 }) };

describe("authoritative mineral admission and debits", () => {
  it.each([
    ["p", 1, 3], ["n", 3, 3], ["b", 3, 3], ["r", 5, 5], ["q", 9, 9],
  ] as const)("charges %s deployment exactly %i minerals", (unit, cost, available) => {
    const open = parseScFen(opening);
    const bank = { w: available, b: 3 };
    const action: ScActionInput = { kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1", unit };
    const white = stageQueue(open, bank, "w", [action], 0);
    const black = stageQueue(open, bank, "b", [], 0);
    expect(white).toMatchObject({ ok: true, staged: { spend: cost, gasAfter: 0 } });
    if (!white.ok || !black.ok) throw new Error("expected admitted pair");
    expect(commitPair(open, bank, white.staged, black.staged).bank).toEqual({ w: available - cost, b: 3 });
    expect(bank).toEqual({ w: available, b: 3 });
    expect(open.queue!.actions).toEqual([]);
  });

  it.each([["n", 2, 3], ["r", 3, 5], ["q", 3, 9]] as const)(
    "rejects unaffordable %s even though legacy debit would clamp bank %i to zero",
    (unit, available, required) => {
      const open = parseScFen(opening);
      const bank = { w: available, b: 3 };
      const before = structuredClone({ open, bank });
      expect(debitSpend(bank, "w", required)).toEqual({ w: 0, b: 3 });
      expect(stageQueue(open, bank, "w", [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1", unit }], 4)).toMatchObject({
        ok: false, failure: {
          kind: "queue-rejected", reason: "minerals", planningOrdinal: 4, actionIndex: 0,
          requiredMinerals: required, availableMinerals: available,
        },
      });
      expect({ open, bank }).toEqual(before);
    },
  );

  it("threads actual diverging deployment spends and income instead of historical future balances", async () => {
    const white: ScActionInput = { kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1", unit: "b" };
    const black: ScActionInput = { kind: "deploy", timing: "B", color: "b", from: "e8", to: "d8", unit: "p" };
    const choose = vi.fn().mockReturnValueOnce([black]).mockReturnValue([]);
    const candidate: CandidatePolicy = { name: "ledger-deploy", choose };
    const match: ScheduledMatch = {
      ...live(), suite: "corpus", opening,
      trace: { ...structuredClone(corpus.traces[0]!), windows: [
        { planningOrdinal: 0, sourcePlyIndex: 70, sourceTurn: 31, actions: [white] },
        { planningOrdinal: 1, sourcePlyIndex: 90, sourceTurn: 44, actions: [] },
      ] },
    };
    const before = structuredClone(match);
    const evidence = await runChallengeMatch(match, { candidate });
    expect(evidence.stop).toMatchObject({ kind: "trace-exhausted", planningOrdinal: 2, turn: 2 });
    expect(evidence.bankTrail).toEqual([{ w: 1, b: 3 }, { w: 2, b: 4 }]);
    expect(evidence.finalBank).toEqual({ w: 2, b: 4 });
    expect(choose.mock.calls.map(([observation]) => observation.own.minerals)).toEqual([3, 3]);
    expect(choose.mock.calls.map(([observation]) => observation.turn)).toEqual([0, 1]);
    expect(placementToMap(evidence.resolves[0]!.next.placement).get("d1")).toEqual({ color: "w", type: "b" });
    expect(placementToMap(evidence.resolves[0]!.next.placement).get("d8")).toEqual({ color: "b", type: "p" });
    expect(match).toEqual(before);
    expect(evidence).toMatchObject({ outcome: null, modelArtifact: null, learnedGateEligible: false, fallbackCount: 0 });
  });

  it("rejects deployment before publishing any unaffordable or clamped debit", async () => {
    const candidate: CandidatePolicy = {
      name: "unaffordable", choose: vi.fn<CandidatePolicy["choose"]>(() => [{ kind: "deploy", timing: "B", color: "b", from: "e8", to: "d8", unit: "q" }]),
    };
    const evidence = await runChallengeMatch(live(), { candidate, strategic: strategicPass });
    expect(evidence.stop).toMatchObject({ kind: "queue-rejected", side: "b", requiredMinerals: 9, availableMinerals: 3 });
    expect(evidence.finalBank).toEqual({ w: 3, b: 3 });
    expect(evidence.bankTrail).toEqual([]);
    expect(evidence.resolves).toEqual([]);
    expect(evidence.scfens).toHaveLength(1);
  });

  it.each([
    "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|Q:w:;b:",
    opening.replace("B:3:3", "B:2:3"),
    opening.replace("B:3:3", "B:3:4"),
    opening.replace("Q:w:;b:", "Q:w:C=c2c3;b:"),
  ])("requires exactly opening bank 3:3 and empty queues: %s", async (invalidOpening) => {
    const candidate = { ...pass, choose: vi.fn(() => []) };
    await expect(runChallengeMatch({ ...live(), opening: invalidOpening }, { candidate })).rejects.toThrow("challenge opening requires empty queues and bank 3:3");
    expect(candidate.choose).not.toHaveBeenCalled();
  });
});

describe("current income tiers and storage cap", () => {
  it.each([[9, 10, 4, 1], [10, 11, 5, 2], [19, 20, 5, 2], [20, 21, 6, 3]] as const)(
    "settles turn %i -> %i with bank %i and gas tier %i",
    async (startTurn, nextTurn, expectedBank, gasIncome) => {
      const evidence = await runChallengeMatch(live(startTurn), {
        candidate: pass, strategic: strategicPass, limits: { maxWindows: 1, maxRecordedPlies: 2 },
      });
      expect(evidence.stop).toMatchObject({ kind: "progress-limit", planningOrdinal: 1, turn: nextTurn });
      expect(evidence.resolves).toHaveLength(1);
      expect(evidence.resolves[0]!.next.gasIncome).toEqual({ w: gasIncome, b: gasIncome });
      expect(evidence.bankTrail).toEqual([{ w: expectedBank, b: expectedBank }]);
      expect(evidence.finalBank).toEqual({ w: expectedBank, b: expectedBank });
      expect(evidence.outcome).toBeNull();
    },
  );

  it("caps accumulated storage at 12 without resetting to opening or source bank", async () => {
    const evidence = await runChallengeMatch(live(), {
      candidate: pass, strategic: strategicPass, limits: { maxWindows: 12, maxRecordedPlies: 24 },
    });
    expect(evidence.stop).toMatchObject({ kind: "progress-limit", planningOrdinal: 12, turn: 12 });
    expect(evidence.bankTrail).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 12, 12].map((amount) => ({ w: amount, b: amount })));
    expect(evidence.finalBank).toEqual({ w: 12, b: 12 });
    expect(grantStoredIncome({ w: 11, b: 12 }, 21)).toEqual({ w: 12, b: 12 });
  });
});
