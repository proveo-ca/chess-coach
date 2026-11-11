import { expect, test } from "@playwright/test";

import {
  ROOT,
  VFX_CAP,
  clearStorage,
  gotoScfen,
  readVfxWatch,
  recordResolve,
  startVfxWatch,
  stopVfxWatch,
  type CueKind,
} from "./vfxHarness";

/**
 * Roster: `_spec/apps/starchess/vfx-guarantees.md`.
 *
 * Guarantees V26–V28 — concurrency ceilings from `capCues` / `capForDensity`.
 * Source: `_spec/apps/starchess/architecture/timeline-vfx-density.puml`.
 *
 * These are non-exceedance checks: the cap math itself is pinned by the unit
 * test (`apps/starchess/src/__tests__/vfxPerf.test.ts`); e2e pins that the cap
 * is actually applied to the rendered overlay on each density path.
 */

/** Busiest deterministic live seeds — mine chase (2 deaths) and a Command Center duel. */
const BUSY_SEEDS = [
  "SCFEN|7k/8/8/8/8/8/8/R3K3|1|33|P|G:11:11|M:b:a4|Q:w:C=a1a8;b:",
  "SCFEN|8/8/8/8/8/8/3k4/3K4|1|33|P|G:11:11|Q:w:;b:",
];

const KING_HUNT_STORY =
  "http://127.0.0.1:6007/iframe.html?id=starchess-demo--king-hunt&viewMode=story";

const overCap = (max: Record<CueKind, number>, cap: number) =>
  Object.entries(max).filter(([, value]) => value > cap);

test.describe("VFX · density caps", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("V26 live play stays under the desktop cap", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const seed of BUSY_SEEDS) {
      await clearStorage(page);
      await gotoScfen(page, seed);
      const watch = await recordResolve(page, { idleMs: 500 });
      expect(watch.ever.length, `no VFX for ${seed}`).toBeGreaterThan(0);
      expect(overCap(watch.max, VFX_CAP.desktop)).toEqual([]);
    }
  });

  test("V27 tight viewports stay under the tight cap", async ({ page }) => {
    // `(max-width: 719px), (max-height: 639px)` → isTightVfxViewport().
    await page.setViewportSize({ width: 390, height: 844 });
    for (const seed of BUSY_SEEDS) {
      await clearStorage(page);
      await gotoScfen(page, seed);
      const watch = await recordResolve(page, { idleMs: 500 });
      expect(watch.ever.length, `no VFX for ${seed}`).toBeGreaterThan(0);
      expect(overCap(watch.max, VFX_CAP.tight)).toEqual([]);
    }
  });

  test("V28 DualNav review replay stays under the review cap", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(KING_HUNT_STORY, { waitUntil: "networkidle" });
    await expect(page.locator("[data-board-grid] [data-square]").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator(ROOT)).toHaveCount(1, { timeout: 15_000 });

    await page.locator("#storybook-root").click({ position: { x: 24, y: 24 } });
    await startVfxWatch(page);
    // Walk the replay: each ArrowRight advances intent → resolve.
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(2_200);
    }
    const watch = await readVfxWatch(page);
    await stopVfxWatch(page);

    expect(watch.ever.length, "replay produced no VFX").toBeGreaterThan(0);
    expect(overCap(watch.max, VFX_CAP.reviewDesktop)).toEqual([]);
    expect(watch.layerRemounts).toBe(0);
  });
});
