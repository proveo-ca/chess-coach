/**
 * Intent / board-vision policy for live vs DualNav review.
 * Owns which side’s queue is visible given {@link ReviewVisionFilter}.
 * Board only paints; it does not decide whose intents exist.
 */
import type { ScAction, StarChessColor } from "@chess-coach/starchess-core";

import type { ReviewVisionFilter, VisionMode } from "~/types/board";
import type { MatchPhase } from "~/types/match";

/** Whose intents to surface — `undefined` = omniscient (BOTH / DualNav). */
export const intentOverlayViewer = (
  phase: MatchPhase,
  matchViewer: StarChessColor,
  filter: ReviewVisionFilter,
): StarChessColor | undefined => {
  if (phase !== "gameOver") return matchViewer;
  return filter === "both" ? undefined : filter;
};

/**
 * Queue actions visible for intent overlays.
 * Live / VISION w|b: that side only. Review BOTH: both sides (omniscient DualNav).
 */
export const intentOverlayActions = (
  phase: MatchPhase,
  matchViewer: StarChessColor,
  filter: ReviewVisionFilter,
  liveQueue: readonly ScAction[] | undefined,
  reviewIntentActions: readonly ScAction[] | null,
): readonly ScAction[] | undefined => {
  const reviewing = phase === "gameOver";
  const raw = reviewing ? (reviewIntentActions ?? undefined) : liveQueue;
  const viewer = intentOverlayViewer(phase, matchViewer, filter);
  if (viewer && raw) return raw.filter((a) => a.color === viewer);
  return raw;
};

/**
 * Fog + vision mode for the board from review filter (and optional story overrides).
 * Live: fog on, player vision. Review BOTH: observer open board; VISION w/b: player fog.
 */
export const boardVisionFor = (
  phase: MatchPhase,
  filter: ReviewVisionFilter,
  overrides?: { fog?: boolean; visionMode?: VisionMode },
): { fog: boolean; visionMode: VisionMode } => {
  if (overrides?.visionMode) {
    return {
      fog: overrides.fog ?? overrides.visionMode === "player",
      visionMode: overrides.visionMode,
    };
  }
  if (phase !== "gameOver") {
    return { fog: overrides?.fog ?? true, visionMode: "player" };
  }
  if (filter === "both") {
    return { fog: false, visionMode: "observer" };
  }
  return { fog: true, visionMode: "player" };
};

/**
 * Player fog hides unseen enemies for classical click targets across all of
 * `apps/starchess` (live, tutorial, stories). Observer / fog-off previews keep
 * full occupancy. Soft SCFEN queue already allows intent through fog; this is
 * the matching UI seam — resolve still owns collisions.
 */
export const playerFogOccultsMoves = (vision: {
  fog: boolean;
  visionMode: VisionMode;
}): boolean => vision.fog && vision.visionMode === "player";
