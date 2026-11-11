import { expect, test } from "@playwright/test";

/**
 * Mating-net-exit hover messaging (web-no-llm).
 *
 * Position: White to move with Ra8# (mate in 1). Hovering a non-mating Tank
 * slide (Rb1) leaves the forced mate — coach must use mating-net-exit copy,
 * not the generic "blunder" label.
 *
 * Uses three Marines on the 7th so the Command Center has no f7 escape (two-Marine FENs
 * make Ra8 only check, not mate).
 */
const MATING_NET_FEN = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1";

const MATING_NET_EXIT_RE =
  /That move would exit your mating net|That move would let them escape your mating net|Careful — that would break your mating net|That move would throw away the mate|Don't — that leaves the mating net/;

test.describe("Mating-net exit hover (web-no-llm)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("hovering a move that exits a mating net shows mating-net-exit advice", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate((fen) => {
      localStorage.clear();
      localStorage.setItem(
        "chess_coach_settings_state",
        JSON.stringify({
          colorPref: "w",
          activePlayerColor: "w",
          difficulty: "intermediate",
          playerIdentity: "Human",
          opponentIdentity: "Cat",
          playerName: "Tester",
          imLost: true,
        }),
      );
      localStorage.setItem(
        "chess_coach_game_state",
        JSON.stringify({
          pgn: "",
          currentIndex: 0,
          startingFen: fen,
        }),
      );
    }, MATING_NET_FEN);
    await page.reload();

    await expect(page.getByText("Play with Selena")).toBeVisible({ timeout: 15_000 });
    await page.getByText("Play with Selena").click();
    await expect(page).toHaveURL(/\/selena/);

    const a1 = page.locator("[data-square='a1']");
    await expect(a1.locator("img[alt='w r']")).toBeVisible({ timeout: 15_000 });

    await a1.click();
    const b1 = page.locator("[data-square='b1']");
    await expect(b1).toHaveAttribute("class", /valid/, { timeout: 5_000 });

    await b1.hover();
    await expect(page.getByText(MATING_NET_EXIT_RE)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/is a blunder/i)).not.toBeVisible();
  });
});
