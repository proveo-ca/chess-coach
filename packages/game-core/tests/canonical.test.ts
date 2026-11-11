// SPEC: _spec/game-core.puml
import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { getSideVision, getUnitVision, isScMoveShape, scMovesFrom, sq } from "../src";
import type { ScPiece, SideVision, Square } from "../src";
import golden from "./fixtures/canonical-primitives.json";

test("matches canonical move, fog and shape fingerprints across the board corpus", () => {
  const hashes = { moves: createHash("sha256"), vision: createHash("sha256"), shapes: createHash("sha256") };
  const visionData = (vision: SideVision) => ({ lit: [...vision.litSquares].sort(), revealed: [...vision.revealedPieces].sort() });
  const squares = Array.from({ length: 64 }, (_, index) => sq(Math.floor(index / 8), index % 8 + 1)!);
  let boards = 0;
  let shapeQueries = 0;
  for (const color of ["w", "b"] as const) {
    for (const type of ["p", "n", "b", "r", "q", "k"] as const) {
      for (const from of squares) {
        for (const blocked of [false, true]) {
          const map = new Map<Square, ScPiece>();
          if (blocked) {
            for (const at of ["b2", "c4", "d5", "e3", "f6", "g7"] as const) {
              map.set(at, { type: "p", color: color === "w" ? "b" : "w" });
            }
          }
          map.set(from, { type, color });
          if (from !== "h8") map.set("h8", { type: "q", color: color === "w" ? "b" : "w" });
          const opts = { siegedTanks: [from], mines: [{ at: "c3", color: "w" }, { at: "f6", color: "b" }] as const };
          for (const options of [undefined, opts]) hashes.moves.update(JSON.stringify(scMovesFrom(map, from, color, options)) + "\n");
          for (const mode of ["tank", "siege"] as const) {
            const options = { tankModeFor: () => mode, mines: opts.mines };
            hashes.vision.update(JSON.stringify([
              visionData(getUnitVision(map, from, options)), visionData(getSideVision(map, color, options)),
            ]) + "\n");
          }
          boards++;
        }
        for (const to of squares) {
          hashes.shapes.update(JSON.stringify(isScMoveShape(type, from, to, color)) + "\n");
          shapeQueries++;
        }
      }
    }
  }
  expect(boards).toBe(golden.boards);
  expect(shapeQueries).toBe(golden.shapeQueries);
  expect(Object.fromEntries(Object.entries(hashes).map(([key, hash]) => [key, hash.digest("hex")]))).toEqual(golden.sha256);
});
