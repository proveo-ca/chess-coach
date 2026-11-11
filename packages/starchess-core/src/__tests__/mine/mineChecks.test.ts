/**
 * A mine on a check ray is **not** a blocker. `collectLegalCCChecks` and
 * `applyPendingCCShots` both read the placement map, and mines are not FEN
 * pieces — so the shot travels through the mined tile, the HP drops, and the
 * mine is still armed afterwards. Only a capture *on* the mined tile spends it
 * (`clearOnCapture`), which is what a real blocker gets instead of the Command Center.
 * // SPEC: _spec/packages/starchess-core/mine-contact.puml, _spec/packages/starchess-core/resolve.puml
 */
import { describe, expect, it } from "vitest";

import {
  applyPendingCCShots,
  collectLegalCCChecks,
  placementToMap,
  rayBetween,
  type ScMine,
} from "../../index";

/** Mecha on h1, enemy Command Center on a8 — one long diagonal, nothing on it. */
const DIAGONAL = "k7/8/8/8/8/8/8/6KB";
const MINE_C6: ScMine[] = [{ color: "b", at: "c6" }];
const LIVES = { w: 3, b: 3 };

describe("mines do not block Command Center checks", () => {
  it("c6 is on the h1-a8 ray (the mine is planted in the line, not beside it)", () => {
    expect(rayBetween("h1", "a8")).toContain("c6");
  });

  it("collectLegalCCChecks reads through a mined tile", () => {
    // It takes no mines at all — the check is pure placement geometry, so a
    // mine on the ray cannot even be consulted, let alone block.
    expect(
      collectLegalCCChecks(DIAGONAL)
        .filter((c) => c.color === "w")
        .map((c) => `${c.piece}${c.from}${c.to}`),
    ).toEqual(["bh1a8"]);
  });

  it("the shot lands through the mine and leaves it armed", () => {
    const pending = collectLegalCCChecks(DIAGONAL).filter((c) => c.color === "w");
    const shot = applyPendingCCShots({
      placement: DIAGONAL,
      ccLives: LIVES,
      pending,
      mines: MINE_C6,
    });
    expect(shot.ccLives).toEqual({ w: 3, b: 2 });
    expect(shot.attacks).toEqual([
      expect.objectContaining({ kind: "ccShot", from: "h1", to: "a8", target: "b" }),
    ]);
    // Not spent: a Command Center shot is neither a walk onto c6 nor a capture on it.
    expect(shot.mines).toEqual(MINE_C6);
    expect(shot.placement).toBe(DIAGONAL);
  });

  it("a *piece* on that tile blocks the check outright", () => {
    // Contrast case: swap the mine for a marine and no check is collected at all.
    const blocked = "k7/8/2p5/8/8/8/8/6KB";
    expect(collectLegalCCChecks(blocked).filter((c) => c.color === "w")).toEqual([]);
  });

  it("an interposed piece eats a pre-collected shot; a mine cannot", () => {
    // Shots collected before the interposition (the `H:` carry) run
    // `firstBlockerOnRay`, which is the other place a mine could wrongly block.
    const pending = collectLegalCCChecks(DIAGONAL).filter((c) => c.color === "w");
    const blocked = "k7/8/2p5/8/8/8/8/6KB";
    const shot = applyPendingCCShots({
      placement: blocked,
      ccLives: LIVES,
      pending,
      mines: MINE_C6,
    });
    // The marine takes the hit instead of the CC...
    expect(shot.ccLives).toEqual(LIVES);
    expect(shot.attacks).toEqual([
      expect.objectContaining({ kind: "capture", to: "c6", collision: true }),
    ]);
    expect(placementToMap(shot.placement).get("c6")).toBeUndefined();
    // ...and being captured *on* the mined tile is what finally spends the mine.
    expect(shot.mines).toEqual([]);
  });
});
