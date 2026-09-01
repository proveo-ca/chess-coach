// SPEC: _spec/apps/starchess/core/adjutant/strategic/promotion-defense.puml
/**
 * Strategic promotion defense — an enemy marine near its promotion rank.
 *
 * The behaviour these pin is the one the script used to miss entirely: a
 * visible runner three squares out is two turns from a BattleShip on our back
 * rank, and nothing in the naive scoring reads an *enemy* marine's rank at all.
 */
import { describe, expect, it } from "vitest";

import { parseScFen } from "../../index";
import { evaluateMove } from "../../ai/context";
import { strategicAdjutant } from "../../ai/strategic";
import { buildStrategicCtx } from "../../ai/strategic/context";
import { RUNNER_WATCH_TURNS, turnsToPromote } from "../../ai/strategic/runners";
import {
  RUNNER_ABANDON_SHARE,
  RUNNER_BLOCK_SHARE,
  RUNNER_STOP_CRITICAL,
  RUNNER_STOP_SERIOUS,
  runnerTier,
  runners as runnersStrategy,
} from "../../ai/strategic/strategies/runners";

const snapOf = (placement: string, turn = 10) =>
  parseScFen(`SCFEN|${placement}|${turn}|33|P|G:11:11|Q:w:;b:`);

/**
 * White marine d5 — three steps out, so two turns from promoting, with a clear
 * file. Black sees it from either tank (5×5) and can take it with f5 or b5.
 * The temptation is everything else on the board: with the enemy Command Center
 * fogged, any tank move that lines up on the CC *guess* banks
 * `ATTACK_KING_GUESS` (5_000), which is what used to win these turns while the
 * runner walked in for a lone `HUNT_UNDEFENDED_PAWN` (950).
 */
const RUNNER_3_SEEN = "4k3/8/8/1r1P1r2/8/8/8/4K3";

/** The same runner, with a black tank on f6 that can slide in front of it. */
const RUNNER_3_BLOCKABLE = "4k3/8/5r2/3P4/8/8/8/4K3";

/** The same runner with nobody near enough to see it. */
const RUNNER_3_UNSEEN = "4k3/8/8/3P4/8/8/8/4K3";

/**
 * White marine f6 — one turn from promoting; the black tank on d5 lights it
 * (files b–f, ranks 3–7) but can reach neither it nor f7. Its blockade square
 * f7 is the *worst* ring square by ordinary deploy scoring, since the centre
 * pull favours d7/e7 — so a drop there can only be the runner term.
 */
const RUNNER_2_DEPLOY_ONLY = "4k3/8/5P2/3r4/8/8/8/4K3";
/** The same board with no runner at all — the control for that deploy. */
const NO_RUNNER = "4k3/8/8/3r4/8/8/8/4K3";

/** White marine d6 with our hoverbike already standing on d7, its only blocker. */
const RUNNER_2_BLOCKED = "4k3/3n4/3P4/8/8/8/8/4K3";

const blackActions = (snapshot: ReturnType<typeof parseScFen>) =>
  snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];

describe("runner intel (fog-honest)", () => {
  it("counts a marine only while we can see it", () => {
    const seen = buildStrategicCtx(snapOf(RUNNER_3_SEEN), {
      color: "b",
    })!;
    expect(seen.runners.map((r) => r.at)).toEqual(["d5"]);

    const unseen = buildStrategicCtx(snapOf(RUNNER_3_UNSEEN), { color: "b" })!;
    expect(unseen.runners).toEqual([]);
  });

  it("reads the runner in turns, not squares — a marine covers two ranks a turn", () => {
    expect([1, 2].map(turnsToPromote)).toEqual([1, 1]);
    expect([3, 4].map(turnsToPromote)).toEqual([2, 2]);
    expect([5, 6].map(turnsToPromote)).toEqual([3, 3]);

    const ctx = buildStrategicCtx(snapOf(RUNNER_3_SEEN), {
      color: "b",
    })!;
    const runner = ctx.runners[0]!;
    expect(runner).toMatchObject({
      steps: 3,
      turns: 2,
      front: "d6",
      promoteAt: "d8",
      passed: true,
    });
    expect(runner.path).toEqual(["d6", "d7", "d8"]);
    expect(runnerTier(runner)).toBe(RUNNER_STOP_SERIOUS);
  });

  it("ignores a marine further out than the watch horizon", () => {
    // White marine on d2 — six ranks and three turns from promoting, seen by
    // the tank on b3, so only the horizon keeps it off the list.
    const far = buildStrategicCtx(snapOf("4k3/8/8/8/8/1r6/3P4/4K3"), {
      color: "b",
    })!;
    expect(far.runners.map((r) => r.turns)).toEqual([RUNNER_WATCH_TURNS]);

    // A marine still on rank 1, seen by the tank on c2: seven ranks out, four
    // turns, past the horizon.
    const beyond = buildStrategicCtx(snapOf("4k3/8/8/8/8/8/2r5/3PK3"), {
      color: "b",
    })!;
    expect(beyond.runners).toEqual([]);
  });

  it("marks a runner contained while something stands on its path", () => {
    const ctx = buildStrategicCtx(snapOf(RUNNER_2_BLOCKED), { color: "b" })!;
    expect(ctx.runners[0]).toMatchObject({
      at: "d6",
      turns: 1,
      blockedBy: ["d7"],
      passed: false,
    });
  });
});

describe("strategic adjutant answers a runner", () => {
  it("takes the marine two turns from promoting instead of aiming at the CC guess", () => {
    const plan = strategicAdjutant(snapOf(RUNNER_3_SEEN), {
      color: "b",
      storedFor: () => 0,
    });
    const classical = blackActions(plan.snapshot).filter(
      (a) => a.kind === "classical",
    );
    expect(classical.map((a) => a.to)).toContain("d5");
  });

  it("deploys a blocker in front of a runner that promotes next turn", () => {
    // Nothing black owns can reach f6 or f7 by moving; the deploy ring is our
    // own back ranks, which is exactly where the runner is heading.
    const spawnsOn = (placement: string) => {
      const plan = strategicAdjutant(snapOf(placement), {
        color: "b",
        storedFor: () => 3,
      });
      return blackActions(plan.snapshot)
        .filter((a) => a.kind === "spawn")
        .map((a) => a.to);
    };

    expect(spawnsOn(RUNNER_2_DEPLOY_ONLY)).toContain("f7");
    // Remove the runner and the same ring drops somewhere else entirely.
    expect(spawnsOn(NO_RUNNER)).not.toContain("f7");
  });
});

describe("fog honesty", () => {
  it("does not treat an enemy unit hiding in the dark as a blockade", () => {
    // Black tank on d3 lights files b–f, ranks 1–5: it sees the white marine on
    // b5 and nothing of b6 in front of it. A white hoverbike parked on b6 would
    // contain the runner — but we cannot see it, and believing in a blockade we
    // cannot see damps the urgency to a quarter until the bike steps aside.
    const openFile = "4k3/8/8/1P6/8/3r4/8/4K3";
    const hiddenBlocker = "4k3/8/1N6/1P6/8/3r4/8/4K3";

    const open = buildStrategicCtx(snapOf(openFile), { color: "b" })!;
    const blocked = buildStrategicCtx(snapOf(hiddenBlocker), { color: "b" })!;

    expect(open.runners[0]).toMatchObject({ at: "b5", passed: true });
    expect(blocked.runners[0]).toMatchObject({ at: "b5", passed: true });
    expect(blocked.runners[0]!.blockedBy).toEqual([]);

    // Take the seer away and there is no runner to speak of at all.
    const dark = buildStrategicCtx(snapOf("4k3/8/1N6/1P6/8/8/8/4K3"), {
      color: "b",
    })!;
    expect(dark.runners).toEqual([]);
  });

  it("still counts a blockade we can actually see, and our own units anywhere", () => {
    // Same shape, but the blocker is ours — our own board is never fogged.
    const ourBlocker = "4k3/8/1n6/1P6/8/3r4/8/4K3";
    const ctx = buildStrategicCtx(snapOf(ourBlocker), { color: "b" })!;
    expect(ctx.runners[0]).toMatchObject({ at: "b5", passed: false });
    expect(ctx.runners[0]!.blockedBy).toEqual(["b6"]);
  });
});

describe("runner scoring", () => {
  const ctxOf = (placement: string) =>
    buildStrategicCtx(snapOf(placement), { color: "b" })!;
  const scoreOf = (placement: string, from: string, to: string) => {
    const ctx = ctxOf(placement);
    const move = {
      from: from as never,
      to: to as never,
      capture: ctx.map.get(to as never) ?? null,
    };
    return runnersStrategy.score!(evaluateMove(move, ctx)!, ctx);
  };

  it("pays the full tier for taking the runner off the board", () => {
    expect(scoreOf(RUNNER_3_SEEN, "f5", "d5")).toBe(RUNNER_STOP_SERIOUS);
  });

  it("pays the block share for standing in front of it — a marine cannot shoot forward", () => {
    // Tank on f6 slides to d6, the square the runner needs; nothing of ours sits
    // on its capture diagonals, and white cannot take the blocker.
    expect(scoreOf(RUNNER_3_BLOCKABLE, "f6", "d6")).toBe(
      RUNNER_STOP_SERIOUS * RUNNER_BLOCK_SHARE,
    );
    // The same tank stepping anywhere else answers nothing.
    expect(scoreOf(RUNNER_3_BLOCKABLE, "f6", "f4")).toBe(0);
  });

  it("pays nothing for a move that ignores the runner", () => {
    expect(scoreOf(RUNNER_3_SEEN, "b5", "b3")).toBe(0);
  });

  it("charges the full tier for walking the only blocker away", () => {
    expect(scoreOf(RUNNER_2_BLOCKED, "d7", "b6")).toBe(
      -RUNNER_STOP_CRITICAL * RUNNER_ABANDON_SHARE,
    );
  });

});
