import { expect, test } from "@playwright/test";

/** SCFEN deep-link helper (NerdScreen reads `?scfen=`). */
const gotoScfen = async (page: import("@playwright/test").Page, scfen: string) => {
  await page.goto(`/starchess?scfen=${encodeURIComponent(scfen)}`);
  await expect(page.getByTestId("nerd-board-chrome")).toBeVisible({ timeout: 20_000 });
};

const kingLives = (page: import("@playwright/test").Page) =>
  page.getByTestId("king-lives");

test.describe("StarChess SCFEN exceptions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("king duel chips both HP each End until 0/0 draw", async ({ page }) => {
    // Kd1 vs kd2 face-to-face — each End applies mutual king shots.
    const scfen = "SCFEN|8/8/8/8/8/8/3k4/3K4|1|33|P|G:11:11|Q:w:;b:";
    await gotoScfen(page, scfen);
    await expect(kingLives(page)).toHaveAttribute("data-w", "3");
    await expect(kingLives(page)).toHaveAttribute("data-b", "3");

    for (const [w, b] of [
      ["2", "2"],
      ["1", "1"],
      ["0", "0"],
    ] as const) {
      await page.getByTestId("turn-end").click();
      await expect(kingLives(page)).toHaveAttribute("data-w", w, { timeout: 15_000 });
      await expect(kingLives(page)).toHaveAttribute("data-b", b, { timeout: 15_000 });
    }

    await expect(page.locator("body")).toContainText(/draw/i, { timeout: 10_000 });
  });

  test("deploy stack second checker deals 2 HP next turn", async ({ page }) => {
    // White king d4; black king e6; white pawn already on e5 checking (1 HP).
    // After End, black should be at 2 lives (was 3). Then seed is already mid-duel.
    // Stronger: white pawn c5 + king d4 both check black king d6 → 2 chips.
    const scfen =
      "SCFEN|8/8/3k4/2P5/3K4/8/8/8|1|33|P|G:11:11|Q:w:;b:";
    await gotoScfen(page, scfen);
    await page.getByTestId("turn-end").click();
    // King d4 + pawn c5 both check kd6 → black loses 2 HP (3→1).
    await expect(kingLives(page)).toHaveAttribute("data-b", "1", { timeout: 15_000 });
    await expect(kingLives(page)).toHaveAttribute("data-w", "3");
  });

  test("sieged tank shows no quiet relocate destinations", async ({ page }) => {
    // Sieged rook c4, empty board around — artillery only fires on enemies.
    const scfen =
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|1|33|P|G:11:11|S:c4|Q:w:;b:";
    await gotoScfen(page, scfen);
    await page.locator("[data-square='c4']").click();
    // CSS-module class contains "valid-move" (not bare "valid", which matches "invalid").
    await expect(page.locator('[data-square="c5"][class*="valid-move"]')).toHaveCount(0, {
      timeout: 3_000,
    });
    await expect(page.locator('[data-square][class*="valid-move"]')).toHaveCount(0);
  });

  test("sieged tank fire stays on origin after End", async ({ page }) => {
    // Sieged Rd4 fires at nh7 (9×9 Chebyshev) — stays on d4.
    const scfen =
      "SCFEN|7k/7n/8/8/3R4/8/8/4K3|1|33|P|G:11:11|S:d4|Q:w:C=d4h7;b:";
    await gotoScfen(page, scfen);
    await expect(page.getByTestId("turn-queue")).toContainText(/C d4→h7/i);
    await page.getByTestId("turn-end").click();
    // Inline rook uses role=img + data-piece-inline (not img[alt]).
    await expect(
      page.locator("[data-square='d4'] [data-piece-inline='r'], [data-square='d4'] img[alt='w r']"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-square='h7'] img[alt='b n']")).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test.fail(
    "spawn then classical move same turn via board click",
    async ({ page }) => {
      // Deferred: useScMoveProvider pre-B placement — document in starchess-mode.puml.
      const scfen =
        "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:B=spawn:e1:d1:p;b:";
      await gotoScfen(page, scfen);
      await page.locator("[data-square='d1']").click();
      await expect(page.locator("[data-square='d2']")).toHaveAttribute("class", /valid/, {
        timeout: 3_000,
      });
    },
  );

  test.skip("siege mode toggle UI mode+mode", async () => {
    // Deferred: siege tank mode+mode toggle UI — engine rookSiege is authoritative.
  });
});
