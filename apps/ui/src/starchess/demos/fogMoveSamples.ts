/**
 * Fog + move DualNav samples — quiet relocate with intent ghost → resolve.
 * Used by Fog of War and Move Animations stories (King / Pawn / Knight / Queen).
 * // SPEC: _spec/apps/ui/starchess/scfen.md §3, §5
 */

import { addScAction } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import type { FogEdgeScenario } from "~/starchess/demos/fogEdgeScenario";
import { parseScFen } from "~/starchess/scfen";
import type { ScAction, ScFenSnapshot } from "~/starchess/types";

export type FogMoveStep = {
  caption: string;
  /** Shown while the dashed intent ring is up (before End/resolve). */
  intentCaption: string;
  actions: readonly Omit<ScAction, "seq">[];
};

const queueStep = (snap: ScFenSnapshot, step: FogMoveStep): ScFenSnapshot => {
  let next: ScFenSnapshot = { ...snap, queue: { actions: [] } };
  for (const action of step.actions) {
    next = addScAction({ snapshot: next, action }).snapshot;
  }
  return next;
};

const buildPlys = (startScfen: string, steps: readonly FogMoveStep[]): ScFenSnapshot[] => {
  const plies: ScFenSnapshot[] = [parseScFen(startScfen)];
  let cur = plies[0]!;
  for (const step of steps) {
    cur = endScTurn(queueStep(cur, step)).next;
    plies.push(cur);
  }
  return plies;
};

const scenarioFor = (
  plies: readonly ScFenSnapshot[],
  steps: readonly FogMoveStep[],
  startCaption: string,
  reviewLabel: string,
): FogEdgeScenario => ({
  plies,
  steps,
  startCaption,
  reviewLabel,
  queueStep: (snap, i) => queueStep(snap, steps[i]!),
});

/** Kd4 3×3 vision; quiet step e5 expands fog. */
export const FOG_MOVE_KING_START_SCFEN =
  "SCFEN|7k/7p/8/8/3K4/8/8/8|0|33|P|G:11:11|Q:w:;b:";

export const FOG_MOVE_KING_STEPS: readonly FogMoveStep[] = [
  {
    intentCaption: "Intent · Kd4→e5 · ghost on e5 (unit stays on d4)",
    caption: "1. Kd4–e5 · resolve slide + progressive fog",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "d4", to: "e5" },
    ],
  },
];

export const queueFogMoveKingStep = (snap: ScFenSnapshot, step: FogMoveStep) =>
  queueStep(snap, step);

export const FOG_MOVE_KING_PLY_SC = buildPlys(
  FOG_MOVE_KING_START_SCFEN,
  FOG_MOVE_KING_STEPS,
);

export const FOG_MOVE_KING_SCENARIO = scenarioFor(
  FOG_MOVE_KING_PLY_SC,
  FOG_MOVE_KING_STEPS,
  "Start · Kd4 · 3×3 vision · arrow = intent ghost, again = resolve",
  "King move",
);

/** Pd4 wedge + Ka1; step d5. */
export const FOG_MOVE_PAWN_START_SCFEN =
  "SCFEN|7k/8/8/8/3P4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";

export const FOG_MOVE_PAWN_STEPS: readonly FogMoveStep[] = [
  {
    intentCaption: "Intent · Pd4→d5 · ghost on d5",
    caption: "1. Pd4–d5 · resolve hop + fog",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "d4", to: "d5" },
    ],
  },
];

export const queueFogMovePawnStep = (snap: ScFenSnapshot, step: FogMoveStep) =>
  queueStep(snap, step);

export const FOG_MOVE_PAWN_PLY_SC = buildPlys(
  FOG_MOVE_PAWN_START_SCFEN,
  FOG_MOVE_PAWN_STEPS,
);

export const FOG_MOVE_PAWN_SCENARIO = scenarioFor(
  FOG_MOVE_PAWN_PLY_SC,
  FOG_MOVE_PAWN_STEPS,
  "Start · Pd4 + Ka1 · arrow = intent ghost, again = resolve",
  "Pawn move",
);

/** Nd4; leap to e6. */
export const FOG_MOVE_KNIGHT_START_SCFEN =
  "SCFEN|7k/7p/8/8/3N4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";

export const FOG_MOVE_KNIGHT_STEPS: readonly FogMoveStep[] = [
  {
    intentCaption: "Intent · Nd4→e6 · ghost on e6",
    caption: "1. Nd4–e6 · resolve L-path + fog",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "d4", to: "e6" },
    ],
  },
];

export const queueFogMoveKnightStep = (snap: ScFenSnapshot, step: FogMoveStep) =>
  queueStep(snap, step);

export const FOG_MOVE_KNIGHT_PLY_SC = buildPlys(
  FOG_MOVE_KNIGHT_START_SCFEN,
  FOG_MOVE_KNIGHT_STEPS,
);

export const FOG_MOVE_KNIGHT_SCENARIO = scenarioFor(
  FOG_MOVE_KNIGHT_PLY_SC,
  FOG_MOVE_KNIGHT_STEPS,
  "Start · Nd4 · arrow = intent ghost, again = resolve",
  "Knight move",
);

/** Qd4 7×7; step to d6. */
export const FOG_MOVE_QUEEN_START_SCFEN =
  "SCFEN|7k/8/8/8/3Q4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";

export const FOG_MOVE_QUEEN_STEPS: readonly FogMoveStep[] = [
  {
    intentCaption: "Intent · Qd4→d6 · ghost on d6",
    caption: "1. Qd4–d6 · resolve slide + fog",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "d4", to: "d6" },
    ],
  },
];

export const queueFogMoveQueenStep = (snap: ScFenSnapshot, step: FogMoveStep) =>
  queueStep(snap, step);

export const FOG_MOVE_QUEEN_PLY_SC = buildPlys(
  FOG_MOVE_QUEEN_START_SCFEN,
  FOG_MOVE_QUEEN_STEPS,
);

export const FOG_MOVE_QUEEN_SCENARIO = scenarioFor(
  FOG_MOVE_QUEEN_PLY_SC,
  FOG_MOVE_QUEEN_STEPS,
  "Start · Qd4 · 7×7 vision · arrow = intent ghost, again = resolve",
  "Queen move",
);
