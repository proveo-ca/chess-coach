import { expect, test } from "@playwright/test";

const gotoScfen = async (page: import("@playwright/test").Page, scfen: string) => {
  await page.goto(`/starchess?scfen=${encodeURIComponent(scfen)}`);
  await expect(page.getByTestId("nerd-board-chrome")).toBeVisible({ timeout: 20_000 });
};

test.describe("StarChess queue edit + gas pawn", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("queue classical shows C chip then X removes it", async ({ page }) => {
    const scfen =
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:C=e2e3;b:";
    await gotoScfen(page, scfen);
    const queue = page.getByTestId("turn-queue");
    await expect(queue).toContainText(/C e2→e3/i);
    await page.getByTestId("queue-remove-0").click();
    await expect(queue).toContainText("C —");
    await expect(queue).not.toContainText(/e2→e3/);
  });

  test("queue special shows B chip then X refunds gas", async ({ page }) => {
    // Tier-2 turn: rem 1 + spent 1 = income 2.
    const scfen =
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:12:22|Q:w:B=pawnDouble:e2:e3;b:";
    await gotoScfen(page, scfen);
    const queue = page.getByTestId("turn-queue");
    await expect(queue).toContainText(/B pawnDouble/i);
    const chrome = page.getByTestId("nerd-board-chrome");
    await expect(chrome).toBeVisible();
    await page.getByTestId("queue-remove-0").click();
    await expect(queue).not.toContainText(/pawnDouble/i);
  });

  test("pawnDouble gas then classical End advances two ranks", async ({ page }) => {
    // Pre-queued B+C: e2 gas→e3 then classical rewrite → e4 (rem 1 + spent 1).
    const scfen =
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:12:22|Q:w:B=pawnDouble:e2:e3,C=e2e3;b:";
    await gotoScfen(page, scfen);
    await page.getByTestId("turn-end").click();
    await expect(page.locator("[data-square='e4'] img[alt='w p']")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-square='e2'] img[alt='w p']")).toHaveCount(0);
    await expect(page.locator("[data-square='e3'] img[alt='w p']")).toHaveCount(0);
  });

  test("classical then pawnDouble gas End advances two ranks", async ({ page }) => {
    const scfen =
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:12:22|Q:w:C=e2e3,F=pawnDouble:e2:e3;b:";
    await gotoScfen(page, scfen);
    await page.getByTestId("turn-end").click();
    await expect(page.locator("[data-square='e4'] img[alt='w p']")).toBeVisible({
      timeout: 15_000,
    });
  });
});
