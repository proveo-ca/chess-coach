import { describe, expect, it } from "vitest";
import { buildReviewHistory } from "~/app/reviewHistory";
import { COLLISION_PATH_BLOCK_SCENARIO } from "~/demos/collisionRaces";
import { classicalActionsFromResolve } from "~/presentation/hud/classicalActionsFromResolve";

describe("classicalActionsFromResolve", () => {
  it("stamps original C=e1e8 for path-block (not only path-reveal stop)", () => {
    const h = buildReviewHistory({
      start: COLLISION_PATH_BLOCK_SCENARIO.plies[0]!,
      steps: COLLISION_PATH_BLOCK_SCENARIO.steps,
      startCaption: COLLISION_PATH_BLOCK_SCENARIO.startCaption,
      queueStep: COLLISION_PATH_BLOCK_SCENARIO.queueStep,
    });
    const r = h.settledResolves[0]!;
    expect(r.queue?.some((a) => a.from === "e1" && a.to === "e8")).toBe(true);
    const actions = classicalActionsFromResolve(r);
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timing: "C",
          kind: "classical",
          color: "w",
          from: "e1",
          to: "e8",
        }),
      ]),
    );
  });
});
