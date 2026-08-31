import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

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

test.describe("StarChess queue edit + gas pawn", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => localStorage.clear());
  });

  test("queue classical shows C chip then X removes it", async ({ page }) => {
    const scfen =
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:C=e2e3;b:";
    await gotoScfen(page, scfen);
    const queue = page.getByTestId("turn-queue");
    await expect(queue).toContainText(/e2→e3/);
    await page.getByTestId("queue-remove-0").click();
    await expect(queue).not.toContainText(/e2→e3/);
  });

  test("queue special shows B chip then X refunds gas", async ({ page }) => {
    // Tier-2 turn: rem 1 + spent 1 = income 2.
    const scfen =
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:12:22|Q:w:B=pawnDouble:e2:e3;b:";
    await gotoScfen(page, scfen);
    const queue = page.getByTestId("turn-queue");
    await expect(queue).toContainText(/e2→e3|pawnDouble/i);
    // Intent canister on the gas-armed unit (top-right badge).
    await expect(page.locator("[data-square='e2'][data-intent-canister]")).toBeVisible();
    await expect(page.locator("[data-square='e2'] .intentCanister, [data-square='e2'] [class*='intentCanister']")).toBeVisible();
    const chrome = page.getByTestId("starchess-board-chrome");
    await expect(chrome).toBeVisible();
    await page.getByTestId("queue-remove-0").click();
    await expect(queue).not.toContainText(/pawnDouble/i);
    await expect(page.locator("[data-square='e2'][data-intent-canister]")).toHaveCount(0);
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

  test("board click queues C from gas landing then End", async ({ page }) => {
    // Gas e2→e3 queued; click e3 → e4 classical from post-B square.
    const scfen =
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:01:11|B:3:3|Q:w:B=pawnDouble:e2:e3;b:";
    await gotoScfen(page, scfen);
    await page.locator("[data-square='e3']").click();
    await page.locator("[data-square='e4']").click();
    await expect(page.getByTestId("turn-queue")).toContainText(/e3→e4/, {
      timeout: 3_000,
    });
    await page.getByTestId("turn-end").click();
    await expect(page.locator("[data-square='e4'] img[alt='w p']")).toBeVisible({
      timeout: 15_000,
    });
  });
});
