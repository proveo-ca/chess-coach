import { expect, test, type Page } from "@playwright/test";

import { settledPieceAt } from "./helpers";

/**
 * Marines attack on their front diagonals — including a hostile spider mine —
 * so a marine whose straight path is blocked can still dodge diagonally and
 * clear the mine (occupying the square).
 */
const gotoScfen = async (page: Page, scfen: string) => {
  await page.goto(`single?scfen=${encodeURIComponent(scfen)}`);
  await expect(page.getByTestId("starchess-board-chrome")).toBeVisible({ timeout: 20_000 });
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

test.describe("StarChess marine diagonal mine capture", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => localStorage.clear());
  });

  test("d4 marine takes the c5 mine around the d5 frontal block", async ({ page }) => {
    // White marine d4, black marine d5 directly ahead of it, black mine c5 on
    // its front-left diagonal.
    const scfen =
      "SCFEN|4k3/8/8/3p4/3P4/8/8/4K3|1|33|P|G:11:11|M:b:c5|Q:w:;b:";
    await gotoScfen(page, scfen);
    await expect(settledPieceAt(page, "d4", "w p")).toBeVisible();

    // The diagonal mine is offered even though d5 blocks the straight path.
    await page.locator("[data-square='d4']").click();
    await page.locator("[data-square='c5']").click();
    await expect(page.getByTestId("turn-queue")).toContainText(/d4→c5/, {
      timeout: 3_000,
    });

    await page.getByTestId("turn-end").click();
    // Mine cleared and occupied by the marine; the blocker stands untouched.
    await expect(settledPieceAt(page, "c5", "w p")).toBeVisible({ timeout: 15_000 });
    await expect(settledPieceAt(page, "d4", "w p")).toHaveCount(0);
    await expect(settledPieceAt(page, "d5", "b p")).toBeVisible();
  });
});
