import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Review /:id §4 floating move list on short (dynamic) viewports.
 * See _spec/apps/ui/responsiveness/rules.md §4b.
 */
const FIXTURE_ID = "test-review-float-0001";
const FIXTURE_PGN = "1. e4 e5 2. d4 d5 3. Nf3 Nc6 4. Bb5 a6 5. Ba4 Nf6";
const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Mid-game FEN (Italian after …Nf6) — exercises ReviewScreen.loadGame(startingFen). */
const STORED_MIDGAME_ID = "test-review-float-fen-0002";
const STORED_MIDGAME_FEN =
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
// PGN must carry FEN/SetUp — chess.js loadPgn resets without them. Moves are legal from that FEN.
const STORED_MIDGAME_PGN = `[SetUp "1"]
[FEN "${STORED_MIDGAME_FEN}"]

4. d3 Be7 5. O-O`;

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
        { san: "Bb5", hasPressedHint: false, isAI: false },
        { san: "a6", hasPressedHint: false, isAI: true },
        { san: "Ba4", hasPressedHint: false, isAI: false },
        { san: "Nf6", hasPressedHint: false, isAI: true },
      ],
    },
  ],
  inProgress: null,
};

const midgameFixture = {
  games: [
    {
      id: STORED_MIDGAME_ID,
      startedAt: new Date("2026-04-15").toISOString(),
      endedAt: new Date("2026-04-15").toISOString(),
      result: "win",
      pgn: STORED_MIDGAME_PGN,
      startingFen: STORED_MIDGAME_FEN,
      playerColor: "w" as const,
      difficulty: "easy",
      opponentName: "Selena",
      moves: [
        { san: "d3", hasPressedHint: false, isAI: false },
        { san: "Be7", hasPressedHint: false, isAI: true },
        { san: "O-O", hasPressedHint: false, isAI: false },
      ],
    },
  ],
  inProgress: null,
};

async function seedAndOpen(
  page: Page,
  payload: typeof fixture | typeof midgameFixture = fixture,
  id: string = FIXTURE_ID,
) {
  await page.goto("/");
  await page.evaluate((data) => {
    localStorage.clear();
    localStorage.setItem("chess_coach_game_history", JSON.stringify(data));
  }, payload);
  await page.goto(`review/${id}`);
  await expect(page).toHaveURL(new RegExp(`/review/${id}`));
  await expect(page.getByTestId("chessboard")).toBeVisible({ timeout: 20_000 });
}

test.describe("Review /:id floating move list (dynamic)", () => {
  test.use({ viewport: { width: 480, height: 480 } });

  test("floats MoveList when Review renders a stored mid-game FEN", async ({ page }) => {
    await seedAndOpen(page, midgameFixture, STORED_MIDGAME_ID);

    // loadGame parks at ply 0 → board shows the stored startingFen (Italian …Nf6).
    await expect(page.locator("[data-square='c4']").locator("img[alt='w b']")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator("[data-square='f6']").locator("img[alt='b n']")).toBeVisible();
    await expect(page.locator("[data-square='f3']").locator("img[alt='w n']")).toBeVisible();

    await expect(page.locator('[data-testid="screen-root"]')).toHaveAttribute(
      "data-footer-float",
      "true",
      { timeout: 5_000 },
    );
    const float = page.getByTestId("floating-move-list");
    await expect(float).toBeVisible({ timeout: 5_000 });
    // Post-FEN plies show in the float strip (turn indices restart at 1 from pairMovesIntoRows).
    const strip = page.getByTestId("floating-move-strip");
    await expect(strip.getByText("d3", { exact: true })).toBeVisible();
    await expect(strip.getByText("Be7", { exact: true })).toBeVisible();
  });

  test("floats a 3-turn strip; dismiss × / play-move; reappear on nav", async ({ page }) => {
    await seedAndOpen(page);

    await expect(page.locator('[data-testid="screen-root"]')).toHaveAttribute(
      "data-footer-float",
      "true",
      { timeout: 5_000 },
    );

    const float = page.getByTestId("floating-move-list");
    await expect(float).toBeVisible({ timeout: 5_000 });

    const strip = page.getByTestId("floating-move-strip");
    await expect(strip.locator("[data-turn]")).toHaveCount(3);
    // loadGame parks at the start → first three turns
    await expect(strip.locator("[data-turn='1']")).toBeVisible();
    await expect(strip.locator("[data-turn='2']")).toBeVisible();
    await expect(strip.locator("[data-turn='3']")).toBeVisible();

    // Dismiss via ×
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(float).toHaveCount(0);

    // History nav brings it back and scrolls the window forward
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("floating-move-list")).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    // Scrubbed later → window should include turn 4+
    await expect(page.getByTestId("floating-move-strip").locator("[data-turn='4']")).toBeVisible();
  });

  test("floating strip shows readable cp Δ and coach emotion (player plies)", async ({ page }) => {
    await seedAndOpen(page);

    const strip = page.getByTestId("floating-move-strip");
    await expect(strip).toBeVisible({ timeout: 5_000 });

    // Analysis must land — cp for the human colour (White in this fixture).
    const cp = strip.getByTestId("ply-cp").first();
    await expect(cp).toBeVisible({ timeout: 30_000 });
    await expect(cp).toHaveText(/^(?:[+-]?\d+|M[+-])$/);

    const cpBox = await cp.boundingBox();
    expect(cpBox, "cp Δ must paint a real box").toBeTruthy();
    expect(cpBox!.width, "cp Δ too narrow to read").toBeGreaterThanOrEqual(10);
    expect(cpBox!.height, "cp Δ too short to read").toBeGreaterThanOrEqual(11);

    // Emotion / annotation icon on at least one tagged player ply.
    const emotion = strip.getByTestId("ply-tags").locator("[role='img']").first();
    await expect(emotion).toBeVisible({ timeout: 15_000 });
    const emoBox = await emotion.boundingBox();
    expect(emoBox, "coach emotion must paint a real box").toBeTruthy();
    expect(emoBox!.width).toBeGreaterThanOrEqual(12);
    expect(emoBox!.height).toBeGreaterThanOrEqual(12);

    // Still inside the floating panel (not clipped away / off-screen).
    const panel = await page.getByTestId("floating-move-list").boundingBox();
    expect(panel).toBeTruthy();
    expect(cpBox!.y + cpBox!.height).toBeLessThanOrEqual(panel!.y + panel!.height + 1);
    expect(emoBox!.y + emoBox!.height).toBeLessThanOrEqual(panel!.y + panel!.height + 1);
  });

  test("playing a move dismisses; history nav restores the float", async ({ page }) => {
    await seedAndOpen(page);

    const float = page.getByTestId("floating-move-list");
    await expect(float).toBeVisible({ timeout: 5_000 });

    // loadGame starts at ply 0 — step to the tip so white to move after …Nf6
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");

    await page.locator("[data-square='c2']").click();
    await page.locator("[data-square='c3']").click();
    await expect(page.locator(".highlight")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("floating-move-list")).toHaveCount(0);

    await page.getByRole("button", { name: "Go back" }).click();
    await expect(page.getByTestId("floating-move-list")).toBeVisible({ timeout: 3_000 });
  });

  test("phone-height Review floats instead of painting a clipped docked list", async ({
    page,
  }) => {
    // Matches a typical phone viewport where a docked multi-row MoveList would
    // overlap the board (see product screenshot) — must use the §4b strip.
    await page.setViewportSize({ width: 390, height: 780 });
    await seedAndOpen(page);

    await expect(page.locator('[data-testid="screen-root"]')).toHaveAttribute(
      "data-footer-float",
      "true",
      { timeout: 5_000 },
    );
    await expect(page.getByTestId("floating-move-list")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("floating-move-strip")).toBeVisible();
    // Horizontal strip — not the docked multi-row paginator.
    await expect(page.getByTestId("floating-move-list").getByText(/^\d+\/\d+$/)).toHaveCount(0);
  });

  test("taller mobile keeps docked move list when footer fits", async ({ page }) => {
    // Tall enough that top + middle + full MoveList page budget still fits.
    await page.setViewportSize({ width: 390, height: 1200 });
    await seedAndOpen(page);

    await expect(page.locator('[data-testid="screen-root"]')).toHaveAttribute(
      "data-footer-float",
      "false",
      { timeout: 5_000 },
    );
    await expect(page.getByTestId("move-list")).toBeVisible();
    await expect(page.getByTestId("floating-move-list")).toHaveCount(0);
  });

  test("docked mobile MoveList shows cp Δ on every player ply + emotion tags", async ({
    page,
  }) => {
    // Phone portrait — §4b docks when height fits (390×844).
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAndOpen(page);

    const list = page.getByTestId("move-list");
    await expect(list).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("floating-move-list")).toHaveCount(0);

    await expect(list).toHaveAttribute("data-analysis-loading", "false", { timeout: 60_000 });

    // Fixture: 5 White plies (e4, d4, Nf3, Bb5, Ba4) — each must expose ply-cp.
    const cps = list.getByTestId("ply-cp");
    await expect(cps).toHaveCount(5, { timeout: 10_000 });
    for (let i = 0; i < 5; i++) {
      const cp = cps.nth(i);
      await expect(cp).toBeVisible();
      await expect(cp).toHaveText(/^(?:[+-]?\d+|M[+-])$/);
      const box = await cp.boundingBox();
      expect(box?.width ?? 0, `cp[${i}] width`).toBeGreaterThanOrEqual(8);
      expect(box?.height ?? 0, `cp[${i}] height`).toBeGreaterThanOrEqual(10);
    }

    // At least one coach emotion / annotation icon among player plies.
    const emotion = list.getByTestId("ply-tags").locator("[role='img']").first();
    await expect(emotion).toBeVisible({ timeout: 5_000 });
    const emoBox = await emotion.boundingBox();
    expect(emoBox?.width ?? 0).toBeGreaterThanOrEqual(12);
    expect(emoBox?.height ?? 0).toBeGreaterThanOrEqual(12);
  });

  test("light theme keeps cp Δ + emotion readable on the surface", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAndOpen(page);

    const list = page.getByTestId("move-list");
    await expect(list).toHaveAttribute("data-analysis-loading", "false", { timeout: 60_000 });
    const cp = list.getByTestId("ply-cp").first();
    await expect(cp).toBeVisible();

    const contrast = await cp.evaluate((el) => {
      const cs = getComputedStyle(el);
      const wrap = el.closest('[data-testid="move-list"]');
      const bg = wrap ? getComputedStyle(wrap).backgroundColor : "rgb(255,255,255)";
      const parse = (c: string) => {
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
      };
      const [fr, fg, fb] = parse(cs.color);
      const [br, bg_, bb] = parse(bg);
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const L = (r: number, g: number, b: number) =>
        0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const L1 = L(fr, fg, fb);
      const L2 = L(br, bg_, bb);
      const lighter = Math.max(L1, L2);
      const darker = Math.min(L1, L2);
      return {
        ratio: (lighter + 0.05) / (darker + 0.05),
        color: cs.color,
        opacity: cs.opacity,
        bg,
      };
    });

    expect(Number(contrast.opacity), "cp must not be washed out").toBe(1);
    expect(contrast.ratio, `cp contrast ${contrast.color} on ${contrast.bg}`).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
