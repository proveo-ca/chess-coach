// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import { describe, expect, it, vi } from "vitest";
import {
  addScAction, parseScFen, type PieceColor, type ScActionInput, type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import { baselinePolicy, baselineProposals } from "../challenge/baseline";
import { loadPinnedCorpus } from "../challenge/corpus";
import { observe } from "../challenge/observation";
import { runChallengeMatch } from "../challenge/runChallengeMatch";
import type { AuthorizedObservation, CandidatePolicy, ScheduledMatch, Sighting } from "../challenge/types";
import type { ScriptPlayer } from "../players/types";

const corpus = loadPinnedCorpus();
const opening = corpus.manifest.openingScfen;
const request = (candidateSide: PieceColor): ScheduledMatch => ({
  key: "isolation-integrity", suite: "live-strategic", candidateSide, arenaSeed: 0, inferenceSeed: 0, opening,
});
const limits = { maxWindows: 1, maxRecordedPlies: 4 };
const deploy = (color: PieceColor, unit: "p" | "n"): ScActionInput => ({
  kind: "deploy", timing: "B", color, from: color === "w" ? "e1" : "e8", to: color === "w" ? "d1" : "d8", unit,
});
const frozenTree = (value: unknown): void => {
  if (!value || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) frozenTree(child);
};

describe("simultaneous precommit policy isolation", () => {
  it.each(["w", "b"] as const)("isolates both plans when candidate occupies %s", async (candidateSide) => {
    const otherSide = candidateSide === "w" ? "b" : "w";
    const expectedObservation = observe(parseScFen(opening), { w: 3, b: 3 }, candidateSide);
    const candidate: CandidatePolicy = { name: "precommit", choose: vi.fn((observation) => {
      expect(observation).toEqual(expectedObservation);
      expect(Object.keys(observation).sort()).toEqual(["cells", "memory", "own", "side", "turn", "version"]);
      expect(observation).not.toHaveProperty("queue");
      expect(observation).not.toHaveProperty("bank");
      expect(observation).not.toHaveProperty("kvs");
      expect(observation.own.minerals).toBe(3);
      expect(observation.own.gas).toBe(1);
      return [deploy(candidateSide, "p")];
    }) };
    const strategic: ScriptPlayer = { name: "precommit-strategic", play: vi.fn((snapshot, context) => {
      expect(snapshot).toEqual(parseScFen(opening));
      expect(snapshot.queue!.actions).toEqual([]);
      expect(snapshot.gas).toEqual({ w: 1, b: 1 });
      expect(context.bank).toEqual({ w: 3, b: 3 });
      expect(context.storedFor).toBe(3);
      expect(context.movetimeMs).toBe(0);
      expect(context.color).toBe(otherSide);
      return { snapshot: addScAction({ snapshot, action: deploy(otherSide, "n") }).snapshot, spendMinerals: 3 };
    }) };
    const evidence = await runChallengeMatch(request(candidateSide), { candidate, strategic, limits });
    expect(evidence.stop.kind).toBe("progress-limit");
    expect(candidate.choose).toHaveBeenCalledTimes(1);
    expect(strategic.play).toHaveBeenCalledTimes(1);
    expect(evidence.resolves[0]!.queue).toEqual([
      { ...deploy("w", candidateSide === "w" ? "p" : "n"), seq: 0 },
      { ...deploy("b", candidateSide === "b" ? "p" : "n"), seq: 1 },
    ]);
    expect(evidence.finalBank).toEqual(candidateSide === "w" ? { w: 3, b: 1 } : { w: 1, b: 3 });
  });

  it.each(["w", "b"] as const)("ignores malicious strategic snapshot/context edits except restaged queues for candidate %s", async (candidateSide) => {
    const otherSide = candidateSide === "w" ? "b" : "w";
    const play = (malicious: boolean): ScriptPlayer => ({ name: "same-script", play: vi.fn((snapshot, context) => {
      const planned = addScAction({ snapshot, action: deploy(otherSide, "n") }).snapshot;
      if (malicious) {
        planned.placement = "8/8/8/8/8/8/8/8";
        planned.turn = 999;
        planned.phase = "O";
        planned.ccLives = { w: 0, b: 0 };
        planned.gas = { w: 0, b: 0 };
        planned.gasIncome = { w: 9, b: 9 };
        planned.stored = { w: 12, b: 12 };
        planned.mines = [{ color: candidateSide, at: "a4" }];
        planned.siegedTanks = ["a4"];
        planned.specialsUsed = ["e1", "e8"];
        planned.queue = { actions: planned.queue!.actions.map((action) => ({ ...action, seq: 777 })) };
        context.bank.w = 12;
        context.bank.b = 0;
        context.storedFor = 12;
        context.kvs = {} as typeof context.kvs;
        context.runnerMemory = null;
        context.attackerMemory = null;
      }
      return { snapshot: planned, spendMinerals: 3 };
    }) });
    const candidate: CandidatePolicy = { name: "same-candidate", choose: vi.fn((observation) => {
      expect(observation).toEqual(observe(parseScFen(opening), { w: 3, b: 3 }, candidateSide));
      return [deploy(candidateSide, "p")];
    }) };
    const clean = await runChallengeMatch(request(candidateSide), { candidate, strategic: play(false), limits });
    const tampered = await runChallengeMatch(request(candidateSide), { candidate, strategic: play(true), limits });
    expect(clean.stop.kind).toBe("progress-limit");
    expect(tampered).toEqual(clean);
    expect(tampered.resolves[0]!.queue.map((action) => action.seq)).toEqual([0, 1]);
  });

  it.each([
    { candidateSide: "w", spendMinerals: 0 }, { candidateSide: "w", spendMinerals: 2 },
    { candidateSide: "w", spendMinerals: 4 }, { candidateSide: "w", spendMinerals: Number.NaN },
    { candidateSide: "b", spendMinerals: 0 }, { candidateSide: "b", spendMinerals: 2 },
    { candidateSide: "b", spendMinerals: 4 }, { candidateSide: "b", spendMinerals: Number.NaN },
  ] as const)("fails strategic spend $spendMinerals for candidate $candidateSide before publishing", async ({ candidateSide, spendMinerals }) => {
    const otherSide = candidateSide === "w" ? "b" : "w";
    const candidate: CandidatePolicy = { name: "spend-check", choose: vi.fn(() => [deploy(candidateSide, "p")]) };
    const strategic: ScriptPlayer = { name: "mismatch", play: vi.fn((snapshot) => ({
      snapshot: addScAction({ snapshot, action: deploy(otherSide, "n") }).snapshot, spendMinerals,
    })) };
    const evidence = await runChallengeMatch(request(candidateSide), { candidate, strategic, limits });
    expect(evidence.stop).toMatchObject({ kind: "script-contract", phase: "admission", side: otherSide, reason: "strategic spend differs from admitted deployment costs" });
    expect(evidence.resolves).toEqual([]);
    expect(evidence.scfens).toHaveLength(1);
    expect(evidence.bankTrail).toEqual([]);
    expect(evidence.finalBank).toEqual({ w: 3, b: 3 });
    expect(evidence.outcome).toBeNull();
    expect(candidate.choose).toHaveBeenCalledTimes(1);
  });

  it.each(["missing", "wrong-side", "mixed-side"] as const)("rejects a $0 strategic queue before staging", async (queueKind) => {
    const candidate: CandidatePolicy = { name: "queue-contract", choose: vi.fn(() => []) };
    const strategic: ScriptPlayer = { name: "invalid-queue", play: vi.fn((snapshot) => {
      snapshot.queue = queueKind === "missing" ? undefined : { actions: queueKind === "wrong-side"
        ? [{ ...deploy("b", "p"), seq: 80 }]
        : [{ ...deploy("w", "p"), seq: 80 }, { ...deploy("b", "p"), seq: 90 }] };
      return { snapshot, spendMinerals: 0 };
    }) };
    const evidence = await runChallengeMatch(request("b"), { candidate, strategic, limits });
    expect(evidence.stop).toMatchObject({ kind: "script-contract", phase: "strategic-plan", side: "w", reason: "strategic returned an invalid side queue" });
    expect(evidence.resolves).toEqual([]);
    expect(evidence.bankTrail).toEqual([]);
    expect(evidence.finalBank).toEqual({ w: 3, b: 3 });
    expect(evidence.outcome).toBeNull();
    expect(candidate.choose).not.toHaveBeenCalled();
  });

  it.each(["w", "b"] as const)("freezes candidate %s observation mutations and preserves the host", async (candidateSide) => {
    const strategic: ScriptPlayer = { name: "mutation-pass", play: (snapshot) => ({ snapshot, spendMinerals: 0 }) };
    const choose = (mutate: boolean): CandidatePolicy => ({ name: "mutation-candidate", choose: vi.fn((observation) => {
      frozenTree(observation);
      if (mutate) {
        expect(() => { observation.own.minerals = 12; }).toThrow(TypeError);
        expect(() => { observation.own.pieces[0]!.piece.type = "q"; }).toThrow(TypeError);
        expect(() => { observation.cells.splice(0); }).toThrow(TypeError);
        expect(() => { observation.memory.push({ square: "a4", piece: { color: candidateSide, type: "q" }, observedTurn: 99 }); }).toThrow(TypeError);
        expect(Reflect.set(observation, "queue", { actions: [deploy(candidateSide, "n")] })).toBe(false);
      }
      return [deploy(candidateSide, "p")];
    }) });
    const clean = await runChallengeMatch(request(candidateSide), { candidate: choose(false), strategic, limits });
    const mutated = await runChallengeMatch(request(candidateSide), { candidate: choose(true), strategic, limits });
    expect(clean.stop.kind).toBe("progress-limit");
    expect(mutated).toEqual(clean);
  });

  it("keeps current recorded queues, future trace and metadata out of candidate input", async () => {
    const observations: AuthorizedObservation[] = [];
    const candidate: CandidatePolicy = { name: "private-trace", choose: vi.fn((observation) => {
      observations.push(observation);
      return [];
    }) };
    const base: ScheduledMatch = { ...request("b"), suite: "corpus", trace: {
      ...structuredClone(corpus.traces[0]!), windows: [
        { planningOrdinal: 0, sourcePlyIndex: 0, sourceTurn: 0, actions: [] },
      ],
    } };
    const changed: ScheduledMatch = { ...base, key: "different-private-match", trace: {
      ...structuredClone(base.trace!), caseId: "different-case", gameId: "different-game", historicalResult: "win", traceSha256: "private-hash",
      windows: [
        { planningOrdinal: 0, sourcePlyIndex: 70, sourceTurn: 44, actions: [deploy("w", "n")] },
        { planningOrdinal: 1, sourcePlyIndex: 90, sourceTurn: 45, actions: [{ kind: "classical", timing: "C", color: "w", from: "h4", to: "h5" }] },
      ],
    } };
    const first = await runChallengeMatch(base, { candidate, limits });
    const second = await runChallengeMatch(changed, { candidate, limits });
    expect(first.finalBank.w).toBe(4);
    expect(second.finalBank.w).toBe(1);
    expect(observations).toHaveLength(2);
    expect(observations[1]).toEqual(observations[0]);
    expect(baselineProposals(observations[1]!)).toEqual(baselineProposals(observations[0]!));
    expect(baselinePolicy.choose(observations[1]!, () => 0)).toEqual(baselinePolicy.choose(observations[0]!, () => 0));
  });
});

describe("authorized observation and baseline proposal invariance", () => {
  it.each(["w", "b"] as const)("does not expose hidden placement/mines, enemy bank/gas/queue to %s", (side) => {
    const enemy = side === "w" ? "b" : "w";
    const firstPlacement = side === "w" ? "4k3/n7/8/8/8/8/8/4K3" : "4k3/8/8/8/8/8/N7/4K3";
    const secondPlacement = side === "w" ? "4k3/1n6/8/8/8/8/8/4K3" : "4k3/8/8/8/8/8/1N6/4K3";
    const first: ScFenSnapshot = parseScFen(`SCFEN|${firstPlacement}|0|33|P|G:11:11|B:3:3|Q:w:;b:`);
    first.mines = [{ color: enemy, at: side === "w" ? "a6" : "a3" }];
    const second: ScFenSnapshot = parseScFen(`SCFEN|${secondPlacement}|0|33|P|G:11:11|B:3:3|Q:w:;b:`);
    second.mines = [{ color: enemy, at: side === "w" ? "b6" : "b3" }];
    second.gas[enemy] = 0;
    second.stored![enemy] = 12;
    second.queue = { actions: [{ kind: "classical", timing: "C", color: enemy,
      from: side === "w" ? "b7" : "b2", to: side === "w" ? "c5" : "c4", seq: 99 }] };
    const prior: Sighting[] = [{ square: "h4", piece: { color: enemy, type: "n" }, observedTurn: 0 }];
    const before = structuredClone({ first, second, prior });
    const a = observe(first, { w: 3, b: 3 }, side, prior);
    const b = observe(second, side === "w" ? { w: 3, b: 12 } : { w: 12, b: 3 }, side, prior);
    expect(a.cells.find((cell) => cell.square === (side === "w" ? "a7" : "a2"))!.visibility).toBe("unknown");
    expect(a.cells.find((cell) => cell.square === (side === "w" ? "b7" : "b2"))!.visibility).toBe("unknown");
    expect(b).toEqual(a);
    expect(a.memory).toEqual(prior);
    frozenTree(a);
    frozenTree(b);
    expect(() => { a.memory[0]!.piece.type = "q"; }).toThrow(TypeError);
    expect(baselineProposals(b)).toEqual(baselineProposals(a));
    expect(baselinePolicy.choose(b, () => 0)).toEqual(baselinePolicy.choose(a, () => 0));
    expect({ first, second, prior }).toEqual(before);
  });
});
