import type { Square } from "chess.js";

import { ATTACK_MS, DEATH_MS } from "~/broodwar/constants";

export { DEATH_MS } from "~/broodwar/constants";

export type DeathPiece = "p" | "n" | "b" | "r" | "q" | "k";

/** Intact pose before death (storybook loop) — 7/5 of an attack window. */
export const IDLE_MS = (ATTACK_MS * 7) / 5;

/** Empty square pause before the loop restarts — 7/5 of a death window. */
export const HOLD_MS = (DEATH_MS * 7) / 5;

export const ORIGIN: Square = "d4";

export const FEN_BY_PIECE: Record<DeathPiece, string> = {
  p: "7k/8/8/8/3P4/8/8/K7 w - - 0 1",
  n: "7k/8/8/8/3N4/8/8/K7 w - - 0 1",
  b: "7k/8/8/8/3B4/8/8/K7 w - - 0 1",
  r: "7k/8/8/8/3R4/8/8/K7 w - - 0 1",
  q: "7k/8/8/8/3Q4/8/8/K7 w - - 0 1",
  k: "7k/8/8/8/3K4/8/8/8 w - - 0 1",
};

/** Stable hash → scatter seed so each death cue id flies differently. */
export const scatterSeedFromId = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/**
 * Per-shard flight vector. Directions fan around the circle (golden-angle
 * steps + seed jitter) so parts peel apart instead of sharing one heading.
 * Distances stay on the order of 1–2 squares so the scatter reads on-board.
 */
export const shardFlightStyle = (
  index: number,
  seed: number,
  distScale = 1,
): Record<string, string> => {
  const countHint = 12;
  const base = (index * 360) / countHint;
  const jitter = ((seed * 47.3 + index * 19.1) % 47) - 23.5;
  const ang = ((base + jitter + (seed % 360)) * Math.PI) / 180;
  const dist = (52 + ((index * 37 + seed * 13) % 58)) * distScale;
  const spin = ((index * 97 + seed * 31) % 520) - 260;
  return {
    "--dx": `${Math.cos(ang) * dist}px`,
    "--dy": `${Math.sin(ang) * dist}px`,
    "--spin": `${spin}deg`,
  };
};

/**
 * King rubble settle pose — parts drop downward into a pile (not outward shatter).
 * CSS vars consumed by `rubbleCollapse` / static destroyed.
 */
export const rubbleSettleStyle = (
  index: number,
  seed: number,
): Record<string, string> => {
  // Prefer downward + slight lateral spread; hub/deck fall farther.
  const baseX = [-2, 1, -9, 9, 3, -4, 0, -11, 11][index] ?? (index % 2 === 0 ? -6 : 6);
  const baseY = [5, 3, 10, 10, 14, 18, 4, 12, 12][index] ?? 10 + (index % 5);
  const baseSpin = [-8, 6, -28, 26, 18, -22, 4, -35, 32][index] ?? (index * 17) % 40 - 20;
  const jx = ((seed * 13 + index * 7) % 7) - 3;
  const jy = ((seed * 11 + index * 5) % 5);
  const js = ((seed * 3 + index * 11) % 17) - 8;
  return {
    "--rx": `${baseX + jx}px`,
    "--ry": `${baseY + jy}px`,
    "--rspin": `${baseSpin + js}deg`,
  };
};
