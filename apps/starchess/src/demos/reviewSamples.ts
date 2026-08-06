/**
 * DualNav review packages for Demo stories (observer, not live).
 * Stories mount these into FogEdgeDemo — no queue/resolve in `*.stories.tsx`.
 * // SPEC: _spec/apps/ui/starchess/demos.puml
 */
import {
  addScAction,
  endScTurn,
  parseScFen,
  type ScActionInput,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import type { FogEdgeScenario } from "~/demos/fogEdgeScenario";
import {
  COMBAT_CHAIN_START_SCFEN,
  PROMOTION_CLEAN_SCFEN,
  PROMOTION_MINE_SCFEN,
} from "~/stories/fixtures/seeds";

export type ReviewStep = {
  caption: string;
  intentCaption: string;
  actions: readonly ScActionInput[];
};

const queueStep = (snap: ScFenSnapshot, step: ReviewStep): ScFenSnapshot => {
  let next: ScFenSnapshot = { ...snap, queue: { actions: [] } };
  for (const action of step.actions) {
    next = addScAction({ snapshot: next, action }).snapshot;
  }
  return next;
};

const buildPlys = (
  startScfen: string,
  steps: readonly ReviewStep[],
): ScFenSnapshot[] => {
  const plies: ScFenSnapshot[] = [parseScFen(startScfen)];
  let cur = plies[0]!;
  for (const step of steps) {
    cur = endScTurn(queueStep(cur, step)).next;
    plies.push(cur);
  }
  return plies;
};

const observerScenario = (
  plies: readonly ScFenSnapshot[],
  steps: readonly ReviewStep[],
  startCaption: string,
  reviewLabel: string,
): FogEdgeScenario => ({
  plies,
  steps,
  startCaption,
  reviewLabel,
  visionMode: "observer",
  fog: false,
  queueStep: (snap, i) => queueStep(snap, steps[i]!),
});

/** Pe7 → e8=Q (clean last-rank promote). */
export const PROMOTION_STEPS: readonly ReviewStep[] = [
  {
    intentCaption: "Intent · Pe7→e8=Q · ghost on e8",
    caption: "1. Pe7–e8=Q · land as pawn → walk off → battlecruiser deploy",
    actions: [
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      },
    ],
  },
];

export const PROMOTION_SCENARIO = observerScenario(
  buildPlys(PROMOTION_CLEAN_SCFEN, PROMOTION_STEPS),
  PROMOTION_STEPS,
  "Start · Pe7 · last rank empty · DualNav intent → promote",
  "Promotion",
);

/** Pe7 → e8 onto black spider mine — mutual clear, no queen. */
export const PROMOTION_MINE_STEPS: readonly ReviewStep[] = [
  {
    intentCaption: "Intent · Pe7→e8=Q · mine on e8",
    caption: "1. Pe7–e8 · walk onto mine · blast · no promote",
    actions: [
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      },
    ],
  },
];

export const PROMOTION_MINE_SCENARIO = observerScenario(
  buildPlys(PROMOTION_MINE_SCFEN, PROMOTION_MINE_STEPS),
  PROMOTION_MINE_STEPS,
  "Start · Pe7 · black mine e8 · DualNav intent → walk-over interrupt",
  "Promotion × mine",
);

/** One combat-chain turn: W d2–d4 & B Be8–c6. */
export const QUEUE_AND_END_STEPS: readonly ReviewStep[] = [
  {
    intentCaption: "Intent · Wd2–d4 & Be8–c6",
    caption: "1. d2–d4 & Be8–c6 · both classicals resolve",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "d2", to: "d4" },
      { timing: "C", kind: "classical", color: "b", from: "e8", to: "c6" },
    ],
  },
];

export const QUEUE_AND_END_SCENARIO = observerScenario(
  buildPlys(COMBAT_CHAIN_START_SCFEN, QUEUE_AND_END_STEPS),
  QUEUE_AND_END_STEPS,
  "Start · tank on c3 · DualNav queue both sides → End",
  "Queue then End",
);
