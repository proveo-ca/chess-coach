/**
 * Storybook bishop walk: record with ffmpeg, assert steam-crank + no limb blow-up.
 *
 * Usage (Storybook on :6006):
 *   NODE_PATH=/usr/lib/node_modules node scripts/assert-bishop-crank.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const FFMPEG =
  process.env.FFMPEG_PATH ||
  (() => {
    try {
      return require("/tmp/ffm-inst/node_modules/@ffmpeg-installer/ffmpeg").path;
    } catch {
      return "ffmpeg";
    }
  })();

const OUT = "/tmp/bishop-crank-assert";
const BASE = "http://127.0.0.1:6006/iframe.html";
const ID = "screens-nerd-brood-war-fog-of-war-and-move-animations--bishop";

const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => {
      err += d.toString();
    });
    p.on("close", (code) => {
      if (code === 0) resolve(err);
      else reject(new Error(`ffmpeg exit ${code}: ${err.slice(-400)}`));
    });
  });

const main = async () => {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 720, height: 820 } });
  await page.goto(`${BASE}?id=${ID}&viewMode=story`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForSelector("#storybook-root [data-square]", { timeout: 60000 });
  await page.waitForTimeout(600);

  // Standing board bishop size (img on d4) before the move.
  const standing = await page.evaluate(() => {
    const img = document.querySelector('[data-square="d4"] img');
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });

  await page.locator('[data-square="d4"]').click({ force: true });
  await page.waitForTimeout(200);
  await page.locator('[data-square="h8"]').click({ force: true }); // 4 squares

  const samples = [];
  const framePaths = [];
  for (let i = 0; i < 28; i++) {
    await page.waitForTimeout(45);
    const snap = await page.evaluate(() => {
      const mover = document.querySelector(
        "[data-starchess-move-layer] [data-move-piece='b']",
      );
      if (!mover) return null;
      const svg = mover.querySelector("svg");
      const footL = mover.querySelector('[data-part="leg-left-foot"]');
      const footR = mover.querySelector('[data-part="leg-right-foot"]');
      const top = mover.querySelector('[data-part="leg-left-top"] line');
      const bot = mover.querySelector('[data-part="leg-left-bottom"] line');
      const r = (svg || mover).getBoundingClientRect();
      let contentBox = null;
      try {
        const bb = svg?.getBBox?.();
        if (bb) contentBox = { w: bb.width, h: bb.height, x: bb.x, y: bb.y };
      } catch {
        /* getBBox can throw if not rendered */
      }
      const foot = (el) =>
        el
          ? {
              cx: Number(el.getAttribute("cx")),
              cy: Number(el.getAttribute("cy")),
            }
          : null;
      const line = (el) =>
        el
          ? {
              x1: Number(el.getAttribute("x1")),
              y1: Number(el.getAttribute("y1")),
              x2: Number(el.getAttribute("x2")),
              y2: Number(el.getAttribute("y2")),
            }
          : null;
      return {
        footL: foot(footL),
        footR: foot(footR),
        thigh: line(top),
        shin: line(bot),
        w: r.width,
        h: r.height,
        contentBox,
      };
    });
    if (!snap) continue;
    samples.push(snap);
    const buf = await page.screenshot({
      type: "png",
      animations: "allow",
    });
    const fp = path.join(OUT, `frame-${String(framePaths.length).padStart(3, "0")}.png`);
    await writeFile(fp, buf);
    framePaths.push(fp);
  }

  await browser.close();

  if (samples.length < 4) {
    throw new Error(`too few move samples: ${samples.length}`);
  }

  const withFeet = samples.filter((s) => s.footL && s.footR && s.thigh && s.shin);
  if (withFeet.length < 4) {
    throw new Error(`missing foot/leg geometry (${withFeet.length})`);
  }

  // Foot traces a circle about the hip (cx≈18): radius should stay ~constant.
  const radii = withFeet.map((s) => {
    const hx = s.thigh.x1;
    const hy = s.thigh.y1;
    return Math.hypot(s.footL.cx - hx, s.footL.cy - hy);
  });
  const rMean = radii.reduce((a, b) => a + b, 0) / radii.length;
  const rSpread = Math.max(...radii) - Math.min(...radii);
  if (rSpread > rMean * 0.12) {
    throw new Error(`left foot not on a circle: r ${Math.min(...radii).toFixed(2)}–${Math.max(...radii).toFixed(2)}`);
  }

  // Full crank: foot angle about hip should cover a large arc (not a tiny wiggle).
  const angles = withFeet.map((s) => {
    const hx = s.thigh.x1;
    const hy = s.thigh.y1;
    return (Math.atan2(s.footL.cy - hy, s.footL.cx - hx) * 180) / Math.PI;
  });
  // Unwrap-ish range via circular span of samples.
  let maxSep = 0;
  for (let i = 0; i < angles.length; i++) {
    for (let j = i + 1; j < angles.length; j++) {
      let d = Math.abs(angles[i] - angles[j]);
      if (d > 180) d = 360 - d;
      if (d > maxSep) maxSep = d;
    }
  }
  if (maxSep < 90) {
    throw new Error(`crank arc too small: max foot separation ${maxSep.toFixed(1)}°`);
  }

  // 90° knee on every sample.
  for (const s of withFeet) {
    const hx = s.thigh.x2 - s.thigh.x1;
    const hy = s.thigh.y2 - s.thigh.y1;
    const sx = s.shin.x2 - s.shin.x1;
    const sy = s.shin.y2 - s.shin.y1;
    const dot = hx * sx + hy * sy;
    const mag = Math.hypot(hx, hy) * Math.hypot(sx, sy);
    if (mag > 0 && Math.abs(dot / mag) > 0.2) {
      throw new Error(`knee not ~90° (cos=${(dot / mag).toFixed(3)})`);
    }
  }

  // Opposite feet: when left is low, right is high (phase π).
  const phaseOpp = withFeet.filter((s) => Math.abs(s.footL.cy - s.footR.cy) > 8);
  if (phaseOpp.length < 1) {
    throw new Error("feet never opposite on the wheel (expected |dy| > 8)");
  }

  const bboxSamples = samples.map((s) => s.contentBox).filter(Boolean);
  const maxBW = Math.max(...bboxSamples.map((b) => b.w));
  const minBW = Math.min(...bboxSamples.map((b) => b.w));
  const maxBH = Math.max(...bboxSamples.map((b) => b.h));
  const minBH = Math.min(...bboxSamples.map((b) => b.h));
  if (maxBW > minBW * 1.35 || maxBH > minBH * 1.35) {
    throw new Error(
      `SVG content bbox blew up: w ${minBW.toFixed(1)}→${maxBW.toFixed(1)} h ${minBH.toFixed(1)}→${maxBH.toFixed(1)}`,
    );
  }
  const hullW = samples.map((s) => s.w);
  const hullH = samples.map((s) => s.h);
  const maxHullW = Math.max(...hullW);
  const maxHullH = Math.max(...hullH);
  if (standing && (maxHullW > standing.w * 1.25 || maxHullH > standing.h * 1.25)) {
    throw new Error(
      `moving hull larger than standing img (${standing.w.toFixed(0)}x${standing.h.toFixed(0)} vs ${maxHullW.toFixed(0)}x${maxHullH.toFixed(0)})`,
    );
  }

  const mp4 = path.join(OUT, "bishop-walk.mp4");
  await runFfmpeg([
    "-y",
    "-framerate",
    "12",
    "-i",
    path.join(OUT, "frame-%03d.png"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    mp4,
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        samples: samples.length,
        footRadius: Number(rMean.toFixed(2)),
        footRadiusSpread: Number(rSpread.toFixed(2)),
        footArcDeg: Number(maxSep.toFixed(1)),
        bbox: { minW: minBW, maxW: maxBW, minH: minBH, maxH: maxBH },
        standing,
        mp4,
        ffmpeg: FFMPEG,
      },
      null,
      2,
    ),
  );
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
