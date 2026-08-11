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
});
