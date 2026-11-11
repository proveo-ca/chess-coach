// SPEC: _spec/apps/starchess/demos.puml, _spec/apps/starchess/architecture/screen-entities.puml
/**
 * Combat Chain — DualNav review via MatchStore (observer).
 */
import type { Component } from "solid-js";

import { buildReviewHistory } from "~/app/reviewHistory";
import { COMBAT_CHAIN_PLY_SC, COMBAT_CHAIN_STEPS, queueCombatChainStep } from "~/demos/combatChain";
import { ReviewDemoScreen } from "~/demos/ReviewDemoScreen";

const HISTORY = buildReviewHistory({
  start: COMBAT_CHAIN_PLY_SC[0]!,
  steps: COMBAT_CHAIN_STEPS,
  startCaption: "Start · tank on c3 · use arrows to review turns",
  queueStep: (snap, i) => queueCombatChainStep(snap, COMBAT_CHAIN_STEPS[i]!),
});

export const CombatChainDemo: Component = () => (
  <ReviewDemoScreen
    history={HISTORY}
    reviewLabel="Combat chain"
    visionMode="observer"
    fog={false}
    variant="eclipse"
  />
);
