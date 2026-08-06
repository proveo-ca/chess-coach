import { expect, test } from "@playwright/test";

/** Canonical deep link: baseURL is `/starchess/`. */
const gotoScfen = async (page: import("@playwright/test").Page, scfen: string) => {
  await page.goto(`/?scfen=${encodeURIComponent(scfen)}`);
  await expect(page.getByTestId("nerd-board-chrome")).toBeVisible({ timeout: 20_000 });
};

test.describe("StarChess gas-used fog reveal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("enemy gas-spent unit is visible through fog with data-special-used", async ({
    page,
  }) => {
    // Black knight on e5 spent gas (U:e5); white viewer — fog pierces green used unit.
    const scfen =
      "SCFEN|4k3/8/8/4n3/8/8/8/4K3|1|33|P|G:11:11|U:e5|Q:w:;b:";
    await gotoScfen(page, scfen);

    const used = page.locator("[data-square='e5'] [data-special-used='true']");
    await expect(used).toBeVisible({ timeout: 10_000 });
    // Fog veil may still sit on the square; the gas-used piece must pierce it.
    await expect(page.locator("[data-square='e5'] img[alt='b n'], [data-square='e5'] [data-piece-inline]")).toBeVisible();
  });
});
