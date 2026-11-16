// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { describe, expect, it, vi } from "vitest";
import { energyForTurn, parseScFen, scOutcome, type ScActionInput } from "@chess-coach/starchess-core";
import { baselinePolicy } from "../challenge/baseline";
import { loadPinnedCorpus } from "../challenge/corpus";
import { replayExecutionIntegrity } from "../challenge/integrity";
import { runChallengeMatch } from "../challenge/runChallengeMatch";
import { runSupervised } from "../challenge/supervisor";
import type { AuthorizedObservation, ScheduledMatch } from "../challenge/types";

const corpus = loadPinnedCorpus();
const request = (opening: string, queues: ScActionInput[][] = []): ScheduledMatch => ({
  key: "lifecycle-integrity", suite: "corpus", candidateSide: "b", arenaSeed: 0, inferenceSeed: 0, opening,
  trace: { ...structuredClone(corpus.traces[0]!), caseId: "lifecycle-integrity", openingScfen: opening,
    windows: queues.map((actions, planningOrdinal) => ({ planningOrdinal, sourcePlyIndex: 30 + planningOrdinal, sourceTurn: planningOrdinal, actions })) },
});
const quietOpening = (turn: number, lives = "33", phase = "P") => `SCFEN|4k3/8/8/8/8/8/8/4K3|${turn}|${lives}|${phase}|G:${energyForTurn(turn)}${energyForTurn(turn)}:${energyForTurn(turn)}${energyForTurn(turn)}|B:3:3|Q:w:;b:`;
const invalid: ScActionInput[] = [{ kind: "classical", timing: "C", color: "w", from: "h4", to: "h5" }];
const policies = () => ({
  candidate: { name: "lifecycle-pass", choose: vi.fn((_observation: AuthorizedObservation) => []) },
  strategic: { name: "unused-strategic", play: vi.fn(() => { throw new Error("unexpected strategic planning"); }) },
});

describe("terminal-first challenge lifecycle", () => {
  it.each(["trace-exhausted", "queue-rejected"] as const)(
    "requires an accepted nonterminal begin chip before %s", async (kind) => {
      const match = request("SCFEN|4k3/3B4/8/8/8/8/8/7K|0|33|P|G:11:11|B:3:3|Q:w:;b:",
        kind === "queue-rejected" ? [invalid] : []);
      const evidence = await runChallengeMatch(match, policies());
      expect(evidence.stop.kind).toBe(kind);
      expect(evidence.resolves).toHaveLength(1);
      expect(evidence.resolves[0]!.events[0]!.id).toBe("ev-begin-0");
      expect(replayExecutionIntegrity(evidence, match)).toBe(true);
      const omitted = structuredClone(evidence);
      omitted.resolves = [];
      omitted.scfens = [evidence.scfens[0]!];
      omitted.bankTrail = [];
      expect(replayExecutionIntegrity(omitted, match)).toBe(false);
      expect(replayExecutionIntegrity(omitted, match, false)).toBe(true);
      if (kind === "queue-rejected") {
        const changedWitness = structuredClone(evidence);
        changedWitness.stop.rejectedQueue = [];
        expect(replayExecutionIntegrity(changedWitness, match)).toBe(false);
        const historicalWitness = structuredClone(evidence);
        delete historicalWitness.stop.rejectedQueue;
        expect(replayExecutionIntegrity(historicalWitness, match)).toBe(true);
      }
    },
  );

  it("requires the recorded terminal begin chip rather than granting its unrecorded outcome", async () => {
    const match = request("SCFEN|7k/8/8/8/8/8/3b4/4K3|0|13|P|G:11:11|B:3:3|Q:w:;b:");
    const evidence = await runChallengeMatch(match, policies());
    expect(replayExecutionIntegrity(evidence, match)).toBe(true);
    const omitted = structuredClone(evidence);
    omitted.resolves = [];
    omitted.scfens = [evidence.scfens[0]!];
    omitted.bankTrail = [];
    omitted.stop.turn = 0;
    expect(replayExecutionIntegrity(omitted, match)).toBe(false);
  });

  it("requires a nonterminal begin chip for a live rejection witness", async () => {
    const match: ScheduledMatch = {
      key: "live-chip-rejection", suite: "live-strategic", candidateSide: "w", arenaSeed: 0, inferenceSeed: 0,
      opening: "SCFEN|4k3/3B4/8/8/8/8/8/7K|0|33|P|G:11:11|B:3:3|Q:w:;b:",
    };
    const evidence = await runChallengeMatch(match, {
      candidate: { name: "baseline-v1", choose: () => invalid },
      strategic: { name: "live-pass", play: (snapshot) => ({ snapshot, spendMinerals: 0 }) },
    });
    expect(evidence.stop).toMatchObject({ kind: "queue-rejected", side: "w" });
    expect(evidence.resolves).toHaveLength(1);
    expect(replayExecutionIntegrity(evidence, match)).toBe(true);
    const omitted = structuredClone(evidence);
    omitted.resolves = [];
    omitted.scfens = [evidence.scfens[0]!];
    omitted.bankTrail = [];
    expect(replayExecutionIntegrity(omitted, match)).toBe(false);
  });

  it.each([
    { key: "direct-terminal", opening: quietOpening(0, "03", "O"), plies: 0 },
    { key: "chip-terminal", opening: "SCFEN|7k/8/8/8/8/8/3b4/4K3|0|13|P|G:11:11|B:3:3|Q:w:;b:", plies: 1 },
    { key: "settlement-terminal", opening: quietOpening(44, "23"), plies: 1 },
  ])("allows $key completion at its checked terminal boundary", async ({ key, opening, plies }) => {
    const match: ScheduledMatch = {
      key, suite: "live-strategic", candidateSide: "w", arenaSeed: 0, inferenceSeed: 0, opening,
    };
    const evidence = await runSupervised(match, {
      workerUrl: new URL("./fixtures/challengeChildCases.ts", import.meta.url),
      budgets: { startupMs: 3000, planMs: 1000, matchMs: 3000 },
    });
    expect(evidence.stop.kind).toBe("terminal");
    expect(evidence.outcome).toEqual({ winner: "b", draw: false });
    expect(evidence.resolves).toHaveLength(plies);
    expect(replayExecutionIntegrity(evidence, match)).toBe(true);
  });

  it.each([
    { opening: quietOpening(0, "03", "O") },
    { opening: "SCFEN|7k/8/8/8/8/8/3b4/4K3|0|13|P|G:11:11|B:3:3|Q:w:;b:" },
    { opening: quietOpening(44, "23") },
  ])("preserves production supervised/in-process terminal parity for $opening", async ({ opening }) => {
    const match: ScheduledMatch = {
      key: "production-terminal-parity", suite: "live-strategic", candidateSide: "w",
      arenaSeed: 0, inferenceSeed: 0, opening,
    };
    const expected = await runChallengeMatch(match);
    const actual = await runSupervised(match);
    expect(actual).toEqual(expected);
    expect(actual.stop.kind).toBe("terminal");
    expect(replayExecutionIntegrity(actual, match)).toBe(true);
  });

  it.each([{ label: "absent", queues: [] }, { label: "trailing", queues: [invalid] }])("scores an already terminal board before requesting $label queues", async ({ queues }) => {
    const options = policies();
    const evidence = await runChallengeMatch(request(quietOpening(0, "03", "O"), queues), {
      ...options, limits: { maxWindows: 0, maxRecordedPlies: 0 },
    });
    expect(evidence.stop).toMatchObject({ kind: "terminal", planningOrdinal: 0, turn: 0 });
    expect(evidence.outcome).toEqual({ winner: "b", draw: false });
    expect(evidence.resolves).toEqual([]);
    expect(evidence.bankTrail).toEqual([]);
    expect(evidence.finalBank).toEqual({ w: 3, b: 3 });
    expect(options.candidate.choose).not.toHaveBeenCalled();
    expect(options.strategic.play).not.toHaveBeenCalled();
  });

  it.each([{ label: "absent", queues: [] }, { label: "trailing", queues: [invalid] }])("records a terminal turn-open chip with $label queues without planning or bank income", async ({ queues }) => {
    const opening = "SCFEN|7k/8/8/8/8/8/3b4/4K3|0|13|P|G:11:11|B:3:3|Q:w:;b:";
    const options = policies();
    const evidence = await runChallengeMatch(request(opening, queues), {
      ...options, limits: { maxWindows: 0, maxRecordedPlies: 0 },
    });
    expect(evidence.stop).toMatchObject({ kind: "terminal", phase: "turn-open", planningOrdinal: 0, turn: 1 });
    expect(evidence.outcome).toEqual({ winner: "b", draw: false });
    expect(evidence.resolves).toHaveLength(1);
    expect(evidence.resolves[0]!.events).toContainEqual(expect.objectContaining({ id: "ev-begin-0", color: "b", from: "d2", to: "e1" }));
    expect(evidence.resolves[0]!.queue).toEqual([]);
    expect(evidence.scfens.map((scfen) => parseScFen(scfen).turn)).toEqual([0, 1]);
    expect(evidence.bankTrail).toEqual([{ w: 3, b: 3 }]);
    expect(evidence.finalBank).toEqual({ w: 3, b: 3 });
    expect(options.candidate.choose).not.toHaveBeenCalled();
    expect(options.strategic.play).not.toHaveBeenCalled();
    expect(evidence).toMatchObject({ modelArtifact: null, learnedGateEligible: false, fallbackCount: 0 });
  });

  it("records a nonterminal chip without consuming a planning ordinal or granting extra income", async () => {
    const opening = "SCFEN|4k3/3B4/8/8/8/8/8/7K|0|33|P|G:11:11|B:3:3|Q:w:;b:";
    const options = policies();
    const evidence = await runChallengeMatch(request(opening, [
      [{ kind: "classical", timing: "C", color: "w", from: "d7", to: "c8" }], invalid,
    ]), { ...options, limits: { maxWindows: 2, maxRecordedPlies: 8 } });
    expect(evidence.resolves).toHaveLength(2);
    expect(evidence.resolves[0]!.events[0]!.id).toBe("ev-begin-0");
    expect(evidence.resolves[0]!.queue).toEqual([]);
    expect(evidence.resolves[1]!.queue).toEqual([{ kind: "classical", timing: "C", color: "w", from: "d7", to: "c8", seq: 0 }]);
    expect(evidence.scfens.map((scfen) => parseScFen(scfen).turn)).toEqual([0, 0, 1]);
    expect(evidence.bankTrail).toEqual([{ w: 3, b: 3 }, { w: 4, b: 4 }]);
    expect(options.candidate.choose.mock.calls.map(([observation]) => [observation.turn, observation.own.minerals, observation.own.ccLives])).toEqual([[0, 3, 2], [1, 4, 2]]);
    expect(evidence.stop).toMatchObject({ kind: "queue-rejected", planningOrdinal: 1, sourcePlyIndex: 31, actionIndex: 0 });
    expect(evidence.outcome).toBeNull();
  });

  it.each([["23", "b"], ["32", "w"], ["33", null]] as const)(
    "uses the actual turn-45 HP outcome for lives %s",
    async (lives, winner) => {
      const options = policies();
      const evidence = await runChallengeMatch(request(quietOpening(44, lives), [[], invalid]), {
        ...options, limits: { maxWindows: 1, maxRecordedPlies: 1 },
      });
      const expected = { winner, draw: winner === null };
      expect(evidence.stop).toMatchObject({ kind: "terminal", planningOrdinal: 1, turn: 45 });
      expect(evidence.outcome).toEqual(expected);
      expect(scOutcome(evidence.resolves[0]!.next)).toEqual(expected);
      expect(evidence.resolves).toHaveLength(1);
      expect(evidence.finalBank).toEqual({ w: 6, b: 6 });
      expect(options.candidate.choose).toHaveBeenCalledTimes(1);
      expect(options.strategic.play).not.toHaveBeenCalled();
    },
  );

  it("never synthesizes a favorable HP outcome at a shortened host cap", async () => {
    const options = policies();
    const evidence = await runChallengeMatch(request(quietOpening(0, "13"), [[], []]), {
      ...options, limits: { maxWindows: 1, maxRecordedPlies: 1 },
    });
    expect(evidence.stop).toMatchObject({ kind: "progress-limit", planningOrdinal: 1, turn: 1 });
    expect(evidence.outcome).toBeNull();
    expect(scOutcome(evidence.resolves[0]!.next)).toBeNull();
    expect(options.candidate.choose).toHaveBeenCalledTimes(1);
  });

  it("does not turn favorable nonterminal HP and trace exhaustion into a win", async () => {
    const options = policies();
    const evidence = await runChallengeMatch(request(quietOpening(0, "13")), options);
    expect(evidence.stop.kind).toBe("trace-exhausted");
    expect(evidence.outcome).toBeNull();
    expect(options.candidate.choose).not.toHaveBeenCalled();
  });

  it("returns baseline evidence without a learned artifact or learned eligibility", async () => {
    const evidence = await runChallengeMatch(request(corpus.manifest.openingScfen, [[]]), {
      limits: { maxWindows: 1, maxRecordedPlies: 2 },
    });
    expect(evidence.policy).toBe(baselinePolicy.name);
    expect(evidence).toMatchObject({ modelArtifact: null, learnedGateEligible: false, fallbackCount: 0 });
    expect(evidence.resolves).toHaveLength(1);
    expect(evidence.stop.kind).toBe("progress-limit");
    expect(evidence.outcome).toBeNull();
  });
});
