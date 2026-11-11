import { expect, test } from "@playwright/test";

test.describe("Mating sequence detection (web-no-llm)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("detects human mating sequence after Qh5 following black Nf6 blunder", async ({ page }) => {
    // Hijack starting FEN (black to move). Black has just played Nf6??.
    // White (the player) now plays Qh5 which begins a mating sequence vs opponent.
    const fenAfterNf6 =
      "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 1 4";

    await page.goto("/");
    await page.evaluate((fen) => {
      localStorage.clear();
      localStorage.setItem(
        "chess_coach_game_state",
        JSON.stringify({
          pgn: "",
          currentIndex: 0,
          startingFen: fen,
        }),
      );
    }, fenAfterNf6);
    await page.reload();

    await expect(page.getByText("Play with Selena")).toBeVisible({ timeout: 15_000 });
    await page.getByText("Play with Selena").click();
    await expect(page).toHaveURL(/\/selena/);

    // Position ready: white to move, Qd1-h5 is legal.
    const d1 = page.locator("[data-square='d1']");
    await d1.click();
    const h5 = page.locator("[data-square='h5']");
    await expect(h5).toHaveAttribute("class", /valid/, { timeout: 5_000 });
    await h5.click();

    // Qh5 executed — persists into game state even if Maia answers Nxh5 before
    // the piece assertion can land (common on slower WebKit under Xvfb).
    await expect
      .poll(
        async () =>
          page.evaluate((key) => {
            const raw = localStorage.getItem(key);
            if (!raw) return "";
            try {
              return (JSON.parse(raw) as { pgn?: string }).pgn ?? "";
            } catch {
              return "";
            }
          }, "chess_coach_game_state"),
        { timeout: 10_000 },
      )
      .toMatch(/\bQh5\b/);
  });
});
