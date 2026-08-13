import { expect, test } from "@playwright/test";

/**
 * Progressive path fog — bishop fog-edge DualNav on starchess Storybook (:6007).
 * Asserts g7 lights while the bishop is still walking (move layer active), not only
 * after the final occupy commit — matches apps/ui StarChessBoardView path vision.
 */
const BISHOP_STORY =
  "http://127.0.0.1:6007/iframe.html?id=starchess-fog-of-war-and-move-animations--bishop&viewMode=story";

const fogOf = async (page: import("@playwright/test").Page, sq: string) =>
  page.locator(`[data-board-grid] [data-square="${sq}"]`).getAttribute("data-fog");

test.describe("StarChess fog path reveal (bishop)", () => {
  test("bishop lights g7 while walking the fog-edge diagonal", async ({ page }) => {
    await page.goto(BISHOP_STORY, { waitUntil: "networkidle" });
    await expect(page.locator("[data-board-grid] [data-square]").first()).toBeVisible({
      timeout: 30_000,
    });

    // Start: Bd4 rest vision — g7 pawn stays fogged.
    await expect.poll(async () => fogOf(page, "d4")).toBe("visible");
    await expect.poll(async () => fogOf(page, "g7")).toBe("hidden");

    await page.locator("#storybook-root").click({ position: { x: 24, y: 24 } });

    // 1) Intent ghost · 2) Resolve approach + capture.
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
    await page.keyboard.press("ArrowRight");

    // g7 must punch through fog while MoveAnimation is still on screen.
    let sawWhileWalking = false;
    for (let i = 0; i < 100; i++) {
      await page.waitForTimeout(40);
      const snap = await page.evaluate(() => {
        const g7 = document
          .querySelector('[data-board-grid] [data-square="g7"]')
          ?.getAttribute("data-fog");
        const moving = !!document.querySelector(
          "[data-starchess-move-layer] [data-move-id]",
        );
        return { g7, moving };
      });
      if (snap.g7 === "visible" && snap.moving) {
        sawWhileWalking = true;
        break;
      }
    }
    expect(sawWhileWalking).toBe(true);

    // Settled: discovery capture — g7 stays lit.
    await expect
      .poll(async () => fogOf(page, "g7"), { timeout: 15_000 })
      .toBe("visible");
  });
});
