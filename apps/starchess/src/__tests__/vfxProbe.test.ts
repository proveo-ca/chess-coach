import { describe, expect, it } from "vitest";

import {
  JANK_LITE_RATIO,
  LAG_LITE_MS,
  MIN_CUES,
  UPGRADE_MARGIN,
  decideVfxTier,
} from "~/presentation/animations/vfxProbe";

/** `n` steady frames at `ms`, with `jank` of them stretched to 3× the interval. */
const frames = (n: number, ms = 16.7, jank = 0) =>
  Array.from({ length: n }, (_, i) => (i < jank ? ms * 3 : ms));
const lags = (ms: number, n = MIN_CUES) => Array.from({ length: n }, () => ms);

describe("decideVfxTier", () => {
  it("is inconclusive without enough cues or frames", () => {
    expect(decideVfxTier({ lagsMs: lags(500, MIN_CUES - 1), framesMs: frames(120) }, "full").verdict).toBe(
      "inconclusive",
    );
    expect(decideVfxTier({ lagsMs: lags(500), framesMs: frames(10) }, "full").verdict).toBe("inconclusive");
  });

  it("keeps full on a device that starts VFX on time", () => {
    // ~1× on the menu playground (see the calibration table in vfxProbe.ts).
    const r = decideVfxTier({ lagsMs: lags(5), framesMs: frames(300) }, "full");
    expect(r).toMatchObject({ verdict: "full", lagMedianMs: 5, jankRatio: 0 });
  });

  it("picks lite when cues start late", () => {
    expect(decideVfxTier({ lagsMs: lags(LAG_LITE_MS + 1), framesMs: frames(300) }, "full").verdict).toBe("lite");
  });

  it("picks lite on jank, judged against the display's own cadence", () => {
    const jank = Math.ceil(300 * (JANK_LITE_RATIO + 0.05));
    expect(decideVfxTier({ lagsMs: lags(10), framesMs: frames(300, 16.7, jank) }, "full").verdict).toBe("lite");
    // A steady 30 Hz display (Low Power) is not jank.
    expect(decideVfxTier({ lagsMs: lags(10), framesMs: frames(300, 33.3) }, "full").verdict).toBe("full");
  });

  it("needs a margin to upgrade out of lite", () => {
    const between = LAG_LITE_MS * UPGRADE_MARGIN + 5;
    expect(decideVfxTier({ lagsMs: lags(between), framesMs: frames(300) }, "full").verdict).toBe("full");
    expect(decideVfxTier({ lagsMs: lags(between), framesMs: frames(300) }, "lite").verdict).toBe("lite");
    expect(decideVfxTier({ lagsMs: lags(5), framesMs: frames(300) }, "lite").verdict).toBe("full");
  });
});
