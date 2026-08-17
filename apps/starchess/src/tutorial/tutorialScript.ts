// SPEC: _spec/apps/starchess/menu-flow.puml, _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Tutorial script — Stage → Story → Selena comment (+ optional store/board reactions).
 */
import type { Square } from "chess.js";

import { TUTORIAL_SCRIPT_CONFIG } from "~/tutorial/tutorialScript.config";
import type { KerriganEmotion } from "~/types/coach";
import type {
  LiveLessonBoard,
  TutorialBoardArrow,
  TutorialBoardHint,
  TutorialCompleteWhen,
  TutorialLine,
  TutorialLineHold,
  TutorialReactionAction,
  TutorialSectionId,
} from "~/types/tutorial";
import type { ReviewTurnPhase } from "~/types/review";

export type {
  LiveLessonBoard,
  TutorialBoardArrow,
  TutorialBoardHint,
  TutorialCompleteWhen,
  TutorialLine,
  TutorialLineHold,
  TutorialReactionAction,
  TutorialSectionId,
} from "~/types/tutorial";

export type TutorialReactionWhen =
  /** DualNav / phase-stepper review phase. */
  | { kind: "reviewPhase"; phase: ReviewTurnPhase; /** 1-based planning ordinal. */ turn?: number }
  /** Timeline cues playing (resolve VFX). */
  | { kind: "timelineActive" }
  /** Fog section Chess skin toggle. */
  | { kind: "chessSkin"; chess: boolean }
  /** Live board SCFEN matches this pattern. */
  | { kind: "scfen"; re: RegExp }
  /** 1-based planning ordinal (`snap.turn + 1`; seed turn 0 → 1). */
  | { kind: "turn"; turn: number }
  /** Live targeting mode (e.g. Charon armed → `bishopSnipe`). */
  | { kind: "targeting"; targetingKind: string };

export type TutorialReaction = {
  when: TutorialReactionWhen;
  comment: string;
  emotion?: KerriganEmotion;
  /** Optional in-bubble CTA (e.g. retry after ally CC dies). */
  action?: TutorialReactionAction;
};

export type TutorialStoryScript = {
  id: string;
  title: string;
  /** Default Selena line when the story is focused. */
  comment: string;
  emotion?: KerriganEmotion;
  /** Optional CTA on the default intro line. */
  action?: TutorialReactionAction;
  /** Optional overlays when MatchStore / board state changes. */
  reactions?: readonly TutorialReaction[];
  /** Optional destination rings on the live board. */
  hints?: readonly TutorialBoardHint[];
  /**
   * Seed + board chrome for live lessons. Sole owner of the lesson catalog —
   * screens and Storybook both read it from here.
   */
  board?: LiveLessonBoard;
  /**
   * When live SCFEN matches (and timeline is idle), tutorial advances as if
   * the player clicked Next Lesson. Must not match the lesson seed SCFEN.
   */
  completeWhen?: TutorialCompleteWhen;
  /**
   * When matched after resolve, remount/restart this lesson (e.g. ship died).
   * Must not match the lesson seed SCFEN.
   */
  restartWhen?: TutorialCompleteWhen;
};

export type TutorialStageScript = {
  id: TutorialSectionId;
  label: string;
  stories: readonly TutorialStoryScript[];
};

/**
 * Runtime view of the content config. The data lives in
 * `tutorialScript.config.ts` — a checked, data-only config file. This module
 * owns the types, the accessors, and the line resolver; it holds no content.
 */
export type TutorialScriptConfig = readonly TutorialStageScript[];

export const TUTORIAL_SCRIPT: TutorialScriptConfig = TUTORIAL_SCRIPT_CONFIG;

/**
 * Hold between "objective complete" and the next lesson. One value for every
 * lesson — the guide bubble's border animation draws over exactly this long,
 * so the player sees the auto-press coming. Per-lesson overrides are gone on
 * purpose: the countdown is a UI affordance, not lesson content.
 */
export const LESSON_ADVANCE_MS = 3000;

/**
 * Reading time for the coach line a lesson closes on. The objective modal hides
 * that line (✓ + `Next lesson →` already say it), so it has to be readable
 * *before* the handoff — a line that lands on the same beat as the objective
 * would otherwise flash past. Comfortable prose pace (~200 wpm) with a floor so
 * a three-word quip still registers and a ceiling so nothing stalls the
 * tutorial. No line → no hold: the modal takes the bubble at once.
 */
export const lessonEndMessageMs = (comment: string): number => {
  const words = comment.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.min(4000, Math.max(1200, words * 300));
};

export const tutorialStage = (
  stageId: TutorialSectionId,
): TutorialStageScript =>
  TUTORIAL_SCRIPT.find((s) => s.id === stageId) ?? TUTORIAL_SCRIPT[0]!;

export const tutorialStory = (
  stageId: TutorialSectionId,
  storyId: string,
): TutorialStoryScript | undefined =>
  tutorialStage(stageId).stories.find((s) => s.id === storyId);

/**
 * Lesson seed + board chrome. Throws on an unknown id so a typo surfaces at the
 * call site instead of mounting an empty board.
 */
export const lessonBoard = (
  stageId: TutorialSectionId,
  storyId: string,
): LiveLessonBoard => {
  const board = tutorialStory(stageId, storyId)?.board;
  if (!board) {
    throw new Error(`No lesson board for ${stageId}/${storyId}`);
  }
  return board;
};

/** Normalize route / breadcrumb aliases → canonical stage id. */
export const parseTutorialSection = (
  raw: string | undefined,
): TutorialSectionId => {
  if (raw === "specials" || raw === "special-moves") return "specials";
  if (raw === "resolve" || raw === "turn-resolution") return "resolve";
  if (raw === "king" || raw === "king-damage") return "king";
  if (raw === "fog" || raw === "fog-of-war") return "fog";
  return "fog";
};

/** First story id when missing / unknown — keeps deep links resilient. */
export const resolveTutorialStoryId = (
  stageId: TutorialSectionId,
  storyId: string | undefined,
): string => {
  const stories = tutorialStage(stageId).stories;
  if (storyId && stories.some((s) => s.id === storyId)) return storyId;
  return stories[0]!.id;
};

/** Canonical tutorial deep link: `/tutorial/fog/king`. */
export const tutorialPath = (
  stageId: TutorialSectionId,
  storyId?: string,
): string => {
  const id = resolveTutorialStoryId(stageId, storyId);
  return `/tutorial/${stageId}/${id}`;
};

export const adjacentTutorialStoryId = (
  stageId: TutorialSectionId,
  storyId: string,
  delta: -1 | 1,
  opts?: { wrap?: boolean },
): string | null => {
  const stories = tutorialStage(stageId).stories;
  const idx = stories.findIndex((s) => s.id === storyId);
  if (idx < 0) return null;
  if (opts?.wrap) {
    const next = (idx + delta + stories.length) % stories.length;
    return stories[next]!.id;
  }
  const next = idx + delta;
  if (next < 0 || next >= stories.length) return null;
  return stories[next]!.id;
};

export type TutorialScriptContext = {
  stageId: TutorialSectionId;
  storyId: string;
  reviewPhase?: ReviewTurnPhase;
  timelineActive?: boolean;
  chessSkin?: boolean;
  /** Live `formatScFen` wire for `scfen` reactions. */
  scfen?: string;
  /** 1-based planning ordinal (`snap.turn + 1`; seed turn 0 → 1). */
  turn?: number;
  /** Live targeting kind (`bishopSnipe`, …). */
  targetingKind?: string | null;
};

/** Pick the most specific Selena line for the current board/store context. */
export const resolveTutorialLine = (ctx: TutorialScriptContext): TutorialLine => {
  const story = tutorialStory(ctx.stageId, ctx.storyId);
  if (!story) {
    return {
      comment: "Stay sharp — fog and fire favor the prepared.",
      emotion: "idle",
      source: "intro",
    };
  }

  const reactions = story.reactions ?? [];
  const reactionLine = (r: (typeof reactions)[number]): TutorialLine => ({
    comment: r.comment,
    emotion: r.emotion ?? story.emotion,
    ...(r.action ? { action: r.action } : {}),
    source: "reaction",
  });

  for (const r of reactions) {
    const w = r.when;
    if (w.kind === "reviewPhase" && ctx.reviewPhase === w.phase) {
      if (w.turn != null && ctx.turn !== w.turn) continue;
      return reactionLine(r);
    }
    if (w.kind === "timelineActive" && ctx.timelineActive) {
      return reactionLine(r);
    }
    if (w.kind === "chessSkin" && ctx.chessSkin === w.chess) {
      return reactionLine(r);
    }
    if (w.kind === "scfen" && ctx.scfen != null && w.re.test(ctx.scfen)) {
      return reactionLine(r);
    }
    if (w.kind === "turn" && ctx.turn === w.turn) {
      return reactionLine(r);
    }
    if (
      w.kind === "targeting" &&
      ctx.targetingKind != null &&
      ctx.targetingKind === w.targetingKind
    ) {
      return reactionLine(r);
    }
  }

  return {
    comment: story.comment,
    emotion: story.emotion,
    ...(story.action ? { action: story.action } : {}),
    source: "intro",
  };
};

export const holdTutorialLine = (
  hold: TutorialLineHold,
  lessonKey: string,
  raw: TutorialLine,
  ctx: Pick<
    TutorialScriptContext,
    "scfen" | "timelineActive" | "reviewPhase"
  >,
): { hold: TutorialLineHold; line: TutorialLine } => {
  let h =
    hold.lessonKey === lessonKey
      ? hold
      : {
          lessonKey,
          baselineScfen: undefined,
          introDone: false,
          sticky: undefined,
        };

  if (ctx.scfen && h.baselineScfen == null) {
    h = { ...h, baselineScfen: ctx.scfen };
  }

  const scfenMoved =
    h.baselineScfen != null &&
    ctx.scfen != null &&
    ctx.scfen !== h.baselineScfen;
  const phaseActed =
    ctx.timelineActive === true ||
    ctx.reviewPhase === "resolve" ||
    ctx.reviewPhase === "check";
  const acted = scfenMoved || phaseActed;

  if (raw.source === "reaction") {
    h = { ...h, introDone: true, sticky: raw };
    return { hold: h, line: raw };
  }

  if (acted || h.introDone) {
    h = { ...h, introDone: true };
    // Prefer last reaction; otherwise silence (do not revive intro).
    const line =
      h.sticky ??
      ({
        comment: "",
        emotion: raw.emotion,
        source: "intro" as const,
      } satisfies TutorialLine);
    return { hold: h, line };
  }

  return { hold: h, line: raw };
};

/** First matching board-hint step for the live SCFEN (empty = clear marks). */
/**
 * The hint step in force — first entry whose `when` matches, else the first
 * unconditional one. Squares and arrows come from the *same* step so a lesson
 * cannot show a ring from one beat and a line from another.
 */
const matchTutorialHint = (
  hints: readonly TutorialBoardHint[] | undefined,
  scfen: string | undefined,
): TutorialBoardHint | undefined => {
  if (!hints?.length) return undefined;
  for (const h of hints) {
    if (!h.when) return h;
    if (h.when.kind === "scfen" && scfen != null && h.when.re.test(scfen)) {
      return h;
    }
  }
  return undefined;
};

export const resolveTutorialHints = (
  hints: readonly TutorialBoardHint[] | undefined,
  scfen: string | undefined,
): Square[] => [...(matchTutorialHint(hints, scfen)?.squares ?? [])];

/** Hint lines for the step in force — see {@link resolveTutorialHints}. */
export const resolveTutorialArrows = (
  hints: readonly TutorialBoardHint[] | undefined,
  scfen: string | undefined,
): TutorialBoardArrow[] => [...(matchTutorialHint(hints, scfen)?.arrows ?? [])];

/** Live narration fields used by {@link matchesTutorialCompleteWhen}. */
export type TutorialCompleteContext = {
  scfen?: string;
  queue?: readonly { timing: string; kind: string; color?: string }[];
  typewriterTurn?: number;
  typewriterBeat?: "turn" | "check" | "intent" | "resolve";
};

/** True when live intent / SCFEN satisfies a story's auto-advance rule. */
export const matchesTutorialCompleteWhen = (
  when: TutorialCompleteWhen | undefined,
  ctx: TutorialCompleteContext | string | undefined,
): boolean => {
  if (!when || ctx == null) return false;
  const scfen = typeof ctx === "string" ? ctx : ctx.scfen;
  const queue = typeof ctx === "string" ? undefined : ctx.queue;
  const twTurn = typeof ctx === "string" ? undefined : ctx.typewriterTurn;
  const twBeat = typeof ctx === "string" ? undefined : ctx.typewriterBeat;
  if (when.kind === "scfen") {
    return scfen != null && when.re.test(scfen);
  }
  if (when.kind === "queue") {
    const q = queue ?? [];
    if (q.length === 0) return false;
    const hasC = q.some((a) => a.timing === "C");
    const hasSpecial = when.specialKind
      ? q.some(
          (a) =>
            a.kind === when.specialKind &&
            (a.timing === "B" || a.timing === "F"),
        )
      : q.some((a) => a.timing === "B" || a.timing === "F");
    if (when.classical && !hasC) return false;
    if ((when.specialKind || when.classical) && when.specialKind && !hasSpecial)
      return false;
    if (when.classical && when.specialKind) return hasC && hasSpecial;
    if (when.classical) return hasC;
    if (when.specialKind) return hasSpecial;
    return q.length > 0;
  }
  if (when.kind === "typewriter") {
    return twTurn === when.turn && twBeat === when.beat;
  }
  // `elapsed` is driven by TutorialScreen timers — never a live match.
  if (when.kind === "elapsed") return false;
  return false;
};
