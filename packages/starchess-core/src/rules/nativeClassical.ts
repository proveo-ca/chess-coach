// SPEC: _spec/packages/starchess-core/sc-moves.puml, _spec/packages/starchess-core/scfen-queue.puml, _spec/packages/starchess-core/resolve.puml, _spec/packages/starchess-core/gas-phase-vacancy.puml
import { isScMoveShape } from "../board/moves";
import { parseSquare, sq, type ScPiece } from "../board/placement";
import type { Square } from "../model/square";
import type { ScAction } from "../model/types";
import { classicalRewriteCoordinatesAfterB, orderBHeadsFirst } from "./planning-order";
import { canMarineDoubleStep, marineSingleTarget } from "./specials/stimStep";

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

const matchedB = (actions: readonly ScAction[], c: Classical) => actions.find(a =>
  a.timing === "B" && a.color === c.color && a.from === c.from && a.to &&
  (a.kind === "stimStep" || a.kind === "tacticalJump"));

export const matchedMarineDouble = (
  actions: readonly ScAction[], c: Classical, selected: Coordinates,
  actor: Dependency | undefined, transfer: Transfer | undefined,
): boolean => {
  const b = matchedB(actions, c);
  const dir = c.color === "w" ? 1 : -1;
  const structural = classicalRewriteCoordinatesAfterB(actions, c);
  return b?.kind === "stimStep" && b.color === c.color && b.from === c.from &&
    b.to === marineSingleTarget(b.from, b.color) &&
    c.from[0] === c.to[0] && Number(c.to[1]) - Number(c.from[1]) === 2 * dir &&
    canMarineDoubleStep(c.from, c.color) &&
    structural?.from === selected.from && structural.to === selected.to &&
    transfer?.from === c.from && transfer.to === b.to &&
    transfer.actor.type === "p" && transfer.actor.color === c.color &&
    actor?.id === transfer.actor.id && actor.type === "p" && actor.color === c.color &&
    selected.from[0] === selected.to[0] && Number(selected.to[1]) - Number(selected.from[1]) === 2 * dir;
};

const fold = (context: NativeClassicalContext, actions: readonly ScAction[], c: Classical) => {
  const units = new Map<Square, Dependency>();
  let id = 0;
  for (const [at, piece] of context.ownUnits) units.set(at, { ...piece, id: `u:${id++}` });
  const initial = new Map(units);
  const sieged = new Set(context.ownSieged);
  const transfers = new Map<ScAction, Transfer>();
  const held: Extract<ScAction, { timing: "B" | "F" }>[] = [];
  const promote = (a: Extract<ScAction, { timing: "B" | "F" }>) => {
    if (!a.to || !a.promotion || Number(a.to[1]) !== (c.color === "w" ? 8 : 1)) return;
    const actor = units.get(a.to);
    if (actor?.type === "p" && actor.color === c.color) units.set(a.to, { ...actor, type: a.promotion });
  };
  for (const a of orderBHeadsFirst(actions.filter(a => a.timing === "B"))) {
    if (a.timing !== "B") continue;
    if (a.kind === "deploy" && a.to && a.unit) {
      units.set(a.to, { id: `b:${actions.indexOf(a)}`, type: a.unit, color: c.color });
    } else if ((a.kind === "stimStep" || a.kind === "tacticalJump") && a.to) {
      const actor = units.get(a.from);
      if (!actor || units.has(a.to)) continue;
      units.delete(a.from);
      units.set(a.to, actor);
      transfers.set(a, { actor: { ...actor }, from: a.from, to: a.to });
      if (a.kind === "stimStep") {
        if (actions.some(other => other.timing === "C" && other.from === a.from)) held.push(a);
        else promote(a);
      }
    } else if (a.kind === "siegeMode" && units.get(a.from)?.type === "r") {
      if (sieged.has(a.from)) sieged.delete(a.from);
      else sieged.add(a.from);
    }
  }
  const structural = classicalRewriteCoordinatesAfterB(actions, c);
  const b = matchedB(actions, c);
  const selected = structural && !(b?.kind === "stimStep" && units.has(structural.to))
    ? structural : { from: c.from, to: c.to };
  for (const a of held) if (selected.from !== a.to) promote(a);
  return { units, initial, sieged, transfers, selected };
};

const evaluate = (context: NativeClassicalContext, actions: readonly ScAction[], c: Classical,
  authored: Dependency | undefined, prefix: readonly ScAction[]): NativeClassicalEligibility => {
  const state = fold(context, actions, c);
  const actor = state.units.get(state.selected.from);
  const b = matchedB(actions, c);
  const diagnostic = (message: string): NativeClassicalDiagnostic => ({ code: "SC_BASELINE_FEN", message });
  const result: NativeClassicalEligibility = {
    ...state.selected, kind: actor ? "LIVE" : "NATIVE_DROP", actor: actor ?? authored, sieged: state.sieged,
  };
  if (!authored) {
    result.diagnostic = diagnostic(`no ${c.color} insertion-prefix actor on ${c.from}`);
  } else if (actor) {
    if (!isScMoveShape(actor.type, result.from, result.to, c.color) &&
        !matchedMarineDouble(actions, c, result, actor, b ? state.transfers.get(b) : undefined)) {
      result.diagnostic = diagnostic(`invalid ${c.color} ${actor.type} classical shape ${result.from}→${result.to}`);
    }
  } else if (!isScMoveShape(authored.type, c.from, c.to, c.color)) {
    const prior = matchedB(prefix, c);
    const dir = c.color === "w" ? 1 : -1;
    const origin = parseSquare(c.from);
    const target = parseSquare(c.to);
    const arrival = prior?.to ? parseSquare(prior.to) : null;
    const transferred = prior ? state.transfers.get(prior) : undefined;
    const fizzle = authored.type === "p" && c.from[0] === c.to[0] &&
      Number(c.to[1]) - Number(c.from[1]) === 2 * dir && !canMarineDoubleStep(c.from, c.color) &&
      prior?.kind === "stimStep" && prior.to === marineSingleTarget(prior.from, c.color) &&
      (Number(prior.to?.[1]) !== (c.color === "w" ? 8 : 1) || !!prior.promotion) &&
      !classicalRewriteCoordinatesAfterB(prefix, c) && arrival !== null &&
      !!sq(target.file + arrival.file - origin.file, target.rank + arrival.rank - origin.rank) &&
      transferred?.actor.id === authored.id && transferred.actor.type === "p" &&
      transferred.actor.color === c.color && !state.units.has(c.from);
    if (!fizzle) result.diagnostic = diagnostic(`invalid ${c.color} authored classical shape ${c.from}→${c.to}`);
  }
  return result;
};

export const nativeClassicalChecks = (
  context: NativeClassicalContext, ownActions: readonly ScAction[], c: Classical,
): NativeClassicalChecks => {
  const actions = ownActions.filter(a => a.color === c.color).slice().sort((a, b) => a.seq - b.seq);
  const prefix = actions.filter(a => a.seq < c.seq);
  const insertion = [...prefix, c];
  const authoring = fold(context, insertion, c);
  const authored = authoring.units.get(c.from) ?? authoring.initial.get(c.from);
  return {
    insertion: evaluate(context, insertion, c, authored, prefix),
    resulting: evaluate(context, actions, c, authored, prefix),
  };
};

export const nativeClassicalEligibility = (
  context: NativeClassicalContext, ownActions: readonly ScAction[], c: Classical,
): NativeClassicalEligibility => {
  const { insertion, resulting } = nativeClassicalChecks(context, ownActions, c);
  return { ...resulting, ...(insertion.diagnostic ? { diagnostic: insertion.diagnostic } : {}) };
};
