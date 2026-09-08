// SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml
/**
 * Command Center (CC) search — StarChess names only (CC, not Command Center (CC)).
 * CC = `k` piece, Marine = `p`, Hoverbike = `n`, Mecha = `b`, Tank = `r`, Battleship = `q`.
 *
 * Wraps `gatherKingIntel` (fog-visible enemy units → focus) and adds the
 * 1-move probe posterior: when a Hoverbike is sent to the guessed CC square
 * (e.g. `e8`) and finds it empty, that square is proven `not CC`, and the
 * posterior becomes `Adj(e8) \ VisibleEmpty`, weighted by prior and distance.
 * This is exactly `P(CC=s | e8 empty) ∝ P(e8 empty | CC=s) * P(CC=s)`.
 */

import type { Square } from "chess.js";

import type { ScPiece } from "../../board/placement";
import { FILES, chebyshev } from "./geometry";
import { gatherKingIntel } from "./kingIntel";
import type { PieceColor } from "../../model/types";
import type { KingIntel } from "./types";

export type CCIntel = KingIntel & {
  /** Squares proven empty (lit empty + last Hoverbike probe that found empty). */
  excluded: ReadonlySet<Square>;
  /** Full posterior `P(CC=s)` over 64 squares (sums to 1 when strength>0). */
  dist: ReadonlyMap<Square, number>;
};

const ADJ = (sq: Square): Square[] => {
  const { file, rank } = (() => {
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]);
    return { file: f, rank: r };
  })();
  const out: Square[] = [];
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    if (df === 0 && dr === 0) continue;
    const nf = file + df, nr = rank + dr;
    if (nf < 0 || nf > 7 || nr < 1 || nr > 8) continue;
    out.push(`${FILES[nf]}${nr}` as Square);
  }
  return out;
};

/**
 * Best guess for the enemy Command Center (CC).
 * `prior` is the previous `CCIntel` (or null → `e1` if enemy is `w`, `e8` if `b`).
 * `lastProbe` is the last Hoverbike destination that was found empty (e.g. `e8`).
 * `lit`/`revealed` are current vision — any lit empty square is also `not CC`.
 */
export const getCCBestGuess = (
  prior: CCIntel | null,
  map: Map<Square, ScPiece>,
  lit: ReadonlySet<Square>,
  revealed: ReadonlySet<Square>,
  lastProbe: { to: Square; empty: boolean } | null,
  enemy: PieceColor,
): CCIntel => {
  const base = gatherKingIntel(map, lit, revealed, enemy);
  const excluded = new Set<Square>(prior?.excluded ?? []);
  // Any lit square that is empty and not occupied is proven not CC
  for (const sq of lit) {
    if (!map.has(sq)) excluded.add(sq);
  }
  if (lastProbe?.empty) excluded.add(lastProbe.to);

  // If the current focus is now excluded (e.g. e8 proven empty),
  // move focus to the highest-posterior Adj(focus) \ excluded
  let focus = base.focus;
  let strength = base.strength;
  if (excluded.has(focus)) {
    const candidates = ADJ(focus).filter((s) => !excluded.has(s));
    if (candidates.length > 0) {
      // Weight by prior `gatherKingIntel` mass and inverse chebyshev distance to old focus
      let best: Square = candidates[0]!;
      let bestW = -1;
      for (const c of candidates) {
        const priorW = base.strength > 0 ? 1 / (1 + chebyshev(c, base.focus)) : 1;
        const w = priorW * (1 + (prior?.dist.get(c) ?? 0));
        if (w > bestW) { bestW = w; best = c; }
      }
      focus = best;
      // Keep strength but slightly decay when we had to move off the guess
      strength = Math.max(1, Math.round(base.strength * 0.7));
    }
  }

  // Build a simple posterior dist: prior mass spread over Adj(focus) when focus was excluded,
  // otherwise base dist (approx by reusing base.focus mass)
  const dist = new Map<Square, number>();
  if (prior?.dist) {
    for (const [sq, p] of prior.dist) if (!excluded.has(sq)) dist.set(sq, p);
  }
  // Ensure focus has mass
  if (!dist.has(focus)) dist.set(focus, 1);
  // Normalize
  let sum = 0;
  for (const v of dist.values()) sum += v;
  if (sum > 0) for (const [k, v] of [...dist]) dist.set(k, v / sum);

  return { focus, strength, excluded, dist };
};

export const emptyCCIntel = (enemy: PieceColor): CCIntel => ({
  focus: enemy === "w" ? "e1" as Square : "e8" as Square,
  strength: 0,
  excluded: new Set(),
  dist: new Map([[enemy === "w" ? "e1" as Square : "e8" as Square, 1]]),
});
