/**
 * Collision race demos — mid-path block, same-square land, knight speed.
 * // SPEC: _spec/packages/starchess-core/resolve.puml, _spec/apps/starchess/demos.puml
 */
import {
  addScAction,
  endScTurn,
  parseScFen,
  refillTurnGas,
  type ScActionInput,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import type { FogEdgeScenario } from "~/types/demos";

export type CollisionRaceStep = {
  caption: string;
  intentCaption?: string;
  actions: readonly ScActionInput[];
};

const queueStep = (
  snap: ScFenSnapshot,
  step: CollisionRaceStep,
): ScFenSnapshot => {
  // Match buildReviewHistory: turn-open gas before queueing specials.
  let next: ScFenSnapshot = { ...refillTurnGas(snap), queue: { actions: [] } };
  for (const action of step.actions) {
    next = addScAction({ snapshot: next, action }).snapshot;
  }
  return next;
};

const buildPlys = (
  start: string,
  steps: readonly CollisionRaceStep[],
): ScFenSnapshot[] => {
  const plies: ScFenSnapshot[] = [parseScFen(start)];
  let cur = plies[0]!;
  for (const step of steps) {
    cur = endScTurn(queueStep(cur, step), { skipTurnStartChecks: true }).next;
    plies.push(cur);
  }
  return plies;
};

/** Re1→e8 through fogged pe7 with re8 beyond — must capture pawn, not skip to rook. */
export const COLLISION_PATH_BLOCK_START =
  "SCFEN|k3r3/4p3/8/8/8/8/8/K3R3|1|33|P|G:11:11|Q:w:;b:";

export const COLLISION_PATH_BLOCK_STEPS: readonly CollisionRaceStep[] = [
  {
    intentCaption: "Intent · Re1→e8 · ghost on e8 (pe7 + re8 in fog)",
    caption: "1. Re1→e8 → Rxe7 · discover pawn, occupy (re8 survives)",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "e1", to: "e8" },
    ],
  },
];

export const COLLISION_PATH_BLOCK_SCENARIO: FogEdgeScenario = {
  plies: buildPlys(COLLISION_PATH_BLOCK_START, COLLISION_PATH_BLOCK_STEPS),
  steps: COLLISION_PATH_BLOCK_STEPS,
  startCaption:
    "Start · Re1 · pe7 + re8 in fog · arrow = intent e8, again = Rxe7",
  queueStep: (snap, i) =>
    queueStep(snap, COLLISION_PATH_BLOCK_STEPS[i]!),
};

/** Ally Pe7 blocks Re1→e8 — truncate e6, no capture. */
export const COLLISION_ALLY_BLOCK_START =
  "SCFEN|k3r3/4P3/8/8/8/8/8/K3R3|1|33|P|G:11:11|Q:w:;b:";

export const COLLISION_ALLY_BLOCK_STEPS: readonly CollisionRaceStep[] = [
  {
    intentCaption: "Intent · Re1→e8 · ally pawn e7 blocks",
    caption: "1. Re1→e8 → stop e6 · ally truncate (no capture)",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "e1", to: "e8" },
    ],
  },
];

export const COLLISION_ALLY_BLOCK_SCENARIO: FogEdgeScenario = {
  plies: buildPlys(COLLISION_ALLY_BLOCK_START, COLLISION_ALLY_BLOCK_STEPS),
  steps: COLLISION_ALLY_BLOCK_STEPS,
  startCaption:
    "Start · Re1 · ally Pe7 · re8 · arrow = intent e8, again = stop e6",
  queueStep: (snap, i) =>
    queueStep(snap, COLLISION_ALLY_BLOCK_STEPS[i]!),
};

/** Bd4→e5 (1sq) vs bb8→e5 (3sq) — race: both die, square empty. */
export const COLLISION_SAME_SQUARE_START =
  "SCFEN|1b2k3/8/8/8/3B4/8/8/4K3|1|33|P|G:11:11|Q:w:;b:";

export const COLLISION_SAME_SQUARE_STEPS: readonly CollisionRaceStep[] = [
  {
    intentCaption: "Intent · Bd4→e5 (1) & bb8→e5 (3)",
    caption: "1. Both to e5 · race collision · both die",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "d4", to: "e5" },
      { timing: "C", kind: "classical", color: "b", from: "b8", to: "e5" },
    ],
  },
];

export const COLLISION_SAME_SQUARE_SCENARIO: FogEdgeScenario = {
  plies: buildPlys(COLLISION_SAME_SQUARE_START, COLLISION_SAME_SQUARE_STEPS),
  steps: COLLISION_SAME_SQUARE_STEPS,
  startCaption:
    "Start · bishops race e5 · white 1sq / black 3sq · both die",
  queueStep: (snap, i) =>
    queueStep(snap, COLLISION_SAME_SQUARE_STEPS[i]!),
};

/**
 * Knight → e4 + gas pawn flee + bishop → e4 (1sq demo; 2/3 in core + e2e seeds).
 * Pre-queued SCFEN: addScAction rejects C onto e4 while the pawn still sits there
 * at queue time (B projection is live-UI only). Wire Q: is the source of truth.
 */
export const COLLISION_KNIGHT_SPEED_START =
  "SCFEN|4k3/8/3n4/3B4/4P3/8/8/4K3|1|33|P|G:11:11|Q:w:;b:";

/** Gas already spent on the wire (rem 0 of income 1). */
export const COLLISION_KNIGHT_SPEED_QUEUED =
  "SCFEN|4k3/8/3n4/3B4/4P3/8/8/4K3|1|33|P|G:01:11|Q:w:B=pawnDouble:e4:e5,C=d5e4;b:C=d6e4";

export const COLLISION_KNIGHT_SPEED_STEPS: readonly CollisionRaceStep[] = [
  {
    intentCaption: "Intent · gas Pe4→e5 · Bd5→e4 · nd6→e4",
    caption: "1. Pawn flees · bishop + knight race e4 · both die",
    actions: [
      {
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "e4",
        to: "e5",
      },
      { timing: "C", kind: "classical", color: "w", from: "d5", to: "e4" },
      { timing: "C", kind: "classical", color: "b", from: "d6", to: "e4" },
    ],
  },
];

const knightSpeedStart = parseScFen(COLLISION_KNIGHT_SPEED_START);
const knightSpeedQueued = parseScFen(COLLISION_KNIGHT_SPEED_QUEUED);
const knightSpeedAfter = endScTurn(knightSpeedQueued, {
  skipTurnStartChecks: true,
}).next;

export const COLLISION_KNIGHT_SPEED_SCENARIO: FogEdgeScenario = {
  plies: [knightSpeedStart, knightSpeedAfter],
  steps: COLLISION_KNIGHT_SPEED_STEPS,
  startCaption:
    "Start · Nd6 / Bd5 / Pe4 · gas flee + both to e4 · both die",
  queueStep: () => parseScFen(COLLISION_KNIGHT_SPEED_QUEUED),
};

/** Pre-queued SCFEN strings for live e2e (`single?scfen=`). */
export const COLLISION_E2E = {
  pathBlock:
    "SCFEN|k3r3/4p3/8/8/8/8/8/K3R3|1|33|P|G:11:11|Q:w:C=e1e8;b:",
  allyBlock:
    "SCFEN|k3r3/4P3/8/8/8/8/8/K3R3|1|33|P|G:11:11|Q:w:C=e1e8;b:",
  sameSquare:
    "SCFEN|1b2k3/8/8/8/3B4/8/8/4K3|1|33|P|G:11:11|Q:w:C=d4e5;b:C=b8e5",
  // G: rem includes the pawnDouble spend already on the wire (1 spent → rem 0 of income 1).
  knightSpeed1:
    "SCFEN|4k3/8/3n4/3B4/4P3/8/8/4K3|1|33|P|G:01:11|Q:w:B=pawnDouble:e4:e5,C=d5e4;b:C=d6e4",
  knightSpeed2:
    "SCFEN|4k3/8/2Bn4/8/4P3/8/8/4K3|1|33|P|G:01:11|Q:w:B=pawnDouble:e4:e5,C=c6e4;b:C=d6e4",
  knightSpeed3:
    "SCFEN|4k3/8/3n4/8/4P3/8/8/1B2K3|1|33|P|G:01:11|Q:w:B=pawnDouble:e4:e5,C=b1e4;b:C=d6e4",
} as const;
