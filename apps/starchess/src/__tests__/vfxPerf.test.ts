import { afterEach, describe, expect, it, vi } from "vitest";

import {
  VFX_CAP_DESKTOP,
  VFX_CAP_REVIEW_DESKTOP,
  VFX_CAP_REVIEW_TIGHT,
  VFX_CAP_TIGHT,
  capCues,
  capForDensity,
  liteCap,
  overlayDevicePixelRatio,
  overlayRootPerfStyle,
} from "~/presentation/animations/vfxPerf";

describe("vfxPerf", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("liteCap halves a cap, never below one", () => {
    expect(liteCap(VFX_CAP_DESKTOP)).toBe(VFX_CAP_DESKTOP / 2);
    expect(liteCap(VFX_CAP_REVIEW_TIGHT)).toBe(1);
    expect(liteCap(1)).toBe(1);
  });

  it("capCues keeps earliest entries", () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(capCues(list, 3)).toEqual([1, 2, 3]);
    expect(capCues(list.slice(0, 2), 8)).toEqual([1, 2]);
  });

  it("overlayDevicePixelRatio clamps to 2", () => {
    vi.stubGlobal("window", { devicePixelRatio: 3 });
    expect(overlayDevicePixelRatio()).toBe(2);
    vi.stubGlobal("window", { devicePixelRatio: 1.25 });
    expect(overlayDevicePixelRatio()).toBe(1.25);
  });

  it("overlayRootPerfStyle exposes dpr and layout contain (not paint)", () => {
    vi.stubGlobal("window", { devicePixelRatio: 2.5 });
    const s = overlayRootPerfStyle();
    expect(s["--overlay-dpr"]).toBe("2");
    expect(s.contain).toBe("layout style");
    expect(s.contain).not.toContain("paint");
  });

  it("default caps match viewport helpers", () => {
    expect(VFX_CAP_TIGHT).toBe(4);
    expect(VFX_CAP_DESKTOP).toBe(8);
    expect(VFX_CAP_REVIEW_TIGHT).toBe(2);
    expect(VFX_CAP_REVIEW_DESKTOP).toBe(4);
  });

  it("capForDensity returns review caps in review, full caps otherwise", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
    });
    expect(capForDensity("review")).toBe(VFX_CAP_REVIEW_TIGHT);
    expect(capForDensity("full")).toBe(VFX_CAP_TIGHT);
  });

  it("capForDensity uses desktop caps on wide viewports", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    expect(capForDensity("review")).toBe(VFX_CAP_REVIEW_DESKTOP);
    expect(capForDensity("full")).toBe(VFX_CAP_DESKTOP);
  });

  it("capForDensity defaults to desktop when matchMedia is unavailable", () => {
    vi.stubGlobal("window", undefined);
    expect(capForDensity("review")).toBe(VFX_CAP_REVIEW_DESKTOP);
    expect(capForDensity("full")).toBe(VFX_CAP_DESKTOP);
  });
});
