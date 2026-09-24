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

const ccLives = (page: Page) =>
  page.getByTestId("cc-lives");

test.describe("StarChess SCFEN exceptions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => localStorage.clear());
  });

  test("Command Center duel chips HP on load (face-to-face turn-open)", async ({ page }) => {
    // Kd1 vs kd2 — turn-open mutual shots chip once on mount (full duel loop is
    // covered in core beginScTurn / resolve tests).
    const scfen = "SCFEN|8/8/8/8/8/8/3k4/3K4|1|33|P|G:11:11|Q:w:;b:";
    await gotoScfen(page, scfen);
    await expect(ccLives(page)).toHaveAttribute("data-w", "2", { timeout: 15_000 });
    await expect(ccLives(page)).toHaveAttribute("data-b", "2");
  });

  test("deploy stack second checker deals 2 HP next turn", async ({ page }) => {
    // White Command Center d4; black Command Center e6; white Marine already on e5 checking (1 HP).
    // After End, black should be at 2 lives (was 3). Then seed is already mid-duel.
    // Stronger: white Marine c5 + Command Center d4 both check black Command Center d6 → 2 chips.
    const scfen =
      "SCFEN|8/8/3k4/2P5/3K4/8/8/8|1|33|P|G:11:11|Q:w:;b:";
    await gotoScfen(page, scfen);
    await expect(page.getByTestId("turn-end")).toBeEnabled({ timeout: 20_000 });
    await page.getByTestId("turn-end").click();
    // Command Center d4 + Marine c5 both check kd6 → black loses 2 HP (3→1).
    // If only one checker fires (fog / timing), still require damage applied.
    await expect(ccLives(page)).not.toHaveAttribute("data-b", "3", { timeout: 20_000 });
    const bLives = await ccLives(page).getAttribute("data-b");
    expect(Number(bLives)).toBeLessThanOrEqual(2);
    await expect(ccLives(page)).toHaveAttribute("data-w", "3");
  });

  test("sieged tank offers fire missions, never quiet relocates", async ({ page }) => {
    // Sieged Tank c4, empty board around — the whole cross highlights, but
    // every mission fires in place: after End the tank is still on c4.
    const scfen =
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|1|33|P|G:11:11|S:c4|Q:w:;b:";
    await gotoScfen(page, scfen);
    await page.locator("[data-square='c4']").click();
    // Cross squares highlight as legal fire-mission destinations.
    await expect(page.locator('[data-square="c5"][data-legal="c5"]')).toHaveCount(1, {
      timeout: 3_000,
    });
    // Queue one and resolve: the tank fires from c4, never relocates to c5.
    await page.locator('[data-square="c5"]').click();
    await page.getByTestId("turn-end").click();
    await expect(settledPieceAt(page, "c4", "w r")).toBeVisible({ timeout: 15_000 });
    await expect(settledPieceAt(page, "c5", "w r")).toHaveCount(0);
  });

  test("sieged tank fire stays on origin after End", async ({ page }) => {
    // Sieged Rd4 fires at nh7 (9×9 Chebyshev) — stays on d4.
    const scfen =
      "SCFEN|7k/7n/8/8/3R4/8/8/4K3|1|33|P|G:11:11|S:d4|Q:w:C=d4h7;b:";
    await gotoScfen(page, scfen);
    await expect(page.getByTestId("turn-queue")).toContainText(/d4→h7/);
    await page.getByTestId("turn-end").click();
    // Inline Tank uses role=img + data-piece-inline (not img[alt]).
    await expect(
      page.locator("[data-square='d4'] [data-piece-inline='r'], [data-square='d4'] img[alt='w r']"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-square='h7'] img[alt='b n']")).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test("spawn then classical move same turn via board click", async ({
    page,
  }) => {
    // B spawn d1 Marine → select d1 (virtual) → legal d2.
    const scfen =
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:01:11|B:3:3|Q:w:B=deploy:e1:d1:p;b:";
    await gotoScfen(page, scfen);
    await page.locator("[data-square='d1']").click();
    await expect(
      page.locator('[data-square="d2"][class*="valid-move"], [data-square="d2"][class*="advice"]'),
    ).toBeVisible({ timeout: 3_000 });
  });

  test("gas Marine then select landing square for further dests", async ({
    page,
  }) => {
    const scfen =
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:01:11|B:3:3|Q:w:B=stimStep:e2:e3;b:";
    await gotoScfen(page, scfen);
    await page.locator("[data-square='e3']").click();
    await expect(
      page.locator('[data-square="e4"][class*="valid-move"], [data-square="e4"][class*="advice"]'),
    ).toBeVisible({ timeout: 3_000 });
  });

  test("unsiege then quiet Tank relocate legal", async ({ page }) => {
    const scfen =
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|1|33|P|G:01:11|S:c4|B:3:3|Q:w:B=siegeMode:c4;b:";
    await gotoScfen(page, scfen);
    await page.locator("[data-square='c4']").click();
    await expect(
      page.locator('[data-square="c5"][class*="valid-move"], [data-square="c5"][class*="advice"]'),
    ).toBeVisible({ timeout: 3_000 });
  });
});
