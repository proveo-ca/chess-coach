/**
 * Strategic-script smoke — the strategic adjutant plays a full game through
 * the arena loop with the arena-threaded kvs, wins/loses/stalls, and the run
 * never crashes. (The strategic-vs-naive mirror determinism lives in
 * determinism.test.ts.)
 */
import { describe, expect, it } from "vitest";

import { naiveScript } from "../players/naive";
import { strategicScript } from "../players/strategic";
import { runMatch } from "../run/runMatch";
import { STAR_STARTING_SCFEN } from "../seeds";

describe("strategicScript smoke", () => {
  it("strategic-vs-naive completes a recorded run", async () => {
    const run = await runMatch({
      players: { w: strategicScript(), b: naiveScript() },
      opening: STAR_STARTING_SCFEN,
      maxTurns: 200,
    });

    expect(["finished", "stall"]).toContain(run.meta.status);
    expect(run.plies.length).toBeGreaterThan(0);
    expect(run.bankTrail.length).toBe(run.plies.length);
    if (run.outcome) expect(["w", "b", null]).toContain(run.outcome.winner);

    // kvs is threaded through the whole game for the strategic side.
    expect(run.kvs.perSide.b.known).toBeGreaterThan(0);
  });
});