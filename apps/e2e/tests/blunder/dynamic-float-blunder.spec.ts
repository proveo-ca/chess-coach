import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * §4 floating CoachPanel + blunder detection on a short (dynamic) viewport.
 *
 * Responsiveness contract: `_spec/apps/chess/responsiveness/rules.md` §4.
 * Blunder hover: same Qxf7 setup as coach.spec.ts — white queen on h5,
 * hovering f7 must surface "blunder" inside `data-testid=floating-advice`
 * (the real CoachPanel, not an in-flow footer).
 */
const DYNAMIC = { width: 480, height: 480 };

const BLUNDER_GAME = {
  pgn: "1. e4 e5 2. Qh5 Nc6",
  currentIndex: 4,
  startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
};

async function seedCoachGame(page: Page) {
  await page.goto("/");
  await page.evaluate((game) => {
    localStorage.clear();
    localStorage.setItem("chess_coach_game_state", JSON.stringify(game));
  }, BLUNDER_GAME);
  await page.reload();
  await expect(page.getByText("Play with Selena")).toBeVisible({ timeout: 15_000 });
  await page.getByText("Play with Selena").click();
  await expect(page).toHaveURL(/\/selena/);
  await expect(page.getByTestId("chessboard")).toBeVisible({ timeout: 20_000 });
  await page
    .locator('[data-testid="coach-avatar"][data-variant="sleeping"]')
    .waitFor({ state: "detached", timeout: 30_000 })
    .catch(() => undefined);
}

test.describe("Dynamic float · blunder warning", () => {
  test.use({ viewport: DYNAMIC });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("short viewport enables floating CoachPanel", async ({ page }) => {
    await seedCoachGame(page);
    await expect(page.locator('[data-testid="screen-root"]')).toHaveAttribute(
      "data-footer-float",
      "true",
      { timeout: 5_000 },
    );
    // Greeting / restored advice appears instantly in float mode.
    await expect(page.getByTestId("floating-advice")).toBeVisible({ timeout: 5_000 });
  });

  test("hovering a blunder shows the warning inside the floating CoachPanel", async ({
    page,
  }) => {
    await seedCoachGame(page);

    await expect(page.locator('[data-testid="screen-root"]')).toHaveAttribute(
      "data-footer-float",
      "true",
      { timeout: 5_000 },
    );

    const h5 = page.locator("[data-square='h5']");
    await expect(h5.locator("img[alt='w q']")).toBeVisible({ timeout: 15_000 });

    await h5.click();
    const f7 = page.locator("[data-square='f7']");
    await expect(f7).toHaveAttribute("class", /capture/, { timeout: 5_000 });

    await f7.hover();

    const float = page.getByTestId("floating-advice");
    await expect(float).toBeVisible({ timeout: 20_000 });
    await expect(float.getByText(/blunder/i)).toBeVisible({ timeout: 20_000 });
    await expect(float.getByText(/Coach Selena/i)).toBeVisible();
    await expect(float.getByText(/Welcome back|continue our game/i)).toHaveCount(0);
    // Why-hint: dynamic viewport is mobile-sized → Tap, not Space.
    await expect(float.getByText("Tap here — To learn why")).toBeVisible();
    await expect(float.getByText(/Press/)).toHaveCount(0);
  });

  test("dismiss × hides the floating blunder warning", async ({ page }) => {
    await seedCoachGame(page);

    const h5 = page.locator("[data-square='h5']");
    await expect(h5.locator("img[alt='w q']")).toBeVisible({ timeout: 15_000 });
    await h5.click();
    const f7 = page.locator("[data-square='f7']");
    await expect(f7).toHaveAttribute("class", /capture/, { timeout: 5_000 });
    await f7.hover();

    const float = page.getByTestId("floating-advice");
    await expect(float.getByText(/blunder/i)).toBeVisible({ timeout: 20_000 });

    await float.getByRole("button", { name: "Dismiss advice" }).click();
    await expect(float).toHaveCount(0);
  });

  test("after dismissing greeting, a blunder hover still floats a warning", async ({ page }) => {
    await seedCoachGame(page);

    const float = page.getByTestId("floating-advice");
    await expect(float).toBeVisible({ timeout: 5_000 });
    await float.getByRole("button", { name: "Dismiss advice" }).click();
    await expect(page.getByTestId("floating-advice")).toHaveCount(0);

    const h5 = page.locator("[data-square='h5']");
    await expect(h5.locator("img[alt='w q']")).toBeVisible({ timeout: 15_000 });
    await h5.click();
    const f7 = page.locator("[data-square='f7']");
    await expect(f7).toHaveAttribute("class", /capture/, { timeout: 5_000 });
    await f7.hover();

    await expect(page.getByTestId("floating-advice").getByText(/blunder/i)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("re-hovering a blunder after dismiss shows the warning again", async ({ page }) => {
    await seedCoachGame(page);

    const h5 = page.locator("[data-square='h5']");
    await expect(h5.locator("img[alt='w q']")).toBeVisible({ timeout: 15_000 });
    await h5.click();
    const f7 = page.locator("[data-square='f7']");
    await expect(f7).toHaveAttribute("class", /capture/, { timeout: 5_000 });
    await f7.hover();

    const float = page.getByTestId("floating-advice");
    await expect(float.getByText(/blunder/i)).toBeVisible({ timeout: 20_000 });
    await float.getByRole("button", { name: "Dismiss advice" }).click();
    await expect(page.getByTestId("floating-advice")).toHaveCount(0);

    // Deselect to end the blunder episode, then select + hover again.
    await h5.click();
    await expect(f7).not.toHaveAttribute("class", /capture/, { timeout: 5_000 });
    await h5.click();
    await expect(f7).toHaveAttribute("class", /capture/, { timeout: 5_000 });
    await f7.hover();

    await expect(page.getByTestId("floating-advice").getByText(/blunder/i)).toBeVisible({
      timeout: 20_000,
    });
  });
});
