/**
 * Fog-edge rook (tank) — SCFEN intent into fog past a hidden unit → resolve Rxd7.
 * // SPEC: _spec/packages/starchess-core/resolve.puml, _spec/apps/starchess/demos.puml
 */
import {
  addScAction,
  endScTurn,
  parseScFen,
  type ScActionInput,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import type { FogEdgeScenario } from "~/types/demos";

/** Rd4 tank 5×5 lit, Ka1; black pawn on d7 (outside lit); intent past to d8. */
export const FOG_EDGE_PACKED_TANK_START_SCFEN =
  "SCFEN|7k/3p4/8/8/3R4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";

export type FogEdgeTankStep = {
  caption: string;
  intentCaption?: string;
  actions: readonly ScActionInput[];
};

export const FOG_EDGE_PACKED_TANK_STEPS: readonly FogEdgeTankStep[] = [
  {
    intentCaption:
      "Intent · Rd4→d8 · ghost on d8 (SCFEN-legal into fog; unit stays on d4)",
    caption: "1. Rd4→d8 → Rxd7 · path discover + attack + occupy",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "d4", to: "d8" },
    ],
  },
];

export const queueFogEdgePackedTankStep = (
  snap: ScFenSnapshot,
  step: FogEdgeTankStep,
): ScFenSnapshot => {
  let next: ScFenSnapshot = { ...snap, queue: { actions: [] } };
  for (const action of step.actions) {
    next = addScAction({ snapshot: next, action }).snapshot;
  }
  return next;
};

export const buildFogEdgePackedTankPlys = (): ScFenSnapshot[] => {
  const plies: ScFenSnapshot[] = [parseScFen(FOG_EDGE_PACKED_TANK_START_SCFEN)];
  let cur = plies[0]!;
  for (const step of FOG_EDGE_PACKED_TANK_STEPS) {
    cur = endScTurn(queueFogEdgePackedTankStep(cur, step)).next;
    plies.push(cur);
  }
  return plies;
};

export const FOG_EDGE_PACKED_TANK_PLY_SC: readonly ScFenSnapshot[] =
  buildFogEdgePackedTankPlys();

/** Story feed — DualNav package (no logic in `*.stories.tsx`). */
export const FOG_EDGE_PACKED_TANK_SCENARIO: FogEdgeScenario = {
  plies: FOG_EDGE_PACKED_TANK_PLY_SC,
  steps: FOG_EDGE_PACKED_TANK_STEPS,
  startCaption:
    "Start · Rd4 tank · pawn d7 in fog · arrow = intent d8, again = resolve Rxd7",
  queueStep: (snap, i) =>
    queueFogEdgePackedTankStep(snap, FOG_EDGE_PACKED_TANK_STEPS[i]!),
  packedTank: true,
};
