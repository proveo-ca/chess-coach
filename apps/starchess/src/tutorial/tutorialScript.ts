// SPEC: _spec/apps/starchess/menu-flow.puml, _spec/apps/starchess/architecture/storybook-projection.puml, _spec/apps/starchess/tutorial/hints-and-coach.md
/**
 * Tutorial script — Stage → Story → Selena comment (+ optional store/board beats).
 */
import type { PieceSymbol, Square } from "chess.js";

import { specialCopyFor } from "~/presentation/specials/copy";
import { TUTORIAL_SCRIPT_CONFIG } from "~/tutorial/tutorialScript.config";
import {
  boardConditionHolds,
  ccDeployPressure,
  ccPressureUnits,
  ccThreatAnswer,
  ccThreatUnits,
  deployGasSquare,
  mechaPressureLine,
  gasMarineSquare,
  g2DeployName,
  isBoardCondition,
  mineGuard,
  pawnClimbStep,
  promotionChoiceOpen,
  queuedMoveGhost,
  unitArrow,
  whiteGas,
  runnerStop,
  shipJuke,
  tankSiegeSquare,
  whiteBattleShipSquare,
} from "~/tutorial/lessonTactics";
import { pickBeat, wrongQueuedAction, type TutorialBeatMatchContext } from "~/tutorial/when";
import { queueActionKey } from "~/presentation/hud/queueHint";
import type { KerriganEmotion } from "~/types/coach";
import type {
  AlertLatch,
  AttackTrajectory,
  LiveLessonBoard,
  BattleShipWatch,
  SquareCovers,
  TutorialBeat,
  TutorialBoardArrow,
  TutorialCompleteWhen,
  TutorialLine,
  TutorialLineHold,
  TutorialMark,
  TutorialReactionAction,
  TutorialSectionId,
} from "~/types/tutorial";
import type { ReviewTurnPhase } from "~/types/review";

export type {
  AttackTrajectory,
  LiveLessonBoard,
  SquareCovers,
  TutorialBoardArrow,
  TutorialBeat,
  TutorialCompleteWhen,
  TutorialCoversWhen,
  TutorialLine,
  TutorialLineHold,
  TutorialMark,
  TutorialTrajectoryWhen,
  TutorialReactionAction,
  TutorialSectionId,
} from "~/types/tutorial";
export { queued, and, or, not } from "~/tutorial/when";

export type TutorialStoryScript = {
  id: string;
  title: string;
  /** Default Selena line when the story is focused. */
  comment: string;
  emotion?: KerriganEmotion;
  /** Optional CTA on the default intro line. */
  action?: TutorialReactionAction;
  /**
   * Scripted beats: coach line and/or board marks, gated by turn/phase/when.
   * First-match-wins, evaluated independently for `say` and for `mark` (a
   * beat can carry one, the other, or both).
   */
  beats?: readonly TutorialBeat[];
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
  hideCoachWhen?: TutorialCompleteWhen;
  coachFarewell?: string;
  coachFarewellMs?: number;
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

/** Canonical tutorial sections. Anything else is an outdated URL path. */
export const CANONICAL_TUTORIAL_SECTIONS: readonly TutorialSectionId[] = [
  "fog",
  "specials",
  "resolve",
  "live-play",
];

/** True for `/tutorial/:section` values that are current canonical paths. */
export const isCanonicalTutorialSection = (raw: string | undefined): boolean =>
  raw != null && (CANONICAL_TUTORIAL_SECTIONS as readonly string[]).includes(raw);

/** Normalize route → canonical stage id. Outdated aliases are gone on purpose. */
export const parseTutorialSection = (
  raw: string | undefined,
): TutorialSectionId => {
  if (raw === "specials") return "specials";
  if (raw === "resolve") return "resolve";
  if (raw === "live-play") return "live-play";
  if (raw === "fog") return "fog";
  return "fog";
};

/**
 * Missing story (e.g. `/tutorial/live-play`) → first story of the section.
 * Unknown story (e.g. `/tutorial/live-play/king-defense`) → last story of
 * the section. Outdated lesson slugs redirect forward, never to the start.
 */
export const resolveTutorialStoryId = (
  stageId: TutorialSectionId,
  storyId: string | undefined,
): string => {
  const stories = tutorialStage(stageId).stories;
  if (storyId == null) return stories[0]!.id;
  if (stories.some((s) => s.id === storyId)) return storyId;
  return stories[stories.length - 1]!.id;
};

/** Last lesson overall — outdated section URLs land here. */
export const lastTutorialPath = (): string => {
  const stage = TUTORIAL_SCRIPT[TUTORIAL_SCRIPT.length - 1]!;
  const story = stage.stories[stage.stories.length - 1]!;
  return `/tutorial/${stage.id}/${story.id}`;
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

/** `TutorialScriptContext` narrowed to what `matchesBeat` needs. */
const beatMatchContext = (ctx: TutorialScriptContext): TutorialBeatMatchContext => ({
  scfen: ctx.scfen,
  reviewPhase: ctx.reviewPhase,
  timelineActive: ctx.timelineActive,
  chessSkin: ctx.chessSkin,
  targetingKind: ctx.targetingKind,
  covers: ctx.covers,
  trajectories: ctx.trajectories,
  shipSniped: ctx.shipSniped,
});

/**
 * A handful of `when` kinds carry their own computed text — the beat's own
 * `say` is a placeholder the config author never sees rendered for these.
 */
const enrichSay = (beat: TutorialBeat, scfen: string | undefined): string | undefined => {
  const w = beat.when;
  if (!scfen || !w) return beat.say;
  if (w.kind === "ccThreat") {
    const answer = ccThreatAnswer(scfen);
    const name = (unit: string) => specialCopyFor(unit as PieceSymbol).unit;
    if (answer?.kind === "deploy") {
      return `Our Command Center is under fire! \n\nDeploy a ${name(answer.unit)} on ${answer.at} to take out the attacker.`;
    }
    if (answer?.kind === "deployed") return `Now take out the attacker with that ${name(answer.unit)}!`;
    if (answer?.kind === "capture") return `Take out the attacker with your ${name(answer.unit)}!`;
    if (answer?.kind === "evade") return "Nothing reaches the attacker. Move your Command Center out of danger!";
    if (answer?.kind === "answered") return "That should do it. End your turn!";
  }
  if (w.kind === "gasOnMarine") {
    const sq = gasMarineSquare(scfen);
    if (sq) return `Keep pushing your ${sq[0]}-file Marine by dropping gas on it`;
  }
  if (w.kind === "forwardDeploy") {
    return `Deploy a ${g2DeployName(scfen)} on g2 with Gas`;
  }
  if (w.kind === "mineGuard") {
    const guard = mineGuard(scfen);
    if (guard) return `1 unit guarding ${guard.files} promoting files!`;
  }
  if (w.kind === "ccDeploy") {
    const deploy = ccDeployPressure(scfen);
    if (deploy) {
      const unit = specialCopyFor(deploy.unit).unit;
      return deploy.hits.includes(deploy.cc)
        ? `Deploy a ${unit} on ${deploy.at} with Gas: it hits the enemy Command Center!`
        : `Deploy a ${unit} on ${deploy.at} with Gas to cover the enemy Command Center's escape squares.`;
    }
  }
  return beat.say;
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

  const beat = pickBeat(story.beats, "say", beatMatchContext(ctx));
  if (beat?.say != null) {
    return {
      comment: enrichSay(beat, ctx.scfen) ?? beat.say,
      emotion: beat.emotion ?? story.emotion,
      ...(beat.action ? { action: beat.action } : {}),
      ...(beat.transient ? { transient: true as const } : {}),
      ...(beat.holdMs ? { holdMs: beat.holdMs } : {}),
      source: "reaction",
    };
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
  "scfen" | "covers" | "trajectories" | "reviewPhase" | "targetingKind"
>;

/** What the board paints for the step in force. Empty arrays clear the marks. */
export type TutorialHintMarks = {
  /** Guide-green rings. */
  squares: Square[];
  /** Alert-red rings. */
  alertSquares: Square[];
  gasSquares: Square[];
  arrows: TutorialBoardArrow[];
  cancelQueued: string | null;
};

/** Juke arrows leave from the BattleShip's current square, not the seed square. */
const battleShipOrigin = (mark: TutorialMark, scfen: string): TutorialMark => {
  const from = whiteBattleShipSquare(scfen);
  if (!from || !mark.arrows) return { ...mark, arrows: [] };
  return {
    ...mark,
    arrows: mark.arrows.flatMap((arrow) =>
      arrow.to === from ? [] : [{ ...arrow, from }],
    ),
  };
};

/**
 * A handful of `when` kinds compute their own squares/arrows — the beat's own
 * `mark` (if any) is the base these overrides render on top of.
 */
const enrichMark = (beat: TutorialBeat, scfen: string | undefined): TutorialMark => {
  const base = beat.mark ?? {};
  const w = beat.when;
  if (!scfen || !w) return base;
  if (w.kind === "stopRunner") {
    const stop = runnerStop(scfen);
    if (stop) return { ...base, squares: [stop.to], arrows: [{ from: stop.from, to: stop.to }] };
  }
  if (w.kind === "shipJuke") {
    const juke = shipJuke(scfen);
    if (juke) return { ...base, squares: [juke.to], gasSquares: [juke.from], arrows: [juke] };
  }
  if (w.kind === "mineGuard") {
    const guard = mineGuard(scfen);
    if (guard) return { ...base, squares: guard.mines, arrows: guard.hops };
  }
  if (w.kind === "pawnStep") {
    const step = pawnClimbStep(scfen);
    if (step) return { ...base, squares: [step.to], arrows: [{ from: step.from, to: step.to }] };
  }
  if (w.kind === "gasOnMarine") {
    const sq = gasMarineSquare(scfen);
    if (sq) return { ...base, squares: [], gasSquares: [sq] };
  }
  if (w.kind === "promotionChoice") {
    const sq = promotionChoiceOpen(scfen);
    if (sq && whiteGas(scfen) >= 1) return { ...base, squares: [], gasSquares: [sq] };
    if (sq) {
      const next = `${sq[0]}${Number(sq[1]) + 1}` as Square;
      return { ...base, squares: [next], arrows: [{ from: sq, to: next }] };
    }
  }
  if (w.kind === "tankSiege") {
    const sq = tankSiegeSquare(scfen);
    if (sq) return { ...base, squares: [], gasSquares: [sq] };
  }
  if (w.kind === "ccDeploy") {
    const deploy = ccDeployPressure(scfen);
    if (deploy) {
      return {
        ...base,
        gasOnCC: true,
        squares: [deploy.at],
        arrows: deploy.hits.map((to) => ({
          ...unitArrow(deploy.unit, deploy.at, to),
          ...(to === deploy.cc ? { tone: "alert" as const } : {}),
        })),
      };
    }
  }
  const wrongQueue = w.kind === "wrongQueue" ? w : w.kind === "and" ? w.all.find((x) => x.kind === "wrongQueue") : undefined;
  if (wrongQueue?.kind === "wrongQueue") {
    const wrong = wrongQueuedAction(scfen, wrongQueue.sequence);
    if (wrong) return { squares: [], alertSquares: [], gasSquares: [], arrows: [], cancelQueued: queueActionKey(wrong) };
  }
  if (w.kind === "ccThreat") {
    const threat = ccThreatUnits(scfen);
    if (threat) {
      const danger = {
        alertSquares: threat.units.map((u) => u.from),
        arrows: threat.units.map((u) => ({ ...unitArrow(u.kind, u.from, threat.cc), tone: "alert" as const })),
      };
      const answer = ccThreatAnswer(scfen);
      if (answer?.kind === "deploy") {
        return {
          ...base,
          ...danger,
          squares: [answer.at],
          gasOnCC: true,
          arrows: [...danger.arrows, unitArrow(answer.unit, answer.at, answer.target)],
        };
      }
      if (answer?.kind === "deployed") {
        return { ...base, ...danger, squares: [answer.at], arrows: [...danger.arrows, unitArrow(answer.unit, answer.at, answer.target)] };
      }
      if (answer?.kind === "capture") {
        return { ...base, ...danger, squares: [answer.from], arrows: [...danger.arrows, unitArrow(answer.unit, answer.from, answer.target)] };
      }
      if (answer?.kind === "evade") {
        return { ...base, ...danger, squares: [answer.to], arrows: [...danger.arrows, { from: answer.cc, to: answer.to }] };
      }
      return { ...base, ...danger };
    }
  }
  if (w.kind === "ccPressure") {
    const pressure = ccPressureUnits(scfen);
    if (pressure) {
      return {
        ...base,
        squares: pressure.units.map((u) => u.from),
        arrows: pressure.units.map((u) => unitArrow(u.kind, u.from, pressure.cc)),
      };
    }
  }
  return base;
};

export const completedLessonBeats = (
  beats: readonly TutorialBeat[] | undefined,
): TutorialBeat[] | undefined => beats?.filter((b) => b.final);

const pressureMark = (scfen: string): TutorialMark => {
  const pressure = ccPressureUnits(scfen);
  if (pressure) {
    return {
      squares: pressure.units.map((u) => u.from),
      arrows: pressure.units.map((u) => unitArrow(u.kind, u.from, pressure.cc)),
    };
  }
  const line = mechaPressureLine(scfen);
  if (!line) return {};
  return {
    squares: [line.to],
    arrows: [
      { from: line.from, to: line.to },
      { from: line.to, to: line.cc, tone: "alert" },
    ],
  };
};

/**
 * The mark step in force — the most specific beat carrying a `mark` whose
 * `turn`/`phase`/`when` all match. Rings, alert rings and arrows all come from
 * that *one* beat, so a lesson cannot show a ring from one beat and a line from
 * another.
 */
export const resolveTutorialHint = (
  beats: readonly TutorialBeat[] | undefined,
  ctx: TutorialHintContext,
): TutorialHintMarks => {
  const matchCtx: TutorialBeatMatchContext = {
    scfen: ctx.scfen,
    reviewPhase: ctx.reviewPhase,
    covers: ctx.covers,
    trajectories: ctx.trajectories,
    targetingKind: ctx.targetingKind,
  };
  const beat = pickBeat(beats, "mark", matchCtx);
  let mark: TutorialMark | undefined;
  if (beat) {
    mark = enrichMark(beat, ctx.scfen);
    if (mark.fromBattleShip && ctx.scfen) mark = battleShipOrigin(mark, ctx.scfen);
    const ghost = mark.gasOnMoveGhost && ctx.scfen ? queuedMoveGhost(ctx.scfen) : null;
    if (ghost) mark = { ...mark, gasSquares: [...(mark.gasSquares ?? []), ghost] };
    const cc =
      mark.gasOnCC && ctx.scfen && ctx.targetingKind !== "deploy" ? deployGasSquare(ctx.scfen) : null;
    if (cc) mark = { ...mark, gasSquares: [...(mark.gasSquares ?? []), cc] };
    const push = mark.gasOnPush && ctx.scfen ? gasMarineSquare(ctx.scfen) : null;
    if (push) mark = { ...mark, gasSquares: [...(mark.gasSquares ?? []), push] };
    if (mark.pressureCC && ctx.scfen) mark = { ...mark, ...pressureMark(ctx.scfen) };
  }
  return {
    squares: [...(mark?.squares ?? [])],
    alertSquares: [...(mark?.alertSquares ?? [])],
    gasSquares: [...(mark?.gasSquares ?? [])],
    arrows: [...(mark?.arrows ?? [])],
    cancelQueued: mark?.cancelQueued ?? null,
  };
};

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

/** The enemy Command Center's last seen square — a fogged CC never moves it. */
export const nextCCSighting = (
  prev: Square | undefined,
  opts: { ccAt?: Square; ccVisible: boolean },
): Square | undefined => (opts.ccVisible && opts.ccAt ? opts.ccAt : prev);

/** A beat's alert rings plus the ring on the last seen enemy Command Center. */
export const withCCAlert = (scripted: readonly Square[], seen: Square | undefined): Square[] =>
  seen && !scripted.includes(seen) ? [...scripted, seen] : [...scripted];

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
