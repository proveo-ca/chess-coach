import { expect, test } from "@playwright/test";

/**
 * Review /:id mobile chrome — matchup toolbar above the board.
 * Fixture mirrors review.spec.ts (Win as White vs Selena).
 */
const FIXTURE_ID = "test-review-matchup-0001";
const FIXTURE_PGN = "1. e4 e5 2. d4 d5 3. Nf3 Nc6";
const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const fixture = {
  games: [
    {
      id: FIXTURE_ID,
      startedAt: new Date("2026-04-14").toISOString(),
      endedAt: new Date("2026-04-14").toISOString(),
      result: "win",
      pgn: FIXTURE_PGN,
      startingFen: STARTING_FEN,
      playerColor: "w",
      difficulty: "easy",
      opponentName: "Selena",
      moves: [
        { san: "e4", hasPressedHint: false, isAI: false },
        { san: "e5", hasPressedHint: false, isAI: true },
        { san: "d4", hasPressedHint: false, isAI: false },
        { san: "d5", hasPressedHint: false, isAI: true },
        { san: "Nf3", hasPressedHint: false, isAI: false },
        { san: "Nc6", hasPressedHint: false, isAI: true },
      ],
    },
  ],
  inProgress: null,
};

async function seedAndOpen(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate((payload) => {
    localStorage.clear();
    localStorage.setItem("chess_coach_game_history", JSON.stringify(payload));
  }, fixture);
  await page.goto(`review/${FIXTURE_ID}`);
  await expect(page).toHaveURL(new RegExp(`/review/${FIXTURE_ID}`));
  await expect(page.getByTestId("chessboard")).toBeVisible({ timeout: 20_000 });
}

test.describe("Review /:id mobile matchup chrome", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows Win (White) vs Opponent with back + share icons", async ({ page }) => {
    await seedAndOpen(page);

    const matchup = page.getByTestId("review-matchup");
    await expect(matchup).toBeVisible();
    await expect(matchup).toHaveText(/Win \(White\) vs Selena/);

    await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Back/ })).toBeVisible();

    // Drawer left of matchup title (in-toolbar, not floated over text).
    const menu = page.getByRole("button", { name: "Open menu" });
    const mb = await menu.boundingBox();
    const tb = await matchup.boundingBox();
    expect(mb && tb).toBeTruthy();
    expect(tb!.x, "matchup title should start after the drawer").toBeGreaterThan(
      mb!.x + mb!.width - 1,
    );

    // Back stays rightmost in the matchup nav cluster (Share · Back).
    const share = page.getByRole("button", { name: "Share" });
    const back = page.getByRole("button", { name: /Back/ });
    const sb = await share.boundingBox();
    const bb = await back.boundingBox();
    expect(sb && bb).toBeTruthy();
    expect(bb!.x, "Back should sit to the right of Share").toBeGreaterThan(sb!.x);

    // Full desktop title stack stays in the DOM but is not shown on mobile.
    await expect(page.locator(".desktop-only").filter({ hasText: /vs Selena \(Black\)/ })).toBeHidden();
  });

  test("desktop keeps SidebarInset titles (no matchup bar)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedAndOpen(page);

    await expect(page.getByTestId("review-matchup")).toBeHidden();
    await expect(page.getByText(/Win \(White\)/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
  });
});
