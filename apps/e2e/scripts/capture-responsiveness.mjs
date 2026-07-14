/**
 * One-shot HEAD screenshot capture for _spec/apps/ui/responsiveness/screenshots/.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "_spec/apps/ui/responsiveness/screenshots");
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5173/chess";
const CHROME =
  process.env.CHROME_PATH ??
  process.env.PLAYWRIGHT_CHROME ??
  [
    path.join(
      process.env.PLAYWRIGHT_BROWSERS_PATH ?? `${process.env.HOME}/.cache/ms-playwright`,
      "chromium-1217/chrome-linux64/chrome",
    ),
    "/tmp/pw-browsers/chrome/linux-150.0.7871.115/chrome-linux64/chrome",
  ].find((p) => fs.existsSync(p));

const REVIEW_ID = "spec-shot-review-0001";
/** Mid-game Italian FEN so the board is not startpos and MoveList has real plies. */
const REVIEW_STARTING_FEN =
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
const REVIEW_FIXTURE = {
  games: [
    {
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
    },
    {
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
    },
    {
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
    },
  ],
  inProgress: null,
};

const PROFILES = [
  { name: "desktop", viewport: { width: 1280, height: 800 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
  { name: "dynamic", viewport: { width: 390, height: 560 } },
];

const SCREENS = [
  { id: "menu", path: "/", hasBoard: false, hasAvatar: true },
  { id: "coach", path: "/selena", hasBoard: true, hasAvatar: true },
  { id: "analysis", path: "/analysis", hasBoard: true, hasAvatar: false },
  { id: "review-list", path: "/review", hasBoard: false, hasAvatar: false },
  { id: "review", path: `/review/${REVIEW_ID}`, hasBoard: true, hasAvatar: false },
  { id: "lan", path: "/lan", hasBoard: false, hasAvatar: false },
];

async function seedReview(page) {
  await page.goto(`${BASE}/`);
  await page.evaluate((payload) => {
    localStorage.clear();
    localStorage.setItem("chess_coach_game_history", JSON.stringify(payload));
  }, REVIEW_FIXTURE);
}

async function waitForLiveEngineDepth(page) {
  const all = page.getByTestId("engine-depth-value");
  if ((await all.count()) === 0) return;
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="engine-depth-value"]');
      return !!el && /^[1-9]\d*$/.test((el.textContent || "").trim());
    },
    null,
    { timeout: 15_000 },
  );
}

async function ready(page, screenPath) {
  if (screenPath === "/review" || screenPath.startsWith("/review/")) {
    await seedReview(page);
    await page.goto(`${BASE}${screenPath}`);
    if (screenPath === "/review") {
      await page.getByText(/Pick a game|vs Selena|Back to Main Menu/i).first().waitFor({
        state: "visible",
        timeout: 15_000,
      });
      return;
    }
    await page.getByTestId("chessboard").waitFor({ state: "visible", timeout: 20_000 });
    await waitForLiveEngineDepth(page);
    return;
  }

  await page.goto(`${BASE}${screenPath}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}${screenPath}`);
  if (screenPath === "/selena" || screenPath === "/analysis") {
    await page.getByTestId("chessboard").waitFor({ state: "visible", timeout: 20_000 });
    await page
      .locator('[data-testid="coach-avatar"][data-variant="sleeping"]')
      .waitFor({ state: "detached", timeout: 30_000 })
      .catch(() => {});
    if (screenPath === "/analysis") await waitForLiveEngineDepth(page);
  } else if (screenPath === "/") {
    await page.getByText("Play with Selena").waitFor({ state: "visible", timeout: 15_000 });
  } else {
    await page.waitForTimeout(800);
  }
}

function liveAvatar(page) {
  return page
    .locator(
      '[data-testid="coach-avatar"][data-variant="default"]:visible, [data-testid="coach-avatar"][data-variant="compact"]:visible',
    )
    .first();
}

fs.mkdirSync(OUT, { recursive: true });

if (!CHROME || !fs.existsSync(CHROME)) {
  console.error("No Chrome binary found. Set CHROME_PATH or PLAYWRIGHT_BROWSERS_PATH.");
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = [];

for (const profile of PROFILES) {
  for (const screen of SCREENS) {
    const page = await browser.newPage({ viewport: profile.viewport, colorScheme: "dark" });
    try {
      await ready(page, screen.path);

      if (profile.name === "dynamic" && screen.id === "coach") {
        await page
          .locator('[data-testid="screen-root"][data-footer-float="true"]')
          .waitFor({ state: "attached", timeout: 5_000 });
        await page.getByTestId("floating-advice").waitFor({ state: "visible", timeout: 5_000 });
      }

      if (profile.name === "dynamic" && screen.id === "review") {
        await page
          .locator('[data-testid="screen-root"][data-footer-float="true"]')
          .waitFor({ state: "attached", timeout: 5_000 });
        await page.getByTestId("floating-move-list").waitFor({ state: "visible", timeout: 5_000 });
        // Wait until Stockfish finishes so cp / emotion are painted (not just the first ply).
        await page
          .locator('[data-testid="floating-move-list"][data-analysis-loading="false"]')
          .waitFor({ state: "attached", timeout: 60_000 });
        await page
          .locator('[data-testid="floating-move-strip"] [data-testid="ply-cp"]')
          .first()
          .waitFor({ state: "visible", timeout: 5_000 });
      }

      if (profile.name === "desktop" && screen.id === "review") {
        await page
          .locator('[data-testid="screen-root"][data-footer-float="true"]')
          .waitFor({ state: "attached", timeout: 5_000 });
        await page.getByTestId("floating-move-list").waitFor({ state: "visible", timeout: 5_000 });
        await page
          .locator('[data-testid="floating-move-list"][data-analysis-loading="false"]')
          .waitFor({ state: "attached", timeout: 60_000 });
        await page
          .locator('[data-testid="floating-move-strip"] [data-testid="ply-cp"]')
          .first()
          .waitFor({ state: "visible", timeout: 5_000 });
      }

      if (profile.name === "mobile" && screen.id === "review") {
        await page
          .locator('[data-testid="screen-root"][data-footer-float="false"]')
          .waitFor({ state: "attached", timeout: 5_000 });
        await page.getByTestId("move-list").waitFor({ state: "visible", timeout: 5_000 });
        await page
          .locator('[data-testid="move-list"][data-analysis-loading="false"]')
          .waitFor({ state: "attached", timeout: 60_000 });
        // Italian mid-game fixture: 4 White plies — all must show cp Δ when docked.
        await page.waitForFunction(
          () =>
            document.querySelectorAll('[data-testid="move-list"] [data-testid="ply-cp"]').length >=
            4,
          { timeout: 10_000 },
        );
      }

      if (screen.hasBoard) {
        const scroll = await page.evaluate(() => ({
          doc: document.documentElement.scrollHeight - document.documentElement.clientHeight,
          body: document.body.scrollHeight - document.body.clientHeight,
        }));
        if (scroll.doc > 1 || scroll.body > 1) {
          results.push(
            `WARN ${profile.name}/${screen.id}: page scroll doc=${scroll.doc} body=${scroll.body}`,
          );
        }
        const box = await page.getByTestId("chessboard").boundingBox();
        if (!box || box.width < (profile.name === "desktop" ? 480 : 200)) {
          results.push(`FAIL ${profile.name}/${screen.id}: board width ${box?.width}`);
        }
      }

      if (screen.hasAvatar && screen.hasBoard) {
        const a = await liveAvatar(page).boundingBox();
        const b = await page.getByTestId("chessboard").boundingBox();
        if (a && b) {
          const overlap = Math.max(0, a.y + a.height - b.y);
          const ratio = overlap / a.height;
          results.push(
            `${ratio <= 0.5 ? "OK" : "FAIL"} ${profile.name}/${screen.id}: avatar overlap ${(ratio * 100).toFixed(1)}%`,
          );
        } else {
          results.push(`WARN ${profile.name}/${screen.id}: missing avatar/board boxes`);
        }
      }

      if (profile.name === "dynamic" && screen.id === "coach") {
        const floated = await page.getByTestId("floating-advice").count();
        results.push(
          floated > 0
            ? `OK dynamic/coach: floating-advice visible`
            : `FAIL dynamic/coach: floating-advice missing`,
        );
      }

      if (profile.name === "dynamic" && screen.id === "review") {
        const floated = await page.getByTestId("floating-move-list").count();
        results.push(
          floated > 0
            ? `OK dynamic/review: floating-move-list visible`
            : `FAIL dynamic/review: floating-move-list missing`,
        );
      }

      if (profile.name === "desktop" && screen.id === "review") {
        const floated = await page.getByTestId("floating-move-list").count();
        results.push(
          floated > 0
            ? `OK desktop/review: floating-move-list visible`
            : `FAIL desktop/review: floating-move-list missing`,
        );
      }

      if (profile.name === "mobile" && screen.id === "review") {
        const floated = await page.getByTestId("floating-move-list").count();
        const docked = await page.getByTestId("move-list").count();
        results.push(
          floated === 0 && docked > 0
            ? `OK mobile/review: docked move-list`
            : `FAIL mobile/review: expected docked list (float=${floated} docked=${docked})`,
        );
      }

      const file = path.join(OUT, `${profile.name}-${screen.id}.png`);
      await page.screenshot({ path: file, fullPage: false });
      results.push(`SHOT ${path.relative(ROOT, file)}`);
    } catch (err) {
      results.push(`ERROR ${profile.name}/${screen.id}: ${err.message}`);
    } finally {
      await page.close();
    }
  }
}

await browser.close();
console.log(results.join("\n"));
