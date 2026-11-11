/**
 * SCFEN → classical FEN projector for the script arena's engine feed.
 *
 * The pure StarChess engine has no DOM/worker/fetch deps, but consuming a
 * native stockfish child process needs a *classical* position. Placement maps
 * 1:1 (SCFEN already uses standard letters `p/n/b/r/q/k`, uppercase white);
 * SCFEN extras (ccLives, gas, stored, mines, queue, siegedTanks) are dropped.
 *
 * **Lossy, by design:** FEN models only classical movement. Units moved by gas
 * specials, spawn deployment, chip HP, mines etc. arrive at squares classical
 * chess considers legal — the projection is a *positional hint* for candidate
 * scoring, never a legality authority (the core's `addScAction` gate stays
 * authoritative).
 *
 * **Legality guard:** stockfish's FEN parser rejects some StarChess-legal
 * positions — exactly one Command Center per side is required (`hasExactCCPair`) and
 * Marines on the back ranks are invalid classical FEN (SCFEN reaches them via the
 * `deploy` special and `stimStep` promotions). The feed skips `ok: false`
 * candidates instead of burning a timeout on an unparseable position.
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml, _spec/apps/server/starchess-arena-feed.puml
 */

import { classicFenFromSc, hasExactCCPair } from "../scfen";
import type { ScFenSnapshot } from "../model/types";

export type FenProjection =
  | { ok: true; fen: string }
  | {
      ok: false;
      reason: "no-exact-cc-pair" | "back-rank-marine";
    };

/** Ranks 1 and 8 (last and first placement components) may not hold Marines. */
const hasMarine = (rank: string | undefined): boolean => /p/i.test(rank ?? "");

/**
 * Project a StarChess snapshot to a playable classical FEN, or report why the
 * position cannot be represented (ineligible candidates for the engine feed).
 */
export const scfenToFen = (snap: ScFenSnapshot): FenProjection => {
  if (!hasExactCCPair(snap.placement)) return { ok: false, reason: "no-exact-cc-pair" };
  const ranks = snap.placement.split("/");
  if (hasMarine(ranks[0]) || hasMarine(ranks[ranks.length - 1])) {
    return { ok: false, reason: "back-rank-marine" };
  }
  return { ok: true, fen: classicFenFromSc(snap) };
};