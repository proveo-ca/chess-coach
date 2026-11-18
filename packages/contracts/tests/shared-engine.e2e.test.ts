// SPEC: _spec/engine-consolidation.puml
import { expect, test } from "bun:test";
import { beginScTurn, endScTurn } from "../../starchess-core/src/resolve/submit-turn";
import { addScAction as appendProduct } from "../../starchess-core/src/commands/queue-action";
import { addScAction } from "@chess-coach/starchess-core/engine";
import { applyStoredIncome, mapToPlacement, UNIT_COST } from "@chess-coach/starchess-core/engine";
import type { ScActionInput, ScFenSnapshot, ScPiece, Square } from "@chess-coach/starchess-core/engine";
import { encodeFeatures } from "../../policy/src";
import { openGame, seedGame, settleGame } from "../src/game-session";
import type { GamePlans } from "../src/game-session";

const plans: GamePlans[] = [
  { w: [{ timing: "B", kind: "stimStep", color: "w", from: "d2", to: "d3" },
      { timing: "C", kind: "classical", color: "w", from: "d2", to: "d4" },
      { timing: "F", kind: "deploy", color: "w", from: "a1", to: "b1", unit: "p" }],
    b: [{ timing: "B", kind: "stimStep", color: "b", from: "e7", to: "e6" },
      { timing: "C", kind: "classical", color: "b", from: "e7", to: "e5" },
      { timing: "F", kind: "deploy", color: "b", from: "h8", to: "g8", unit: "p" }] },
  { w: [{ timing: "B", kind: "spiderMine", color: "w", from: "b2" },
      { timing: "C", kind: "classical", color: "w", from: "d5", to: "d6" },
      { timing: "F", kind: "deploy", color: "w", from: "a1", to: "a2", unit: "p" }],
    b: [{ timing: "B", kind: "spiderMine", color: "b", from: "g7" },
      { timing: "C", kind: "classical", color: "b", from: "e4", to: "e3" },
      { timing: "F", kind: "deploy", color: "b", from: "h8", to: "g8", unit: "r" }] },
  { w: [{ timing: "B", kind: "deploy", color: "w", from: "a1", to: "b1", unit: "n" },
      { timing: "C", kind: "classical", color: "w", from: "b2", to: "c4" },
      { timing: "F", kind: "stimStep", color: "w", from: "d6", to: "d7" }],
    b: [{ timing: "B", kind: "deploy", color: "b", from: "h8", to: "g8", unit: "n" },
      { timing: "C", kind: "classical", color: "b", from: "g7", to: "f5" },
      { timing: "F", kind: "stimStep", color: "b", from: "e3", to: "e2" }] },
];

const initial = (hidden: Square): ScFenSnapshot => {
  const units: [Square, ScPiece][] = [["a1", { color: "w", type: "k" }], ["b2", { color: "w", type: "n" }],
    ["d2", { color: "w", type: "p" }], ["h8", { color: "b", type: "k" }], ["g7", { color: "b", type: "n" }],
    ["e7", { color: "b", type: "p" }], [hidden, { color: "b", type: "p" }]];
  return { placement: mapToPlacement(new Map(units)), turn: 21, phase: "P", ccLives: { w: 3, b: 3 },
    gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 }, stored: { w: 12, b: 12 }, queue: { actions: [] } };
};

test("product and GameSession share B/C/F physics, host banks and private lineage across multiple turns", () => {
  const sessions = [seedGame(initial("a8"), { w: 12, b: 12 }), seedGame(initial("a7"), { w: 12, b: 12 })];
  for (const requested of plans) {
    for (const [index, previous] of sessions.entries()) {
      const opened = openGame(previous);
      expect(opened.native.value.result).toEqual(beginScTurn(previous.snapshot));
      let productQueued = opened.session.snapshot;
      let nativeQueued = opened.session.snapshot;
      for (const side of ["w", "b"] as const) for (const action of requested[side]) {
        productQueued = appendProduct({ snapshot: productQueued, action }).snapshot;
        nativeQueued = addScAction({ snapshot: nativeQueued, action }).snapshot;
      }
      expect(productQueued).toEqual(nativeQueued);
      const appResult = endScTurn(productQueued, { skipTurnStartChecks: true });
      const settled = settleGame(opened.session, requested);
      expect(settled.native.kind).toBe("settled");
      if (settled.native.kind !== "settled") throw new Error("expected settlement");
      expect(settled.native.value.result).toEqual(appResult);
      const debit = (actions: readonly ScActionInput[]): number => actions.reduce((sum, action) => sum +
        (action.kind === "deploy" && action.unit ? UNIT_COST[action.unit] : 0), 0);
      const bank = applyStoredIncome({ w: previous.bank.w - debit(requested.w), b: previous.bank.b - debit(requested.b) }, appResult.next.turn);
      expect(settled.session.bank).toEqual(bank);
      expect(settled.session.snapshot).toEqual({ ...appResult.next, stored: bank });
      expect(settled.native.value.state.callOrdinal).toBe(previous.native.callOrdinal + 2);
      expect(settled.native.value.journal.events.length).toBeGreaterThan(0);
      for (const side of ["w", "b"] as const) {
        const batch = settled.session.batches[side];
        expect(batch.observation.own.minerals).toBe(bank[side]);
        for (const privateKey of ["engine:", "evaluationActorId", "appliedTargetId", "discoveryOrdinal", "returnedStep", "visibleTo", "actionSeq"]) {
          expect(JSON.stringify(batch)).not.toContain(privateKey);
        }
        expect(batch.observation.cells.filter(cell => cell.visibility === "unknown").every(cell => Object.keys(cell).sort().join() === "square,visibility")).toBe(true);
      }
      sessions[index] = settled.session;
    }
    expect(sessions[0]!.snapshot.placement).not.toBe(sessions[1]!.snapshot.placement);
    expect(sessions[0]!.batches.w).toEqual(sessions[1]!.batches.w);
    const featureRows = sessions.map(session => encodeFeatures(JSON.stringify(session.batches.w.observation),
      [JSON.stringify({ version: "chess-coach.candidate.v1", actions: [] })]));
    expect(featureRows[0]!.values).toEqual(featureRows[1]!.values);
    expect(featureRows[0]!.values).toBeInstanceOf(Float64Array);
  }
  expect(sessions[0]!.native.callOrdinal).toBe(6);
  expect(sessions[0]!.batches.b.observation.economy.ownPaidDestroyed).toBeGreaterThan(0);
  expect(sessions[0]!.batches.w.observation.ownUnitLineage.some(unit => unit.id.startsWith("w:unit:opening:"))).toBe(true);
});
