import { expect, test } from "@playwright/test";

import {
  CUE,
  LAYER_ORDER,
  ROOT,
  clearStorage,
  gotoScfen,
  recordResolve,
  settledPiece,
  startVfxWatch,
  waitForVfxIdle,
} from "./vfxHarness";

/**
 * Roster: `_spec/apps/starchess/vfx-guarantees.md`.
 *
 * Guarantees V19–V25 — playback integrity around the sole clock.
 * Sources: `_spec/apps/starchess/animation-pipeline.md` (hide ownership, auto-End
 * guard), `_spec/apps/starchess/timeline/cue-playback.puml` (trails outlive cues,
 * no hull flash-back) and `timeline-perf.puml` (components never own a clock).
 */

const CAPTURE_SEED = "SCFEN|k3r3/4p3/8/8/8/8/8/K3R3|1|33|P|G:11:11|Q:w:C=e1e8;b:";
const MOVE_SEED = "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:11:11|Q:w:C=e2e3;b:";
const WARP_SEED = "SCFEN|k6b/8/8/8/8/8/8/Q6K|21|33|P|G:03:33|Q:w:B=queenWarp:a1:d4;b:";
const MINE_SEED = "SCFEN|7k/8/8/8/8/8/8/R3K3|1|33|P|G:11:11|M:b:a4|Q:w:C=a1a8;b:";

test.describe("VFX · playback integrity", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("V19 playing cue elements are never replaced mid-flight", async ({ page }) => {
    await gotoScfen(page, CAPTURE_SEED);
    const watch = await recordResolve(page);

    expect(watch.ever).toContain("attack");
    expect(watch.ever).toContain("death");
    // A replaced node restarts its CSS animation — "knight plays twice",
    // "gatling loops", "hull flashes back". Zero replacements, always.
    expect(watch.cueRemounts).toEqual({});
  });

  test("V20 the overlay drains after the resolve, layers stay mounted", async ({ page }) => {
    await gotoScfen(page, CAPTURE_SEED);
    const watch = await recordResolve(page);
    expect(watch.ever.length).toBeGreaterThan(0);

    for (const [kind, selector] of Object.entries(CUE)) {
      // kingDamage is persistent presentation (a burning hull), not a cue.
      if (kind === "kingDamage") continue;
      await expect(page.locator(selector), `${kind} left on screen`).toHaveCount(0, {
        timeout: 10_000,
      });
    }
    await expect(page.locator(`${ROOT} > *`)).toHaveCount(LAYER_ORDER.length);
  });

  test("V21 jump and mine trails outlive their cue", async ({ page }) => {
    await gotoScfen(page, WARP_SEED);
    const warp = await recordResolve(page);
    expect(warp.trailOutlivedJump).toBe(true);

    await clearStorage(page);
    await gotoScfen(page, MINE_SEED);
    const mine = await recordResolve(page);
    expect(mine.trailOutlivedMissile).toBe(true);
  });

  test("V22 a mover owns its square — the board never double-draws it", async ({ page }) => {
    for (const seed of [MOVE_SEED, CAPTURE_SEED]) {
      await clearStorage(page);
      await gotoScfen(page, seed);
      const watch = await recordResolve(page);

      expect(watch.ever, `no mover rendered for ${seed}`).toContain("move");
      // `hideSquares` / deriveVisualFrame own the square while the cue plays.
      expect(watch.doubleDraws, `board drew a glyph under the mover (${seed})`).toBe(0);
    }
  });

  test("V23 tutorial auto-End still plays the move VFX", async ({ page }) => {
    // `endTurnAfterQueue` submits for the player. Dispatching from inside the
    // reactive effect lands TIMELINE_COMMIT after TIMELINE_DONE and the whole
    // resolve renders with an empty overlay root (documented teleport bug).
    await page.goto("tutorial/fog/bishop");
    await expect(page.locator("[data-board-grid] [data-square]").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator(ROOT)).toHaveCount(1, { timeout: 10_000 });

    await page.locator("[data-square='d4']").click();
    await startVfxWatch(page);
    await page.locator("[data-square='h8']").click();

    await expect(page.locator(CUE.move)).toHaveCount(1, { timeout: 15_000 });
    const watch = await waitForVfxIdle(page, { idleMs: 900, timeout: 20_000 });

    expect(watch.ever).toContain("move");
    expect(watch.ever).toContain("attack");
    expect(watch.ever).toContain("death");
    // A rebuilt stack restarts every CSS animation in flight.
    expect(watch.rootSwaps).toBe(1);
    expect(watch.layerRemounts).toBe(0);
    await expect(settledPiece(page, "g7", "w b")).toBeVisible({ timeout: 15_000 });
  });

  test("V24 the fog tutorial burns a Chess king, StarChess burns the hull", async ({ page }) => {
    await page.goto("tutorial/fog/bishop");
    await expect(page.locator("[data-board-grid] [data-square]").first()).toBeVisible({
      timeout: 20_000,
    });
    await page.locator("[data-square='d4']").click();
    await page.locator("[data-square='h8']").click();

    // Bxg7 checks kh8 → the king takes a chip and starts burning.
    const burning = page.locator("[data-king-damage='smallFire'], [data-king-damage='bigFire']");
    await expect(burning.first()).toBeVisible({ timeout: 20_000 });
    await expect(burning.first()).toHaveAttribute("data-king-glyph", "cburnett");

    await clearStorage(page);
    await gotoScfen(page, "SCFEN|8/8/8/8/8/8/3k4/3K4|1|33|P|G:11:11|Q:w:;b:");
    const hull = page.locator("[data-king-damage='smallFire'], [data-king-damage='bigFire']");
    await expect(hull.first()).toBeVisible({ timeout: 15_000 });
    await expect(hull.first()).toHaveAttribute("data-king-glyph", "nerd");
  });

  test("V25 a burning king does not leak through fog", async ({ page }) => {
    // Black king on h8 at 1 HP, white king alone on a1 — h8 is unseen, so the
    // fire (which paints over the board) must not announce the square.
    await gotoScfen(page, "SCFEN|7k/8/8/8/8/8/8/K7|1|31|P|G:11:11|Q:w:;b:");

    await expect(page.locator("[data-board-grid] [data-square='h8']")).toHaveAttribute(
      "data-fog",
      "hidden",
      { timeout: 15_000 },
    );
    await expect(page.locator("[data-king-damage][data-square='h8']")).toHaveCount(0);
    // No burning black hull anywhere on the board while its square is unseen.
    await expect(page.locator("[data-king-damage][data-king-id='b']")).toHaveCount(0);
  });
});
