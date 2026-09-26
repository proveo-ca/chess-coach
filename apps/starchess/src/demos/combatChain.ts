/**
 * Combat Chain SCFEN history — pure engine builders.
 */
import type { Square } from "chess.js";

import {
  addScMove,
  endScTurn,
  parseScFen,
  type PieceColor,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

export const COMBAT_CHAIN_START_SCFEN =
  "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:;b:";

export type CombatChainStep = {
  caption: string;
  moves: readonly { color: PieceColor; from: Square; to: Square }[];
};

export const COMBAT_CHAIN_STEPS: readonly CombatChainStep[] = [
  {
    caption: "1. d2-d4 & Be8-c6",
    moves: [
      { color: "w", from: "d2", to: "d4" },
      { color: "b", from: "e8", to: "c6" },
    ],
  },
  {
    caption: "2. d4xe5 & Nf6-e4",
    moves: [
      { color: "w", from: "d4", to: "e5" },
      { color: "b", from: "f6", to: "e4" },
    ],
  },
  {
    caption: "3. Rc3-c8 (cut off by Ne4xc3) & Ne4xc3",
    moves: [
      { color: "w", from: "c3", to: "c8" },
      { color: "b", from: "e4", to: "c3" },
    ],
  },
];

export const queueCombatChainStep = (
  snap: ScFenSnapshot,
  step: CombatChainStep,
): ScFenSnapshot => {
  let next: ScFenSnapshot = { ...snap, queue: { actions: [] } };
  for (const m of step.moves) next = addScMove(next, m);
  return next;
};

export const buildCombatChainPlys = (): ScFenSnapshot[] => {
  const plies: ScFenSnapshot[] = [parseScFen(COMBAT_CHAIN_START_SCFEN)];
  let cur = plies[0]!;
  for (const step of COMBAT_CHAIN_STEPS) {
    cur = endScTurn(queueCombatChainStep(cur, step)).next;
    plies.push(cur);
  }
  return plies;
};

export const COMBAT_CHAIN_PLY_SC: readonly ScFenSnapshot[] = buildCombatChainPlys();
