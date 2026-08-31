import { expect, test } from "@playwright/test";
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
    await expect(page.locator("[data-square='e2'] img[alt='w p']")).toBeVisible();

    await page.getByTestId("turn-end").click();

    // While the gas-step animates, a move overlay is present (from→to slide).
    await expect(page.locator("[data-move-id][data-move-piece='p']")).toBeVisible({
      timeout: 5_000,
    });

    // Settled: pawn left e2 and occupies e3 (no silent teleport skip).
    await expect(page.locator("[data-square='e3'] img[alt='w p']")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-square='e2'] img[alt='w p']")).toHaveCount(0);
  });
});
