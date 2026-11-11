// SPEC: _spec/turn-planning.puml
import { expect, test } from "bun:test";
import { decodeCandidate, decodeObservation } from "@chess-coach/contracts";
import { addScAction, assertQueueGas, knownAppendFailure, nativeClassicalChecks, removeScAction } from "@chess-coach/game-core";
import type { PlanningKnowledge, ScAction, ScActionInput, ScFenSnapshot } from "@chess-coach/game-core";
import { fixture } from "../../contracts/tests/fixture";
import { FEATURES, encodeFeatures } from "../src";

test("validated recipient actions pass append and dependency checks before encoding", () => {
  const observationJson = JSON.stringify(fixture());
  const observation = decodeObservation(observationJson);
  const json = JSON.stringify({ version: "chess-coach.candidate.v1", actions: [
    { kind: "stimStep", timing: "B", color: "w", from: "d2", to: "d3" },
    { kind: "classical", timing: "C", color: "w", from: "d2", to: "d4" },
  ] });
  const candidate = decodeCandidate(json, observation.side);
  const known: PlanningKnowledge = {
    side: observation.side,
    knownPieces: new Map(observation.cells.flatMap(cell => cell.visibility !== "unknown" && cell.piece ? [[cell.square, cell.piece] as const] : [])),
    unknownSquares: new Set(observation.cells.filter(cell => cell.visibility === "unknown").map(cell => cell.square)),
    ownMines: new Set(observation.own.mines), ownSiegedTanks: new Set(observation.own.siegedTanks),
  };
  const prefix: ScActionInput[] = [];
  for (const action of candidate.actions) {
    expect(knownAppendFailure(known, prefix, action)).toBeNull();
    prefix.push(action);
  }
  const actions: ScAction[] = prefix.map((action, seq) => ({ ...action, seq }));
  const classical = actions.find((action): action is Extract<ScAction, { timing: "C" }> => action.timing === "C")!;
  const checked = nativeClassicalChecks({ ownUnits: new Map(observation.own.pieces.map(entry => [entry.square, entry.piece])), ownSieged: known.ownSiegedTanks }, actions, classical);
  expect(checked.insertion.diagnostic).toBeUndefined();
  expect(checked.resulting).toMatchObject({ kind: "LIVE", from: "d3", to: "d5" });
  expect(known.knownPieces.has("e8")).toBe(false);
  let host: ScFenSnapshot = {
    placement: "4k2q/8/8/8/8/8/3P4/2B1K3", phase: "P", turn: 1, ccLives: { w: 3, b: 3 },
    gas: { w: 1, b: 1 }, gasIncome: { w: 1, b: 1 }, queue: { actions: [] },
  };
  for (const action of candidate.actions) host = addScAction({ snapshot: host, action }).snapshot;
  expect(host.gas.w).toBe(0);
  expect(host.queue?.actions).toHaveLength(2);
  expect(() => assertQueueGas(host)).not.toThrow();
  expect(removeScAction({ snapshot: host, seq: 0 }).snapshot.gas.w).toBe(1);
  expect(encodeFeatures(observationJson, [json]).values).toHaveLength(FEATURES);
});
