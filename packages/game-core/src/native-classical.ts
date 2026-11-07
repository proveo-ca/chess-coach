// SPEC: _spec/turn-planning.puml
import { parseSquare, sq } from "./board";
import { canMarineDoubleStep, isScMoveShape, marineSingleTarget } from "./moves";
import { classicalRewriteCoordinatesAfterB, orderBHeadsFirst } from "./planning-order";
import type { ScAction, ScPiece, Square } from "./types";

type Classical = Extract<ScAction, { timing: "C" }>;
type Coordinates = { from: Square; to: Square };
type Dependency = ScPiece & { id: string };
type Transfer = { actor: Dependency; from: Square; to: Square };
export type NativeClassicalContext = {
  ownUnits: ReadonlyMap<Square, ScPiece>;
  ownSieged: ReadonlySet<Square>;
};
export type NativeClassicalDiagnostic = { code: "SC_BASELINE_FEN"; message: string };
export type NativeClassicalEligibility = Coordinates & {
  kind: "LIVE" | "NATIVE_DROP";
  actor: ScPiece | undefined;
  sieged: ReadonlySet<Square>;
  diagnostic?: NativeClassicalDiagnostic;
};
export type NativeClassicalChecks = {
  insertion: NativeClassicalEligibility;
  resulting: NativeClassicalEligibility;
};

const matchedB = (actions: readonly ScAction[], classical: Classical) => actions.find(action =>
  action.timing === "B" && action.color === classical.color && action.from === classical.from && action.to &&
  (action.kind === "stimStep" || action.kind === "tacticalJump"));

export const matchedMarineDouble = (
  actions: readonly ScAction[], classical: Classical, selected: Coordinates,
  actor: Dependency | undefined, transfer: Transfer | undefined,
): boolean => {
  const before = matchedB(actions, classical);
  const direction = classical.color === "w" ? 1 : -1;
  const structural = classicalRewriteCoordinatesAfterB(actions, classical);
  return before?.kind === "stimStep" && before.color === classical.color && before.from === classical.from &&
    before.to === marineSingleTarget(before.from, before.color) &&
    classical.from[0] === classical.to[0] && Number(classical.to[1]) - Number(classical.from[1]) === 2 * direction &&
    canMarineDoubleStep(classical.from, classical.color) &&
    structural?.from === selected.from && structural.to === selected.to &&
    transfer?.from === classical.from && transfer.to === before.to &&
    transfer.actor.type === "p" && transfer.actor.color === classical.color &&
    actor?.id === transfer.actor.id && actor.type === "p" && actor.color === classical.color &&
    selected.from[0] === selected.to[0] && Number(selected.to[1]) - Number(selected.from[1]) === 2 * direction;
};

const fold = (context: NativeClassicalContext, actions: readonly ScAction[], classical: Classical) => {
  const units = new Map<Square, Dependency>();
  let id = 0;
  for (const [at, piece] of context.ownUnits) units.set(at, { ...piece, id: `u:${id++}` });
  const initial = new Map(units);
  const sieged = new Set(context.ownSieged);
  const transfers = new Map<ScAction, Transfer>();
  const held: Extract<ScAction, { timing: "B" | "F" }>[] = [];
  const promote = (action: Extract<ScAction, { timing: "B" | "F" }>) => {
    if (!action.to || !action.promotion || Number(action.to[1]) !== (classical.color === "w" ? 8 : 1)) return;
    const actor = units.get(action.to);
    if (actor?.type === "p" && actor.color === classical.color) units.set(action.to, { ...actor, type: action.promotion });
  };
  for (const action of orderBHeadsFirst(actions.filter(action => action.timing === "B"))) {
    if (action.timing !== "B") continue;
    if (action.kind === "deploy" && action.to && action.unit) {
      units.set(action.to, { id: `b:${actions.indexOf(action)}`, type: action.unit, color: classical.color });
    } else if ((action.kind === "stimStep" || action.kind === "tacticalJump") && action.to) {
      const actor = units.get(action.from);
      if (!actor || units.has(action.to)) continue;
      units.delete(action.from);
      units.set(action.to, actor);
      transfers.set(action, { actor: { ...actor }, from: action.from, to: action.to });
      if (action.kind === "stimStep") {
        if (actions.some(other => other.timing === "C" && other.from === action.from)) held.push(action);
        else promote(action);
      }
    } else if (action.kind === "siegeMode" && units.get(action.from)?.type === "r") {
      if (sieged.has(action.from)) sieged.delete(action.from);
      else sieged.add(action.from);
    }
  }
  const structural = classicalRewriteCoordinatesAfterB(actions, classical);
  const before = matchedB(actions, classical);
  const selected = structural && !(before?.kind === "stimStep" && units.has(structural.to))
    ? structural : { from: classical.from, to: classical.to };
  for (const action of held) if (selected.from !== action.to) promote(action);
  return { units, initial, sieged, transfers, selected };
};

const evaluate = (
  context: NativeClassicalContext, actions: readonly ScAction[], classical: Classical,
  authored: Dependency | undefined, prefix: readonly ScAction[],
): NativeClassicalEligibility => {
  const state = fold(context, actions, classical);
  const actor = state.units.get(state.selected.from);
  const before = matchedB(actions, classical);
  const diagnostic = (message: string): NativeClassicalDiagnostic => ({ code: "SC_BASELINE_FEN", message });
  const result: NativeClassicalEligibility = {
    ...state.selected, kind: actor ? "LIVE" : "NATIVE_DROP", actor: actor ?? authored, sieged: state.sieged,
  };
  if (!authored) {
    result.diagnostic = diagnostic(`no ${classical.color} piece on ${classical.from}`);
  } else if (actor) {
    if (!isScMoveShape(actor.type, result.from, result.to, classical.color) &&
      !matchedMarineDouble(actions, classical, result, actor, before ? state.transfers.get(before) : undefined)) {
      result.diagnostic = diagnostic(`invalid ${classical.color} ${actor.type} classical shape ${result.from}→${result.to}`);
    }
  } else if (!isScMoveShape(authored.type, classical.from, classical.to, classical.color)) {
    const prior = matchedB(prefix, classical);
    const direction = classical.color === "w" ? 1 : -1;
    const origin = parseSquare(classical.from);
    const target = parseSquare(classical.to);
    const arrival = prior?.to ? parseSquare(prior.to) : null;
    const transferred = prior ? state.transfers.get(prior) : undefined;
    const fizzle = authored.type === "p" && classical.from[0] === classical.to[0] &&
      Number(classical.to[1]) - Number(classical.from[1]) === 2 * direction && !canMarineDoubleStep(classical.from, classical.color) &&
      prior?.kind === "stimStep" && prior.to === marineSingleTarget(prior.from, classical.color) &&
      (Number(prior.to?.[1]) !== (classical.color === "w" ? 8 : 1) || !!prior.promotion) &&
      !classicalRewriteCoordinatesAfterB(prefix, classical) && arrival !== null &&
      !!sq(target.file + arrival.file - origin.file, target.rank + arrival.rank - origin.rank) &&
      transferred?.actor.id === authored.id && transferred.actor.type === "p" &&
      transferred.actor.color === classical.color && !state.units.has(classical.from);
    if (!fizzle) result.diagnostic = diagnostic(`invalid ${classical.color} authored classical shape ${classical.from}→${classical.to}`);
  }
  return result;
};

export const nativeClassicalChecks = (
  context: NativeClassicalContext, ownActions: readonly ScAction[], classical: Classical,
): NativeClassicalChecks => {
  const actions = ownActions.filter(action => action.color === classical.color).slice().sort((a, b) => a.seq - b.seq);
  const prefix = actions.filter(action => action.seq < classical.seq);
  const insertion = [...prefix, classical];
  const authoring = fold(context, insertion, classical);
  const authored = authoring.units.get(classical.from) ?? authoring.initial.get(classical.from);
  return {
    insertion: evaluate(context, insertion, classical, authored, prefix),
    resulting: evaluate(context, actions, classical, authored, prefix),
  };
};

export const nativeClassicalEligibility = (
  context: NativeClassicalContext, ownActions: readonly ScAction[], classical: Classical,
): NativeClassicalEligibility => {
  const { insertion, resulting } = nativeClassicalChecks(context, ownActions, classical);
  return { ...resulting, ...(insertion.diagnostic ? { diagnostic: insertion.diagnostic } : {}) };
};
