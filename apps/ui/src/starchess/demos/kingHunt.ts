/**
 * King Hunt SCFEN history — pure engine builders (no Solid / board UI).
 */

import type { Square } from "chess.js";

import { addScMove } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { classicFenFromSc, formatScFen, parseScFen } from "~/starchess/scfen";
import type { PieceColor, ScFenSnapshot } from "~/types/starchess";

export const KING_HUNT_START_SCFEN =
  "SCFEN|k7/5r2/8/2n5/4K3/8/7b/8|0|33|P|G:11:11|Q:w:;b:";

export type KingHuntStep = {
  caption: string;
  moves: readonly { color: PieceColor; from: Square; to: Square }[];
};

export const KING_HUNT_STEPS: readonly KingHuntStep[] = [
  {
    caption: "0. … & Nc5+",
    moves: [{ color: "b", from: "c5", to: "e4" }],
  },
  {
    caption: "1. Kd5 & Bh2→Bg1",
    moves: [
      { color: "w", from: "e4", to: "d5" },
      { color: "b", from: "h2", to: "g1" },
    ],
  },
  {
    caption: "2. Kxc5 (Bg1+) & Rf7→Rf6",
    moves: [
      { color: "w", from: "d5", to: "c5" },
      { color: "b", from: "f7", to: "f6" },
    ],
  },
  {
    caption: "3. Kc6 & Bg1→c5",
    moves: [
      { color: "w", from: "c5", to: "c6" },
      { color: "b", from: "g1", to: "c5" },
    ],
  },
  {
    caption: "4. … & Rf6+ · game over",
    moves: [{ color: "b", from: "f6", to: "c6" }],
  },
];

export const queueKingHuntStep = (
  snap: ScFenSnapshot,
  step: KingHuntStep,
): ScFenSnapshot => {
  let next: ScFenSnapshot = { ...snap, queue: { actions: [] } };
  for (const m of step.moves) next = addScMove(next, m);
  return next;
};

export const buildKingHuntPlys = (): ScFenSnapshot[] => {
  const plies: ScFenSnapshot[] = [parseScFen(KING_HUNT_START_SCFEN)];
  let cur = plies[0]!;
  for (const step of KING_HUNT_STEPS) {
    cur = endScTurn(queueKingHuntStep(cur, step)).next;
    plies.push(cur);
  }
  return plies;
};

export const KING_HUNT_PLY_SC: readonly ScFenSnapshot[] = buildKingHuntPlys();

/** @deprecated Prefer KING_HUNT_PLY_SC */
export const KING_HUNT_PLY_FENS = KING_HUNT_PLY_SC.map((snap, ply) => ({
  ply,
  fen: classicFenFromSc(snap, "w"),
  scfen: formatScFen(snap),
  lives: snap.kingLives.w,
}));
