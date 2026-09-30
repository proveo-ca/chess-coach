// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase2.puml
import { describe, expect, it, vi } from "vitest";
import { addScAction, endScTurn, formatScFen, mapToPlacement, parseScFen, placementToMap, type PieceColor, type ScActionInput, type ScFenSnapshot, type ScPiece, type Square } from "@chess-coach/starchess-core";
import { commitPair, stageQueue } from "../challenge/admission";
import { baselinePolicy } from "../challenge/baseline";
import { observe } from "../challenge/observation";
import { runChallengeMatch } from "../challenge/runChallengeMatch";
import type { AuthorizedObservation, ScheduledMatch } from "../challenge/types";
import { decodeCandidate, encodeBaselineCandidates, encodeCandidate } from "../challengeContract/candidateCodec";
import { decodeObservation, encodeObservation } from "../challengeContract/observationCodec";

const board = (side: PieceColor, type: ScPiece["type"], at: Square): ScFenSnapshot => {
  const snap = parseScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:");
  const map = placementToMap(snap.placement);
  if (type !== "k") map.set(at, { type, color: side });
  snap.placement = mapToPlacement(map);
  return snap;
};
const throughCodec = (snap: ScFenSnapshot, side: PieceColor, actions: ScActionInput[]) => {
  const obs = decodeObservation(encodeObservation(observe(snap, { w: 12, b: 12 }, side)));
  return decodeCandidate(JSON.stringify(encodeCandidate(obs, actions)), side);
};
const request = (snap: ScFenSnapshot, side: PieceColor): ScheduledMatch => ({
  key: "phase2-codec-admission", suite: "live-strategic", candidateSide: side, arenaSeed: 0, inferenceSeed: 0, opening: formatScFen(snap),
});
const passOpponent = () => ({ name: "contract-pass", play: vi.fn((snapshot: ScFenSnapshot) => ({ snapshot, spendMinerals: 0 })) });

describe("Phase 2 codec intents meet authoritative current-core admission", () => {
  for (const side of ["w", "b"] as const) {
    const cases = [
      { kind: "deploy", type: "k", from: side === "w" ? "e1" : "e8", to: side === "w" ? "d2" : "d7", unit: "n", cost: 1, minerals: 3 },
      { kind: "stimStep", type: "p", from: side === "w" ? "d3" : "d6", to: side === "w" ? "d4" : "d5", cost: 1, minerals: 0 },
      { kind: "spiderMine", type: "n", from: "c4", cost: 1, minerals: 0 },
      { kind: "charonMissiles", type: "b", from: "c4", to: "d5", cost: 2, minerals: 0 },
      { kind: "siegeMode", type: "r", from: "c4", cost: 1, minerals: 0 },
      { kind: "tacticalJump", type: "q", from: "c4", to: "g5", cost: 3, minerals: 0 },
    ] as const;
    for (const entry of cases) {
      it.each(["B", "F"] as const)(`${side} ${entry.kind} %s spend agrees with real staging`, (timing) => {
        const snap = board(side, entry.type, entry.from);
        const action = { kind: entry.kind, timing, color: side, from: entry.from, ...("to" in entry ? { to: entry.to } : {}), ...("unit" in entry ? { unit: entry.unit } : {}) } as ScActionInput;
        const encoded = throughCodec(snap, side, [action]);
        const before = structuredClone(snap);
        const bank = { w: 12, b: 12 };
        const staged = stageQueue(snap, bank, side, encoded.actions, 7);
        expect(encoded.ownSpend).toEqual({ gas: entry.cost, minerals: entry.minerals });
        expect(staged).toEqual({ ok: true, staged: { side, intents: [action], gasAfter: 3 - entry.cost, spend: entry.minerals } });
        expect(snap).toEqual(before);
        expect(bank).toEqual({ w: 12, b: 12 });
        const poor = { ...snap, gas: { ...snap.gas, [side]: entry.cost - 1 } };
        expect(stageQueue(poor, bank, side, throughCodec(poor, side, [action]).actions, 7)).toMatchObject({ ok: false, failure: { engineCode: "SC_GAS", actionIndex: 0 } });
      });
    }
  }

  it.each(["p", "n", "b", "r", "q"] as const)("stages and resolves every deployment and promotion type %s after codec round-trip", (unit) => {
    for (const side of ["w", "b"] as const) {
      for (const timing of ["B", "F"] as const) {
        const snap = board(side, "k", side === "w" ? "e1" : "e8");
        const to: Square = side === "w" ? "d2" : "d7";
        const actions: ScActionInput[] = [{ kind: "deploy", timing, color: side, from: side === "w" ? "e1" : "e8", to, unit }];
        const candidate = throughCodec(snap, side, actions);
        const staged = stageQueue(snap, { w: 12, b: 12 }, side, candidate.actions, 0);
        expect(staged).toMatchObject({ ok: true, staged: { gasAfter: 2, spend: candidate.ownSpend.minerals } });
        const queued = addScAction({ snapshot: snap, action: candidate.actions[0]! }).snapshot;
        expect(placementToMap(endScTurn(queued, { skipTurnStartChecks: true }).next.placement).get(to)).toEqual({ type: unit, color: side });
      }
      for (const kind of ["classical", "stimStep"] as const) {
        const from: Square = side === "w" ? "a7" : "a2";
        const to: Square = side === "w" ? "a8" : "a1";
        const snap = board(side, "p", from);
        const actions: ScActionInput[] = [{ kind, timing: kind === "classical" ? "C" : "B", color: side, from, to, promotion: unit } as ScActionInput];
        const candidate = throughCodec(snap, side, actions);
        expect(stageQueue(snap, { w: 3, b: 3 }, side, candidate.actions, 0).ok).toBe(true);
        const queued = addScAction({ snapshot: snap, action: candidate.actions[0]! }).snapshot;
        expect(placementToMap(endScTurn(queued, { skipTurnStartChecks: true }).next.placement).get(to)).toEqual({ type: unit, color: side });
      }
    }
  });

  it.each(["w", "b"] as const)("B deployment creates the %s C actor only when ordered before C", (side) => {
    const snap = board(side, "k", side === "w" ? "e1" : "e8");
    const actions: ScActionInput[] = [
      { kind: "deploy", timing: "B", color: side, from: side === "w" ? "e1" : "e8", to: side === "w" ? "d2" : "d7", unit: "p" },
      { kind: "classical", timing: "C", color: side, from: side === "w" ? "d2" : "d7", to: side === "w" ? "d4" : "d5" },
    ];
    const encoded = throughCodec(snap, side, actions);
    const own = stageQueue(snap, { w: 3, b: 3 }, side, encoded.actions, 0);
    const other = stageQueue(snap, { w: 3, b: 3 }, side === "w" ? "b" : "w", [], 0);
    expect(own.ok).toBe(true);
    expect(other.ok).toBe(true);
    if (!own.ok || !other.ok) throw new Error("legal deployment fixture rejected");
    const committed = commitPair(snap, { w: 3, b: 3 }, side === "w" ? own.staged : other.staged, side === "b" ? own.staged : other.staged);
    expect(committed.snapshot.gas[side]).toBe(2);
    expect(committed.bank[side]).toBe(2);
    expect(committed.snapshot.queue!.actions.map((a) => a.seq)).toEqual([0, 1]);
    const resolved = endScTurn(committed.snapshot, { skipTurnStartChecks: true });
    expect(placementToMap(resolved.next.placement).get(side === "w" ? "d4" : "d5")).toEqual({ type: "p", color: side });
    const reversed = throughCodec(snap, side, [...actions].reverse());
    expect(reversed.key).not.toBe(encoded.key);
    expect(stageQueue(snap, { w: 3, b: 3 }, side, reversed.actions, 0)).toMatchObject({ ok: false, failure: { engineCode: "SC_BASELINE_FEN", actionIndex: 0 } });
  });

  it.each(["w", "b"] as const)("preserves %s C promotion followed by F intent and lets core decide the actor type", (side) => {
    const from: Square = side === "w" ? "a7" : "a2";
    const snap = board(side, "p", from);
    const actions: ScActionInput[] = [
      { kind: "classical", timing: "C", color: side, from, to: side === "w" ? "a8" : "a1", promotion: "r" },
      { kind: "siegeMode", timing: "F", color: side, from },
    ];
    const candidate = throughCodec(snap, side, actions);
    expect(candidate.actions).toEqual(actions);
    expect(candidate.ownSpend).toEqual({ minerals: 0, gas: 1 });
    expect(stageQueue(snap, { w: 3, b: 3 }, side, candidate.actions, 0)).toMatchObject({ ok: false, failure: { actionIndex: 1, engineCode: "SC_SPECIAL", reason: "siege requires Tank" } });
    expect(snap.queue!.actions).toEqual([]);
    expect(snap.gas[side]).toBe(3);
  });

  it.each(["w", "b"] as const)("executes a codec-produced %s choice through the real host and current resource ledger", async (side) => {
    const snap = board(side, "k", side === "w" ? "e1" : "e8");
    const actions: ScActionInput[] = [{ kind: "deploy", timing: "B", color: side, from: side === "w" ? "e1" : "e8", to: side === "w" ? "d2" : "d7", unit: "n" }];
    const choose = vi.fn((observation: AuthorizedObservation) => decodeCandidate(JSON.stringify(encodeCandidate(decodeObservation(encodeObservation(observation)), actions)), side).actions);
    const opponent = passOpponent();
    const evidence = await runChallengeMatch(request(snap, side), { candidate: { name: "phase2-codec", choose }, strategic: opponent, limits: { maxWindows: 1, maxRecordedPlies: 2 } });
    expect(choose).toHaveBeenCalledTimes(1);
    expect(opponent.play).toHaveBeenCalledTimes(1);
    expect(evidence.stop.kind).toBe("progress-limit");
    expect(evidence.resolves).toHaveLength(1);
    expect(evidence.resolves[0]!.queue).toEqual([{ ...actions[0], seq: 0 }]);
    expect(placementToMap(evidence.resolves[0]!.next.placement).get(side === "w" ? "d2" : "d7")).toEqual({ type: "n", color: side });
    expect(evidence.finalBank[side]).toBe(3);
    expect(evidence.finalBank[side === "w" ? "b" : "w"]).toBe(6);
    expect(evidence).toMatchObject({ fallbackCount: 0, modelArtifact: null, learnedGateEligible: false });
  });

  it.each(["w", "b"] as const)("keeps baseline %s host output unchanged across the codec boundary", async (side) => {
    const snap = board(side, "p", side === "w" ? "d3" : "d6");
    const match = request(snap, side);
    const limits = { maxWindows: 3, maxRecordedPlies: 6 };
    const direct = await runChallengeMatch(match, { candidate: baselinePolicy, strategic: passOpponent(), limits });
    const choose = vi.fn((observation: AuthorizedObservation) => {
      const authorized = decodeObservation(encodeObservation(observation));
      return decodeCandidate(JSON.stringify(encodeBaselineCandidates(authorized)[0]!.candidate), side).actions;
    });
    const encoded = await runChallengeMatch(match, { candidate: { name: baselinePolicy.name, choose }, strategic: passOpponent(), limits });
    expect(choose).toHaveBeenCalledTimes(3);
    expect(encoded).toEqual(direct);
    expect(encoded.resolves).toHaveLength(3);
  });

  for (const side of ["w", "b"] as const) {
    it.each(["gas", "minerals", "hidden-target"] as const)(`${side} selected %s rejection rolls back the complete pair without retry or hidden probe`, async (reason) => {
      const snap = board(side, "p", side === "w" ? "d3" : "d6");
      const cc: Square = side === "w" ? "e1" : "e8";
      const enemy = side === "w" ? "b" : "w";
      let actions: ScActionInput[];
      if (reason === "gas") {
        snap.turn = 0;
        snap.gas = { w: 1, b: 1 };
        snap.gasIncome = { w: 1, b: 1 };
        actions = [{ kind: "deploy", timing: "B", color: side, from: cc, to: side === "w" ? "d2" : "d7", unit: "p" }, { kind: "stimStep", timing: "F", color: side, from: side === "w" ? "d3" : "d6", to: side === "w" ? "d4" : "d5" }];
      } else if (reason === "minerals") {
        actions = [{ kind: "stimStep", timing: "B", color: side, from: side === "w" ? "d3" : "d6", to: side === "w" ? "d4" : "d5" }, { kind: "deploy", timing: "F", color: side, from: cc, to: side === "w" ? "d2" : "d7", unit: "q" }];
      } else {
        const map = placementToMap(snap.placement);
        map.set(side === "w" ? "a1" : "a8", { type: "q", color: side });
        map.set(side === "w" ? "h7" : "h2", { type: "p", color: enemy });
        snap.placement = mapToPlacement(map);
        actions = [{ kind: "classical", timing: "C", color: side, from: cc, to: side === "w" ? "f1" : "f8" }, { kind: "tacticalJump", timing: "F", color: side, from: side === "w" ? "a1" : "a8", to: side === "w" ? "h7" : "h2" }];
      }
      let encodedSpend: { gas: number; minerals: number } | undefined;
      const choose = vi.fn((observation: AuthorizedObservation) => {
        if (reason === "hidden-target") expect(observation.cells.find((c) => c.square === actions[1]!.to)?.visibility).toBe("unknown");
        const candidate = encodeCandidate(observation, actions);
        encodedSpend = candidate.ownSpend;
        return decodeCandidate(JSON.stringify(candidate), side).actions;
      });
      const opponent = { name: "atomic-deploy-opponent", play: vi.fn((snapshot: ScFenSnapshot) => ({
        snapshot: addScAction({ snapshot, action: { kind: "deploy", timing: "B", color: enemy, from: enemy === "w" ? "e1" : "e8", to: enemy === "w" ? "d2" : "d7", unit: "p" } }).snapshot,
        spendMinerals: 1,
      })) };
      const evidence = await runChallengeMatch(request(snap, side), { candidate: { name: "selected-codec-queue", choose }, strategic: opponent });
      expect(choose).toHaveBeenCalledTimes(1);
      expect(opponent.play).toHaveBeenCalledTimes(1);
      expect(evidence.stop).toMatchObject({ kind: "queue-rejected", side, actionIndex: 1, planningOrdinal: 0 });
      if (reason === "gas") {
        expect(encodedSpend).toEqual({ minerals: 1, gas: 2 });
        expect(evidence.stop.engineCode).toBe("SC_GAS");
      } else if (reason === "minerals") {
        expect(encodedSpend).toEqual({ minerals: 9, gas: 2 });
        expect(evidence.stop).toMatchObject({ reason: "minerals", requiredMinerals: 9, availableMinerals: 3 });
      } else expect(evidence.stop).toMatchObject({ engineCode: "SC_SPECIAL", reason: "Jump destination occupied" });
      expect(evidence.scfens).toHaveLength(1);
      expect(parseScFen(evidence.scfens[0]!)).toEqual(parseScFen(request(snap, side).opening));
      expect(evidence.resolves).toEqual([]);
      expect(evidence.bankTrail).toEqual([]);
      expect(evidence.finalBank).toEqual({ w: 3, b: 3 });
      expect(evidence.outcome).toBeNull();
      expect(evidence.fallbackCount).toBe(0);
    });
  }
});
