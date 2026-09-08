import { expect, test } from "@playwright/test";

import { settledPieceAt } from "./helpers";
import type { Page } from "@playwright/test";

/** Canonical deep link: baseURL is `/starchess/`. */
const gotoScfen = async (page: Page, scfen: string) => {
  await page.goto(`single?scfen=${encodeURIComponent(scfen)}`);
  await expect(page.getByTestId("starchess-board-chrome")).toBeVisible({ timeout: 20_000 });
  // Deep links can seat a milestone turn — clear its broadcast first.
  const bubble = page.getByTestId("turn-bonus-bubble");
  const shown = await bubble
    .waitFor({ state: "visible", timeout: 500 })
    .then(() => true)
    .catch(() => false);
  if (shown) {
    await bubble.click();
    await expect(page.getByTestId("turn-bonus-bubble")).toBeHidden({ timeout: 2_000 });
  }
};

test.describe("StarChess gas-step animation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => localStorage.clear());
  });

  test("pawnDouble slides via move cue (no teleport)", async ({ page }) => {
    // Pre-queued gas step e2→e3; End plays a move cue before occupying e3.
    const scfen =
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:12:22|Q:w:B=pawnDouble:e2:e3;b:";
    await gotoScfen(page, scfen);
    await expect(settledPieceAt(page, "e2", "w p")).toBeVisible();

    await page.getByTestId("turn-end").click();

    // While the gas-step animates, a move overlay is present (from→to slide).
    // The stim hop lasts ~80ms — far below polling granularity — so watch for
    // its insertion in-page instead of polling for visibility.
    const sawMoveCue = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const sel = "[data-move-id][data-move-piece='p']";
          if (document.querySelector(sel)) {
            resolve(true);
            return;
          }
          const done = (v: boolean) => {
            obs.disconnect();
            window.clearTimeout(t);
            resolve(v);
          };
          const obs = new MutationObserver(() => {
            if (document.querySelector(sel)) done(true);
          });
          obs.observe(document.body, { childList: true, subtree: true });
          const t = window.setTimeout(() => done(false), 8_000);
        }),
    );
    expect(sawMoveCue).toBe(true);

    // Settled: pawn left e2 and occupies e3 (no silent teleport skip).
    await expect(settledPieceAt(page, "e3", "w p")).toBeVisible({
      timeout: 15_000,
    });
    await expect(settledPieceAt(page, "e2", "w p")).toHaveCount(0);
  });
});
