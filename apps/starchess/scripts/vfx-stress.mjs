/**
 * Dev-only VFX stress probe — frame stats for heavy animation paths at a
 * mobile viewport. Tracks JS/CSS cost run-over-run; headless software
 * rendering is a trend signal, not a device benchmark.
 *
 * Usage:
 *   pnpm --filter @chess-coach/starchess storybook &  # :6007
 *   node scripts/vfx-stress.mjs [--story <id>] [--viewport WxH] [--desktop]
 *        [--turns N] [--out path] [--headed]
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const require = createRequire(
  new URL("../../e2e/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");

const args = new Map();
const raw = process.argv.slice(2);
for (let i = 0; i < raw.length; i += 1) {
  const part = raw[i];
  if (!part.startsWith("--")) continue;
  const eq = part.indexOf("=");
  if (eq >= 0) {
    args.set(part.slice(2, eq), part.slice(eq + 1));
  } else if (raw[i + 1] && !raw[i + 1].startsWith("--")) {
    args.set(part.slice(2), raw[i + 1]);
    i += 1;
  } else {
    args.set(part.slice(2), true);
  }
}

const desktop = args.has("desktop");
const [vw, vh] = String(
  args.get("viewport") ?? (desktop ? "1280x800" : "390x844"),
)
  .split("x")
  .map(Number);
const STORY =
  args.get("story") ?? "starchess-demo--combat-chain";
const TURNS = Number(args.get("turns") ?? 3);
const OUT =
  args.get("out") ?? `/tmp/vfx-stress-${vw}x${vh}.json`;
const STORY_URL =
  args.get("story-url") ??
  `http://127.0.0.1:6007/iframe.html?id=${STORY}&viewMode=story`;

const launchOpts = { headless: !args.has("headed") };
if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;

const cacheRoots = [
  "/opt/ms-playwright",
  path.join(homedir(), ".cache/ms-playwright"),
];
const cached = [];
for (const root of cacheRoots) {
  let entries = [];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    continue;
  }
  for (const dir of entries
    .filter((d) => d.isDirectory() && d.name.startsWith("chromium"))
    .map((d) => d.name)) {
    for (const bin of [
      "chrome-linux64/chrome",
      "chrome-headless-shell-linux64/chrome-headless-shell",
    ]) {
      const full = path.join(root, dir, bin);
      if (existsSync(full)) cached.push(full);
    }
  }
}
const candidates = [
  process.env.CHROME_PATH,
  chromium.executablePath(),
  ...cached,
].filter(Boolean);
let browser = null;
let lastErr = null;
for (const exe of candidates) {
  try {
    browser = await chromium.launch({ ...launchOpts, executablePath: exe });
    break;
  } catch (e) {
    lastErr = e;
  }
}
if (!browser) {
  try {
    browser = await chromium.launch(launchOpts);
  } catch (e) {
    lastErr = e;
  }
}
if (!browser) throw lastErr;
const context = await browser.newContext({
  viewport: { width: vw, height: vh },
  deviceScaleFactor: desktop ? 1 : 2,
  isMobile: !desktop,
  hasTouch: !desktop,
});
const page = await context.newPage();
page.setDefaultTimeout(60_000);
page.on("pageerror", (e) => console.error("PAGEERROR", e.message));

await page.goto(STORY_URL, { waitUntil: "networkidle" }).catch(() => {
  console.error(`storybook unreachable at ${STORY_URL} — start it first`);
  process.exit(2);
});
await page.waitForSelector('[data-testid="chessboard"], [data-board-grid]', {
  timeout: 60_000,
});
await page.waitForFunction(
  () =>
    !!document.querySelector(
      'button[aria-label="Go forward"], button[aria-label="Next turn"]',
    ),
  { timeout: 30_000 },
);
await page.waitForTimeout(900);

await page.evaluate(() => {
  window.__frames = [];
  window.__longtasks = [];
  let last = performance.now();
  const tick = (t) => {
    window.__frames.push(t - last);
    last = t;
    window.__raf = requestAnimationFrame(tick);
  };
  window.__raf = requestAnimationFrame(tick);
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__longtasks.push(e.duration);
  }).observe({ entryTypes: ["longtask"] });
});

const waitEnabled = async (btn, label) => {
  for (let t = 0; t < 80; t++) {
    if (await btn.isEnabled()) return true;
    await page.waitForTimeout(150);
  }
  console.warn("still disabled:", label);
  return false;
};
const waitResolveIdle = async (label) => {
  try {
    await page.waitForFunction(
      () => {
        const back = document.querySelector(
          'button[aria-label="Go back"], button[aria-label="Previous turn"]',
        );
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

const dualBtn = page.locator('button[aria-label="Go forward"]');
const dualNav = (await dualBtn.count()) > 0;
const stepSel = dualNav
  ? 'button[aria-label="Go forward"]'
  : 'button[aria-label="Next turn"]';
const clicksPerTurn = dualNav ? 2 : 1;
for (let t = 0; t < TURNS; t++) {
  for (let s = 0; s < clicksPerTurn; s++) {
    const btn = page.locator(stepSel);
    await btn.waitFor({ state: "visible" });
    if (!(await waitEnabled(btn, `turn-${t}-step-${s}`))) break;
    await btn.click();
    await page.waitForTimeout(700);
  }
  await waitResolveIdle(`post-turn-${t}`);
  await page.waitForTimeout(450);
}
await page.waitForTimeout(800);

const { frames, longtasks } = await page.evaluate(() => {
  cancelAnimationFrame(window.__raf);
  return { frames: window.__frames, longtasks: window.__longtasks };
});
await context.close();
await browser.close();

const sorted = [...frames].sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const summary = {
  story: STORY,
  viewport: `${vw}x${vh}`,
  mobile: !desktop,
  frames: frames.length,
  p50ms: +pct(0.5).toFixed(2),
  p95ms: +pct(0.95).toFixed(2),
  maxMs: +Math.max(...frames, 0).toFixed(2),
  over50ms: frames.filter((f) => f > 50).length,
  longtasks: longtasks.length,
  longtaskTotalMs: +longtasks.reduce((a, b) => a + b, 0).toFixed(2),
};
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(summary, null, 2));
console.table(summary);
console.log("wrote", OUT);
