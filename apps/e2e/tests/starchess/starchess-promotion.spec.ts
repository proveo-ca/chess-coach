import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { settledPieceAt } from "./helpers";

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

test.describe("StarChess promotion vs spider mine", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => localStorage.clear());
  });

  test("promoting onto enemy mine: Marine dies, no BattleShip deploy", async ({ page }) => {
    // White Marine e7 → e8=q; black mine on e8; Command Center safe on a8.
    const scfen =
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|M:b:e8|Q:w:C=e7e8q;b:";
    await gotoScfen(page, scfen);
    await expect(page.getByTestId("turn-queue")).toContainText(/e7→e8/);
    await page.getByTestId("turn-end").click();

    // Mine clears; Marine never promotes — no BattleShip on e8, no Marine on e7.
    await expect(page.locator("[data-square='e8'] img[alt='w q']")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.locator("[data-square='e8'] img[alt='w p']")).toHaveCount(0);
    await expect(page.locator("[data-square='e7'] img[alt='w p']")).toHaveCount(0);
    // White Command Center still present.
    await expect(
      page.locator(
        "[data-square='e1'] [data-piece-inline='k'], [data-square='e1'] img[alt='w k']",
      ),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("clean promotion deploys the chosen unit", async ({ page }) => {
    const scfen =
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:C=e7e8q;b:";
    await gotoScfen(page, scfen);
    await page.getByTestId("turn-end").click();
    await expect(settledPieceAt(page, "e8", "w q")).toBeVisible({
      timeout: 15_000,
    });
    await expect(settledPieceAt(page, "e7", "w p")).toHaveCount(0);
  });
});
