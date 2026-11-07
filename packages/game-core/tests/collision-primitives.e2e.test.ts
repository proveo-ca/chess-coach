// SPEC: _spec/resolution-primitives.puml
import { expect, test } from "bun:test";
import { mineContact, moverContact, pathContactSquares, timedMover, withoutMine } from "../src";

test("a chased mine's landing death prevents a later mover contact", () => {
  const mines = [{ at: "a2" as const, color: "b" as const }];
  const hit = mineContact({ mines, color: "w", piece: "r", squares: [...pathContactSquares("a1", "a3", "r"), "a3"], mode: "walk" });
  expect(hit).toEqual({ kind: "detonated", at: "a3", mineColor: "b", chaseFrom: "a2" });
  const first = timedMover("a1", "a3", "r", { diesOnLanding: hit.kind === "detonated" });
  const second = timedMover("a7", "a3", "r");
  expect(moverContact(first, second)).toBeNull();
  expect(withoutMine(mines, hit)).toEqual([]);
  expect(mines).toHaveLength(1);
});
