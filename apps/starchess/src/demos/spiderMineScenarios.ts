/**
 * Spider Mine DualNav packages — FogEdgeDemo / Spider Mines stories.
 * SCFEN builders live in `demos/attackMine`, `pathCollide*`; promotion×mine
 * mirrors `@chess-coach/starchess-core` `tests/promotionMine.test.ts`.
 * // SPEC: _spec/apps/starchess/demos.puml
 */
import type { ScFenSnapshot } from "@chess-coach/starchess-core";

import {
  ATTACK_MINE_PLY_SC,
  ATTACK_MINE_STEPS,
  queueAttackMineStep,
} from "~/demos/attackMine";
import type { FogEdgeScenario } from "~/types/demos";
import {
  PATH_COLLIDE_ALLY_MINE_PLY_SC,
  PATH_COLLIDE_ALLY_MINE_STEPS,
  queuePathCollideAllyMineStep,
} from "~/demos/pathCollideAllyMine";
import {
  PATH_COLLIDE_PLY_SC,
  PATH_COLLIDE_STEPS,
  queuePathCollideStep,
} from "~/demos/pathCollide";
import { PROMOTION_MINE_SCENARIO } from "~/demos/reviewSamples";

const withIntent = (
  steps: readonly { caption: string }[],
): FogEdgeScenario["steps"] =>
  steps.map((s) => ({
    caption: s.caption,
    intentCaption: `Intent · ${s.caption}`,
  }));

export const ATTACK_MINE_SCENARIO: FogEdgeScenario = {
  plies: ATTACK_MINE_PLY_SC,
  steps: withIntent(ATTACK_MINE_STEPS),
  startCaption: "Start · Nb mine c3 · Nd1 · DualNav attack→occupy",
  reviewLabel: "Attack (mine)",
  visionMode: "observer",
  fog: false,
  queueStep: (snap: ScFenSnapshot, i: number) =>
    queueAttackMineStep(snap, ATTACK_MINE_STEPS[i]!),
};

export const PATH_COLLIDE_SCENARIO: FogEdgeScenario = {
  plies: PATH_COLLIDE_PLY_SC,
  steps: withIntent(PATH_COLLIDE_STEPS),
  startCaption: "Start · Nb a4 · DualNav path-collide chase boom",
  reviewLabel: "Attack (path collide)",
  visionMode: "observer",
  fog: false,
  queueStep: (snap, i) => queuePathCollideStep(snap, PATH_COLLIDE_STEPS[i]!),
};

export const PATH_COLLIDE_ALLY_MINE_SCENARIO: FogEdgeScenario = {
  plies: PATH_COLLIDE_ALLY_MINE_PLY_SC,
  steps: withIntent(PATH_COLLIDE_ALLY_MINE_STEPS),
  startCaption: "Start · Nw a4 · ally mine · DualNav chase boom",
  reviewLabel: "Attack (path collide · ally mine)",
  visionMode: "observer",
  fog: false,
  queueStep: (snap, i) =>
    queuePathCollideAllyMineStep(snap, PATH_COLLIDE_ALLY_MINE_STEPS[i]!),
};

/** `promotionMine.test.ts` — Pe7→e8 onto black spider mine. */
export const PROMOTION_ONTO_MINE_SCENARIO: FogEdgeScenario = {
  ...PROMOTION_MINE_SCENARIO,
  reviewLabel: "Promotion × mine",
};
