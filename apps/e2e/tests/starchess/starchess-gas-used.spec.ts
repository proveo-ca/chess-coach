import { expect, test } from "@playwright/test";

/** Canonical deep link: baseURL is `/starchess/`. */
const gotoScfen = async (page: import("@playwright/test").Page, scfen: string) => {
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

test.describe("StarChess gas-used fog (no pierce)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => localStorage.clear());
  });

  test("enemy gas-spent unit stays fogged — no green ring leak", async ({
    page,
  }) => {
    // Black knight on e5 spent gas (U:e5); white viewer must not see it.
    const scfen =
      "SCFEN|4k3/8/8/4n3/8/8/8/4K3|1|33|P|G:11:11|U:e5|Q:w:;b:";
    await gotoScfen(page, scfen);

    const e5 = page.locator("[data-square='e5']");
    await expect(e5).toHaveAttribute("data-fog", "hidden", { timeout: 10_000 });
    await expect(e5.locator("[data-special-used='true']")).toHaveCount(0);
    await expect(
      e5.locator("img[alt='b n'], [data-piece-inline]"),
    ).toHaveCount(0);
  });
});
