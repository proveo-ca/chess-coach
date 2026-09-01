// SPEC: _spec/apps/starchess/core/adjutant/strategic/promotion-defense.puml
/**
 * Runner memory — remembering a marine that ran past our vision.
 *
 * A unit that only slides through a lit square is gone by the time the next
 * snapshot is read, so the settled board alone can never see it. What the
 * board *does* show is the departure: a square we can see, that we saw a marine
 * on, now empty. From there the marine's motion model (forward only, at most
 * two ranks a turn) bounds where it can be, and everything we *can* see prunes
 * that set back down.
 *
 * The fixtures below depend on exact light cones (`board/vision.ts`):
 *   - black Command Center e8 — 3×3, so it lights d7 · e7 · f7 · d8 · f8;
 *   - black tank h3, unsieged — 5×5, so it lights files f–h, ranks 1–5.
 * f6 falls between the two and is dark, which is where a runner gets lost.
 */
import { describe, expect, it } from "vitest";

import { parseScFen } from "../../index";
import { strategicAdjutant } from "../../ai/strategic";
import { buildStrategicCtx } from "../../ai/strategic/context";
import {
  emptyRunnerMemory,
  foldRunnerMemory,
  RUNNER_MEMORY_DECAY,
  RUNNER_MEMORY_FLOOR,
  type RunnerMemory,
} from "../../ai/strategic/runners";
import { runnerUrgency } from "../../ai/strategic/strategies/runners";

/** Turns 4–10 all sit in gas income tier 1, which `G:11:11` encodes. */
const snapOf = (placement: string, turn = 10) =>
  parseScFen(`SCFEN|${placement}|${turn}|33|P|G:11:11|Q:w:;b:`);

/** White marine on f4, inside the tank's band. */
const SEEN_ON_F4 = "4k3/8/8/8/5P2/7r/8/4K3";
/** The same board with the marine gone from every square we can see. */
const GONE_FROM_F4 = "4k3/8/8/8/8/7r/8/4K3";

/**
 * Fold a run of placements as a host would, one settled ply each. The turn must
 * advance: a fold is a one-turn propagation, and folding the same turn twice is
 * refused by design (see the chip-ply case below).
 */
const foldAll = (placements: readonly string[], side: "w" | "b" = "b"): RunnerMemory =>
  placements.reduce(
    (mem, placement, i) => foldRunnerMemory(mem, snapOf(placement, 4 + i), side),
    emptyRunnerMemory(),
  );

describe("runner memory", () => {
  it("keeps a marine that stepped out of sight, bounded by two ranks a turn", () => {
    const mem = foldAll([SEEN_ON_F4, GONE_FROM_F4]);
    expect(mem.ghosts).toHaveLength(1);
    const ghost = mem.ghosts[0]!;

    expect(ghost.seenAt).toBe("f4");
    // Two ranks of reach is f5 and f6; f5 is lit and empty, so it is not there.
    // What survives is the one square it could have reached unseen.
    expect(ghost.possible).toEqual(["f6"]);
    expect(ghost.confidence).toBeCloseTo(RUNNER_MEMORY_DECAY);
  });

  it("reads the ghost at its worst-case square, not its last-seen one", () => {
    const mem = foldAll([SEEN_ON_F4, GONE_FROM_F4]);
    const ctx = buildStrategicCtx(snapOf(GONE_FROM_F4), {
      color: "b",
      runnerMemory: mem,
    })!;

    const runner = ctx.runners[0]!;
    expect(runner).toMatchObject({ at: "f6", steps: 2, turns: 1, seen: false });
    expect(runner.confidence).toBeCloseTo(RUNNER_MEMORY_DECAY);

    // Worth answering, but strictly less than the same runner in plain sight.
    const seen = buildStrategicCtx(snapOf("4k3/8/5P2/7r/8/8/8/4K3"), { color: "b" })!;
    expect(seen.runners[0]).toMatchObject({ at: "f6", seen: true });
    expect(runnerUrgency(runner)).toBeGreaterThan(0);
    expect(runnerUrgency(runner)).toBeLessThan(runnerUrgency(seen.runners[0]!));
  });

  it("collapses back to a sighting the moment we see it again", () => {
    // It reappears on f7, inside the Command Center's own 3×3.
    const backInSight = "4k3/5P2/8/8/8/7r/8/4K3";
    const mem = foldAll([SEEN_ON_F4, GONE_FROM_F4, backInSight]);
    expect(mem.ghosts).toHaveLength(1);
    expect(mem.ghosts[0]).toMatchObject({ possible: ["f7"], confidence: 1 });
  });

  it("forgets a runner it never saw — fog-honesty survives any number of plies", () => {
    // No tank on the board: the marine walks f4 → f5 → f6 through open fog.
    const unseen = [
      "4k3/8/8/8/5P2/8/8/4K3",
      "4k3/8/8/5P2/8/8/8/4K3",
      "4k3/8/5P2/8/8/8/8/4K3",
    ];
    expect(foldAll(unseen).ghosts).toEqual([]);
  });

  it("decays a ghost out of memory when contact is never re-made", () => {
    const plies = [SEEN_ON_F4, ...Array<string>(6).fill(GONE_FROM_F4)];
    const confidences = plies.map(
      (_, i) => foldAll(plies.slice(0, i + 1)).ghosts[0]?.confidence,
    );

    expect(confidences[0]).toBe(1);
    expect(confidences[1]).toBeCloseTo(RUNNER_MEMORY_DECAY);
    expect(confidences[2]).toBeCloseTo(RUNNER_MEMORY_DECAY ** 2);
    const live = confidences.filter((c): c is number => c != null);
    expect(Math.min(...live)).toBeGreaterThanOrEqual(RUNNER_MEMORY_FLOOR);
    expect(confidences.at(-1)).toBeUndefined();
  });

  it("advances once per turn, not once per ply — the arena's chip ply", () => {
    // A turn-open chip carries the *same* turn number as the settle before it,
    // so a second fold of one turn must not walk a ghost another two ranks or
    // decay it again. It still re-reads the board: only the clock is held.
    const once = foldRunnerMemory(emptyRunnerMemory(), snapOf(SEEN_ON_F4, 5), "b");
    expect(once.ghosts[0]).toMatchObject({ possible: ["f4"], confidence: 1 });

    const again = foldRunnerMemory(once, snapOf(SEEN_ON_F4, 5), "b");
    expect(again.ghosts[0]).toMatchObject({ possible: ["f4"], confidence: 1 });

    // The next turn does advance and decay.
    const nextTurn = foldRunnerMemory(once, snapOf(GONE_FROM_F4, 6), "b");
    expect(nextTurn.ghosts[0]?.possible).toEqual(["f6"]);
    expect(nextTurn.ghosts[0]?.confidence).toBeCloseTo(RUNNER_MEMORY_DECAY);
  });

  it("credits a capture we could not see — our own losses are always known", () => {
    // Black mecha on e5 sits on the marine's capture diagonal, outside every
    // light cone we own (the tank covers files f–h). It is gone the ply the
    // marine leaves f4, and a mecha is missing from the board, so e5 joins the
    // possible set although nothing ever lit it.
    const withMecha = "4k3/8/8/4b3/5P2/7r/8/4K3";
    const afterCapture = "4k3/8/8/4P3/8/7r/8/4K3";
    const ghost = foldAll([withMecha, afterCapture]).ghosts[0]!;
    expect(ghost.possible).toContain("e5");
  });

  it("does not credit a capture when our unit merely moved", () => {
    // Same vacated diagonal, but the mecha is still on the board — no loss, so
    // no evidence, and inventing one here would promote the ghost two ranks.
    // It retreats to a1, whose 5×5 stays clear of the f-file so the hiding
    // square is still dark.
    const withMecha = "4k3/8/8/4b3/5P2/7r/8/4K3";
    const mechaMoved = "4k3/8/8/8/8/7r/8/b3K3";
    const ghost = foldAll([withMecha, mechaMoved]).ghosts[0]!;
    expect(ghost.possible).not.toContain("e5");
    expect(ghost.possible).toEqual(["f6"]);
  });

  it("never lets two records describe one marine", () => {
    // Two ghosts whose sets overlap on f6: the first takes it, the second falls
    // back to its own next square instead of vanishing or double-counting.
    const memory: RunnerMemory = {
      ghosts: [
        { seenAt: "f4", seenTurn: 5, possible: ["f6"], confidence: 1 },
        { seenAt: "f3", seenTurn: 5, possible: ["f6", "f5"], confidence: 1 },
      ],
      ourUnits: [],
      turn: 5,
    };
    const ctx = buildStrategicCtx(snapOf(GONE_FROM_F4, 6), {
      color: "b",
      runnerMemory: memory,
    })!;
    expect(ctx.runners.map((r) => r.at)).toEqual(["f6", "f5"]);
  });

  it("acts on the memory: guards the square the runner has to cross", () => {
    // Nothing is visible on the f-file any more — only the ghost on f6 says f7
    // is about to be walked through. f7 is also the *worst* ring square by the
    // ordinary deploy scoring (centre pull favours d7/e7), so choosing it can
    // only be the runner term.
    const mem = foldAll([SEEN_ON_F4, GONE_FROM_F4]);
    const spawnsFor = (memory?: RunnerMemory) => {
      const plan = strategicAdjutant(snapOf(GONE_FROM_F4), {
        color: "b",
        storedFor: () => 3,
        ...(memory ? { runnerMemory: memory } : {}),
      });
      return (plan.snapshot.queue?.actions ?? [])
        .filter((a) => a.color === "b" && a.kind === "spawn")
        .map((a) => a.to);
    };

    expect(spawnsFor(mem)).toContain("f7");
    // Same board, no memory threaded: nothing to react to, and the drop goes
    // where the centre pull wants it.
    expect(spawnsFor()).not.toContain("f7");
    expect(buildStrategicCtx(snapOf(GONE_FROM_F4), { color: "b" })!.runners).toEqual([]);
  });

  it("drops a ghost that can only have promoted", () => {
    // Marine seen on a7 by the tank on a5 (files a–c, ranks 3–7), one step out.
    // Next ply a7 is lit and empty and a8 is dark — nothing but the promotion
    // rule can retire this ghost, so the case isolates that filter.
    const seen = "4k3/P7/8/r7/8/8/8/4K3";
    const promoted = "Q3k3/8/8/r7/8/8/8/4K3";
    expect(foldAll([seen, promoted]).ghosts).toEqual([]);
  });
});
