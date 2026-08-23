import { expect, test, type Page } from "@playwright/test";

/**
 * Milestone-turn broadcast — Turn 1 / 11 / 21 pause the planning clock for a
 * 3000ms chat bubble over the middle of the Board announcing the new
 * income/gas/clock tier. The Board stays live; only the resource bar goes
 * inert until dismissal (auto or click-to-skip) — and submits are refused
 * mid-broadcast, so the turn cannot end under the bubble either way.
 */
const START_BOARD =
  "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
/** Raw turn N displays as "Turn N" — seed one before each milestone, End once. */
const boardAt = (turn: number): string => {
  const inc = turn <= 10 ? "1" : turn <= 20 ? "2" : "3";
  return `SCFEN|4k3/8/8/8/8/8/4P3/4K3|${turn}|33|P|G:${inc}${inc}:${inc}${inc}|B:6:6|Q:w:;b:`;
};

const gotoScfen = async (page: Page, scfen: string) => {
  await page.goto(`single?scfen=${encodeURIComponent(scfen)}`);
  await expect(page.getByTestId("starchess-board-chrome")).toBeVisible({ timeout: 20_000 });
};

const bubble = (page: Page) => page.getByTestId("turn-bonus-bubble");
const ring = (page: Page) =>
  page.getByTestId("turn-bar-sidebar").locator("[data-seconds]");

/** The armed clock reads a whole-second value in (0, tierSeconds]. */
const expectRingArmed = (page: Page, tierSeconds: number) =>
  page.waitForFunction(
    (max) => {
      const el = document.querySelector(
        '[data-testid="turn-bar-sidebar"] [data-seconds]',
      );
      const n = Number(el?.getAttribute("data-seconds") ?? 0);
      return n >= 1 && n <= max;
    },
    tierSeconds,
    { timeout: 5_000 },
  );

test.describe("StarChess turn bonus broadcast", () => {
  test("Turn 1 broadcasts on game start and holds the clock", async ({ page }) => {
    await gotoScfen(page, START_BOARD);

    const b = bubble(page);
    await expect(b).toBeVisible();
    const shownAt = Date.now();
    await expect(b).toContainText("Turn 1");
    // Icon-led grant row — semantics live in titles, counts in text.
    await expect(b.locator("[title='Minerals income per turn']")).toHaveText("+1");
    await expect(b.locator("[title='Vespene gas cap this turn']")).toHaveText("+1");
    await expect(b.locator("[title='Planning clock this turn']")).toHaveText("10s");

    // Anchored to the middle of the Board, not the viewport.
    const box = await b.boundingBox();
    const boardBox = await page.getByTestId("starchess-board-chrome").boundingBox();
    if (!box || !boardBox) throw new Error("no bubble/board box");
    expect(Math.abs(box.x + box.width / 2 - (boardBox.x + boardBox.width / 2))).toBeLessThan(40);
    expect(Math.abs(box.y + box.height / 2 - (boardBox.y + boardBox.height / 2))).toBeLessThan(80);

    // Board stays live — squares take their own hits, no overlay in between.
    const squareLive = await page.evaluate(() => {
      const sq = document.querySelector("[data-square='e2']");
      if (!sq) return false;
      const r = sq.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!el?.closest("[data-square]");
    });
    expect(squareLive).toBe(true);

    // Only the resource bar is blocked while the broadcast runs.
    const bar = page.getByTestId("resource-bar");
    await expect(bar).toHaveAttribute("inert", "");

    // Clock not counting during broadcast — nothing armed yet…
    await expect(ring(page)).toHaveAttribute("data-seconds", "0");
    // …and an End click mid-broadcast is refused by the store, not the DOM.
    await page.getByTestId("turn-end").click();
    await expect(b).toBeVisible();
    await expect(ring(page)).toHaveAttribute("data-seconds", "0");

    // Auto-dismiss after ~3000ms; only then does the full tier clock arm.
    await expect(b).toBeHidden({ timeout: 6_000 });
    const elapsed = Date.now() - shownAt;
    expect(elapsed).toBeGreaterThanOrEqual(2_500);
    expect(elapsed).toBeLessThan(5_500);
    await expectRingArmed(page, 10);

    // Resource bar back with it.
    await expect(bar).not.toHaveAttribute("inert");
  });

  for (const { seed, turn, grant, seconds } of [
    { seed: 10, turn: 11, grant: "+2 Minerals +2 Gas", seconds: "15" },
    { seed: 20, turn: 21, grant: "+3 Minerals +3 Gas", seconds: "22" },
  ] as const) {
    test(`End into Turn ${turn} clicks through the ${grant} ${seconds}s broadcast`, async ({
      page,
    }) => {
      await gotoScfen(page, boardAt(seed));
      // Seeded below the milestone — no broadcast yet.
      await expect(bubble(page)).toHaveCount(0);
      await expect(ring(page)).not.toHaveAttribute("data-seconds", "0");

      await page.getByTestId("turn-end").click();

      // Resolve plays out, then the milestone pauses the next planning window.
      const b = bubble(page);
      await expect(b).toBeVisible({ timeout: 30_000 });
      await expect(b).toContainText(`Turn ${turn}`);
      const minerals = grant.split(" ")[0]; // "+2" / "+3"
      await expect(
        b.locator("[title='Minerals income per turn']"),
      ).toHaveText(minerals);
      await expect(
        b.locator("[title='Planning clock this turn']"),
      ).toHaveText(`${seconds}s`);
      await expect(page.getByTestId("resource-bar")).toHaveAttribute("inert", "");

      // Click-to-skip — dismiss well inside the 3000ms window.
      await b.click();
      await expect(b).toBeHidden({ timeout: 1_000 });

      // The skipped window arms at the full new tier duration.
      await expectRingArmed(page, Number(seconds));
      await expect(page.getByTestId("resource-bar")).not.toHaveAttribute("inert");

      // Income tier landed in the resource bar readout.
      await expect(page.getByTestId("resource-bar")).toHaveAttribute(
        "data-turn",
        String(turn),
        { timeout: 5_000 },
      );
    });
  }
});
