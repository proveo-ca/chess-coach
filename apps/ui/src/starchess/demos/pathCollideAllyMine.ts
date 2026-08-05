/**
 * Path-collide (sides flipped) — ally mine on a4, enemy rook walks the a-file.
 * Verification for Attack (path collide · ally mine) Spider Mine story.
 */

import { addScAction, addScMove } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { parseScFen } from "~/starchess/scfen";
import type { ScActionInput, ScFenSnapshot } from "~/starchess/types";

/** Nw a4, Ke1, ke8 — white mine will be allied on a4. */
export const PATH_COLLIDE_ALLY_MINE_START_SCFEN =
  "SCFEN|4k3/8/8/8/N7/8/8/4K3|0|33|P|G:11:11|Q:w:;b:";

export type PathCollideAllyMineStep = {
  caption: string;
  /** Both sides’ actions for one parallel turn (≤1 special + ≤1 classical each). */
  actions: readonly ScActionInput[];
};

export const PATH_COLLIDE_ALLY_MINE_STEPS: readonly PathCollideAllyMineStep[] = [
  {
    caption:
      "1. Nw a4 mine+→c5 · Black spawn rook d8→a8",
    actions: [
      { timing: "B", kind: "knightMine", color: "w", from: "a4", to: "a4" },
      { timing: "C", kind: "classical", color: "w", from: "a4", to: "c5" },
      { timing: "B", kind: "spawn", color: "b", from: "e8", to: "d8", unit: "r" },
      { timing: "C", kind: "classical", color: "b", from: "d8", to: "a8" },
    ],
  },
  {
    caption:
      "2. Nw c5 mine+→e4 · ra8→a1 (chase boom) + siege skipped",
    actions: [
      { timing: "B", kind: "knightMine", color: "w", from: "c5", to: "c5" },
      { timing: "C", kind: "classical", color: "w", from: "c5", to: "e4" },
      { timing: "C", kind: "classical", color: "b", from: "a8", to: "a1" },
      { timing: "F", kind: "rookSiege", color: "b", from: "a8" },
    ],
  },
];

export const queuePathCollideAllyMineStep = (
  snap: ScFenSnapshot,
  step: PathCollideAllyMineStep,
): ScFenSnapshot => {
  let next: ScFenSnapshot = { ...snap, queue: { actions: [] } };
  for (const action of step.actions) {
    next = addScAction({ snapshot: next, action }).snapshot;
  }
  return next;
};

export const buildPathCollideAllyMinePlys = (): ScFenSnapshot[] => {
  const plies: ScFenSnapshot[] = [parseScFen(PATH_COLLIDE_ALLY_MINE_START_SCFEN)];
  let cur = plies[0]!;
  for (const step of PATH_COLLIDE_ALLY_MINE_STEPS) {
    cur = endScTurn(queuePathCollideAllyMineStep(cur, step)).next;
    plies.push(cur);
  }
  return plies;
};

export const PATH_COLLIDE_ALLY_MINE_PLY_SC: readonly ScFenSnapshot[] =
  buildPathCollideAllyMinePlys();

/** Convenience for tests that only need classical helpers. */
export { addScMove };
