import { describe, expect, it } from "vitest";

import { bishopLegPose } from "~/broodwar/animations/pieces/InlineBishop";

const hip = { x: 18, y: 28 };
const SIX = Math.PI / 2;

describe("bishopLegPose", () => {
  it("parks the foot at 6 o'clock when standing", () => {
    const { foot } = bishopLegPose(hip, SIX, 1);
    expect(foot.x).toBeCloseTo(hip.x, 5);
    expect(foot.y).toBeGreaterThan(hip.y);
  });

  it("keeps a 90° knee and fixed segment lengths", () => {
    for (const phase of [0, Math.PI / 4, SIX, Math.PI, (3 * Math.PI) / 2]) {
      const { hip: h, knee, foot } = bishopLegPose(hip, phase, 1);
      const hx = knee.x - h.x;
      const hy = knee.y - h.y;
      const fx = foot.x - knee.x;
      const fy = foot.y - knee.y;
      expect(hx * fx + hy * fy).toBeCloseTo(0, 5);
      expect(Math.hypot(hx, hy)).toBeCloseTo(Math.hypot(fx, fy), 5);
    }
  });

  it("puts opposite feet 180° apart (6 vs 12)", () => {
    const left = bishopLegPose(hip, SIX, 1);
    const right = bishopLegPose({ x: 27, y: 28 }, SIX + Math.PI, -1);
    expect(left.foot.y).toBeGreaterThan(hip.y);
    expect(right.foot.y).toBeLessThan(28);
  });
});
