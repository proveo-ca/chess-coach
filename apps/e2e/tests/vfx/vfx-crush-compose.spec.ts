import { expect, test } from "@playwright/test";

import {
  clearStorage,
  gotoScfen,
  settledPiece,
  startVfxWatch,
  waitForVfxIdle,
} from "./vfxHarness";

/**
 * Guarantee V40 — crush compose: an ally deploy onto an enemy-occupied square
 * layers the deploy hull ABOVE the victim's death boom for the shared window,
 * instead of switching between clips.
 * Roster: `_spec/apps/starchess/vfx-guarantees.md`.
 * Source: `_spec/apps/starchess/architecture/composite-vfx-stack.puml`
 *       (Deploy DOM-last ≈ topmost; explicit z implements it under `isolate`).
 *
 * Seed: white Ke1 + black nd1; white spawns a Marine e1→d1 (B timing, the same
 * crush `crushSpawn.test.ts` pins in core). `timelinePlayer.handleDeployWindow`
 * plays deploy at t0 + crush death at +100ms on d1; the sampler doctrine
 * applies — cue overlap is read in-page (a locator poll backs off past the
 * 400ms co-presence window), settled placement through locators.
 */

const CRUSH_SEED =
  "SCFEN|4k3/8/8/8/8/8/8/R2nK3|1|33|P|G:01:11|B:3:3|Q:w:B=spawn:e1:d1:p;b:";

test.describe("VFX · crush compose", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("V40 deploy hull paints above the crush death boom on d1", async ({
    page,
  }) => {
    await gotoScfen(page, CRUSH_SEED);
    await startVfxWatch(page);
    await page.getByTestId("turn-end").click();

    // Co-presence window: deploy lives 500ms from t0, death 500ms from +100ms.
    await page.waitForFunction(
      () =>
        document.querySelector('[data-deploy-piece="p"]') !== null &&
        document.querySelector('[data-death-phase="dying"]') !== null,
      { timeout: 15_000 },
    );

    const paint = await page.evaluate(() => {
      const deploySlot = document.querySelector('[data-deploy-piece="p"]');
      const deathSlot = document.querySelector('[data-death-phase="dying"]');
      const deployLayer = document.querySelector("[data-starchess-deploy-layer]");
      const deathLayer = document.querySelector("[data-starchess-death-layer]");
      if (!deploySlot || !deathSlot || !deployLayer || !deathLayer) return null;
      const dr = deploySlot.getBoundingClientRect();
      const xr = deathSlot.getBoundingClientRect();
      const zDeploy = getComputedStyle(deployLayer).zIndex;
      const zDeath = getComputedStyle(deathLayer).zIndex;
      // Both layers are pointer-events:none (V1 inert contract) — lift hit
      // testing for one frame to read paint order, then restore.
      const touched: Array<[Element, string]> = [];
      for (const el of [deployLayer, deathLayer, deploySlot, deathSlot]) {
        touched.push([el, (el as HTMLElement).style.pointerEvents]);
        (el as HTMLElement).style.pointerEvents = "auto";
      }
      const x = xr.left + xr.width / 2;
      const y = xr.top + xr.height / 2;
      const stack = document
        .elementsFromPoint(x, y)
        .map((el) => {
          if (el.closest?.("[data-starchess-deploy-layer]")) return "deploy";
          if (el.closest?.("[data-starchess-death-layer]")) return "death";
          return el.tagName;
        })
        .slice(0, 4);
      for (const [el, v] of touched) (el as HTMLElement).style.pointerEvents = v;
      return {
        sameSquare:
          Math.abs(dr.x - xr.x) < 2 &&
          Math.abs(dr.y - xr.y) < 2 &&
          Math.abs(dr.width - xr.width) < 2,
        zDeploy,
        zDeath,
        stack,
      };
    });

    expect(paint).not.toBeNull();
    // Same tile, one crush — not two adjacent animations.
    expect(paint!.sameSquare).toBe(true);
    // Explicit z implements DOM-last intent under `isolation: isolate`.
    expect(Number(paint!.zDeploy)).toBeGreaterThan(Number(paint!.zDeath));
    // Topmost painted element on the shared square is the deploy hull.
    expect(paint!.stack.find((s) => s === "deploy" || s === "death")).toBe("deploy");

    const watch = await waitForVfxIdle(page);
    expect(watch.ever).toContain("deploy");
    expect(watch.ever).toContain("death");
    expect(watch.deployPieces).toContain("p");

    // Settled: Marine holds d1, the knight is gone.
    await expect(settledPiece(page, "d1", "w p")).toBeVisible({ timeout: 15_000 });
    await expect(settledPiece(page, "d1", "b n")).toHaveCount(0);
  });
});
