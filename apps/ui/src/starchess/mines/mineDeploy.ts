import type { Color, Square } from "chess.js";

import { MINE_DEPLOY_MS } from "~/starchess/constants";
import { MINE_LEG_COUNT } from "~/starchess/specials/spiderMineLegs";
import type { MineDeployCue, PieceColor } from "~/types/starchess";

export type MineAt = { at: Square; color: Color };

const mineKey = (m: MineAt) => `${m.color}:${m.at}`;

/** Stable random per-leg durations in (0, maxMs], length {@link MINE_LEG_COUNT}. */
export const rollMineLegMs = (maxMs: number, seed = Math.random()): number[] => {
  const out: number[] = [];
  let s = (seed * 1e9) % 2147483647;
  if (s <= 0) s = 1;
  for (let i = 0; i < MINE_LEG_COUNT; i++) {
    s = (s * 48271) % 2147483647;
    const t = (s % maxMs) + 1; // 1..maxMs
    out.push(t);
  }
  return out;
};

export const makeMineDeployCue = (
  at: Square,
  color: PieceColor,
  seed = Math.random(),
): MineDeployCue => ({
  id: `mine-deploy-${at}-${Date.now()}-${Math.floor(seed * 1e6)}`,
  at,
  color,
  legMs: rollMineLegMs(MINE_DEPLOY_MS, seed),
});

/** Newly appeared mines (by square+owner) — not removals. */
export const mineDeployCuesForDiff = (
  prev: readonly MineAt[],
  next: readonly MineAt[],
): MineDeployCue[] => {
  const had = new Set(prev.map(mineKey));
  const cues: MineDeployCue[] = [];
  for (const m of next) {
    if (had.has(mineKey(m))) continue;
    cues.push(makeMineDeployCue(m.at, m.color === "b" ? "b" : "w"));
  }
  return cues;
};
