// SPEC: _spec/apps/starchess/core/adjutant/strategic/promotion-defense.puml, _spec/apps/starchess/core/adjutant/strategic/cc-retaliation.puml
/**
 * The resolve evidence channel — what a settled turn legitimately told us.
 *
 * These cases drive the real engine: a turn is queued and settled through
 * `endScTurn`, and the witness is built from its own payload. That matters,
 * because the payload is emitted with no viewer at all — every one of these
 * assertions is really about the gate in `witness.ts` holding.
 */
import { describe, expect, it } from "vitest";

import { addScMove, beginScTurn, endScTurn, parseScFen } from "../../index";
import { foldRunnerMemory, emptyRunnerMemory } from "../../ai/strategic/runners";
import { emptyAttackerMemory, foldAttackerMemory } from "../../ai/strategic/attackers";
import {
  ccAttackers,
  runnerCrossings,
  witnessFromEndTurn,
} from "../../ai/strategic/witness";

const snapOf = (placement: string, turn = 5) =>
  parseScFen(`SCFEN|${placement}|${turn}|33|P|G:11:11|Q:w:;b:`);

/** Settle a turn made of one classical move per side that wants one. */
const settle = (placement: string, moves: { color: "w" | "b"; from: string; to: string }[]) => {
  let s = snapOf(placement);
  for (const m of moves) s = addScMove(s, m as never);
  return endScTurn(s, { skipTurnStartChecks: true });
};

describe("runner crossings — the fly-by the board cannot show", () => {
  /**
   * Black tank on h3 lights files f–h, ranks 1–5. A white marine on f4 that
   * double-steps to f6 is watched leaving f4 and crossing f5, and ends on f6
   * where nothing of ours is looking: the settled board shows an empty f4 and
   * an unseen marine, and only the resolve knows which way it went.
   */
  const FLY_BY = "4k3/8/8/8/5P2/7r/8/4K3";

  it("records the furthest square we actually watched it cross", () => {
    const esr = settle(FLY_BY, [{ color: "w", from: "f4", to: "f6" }]);
    expect(esr.resolved.moves).toContainEqual(
      expect.objectContaining({ from: "f4", to: "f6", color: "w" }),
    );
    // f4 and f5 are lit for black; f6 is not. We watched it leave f4 and reach
    // f5, so one of its two ranks is accounted for and only one is left.
    expect(runnerCrossings(witnessFromEndTurn(esr), "b")).toEqual([
      { at: "f5", residual: 1 },
    ]);
  });

  it("tells the *other* side nothing — the gate is per-viewer", () => {
    const esr = settle(FLY_BY, [{ color: "w", from: "f4", to: "f6" }]);
    // White is the mover's own side: this channel only reports enemies.
    expect(runnerCrossings(witnessFromEndTurn(esr), "w")).toEqual([]);
  });

  it("reports nothing when the whole path ran through the dark", () => {
    // Same move with our tank moved away to a1 (files a–c, ranks 1–3).
    const unwatched = "4k3/8/8/8/5P2/8/8/r3K3";
    const esr = settle(unwatched, [{ color: "w", from: "f4", to: "f6" }]);
    expect(runnerCrossings(witnessFromEndTurn(esr), "b")).toEqual([]);
  });

  it("feeds the memory a ghost the settled board alone could not produce", () => {
    const esr = settle(FLY_BY, [{ color: "w", from: "f4", to: "f6" }]);
    const witness = witnessFromEndTurn(esr);

    // Without the witness the settled board shows nothing at all.
    const blind = foldRunnerMemory(emptyRunnerMemory(), esr.next, "b");
    expect(blind.ghosts).toEqual([]);

    // With it, the marine is remembered — seeded where we saw it cross and
    // advanced to where it could have got to unseen.
    const seeing = foldRunnerMemory(emptyRunnerMemory(), esr.next, "b", witness);
    expect(seeing.ghosts).toHaveLength(1);
    expect(seeing.ghosts[0]!.seenAt).toBe("f5");
    expect(seeing.ghosts[0]!.possible).toContain("f6");
  });
});

describe("Command Center retaliation — the shot names the shooter", () => {
  /**
   * White tank on c8 has the black Command Center on e8 in its sights, so the
   * turn opens with a chip. The black CC's own 3×3 does not reach c8: the
   * shooter is standing in the dark, and only the hit reports it.
   */
  const SHOT_FROM_THE_DARK = "2R1k3/8/8/8/8/8/8/4K3";

  const shotAtTheCC = () => beginScTurn(snapOf(SHOT_FROM_THE_DARK));

  it("records an attacker we could never have seen", () => {
    const chip = shotAtTheCC();
    expect(chip.attacks).toContainEqual(
      expect.objectContaining({ kind: "kingShot", color: "w", from: "c8", target: "b" }),
    );

    const witness = witnessFromEndTurn(chip.asResolve!);
    const attackers = ccAttackers(witness, "b", 5);
    expect(attackers.map((a) => a.at)).toEqual(["c8"]);
    expect(attackers[0]!.piece).toBe("r");

    // ...and white, who was not shot, learns nothing from the same payload.
    expect(ccAttackers(witness, "w", 5)).toEqual([]);
  });

  it("records a chip-ply shot although the settle already folded that turn", () => {
    // The trap the whole channel hangs on: `beginScTurn` does not advance the
    // clock, so a turn-open chip carries the same turn number as the settle
    // before it. A fold that skipped a repeated turn outright would discard the
    // single most common way a Command Center is ever shot.
    const settle = endScTurn(snapOf(SHOT_FROM_THE_DARK), { skipTurnStartChecks: true });
    let mem = foldAttackerMemory(
      emptyAttackerMemory(),
      settle.next,
      "b",
      witnessFromEndTurn(settle),
    );
    expect(mem.attackers).toEqual([]); // nothing fired during the settle

    const chip = beginScTurn(settle.next);
    expect(chip.next.turn).toBe(settle.next.turn); // same turn — the trap
    mem = foldAttackerMemory(mem, chip.next, "b", witnessFromEndTurn(chip.asResolve!));
    expect(mem.attackers.map((a) => a.at)).toEqual(["c8"]);
  });

  it("bills the square a path-reveal shooter rests on, not the one it fired through", () => {
    // A slider that discovers the Command Center mid-ray fires from the
    // discovery square and comes to rest on `stopAt` (`resolve-turn.ts`). The
    // debt has to name where it *is*: a mark on a tile it only passed through
    // is one no answer can ever collect, and it clears the moment that tile is
    // lit and found empty.
    const witness = {
      placement: "4k3/8/8/8/8/8/8/3RK3",
      attacks: [
        {
          kind: "kingShot" as const,
          piece: "r" as const,
          color: "w" as const,
          from: "d4" as const,
          to: "d8" as const,
          target: "b" as const,
          livesAfter: 2,
          pathRevealFrom: "d1" as const,
          pathRevealSteps: 3,
          stopAt: "d5" as const,
        },
      ],
    };
    expect(ccAttackers(witness, "b", 5).map((a) => a.at)).toEqual(["d5"]);
  });

  it("keeps the record while the square stays dark, and drops it once seen empty", () => {
    const chip = shotAtTheCC();
    const witness = witnessFromEndTurn(chip.asResolve!);
    const mem = foldAttackerMemory(emptyAttackerMemory(), chip.next, "b", witness);
    expect(mem.attackers.map((a) => a.at)).toEqual(["c8"]);

    // A later ply with the shooter gone from a square we can now see: a black
    // hoverbike on b7 lights c8, and nothing is standing there.
    const cleared = snapOf("4k3/1n6/8/8/8/8/8/4K3", 6);
    expect(foldAttackerMemory(mem, cleared, "b").attackers).toEqual([]);

    // The same ply while c8 stays dark keeps the debt on the books.
    const stillDark = snapOf("4k3/8/8/8/8/8/8/4K3", 6);
    expect(foldAttackerMemory(mem, stillDark, "b").attackers).toHaveLength(1);
  });
});
