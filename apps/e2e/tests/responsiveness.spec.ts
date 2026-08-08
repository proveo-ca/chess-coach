/**
 * Responsiveness contract — see _spec/apps/ui/responsiveness/rules.md
 *
 * Captures HEAD screenshots into _spec/apps/ui/responsiveness/screenshots/
 * and asserts: no page scroll, board min width, CoachAvatar overlap ≤ 50%,
 * §4 floating advice on Coach, and §4b floating move list on Review /:id.
 */
import { expect, test, type Page, type Locator } from "@playwright/test";
import path from "node:path";

// cwd is apps/e2e when Playwright runs (avoid import.meta.url — Playwright's
// ESM loader hits `require is not defined` with fileURLToPath here).
const SPEC_SHOTS = path.resolve(
  process.cwd(),
  "../../_spec/apps/ui/responsiveness/screenshots",
);

const REVIEW_ID = "spec-shot-review-0001";
/** Mid-game Italian FEN so the board is not startpos and MoveList has real plies. */
const REVIEW_STARTING_FEN =
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
const REVIEW_GAME_A = {
  id: REVIEW_ID,
  startedAt: new Date("2026-04-14").toISOString(),
  endedAt: new Date("2026-04-14").toISOString(),
  result: "win",
  pgn: `[SetUp "1"]
[FEN "${REVIEW_STARTING_FEN}"]

4. d3 Be7 5. O-O O-O 6. h3 d6 7. c3 a6`,
  startingFen: REVIEW_STARTING_FEN,
  playerColor: "w",
  difficulty: "easy",
  opponentName: "Selena",
  moves: [
    { san: "d3", hasPressedHint: false, isAI: false },
    { san: "Be7", hasPressedHint: false, isAI: true },
    { san: "O-O", hasPressedHint: false, isAI: false },
    { san: "O-O", hasPressedHint: false, isAI: true },
    { san: "h3", hasPressedHint: false, isAI: false },
    { san: "d6", hasPressedHint: false, isAI: true },
    { san: "c3", hasPressedHint: false, isAI: false },
    { san: "a6", hasPressedHint: false, isAI: true },
  ],
};
const REVIEW_GAME_B = {
  id: "spec-shot-review-0002",
  startedAt: new Date("2026-04-14T12:00:00").toISOString(),
  endedAt: new Date("2026-04-14T12:30:00").toISOString(),
  result: "loss",
  pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7",
  startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  playerColor: "w",
  difficulty: "medium",
  opponentName: "Selena",
  moves: [
    { san: "e4", hasPressedHint: false, isAI: false },
    { san: "e5", hasPressedHint: false, isAI: true },
    { san: "Nf3", hasPressedHint: false, isAI: false },
    { san: "Nc6", hasPressedHint: false, isAI: true },
    { san: "Bb5", hasPressedHint: false, isAI: false },
    { san: "a6", hasPressedHint: false, isAI: true },
    { san: "Ba4", hasPressedHint: false, isAI: false },
    { san: "Nf6", hasPressedHint: false, isAI: true },
    { san: "O-O", hasPressedHint: false, isAI: false },
    { san: "Be7", hasPressedHint: false, isAI: true },
  ],
};
const REVIEW_GAME_C = {
  id: "spec-shot-review-0003",
  startedAt: new Date("2026-04-14T18:00:00").toISOString(),
  endedAt: new Date("2026-04-14T18:45:00").toISOString(),
  result: "draw",
  pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7",
  startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  playerColor: "w",
  difficulty: "easy",
  opponentName: "Selena",
  moves: [
    { san: "d4", hasPressedHint: false, isAI: false },
    { san: "d5", hasPressedHint: false, isAI: true },
    { san: "c4", hasPressedHint: false, isAI: false },
    { san: "e6", hasPressedHint: false, isAI: true },
    { san: "Nc3", hasPressedHint: false, isAI: false },
    { san: "Nf6", hasPressedHint: false, isAI: true },
    { san: "Bg5", hasPressedHint: false, isAI: false },
    { san: "Be7", hasPressedHint: false, isAI: true },
  ],
};
const REVIEW_FIXTURE = {
  games: [REVIEW_GAME_A, REVIEW_GAME_B, REVIEW_GAME_C],
  inProgress: null,
};

type Profile = {
  name: "desktop" | "mobile" | "dynamic";
  viewport: { width: number; height: number };
};

const PROFILES: Profile[] = [
  { name: "desktop", viewport: { width: 1280, height: 800 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
  // Short height forces the bottom row off-screen → §4 floating chrome.
  { name: "dynamic", viewport: { width: 390, height: 560 } },
];

const SCREENS: { id: string; path: string; hasBoard: boolean; hasAvatar: boolean }[] = [
  // Relative paths resolve against Playwright baseURL (`…/chess/`). Absolute
  // `/selena` etc. hit the Vite origin root and show the "did you mean /chess/…?" page.
  { id: "menu", path: "./", hasBoard: false, hasAvatar: true },
  { id: "coach", path: "selena", hasBoard: true, hasAvatar: true },
  { id: "analysis", path: "analysis", hasBoard: true, hasAvatar: false },
  // History picker — seeded GameHistoryList (no :id).
  { id: "review-list", path: "review", hasBoard: false, hasAvatar: false },
  // Board + MoveList live on /:id — archive ReviewScreen with a seeded mid-game FEN.
  { id: "review", path: `review/${REVIEW_ID}`, hasBoard: true, hasAvatar: false },
  { id: "lan", path: "lan", hasBoard: false, hasAvatar: false },
];

async function seedReviewHistory(page: Page) {
  await page.goto("./");
  await page.evaluate((payload) => {
    localStorage.clear();
    localStorage.setItem("chess_coach_game_history", JSON.stringify(payload));
  }, REVIEW_FIXTURE);
}

async function waitForLiveEngineDepth(page: Page) {
  // Analysis mounts Depth in Sidebar + BoardControls (one may be CSS-hidden).
  const value = page.getByTestId("engine-depth-value").first();
  if ((await page.getByTestId("engine-depth-value").count()) === 0) return;
  await expect(value).toHaveText(/^[1-9]\d*$/, { timeout: 15_000 });
}

async function ready(page: Page, screenPath: string) {
  if (screenPath === "review" || screenPath.startsWith("review/")) {
    await seedReviewHistory(page);
    await page.goto(screenPath);
    if (screenPath === "review") {
      await expect(page.getByText(/Pick a game|vs Selena|Back to Main Menu/i).first()).toBeVisible({
        timeout: 15_000,
      });
      return;
    }
    await expect(page.getByTestId("chessboard")).toBeVisible({ timeout: 20_000 });
    // Review /:id mounts EngineDepth in BoardControls (mobile) — wait for Stockfish.
    await waitForLiveEngineDepth(page);
    return;
  }

  await page.goto(screenPath);
  await page.evaluate(() => localStorage.clear());
  await page.goto(screenPath);
  if (screenPath === "selena" || screenPath === "analysis") {
    await expect(page.getByTestId("chessboard")).toBeVisible({ timeout: 20_000 });
    await page
      .locator('[data-testid="coach-avatar"][data-variant="sleeping"]')
      .waitFor({ state: "detached", timeout: 30_000 })
      .catch(() => undefined);
    if (screenPath === "analysis") await waitForLiveEngineDepth(page);
  } else if (screenPath === "./") {
    await expect(page.getByText("Play with Selena")).toBeVisible({ timeout: 15_000 });
  } else if (screenPath === "lan") {
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(500);
  }
}

function visibleAvatar(page: Page): Locator {
  return page
    .locator(
      '[data-testid="coach-avatar"][data-variant="default"]:visible, [data-testid="coach-avatar"][data-variant="compact"]:visible',
    )
    .first();
}

test.describe("responsiveness contract", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "screenshot archive is chromium-only");

  for (const profile of PROFILES) {
    test.describe(profile.name, () => {
      test.use({ viewport: profile.viewport });

      for (const screen of SCREENS) {
        test(`${screen.id}: screenshot + invariants`, async ({ page }) => {
          await ready(page, screen.path);

          if (profile.name === "dynamic" && screen.id === "coach") {
            await expect(page.locator('[data-testid="screen-root"]')).toHaveAttribute(
              "data-footer-float",
              "true",
              { timeout: 5_000 },
            );
            // §4 float appears instantly when advice is available.
            await expect(page.getByTestId("floating-advice")).toBeVisible({ timeout: 5_000 });
            // Short height keeps compact avatar in the MobileSidebar centre.
            await expect(page.getByTestId("coach-mobile-hero")).toBeHidden();
            await expect(
              page.locator('[data-testid="coach-avatar"][data-variant="compact"]:visible'),
            ).toBeVisible();
            // Short / dynamic: drawer stays in the tool bar (near board chrome).
            {
              const menu = page.getByRole("button", { name: "Open menu" });
              await expect(menu).toBeVisible();
              const pos = await menu.evaluate((el) => {
                const item = el.closest("div");
                return item ? getComputedStyle(item).position : "";
              });
              expect(pos, "dynamic drawer should remain in-bar (not fixed)").not.toBe("fixed");
            }
          }

          if (profile.name === "dynamic" && screen.id === "review") {
            // §4b — short viewport floats the MoveList strip.
            await expect(page.locator('[data-testid="screen-root"]')).toHaveAttribute(
              "data-footer-float",
              "true",
              { timeout: 5_000 },
            );
            await expect(page.getByTestId("floating-move-list")).toBeVisible({ timeout: 5_000 });
          }

          if (profile.name === "mobile" && screen.id === "coach") {
            // Tall phone docks CoachPanel when content + budget fit.
            await expect(page.locator('[data-testid="screen-root"]')).toHaveAttribute(
              "data-footer-float",
              "false",
              { timeout: 5_000 },
            );
            await expect(page.getByTestId("floating-advice")).toHaveCount(0);
            // Hero avatar above the tool bar (not embedded in MobileSidebar).
            await expect(page.getByTestId("coach-mobile-hero")).toBeVisible();
            await expect(
              page.locator('[data-testid="coach-mobile-hero"] [data-testid="coach-avatar"]'),
            ).toHaveAttribute("data-variant", "default");
            await expect(
              page.locator('[data-testid="coach-avatar"][data-variant="compact"]:visible'),
            ).toHaveCount(0);
            // Tall mobile: drawer floats top-left, out of the tool bar.
            {
              const menu = page.getByRole("button", { name: "Open menu" });
              await expect(menu).toBeVisible();
              const info = await menu.evaluate((el) => {
                const item = el.closest("div");
                const cs = item ? getComputedStyle(item) : null;
                const box = el.getBoundingClientRect();
                return {
                  position: cs?.position ?? "",
                  x: box.x,
                  y: box.y,
                };
              });
              expect(info.position, "tall mobile drawer should float").toBe("fixed");
              expect(info.x, "floated drawer should be near left edge").toBeLessThan(48);
              expect(info.y, "floated drawer should be near top edge").toBeLessThan(48);
            }
          }

          if (profile.name === "mobile" && screen.id === "analysis") {
            await expect(page.getByTestId("analysis-title")).toBeVisible();
            const fenLoader = page.locator(".mobile-only").getByTestId("fen-loader");
            await expect(fenLoader.getByTestId("fen-loader-trailing")).toBeVisible();
            await expect(fenLoader.getByTestId("fen-loader-leading")).toBeHidden();
            const load = fenLoader.getByRole("button", { name: "Load" });
            const back = fenLoader.getByTestId("fen-loader-trailing").getByRole("button", {
              name: /Back/,
            });
            const lb = await load.boundingBox();
            const bb = await back.boundingBox();
            expect(lb && bb).toBeTruthy();
            expect(bb!.x, "Back should sit to the right of Load").toBeGreaterThan(lb!.x);
            // Drawer sits in the title toolbar left of “Solo Analysis”, not floated over it.
            const menu = page.getByRole("button", { name: "Open menu" });
            const title = page.getByTestId("analysis-title");
            const mb = await menu.boundingBox();
            const tb = await title.boundingBox();
            expect(mb && tb).toBeTruthy();
            expect(tb!.x, "title should start after the drawer").toBeGreaterThan(mb!.x + mb!.width - 1);

            // Symmetrical chrome gutter: FEN row shares board L/R inset.
            const board = await page.getByTestId("chessboard").boundingBox();
            const fenRow = await fenLoader.boundingBox();
            expect(board && fenRow).toBeTruthy();
            const leftGutter = fenRow!.x - board!.x;
            const rightGutter = board!.x + board!.width - (fenRow!.x + fenRow!.width);
            expect(Math.abs(leftGutter - rightGutter), "FEN row L/R vs board").toBeLessThan(2);
          }

          if (profile.name === "dynamic" && screen.id === "analysis") {
            await expect(page.getByTestId("analysis-title")).toBeHidden();
            const fenLoader = page.locator(".mobile-only").getByTestId("fen-loader");
            await expect(fenLoader.getByTestId("fen-loader-trailing")).toBeVisible();
            await expect(fenLoader.getByTestId("fen-loader-leading")).toBeVisible();
            const menu = fenLoader.getByTestId("fen-loader-leading").getByRole("button", {
              name: "Open menu",
            });
            const fen = fenLoader.getByLabel("Load from FEN");
            const load = fenLoader.getByRole("button", { name: "Load" });
            const back = fenLoader.getByTestId("fen-loader-trailing").getByRole("button", {
              name: /Back/,
            });
            const mb = await menu.boundingBox();
            const fb = await fen.boundingBox();
            const lb = await load.boundingBox();
            const bb = await back.boundingBox();
            expect(mb && fb && lb && bb).toBeTruthy();
            // Menu is in-flow left of the FEN field — not a fixed overlay on top of it.
            const menuPos = await menu.evaluate((el) => {
              const item = el.closest("[data-testid='fen-loader-leading']");
              return item ? getComputedStyle(item).position : "";
            });
            expect(menuPos, "dynamic analysis menu should stay in FenLoader row").not.toBe("fixed");
            expect(mb!.x + mb!.width - 1, "menu should sit left of FEN").toBeLessThanOrEqual(fb!.x + 1);
            expect(Math.abs(mb!.y - fb!.y), "menu and FEN share a row").toBeLessThan(24);
            expect(bb!.x, "Back should sit to the right of Load").toBeGreaterThan(lb!.x);

            // Symmetrical chrome gutter vs the board.
            const board = await page.getByTestId("chessboard").boundingBox();
            const row = await fenLoader.boundingBox();
            expect(board && row).toBeTruthy();
            const leftGutter = row!.x - board!.x;
            const rightGutter = board!.x + board!.width - (row!.x + row!.width);
            expect(Math.abs(leftGutter - rightGutter), "FEN row L/R vs board").toBeLessThan(2);
          }

          if (profile.name === "desktop" && screen.id === "review") {
            // 1280×800 + SidebarInset chrome: docked page would clip → §4b float.
            await expect(page.locator('[data-testid="screen-root"]')).toHaveAttribute(
              "data-footer-float",
              "true",
              { timeout: 5_000 },
            );
            await expect(page.getByTestId("floating-move-list")).toBeVisible({ timeout: 5_000 });
          }

          if (profile.name === "mobile" && screen.id === "review") {
            await expect(page.locator('[data-testid="screen-root"]')).toHaveAttribute(
              "data-footer-float",
              "false",
              { timeout: 5_000 },
            );
            await expect(page.getByTestId("move-list")).toBeVisible({ timeout: 5_000 });
            await expect(page.getByTestId("floating-move-list")).toHaveCount(0);
            // MobileBanner: ‹ Back · matchup · hamburger (menu trailing, not left of title).
            const back = page.getByTestId("mobile-banner-back");
            const menu = page.getByRole("button", { name: "Open menu" });
            const title = page.getByTestId("review-matchup");
            const bb = await back.boundingBox();
            const mb = await menu.boundingBox();
            const tb = await title.boundingBox();
            expect(bb && mb && tb).toBeTruthy();
            expect(tb!.x, "matchup should sit after Back").toBeGreaterThan(bb!.x + bb!.width - 1);
            expect(mb!.x, "menu should sit after matchup").toBeGreaterThan(tb!.x + tb!.width - 1);
          }

          if (screen.hasBoard || screen.id === "coach") {
            const scroll = await page.evaluate(() => ({
              doc: document.documentElement.scrollHeight - document.documentElement.clientHeight,
              body: document.body.scrollHeight - document.body.clientHeight,
            }));
            expect(scroll.doc, "documentElement must not page-scroll").toBeLessThanOrEqual(1);
            expect(scroll.body, "body must not page-scroll").toBeLessThanOrEqual(1);
          }

          if (screen.hasBoard) {
            const board = page.getByTestId("chessboard");
            const box = await board.boundingBox();
            expect(box).toBeTruthy();
            expect(box!.width).toBeGreaterThanOrEqual(profile.name === "desktop" ? 480 : 200);
          }

          if (screen.hasAvatar && screen.hasBoard) {
            const avatar = visibleAvatar(page);
            const board = page.getByTestId("chessboard");
            await expect(avatar).toBeVisible();
            await expect(board).toBeVisible();
            const a = await avatar.boundingBox();
            const b = await board.boundingBox();
            expect(a && b).toBeTruthy();
            const overlapBelowBoardTop = Math.max(0, a!.y + a!.height - b!.y);
            const ratio = overlapBelowBoardTop / a!.height;
            expect(
              ratio,
              `avatar overlap below board top was ${(ratio * 100).toFixed(1)}% (max 50%)`,
            ).toBeLessThanOrEqual(0.5);
          }

          const file = path.join(SPEC_SHOTS, `${profile.name}-${screen.id}.png`);
          await page.screenshot({ path: file, fullPage: false });
        });
      }
    });
  }

  test("dynamic floating advice dismisses on move", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 560 });
    await ready(page, "selena");
    const float = page.getByTestId("floating-advice");
    await expect(float).toBeVisible({ timeout: 5_000 });
    const before = (await float.innerText()).trim();

    await page.locator("[data-square='e2']").click();
    await page.locator("[data-square='e4']").click();

    // §4: human move hides the float and clears dismiss so the *next* coach
    // line can reappear immediately — assert the greeting float was cleared
    // (gone, or replaced by different content), not that advice stays gone.
    await expect
      .poll(async () => {
        const n = await float.count();
        if (n === 0) return "gone";
        return (await float.innerText()).trim();
      }, { timeout: 5_000 })
      .not.toBe(before);
  });
});
