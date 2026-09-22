/**
 * Tutorial narration bridge — demos push MatchStore phase; header reads Selena lines.
 */
import { createSignal } from "solid-js";

import type { ReviewTurnPhase } from "~/types/review";
import type { AttackTrajectory, SquareCovers } from "~/types/tutorial";

/** Compact live intent queue entry for completeWhen / reactions. */
export type TutorialQueueAction = {
  timing: string;
  kind: string;
  color: string;
};

export type TutorialNarrationState = {
  reviewPhase?: ReviewTurnPhase;
  timelineActive?: boolean;
  /** Live `formatScFen` for script `scfen` reactions. */
  scfen?: string;
  /**
   * Whether turn-open checks have landed on the live board. Turn-open is engine
   * bookkeeping (gas refill, check damage) that moves the SCFEN with no player
   * input — `holdTutorialLine` needs it to tell that apart from a real action.
   * Three-valued: `undefined` means this host does not run a live planning turn
   * (the review / typewriter hosts), and `holdTutorialLine` then no-ops.
   */
  turnStartChecksApplied?: boolean;
  /** 1-based planning ordinal (`snap.turn + 1`; seed turn 0 → 1). */
  turn?: number;
  /** Live SCFEN queue actions (intent) — preferred over wire regex for stacks. */
  queue?: readonly TutorialQueueAction[];
  /** Live targeting mode (`bishopSnipe`, `queenWarp`, `spawn`, …). */
  targetingKind?: string | null;
  /** Enemy-occupied watch squares mapped to their current coverers. */
  covers?: SquareCovers;
  /** Open staging posts against the enemy Command Center. */
  trajectories?: AttackTrajectory[];
  /** White BattleShip was lost on h8 during the resolve now playing. */
  shipSniped?: boolean;
  /** Tutorial typewriter cursor (Turn Resolution steppers). */
  typewriterTurn?: number;
  typewriterBeat?: "turn" | "check" | "intent" | "resolve";
};

export const [tutorialNarration, setTutorialNarration] =
  createSignal<TutorialNarrationState>({});

export const resetTutorialNarration = () => setTutorialNarration({});
