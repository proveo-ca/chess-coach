#!/usr/bin/env node
/**
 * Derive nerd-{height,space,weight} from shipping `nerd/` SVGs (paths unchanged).
 *
 * Shipping `nerd/` already embeds the harmonic-spaces outer frame. This script
 * unwraps that frame first, then re-applies one framing goal per variant so
 * Storybook compares framing only — colours stay the shared 4-swatch army.
 *
 * Framing target = Cburnett’s content box (measured via SVG getBBox):
 *   top≈7, bottom≈39.2, height≈32.2, width≈31, cx=22.5
 *
 *   nerd-height — map each glyph into that height/ground band
 *   nerd-space  — same, plus fit width so side air matches Cburnett
 *   nerd-weight — height-fit, then nudge scale by ink area toward the mean
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "pieces");
const srcDir = join(root, "nerd");

/**
 * Unframed silhouette getBBox (shipping with outer space-frame stripped).
 * Identical for w/b.
 */
const FRAME = {
  P: { cx: 20.03, bottom: 39.15, h: 29.7, w: 28.35 },
  N: { cx: 23.33, bottom: 46.15, h: 44.09, w: 45.2 },
  B: { cx: 22.5, bottom: 42.5, h: 34.5, w: 35 },
  R: { cx: 22.5, bottom: 39.37, h: 33.72, w: 43.75 },
  Q: { cx: 22.5, bottom: 44, h: 42.1, w: 39 },
  K: { cx: 22.5, bottom: 43, h: 31.7, w: 39.6 },
};

/** Cburnett army average content box. */
const CB = { cx: 22.5, bottom: 39.2, h: 32.2, w: 30.9 };

const meanArea =
  Object.values(FRAME).reduce((a, f) => a + f.w * f.h, 0) / Object.keys(FRAME).length;

/** Outer frame already baked into shipping `nerd/` (same as NERD_FRAME). */
const SPACE_FRAME_RE = /^<g transform="translate\(22\.5 39\.2\)[^"]*">/;

function roleOf(file) {
  return file.replace(/^[wb]/, "").replace(/\.svg$/, "");
}

function fit(inner, role, { height = true, width = false, weight = false, pad = 1 } = {}) {
  const src = FRAME[role];
  let s = height ? CB.h / src.h : 1;
  if (width) s = Math.min(s, CB.w / src.w);
  if (weight) {
    const area = src.w * src.h;
    // Soft nudge toward mean ink — keep recognisable, don't crush silhouettes.
    s *= Math.sqrt(meanArea / area) ** 0.35;
  }
  s *= pad;
  return `<g transform="translate(${CB.cx} ${CB.bottom}) scale(${s.toFixed(4)}) translate(${(-src.cx).toFixed(2)} ${(-src.bottom).toFixed(2)})">${inner}</g>`;
}

/** Strict 4-swatch army palette (team accent is red or blue). */
const SWATCH = {
  black: "#222",
  darkGray: "#555",
  red: "#a22",
  blue: "#3b7dd8",
  white: "#fff",
};

function parseHex(raw) {
  const h = raw.replace("#", "").toLowerCase();
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Collapse any hex into black / darkGray / team / white. */
function toSwatch(hex, team) {
  const c = parseHex(hex);
  if (!c) return hex;
  const { r, g, b } = c;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const sat = max === 0 ? 0 : (max - min) / max;

  // Saturated team hues first (red lamps, blue jets, armour panels).
  if (sat > 0.25 && lum > 0.12 && lum < 0.85) {
    if (r > g + 15 && r > b + 15) return team;
    if (b > r + 15 && b >= g) return team;
  }
  // Light enamel / cockpit / hull (#888+) → white (matches pawn dome).
  if (lum >= 0.5) return SWATCH.white;
  if (lum <= 0.22) return SWATCH.black;
  return SWATCH.darkGray;
}

/**
 * Force artwork onto 4 colours: black, dark gray, red|blue, white.
 */
function harmonizeColors(svgText, file) {
  const team = file.startsWith("w") ? SWATCH.blue : SWATCH.red;
  return svgText.replace(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g, (match) => toSwatch(match, team));
}

/**
 * Harmonic negative spaces: width-capped like Cburnett air, then per-role
 * vertical scale. Knight sets the back-rank top; Bishop/King match it;
 * Queen is tallest. Non-pawns get ×1.25 (pawns stay smaller).
 */
function fitSpace(inner, role) {
  const src = FRAME[role];
  const sx0 = Math.min(CB.h / src.h, CB.w / src.w) * 0.94;

  // After the shared width pass, Knight height is the back-rank reference.
  const knightH = Math.min(CB.h / FRAME.N.h, CB.w / FRAME.N.w) * 0.94 * FRAME.N.h;
  const targetH = {
    P: sx0 * src.h, // unchanged from width-fit
    N: knightH,
    B: knightH, // match Knight top
    R: knightH, // match Knight bounds
    Q: knightH * 1.18, // biggest
    K: knightH, // match Knight top
  }[role];
  let sx = sx0;
  let sy = targetH / src.h;
  if (role !== "P") {
    sx *= 1.25;
    sy *= 1.25;
  }

  return `<g transform="translate(${CB.cx} ${CB.bottom}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${(-src.cx).toFixed(2)} ${(-src.bottom).toFixed(2)})">${inner}</g>`;
}

function transformInner(inner, variant, role) {
  if (variant === "nerd-height") return fit(inner, role, { height: true });
  if (variant === "nerd-space") return fitSpace(inner, role);
  if (variant === "nerd-weight") return fit(inner, role, { height: true, weight: true });
  throw new Error(variant);
}

/** Strip the outer space-frame wrapper already present in shipping `nerd/`. */
function unwrapShipping(inner) {
  const trimmed = inner.trim();
  if (!SPACE_FRAME_RE.test(trimmed)) return trimmed;
  const open = trimmed.match(SPACE_FRAME_RE)[0];
  let body = trimmed.slice(open.length);
  const last = body.lastIndexOf("</g>");
  if (last === -1) throw new Error("shipping frame missing close");
  return (body.slice(0, last) + body.slice(last + 4)).trim();
}

function rebuild(svgText, variant, role, file) {
  const colored = harmonizeColors(svgText, file);
  const open = colored.match(/^[\s\S]*?<svg[^>]*>/);
  const close = colored.match(/<\/svg>\s*$/);
  if (!open || !close) throw new Error("bad svg shell");
  const raw = unwrapShipping(colored.slice(open[0].length, colored.length - close[0].length));
  const body = transformInner(raw, variant, role);
  return `${open[0]}\n${body}\n</svg>\n`;
}

const variants = ["nerd-height", "nerd-space", "nerd-weight"];
const files = readdirSync(srcDir).filter((f) => f.endsWith(".svg"));

for (const variant of variants) {
  const dir = join(root, variant);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    writeFileSync(
      join(dir, file),
      rebuild(readFileSync(join(srcDir, file), "utf8"), variant, roleOf(file), file),
    );
  }
  console.log(`wrote ${variant} (4-swatch ← unframed nerd/)`);
}
