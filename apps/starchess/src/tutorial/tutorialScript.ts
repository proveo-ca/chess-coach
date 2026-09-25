// SPEC: _spec/apps/starchess/menu-flow.puml, _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Tutorial script — Stage → Story → Selena comment (+ optional store/board reactions).
 */
import type { Square } from "chess.js";

import { TUTORIAL_SCRIPT_CONFIG } from "~/tutorial/tutorialScript.config";
import {
  boardConditionHolds,
  ccPressureUnits,
  chargeFromH8,
  forwardDeploySquare,
  g2DeployName,
  gasMarineSquare,
  g1GuardNeeded,
  isBoardCondition,
  mineGuard,
  mechaDiagonalOpen,
  mechaThreatOpen,
  promotionChoiceOpen,
  runnerStop,
  shipJuke,
  tankSiegeOnH5,
  tankSiegeSquare,
  whiteBattleShipSquare,
} from "~/tutorial/lessonTactics";
import type { KerriganEmotion } from "~/types/coach";
import type {
  AlertLatch,
  AttackTrajectory,
  LiveLessonBoard,
  BattleShipWatch,
  SquareCovers,
  TutorialBackrankWhen,
  TutorialBoardCondition,
  TutorialBoardArrow,
  TutorialBoardHint,
  TutorialChargeWhen,
  TutorialCompleteWhen,
  TutorialCoversWhen,
  TutorialForwardDeployWhen,
  TutorialGasMarineWhen,
  TutorialLine,
  TutorialLineHold,
  TutorialMechaDiagonalWhen,
  TutorialMechaThreatWhen,
  TutorialMineGuardWhen,
  TutorialPromotionWhen,
  TutorialStopRunnerWhen,
  TutorialTankSiegeWhen,
  TutorialTrajectoryWhen,
  TutorialReactionAction,
  TutorialSectionId,
} from "~/types/tutorial";
import type { ReviewTurnPhase } from "~/types/review";

export type {
  AttackTrajectory,
  LiveLessonBoard,
  SquareCovers,
  TutorialBoardArrow,
  TutorialBoardHint,
  TutorialCompleteWhen,
  TutorialCoversWhen,
  TutorialLine,
  TutorialLineHold,
  TutorialTrajectoryWhen,
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
  | { kind: "scfen"; re: RegExp; phases?: readonly ReviewTurnPhase[] }
  /** 1-based planning ordinal (`snap.turn + 1`; seed turn 0 → 1). */
  | { kind: "turn"; turn: number }
  /** Live targeting mode (e.g. Charon armed → `charonMissiles`). */
  | { kind: "targeting"; targetingKind: string }
  /** Live tactics cover the square with one of these kinds. */
  | TutorialCoversWhen
  /** Live tactics hold an open staging post against the enemy CC. */
  | TutorialTrajectoryWhen
  | TutorialBackrankWhen
  | TutorialMechaDiagonalWhen
  | TutorialMechaThreatWhen
  | TutorialGasMarineWhen
  | TutorialForwardDeployWhen
  | TutorialPromotionWhen
  | TutorialChargeWhen
  | TutorialTankSiegeWhen
  | TutorialStopRunnerWhen
  | TutorialMineGuardWhen
  /** Command Center HP, units gone, or units on named squares. */
  | TutorialBoardCondition
  /** BattleShip that was standing on h8 is gone during resolve. */
  | { kind: "shipSniped" };

export type TutorialReaction = {
  when: TutorialReactionWhen;
  comment: string;
  emotion?: KerriganEmotion;
  /** Optional in-bubble CTA (e.g. retry after ally CC dies). */
  action?: TutorialReactionAction;
  /** Momentary beat — shown while matched, never latched as the sticky line. */
  transient?: boolean;
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
  /** Replay lessons: draw queued intents as arrows on the Intent beat. */
  intentArrows?: boolean;
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
  if (raw === "king" || raw === "cc-damage") return "king";
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
  /** Live targeting kind (`charonMissiles`, …). */
  targetingKind?: string | null;
  /** Enemy-occupied watch squares mapped to their current coverers. */
  covers?: SquareCovers;
  /** Open staging posts against the enemy Command Center. */
  trajectories?: AttackTrajectory[];
  /** Turn-open checks have landed — see {@link holdTutorialLine}. */
  turnStartChecksApplied?: boolean;
  /** White BattleShip was lost on h8 during this resolve. */
  shipSniped?: boolean;
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
    ...(r.transient ? { transient: true as const } : {}),
    source: "reaction",
  });

  for (const r of reactions) {
    const w = r.when;
    if (isBoardCondition(w)) {
      if (ctx.scfen && phaseAllows(w.phases, ctx.reviewPhase) && boardConditionHolds(w, ctx.scfen)) {
        return reactionLine(r);
      }
      continue;
    }
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
      const phase = ctx.reviewPhase;
      if (w.phases && (!phase || !w.phases.includes(phase))) continue;
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
    if (w.kind === "covers" && ctx.covers) {
      const list = ctx.covers[w.square] ?? [];
      if (list.some((c) => !w.kinds || w.kinds.includes(c.kind))) {
        return reactionLine(r);
      }
    }
    if (w.kind === "trajectory" && ctx.trajectories?.some((t) => t.from === w.from && t.to === w.to)) {
      return reactionLine(r);
    }
    if (w.kind === "backrankGuard" && ctx.scfen && g1GuardNeeded(ctx.scfen)) {
      return reactionLine(r);
    }
    if (w.kind === "mechaDiagonal" && ctx.scfen && phaseAllows(w.phases, ctx.reviewPhase) && mechaDiagonalOpen(ctx.scfen)) {
      return reactionLine(r);
    }
    if (w.kind === "mechaThreat" && ctx.scfen && phaseAllows(w.phases, ctx.reviewPhase) && mechaThreatOpen(ctx.scfen)) {
      return reactionLine(r);
    }
    if (w.kind === "gasOnMarine" && ctx.scfen && phaseAllows(w.phases, ctx.reviewPhase) && gasMarineSquare(ctx.scfen)) {
      const sq = gasMarineSquare(ctx.scfen)!;
      return {
        ...reactionLine(r),
        comment: `Keep pushing your ${sq[0]}-file Marine by dropping gas on it`,
      };
    }
    if (
      w.kind === "forwardDeploy" &&
      ctx.scfen &&
      phaseAllows(w.phases, ctx.reviewPhase) &&
      forwardDeploySquare(ctx.scfen) === w.square
    ) {
      return {
        ...reactionLine(r),
        comment: `Deploy a ${g2DeployName(ctx.scfen)} on g2 with Gas`,
      };
    }
    if (
      w.kind === "promotionChoice" &&
      ctx.scfen &&
      phaseAllows(w.phases, ctx.reviewPhase) &&
      promotionChoiceOpen(ctx.scfen)
    ) {
      return reactionLine(r);
    }
    if (
      w.kind === "chargeH8" &&
      ctx.scfen &&
      phaseAllows(w.phases, ctx.reviewPhase) &&
      chargeFromH8(ctx.scfen)
    ) {
      return reactionLine(r);
    }
    if (w.kind === "stopRunner" && ctx.scfen && runnerStop(ctx.scfen)) {
      return reactionLine(r);
    }
    if (w.kind === "mineGuard" && ctx.scfen) {
      const guard = mineGuard(ctx.scfen);
      if (!guard) continue;
      return {
        ...reactionLine(r),
        comment: `1 unit guarding ${guard.files} promoting files!`,
      };
    }
    if (
      w.kind === "tankSiege" &&
      ctx.scfen &&
      phaseAllows(w.phases, ctx.reviewPhase) &&
      tankSiegeOnH5(ctx.scfen)
    ) {
      return reactionLine(r);
    }
    if (w.kind === "shipSniped" && ctx.shipSniped) {
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
    "scfen" | "timelineActive" | "reviewPhase" | "turnStartChecksApplied"
  >,
): { hold: TutorialLineHold; line: TutorialLine } => {
  let h =
    hold.lessonKey === lessonKey
      ? hold
      : {
          lessonKey,
          baselineScfen: undefined,
          checksApplied: undefined,
          introDone: false,
          sticky: undefined,
        };

  if (ctx.scfen && h.baselineScfen == null) {
    h = { ...h, baselineScfen: ctx.scfen };
  }

  /*
   * Turn-open is engine bookkeeping, not a player move: it refills gas and
   * applies standing check damage, so on a seed whose gas is mid-turn (black's
   * spent on a queued mine, say) the very act of arming the planning timer
   * moves the SCFEN off the seed on mount. Re-baseline on the false→true flip
   * so that edit does not read as "the player acted" and retire the opening
   * line unread. Only while the intro is still live — later turns re-open too,
   * and by then a reaction is sticky and must not be re-armed.
   */
  const checksJustApplied =
    ctx.turnStartChecksApplied === true && h.checksApplied !== true;
  // Track `undefined` too. A host that reports and then stops (a narration
  // reset publishes `{}`) must clear the latch rather than strand it on `true`,
  // which would swallow the next real flip.
  if (h.checksApplied !== ctx.turnStartChecksApplied) {
    h = { ...h, checksApplied: ctx.turnStartChecksApplied };
  }
  if (checksJustApplied && !h.introDone && ctx.scfen) {
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
    // Transient beats comment on a moment (damage flash) without becoming
    // guidance state — show while matched, latch nothing.
    if (raw.transient) return { hold: h, line: raw };
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

/** The board state hint steps read — the board half of {@link TutorialScriptContext}. */
export type TutorialHintContext = Pick<
  TutorialScriptContext,
  "scfen" | "covers" | "trajectories" | "reviewPhase" | "turn"
>;

/** What the board paints for the step in force. Empty arrays clear the marks. */
export type TutorialHintMarks = {
  /** Guide-green rings. */
  squares: Square[];
  /** Alert-red rings. */
  alertSquares: Square[];
  arrows: TutorialBoardArrow[];
};

/** Juke arrows leave from the BattleShip's current square, not the seed square. */
const battleShipOrigin = (hint: TutorialBoardHint, scfen: string): TutorialBoardHint => {
  const from = whiteBattleShipSquare(scfen);
  if (!from || !hint.arrows) return { ...hint, arrows: [] };
  return {
    ...hint,
    arrows: hint.arrows.flatMap((arrow) =>
      arrow.to === from ? [] : [{ ...arrow, from }],
    ),
  };
};

const matchTutorialHint = (
  hints: readonly TutorialBoardHint[] | undefined,
  { scfen, covers, trajectories, reviewPhase, turn }: TutorialHintContext,
): TutorialBoardHint | undefined => {
  if (!hints?.length) return undefined;
  for (const h of hints) {
    if (!h.when) return h;
    if (isBoardCondition(h.when)) {
      if (scfen && phaseAllows(h.when.phases, reviewPhase) && boardConditionHolds(h.when, scfen)) {
        return h;
      }
      continue;
    }
    if (h.when.kind === "reviewPhase") {
      if (reviewPhase !== h.when.phase) continue;
      if (h.when.turn != null && turn !== h.when.turn) continue;
      return h;
    }
    if (h.when.kind === "scfen" && scfen != null && h.when.re.test(scfen)) {
      const phases = h.when.phases;
      if (!phaseAllows(phases, reviewPhase)) continue;
      return h.fromBattleShip ? battleShipOrigin(h, scfen) : h;
    }
    if (h.when.kind === "stopRunner" && scfen) {
      const stop = runnerStop(scfen);
      if (!stop) continue;
      return {
        ...h,
        squares: [stop.to],
        arrows: [{ from: stop.from, to: stop.to }],
      };
    }
    if (h.when.kind === "shipJuke" && scfen) {
      const juke = shipJuke(scfen);
      if (!juke) continue;
      return { ...h, squares: [juke.to], arrows: [juke] };
    }
    if (h.when.kind === "mineGuard" && scfen) {
      const guard = mineGuard(scfen);
      if (!guard) continue;
      return { ...h, squares: guard.mines, arrows: guard.hops };
    }
    if (h.when.kind === "covers" && covers) {
      const when = h.when;
      const list = covers[when.square] ?? [];
      if (list.some((c) => !when.kinds || when.kinds.includes(c.kind))) {
        return h;
      }
    }
    if (h.when.kind === "trajectory" && trajectories) {
      const when = h.when;
      if (trajectories.some((t) => t.from === when.from && t.to === when.to)) {
        return h;
      }
    }
    if (h.when.kind === "backrankGuard" && scfen && g1GuardNeeded(scfen)) {
      return h;
    }
    if (
      h.when.kind === "mechaDiagonal" &&
      scfen &&
      phaseAllows(h.when.phases, reviewPhase) &&
      mechaDiagonalOpen(scfen)
    ) {
      return h;
    }
    if (
      h.when.kind === "mechaThreat" &&
      scfen &&
      phaseAllows(h.when.phases, reviewPhase) &&
      mechaThreatOpen(scfen)
    ) {
      return h;
    }
    if (
      h.when.kind === "gasOnMarine" &&
      scfen &&
      phaseAllows(h.when.phases, reviewPhase) &&
      gasMarineSquare(scfen)
    ) {
      return { ...h, squares: [gasMarineSquare(scfen)!] };
    }
    if (
      h.when.kind === "forwardDeploy" &&
      scfen &&
      phaseAllows(h.when.phases, reviewPhase) &&
      forwardDeploySquare(scfen) === h.when.square
    ) {
      return h;
    }
    if (h.when.kind === "promotionChoice" && scfen && phaseAllows(h.when.phases, reviewPhase)) {
      const square = promotionChoiceOpen(scfen);
      if (square) return { ...h, squares: [square] };
    }
    if (
      h.when.kind === "chargeH8" &&
      scfen &&
      phaseAllows(h.when.phases, reviewPhase) &&
      chargeFromH8(scfen)
    ) {
      return h;
    }
    if (
      h.when.kind === "tankSiege" &&
      scfen &&
      phaseAllows(h.when.phases, reviewPhase) &&
      tankSiegeOnH5(scfen)
    ) {
      return { ...h, squares: [tankSiegeSquare(scfen)!] };
    }
    if (h.when.kind === "ccPressure" && scfen && phaseAllows(h.when.phases, reviewPhase)) {
      const pressure = ccPressureUnits(scfen);
      if (!pressure) continue;
      return {
        ...h,
        squares: pressure.units.map((u) => u.from),
        arrows: pressure.units.map((u) => ({ from: u.from, to: pressure.cc })),
      };
    }
  }
  return undefined;
};

const phaseAllows = (
  phases: readonly ReviewTurnPhase[] | undefined,
  phase: ReviewTurnPhase | undefined,
): boolean => !phases || (!!phase && phases.includes(phase));

/**
 * The hint step in force — first entry whose `when` matches, else the first
 * unconditional one. Rings, alert rings and arrows all come from that *one*
 * step, so a lesson cannot show a ring from one beat and a line from another.
 */
export const resolveTutorialHint = (
  hints: readonly TutorialBoardHint[] | undefined,
  ctx: TutorialHintContext,
): TutorialHintMarks => {
  const step = matchTutorialHint(hints, ctx);
  return {
    squares: [...(step?.squares ?? [])],
    alertSquares: [...(step?.alertSquares ?? [])],
    arrows: [...(step?.arrows ?? [])],
  };
};

/**
 * Keep alert rings up through later beats. A `followKing` lesson (king-attack-3)
 * moves the ring only when the Command Center is seen on a different square —
 * a fogged king does not count, so a dark move cannot relocate the mark.
 */
export const nextAlertLatch = (
  prev: AlertLatch,
  scripted: readonly Square[],
  opts?: { followCC?: boolean; ccAt?: Square; ccVisible?: boolean },
): AlertLatch => {
  if (scripted.length > 0) {
    const same =
      scripted.length === prev.squares.length &&
      scripted.every((sq, i) => sq === prev.squares[i]);
    if (same) return prev;
    // The scripted square is the sighting. The live king may still be on the
    // square it left, and must not pull the ring back there.
    return {
      squares: [...scripted],
      ...(opts?.followCC ? { ccAt: scripted[0] } : {}),
    };
  }
  if (!opts?.followCC) return prev;
  const ccAt = opts.ccAt;
  if (
    opts.ccVisible &&
    ccAt &&
    prev.squares.length > 0 &&
    ccAt !== prev.squares[0]
  ) {
    return { squares: [ccAt], ccAt };
  }
  return prev;
};

/** Remember a white BattleShip on h8, and call the resolve that removes it. */
export const nextBattleShipWatch = (
  prev: BattleShipWatch,
  input: { onH8: boolean; alive: boolean; reviewPhase?: ReviewTurnPhase },
): BattleShipWatch => {
  if (input.onH8) return { onH8: true, sniped: false };
  if (input.alive) return { onH8: false, sniped: false };
  if (input.reviewPhase === "resolve" && (prev.onH8 || prev.sniped)) {
    return { onH8: false, sniped: true };
  }
  return { onH8: false, sniped: false };
};

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
  if (isBoardCondition(when)) {
    return scfen != null && boardConditionHolds(when, scfen);
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
