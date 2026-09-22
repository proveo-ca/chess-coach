// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/** Tutorial stage ids (Breadcrumb / routes / script). */

import type { Square } from "chess.js";

import type { ScPiece } from "@chess-coach/starchess-core";
import type { KerriganEmotion } from "~/types/coach";
import type { ReviewTurnPhase } from "~/types/review";

export type TutorialSectionId = "fog" | "specials" | "resolve" | "king";

/** Resolve timeline wave partitions for tutorial steppers. */
export type ResolveWaveId =
  | "specialBefore"
  | "attack"
  | "move"
  | "specialAfter";

/** Optional in-bubble CTA from a tutorial reaction or story intro. */
export type TutorialReactionAction =
  | { kind: "retryLesson"; label?: string }
  | { kind: "nextLesson"; label?: string }
  | { kind: "goSection"; section: TutorialSectionId; label: string };

/** Flat beat cursor: Turn N → Check → Intent → Resolve. */
export type TypewriterBeat =
  | { kind: "turn"; turn: number; resolveIndex: number; text: string }
  | {
      kind: "check";
      resolveIndex: number;
      hasCheck: boolean;
      text: string;
    }
  | { kind: "intent"; resolveIndex: number; text: string }
  | { kind: "resolve"; resolveIndex: number; text: string };

/**
 * Seed + board chrome for a live lesson — the catalog half of a story.
 * Storybook projects these; it never declares its own.
 */
export type LiveLessonBoard = {
  /** Opening position for this lesson. */
  scfen: string;
  /** Starting minerals for the viewer (defaults per host). */
  stored?: number;
  /** Force every rook into a mode the seed cannot express. */
  rookMode?: "tank" | "siege";
  /** Auto-End threshold once the player has queued. */
  endTurnAfterQueue?: "first" | "moveAndSpecial";
  /** Script-driven opponent for live lessons. */
  opponent?: "adjutant";
  /**
   * Planning timer. `false` disables it (fog / specials lessons teach without
   * clock pressure); omitted means enabled, matching `autoArmTimer !== false`.
   */
  armTimer?: boolean;
  /**
   * The player-facing goal, shown persistently while the lesson is active so
   * it survives coach reactions. Falls back to the story's opening comment.
   */
  objective?: string;
  /**
   * What this board demonstrates, in prose. Storybook renders it as the story
   * description — the copy lives with the lesson, not in the story file.
   */
  docs?: string;
  /**
   * Imperative store choreography this lesson needs — a scripted opening or a
   * terminal condition. Resolved through the `demos/choreography/` registry.
   */
  choreography?: LessonChoreographyId;
};

/** Lessons whose behavior is more than config. Registry: `demos/choreography/`. */
export type LessonChoreographyId =
  | "kingDefenseOpening"
  | "kingDefenseIIChecks"
  | "kingAttackTankCounter"
  | "kingHuntGraduation"
  | "siegeFocusCounter"
  | "pawnGasDefenseCounter"
  | "shipSnipeCounter"
  | "mineRa1Counter";

/**
 * Hint line drawn square-to-square — for a claim a ring cannot make, like the
 * long diagonal a piece x-rays down. Purely presentational; the board does not
 * check that the line is legal or unobstructed.
 */
export type TutorialBoardArrow = {
  from: Square;
  to: Square;
  /** Elbow of an L path (a knight hop). Straight when omitted. */
  via?: Square;
  /** Alert red. Omitted arrows stay guide green. */
  tone?: "alert";
};

/** Board hint step — first matching entry wins (SCFEN `when`, else fallback). */
export type TutorialBoardHint = {
  when?:
    | { kind: "scfen"; re: RegExp; phases?: readonly ReviewTurnPhase[] }
    | { kind: "reviewPhase"; phase: ReviewTurnPhase; /** 1-based planning ordinal. */ turn?: number }
    | TutorialCoversWhen
    | TutorialTrajectoryWhen;
  /** Guide-green rings. */
  squares?: readonly Square[];
  /** Alert-red rings. Same step as `squares`; both paint together. */
  alertSquares?: readonly Square[];
  arrows?: readonly TutorialBoardArrow[];
};

/** One viewer-side unit covering a square, via core attack geometry. */
export type SquareCoverer = {
  from: Square;
  kind: ScPiece["type"];
};

/** Enemy-occupied watch squares mapped to their current coverers. */
export type SquareCovers = Partial<Record<Square, SquareCoverer[]>>;

/** Live tactics beat — fires when listed kinds cover the square. */
export type TutorialCoversWhen = {
  kind: "covers";
  square: Square;
  kinds?: readonly ScPiece["type"][];
};

/** Staging post against the enemy Command Center (deploy or ride target). */
export type AttackTrajectory = {
  /** Stable key for tests/debug (e.g. "deploy-b-g2-d5"). */
  key: string;
  /** Square to stage on — the drop or ride destination. */
  from: Square;
  /** Enemy Command Center square the staging attacks. */
  to: Square;
};

/** Live tactics beat — fires when the staging post is available. */
export type TutorialTrajectoryWhen = {
  kind: "trajectory";
  from: Square;
  to: Square;
};

/** Auto-advance to next lesson when live intent / board matches. */
export type TutorialCompleteWhen =
  | {
      kind: "scfen";
      re: RegExp;
    }
  | {
      /** Live intent queue — classical + special stack (gas↔move, etc.). */
      kind: "queue";
      /** Require a `C` classical action. */
      classical?: boolean;
      /** Require this special kind on B or F (e.g. `pawnDouble`). */
      specialKind?: string;
    }
  | {
      /** Typewriter stepper (Turn Resolution) at a given turn + beat. */
      kind: "typewriter";
      turn: number;
      beat: "turn" | "check" | "intent" | "resolve";
    }
  | {
      /** Auto-advance after ms on the lesson — no board action required. */
      kind: "elapsed";
      ms: number;
    };

/** One guide-bubble line (intro or reaction). */
export type TutorialLine = {
  comment: string;
  emotion?: KerriganEmotion;
  action?: TutorialReactionAction;
  /** `intro` = story.comment fallback; `reaction` = when-clause hit. */
  source: "intro" | "reaction";
  /** Momentary beat — shown while matched, never latched as the sticky line. */
  transient?: boolean;
};

/**
 * Latch for guide bubble: story intro only before the first action/reaction.
 * After that, keep the last reaction (never bounce back to the opening line).
 */
export type TutorialLineHold = {
  lessonKey: string;
  /** First live SCFEN seen for this lesson (seed). */
  baselineScfen?: string;
  /** Last `turnStartChecksApplied` seen — the flip re-baselines the seed. */
  checksApplied?: boolean;
  /** Intro already retired (user acted or a reaction fired). */
  introDone: boolean;
  /** Last reaction line to keep when no when-clause matches. */
  sticky?: TutorialLine;
};
