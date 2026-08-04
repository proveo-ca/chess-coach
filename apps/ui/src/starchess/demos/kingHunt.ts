/**
 * King Hunt SCFEN history — pure engine builders (no Solid / board UI).
 * Tank (rook) starts on the **g-file** (g7).
 * King-aimed checks arm pending (`H:`); HP applies on the **next** End after `B`.
 */

import type { Square } from "chess.js";

import { addScMove } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { classicFenFromSc, formatScFen, parseScFen } from "~/starchess/scfen";
import type { PieceColor, ScFenSnapshot } from "~/types/starchess";

/** Black hunts white: ka8, rg7, nc5, Ke4, bh2. */
export const KING_HUNT_START_SCFEN =
  "SCFEN|k7/6r1/8/2n5/4K3/8/7b/8|0|33|P|G:11:11|Q:w:;b:";

/**
 * Ownership reversed (live play as White hunter): Ka8, Rg7, Nc5, ke4, Bh2.
 * Pending white knight check already armed (`H:w:n:c5e4`) — first End is the
 * HP / collision turn (player may `B=spawn` to block sliding checks; knights
 * have no ray).
 */
export const KING_HUNT_LIVE_START_SCFEN =
  "SCFEN|K7/6R1/8/2N5/4k3/8/7B/8|0|33|P|G:33:33|Q:w:;b:|H:w:n:c5e4";

export type KingHuntStep = {
  caption: string;
  moves: readonly { color: PieceColor; from: Square; to: Square }[];
};

export const KING_HUNT_STEPS: readonly KingHuntStep[] = [
  {
    caption: "0. … & Nc5+ (check armed — HP next turn)",
    moves: [{ color: "b", from: "c5", to: "e4" }],
  },
  {
    caption: "1. HP−1 · Kd5 & Bh2→Bg1",
    moves: [
      { color: "w", from: "e4", to: "d5" },
      { color: "b", from: "h2", to: "g1" },
    ],
  },
  {
    caption: "2. Kxc5 & Rg7→Rg6",
    moves: [
      { color: "w", from: "d5", to: "c5" },
      { color: "b", from: "g7", to: "g6" },
    ],
  },
  {
    caption: "3. … & Bg1→c5+ (check armed)",
    moves: [{ color: "b", from: "g1", to: "c5" }],
  },
  {
    caption: "4. HP−1 · Kc6",
    moves: [{ color: "w", from: "c5", to: "c6" }],
  },
  {
    caption: "5. … & Rg6+ (check armed)",
    moves: [{ color: "b", from: "g6", to: "c6" }],
  },
  {
    caption: "6. HP−1 lethal · game over",
    moves: [],
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
