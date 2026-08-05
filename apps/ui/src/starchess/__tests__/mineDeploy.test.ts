import { describe, expect, it } from "vitest";

import { MINE_DEPLOY_MS } from "~/starchess/constants";
import {
  makeMineDeployCue,
  mineDeployCuesForDiff,
  rollMineLegMs,
} from "~/starchess/mines/mineDeploy";
import { MINE_LEG_COUNT } from "~/starchess/specials/spiderMineLegs";

describe("mineDeploy", () => {
  it(`rolls ${MINE_LEG_COUNT} independent leg durations within 1..maxMs`, () => {
    const legs = rollMineLegMs(MINE_DEPLOY_MS, 0.42);
    expect(legs).toHaveLength(MINE_LEG_COUNT);
    for (const ms of legs) {
      expect(ms).toBeGreaterThanOrEqual(1);
      expect(ms).toBeLessThanOrEqual(MINE_DEPLOY_MS);
    }
  });

  it("diffs only newly appeared mines", () => {
    const prev = [{ at: "a4" as const, color: "b" as const }];
    const next = [
      { at: "a4" as const, color: "b" as const },
      { at: "c5" as const, color: "b" as const },
    ];
    const cues = mineDeployCuesForDiff(prev, next);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ at: "c5", color: "b" });
    expect(cues[0]!.legMs).toHaveLength(MINE_LEG_COUNT);
  });

  it("makeMineDeployCue seeds per-leg bury times", () => {
    const cue = makeMineDeployCue("d4", "w", 0.1);
    expect(cue.at).toBe("d4");
    expect(cue.legMs.every((ms) => ms >= 1 && ms <= MINE_DEPLOY_MS)).toBe(true);
  });
});
