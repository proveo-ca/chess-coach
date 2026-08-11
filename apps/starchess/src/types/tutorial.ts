/** Tutorial stage ids (Breadcrumb / routes / script). */

import type { Square } from "chess.js";

import type { KerriganEmotion } from "~/types/coach";

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
  | { kind: "goSection"; section: TutorialSectionId; label: string };

/** One revealed line in the resolve typewriter footer nav. */
export type TypewriterLine = {
  text: string;
  indent?: boolean;
};

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

/** Board hint step — first matching entry wins (SCFEN `when`, else fallback). */
export type TutorialBoardHint = {
  when?: { kind: "scfen"; re: RegExp };
  squares: readonly Square[];
};

/** Auto-advance to next lesson when live intent / board matches. */
export type TutorialCompleteWhen =
  | {
      kind: "scfen";
      re: RegExp;
      /** Hold before Next Lesson (ms). Default 0. */
      delayMs?: number;
    }
  | {
      /** Live intent queue — classical + special stack (gas↔move, etc.). */
      kind: "queue";
      /** Require a `C` classical action. */
      classical?: boolean;
      /** Require this special kind on B or F (e.g. `pawnDouble`). */
      specialKind?: string;
      delayMs?: number;
    }
  | {
      /** Typewriter stepper (Turn Resolution) at a given turn + beat. */
      kind: "typewriter";
      turn: number;
      beat: "turn" | "check" | "intent" | "resolve";
      delayMs?: number;
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
};

/**
 * Latch for guide bubble: story intro only before the first action/reaction.
 * After that, keep the last reaction (never bounce back to the opening line).
 */
export type TutorialLineHold = {
  lessonKey: string;
  /** First live SCFEN seen for this lesson (seed). */
  baselineScfen?: string;
  /** Intro already retired (user acted or a reaction fired). */
  introDone: boolean;
  /** Last reaction line to keep when no when-clause matches. */
  sticky?: TutorialLine;
};
