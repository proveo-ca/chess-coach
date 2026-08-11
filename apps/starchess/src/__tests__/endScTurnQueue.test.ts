import { describe, expect, it } from "vitest";

import { buildReviewHistory } from "~/app/reviewHistory";
import { COLLISION_PATH_BLOCK_SCENARIO } from "~/demos/collisionRaces";

describe("EndScTurnResult.queue (SCFen Q:)", () => {
  it("stamps original path-block C= for DualNav intent — no reconstruct", () => {
    const h = buildReviewHistory({
      start: COLLISION_PATH_BLOCK_SCENARIO.plies[0]!,
      steps: COLLISION_PATH_BLOCK_SCENARIO.steps,
      startCaption: COLLISION_PATH_BLOCK_SCENARIO.startCaption,
      queueStep: COLLISION_PATH_BLOCK_SCENARIO.queueStep,
    });
    const r = h.settledResolves[0]!;
    expect(r.queue.some((a) => a.from === "e1" && a.to === "e8")).toBe(true);
    expect(
      r.queue.some(
        (a) =>
          a.timing === "C" &&
          a.kind === "classical" &&
          a.color === "w" &&
          a.from === "e1" &&
          a.to === "e8",
      ),
    ).toBe(true);
  });
});
