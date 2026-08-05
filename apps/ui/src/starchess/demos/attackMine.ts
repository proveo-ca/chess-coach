/**
 * Attack-mine SCFEN — knight targets hostile mine, engine attack→occupy.
 * Pure builders (no Solid / board UI).
 */

import { addScAction } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { parseScFen } from "~/starchess/scfen";
import type { ScAction, ScFenSnapshot } from "~/starchess/types";

/** White knight d1, black mine c3, Ke1, kh8. */
export const ATTACK_MINE_START_SCFEN =
  "SCFEN|7k/8/8/8/8/8/8/3NK3|0|33|P|G:11:11|M:b:c3|Q:w:;b:";

export type AttackMineStep = {
  caption: string;
  actions: readonly Omit<ScAction, "seq">[];
};

export const ATTACK_MINE_STEPS: readonly AttackMineStep[] = [
  {
    caption: "1. Nd1→c3 · attack mine then occupy",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "d1", to: "c3" },
    ],
  },
];

export const queueAttackMineStep = (
  snap: ScFenSnapshot,
  step: AttackMineStep,
): ScFenSnapshot => {
  let next: ScFenSnapshot = { ...snap, queue: { actions: [] } };
  for (const action of step.actions) {
    next = addScAction({ snapshot: next, action }).snapshot;
  }
  return next;
};

export const buildAttackMinePlys = (): ScFenSnapshot[] => {
  const plies: ScFenSnapshot[] = [parseScFen(ATTACK_MINE_START_SCFEN)];
  let cur = plies[0]!;
  for (const step of ATTACK_MINE_STEPS) {
    cur = endScTurn(queueAttackMineStep(cur, step)).next;
    plies.push(cur);
  }
  return plies;
};

export const ATTACK_MINE_PLY_SC: readonly ScFenSnapshot[] = buildAttackMinePlys();
