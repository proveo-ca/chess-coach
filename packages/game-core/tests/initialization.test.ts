// SPEC: _spec/initialization.puml
import { expect, test } from "bun:test";
import { createCanonicalGame, deployedMaterialFromPlacement, getSideVision, placementToMap } from "../src";
import fixture from "./fixtures/canonical-opening.json";

test("canonical initialization matches the exact reference snapshot without a grant", () => {
  const game = createCanonicalGame();
  expect(game.snapshot).toEqual({ ...fixture.snapshot, phase: "P" });
  expect(game.openingUnits).toHaveLength(10);
  expect(game.snapshot.turn).toBe(0);
  expect(game.snapshot.stored).toEqual({ w: 3, b: 3 });
  expect(game.snapshot.queue?.actions).toEqual([]);
  expect(game.snapshot.mines ?? []).toEqual([]);
  expect(game.snapshot.siegedTanks ?? []).toEqual([]);
  expect(game.snapshot.pendingCCShots ?? []).toEqual([]);
});

for (const side of ["w", "b"] as const) {
  test(`${side}: public opening seeds endowed identities, not payments`, () => {
    const { snapshot, openingUnits } = createCanonicalGame();
    const own = openingUnits.filter(unit => unit.color === side);
    expect(own).toHaveLength(5);
    expect(own.filter(unit => unit.type === "p").map(unit => unit.square)).toEqual(
      side === "w" ? ["c2", "d2", "e2", "f2"] : ["c7", "d7", "e7", "f7"],
    );
    expect(own.find(unit => unit.type === "k")?.square).toBe(side === "w" ? "e1" : "e8");
    expect(own.reduce((sum, unit) => sum + unit.paidBasis, 0)).toBe(0);
    expect(own.reduce((sum, unit) => sum + unit.replacementValue, 0)).toBe(4);
    expect(deployedMaterialFromPlacement(snapshot.placement, side)).toBe(5);
    for (const unit of own) {
      expect(unit.id).toBe(`${side}:unit:opening:${unit.square}`);
      expect(placementToMap(snapshot.placement).get(unit.square)).toEqual({ type: unit.type, color: side });
    }
    const vision = getSideVision(snapshot.placement, side);
    expect([...vision.litSquares].sort().map(String)).toEqual(fixture.vision[side].lit);
    expect([...vision.revealedPieces].sort()).toEqual(fixture.vision[side].revealed);
  });
}

test("canonical game calls own independent nested state and identity records", () => {
  const first = createCanonicalGame();
  const second = createCanonicalGame();
  first.snapshot.ccLives.w = 0;
  first.snapshot.stored!.w = 0;
  first.snapshot.gas.b = 0;
  first.snapshot.gasIncome.w = 3;
  first.snapshot.queue = { actions: [{ kind: "classical", timing: "C", color: "w", from: "e1", to: "f1", seq: 0 }] };
  first.openingUnits[0]!.square = "a1";
  first.openingUnits.pop();
  expect(second).toEqual(createCanonicalGame());
  expect(second.snapshot).toEqual({ ...fixture.snapshot, phase: "P" });
  expect(second.snapshot.gas).not.toBe(second.snapshot.gasIncome);
  expect(second.openingUnits).toHaveLength(10);
});
