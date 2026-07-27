import type { Square } from "chess.js";

export type DeathPiece = "p" | "n" | "b" | "r" | "q" | "k";

/** Intact pose before death. */
export const IDLE_MS = 1400;

/**
 * Hard cap for the entire death cue (boom + pop / shard flight).
 * Every CSS animation must finish within this window — no overruns.
 */
export const DEATH_MS = 500;

/** Empty square pause before the loop restarts. */
export const HOLD_MS = 700;

export const ORIGIN: Square = "d4";

export const FEN_BY_PIECE: Record<DeathPiece, string> = {
  p: "r6k/8/8/8/3P4/8/8/K6R w - - 0 1",
  n: "r6k/8/8/8/3N4/8/8/K6R w - - 0 1",
  b: "r6k/8/8/8/3B4/8/8/K6R w - - 0 1",
  r: "r6k/8/8/8/3R4/8/8/K6R w - - 0 1",
  q: "r6k/8/8/8/3Q4/8/8/K6R w - - 0 1",
  k: "r6k/8/8/8/3K4/8/8/7R w - - 0 1",
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
