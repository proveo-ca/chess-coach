// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Per-lesson store choreography — the part of a lesson that is *not* config.
 * A lesson names one of these via `board.choreography`; {@link LiveLessonHost}
 * runs it. Each hook owns one scripted opening or one terminal condition.
 */
import type { Component } from "solid-js";

import { useKingAttackTankCounter } from "~/demos/choreography/useKingAttackTankCounter";
import { useKingDefenseOpening } from "~/demos/choreography/useKingDefenseOpening";
import { useKingDefenseIIChecks } from "~/demos/choreography/useKingDefenseIIChecks";
import { useKingHuntGraduation } from "~/demos/choreography/useKingHuntGraduation";
import { useMineRa1Counter } from "~/demos/choreography/useMineRa1Counter";
import { usePawnGasDefenseCounter } from "~/demos/choreography/usePawnGasDefenseCounter";
import { useShipSnipeCounter } from "~/demos/choreography/useShipSnipeCounter";
import { useSiegeFocusCounter } from "~/demos/choreography/useSiegeFocusCounter";
import type { MatchStore } from "~/types/match";
import type { LessonChoreographyId } from "~/types/tutorial";

export type ChoreographyContext = {
  /** Running inside `/tutorial` (vs a Storybook mount). */
  tutorial: boolean;
  onExitToMenu?: () => void;
};

export type ChoreographyResult = {
  /** Gate player input until a scripted opening has settled. */
  interactive?: () => boolean;
  /** Extra chrome rendered beside the board (e.g. a graduation modal). */
  Overlay?: Component;
};

export type LessonChoreography = (
  store: MatchStore,
  ctx: ChoreographyContext,
) => ChoreographyResult;

/**
 * Registry — `board.choreography` values resolve here. `satisfies` pins it to
 * the id union in `types/tutorial.ts`, so adding an id without a hook (or vice
 * versa) is a compile error.
 */
export const CHOREOGRAPHY = {
  kingDefenseOpening: useKingDefenseOpening,
  kingDefenseIIChecks: useKingDefenseIIChecks,
  kingAttackTankCounter: useKingAttackTankCounter,
  kingHuntGraduation: useKingHuntGraduation,
  siegeFocusCounter: useSiegeFocusCounter,
  pawnGasDefenseCounter: usePawnGasDefenseCounter,
  shipSnipeCounter: useShipSnipeCounter,
  mineRa1Counter: useMineRa1Counter,
} satisfies Record<LessonChoreographyId, LessonChoreography>;
