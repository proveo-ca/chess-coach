/**
 * Capture Storybook StarChess demos as GIFs for STARCHESS_FEN.md.
 *
 * Usage (Storybook on :6006):
 *   node apps/ui/scripts/capture-starchess-fen-gifs.cjs
 */
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { PNG } = require("pngjs");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");
const { chromium } = require("/usr/lib/node_modules/playwright");

const OUT_DIR = path.join(__dirname, "../docs/starchess-fen");
const BASE = "http://127.0.0.1:6006/iframe.html";

const STORIES = [
  {
    id: "screens-nerd-star-chess-demo--combat-chain",
    out: "combat-chain.gif",
    turns: 3,
    settleMs: 2400,
    samplesPerTurn: 8,
  },
  {
    id: "screens-nerd-star-chess-demo--king-hunt",
    out: "king-hunt.gif",
    turns: 5,
    settleMs: 2200,
    samplesPerTurn: 7,
  },
];

const pngToRgba = (buf) => {
  const png = PNG.sync.read(buf);
  // Half-res for smaller docs assets.
  const w2 = Math.floor(png.width / 2);
  const h2 = Math.floor(png.height / 2);
  const data = Buffer.alloc(w2 * h2 * 4);
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      const si = (y * 2 * png.width + x * 2) * 4;
      const di = (y * w2 + x) * 4;
      data[di] = png.data[si];
      data[di + 1] = png.data[si + 1];
      data[di + 2] = png.data[si + 2];
      data[di + 3] = png.data[si + 3];
    }
  }
  return { data, width: w2, height: h2 };
};

const encodeGif = (frames) => {
  const { width, height } = frames[0];
  const gif = GIFEncoder();
  const palette = quantize(frames[Math.min(2, frames.length - 1)].data, 128);
  for (const frame of frames) {
    gif.writeFrame(applyPalette(frame.data, palette), width, height, {
      palette,
      delay: 12,
    });
  }
  gif.finish();
  return Buffer.from(gif.bytes());
};

const captureStory = async (page, spec) => {
  const url = `${BASE}?id=${spec.id}&viewMode=story`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("#storybook-root [data-square]", { timeout: 30000 });
  await page.locator("#storybook-root").click({ position: { x: 24, y: 24 } }).catch(() => {});

  const clipHost = page.locator("#storybook-root").first();
  const frames = [];
  const pushShot = async () => {
    frames.push(pngToRgba(await clipHost.screenshot({ type: "png" })));
  };

  await pushShot();

  for (let t = 0; t < spec.turns; t++) {
    await page.keyboard.press("ArrowRight");
    const step = Math.max(1, Math.floor(spec.settleMs / spec.samplesPerTurn));
    for (let i = 0; i < spec.samplesPerTurn; i++) {
      await page.waitForTimeout(step);
      await pushShot();
    }
  }

  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(180);
    await pushShot();
  }

  return encodeGif(frames);
};

(async () => {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 720 } });
  page.setDefaultTimeout(30000);

  for (const spec of STORIES) {
    process.stdout.write(`Capturing ${spec.id}… `);
    const gif = await captureStory(page, spec);
    const outPath = path.join(OUT_DIR, spec.out);
    await writeFile(outPath, gif);
    console.log(`wrote ${outPath} (${(gif.length / 1024).toFixed(0)} KiB)`);
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
