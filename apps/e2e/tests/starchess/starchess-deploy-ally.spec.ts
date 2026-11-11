import { expect, test, type Page } from "@playwright/test";

import { settledPieceAt } from "./helpers";

/**
 * Command Center deploy over an ally unit — the drop replaces the occupant
 * (victim recorded), resolving to the deployed unit on the square.
 */
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

/** Drag a gas canister from the rack and release it over `square`. */
const dropGasOn = async (page: Page, square: string) => {
  const from = await page.getByTestId("gas-deploy").locator("button").first().boundingBox();
  const to = await page.locator(`[data-square='${square}']`).boundingBox();
  if (!from || !to) throw new Error("no rack/square box");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  const [tx, ty] = [to.x + to.width / 2, to.y + to.height / 2];
  const [fx, fy] = [from.x + from.width / 2, from.y + from.height / 2];
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(fx + ((tx - fx) * i) / 8, fy + ((ty - fy) * i) / 8);
  }
  await page.mouse.up();
};

test.describe("StarChess deploy over ally", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => localStorage.clear());
  });

  test("CC deploys a hoverbike onto an ally Marine — e6 becomes the bike", async ({
    page,
  }) => {
    // White CC e5, white Marine e6, banked minerals for the bike (cost 3).
    const scfen =
      "SCFEN|4k3/8/4P3/4K3/8/8/8/8|11|33|P|G:12:22|B:4:4|Q:w:;b:";
    await gotoScfen(page, scfen);
    await expect(settledPieceAt(page, "e5", "w k")).toBeVisible();
    await expect(settledPieceAt(page, "e6", "w p")).toBeVisible();

    // Gas onto the Command Center opens the deploy picker.
    await dropGasOn(page, "e5");
    await expect(page.getByTestId("deploy-modal")).toBeVisible({ timeout: 5_000 });

    // Pick the hoverbike, then take the ally-occupied ring square.
    await page.locator("[data-testid='deploy-modal'] button[data-spawn-piece='n']").click();
    const allyTarget = page.locator("[data-spawn-target][data-square='e6']");
    await expect(allyTarget).toBeVisible({ timeout: 5_000 });
    await allyTarget.click();

    // Deployed bike replaces the Marine on End.
    await page.getByTestId("turn-end").click();
    await expect(settledPieceAt(page, "e6", "w n")).toBeVisible({ timeout: 15_000 });
    await expect(settledPieceAt(page, "e6", "w p")).toHaveCount(0);
  });
});
