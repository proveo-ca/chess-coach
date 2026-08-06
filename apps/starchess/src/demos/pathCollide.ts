/**
 * Path-collide SCFEN history — 2 simultaneous turns (8 actions).
 * Verification for Attack (path collide) Spider Mine story.
 */

import { addScAction, addScMove } from "@chess-coach/starchess-core";
import { endScTurn } from "@chess-coach/starchess-core";
import { parseScFen } from "@chess-coach/starchess-core";
import type { ScActionInput, ScFenSnapshot } from "@chess-coach/starchess-core";

/** Nb a4, Ke1, kh8 — black mine will be hostile on a4. */
export const PATH_COLLIDE_START_SCFEN =
  "SCFEN|7k/8/8/8/n7/8/8/4K3|0|33|P|G:11:11|Q:w:;b:";

export type PathCollideStep = {
  caption: string;
  /** Both sides’ actions for one parallel turn (N specials all B|F + ≤1 classical each). */
  actions: readonly ScActionInput[];
};

export const PATH_COLLIDE_STEPS: readonly PathCollideStep[] = [
  {
    caption:
      "1. Nb a4 mine+→c5 · White spawn rook d1→a1",
    actions: [
      { timing: "B", kind: "knightMine", color: "b", from: "a4", to: "a4" },
      { timing: "C", kind: "classical", color: "b", from: "a4", to: "c5" },
      { timing: "B", kind: "spawn", color: "w", from: "e1", to: "d1", unit: "r" },
      { timing: "C", kind: "classical", color: "w", from: "d1", to: "a1" },
    ],
  },
  {
    caption:
      "2. Nb c5 mine+→e4 · Ra1→a8 (chase boom) + siege skipped",
    actions: [
      { timing: "B", kind: "knightMine", color: "b", from: "c5", to: "c5" },
      { timing: "C", kind: "classical", color: "b", from: "c5", to: "e4" },
      { timing: "C", kind: "classical", color: "w", from: "a1", to: "a8" },
      { timing: "F", kind: "rookSiege", color: "w", from: "a1" },
    ],
  },
];

export const queuePathCollideStep = (
  snap: ScFenSnapshot,
  step: PathCollideStep,
): ScFenSnapshot => {
  let next: ScFenSnapshot = { ...snap, queue: { actions: [] } };
  for (const action of step.actions) {
    next = addScAction({ snapshot: next, action }).snapshot;
  }
  return next;
};

export const buildPathCollidePlys = (): ScFenSnapshot[] => {
  const plies: ScFenSnapshot[] = [parseScFen(PATH_COLLIDE_START_SCFEN)];
  let cur = plies[0]!;
  for (const step of PATH_COLLIDE_STEPS) {
    cur = endScTurn(queuePathCollideStep(cur, step)).next;
    plies.push(cur);
  }
  return plies;
};

export const PATH_COLLIDE_PLY_SC: readonly ScFenSnapshot[] = buildPathCollidePlys();

/** Convenience for tests that only need classical helpers. */
export { addScMove };
