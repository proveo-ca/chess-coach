import { beforeEach, describe, expect, it, vi } from "vitest";

/** Fresh module per test: the store is a persisted singleton. */
const load = async () => {
  vi.resetModules();
  return import("~/store/vfxTierStore");
};

describe("vfxTierStore", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.vfxTier;
  });

  it("starts full, stale, and stamps <html data-vfx-tier>", async () => {
    const s = await load();
    expect(s.vfxTier()).toBe("full");
    expect(s.probeIsStale(1)).toBe(true);
    expect(document.documentElement.dataset.vfxTier).toBe("full");
  });

  it("downgrades only after LITE_AFTER_PROBES lite verdicts in a row", async () => {
    const s = await load();
    s.recordProbe("lite", 1, 1_000);
    expect(s.vfxTier()).toBe("full");
    // A pending streak keeps the probe stale so the next menu visit confirms.
    expect(s.probeIsStale(1, 1_000)).toBe(true);
    s.recordProbe("lite", 1, 2_000);
    expect(s.vfxTier()).toBe("lite");
    expect(s.probeIsStale(1, 2_000)).toBe(false);
    await Promise.resolve();
    expect(document.documentElement.dataset.vfxTier).toBe("lite");
  });

  it("a full verdict clears the streak; inconclusive changes nothing", async () => {
    const s = await load();
    s.recordProbe("lite", 1, 1_000);
    s.recordProbe("full", 1, 2_000);
    s.recordProbe("lite", 1, 3_000);
    expect(s.vfxTier()).toBe("full");
    s.recordProbe("inconclusive", 1, 4_000);
    expect(s.vfxTier()).toBe("full");
  });

  it("re-probes on a VFX version bump or after PROBE_MAX_AGE_MS", async () => {
    const s = await load();
    s.recordProbe("full", 1, 1_000);
    expect(s.probeIsStale(1, 1_000)).toBe(false);
    expect(s.probeIsStale(2, 1_000)).toBe(true);
    expect(s.probeIsStale(1, 1_000 + s.PROBE_MAX_AGE_MS + 1)).toBe(true);
  });

  it("a pinned tier wins, is not persisted, and survives a probe", async () => {
    const s = await load();
    s.pinVfxTier("lite");
    expect(s.vfxTier()).toBe("lite");
    await Promise.resolve();
    expect(document.documentElement.dataset.vfxTier).toBe("lite");
    s.recordProbe("full", 1, 1_000);
    expect(s.vfxTier()).toBe("lite");
    expect(JSON.parse(localStorage.getItem(s.VFX_TIER_STORAGE_KEY)!).tier).toBe("full");
    s.pinVfxTier(null);
    expect(s.vfxTier()).toBe("full");
  });

  it("persists across reloads", async () => {
    (await load()).recordProbe("lite", 1, 1_000);
    (await load()).recordProbe("lite", 1, 2_000);
    expect((await load()).vfxTier()).toBe("lite");
  });
});
