// SPEC: _spec/initialization.puml
import { expect, test } from "bun:test";
import * as contracts from "../src";
import { canonicalInitialObservation } from "@chess-coach/contracts/initialization";
import type { StarChessColor } from "@chess-coach/game-core";
import fixture from "../../game-core/tests/fixtures/canonical-opening.json";

for (const side of ["w", "b"] as const) {
  test(`${side}: canonical recipient comes from current vision with no invented history`, () => {
    const observation = canonicalInitialObservation(side);
    expect(observation.side).toBe(side);
    expect(observation.turn).toBe(0);
    expect(observation.own).toMatchObject({ minerals: 3, gas: 1, gasIncome: 1, ccLives: 3, mines: [], siegedTanks: [] });
    expect(observation.own.pieces).toHaveLength(5);
    expect(observation.everLit.map(String)).toEqual(fixture.vision[side].lit);
    expect(observation.memory).toEqual([]);
    expect(observation.cells.filter(cell => cell.visibility === "lit").map(cell => String(cell.square))).toEqual(fixture.vision[side].lit);
    expect(observation.cells.filter(cell => cell.visibility === "unknown")).toHaveLength(47);
    expect(observation.cells.some(cell => cell.visibility !== "unknown" && cell.piece?.color !== side && cell.piece !== null)).toBe(false);
    const enemyOpening = side === "w" ? ["c7", "d7", "e7", "f7", "e8"] : ["c2", "d2", "e2", "f2", "e1"];
    for (const square of enemyOpening) expect(observation.cells.find(cell => cell.square === square)?.visibility).toBe("unknown");
    expect(observation.ownUnitLineage.every(unit => unit.paidBasis === 0 && unit.id.startsWith(`${side}:unit:opening:`))).toBe(true);
    expect(observation.ownUnitLineage.reduce((sum, unit) => sum + unit.replacementValue, 0)).toBe(4);
    expect(observation.ownMineLineage).toEqual([]);
    expect(observation.economy).toEqual({
      side, ownPaidDebits: 0, ownPaidSurviving: 0, ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0,
      enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" },
      receipts: [], retiredOwnIds: [],
    });
    const json = contracts.encodeObservation(observation);
    expect(contracts.decodeObservation(json)).toEqual(observation);
    expect(contracts.encodeObservation(canonicalInitialObservation(side))).toBe(json);
  });
}

test("initial producer returns detached frozen recipients and stays out of model-facing root exports", () => {
  const first = canonicalInitialObservation("w");
  const second = canonicalInitialObservation("w");
  const black = canonicalInitialObservation("b");
  expect(first).not.toBe(second);
  expect(first.cells).not.toBe(second.cells);
  expect(first.ownUnitLineage).not.toBe(second.ownUnitLineage);
  expect(first.own.pieces[0]!.piece).not.toBe(second.own.pieces[0]!.piece);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.cells)).toBe(true);
  expect(Object.isFrozen(first.own.pieces[0]!.piece)).toBe(true);
  expect(black.ownUnitLineage.every(unit => unit.id.startsWith("b:"))).toBe(true);
  expect(Reflect.has(contracts, "canonicalInitialObservation")).toBe(false);
  expect(() => canonicalInitialObservation("x" as StarChessColor)).toThrow("Unknown recipient side");
});
