/**
 * Collision-race demo packages: each scenario's plies build the DualNav review
 * history the screens replay, and the resolve keeps the original queue stamp
 * (`Q:` C= entries) instead of a reconstruction.
 */
import { describe, expect, it } from "vitest";
import { buildReviewHistory } from "~/app/reviewHistory";
import {
  COLLISION_ALLY_BLOCK_SCENARIO,
  COLLISION_KNIGHT_SPEED_SCENARIO,
  COLLISION_PATH_BLOCK_SCENARIO,
  COLLISION_SAME_SQUARE_SCENARIO,
} from "~/demos/collisionRaces";

describe("collision race demos build", () => {
  it.each([
    ["path", COLLISION_PATH_BLOCK_SCENARIO, "k3r3/4R3/8/8/8/8/8/K7"],
    ["ally", COLLISION_ALLY_BLOCK_SCENARIO, "k3r3/4P3/4R3/8/8/8/8/K7"],
    ["same", COLLISION_SAME_SQUARE_SCENARIO, "4k3/8/8/8/8/8/8/4K3"],
    ["knight", COLLISION_KNIGHT_SPEED_SCENARIO, "4k3/8/8/4P3/8/8/8/4K3"],
  ] as const)("%s DualNav history", (_n, s, want) => {
    expect(s.plies.at(-1)?.placement).toBe(want);
    const h = buildReviewHistory({
      start: s.plies[0]!,
      steps: s.steps,
      startCaption: s.startCaption,
      queueStep: s.queueStep,
    });
    expect(h.settledSnapshots.at(-1)?.placement).toBe(want);
  });

  it("stamps the original path-block C= for DualNav intent — no reconstruct", () => {
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
