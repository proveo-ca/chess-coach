// SPEC: _spec/game-core.puml
import { expect, test } from "bun:test";
import { getSideVision, isScMoveShape, placementToMap, scMovesFrom } from "../src";

test("public planning primitives hide an unseen blocker without consulting it for intent shape", () => {
  const simulator = placementToMap("4k3/8/3p4/8/8/8/8/3RK3");
  const vision = getSideVision(simulator, "w");
  expect(vision.litSquares.has("d6")).toBe(false);
  const recipientBoard = new Map([...simulator].filter(([at, piece]) =>
    piece.color === "w" || vision.litSquares.has(at) || vision.revealedPieces.has(at),
  ));
  expect(recipientBoard.has("d6")).toBe(false);
  expect(scMovesFrom(recipientBoard, "d1", "w").some(move => move.to === "d7")).toBe(true);
  expect(scMovesFrom(simulator, "d1", "w").some(move => move.to === "d7")).toBe(false);
  expect(isScMoveShape("r", "d1", "d7", "w")).toBe(true);
});
