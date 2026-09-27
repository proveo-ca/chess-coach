// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml, _spec/apps/starchess/tutorial/hints-and-coach.md
/**
 * `TutorialWhen` builders + the one shared evaluator. Replaces two
 * near-duplicate ~20-branch if-chains (the old `resolveTutorialLine` reaction
 * scan and `matchTutorialHint` hint scan) with a single `matchWhen`, and
 * replaces hand-written `re: /SCFEN\|.../` regexes for "is this queued yet"
 * with `queued()`, which checks the *parsed* queue instead of the raw wire
 * string.
 */
import type { ScAction, ScActionTiming, ScSpecialKind } from "@chess-coach/starchess-core";
import { parseScFen } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import {
  boardConditionHolds,
  ccDeployPressure,
  ccPressureUnits,
  ccThreatUnits,
  chargeFromH8,
  forwardDeploySquare,
  g1GuardNeeded,
  gasMarineSquare,
  isBoardCondition,
  mechaDeployReady,
  mechaDiagonalOpen,
  mechaThreatOpen,
  mineGuard,
  pawnClimbStep,
  promotionChoiceOpen,
  runnerStop,
  shipJuke,
  tankSiegeOnH5,
} from "~/tutorial/lessonTactics";
import type {
  AttackTrajectory,
  SquareCovers,
  TutorialBeat,
  TutorialWhen,
} from "~/types/tutorial";
import type { ReviewTurnPhase } from "~/types/review";

export const queued = (action: string, color: "w" | "b" = "w"): TutorialWhen => ({
  kind: "queued",
  action,
  color,
});
export const and = (...all: TutorialWhen[]): TutorialWhen => ({ kind: "and", all });
export const or = (...any: TutorialWhen[]): TutorialWhen => ({ kind: "or", any });
export const not = (w: TutorialWhen): TutorialWhen => ({ kind: "not", not: w });

/** Board/store facts a `TutorialWhen` can read. Superset of what the coach-line
 * and hint resolvers each used to pass separately — an unused field is simply
 * left `undefined` at a call site that has nothing to offer it. */
export type TutorialWhenContext = {
  scfen?: string;
  timelineActive?: boolean;
  chessSkin?: boolean;
  reviewPhase?: ReviewTurnPhase;
  targetingKind?: string | null;
  covers?: SquareCovers;
  trajectories?: AttackTrajectory[];
  shipSniped?: boolean;
};

type ParsedQueuedSpec = {
  timing: ScActionTiming;
  kind: ScSpecialKind | "classical";
  from: Square;
  to?: Square;
};

/**
 * `"C=a3c2"` (classical, squares concatenated) or `"B=siegeMode:e4"` /
 * `"F=deploy:b7:a6"` (special: timing=kind:from[:to]).
 */
const parseQueuedSpec = (spec: string): ParsedQueuedSpec | null => {
  const eq = spec.indexOf("=");
  if (eq < 0) return null;
  const timing = spec.slice(0, eq) as ScActionTiming;
  const rest = spec.slice(eq + 1);
  if (rest.includes(":")) {
    const [kind, from, to] = rest.split(":");
    if (!kind || !from) return null;
    return { timing, kind: kind as ScSpecialKind, from: from as Square, ...(to ? { to: to as Square } : {}) };
  }
  if (rest.length !== 4) return null;
  return { timing, kind: "classical", from: rest.slice(0, 2) as Square, to: rest.slice(2, 4) as Square };
};

const actionMatchesSpec = (a: ScAction, spec: ParsedQueuedSpec): boolean =>
  a.timing === spec.timing &&
  a.kind === spec.kind &&
  a.from === spec.from &&
  (spec.to == null || a.to === spec.to);

export const wrongQueuedAction = (
  scfen: string,
  sequence: readonly (string | readonly string[])[],
): ScAction | null => {
  let actions: readonly ScAction[];
  try {
    actions = parseScFen(scfen).queue?.actions ?? [];
  } catch {
    return null;
  }
  const matches = (a: ScAction, raw: string): boolean => {
    const any = raw.startsWith("*=");
    const spec = parseQueuedSpec(any ? `B=${raw.slice(2)}` : raw);
    if (!spec) return false;
    return any && (a.timing === "B" || a.timing === "F")
      ? actionMatchesSpec(a, { ...spec, timing: a.timing })
      : actionMatchesSpec(a, spec);
  };
  const white = actions.filter((a) => a.color === "w").sort((x, y) => x.seq - y.seq);
  return (
    white.find((a, i) => {
      const step = sequence[i];
      if (step == null) return true;
      const options: readonly string[] = typeof step === "string" ? [step] : step;
      return !options.some((raw) => matches(a, raw));
    }) ?? null
  );
};

const isQueued = (scfen: string | undefined, color: "w" | "b", action: string): boolean => {
  if (!scfen) return false;
  const spec = parseQueuedSpec(action);
  if (!spec) return false;
  let actions: readonly ScAction[];
  try {
    actions = parseScFen(scfen).queue?.actions ?? [];
  } catch {
    return false;
  }
  return actions.some((a) => a.color === color && actionMatchesSpec(a, spec));
};

export const phaseAllows = (
  phases: readonly ReviewTurnPhase[] | undefined,
  phase: ReviewTurnPhase | undefined,
): boolean => !phases || (!!phase && phases.includes(phase));

/** True when `when` holds for `ctx`. */
export const matchWhen = (when: TutorialWhen, ctx: TutorialWhenContext): boolean => {
  if (isBoardCondition(when)) {
    return !!ctx.scfen && phaseAllows(when.phases, ctx.reviewPhase) && boardConditionHolds(when, ctx.scfen);
  }
  switch (when.kind) {
    case "queued":
      return isQueued(ctx.scfen, when.color ?? "w", when.action);
    case "and":
      return when.all.every((w) => matchWhen(w, ctx));
    case "or":
      return when.any.some((w) => matchWhen(w, ctx));
    case "not":
      return !matchWhen(when.not, ctx);
    case "scfen":
      return ctx.scfen != null && when.re.test(ctx.scfen);
    case "reviewPhase":
      return ctx.reviewPhase === when.phase;
    case "timelineActive":
      return ctx.timelineActive === true;
    case "chessSkin":
      return ctx.chessSkin === when.chess;
    case "targeting":
      return ctx.targetingKind != null && ctx.targetingKind === when.targetingKind;
    case "shipSniped":
      return ctx.shipSniped === true;
    case "covers": {
      const list = ctx.covers?.[when.square] ?? [];
      return list.some((c) => !when.kinds || when.kinds.includes(c.kind));
    }
    case "trajectory":
      return !!ctx.trajectories?.some((t) => t.from === when.from && t.to === when.to);
    case "backrankGuard":
      return !!ctx.scfen && g1GuardNeeded(ctx.scfen);
    case "wrongQueue":
      return !!ctx.scfen && wrongQueuedAction(ctx.scfen, when.sequence) != null;
    case "mechaDeployReady":
      return !!ctx.scfen && phaseAllows(when.phases, ctx.reviewPhase) && mechaDeployReady(ctx.scfen);
    case "mechaDiagonal":
      return !!ctx.scfen && phaseAllows(when.phases, ctx.reviewPhase) && mechaDiagonalOpen(ctx.scfen);
    case "mechaThreat":
      return !!ctx.scfen && phaseAllows(when.phases, ctx.reviewPhase) && mechaThreatOpen(ctx.scfen);
    case "gasOnMarine":
      return !!ctx.scfen && phaseAllows(when.phases, ctx.reviewPhase) && gasMarineSquare(ctx.scfen) != null;
    case "forwardDeploy":
      return (
        !!ctx.scfen &&
        phaseAllows(when.phases, ctx.reviewPhase) &&
        forwardDeploySquare(ctx.scfen) === when.square
      );
    case "promotionChoice":
      return !!ctx.scfen && phaseAllows(when.phases, ctx.reviewPhase) && promotionChoiceOpen(ctx.scfen) != null;
    case "chargeH8":
      return !!ctx.scfen && phaseAllows(when.phases, ctx.reviewPhase) && chargeFromH8(ctx.scfen);
    case "tankSiege":
      return !!ctx.scfen && phaseAllows(when.phases, ctx.reviewPhase) && tankSiegeOnH5(ctx.scfen);
    case "stopRunner":
      return !!ctx.scfen && runnerStop(ctx.scfen) != null;
    case "mineGuard":
      return !!ctx.scfen && mineGuard(ctx.scfen) != null;
    case "shipJuke":
      return !!ctx.scfen && shipJuke(ctx.scfen) != null;
    case "pawnStep":
      return !!ctx.scfen && pawnClimbStep(ctx.scfen) != null;
    case "ccPressure":
      return !!ctx.scfen && phaseAllows(when.phases, ctx.reviewPhase) && ccPressureUnits(ctx.scfen) != null;
    case "ccDeploy":
      return !!ctx.scfen && phaseAllows(when.phases, ctx.reviewPhase) && ccDeployPressure(ctx.scfen) != null;
    case "ccThreat":
      return !!ctx.scfen && phaseAllows(when.phases, ctx.reviewPhase) && ccThreatUnits(ctx.scfen) != null;
    default:
      return false;
  }
};

export type TutorialBeatMatchContext = TutorialWhenContext;

const scfenTurn = (scfen: string | undefined): number | undefined => {
  const field = scfen?.split("|")[2];
  return field ? Number(field) : undefined;
};

/** True when every gate on `beat` holds: `turn` (the SCFEN turn field), `phase`, and `when`. */
export const matchesBeat = (beat: TutorialBeat, ctx: TutorialBeatMatchContext): boolean => {
  if (beat.turn != null && scfenTurn(ctx.scfen) !== beat.turn) return false;
  if (beat.phase != null) {
    const phases = Array.isArray(beat.phase) ? beat.phase : [beat.phase];
    if (!ctx.reviewPhase || !phases.includes(ctx.reviewPhase)) return false;
  }
  if (beat.when != null && !matchWhen(beat.when, ctx)) return false;
  return true;
};

const whenSpecificity = (when: TutorialWhen): number =>
  when.kind === "and" ? when.all.reduce((n, w) => n + whenSpecificity(w), 0) : 1;

/** Leaf gates a beat must pass: `turn`, `phase`, and each `and(...)` leaf of `when`. */
export const beatSpecificity = (beat: TutorialBeat): number =>
  (beat.turn != null ? 1 : 0) +
  (beat.phase != null ? 1 : 0) +
  (beat.when != null ? whenSpecificity(beat.when) : 0);

/**
 * The beat carrying `field` whose gates hold, ranked by `priority` (default 0),
 * then {@link beatSpecificity}; declaration order breaks a full tie.
 */
export const pickBeat = (
  beats: readonly TutorialBeat[] | undefined,
  field: "say" | "mark",
  ctx: TutorialBeatMatchContext,
): TutorialBeat | undefined => {
  let best: TutorialBeat | undefined;
  let bestPriority = -Infinity;
  let bestScore = -1;
  for (const beat of beats ?? []) {
    if (beat[field] == null || !matchesBeat(beat, ctx)) continue;
    const priority = beat.priority ?? 0;
    const score = beatSpecificity(beat);
    if (priority > bestPriority || (priority === bestPriority && score > bestScore)) {
      best = beat;
      bestPriority = priority;
      bestScore = score;
    }
  }
  return best;
};
