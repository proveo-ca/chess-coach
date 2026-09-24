/**
 * Capture a README hero GIF from a live Playwright flow.
 *
 * Scenes (same recording):
 *   1. Coach — Play with Selena, e4, AI reply, Hint
 *   2. Review — fixture from apps/e2e/tests/review/review.spec.ts (annotated MoveList)
 *
 * Volatile on purpose — regenerate whenever the UI chrome drifts:
 *
 *   cd apps/chess && npm run dev:web-no-llm:vite
 *   cd apps/e2e && npm run capture:hero
 *
 * Requires ffmpeg on PATH (or set FFMPEG / FFMPEG_PATH).
 */
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT_DIR = path.join(ROOT, "docs");
const WORK = path.join(ROOT, "apps/e2e/.hero-capture");
const WEBMS = path.join(WORK, "video");
const GIF = path.join(OUT_DIR, "hero.gif");
const BASE = process.env.BASE_URL ?? "http://localhost:5173/chess";
const SLOW_MO = Number(process.env.HERO_SLOW_MO ?? 200);

/** Same fixture as apps/e2e/tests/review/review.spec.ts — annotated MoveList hero beat. */
const REVIEW_FIXTURE_ID = "test-review-fixture-0001";
const REVIEW_FIXTURE = {
  games: [
    {
      id: REVIEW_FIXTURE_ID,
      startedAt: new Date("2026-04-14").toISOString(),
      endedAt: new Date("2026-04-14").toISOString(),
      result: "win",
      pgn: "1. e4 e5 2. d4 d5 3. Nf3 Nc6",
      startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      playerColor: "w",
      difficulty: "easy",
      moves: [
        { san: "e4", hasPressedHint: true, isAI: false },
        { san: "e5", hasPressedHint: false, isAI: true },
        { san: "d4", hasPressedHint: false, isAI: false },
        { san: "d5", hasPressedHint: false, isAI: true },
        { san: "Nf3", hasPressedHint: false, isAI: false },
        { san: "Nc6", hasPressedHint: false, isAI: true },
      ],
    },
  ],
  inProgress: null,
};

const CHROME =
  process.env.CHROME_PATH ??
  process.env.PLAYWRIGHT_CHROME ??
  [
    path.join(
      process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/ms-playwright",
      "chromium-1228/chrome-linux64/chrome",
    ),
    path.join(
      process.env.PLAYWRIGHT_BROWSERS_PATH ?? `${process.env.HOME}/.cache/ms-playwright`,
      "chromium-1217/chrome-linux64/chrome",
    ),
    "/tmp/pw-browsers/chrome/linux-150.0.7871.115/chrome-linux64/chrome",
  ].find((p) => fs.existsSync(p));
const FFMPEG =
  process.env.FFMPEG_PATH ??
  process.env.FFMPEG ??
  ["ffmpeg", "/tmp/ffmpeg-bin/extracted/ffmpeg-7.0.2-amd64-static/ffmpeg"].find((p) => {
    if (p === "ffmpeg") {
      const r = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
      return r.status === 0;
    }
    return fs.existsSync(p);
  });

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (!CHROME || !fs.existsSync(CHROME)) {
  die("No Chrome binary found. Set CHROME_PATH or PLAYWRIGHT_BROWSERS_PATH.");
}
if (!FFMPEG) {
  die("No ffmpeg found. Install ffmpeg or set FFMPEG_PATH.");
}

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WEBMS, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  slowMo: SLOW_MO,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  colorScheme: "dark",
  recordVideo: { dir: WEBMS, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

async function sceneCoach() {
  await page.goto(`${BASE}/`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/`);
  await page.getByText("Play with Selena").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByText("Play with Selena").click();
  await page.waitForURL(/\/selena/);
  await page.locator("[data-square='e2'] img").waitFor({ state: "visible", timeout: 20_000 });
  await page
    .locator('[data-testid="coach-avatar"][data-variant="sleeping"]')
    .waitFor({ state: "detached", timeout: 30_000 })
    .catch(() => {});

  // Opening move — pawn push that triggers Selena + coach advice.
  await page.locator("[data-square='e2']").click();
  const e4 = page.locator("[data-square='e4']");
  await e4.waitFor({ state: "visible", timeout: 5_000 });
  await e4.click();
  await e4.locator("img").waitFor({ state: "visible", timeout: 5_000 });

  await page
    .locator(":is([data-square$='5'], [data-square$='6']) img[alt^='b']")
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1200);

  const hint = page.getByRole("button", { name: /hint/i }).first();
  if (await hint.count()) {
    await hint.click();
    await page.waitForTimeout(1600);
  }
  await page.waitForTimeout(800);
}

/** Mirrors review.spec.ts — "loads a saved game and renders annotated move list". */
async function sceneReview() {
  await page.goto(`${BASE}/`);
  await page.evaluate((payload) => {
    localStorage.clear();
    localStorage.setItem("chess_coach_game_history", JSON.stringify(payload));
  }, REVIEW_FIXTURE);

  await page.goto(`${BASE}/review/${REVIEW_FIXTURE_ID}`);
  await page.waitForURL(/\/review\/test-review-fixture-0001/);

  const moveList = page.getByLabel("Move list");
  await moveList.waitFor({ state: "visible", timeout: 15_000 });
  await moveList.getByText("1.").waitFor({ state: "visible", timeout: 5_000 });
  await page.waitForTimeout(900);

  // Scrub through annotated plies (hint badge on e4, then Nf3 / Nc6 jumps).
  await moveList.locator("[data-ply='0']").click();
  await page.waitForTimeout(700);
  await moveList.locator("[data-ply='2']").click();
  await page.waitForTimeout(700);
  await moveList.locator("[data-ply='4']").click();
  await page.locator("[data-square='f3'] img[alt='w n']").waitFor({ state: "visible", timeout: 5_000 });
  await page.waitForTimeout(900);
  await moveList.locator("[data-ply='5']").click();
  await page.locator("[data-square='c6'] img[alt='b n']").waitFor({ state: "visible", timeout: 5_000 });
  await page.waitForTimeout(1200);
}

try {
  await sceneCoach();
  await sceneReview();
} finally {
  await context.close();
  await browser.close();
}

const webm = fs.readdirSync(WEBMS).find((f) => f.endsWith(".webm"));
if (!webm) die(`No .webm recorded under ${WEBMS}`);
const webmPath = path.join(WEBMS, webm);

const palette = path.join(WORK, "palette.png");
const scale = "fps=12,scale=960:-1:flags=lanczos";
let r = spawnSync(
  FFMPEG,
  ["-y", "-i", webmPath, "-vf", `${scale},palettegen=stats_mode=diff`, palette],
  { encoding: "utf8" },
);
if (r.status !== 0) die(`palettegen failed:\n${r.stderr || r.stdout}`);
r = spawnSync(
  FFMPEG,
  [
    "-y",
    "-i",
    webmPath,
    "-i",
    palette,
    "-lavfi",
    `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    "-loop",
    "0",
    GIF,
  ],
  { encoding: "utf8" },
);
if (r.status !== 0) die(`paletteuse failed:\n${r.stderr || r.stdout}`);

const kb = Math.round(fs.statSync(GIF).size / 1024);
console.log(`OK ${path.relative(ROOT, GIF)} (${kb} KiB) from ${webm} @ slowMo=${SLOW_MO}`);
