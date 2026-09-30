// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase2.puml
import { describe, expect, it } from "vitest";
import { mapToPlacement, MAX_GAME_TURNS, parseScFen, placementToMap, type PieceColor, type ScActionInput, type Square } from "@chess-coach/starchess-core";
import { observe } from "../challenge/observation";
import type { AuthorizedObservation, Sighting } from "../challenge/types";
import { ACTION_KINDS, encodeBaselineCandidates, encodeCandidate } from "../challengeContract/candidateCodec";
import { ACTION_FEATURE_NAMES, CELL_FEATURE_NAMES, encodeFeatures, FEATURE_SCHEMA, GLOBAL_FEATURE_NAMES, OBSERVATION_FEATURE_NAMES, RANKER_FEATURE_NAMES } from "../challengeContract/features";
import { decodeObservation, encodeObservation } from "../challengeContract/observationCodec";
import { ContractError } from "../challengeContract/validation";

const fixture = (): AuthorizedObservation => {
  const snap = parseScFen("SCFEN|4k2q/8/8/8/8/8/BRN1P3/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:");
  snap.siegedTanks = ["b2"];
  snap.mines = [{ at: "c2", color: "w" }];
  return observe(snap, { w: 3, b: 3 }, "w", [{ square: "h7", piece: { type: "r", color: "b" }, observedTurn: 11 }]);
};
const named = (names: readonly string[], vector: readonly number[], key: string) => {
  const index = names.indexOf(key);
  expect(index, key).toBeGreaterThanOrEqual(0);
  return vector[index]!;
};
const move = (to: Square, from: Square = "b2"): ScActionInput => ({ kind: "classical", timing: "C", color: "w", from, to });

describe("Phase 2 observation-safe numeric features", () => {
  it("pins finite named dimensions, unique names, scales, and frozen output", () => {
    const obs = fixture();
    const candidate = encodeCandidate(obs, [move("h7")]);
    const features = encodeFeatures(obs, candidate);
    expect(GLOBAL_FEATURE_NAMES).toHaveLength(23);
    expect(CELL_FEATURE_NAMES).toHaveLength(25);
    expect(OBSERVATION_FEATURE_NAMES).toHaveLength(1623);
    expect(ACTION_FEATURE_NAMES).toHaveLength(64);
    expect(RANKER_FEATURE_NAMES).toHaveLength(158);
    expect(features.observation).toHaveLength(1623);
    expect(features.actions).toHaveLength(1);
    expect(features.actions[0]).toHaveLength(64);
    expect(features.ranker).toHaveLength(158);
    for (const names of [OBSERVATION_FEATURE_NAMES, ACTION_FEATURE_NAMES, RANKER_FEATURE_NAMES]) expect(new Set(names).size).toBe(names.length);
    expect([...features.observation, ...features.actions.flat(), ...features.ranker].every(Number.isFinite)).toBe(true);
    expect(FEATURE_SCHEMA).toMatchObject({ version: "challenge-features-v1", scales: { minerals: 12, gas: 3, ccLives: 3, turn: 45, squareCount: 64, coordinate: 7, actionCount: 65, relativeIndex: 64 }, actionPositionWeight: "index+1" });
    expect(Object.isFrozen(features)).toBe(true);
    expect(Object.isFrozen(features.observation)).toBe(true);
    expect(Object.isFrozen(features.actions[0])).toBe(true);
    expect(Object.isFrozen(features.ranker)).toBe(true);
  });

  it("separates unknown, known-empty, revealed Battleship, own mine, and own siege masks", () => {
    const features = encodeFeatures(fixture(), encodeCandidate(fixture(), []));
    const at = (square: Square, name: string) => named(OBSERVATION_FEATURE_NAMES, features.observation, `${square}.${name}`);
    expect(at("h7", "visibility.unknown")).toBe(1);
    expect(at("h7", "knownEmpty")).toBe(0);
    expect(at("h7", "piece.r")).toBe(0);
    expect(at("d1", "visibility.lit")).toBe(1);
    expect(at("d1", "knownEmpty")).toBe(1);
    expect(at("h8", "visibility.revealed")).toBe(1);
    expect(at("h8", "enemyPiece")).toBe(1);
    expect(at("h8", "piece.q")).toBe(1);
    expect(at("h8", "knownEmpty")).toBe(0);
    expect(at("c2", "ownMine")).toBe(1);
    expect(at("b2", "ownTankMode.applicable")).toBe(1);
    expect(at("b2", "ownTankMode.sieged")).toBe(1);
    expect(at("e2", "ownTankMode.applicable")).toBe(0);
    expect(at("e2", "ownTankMode.sieged")).toBe(0);
    for (const square of ["h7", "h8", "d1", "b2"] as const) expect(at(square, "enemyMine.unknown")).toBe(1);
    expect(at("h7", "enemyTankMode.unknown")).toBe(1);
    expect(at("d1", "enemyTankMode.unknown")).toBe(0);
    expect(at("h8", "enemyTankMode.unknown")).toBe(0);
    expect(at("h7", "memory.present")).toBe(1);
    expect(at("h7", "memory.piece.r")).toBe(1);
    expect(at("h7", "memory.age")).toBeCloseTo(10 / MAX_GAME_TURNS);
    expect(at("h8", "memory.age")).toBe(0);
    expect(at("h8", "memory.piece.q")).toBe(1);
    expect(at("d1", "memory.present")).toBe(0);
    expect(at("d1", "memory.age")).toBe(0);
    expect(named(OBSERVATION_FEATURE_NAMES, features.observation, "own.count.r")).toBe(1 / 64);
    expect(named(OBSERVATION_FEATURE_NAMES, features.observation, "observedEnemy.count.q")).toBe(1 / 64);
    expect(named(OBSERVATION_FEATURE_NAMES, features.observation, "observedEnemy.count.r")).toBe(0);
  });

  it("keeps enemy tank mode unknown even for a currently lit enemy tank", () => {
    const obs = observe(parseScFen("SCFEN|7k/8/8/8/8/8/4r3/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:"), { w: 3, b: 3 }, "w");
    const features = encodeFeatures(obs, encodeCandidate(obs, [move("e2", "e1")]));
    expect(named(OBSERVATION_FEATURE_NAMES, features.observation, "e2.enemyTankMode.unknown")).toBe(1);
    expect(named(OBSERVATION_FEATURE_NAMES, features.observation, "e2.ownTankMode.applicable")).toBe(0);
    expect(named(ACTION_FEATURE_NAMES, features.actions[0]!, "target.enemyTankMode.unknown")).toBe(1);
  });

  it("conditions target features on each candidate without changing observation features", () => {
    const obs = fixture();
    const rows = (["h7", "d1", "h8", "c2"] as const).map((to) => encodeFeatures(obs, encodeCandidate(obs, [move(to)])));
    expect(rows.every((row) => JSON.stringify(row.observation) === JSON.stringify(rows[0]!.observation))).toBe(true);
    const value = (index: number, name: string) => named(ACTION_FEATURE_NAMES, rows[index]!.actions[0]!, name);
    expect(value(0, "actor.present")).toBe(1);
    expect(value(0, "actor.piece.r")).toBe(1);
    expect(value(0, "actorTankMode.sieged")).toBe(1);
    expect(value(0, "targetVisibility.unknown")).toBe(1);
    expect(value(0, "target.knownEmpty")).toBe(0);
    expect(value(0, "targetMemory.piece.r")).toBe(1);
    expect(value(0, "targetMemory.age")).toBeCloseTo(10 / 45);
    expect(value(1, "targetVisibility.lit")).toBe(1);
    expect(value(1, "target.knownEmpty")).toBe(1);
    expect(value(2, "targetVisibility.revealed")).toBe(1);
    expect(value(2, "target.enemyPiece")).toBe(1);
    expect(value(2, "target.piece.q")).toBe(1);
    expect(value(2, "targetMemory.age")).toBe(0);
    expect(value(3, "target.ownMine")).toBe(1);
    expect(value(3, "target.ownPiece")).toBe(1);
    expect(value(3, "target.piece.n")).toBe(1);
    expect(new Set(rows.map((row) => JSON.stringify(row.actions))).size).toBe(4);
  });

  it("encodes pass with zero rows, action counts, margins, and fixed-width ranker summaries", () => {
    const obs = fixture();
    const pass = encodeFeatures(obs, encodeCandidate(obs, []));
    expect(pass.actions).toEqual([]);
    const value = (name: string) => named(RANKER_FEATURE_NAMES, pass.ranker, name);
    expect(value("bias")).toBe(1);
    expect(value("pass")).toBe(1);
    expect(value("actionCount")).toBe(0);
    expect(value("requestedGas")).toBe(0);
    expect(value("requestedMinerals")).toBe(0);
    expect(value("mineralMargin")).toBe(3 / 12);
    expect(value("gasMargin")).toBe(1);
    for (const name of RANKER_FEATURE_NAMES.filter((name) => name.startsWith("sum.") || name.startsWith("positionWeighted."))) expect(value(name)).toBe(0);
  });

  it("retains ordered rows and position-weighted kinds rather than bagging the queue", () => {
    const obs = fixture();
    const actions: ScActionInput[] = [{ kind: "siegeMode", timing: "B", color: "w", from: "b2" }, move("h8")];
    const forward = encodeFeatures(obs, encodeCandidate(obs, actions));
    const reverse = encodeFeatures(obs, encodeCandidate(obs, [...actions].reverse()));
    const value = (name: string) => named(RANKER_FEATURE_NAMES, forward.ranker, name);
    expect(value("pass")).toBe(0);
    expect(value("actionCount")).toBe(2 / 65);
    expect(value("requestedGas")).toBe(1 / 3);
    expect(value("sum.kind.siegeMode")).toBe(1);
    expect(value("sum.kind.classical")).toBe(1);
    expect(value("positionWeighted.kind.siegeMode")).toBe(1);
    expect(value("positionWeighted.kind.classical")).toBe(2);
    expect(named(RANKER_FEATURE_NAMES, reverse.ranker, "positionWeighted.kind.siegeMode")).toBe(2);
    expect(named(ACTION_FEATURE_NAMES, forward.actions[0]!, "relativeIndex")).toBe(0);
    expect(named(ACTION_FEATURE_NAMES, forward.actions[1]!, "relativeIndex")).toBe(1 / 64);
    expect(named(ACTION_FEATURE_NAMES, forward.actions[0]!, "to.present")).toBe(0);
    expect(named(ACTION_FEATURE_NAMES, forward.actions[0]!, "target.enemyMine.unknown")).toBe(0);
    expect(forward.ranker).not.toEqual(reverse.ranker);
    expect(forward.actions).not.toEqual(reverse.actions);
  });

  it.each(["w", "b"] as const)("uses side-relative ownership and forward deltas for %s", (side) => {
    const obs = observe(parseScFen("SCFEN|4k3/3p4/8/8/8/8/3P4/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:"), { w: 3, b: 3 }, side);
    const action: ScActionInput = { kind: "stimStep", timing: "F", color: side, from: side === "w" ? "d2" : "d7", to: side === "w" ? "d3" : "d6", promotion: "q" };
    const row = encodeFeatures(obs, encodeCandidate(obs, [action])).actions[0]!;
    expect(named(ACTION_FEATURE_NAMES, row, "delta.forward")).toBe(1 / 7);
    expect(named(ACTION_FEATURE_NAMES, row, "delta.file")).toBe(0);
    expect(named(ACTION_FEATURE_NAMES, row, "actor.piece.p")).toBe(1);
    expect(named(ACTION_FEATURE_NAMES, row, "promotion.present")).toBe(1);
    expect(named(ACTION_FEATURE_NAMES, row, "promotion.q")).toBe(1);
    expect(named(ACTION_FEATURE_NAMES, row, "requestedGas")).toBe(1 / 3);
  });

  it("excludes baseline scores and metadata from named features and rejects injected fields/nonfinite inputs", () => {
    expect([...OBSERVATION_FEATURE_NAMES, ...ACTION_FEATURE_NAMES, ...RANKER_FEATURE_NAMES].join(" ")).not.toMatch(/baselineScore|gameId|historicalResult|source|queue|enemyGas|enemyMinerals/);
    const obs = fixture();
    const candidate = encodeCandidate(obs, []);
    expect(() => encodeFeatures(obs, { ...candidate, baselineScore: 1 } as typeof candidate)).toThrow(ContractError);
    expect(() => encodeFeatures({ ...obs, source: "private" } as AuthorizedObservation, candidate)).toThrow(ContractError);
    expect(() => encodeFeatures({ ...obs, own: { ...obs.own, minerals: NaN } }, candidate)).toThrow(ContractError);
    expect(() => encodeFeatures(obs, { ...candidate, ownSpend: { minerals: Infinity, gas: 0 } })).toThrow(ContractError);
  });

  it("names every action kind, timing, spawn type, cost, and absent actor without projecting the queue", () => {
    const obs = fixture();
    for (const kind of ACTION_KINDS) {
      for (const timing of kind === "classical" ? ["C"] as const : ["B", "F"] as const) {
        const action = { kind, timing, color: "w", from: "g7", ...(["classical", "deploy", "stimStep", "charonMissiles", "tacticalJump"].includes(kind) ? { to: "h7" } : {}), ...(kind === "deploy" ? { unit: "q" } : {}) } as ScActionInput;
        const row = encodeFeatures(obs, encodeCandidate(obs, [action])).actions[0]!;
        for (const other of ACTION_KINDS) expect(named(ACTION_FEATURE_NAMES, row, `kind.${other}`)).toBe(Number(kind === other));
        for (const other of ["B", "C", "F"]) expect(named(ACTION_FEATURE_NAMES, row, `timing.${other}`)).toBe(Number(timing === other));
        expect(named(ACTION_FEATURE_NAMES, row, "actor.present")).toBe(0);
        expect(named(ACTION_FEATURE_NAMES, row, "from.file")).toBe(6 / 7);
        expect(named(ACTION_FEATURE_NAMES, row, "from.rank")).toBe(6 / 7);
        expect(named(ACTION_FEATURE_NAMES, row, "requestedGas")).toBe((kind === "classical" ? 0 : kind === "charonMissiles" ? 2 : kind === "tacticalJump" ? 3 : 1) / 3);
        expect(named(ACTION_FEATURE_NAMES, row, "requestedMinerals")).toBe(kind === "deploy" ? 9 / 12 : 0);
      }
    }
    for (const [unit, minerals] of [["p", 1], ["n", 3], ["b", 3], ["r", 5], ["q", 9]] as const) {
      const row = encodeFeatures(obs, encodeCandidate(obs, [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1", unit }])).actions[0]!;
      expect(named(ACTION_FEATURE_NAMES, row, "deployUnit.present")).toBe(1);
      expect(named(ACTION_FEATURE_NAMES, row, `deployUnit.${unit}`)).toBe(1);
      expect(named(ACTION_FEATURE_NAMES, row, "requestedMinerals")).toBe(minerals / 12);
      expect(named(ACTION_FEATURE_NAMES, row, "promotion.present")).toBe(0);
    }
  });

  it.each(["w", "b"] as const)("keeps %s encodings invariant under hidden changes with fixed authorized history and detects visible changes", (side) => {
    const original = parseScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:");
    const enemy = side === "w" ? "b" : "w";
    const dark: Square = side === "w" ? "a8" : "a1";
    const prior: Sighting[] = [{ square: dark, piece: { type: "n", color: enemy }, observedTurn: 10 }];
    const changed = structuredClone(original);
    const map = placementToMap(changed.placement);
    map.set(dark, { type: "r", color: enemy });
    changed.placement = mapToPlacement(map);
    changed.siegedTanks = [dark];
    changed.mines = [{ at: dark, color: enemy }];
    changed.gas[enemy] = 0;
    changed.gasIncome[enemy] = 1;
    changed.ccLives[enemy] = 1;
    changed.stored = { w: side === "w" ? 3 : 12, b: side === "b" ? 3 : 12 };
    changed.queue = { actions: [{ kind: "classical", timing: "C", color: enemy, from: side === "w" ? "e8" : "e1", to: dark, seq: 999 }] };
    Object.assign(changed, { gameId: "different", historicalResult: enemy, source: "private", futureTrace: ["hidden"] });
    const baseObs = observe(original, { w: 3, b: 3 }, side, prior);
    const changedObs = observe(changed, changed.stored, side, prior);
    expect(changedObs.cells.find((cell) => cell.square === dark)?.visibility).toBe("unknown");
    expect(encodeObservation(changedObs)).toBe(encodeObservation(baseObs));
    const baseCandidates = encodeBaselineCandidates(decodeObservation(encodeObservation(baseObs)));
    const changedCandidates = encodeBaselineCandidates(changedObs);
    expect(changedCandidates).toEqual(baseCandidates);
    expect(changedCandidates.map(({ candidate }) => encodeFeatures(changedObs, candidate))).toEqual(baseCandidates.map(({ candidate }) => encodeFeatures(baseObs, candidate)));
    const visibleMap = placementToMap(original.placement);
    visibleMap.set(side === "w" ? "e2" : "e7", { type: "p", color: enemy });
    const visibleObs = observe({ ...original, placement: mapToPlacement(visibleMap) }, { w: 3, b: 3 }, side, prior);
    expect(encodeObservation(visibleObs)).not.toBe(encodeObservation(baseObs));
    expect(encodeBaselineCandidates(visibleObs)).not.toEqual(baseCandidates);
    const basePass = encodeFeatures(baseObs, encodeCandidate(baseObs, []));
    const visiblePass = encodeFeatures(visibleObs, encodeCandidate(visibleObs, []));
    expect(visiblePass.observation).not.toEqual(basePass.observation);
    expect(visiblePass.ranker).not.toEqual(basePass.ranker);
  });
});
