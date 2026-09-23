import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Progressive path fog — bishop fog-edge lesson on starchess Storybook (:6007).
 * Asserts g7 lights while the bishop is still walking (move layer active), not only
 * after the final occupy commit — matches apps/chess StarChessBoardView path vision.
 *
 * The story is a **live** lesson projection (`lessonStory("fog", "bishop")`, see
 * `FogOfWar.stories.tsx`): queue Bd4→h8 by clicking, `endTurnAfterQueue: "first"`
 * submits the turn. It is not a DualNav observer replay — arrow keys do nothing.
 * The walk/light overlap lasts a few frames, so it is sampled in-page at 8ms
 * (a Playwright poll loop backs off past the window). Related VFX guarantees:
 * `_spec/apps/starchess/vfx-guarantees.md`.
 */
const BISHOP_STORY =
  "http://127.0.0.1:6007/iframe.html?id=starchess-fog-of-war-and-move-animations--bishop&viewMode=story";

const fogOf = async (page: Page, sq: string) =>
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

    // Sample every frame from before the queue lands until the walk is over.
    await page.evaluate(() => {
      const w = window as unknown as { __fogWalk?: boolean; __fogTimer?: number };
      w.__fogWalk = false;
      w.__fogTimer = window.setInterval(() => {
        const lit =
          document
            .querySelector('[data-board-grid] [data-square="g7"]')
            ?.getAttribute("data-fog") === "visible";
        const walking = !!document.querySelector("[data-starchess-move-layer] [data-move-id]");
        if (lit && walking) w.__fogWalk = true;
      }, 8);
    });

    // Queue Bd4→h8 into the fog; the lesson ends the turn on the first queue.
    await page.locator("[data-square='d4']").click();
    await page.locator("[data-square='h8']").click();

    // Settled: discovery capture — g7 stays lit, bishop stops on g7.
    await expect.poll(async () => fogOf(page, "g7"), { timeout: 20_000 }).toBe("visible");
    await expect(
      page.locator(
        "[data-board-grid] [data-square='g7'] img[alt='w b'], [data-board-grid] [data-square='g7'] [data-piece-inline='b']",
      ),
    ).toBeVisible({ timeout: 20_000 });

    // g7 must have punched through fog while MoveAnimation was still on screen.
    const sawWhileWalking = await page.evaluate(() => {
      const w = window as unknown as { __fogWalk?: boolean; __fogTimer?: number };
      window.clearInterval(w.__fogTimer);
      return w.__fogWalk === true;
    });
    expect(sawWhileWalking).toBe(true);
  });
});
