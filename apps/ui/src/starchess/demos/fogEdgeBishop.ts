/**
 * Fog-edge bishop — SCFEN intent into fog onto a hidden king square;
 * path discovers g7 → Bxg7. Fog overrides classical FEN legality.
 * // SPEC: _spec/apps/ui/starchess/scfen.md §3–§5
 */

import { addScAction } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import type { FogEdgeScenario } from "~/starchess/demos/fogEdgeScenario";
import { parseScFen } from "~/starchess/scfen";
import type { ScAction, ScFenSnapshot } from "~/starchess/types";

/**
 * Bd4 (5×5 lit), Ka1; black pawn g7 (outside vision) on d4–h8;
 * black king on h8 — also fogged. Intent `C=d4h8` is SCFEN-legal.
 */
export const FOG_EDGE_BISHOP_START_SCFEN =
  "SCFEN|7k/6p1/8/8/3B4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";

export type FogEdgeStep = {
  caption: string;
  intentCaption?: string;
  actions: readonly Omit<ScAction, "seq">[];
};

export const FOG_EDGE_BISHOP_STEPS: readonly FogEdgeStep[] = [
  {
    intentCaption:
      "Intent · Bd4→h8 · ghost on h8 (king + pawn hidden in fog — SCFEN-legal)",
    caption: "1. Bd4→h8 → Bxg7 · path discover pawn, stop (king spared)",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "d4", to: "h8" },
    ],
  },
];

export const queueFogEdgeStep = (
  snap: ScFenSnapshot,
  step: FogEdgeStep,
): ScFenSnapshot => {
  let next: ScFenSnapshot = { ...snap, queue: { actions: [] } };
  for (const action of step.actions) {
    next = addScAction({ snapshot: next, action }).snapshot;
  }
  return next;
};

export const buildFogEdgeBishopPlys = (): ScFenSnapshot[] => {
  const plies: ScFenSnapshot[] = [parseScFen(FOG_EDGE_BISHOP_START_SCFEN)];
  let cur = plies[0]!;
  for (const step of FOG_EDGE_BISHOP_STEPS) {
    cur = endScTurn(queueFogEdgeStep(cur, step)).next;
    plies.push(cur);
  }
  return plies;
};

export const FOG_EDGE_BISHOP_PLY_SC: readonly ScFenSnapshot[] =
  buildFogEdgeBishopPlys();

/** Story feed — DualNav package (no logic in `*.stories.tsx`). */
export const FOG_EDGE_BISHOP_SCENARIO: FogEdgeScenario = {
  plies: FOG_EDGE_BISHOP_PLY_SC,
  steps: FOG_EDGE_BISHOP_STEPS,
  startCaption:
    "Start · Bd4 · g7 pawn + h8 king both in fog · intent h8 is SCFEN-legal",
  queueStep: (snap, i) => queueFogEdgeStep(snap, FOG_EDGE_BISHOP_STEPS[i]!),
};
