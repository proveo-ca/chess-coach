// SPEC: _spec/turn-resolution.puml
import { collectLegalCCChecks, mapToPlacement, placementToMap } from "./board";
import { energyForTurn } from "./constants";
import { assertMineCap, MAX_MINES_PER_SIDE, minesFor } from "./mines";
import { mineContact, withoutMine } from "./mine-contact";
import { charonStrikeTarget, placementAfterMechaCharon } from "./charon";
import { marineSingleTarget } from "./moves";
import { classicalRewriteCoordinatesAfterB, orderBHeadsFirst } from "./planning-order";
import { matchedMarineDouble } from "./native-classical";
import { assertNativeClassicalDependencies } from "./queue-validation";
import { assertQueueShape, queueGasSpent } from "./queue-contract";
import { applyPendingCCShots, resolveClassical } from "./classical-resolution";
import type { ClassicalPlan, ResolveMove, ResolvePromotion, ResolveTurnResult } from "./classical-resolution";
import { getSideVision } from "./vision";
import type { ScAction, ScFenSnapshot, ScMine, ScPiece, Square, StarChessColor, StarChessPiece } from "./types";
import type { CausalPhase, ResolutionEffects } from "./causal-types";

export type ResolveEvent = {
  id: string; phase: "specialBefore" | "attack" | "move" | "specialAfter"; color: StarChessColor;
  from?: Square; to?: Square; kind?: ScAction["kind"]; victim?: ScPiece; collider?: ScPiece;
  mineColor?: StarChessColor; chaseFrom?: Square; unit?: StarChessPiece;
};
export type EndScTurnResult = {
  resolved: ResolveTurnResult; next: ScFenSnapshot; ignoreAttacksOn: readonly Square[]; events: ResolveEvent[];
  siegedThisTurn: readonly Square[]; afterB: { placement: string; mines: ScMine[]; siegedTanks: readonly Square[] };
  afterPending: { placement: string; mines: ScMine[]; ccLives: ScFenSnapshot["ccLives"] };
  bMoves: ResolveMove[]; fMoves: ResolveMove[]; queue: readonly ScAction[];
};
export type EndScTurnOptions = { skipTurnStartChecks?: boolean };
export type BeginScTurnResult = {
  changed: boolean; attacks: ResolveTurnResult["attacks"]; afterPending: EndScTurnResult["afterPending"];
  next: ScFenSnapshot; asResolve: EndScTurnResult | null;
};
type NativeIdentity = ScPiece & { id: string };
type NativeIdentities = {
  units: Map<Square, NativeIdentity>;
  transfers: Map<ScAction, { actor: NativeIdentity; from: Square; to: Square }>;
  next: number;
};
type Special = Extract<ScAction, { timing: "B" | "F" }>;
type SpecialResult = { placement: string; mines: ScMine[]; victim?: ScPiece; collider?: ScPiece; mineColor?: StarChessColor; chaseFrom?: Square };

const emptyResolved = (placement: string, ccLives: ScFenSnapshot["ccLives"], mines: readonly ScMine[], attacks: ResolveTurnResult["attacks"]): ResolveTurnResult => {
  const board = { placement, ccLives: { ...ccLives }, mines: [...mines] };
  return { attacks: [...attacks], afterAttack: board, moves: [], afterMove: board, pathRevealAttacks: [], afterAll: board,
    mineTriggers: [], pathRevealMineTriggers: [], moveCollisions: [], promotions: [], pendingCCShotsArmed: [] };
};
const visionGate = (placement: string, mines: readonly ScMine[], sieged: ReadonlySet<Square>) => {
  const options = { mines, tankModeFor: (at: Square) => sieged.has(at) ? "siege" as const : "tank" as const };
  const white = getSideVision(placement, "w", options), black = getSideVision(placement, "b", options);
  return (side: StarChessColor, at: Square): boolean => {
    const vision = side === "w" ? white : black;
    return vision.litSquares.has(at) || vision.revealedPieces.has(at);
  };
};
export function refillTurnGas(snapshot: ScFenSnapshot): ScFenSnapshot {
  const spent = queueGasSpent(snapshot.queue?.actions);
  return { ...snapshot, gas: { w: Math.max(0, snapshot.gasIncome.w - spent.w), b: Math.max(0, snapshot.gasIncome.b - spent.b) } };
}

export const beginScTurn = (snapshot: ScFenSnapshot): BeginScTurnResult => beginScTurnKernel(snapshot);
export function beginScTurnKernel(snapshot: ScFenSnapshot, effects?: ResolutionEffects): BeginScTurnResult {
  if (snapshot.phase !== "P") throw new Error(`beginScTurn requires phase P (got ${snapshot.phase})`);
  const mines = [...snapshot.mines ?? []];
  const pending = applyPendingCCShots({ placement: snapshot.placement, ccLives: snapshot.ccLives, mines,
    pending: collectLegalCCChecks(snapshot.placement, { isTargetVisible: visionGate(snapshot.placement, mines, new Set(snapshot.siegedTanks ?? [])) }) }, effects);
  const afterPending = { placement: pending.placement, mines: [...pending.mines], ccLives: { ...pending.ccLives } };
  if (!pending.attacks.length) {
    const { specialsUsed: _cleared, ...rest } = snapshot;
    return { changed: false, attacks: [], afterPending: { placement: snapshot.placement, mines, ccLives: { ...snapshot.ccLives } },
      next: refillTurnGas({ ...rest, queue: snapshot.queue ?? { actions: [] } }), asResolve: null };
  }
  const terminal = pending.ccLives.w === 0 || pending.ccLives.b === 0;
  const sieged = [...snapshot.siegedTanks ?? []].sort();
  const next: ScFenSnapshot = { placement: pending.placement, turn: terminal ? snapshot.turn + 1 : snapshot.turn,
    ccLives: { ...pending.ccLives }, phase: terminal ? "O" : "P", gas: { w: snapshot.gasIncome.w, b: snapshot.gasIncome.b },
    gasIncome: snapshot.gasIncome, queue: { actions: [] }, ...(pending.mines.length ? { mines: pending.mines } : {}),
    ...(sieged.length ? { siegedTanks: sieged } : {}) };
  const events: ResolveEvent[] = pending.attacks.map((attack, index) => ({ id: `ev-begin-${index}`, phase: "attack",
    color: attack.color, from: attack.from, to: attack.to }));
  const asResolve: EndScTurnResult = { resolved: emptyResolved(pending.placement, pending.ccLives, pending.mines, pending.attacks),
    next, ignoreAttacksOn: [], events, siegedThisTurn: [], afterB: { placement: pending.placement, mines: pending.mines, siegedTanks: sieged },
    afterPending, bMoves: [], fMoves: [], queue: [] };
  return { changed: true, attacks: [...pending.attacks], afterPending, next, asResolve };
}

const byTiming = (actions: readonly ScAction[], timing: "B" | "C" | "F"): ScAction[] => actions.filter(action => action.timing === timing)
  .sort((left, right) => left.color === right.color ? left.seq - right.seq : left.color === "w" ? -1 : 1);
const relocate = (placement: string, from: Square, to: Square, identities?: NativeIdentities, source?: ScAction,
  effects?: ResolutionEffects): string => {
  const board = placementToMap(placement), actor = board.get(from);
  effects?.bindBoard(board);
  if (!actor) return placement;
  effects?.group(source?.timing === "F" ? "F" : "B", () => {
    const occupant = board.get(to);
    if (occupant && occupant !== actor) effects.destroy(occupant, source?.seq ?? null);
    effects.move(actor, from, to, source?.seq ?? null);
  });
  board.delete(from);
  board.set(to, actor);
  if (identities) {
    const identity = identities.units.get(from);
    identities.units.delete(from);
    identities.units.delete(to);
    if (identity) {
      identities.units.set(to, identity);
      if (source) identities.transfers.set(source, { actor: { ...identity }, from, to });
    }
  }
  return mapToPlacement(board);
};
const placeUnit = (placement: string, at: Square, piece: ScPiece): string => {
  const board = placementToMap(placement);
  board.set(at, piece);
  return mapToPlacement(board);
};
const applyArrivalMine = (placement: string, mines: ScMine[], squares: readonly Square[], color: StarChessColor,
  arriving: ScPiece, identities?: NativeIdentities, effects?: ResolutionEffects, phase: CausalPhase = "B",
  seq: number | null = null): SpecialResult => {
  const hit = mineContact({ mines, color, piece: arriving.type, squares, mode: "arrive" });
  if (hit.kind !== "detonated") return { placement, mines };
  const board = placementToMap(placement);
  effects?.bindBoard(board);
  effects?.group(phase, () => {
    const victim = board.get(hit.at);
    if (victim) effects.destroy(victim, seq);
    effects.mineContact(hit, seq, mines);
  });
  board.delete(hit.at);
  identities?.units.delete(hit.at);
  return { placement: mapToPlacement(board), mines: withoutMine(mines, hit), victim: { type: arriving.type, color: arriving.color },
    mineColor: hit.mineColor, ...(hit.chaseFrom ? { chaseFrom: hit.chaseFrom } : {}) };
};
const applySpecial = (placement: string, mines: ScMine[], action: Special, ignoreAttacksOn: Square[], identities?: NativeIdentities,
  effects?: ResolutionEffects): SpecialResult => {
  switch (action.kind) {
    case "charonMissiles": {
      if (!action.to) return { placement, mines };
      const board = placementToMap(placement), at = charonStrikeTarget(board, action.from, action.to, action.color);
      if (!at) return { placement, mines };
      const victim = board.get(at)!;
      effects?.bindBoard(board);
      effects?.group(action.timing, () => effects.destroy(victim, action.seq));
      identities?.units.delete(at);
      return { placement: placementAfterMechaCharon(placement, at), mines, victim: { type: victim.type, color: victim.color } };
    }
    case "tacticalJump": {
      if (!action.to) return { placement, mines };
      ignoreAttacksOn.push(action.from);
      const board = placementToMap(placement), hull = board.get(action.from);
      effects?.bindBoard(board);
      if (!hull || hull.color !== action.color) return { placement, mines };
      const occupant = board.get(action.to);
      if (occupant?.color === action.color) return { placement, mines };
      if (occupant && occupant.type !== "k") {
        effects?.group(action.timing, () => { effects.destroy(occupant, action.seq); effects.destroy(hull, action.seq); });
        board.delete(action.from);
        board.delete(action.to);
        identities?.units.delete(action.from);
        identities?.units.delete(action.to);
        return { placement: mapToPlacement(board), mines, victim: { type: occupant.type, color: occupant.color }, collider: { type: hull.type, color: hull.color } };
      }
      if (occupant) {
        effects?.group(action.timing, () => effects.destroy(hull, action.seq));
        board.delete(action.from);
        identities?.units.delete(action.from);
        return { placement: mapToPlacement(board), mines, victim: { type: hull.type, color: hull.color } };
      }
      return applyArrivalMine(relocate(placement, action.from, action.to, identities, action, effects), mines, [action.to], action.color, hull,
        identities, effects, action.timing, action.seq);
    }
    case "stimStep": {
      if (!action.to) return { placement, mines };
      const marine = placementToMap(placement).get(action.from);
      const stepped = relocate(placement, action.from, action.to, identities, action, effects);
      return marine ? applyArrivalMine(stepped, mines, [action.to], action.color, marine, identities, effects, action.timing, action.seq) : { placement: stepped, mines };
    }
    case "deploy": {
      if (!action.to || !action.unit) return { placement, mines };
      const board = placementToMap(placement), occupant = board.get(action.to);
      effects?.bindBoard(board);
      if (occupant?.type === "k") throw new Error(`spawn cannot crush Command Center on ${action.to}`);
      const deployed = { type: action.unit, color: action.color };
      effects?.group(action.timing, () => {
        if (occupant) effects.destroy(occupant, action.seq);
        const id = effects.create(deployed, action.to!, action.seq);
        effects.disposition(action.seq, id);
      });
      const landed = placeUnit(placement, action.to, deployed);
      if (identities) identities.units.set(action.to, { ...deployed, id: `u:${identities.next++}` });
      const crush = occupant ? { victim: { type: occupant.type, color: occupant.color } } : {};
      const blast = applyArrivalMine(landed, mines, [action.to], action.color, deployed, identities, effects, action.timing, action.seq);
      return blast.mineColor ? { placement: blast.placement, mines: blast.mines, mineColor: blast.mineColor, ...crush } : { placement: landed, mines, ...crush };
    }
    case "spiderMine": {
      const next = [...mines, { color: action.color, at: action.to ?? action.from }];
      assertMineCap(next, action.color);
      effects?.group(action.timing, () => effects.mineCreate(next[next.length - 1]!, action.seq));
      return { placement, mines: next };
    }
    case "siegeMode": return { placement, mines };
  }
};
const toggleTankSiege = (placement: string, sieged: Set<Square>, color: StarChessColor, at: Square,
  effects?: ResolutionEffects, phase: "B" | "F" = "B", seq = 0): boolean => {
  const board = placementToMap(placement), actor = board.get(at);
  effects?.bindBoard(board);
  if (!actor || actor.color !== color || actor.type !== "r") return false;
  if (sieged.has(at)) sieged.delete(at); else sieged.add(at);
  effects?.group(phase, () => effects.mode(actor, sieged.has(at) ? "siege" : "tank", seq));
  return true;
};
const classicalFor = (actions: readonly ScAction[], color: StarChessColor): ClassicalPlan | null => {
  const action = actions.find(value => value.timing === "C" && value.color === color);
  return action?.timing === "C" ? { color, from: action.from, to: action.to, ...(action.promotion ? { promotion: action.promotion } : {}) } : null;
};
const withExtraStepLegs = (plan: ClassicalPlan | null, actions: readonly ScAction[]): ClassicalPlan | null => {
  if (!plan) return plan;
  const before = actions.find(action => action.timing === "B" && action.kind === "stimStep" && action.color === plan.color && action.to === plan.from);
  const after = actions.find(action => action.timing === "F" && action.kind === "stimStep" && action.color === plan.color && action.from === plan.from);
  const to = after ? marineSingleTarget(plan.to, plan.color) : null;
  return { ...plan, ...(before ? { extraStepFrom: plan.from } : {}), ...(to ? { extraStepTo: to } : {}) };
};
const collectSpecialsUsed = (actions: readonly ScAction[], afterB: readonly ScAction[], placement: string,
  bMoves: readonly ResolveMove[], fMoves: readonly ResolveMove[], promotions: readonly ResolvePromotion[],
  warped: readonly { from: Square; to: Square }[], fWarped: readonly { from: Square; to: Square }[]): Square[] => {
  const used = new Set(actions.filter(action => action.timing !== "C").map(action => action.from));
  const migrate = (from: Square, to: Square): void => { if (from !== to && used.delete(from)) used.add(to); };
  for (const move of [...bMoves, ...warped]) migrate(move.from, move.to);
  for (const action of afterB) if (action.timing === "C") migrate(action.from, action.to);
  for (const move of [...fMoves, ...fWarped]) migrate(move.from, move.to);
  for (const promotion of promotions) used.delete(promotion.at);
  const board = placementToMap(placement);
  return [...used].filter(at => board.has(at)).sort();
};
export function rewriteClassicalAfterB(actions: readonly ScAction[], placement: string): ScAction[] {
  const occupied = placementToMap(placement), rewritten = actions.map(action => ({ ...action }));
  for (let index = 0; index < rewritten.length; index++) {
    const classical = rewritten[index]!;
    if (classical.timing !== "C") continue;
    const coordinates = classicalRewriteCoordinatesAfterB(rewritten, classical);
    if (!coordinates) continue;
    const before = rewritten.find(action => action.timing === "B" && action.color === classical.color && action.from === classical.from &&
      action.to && (action.kind === "stimStep" || action.kind === "tacticalJump"));
    if (before?.kind === "stimStep" && occupied.has(coordinates.to)) continue;
    rewritten[index] = { ...classical, ...coordinates };
  }
  return rewritten;
}

export const endScTurn = (snapshot: ScFenSnapshot, options?: EndScTurnOptions): EndScTurnResult => endScTurnKernel(snapshot, options);
export function endScTurnKernel(snapshot: ScFenSnapshot, options?: EndScTurnOptions, effects?: ResolutionEffects): EndScTurnResult {
  if (snapshot.phase !== "P") throw new Error(`endScTurn requires phase P (got ${snapshot.phase})`);
  const actions = snapshot.queue?.actions ?? [];
  assertQueueShape(actions);
  assertNativeClassicalDependencies(snapshot, actions);
  const events: ResolveEvent[] = [], ignoreAttacksOn: Square[] = [], siegedThisTurn: Square[] = [];
  let placement = snapshot.placement, mines = [...snapshot.mines ?? []], eventSeq = 0;
  const sieged = new Set(snapshot.siegedTanks ?? []);
  if (effects) effects.modeAt = at => sieged.has(at) ? "siege" : "tank";
  const noBirth = (requested: readonly ScAction[]): void => {
    for (const action of requested) if (action.kind === "deploy") effects?.group(action.timing, () => effects.disposition(action.seq, null));
  };
  const bMoves: ResolveMove[] = [], fMoves: ResolveMove[] = [], gasPromotions: ResolvePromotion[] = [];
  const warped: { from: Square; to: Square }[] = [], fWarped: { from: Square; to: Square }[] = [];
  const log = {
    shot: (attack: { color: StarChessColor; from: Square; to: Square }): void => {
      events.push({ id: `ev-${eventSeq++}`, phase: "attack", color: attack.color, from: attack.from, to: attack.to });
    },
    step: (move: { color: StarChessColor; from: Square; to: Square }): void => {
      events.push({ id: `ev-${eventSeq++}`, phase: "move", color: move.color, from: move.from, to: move.to });
    },
    special: (phase: ResolveEvent["phase"], action: ScAction, extra: Partial<ResolveEvent> = {}): void => {
      events.push({ id: `ev-${eventSeq++}`, phase, color: action.color, from: action.from, to: action.to, kind: action.kind, ...extra });
    },
  };
  const pending = options?.skipTurnStartChecks ? { placement, mines, ccLives: { ...snapshot.ccLives }, attacks: [] }
    : applyPendingCCShots({ placement, ccLives: snapshot.ccLives, mines,
      pending: collectLegalCCChecks(placement, { isTargetVisible: visionGate(placement, mines, sieged) }) }, effects);
  placement = pending.placement;
  mines = pending.mines;
  let ccLives = pending.ccLives;
  const afterPending = { placement, mines: [...mines], ccLives: { ...ccLives } };
  const finish = (result: { resolved: ResolveTurnResult; afterB: EndScTurnResult["afterB"]; bMoves?: ResolveMove[];
    fMoves?: ResolveMove[]; queue?: readonly ScAction[]; specialsUsed?: readonly Square[] }): EndScTurnResult => {
    const nextTurn = snapshot.turn + 1, income = energyForTurn(Math.max(1, nextTurn)), siegedTanks = [...sieged].sort();
    const next: ScFenSnapshot = { placement, turn: nextTurn, ccLives: { ...ccLives },
      phase: ccLives.w === 0 || ccLives.b === 0 ? "O" : "P", gas: { w: 0, b: 0 }, gasIncome: { w: income, b: income },
      queue: { actions: [] }, ...(mines.length ? { mines } : {}), ...(siegedTanks.length ? { siegedTanks } : {}),
      ...(result.specialsUsed?.length ? { specialsUsed: [...result.specialsUsed] } : {}) };
    return { resolved: result.resolved, next, ignoreAttacksOn, events, siegedThisTurn, afterB: result.afterB, afterPending,
      bMoves: result.bMoves ?? [], fMoves: result.fMoves ?? [], queue: result.queue ?? [] };
  };
  for (const attack of pending.attacks) log.shot(attack);
  if (ccLives.w === 0 || ccLives.b === 0) {
    noBirth(actions);
    return finish({ resolved: emptyResolved(placement, ccLives, mines, pending.attacks),
      afterB: { placement, mines: [...mines], siegedTanks: [...sieged].sort() } });
  }
  const identities: NativeIdentities = { units: new Map(), transfers: new Map(), next: 0 };
  for (const [at, piece] of placementToMap(placement)) identities.units.set(at, { ...piece, id: `u:${identities.next++}` });
  type BeforeEvent = { action: ScAction; extra: Partial<ResolveEvent> };
  const extrasBySeq = new Map<number, BeforeEvent>();
  const heldSteps: { at: Square; action: Special; event: BeforeEvent }[] = [];
  const applyGasPromotion = (action: Special, at: Square, survived: boolean): void => {
    if (!survived || Number(at[1]) !== (action.color === "w" ? 8 : 1) || !action.promotion) return;
    const board = placementToMap(placement), current = board.get(at);
    effects?.bindBoard(board);
    if (!current || current.type !== "p" || current.color !== action.color) return;
    effects?.group(action.timing, () => effects.transform(current, action.promotion!, action.seq));
    placement = placeUnit(placement, at, { type: action.promotion, color: action.color });
    const identity = identities.units.get(at);
    if (identity) identities.units.set(at, { ...identity, type: action.promotion });
    gasPromotions.push({ color: action.color, from: action.from, at, unit: action.promotion });
  };
  for (const color of ["w", "b"] as const) {
    for (const action of orderBHeadsFirst(byTiming(actions, "B").filter(value => value.color === color))) {
      if (action.timing !== "B") continue;
      if (action.kind === "siegeMode") {
        if (toggleTankSiege(placement, sieged, action.color, action.from, effects, "B", action.seq)) {
          siegedThisTurn.push(action.from);
          extrasBySeq.set(action.seq, { action, extra: {} });
        }
        continue;
      }
      const allyBlocked = (action.kind === "stimStep" || action.kind === "tacticalJump") && !!action.to &&
        placementToMap(placement).get(action.to)?.color === action.color;
      const held = !allyBlocked && action.kind === "stimStep" && !!action.to &&
        actions.some(value => value.timing === "C" && value.color === action.color && value.from === action.from);
      const applied: SpecialResult = allyBlocked ? { placement, mines }
        : held ? { placement: relocate(placement, action.from, action.to!, identities, action, effects), mines }
          : applySpecial(placement, mines, action, ignoreAttacksOn, identities, effects);
      const event: BeforeEvent = { action, extra: {} }, relocated = applied.placement !== placement;
      const stepped = !allyBlocked && action.kind === "stimStep" && !!action.to && relocated;
      placement = applied.placement;
      mines = applied.mines;
      if (!allyBlocked && action.kind === "tacticalJump" && action.to && relocated) warped.push({ from: action.from, to: action.to });
      if (stepped) {
        bMoves.push({ piece: "p", color: action.color, from: action.from, to: action.to! });
        if (held) heldSteps.push({ at: action.to!, action, event }); else applyGasPromotion(action, action.to!, !applied.mineColor);
      }
      event.extra = { ...(action.kind === "deploy" && action.unit ? { unit: action.unit } : {}),
        ...(applied.victim ? { victim: applied.victim } : {}), ...(applied.collider ? { collider: applied.collider } : {}),
        ...(applied.mineColor ? { mineColor: applied.mineColor } : {}) };
      extrasBySeq.set(action.seq, event);
    }
  }
  const actionsAfterB = rewriteClassicalAfterB(actions, placement);
  for (const { at, action, event } of heldSteps) {
    if (actionsAfterB.some(value => value.timing === "C" && value.color === action.color && value.from === at)) continue;
    const marine = placementToMap(placement).get(at);
    if (!marine) continue;
    const blast = applyArrivalMine(placement, mines, [at], action.color, marine, identities, effects, "B", action.seq);
    placement = blast.placement;
    mines = blast.mines;
    event.extra = { ...event.extra, ...(blast.victim ? { victim: blast.victim } : {}), ...(blast.mineColor ? { mineColor: blast.mineColor } : {}) };
    applyGasPromotion(action, at, !blast.mineColor);
  }
  for (const action of byTiming(actions, "B")) {
    const event = extrasBySeq.get(action.seq);
    if (event) log.special("specialBefore", event.action, event.extra);
  }
  const afterB = { placement, mines: [...mines], siegedTanks: [...sieged].sort() };
  const tankModeFor = (at: Square) => sieged.has(at) ? "siege" as const : "tank" as const;
  const isTargetVisible = visionGate(placement, mines, sieged);
  const boardAfterB = placementToMap(placement);
  for (const action of actionsAfterB) {
    if (action.timing !== "C") continue;
    const piece = boardAfterB.get(action.from);
    if (piece?.type === "p" && piece.color === action.color && Number(action.to[1]) === (action.color === "w" ? 8 : 1) && !action.promotion) {
      throw new Error(`endScTurn: classical last-rank ${action.from}→${action.to} needs promotion`);
    }
  }
  const nativeDoubles = { w: false, b: false };
  for (const action of actions) {
    if (action.timing !== "C") continue;
    const selected = actionsAfterB.find((value): value is Extract<ScAction, { timing: "C" }> => value.timing === "C" && value.color === action.color && value.seq === action.seq);
    const matched = actions.find(value => value.timing === "B" && value.color === action.color && value.from === action.from && value.to &&
      (value.kind === "stimStep" || value.kind === "tacticalJump"));
    if (selected && matchedMarineDouble(actions, action, selected, identities.units.get(selected.from), matched ? identities.transfers.get(matched) : undefined)) {
      nativeDoubles[action.color] = true;
    }
  }
  const classical = resolveClassical({ placement, ccLives, white: withExtraStepLegs(classicalFor(actionsAfterB, "w"), actions),
    black: withExtraStepLegs(classicalFor(actionsAfterB, "b"), actions), ignoreAttacksOn, mines, isTargetVisible,
    pathVisionOpts: { mines, tankModeFor }, siegedTanks: afterB.siegedTanks }, nativeDoubles, effects, {
      w: actions.find(action => action.timing === "C" && action.color === "w")?.seq ?? null,
      b: actions.find(action => action.timing === "C" && action.color === "b")?.seq ?? null,
    });
  let resolved: ResolveTurnResult = { ...classical, attacks: [...pending.attacks, ...classical.attacks], promotions: [...gasPromotions, ...classical.promotions] };
  for (const attack of classical.attacks) log.shot(attack);
  for (const move of resolved.moves) log.step(move);
  for (const blast of resolved.mineTriggers) log.step(blast);
  for (const hit of resolved.moveCollisions) log.step(hit);
  for (const attack of resolved.pathRevealAttacks) log.shot(attack);
  placement = resolved.afterAll.placement;
  mines = resolved.afterAll.mines;
  ccLives = resolved.afterAll.ccLives;
  const boardAfterMove = placementToMap(placement);
  for (const at of sieged) if (boardAfterMove.get(at)?.type !== "r") sieged.delete(at);
  if (ccLives.w === 0 || ccLives.b === 0) {
    noBirth(byTiming(actions, "F"));
    return finish({ resolved, afterB, bMoves, queue: [...actions] });
  }
  for (const action of byTiming(actions, "F")) {
    if (action.timing !== "F") continue;
    const original = classicalFor(actions, action.color), rewrittenC = classicalFor(actionsAfterB, action.color);
    const board = placementToMap(placement), candidates = [action.from];
    if (rewrittenC) candidates.push(rewrittenC.to, rewrittenC.from);
    if (original) candidates.push(original.to, original.from);
    const ownMove = rewrittenC?.from === action.from ? rewrittenC : original?.from === action.from ? original : null;
    const at = ownMove ? candidates.find(square => board.get(square)?.color === action.color) ?? action.from : action.from;
    const actor = board.get(at);
    if ((!actor || actor.color !== action.color) && action.kind !== "charonMissiles") { noBirth([action]); continue; }
    const rewritten: Special = action.kind === "spiderMine" ? { ...action, from: at, to: at } : { ...action, from: at };
    if (action.kind === "siegeMode") {
      if (actor?.type === "r" && toggleTankSiege(placement, sieged, action.color, at, effects, "F", action.seq)) {
        siegedThisTurn.push(at);
        log.special("specialAfter", rewritten);
      }
      continue;
    }
    if (action.kind === "stimStep") {
      if (actor?.type !== "p") continue;
      const to = marineSingleTarget(at, action.color);
      if (!to || board.has(to)) {
        const held = applyArrivalMine(placement, mines, [at], action.color, actor, undefined, effects, "F", action.seq);
        placement = held.placement;
        mines = held.mines;
        if (held.mineColor) log.special("specialAfter", { ...rewritten, to: at },
          { ...(held.victim ? { victim: held.victim } : {}), mineColor: held.mineColor });
        continue;
      }
      const stepped = applyArrivalMine(relocate(placement, at, to, undefined, action, effects), mines, [at, to], action.color, actor,
        undefined, effects, "F", action.seq);
      placement = stepped.placement;
      mines = stepped.mines;
      fMoves.push({ piece: "p", color: action.color, from: at, to });
      if (Number(to[1]) === (action.color === "w" ? 8 : 1) && action.promotion && !stepped.mineColor) {
        if (effects) {
          const current = placementToMap(placement);
          effects.bindBoard(current);
          effects.group("F", () => effects.transform(current.get(to)!, action.promotion!, action.seq));
        }
        placement = placeUnit(placement, to, { type: action.promotion, color: action.color });
        gasPromotions.push({ color: action.color, from: action.from, at: to, unit: action.promotion });
      }
      log.special("specialAfter", { ...rewritten, to }, { ...(stepped.victim ? { victim: stepped.victim } : {}),
        ...(stepped.mineColor ? { mineColor: stepped.mineColor } : {}), ...(stepped.chaseFrom ? { chaseFrom: stepped.chaseFrom } : {}) });
      continue;
    }
    const applied = applySpecial(placement, mines, rewritten, ignoreAttacksOn, undefined, effects);
    if (action.kind === "tacticalJump" && rewritten.to && applied.placement !== placement) fWarped.push({ from: rewritten.from, to: rewritten.to });
    placement = applied.placement;
    mines = applied.mines;
    log.special("specialAfter", rewritten, { ...(action.kind === "deploy" && action.unit ? { unit: action.unit } : {}),
      ...(applied.victim ? { victim: applied.victim } : {}), ...(applied.collider ? { collider: applied.collider } : {}),
      ...(applied.mineColor ? { mineColor: applied.mineColor } : {}) });
  }
  resolved = { ...resolved, promotions: [...gasPromotions, ...classical.promotions] };
  for (const color of ["w", "b"] as const) if (minesFor(mines, color).length > MAX_MINES_PER_SIDE) throw new Error(`endScTurn: ${color} mine cap exceeded`);
  const whiteCount = [...placement].filter(char => char === "K").length, blackCount = [...placement].filter(char => char === "k").length;
  if (whiteCount !== 1 || blackCount !== 1) throw new Error(`endScTurn: illegal Command Center count (w=${whiteCount} b=${blackCount}) after resolve: ${placement}`);
  return finish({ resolved, afterB, bMoves, fMoves, queue: [...actions],
    specialsUsed: collectSpecialsUsed(actions, actionsAfterB, placement, bMoves, fMoves, resolved.promotions, warped, fWarped) });
}
