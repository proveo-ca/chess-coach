/**
 * King Hunt — DualNav review via MatchStore (check → intent → resolve).
 * // SPEC: _spec/apps/starchess/demos.puml
 */
import type { Component } from "solid-js";

import { buildReviewHistory } from "~/app/reviewHistory";
import {
  KING_HUNT_PLY_SC,
  KING_HUNT_START_SCFEN,
  KING_HUNT_STEPS,
  buildKingHuntPlys,
  queueKingHuntStep,
} from "~/demos/kingHunt";
import { ReviewDemoScreen } from "~/demos/ReviewDemoScreen";

export {
  KING_HUNT_PLY_SC,
  KING_HUNT_START_SCFEN,
  KING_HUNT_STEPS,
  buildKingHuntPlys,
  queueKingHuntStep,
};

const HISTORY = buildReviewHistory({
  start: KING_HUNT_PLY_SC[0]!,
  steps: KING_HUNT_STEPS,
  startCaption: "Start · ka8 · tank g6 · Nc5 checks Ke4 · use arrows (check → intent → resolve)",
  queueStep: (snap, i) => queueKingHuntStep(snap, KING_HUNT_STEPS[i]!),
});

export const KingHuntDemo: Component = () => (
  <ReviewDemoScreen
    history={HISTORY}
    reviewLabel="King hunt"
    visionMode="observer"
    fog={false}
    variant="eclipse"
  />
);
