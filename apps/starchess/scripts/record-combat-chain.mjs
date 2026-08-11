/**
 * Record StarChess Combat Chain DualNav walkthrough → webm, then ffmpeg → mp4.
 *
 * Usage:
 *   node scripts/record-combat-chain.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync, readdirSync, renameSync, rmSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("/app/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core");

const CHROME =
  process.env.CHROME_PATH ||
  "/proveo-home/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome";
const FFMPEG = process.env.FFMPEG || "/proveo-home/.local/bin/ffmpeg";
const OUT_DIR = process.env.OUT_DIR || "/tmp/combat-chain-recording";
const ARTIFACT_DIR = "/app/apps/starchess/artifacts";
const STORY_URL =
  process.env.STORY_URL ||
  "http://127.0.0.1:6007/iframe.html?id=starchess-demo--combat-chain&viewMode=story";

/** Combat chain: 3 turns × (intent + resolve) = 6 forwards from start. */
const FORWARDS = 6;
const INTENT_WAIT_MS = 700;
/** Extra settle after resolve completes (board snap + DualNav re-enable). */
const POST_RESOLVE_MS = 450;

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(ARTIFACT_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});

const context = await browser.newContext({
  viewport: { width: 720, height: 820 },
  deviceScaleFactor: 2,
  recordVideo: { dir: OUT_DIR, size: { width: 720, height: 820 } },
});

const page = await context.newPage();
page.setDefaultTimeout(60_000);
page.on("pageerror", (e) => console.error("PAGEERROR", e.message));

const waitEnabled = async (btn, label) => {
  for (let t = 0; t < 80; t++) {
    if (await btn.isEnabled()) return true;
    await page.waitForTimeout(150);
  }
  console.warn("still disabled:", label);
  return false;
};

/** Playing disables both DualNav halves; ready re-enables Back (even on final turn). */
const waitResolveIdle = async (label) => {
  try {
    await page.waitForFunction(
      () => {
        const back = document.querySelector('button[aria-label="Go back"]');
        if (!back || back.disabled) return false;
        const root = document.querySelector("[data-starchess-combat-root]");
        if (!root) return true;
        return !root.querySelector(
          "[data-move-id], [data-attack-id], [data-death-id], [data-deploy-id]",
        );
      },
      { timeout: 20_000 },
    );
    return true;
  } catch {
    console.warn("resolve idle timeout:", label);
    return false;
  }
};

console.log("goto", STORY_URL);
await page.goto(STORY_URL, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="chessboard"], [data-board-grid]', {
  timeout: 60_000,
});
await page.waitForSelector('button[aria-label="Go forward"]', { timeout: 30_000 });
await page.waitForTimeout(900);

for (let i = 0; i < FORWARDS; i++) {
  const btn = page.locator('button[aria-label="Go forward"]');
  await btn.waitFor({ state: "visible" });
  if (!(await waitEnabled(btn, `pre-${i}`))) break;
  console.log("forward", i + 1, "/", FORWARDS);
  await btn.click();
  const isResolve = i % 2 === 1;
  if (isResolve) {
    await waitResolveIdle(`post-resolve-${i}`);
    await page.waitForTimeout(POST_RESOLVE_MS);
  } else {
    await page.waitForTimeout(INTENT_WAIT_MS);
  }
}

await page.waitForTimeout(800);
await context.close();
await browser.close();

const webms = readdirSync(OUT_DIR).filter((f) => f.endsWith(".webm"));
if (!webms.length) {
  console.error("No webm recorded in", OUT_DIR);
  process.exit(1);
}
const webm = path.join(OUT_DIR, webms[0]);
const mp4 = path.join(OUT_DIR, "combat-chain.mp4");
const finalWebm = path.join(OUT_DIR, "combat-chain.webm");
if (webm !== finalWebm) renameSync(webm, finalWebm);

console.log("ffmpeg encode", finalWebm, "→", mp4);
const ff = spawnSync(
  FFMPEG,
  [
    "-y",
    "-i",
    finalWebm,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    mp4,
  ],
  { encoding: "utf8" },
);
if (ff.status !== 0) {
  console.error(ff.stderr);
  process.exit(ff.status ?? 1);
}

// Publish into repo artifacts for review.
copyFileSync(mp4, path.join(ARTIFACT_DIR, "combat-chain.mp4"));
copyFileSync(finalWebm, path.join(ARTIFACT_DIR, "combat-chain.webm"));
console.log("OK", mp4);
console.log("OK", path.join(ARTIFACT_DIR, "combat-chain.mp4"));
