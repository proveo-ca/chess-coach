import { expect, test } from "@playwright/test";

/**
 * Collision races — DualNav demos on starchess Storybook (:6007).
 * Stories: StarChess/Collision (demos/collisionRaces.ts).
 */

const story = (id: string) =>
  `http://127.0.0.1:6007/iframe.html?id=${id}&viewMode=story`;

/** Settled unit only — excludes intent ghosts (`data-intent-dest`). */
const pieceAt = (page: import("@playwright/test").Page, sq: string, alt: string) => {
  const [, type] = alt.split(" ");
  const root = `[data-board-grid] [data-square='${sq}']`;
  return page.locator(
    `${root} img[alt='${alt}'], ${root} [data-piece-inline='${type}']:not([data-intent-dest])`,
  );
};

/** Advance DualNav: Start → Intent → Resolve; wait for intent ghosts to clear. */
const playResolve = async (page: import("@playwright/test").Page) => {
  await page.locator("#storybook-root").click({ position: { x: 24, y: 24 } });
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-board-grid] [data-intent-dest]")).toHaveCount(0, {
    timeout: 20_000,
  });
};

test.describe("StarChess collision races (DualNav demos)", () => {
  test("path block: Re1→e8 discovers pe7 (not skip to re8)", async ({ page }) => {
    await page.goto(
      story("starchess-collision--path-block-discovered-pawn"),
      { waitUntil: "networkidle" },
    );
    await expect(page.locator("[data-board-grid] [data-square]").first()).toBeVisible({
      timeout: 30_000,
    });
    // Start: white rook e1.
    await expect(pieceAt(page, "e1", "w r")).toBeVisible();

    await playResolve(page);

    // Rxe7 — discover pawn; destination black rook survives.
    await expect(pieceAt(page, "e7", "w r")).toBeVisible({ timeout: 15_000 });
    await expect(pieceAt(page, "e8", "b r")).toBeVisible();
    await expect(page.locator("[data-board-grid] [data-square='e7'] img[alt='b p']")).toHaveCount(
      0,
    );
    await expect(pieceAt(page, "e1", "w r")).toHaveCount(0);
  });

  test("ally block: Re1→e8 truncates before ally Pe7", async ({ page }) => {
    await page.goto(story("starchess-collision--ally-block-truncate"), {
      waitUntil: "networkidle",
    });
    await expect(page.locator("[data-board-grid] [data-square]").first()).toBeVisible({
      timeout: 30_000,
    });
    await playResolve(page);

    await expect(pieceAt(page, "e6", "w r")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-board-grid] [data-square='e7'] img[alt='w p']")).toBeVisible();
    await expect(pieceAt(page, "e8", "b r")).toBeVisible();
  });

  test("same square: race — both bishops die, e5 empty", async ({ page }) => {
    await page.goto(story("starchess-collision--same-square-bishops"), {
      waitUntil: "networkidle",
    });
    await expect(page.locator("[data-board-grid] [data-square]").first()).toBeVisible({
      timeout: 30_000,
    });
    await playResolve(page);

    await expect(page.locator("[data-board-grid] [data-square='e5'] img[alt='b b']")).toHaveCount(
      0,
      { timeout: 15_000 },
    );
    await expect(page.locator("[data-board-grid] [data-square='e5'] img[alt='w b']")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-board-grid] [data-square='d4'] img[alt='w b']")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-board-grid] [data-square='b8'] img[alt='b b']")).toHaveCount(
      0,
    );
  });

  test("knight speed: gas flee + race — both die on e4, pawn on e5", async ({ page }) => {
    await page.goto(story("starchess-collision--knight-speed"), {
      waitUntil: "networkidle",
    });
    await expect(page.locator("[data-board-grid] [data-square]").first()).toBeVisible({
      timeout: 30_000,
    });
    await playResolve(page);

    await expect(page.locator("[data-board-grid] [data-square='e5'] img[alt='w p']")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-board-grid] [data-square='e4'] img[alt='b n']")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-board-grid] [data-square='e4'] img[alt='w b']")).toHaveCount(
      0,
    );
  });
});

/**
 * Live single seeds — assert white-visible outcomes only (adjutant may queue black).
 * Knight 1/2/3 distance parity covered in core collisionRaces.test.ts.
 */
test.describe("StarChess collision races (live seed smoke)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => localStorage.clear());
  });

  test("live path-block seed: white rook ends on e7 after End", async ({ page }) => {
    await page.goto(
      `single?scfen=${encodeURIComponent(
        "SCFEN|k3r3/4p3/8/8/8/8/8/K3R3|1|33|P|G:11:11|Q:w:C=e1e8;b:",
      )}`,
    );
    await expect(page.getByTestId("starchess-board-chrome")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId("turn-end").click();
    await expect(
      page.locator(
        "[data-square='e7'] [data-piece-inline='r'], [data-square='e7'] img[alt='w r']",
      ),
    ).toBeVisible({ timeout: 15_000 });
  });
});
