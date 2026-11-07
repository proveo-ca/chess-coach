// SPEC: _spec/classical-resolution.puml
import { mapToPlacement, placementToMap } from "./board";
import { firstBlockerOnRay, pathContactSquares, rayBetween } from "./mines";
import { hostileMineOn, mineContact, withoutMine } from "./mine-contact";
import type { MineContact } from "./mine-contact";
import { moverContact, timedMover } from "./move-timing";
import type { MoverContact } from "./move-timing";
import { isScMoveShape } from "./moves";
import { ScValidateError } from "./queue-validation";
import { scanRay } from "./ray-scan";
import type { RayContact } from "./ray-scan";
import { pathRevealStepsKernel } from "./vision";
import type { VisionOptions } from "./vision";
import type { EngineMineId, ResolutionEffects } from "./causal-types";
import type { ScMine, ScPendingCCShot, ScPiece, SpawnPiece, Square, StarChessColor } from "./types";

export type ClassicalPlan = {
  color: StarChessColor; from: Square; to: Square; promotion?: SpawnPiece; extraStepFrom?: Square; extraStepTo?: Square;
};
export type ResolvePromotion = { color: StarChessColor; from: Square; at: Square; unit: SpawnPiece };
export type ResolveMove = { piece: ScPiece["type"]; color: StarChessColor; from: Square; to: Square };
export type ResolveAttack =
  | { kind: "capture"; piece: ScPiece["type"]; color: StarChessColor; from: Square; to: Square;
      victim: { piece: ScPiece["type"]; color: StarChessColor }; mineColor?: StarChessColor; dies?: boolean;
      occupies?: boolean; collision?: boolean; moveCollision?: boolean; pathRevealFrom?: Square; pathRevealSteps?: number }
  | { kind: "ccShot"; piece: ScPiece["type"]; color: StarChessColor; from: Square; to: Square;
      target: StarChessColor; livesAfter: number; moveCollision?: boolean; pathRevealFrom?: Square; pathRevealSteps?: number; stopAt?: Square }
  | { kind: "mineBlast"; piece: ScPiece["type"]; color: StarChessColor; from: Square; to: Square;
      mineColor: StarChessColor; victim?: { piece: ScPiece["type"]; color: StarChessColor }; chaseFrom?: Square }
  | { kind: "shelling"; piece: ScPiece["type"]; color: StarChessColor; from: Square; to: Square };
export type ResolveTurnInput = {
  placement: string; ccLives: Record<StarChessColor, number>; white: ClassicalPlan | null; black: ClassicalPlan | null;
  ignoreAttacksOn?: readonly Square[]; mines?: readonly ScMine[];
  isTargetVisible?: (color: StarChessColor, square: Square) => boolean;
  pathVisionOpts?: VisionOptions; siegedTanks?: readonly Square[];
};
export type ResolveBoard = { placement: string; ccLives: Record<StarChessColor, number>; mines: ScMine[] };
export type ResolveTurnResult = {
  attacks: ResolveAttack[]; afterAttack: ResolveBoard; moves: ResolveMove[]; afterMove: ResolveBoard;
  pathRevealAttacks: ResolveAttack[]; afterAll: ResolveBoard; mineTriggers: ResolveAttack[];
  pathRevealMineTriggers: ResolveAttack[]; moveCollisions: ResolveAttack[]; promotions: ResolvePromotion[];
  pendingCCShotsArmed: ScPendingCCShot[];
};
export type PathRevealSnap = { placement: string; mines: readonly ScMine[]; ccLives?: Record<StarChessColor, number> };
export type PathRevealApply = PathRevealSnap & { fired: boolean };

const clampLives = (value: number): number => Math.max(0, Math.min(3, Math.floor(value)));
const leapsPiece = (piece: ScPiece["type"]): boolean => piece === "n" || piece === "k" || piece === "p";
const attacksOwnDest = (piece: ScPiece["type"], from: Square, to: Square): boolean => piece !== "p" || from[0] !== to[0];
const squareBeforeOnRay = (from: Square, blocker: Square): Square | null => rayBetween(from, blocker).at(-1) ?? null;
type ResolveApproach = Exclude<ResolveAttack, { kind: "mineBlast" } | { kind: "shelling" }>;
const approachMineContact = (attack: ResolveApproach, mines: readonly ScMine[]): MineContact => {
  const origin = attack.pathRevealFrom;
  const landing = attack.kind === "ccShot" ? attack.stopAt ?? origin : attack.to;
  return mineContact({ mines, color: attack.color, piece: attack.piece,
    squares: !origin || !landing || landing === origin ? [] : [...rayBetween(origin, landing), landing],
    mode: attack.kind === "capture" ? "walkThenAttack" : "walk" });
};

export function applyPathRevealAttack(snapshot: PathRevealSnap, attack: ResolveAttack, effects?: ResolutionEffects,
  actionSeq: number | null = null, discoveryOrdinal?: number): PathRevealApply {
  if (attack.kind !== "capture" || !attack.pathRevealFrom) return { ...snapshot, fired: false };
  const board = placementToMap(snapshot.placement);
  const actor = board.get(attack.pathRevealFrom), victim = board.get(attack.to);
  if (!actor || actor.color !== attack.color || actor.type !== attack.piece ||
      !victim || victim.color !== attack.victim.color || victim.type !== attack.victim.piece) return { ...snapshot, fired: false };
  effects?.bindBoard(board);
  const span = effects?.group("C-path", () => {
    effects.destroy(victim, actionSeq);
    effects.move(actor, attack.pathRevealFrom!, attack.to, actionSeq);
  });
  if (effects && discoveryOrdinal !== undefined) effects.consume(discoveryOrdinal, span ?? null, actor, victim, "capture");
  board.delete(attack.pathRevealFrom);
  board.delete(attack.to);
  board.set(attack.to, actor);
  return { placement: mapToPlacement(board), mines: [...snapshot.mines],
    ccLives: snapshot.ccLives ? { ...snapshot.ccLives } : undefined, fired: true };
}

export function applyPathRevealCCShot(snapshot: PathRevealSnap & { ccLives: Record<StarChessColor, number> },
  attack: Extract<ResolveAttack, { kind: "ccShot" }>, effects?: ResolutionEffects, actionSeq: number | null = null,
  discoveryOrdinal?: number): PathRevealApply & { ccLives: Record<StarChessColor, number> } {
  const refused = (): PathRevealApply & { ccLives: Record<StarChessColor, number> } => ({ ...snapshot, ccLives: { ...snapshot.ccLives }, fired: false });
  if (!attack.pathRevealFrom || attack.stopAt == null) return refused();
  const board = placementToMap(snapshot.placement);
  const actor = board.get(attack.pathRevealFrom), target = board.get(attack.to);
  if (!actor || actor.color !== attack.color || actor.type !== attack.piece || !target || target.type !== "k" || target.color === attack.color) return refused();
  if (attack.stopAt !== attack.pathRevealFrom && board.has(attack.stopAt)) return refused();
  effects?.bindBoard(board);
  if (attack.stopAt !== attack.pathRevealFrom) {
    if (board.has(attack.stopAt)) return refused();
    board.delete(attack.pathRevealFrom);
    board.set(attack.stopAt, actor);
  }
  const ccLives = { w: clampLives(snapshot.ccLives.w), b: clampLives(snapshot.ccLives.b) };
  ccLives[attack.target] = clampLives(ccLives[attack.target] - 1);
  const span = effects?.group("C-path", () => {
    effects.move(actor, attack.pathRevealFrom!, attack.stopAt!, actionSeq);
    effects.damage(attack.target, ccLives[attack.target], actionSeq);
  });
  if (effects && discoveryOrdinal !== undefined) effects.consume(discoveryOrdinal, span ?? null, actor, target, "cc-shot");
  return { placement: mapToPlacement(board), mines: [...snapshot.mines], ccLives, fired: true };
}

export function applyPendingCCShots(input: { placement: string; ccLives: Record<StarChessColor, number>;
  pending: readonly ScPendingCCShot[]; mines?: readonly ScMine[] }, effects?: ResolutionEffects): ResolveBoard & { attacks: ResolveAttack[] } {
  const board = placementToMap(input.placement);
  effects?.bindBoard(board);
  const ccLives = { w: clampLives(input.ccLives.w), b: clampLives(input.ccLives.b) };
  let mines = [...input.mines ?? []];
  const attacks: ResolveAttack[] = [];
  const ordered = [...input.pending].sort((left, right) => left.color === right.color ? 0 : left.color === "w" ? -1 : 1);
  for (const shot of ordered) {
    const actor = board.get(shot.from), target = board.get(shot.to);
    if (!actor || actor.color !== shot.color || actor.type !== shot.piece || !target || target.color === shot.color || target.type !== "k") continue;
    const blocker = leapsPiece(actor.type) ? null : firstBlockerOnRay(board, shot.from, shot.to);
    if (blocker) {
      const victim = board.get(blocker)!;
      board.delete(blocker);
      const hit = mineContact({ mines, color: shot.color, piece: actor.type, squares: [blocker], mode: "attack" });
      effects?.group("turn-open", () => { effects.destroy(victim, null); effects.mineContact(hit, null, mines); });
      mines = withoutMine(mines, hit);
      attacks.push({ kind: "capture", piece: actor.type, color: shot.color, from: shot.from, to: blocker,
        victim: { piece: victim.type, color: victim.color }, occupies: false, collision: true,
        ...(hit.kind === "cleared" ? { mineColor: hit.mineColor } : {}) });
      continue;
    }
    const targetSide = shot.color === "w" ? "b" : "w";
    ccLives[targetSide] = clampLives(ccLives[targetSide] - 1);
    effects?.group("turn-open", () => effects.damage(targetSide, ccLives[targetSide], null));
    attacks.push({ kind: "ccShot", piece: actor.type, color: shot.color, from: shot.from, to: shot.to,
      target: targetSide, livesAfter: ccLives[targetSide] });
  }
  return { placement: mapToPlacement(board), ccLives, mines, attacks };
}

type RelocateMode = "occupy" | "quiet";
export const hasDepartingPlan = (plans: readonly ClassicalPlan[], color: StarChessColor, square: Square): boolean =>
  plans.some(plan => plan.color === color && plan.from === square);
export function isActorAnchored(board: ReadonlyMap<Square, ScPiece>, snapshot: ReadonlyMap<Square, ScPiece>, plan: ClassicalPlan): boolean {
  const initial = snapshot.get(plan.from), current = board.get(plan.from);
  return !!initial && !!current && initial.type === current.type && initial.color === current.color && current.color === plan.color;
}
export function isApproachOwnedDestination(board: ReadonlyMap<Square, ScPiece>, snapshot: ReadonlyMap<Square, ScPiece>, plan: ClassicalPlan): boolean {
  const initial = snapshot.get(plan.to);
  return !board.get(plan.to) && !!initial && initial.color !== plan.color;
}
export function clearDepartedGhost(board: Map<Square, ScPiece>, snapshot: ReadonlyMap<Square, ScPiece>, plan: ClassicalPlan): void {
  const destination = board.get(plan.to);
  if (destination && destination.color !== plan.color && !snapshot.get(plan.to)) board.delete(plan.to);
}

export const resolveTurn = (input: ResolveTurnInput): ResolveTurnResult => resolveClassical(input, { w: false, b: false });

export function resolveClassical(input: ResolveTurnInput, nativeDoubles: Readonly<Record<StarChessColor, boolean>>,
  effects?: ResolutionEffects, sources: Readonly<Record<StarChessColor, number | null>> = { w: null, b: null }): ResolveTurnResult {
  const start = placementToMap(input.placement);
  effects?.bindBoard(start);
  const queryBase = effects?.capture();
  const seqFor = (plan: Pick<ClassicalPlan, "color">): number | null => sources[plan.color];
  const scanQueries = new Map<ClassicalPlan, number>(), approachQueries = new Map<ResolveAttack, number>();
  const waveVictims = new Map<Square, { piece: ScPiece; seq: number | null }>();
  const removedMines: { ids: EngineMineId[]; seq: number | null }[] = [];
  const pendingMineIds = new Set<EngineMineId>();
  const rememberMine = (hit: MineContact, seq: number | null): void => {
    if (!effects || hit.kind === "inert") return;
    const ids = effects.mineRemovalIds(mines, hit, effects.mineOrder.filter(id => !pendingMineIds.has(id)));
    ids.forEach(id => pendingMineIds.add(id));
    removedMines.push({ ids, seq });
  };
  const flushMines = (): void => {
    for (const removal of removedMines) effects?.mineRemove(removal.ids, removal.seq);
    removedMines.length = 0;
    pendingMineIds.clear();
  };
  const plans: ClassicalPlan[] = [];
  for (const [plan, color] of [[input.white, "w"], [input.black, "b"]] as const) {
    if (plan) plans.push({ color, from: plan.from, to: plan.to, promotion: plan.promotion,
      extraStepFrom: plan.extraStepFrom, extraStepTo: plan.extraStepTo });
  }
  for (const plan of plans) {
    const actor = start.get(plan.from);
    if (actor?.color === plan.color && !isScMoveShape(actor.type, plan.from, plan.to, plan.color) &&
        !(actor.type === "p" && nativeDoubles[plan.color])) {
      throw new ScValidateError("SC_BASELINE_FEN", `invalid ${plan.color} ${actor.type} classical shape ${plan.from}→${plan.to}`);
    }
  }
  const lives = { w: clampLives(input.ccLives.w), b: clampLives(input.ccLives.b) };
  const ignoreAttacksOn = new Set(input.ignoreAttacksOn ?? []);
  let mines = [...input.mines ?? []];
  const canSee = input.isTargetVisible ?? (() => true);
  const attacks: ResolveAttack[] = [], moveCollisions: ResolveAttack[] = [];
  const deadSquares = new Set<Square>(), destinationsWritten = new Set<Square>();
  const occupy: ClassicalPlan[] = [], quiets: ClassicalPlan[] = [], delayed: ClassicalPlan[] = [];
  const pathRevealPending: ResolveAttack[] = [];
  const clearOnCapture = (at: Square, color: StarChessColor, piece: ScPiece["type"]): StarChessColor | undefined => {
    const hit = mineContact({ mines, color, piece, squares: [at], mode: "attack" });
    rememberMine(hit, sources[color]);
    mines = withoutMine(mines, hit);
    return hit.kind === "cleared" ? hit.mineColor : undefined;
  };
  const queryFor = (plan: ClassicalPlan, target: Square, site: "scan-ray" | "reveal-to") => effects?.discovery({
    actionSeq: seqFor(plan)!, side: plan.color, site, base: queryBase!, from: plan.from, to: plan.to, target,
    modeSource: input.pathVisionOpts?.tankModeFor ? "native-sieged-set" : "default-tank",
    siegedSquares: input.siegedTanks ?? [], mineInputProvided: input.pathVisionOpts?.mines !== undefined,
    mines: input.pathVisionOpts?.mines ?? [],
  });
  const scanFor = (plan: ClassicalPlan) => scanRay({ board: start, placement: input.placement,
    from: plan.from, intentTo: plan.to, color: plan.color, canSee, visionOpts: input.pathVisionOpts }, target => {
    const query = queryFor(plan, target, "scan-ray");
    if (query) scanQueries.set(plan, query.ordinal);
    return query;
  });
  type PlanContext = { plan: ClassicalPlan; actor: ScPiece; target: ScPiece | undefined; visible0: boolean;
    leaps: boolean; siegedFrom: boolean; siegedTank: boolean; scan: () => ReturnType<typeof scanFor> };
  type PlanOutcome = { kind: "drop" } | { kind: "quiet"; to?: Square } | { kind: "occupy"; to: Square }
    | { kind: "capture"; at: Square; victim: ScPiece; fogged?: boolean }
    | { kind: "mineClear"; at: Square; mineColor: StarChessColor } | { kind: "shelling"; at: Square }
    | { kind: "approach"; shot: ResolveAttack };
  const applyOutcome = (context: PlanContext, outcome: PlanOutcome): void => {
    const { plan, actor } = context;
    switch (outcome.kind) {
      case "drop": return;
      case "quiet": quiets.push(outcome.to ? { ...plan, to: outcome.to } : plan); return;
      case "occupy": occupy.push({ ...plan, to: outcome.to }); return;
      case "capture": {
        if (outcome.fogged && hasDepartingPlan(plans, outcome.victim.color, outcome.at)) {
          delayed.push({ ...plan, to: outcome.at });
          return;
        }
        const mineColor = clearOnCapture(outcome.at, plan.color, actor.type);
        (outcome.fogged ? moveCollisions : attacks).push({ kind: "capture", piece: actor.type,
          color: plan.color, from: plan.from, to: outcome.at, victim: { piece: outcome.victim.type, color: outcome.victim.color },
          occupies: true, ...(mineColor ? { mineColor } : {}), ...(outcome.fogged ? { collision: true, moveCollision: true } : {}) });
        deadSquares.add(outcome.at);
        waveVictims.set(outcome.at, { piece: start.get(outcome.at)!, seq: seqFor(plan) });
        occupy.push({ ...plan, to: outcome.at });
        return;
      }
      case "mineClear":
        attacks.push({ kind: "mineBlast", piece: actor.type, color: plan.color, from: plan.from, to: outcome.at, mineColor: outcome.mineColor });
        rememberMine({ kind: "cleared", at: outcome.at, mineColor: outcome.mineColor }, seqFor(plan));
        mines = mines.filter(mine => mine.at !== outcome.at);
        if (!context.siegedTank) occupy.push(plan);
        return;
      case "shelling":
        attacks.push({ kind: "shelling", piece: actor.type, color: plan.color, from: plan.from, to: outcome.at });
        return;
      case "approach":
        pathRevealPending.push(outcome.shot);
        if (effects) {
          const ordinal = scanQueries.get(plan);
          if (ordinal === undefined) throw new Error("Causal journal: MISSING_DISCOVERY");
          approachQueries.set(outcome.shot, ordinal);
          effects.deferred(ordinal);
        }
        if (outcome.shot.kind === "capture" || outcome.shot.kind === "ccShot") delayed.push(plan);
        return;
    }
  };
  const rayContactOutcome = (context: PlanContext, contact: RayContact): PlanOutcome => {
    if (!contact.startVisible && !contact.becomesVisible) return context.siegedFrom ? { kind: "drop" }
      : { kind: "capture", at: contact.at, victim: contact.occ, fogged: true };
    if (contact.becomesVisible) return { kind: "approach", shot: { kind: "capture", piece: context.actor.type,
      color: context.plan.color, from: contact.discovery!, to: contact.at, victim: { piece: contact.occ.type, color: contact.occ.color },
      occupies: true, pathRevealFrom: context.plan.from, pathRevealSteps: contact.revealSteps! } };
    return { kind: "capture", at: contact.at, victim: contact.occ };
  };
  const revealTo = (context: PlanContext, target: Square) => {
    const query = queryFor(context.plan, target, "reveal-to");
    if (query) scanQueries.set(context.plan, query.ordinal);
    return pathRevealStepsKernel(input.placement, context.plan.from, context.plan.to, context.plan.color, target, input.pathVisionOpts, query);
  };
  const rules: readonly ((context: PlanContext) => PlanOutcome | null)[] = [
    ({ plan, target }) => target && target.color !== plan.color && target.type === "q" && ignoreAttacksOn.has(plan.to) ? { kind: "drop" } : null,
    ({ plan, actor }) => {
      if (actor.type !== "p" || plan.to[0] !== plan.from[0]) return null;
      const path = [...rayBetween(plan.from, plan.to), plan.to], blocked = path.findIndex(at => start.has(at));
      if (blocked < 0) return null;
      return blocked > 0 ? { kind: "quiet", to: path[blocked - 1]! } : { kind: "drop" };
    },
    context => {
      const { plan, actor, target, leaps } = context;
      if (!target || target.color === plan.color || target.type !== "k") return null;
      const blocker = leaps ? null : firstBlockerOnRay(start, plan.from, plan.to);
      if (!blocker) return { kind: "drop" };
      const victim = start.get(blocker)!;
      if (victim.color === plan.color || victim.type === "k") return { kind: "drop" };
      const visible = canSee(plan.color, blocker), reveal = leaps ? null : revealTo(context, blocker);
      if (!visible && reveal != null && reveal > 0) return { kind: "approach", shot: { kind: "capture", piece: actor.type,
        color: plan.color, from: rayBetween(plan.from, plan.to)[reveal - 1]!, to: blocker,
        victim: { piece: victim.type, color: victim.color }, occupies: true, pathRevealFrom: plan.from, pathRevealSteps: reveal } };
      return { kind: "capture", at: blocker, victim, ...(!visible ? { fogged: true } : {}) };
    },
    ({ plan, target }) => target?.color === plan.color ? { kind: "drop" } : null,
    ({ plan, actor, target, visible0 }) => actor.type === "p" && plan.to[0] !== plan.from[0] && !target &&
      !(visible0 && hostileMineOn(mines, plan.color, plan.to)) ? { kind: "drop" } : null,
    context => {
      const { plan, target, leaps } = context;
      if (!target || target.color === plan.color || leaps) return null;
      const { contact } = context.scan();
      if (!contact) return null;
      if (contact.occ.color === plan.color) return { kind: "quiet" };
      return contact.occ.type === "k" ? null : rayContactOutcome(context, contact);
    },
    context => {
      const { plan, actor, target, visible0, leaps } = context;
      if (!target || target.color === plan.color) return null;
      const reveal = !visible0 && !leaps ? revealTo(context, plan.to) : null;
      const lightsUp = reveal != null && reveal > 0;
      if (!visible0 && !lightsUp) return context.siegedTank ? { kind: "drop" } : { kind: "capture", at: plan.to, victim: target, fogged: true };
      if (lightsUp) return { kind: "approach", shot: { kind: "capture", piece: actor.type, color: plan.color,
        from: rayBetween(plan.from, plan.to)[reveal - 1]!, to: plan.to, victim: { piece: target.type, color: target.color },
        occupies: true, pathRevealFrom: plan.from, pathRevealSteps: reveal } };
      return { kind: "capture", at: plan.to, victim: target };
    },
    context => {
      const { plan, actor, target, visible0 } = context;
      if (target) return null;
      const armed = mineContact({ mines, color: plan.color, piece: actor.type, squares: [plan.to], mode: "attack" });
      if (armed.kind !== "cleared") return null;
      if (context.siegedTank && !context.leaps && firstBlockerOnRay(start, plan.from, plan.to)) return null;
      if (!visible0 && context.siegedTank) return { kind: "drop" };
      const reachable = context.leaps || !firstBlockerOnRay(start, plan.from, plan.to);
      return visible0 && reachable && attacksOwnDest(actor.type, plan.from, plan.to)
        ? { kind: "mineClear", at: plan.to, mineColor: armed.mineColor } : { kind: "quiet" };
    },
    context => {
      const { plan, actor, leaps } = context;
      if (leaps) return null;
      const { contact } = context.scan();
      if (!contact || contact.occ.color === plan.color) return null;
      if (contact.occ.type !== "k") return rayContactOutcome(context, contact);
      if (contact.becomesVisible) return { kind: "approach", shot: { kind: "ccShot", piece: actor.type,
        color: plan.color, from: contact.discovery!, to: contact.at, target: plan.color === "w" ? "b" : "w", livesAfter: 0,
        pathRevealFrom: plan.from, pathRevealSteps: contact.revealSteps!, stopAt: contact.stopBefore ?? plan.from } };
      return contact.stopBefore && contact.stopBefore !== plan.from ? { kind: "occupy", to: contact.stopBefore } : { kind: "drop" };
    },
    context => {
      const { plan, target, visible0 } = context;
      if (!context.siegedTank || target || (plan.from[0] !== plan.to[0] && plan.from[1] !== plan.to[1])) return null;
      if (context.scan().contact) return { kind: "drop" };
      return visible0 ? { kind: "shelling", at: plan.to } : null;
    },
    () => ({ kind: "quiet" }),
  ];
  for (const plan of plans) {
    const actor = start.get(plan.from);
    if (!actor || actor.color !== plan.color) continue;
    let scanned: ReturnType<typeof scanFor> | null = null;
    const siegedFrom = !!input.siegedTanks?.includes(plan.from);
    const context: PlanContext = { plan, actor, target: start.get(plan.to), visible0: canSee(plan.color, plan.to),
      leaps: leapsPiece(actor.type), siegedFrom, siegedTank: siegedFrom && actor.type === "r", scan: () => scanned ??= scanFor(plan) };
    for (const rule of rules) {
      const outcome = rule(context);
      if (outcome) { applyOutcome(context, outcome); break; }
    }
  }
  const mid = new Map(start);
  effects?.group("C-attack", () => {
    for (const victim of waveVictims.values()) effects.destroy(victim.piece, victim.seq);
    flushMines();
  });
  for (const at of deadSquares) mid.delete(at);
  const afterAttack = { placement: mapToPlacement(mid), ccLives: { ...lives }, mines: [...mines] };
  const board = new Map(mid);
  const moves: ResolveMove[] = [], mineTriggers: ResolveAttack[] = [];
  const moversDead = new Set<Square>();
  const pendingPromos: ResolvePromotion[] = [];
  type Landing = { plan: ClassicalPlan; piece: ScPiece; dest: Square };
  const planLanding = (plan: ClassicalPlan, mode: RelocateMode): Landing | null => {
    if (deadSquares.has(plan.from) || moversDead.has(plan.from)) return null;
    const piece = board.get(plan.from);
    if (!piece || piece.color !== plan.color || (piece.type === "r" && input.siegedTanks?.includes(plan.from))) return null;
    let dest = plan.to;
    if (mode === "quiet" && !leapsPiece(piece.type)) {
      const blocker = firstBlockerOnRay(board, plan.from, plan.to);
      if (blocker) {
        const blocking = board.get(blocker)!;
        if (blocking.type === "k" || blocking.color === plan.color) {
          const before = squareBeforeOnRay(plan.from, blocker);
          if (!before || before === plan.from) return null;
          dest = before;
        } else dest = blocker;
      }
    }
    const occupant = board.get(dest);
    if (occupant?.type === "k") {
      const before = squareBeforeOnRay(plan.from, dest);
      if (!before || before === plan.from || (occupant.color !== plan.color && board.get(before))) return null;
      dest = before;
    }
    return { plan, piece, dest };
  };
  const walkContact = ({ plan, piece, dest }: Landing): MineContact => plan.extraStepTo ? { kind: "inert" }
    : mineContact({ mines, color: plan.color, piece: piece.type,
      squares: [...(plan.extraStepFrom ? [plan.extraStepFrom] : []), ...pathContactSquares(plan.from, dest, piece.type), dest], mode: "walk" });
  const land = ({ plan, piece, dest }: Landing, rammed?: ScPiece): void => {
    const occupant = board.get(dest);
    if (occupant && occupant.color !== plan.color && occupant.type !== "k") {
      if (destinationsWritten.has(dest)) {
        effects?.group("C-move", () => {
          effects.destroy(occupant, seqFor(plan));
          effects.destroy(piece, sources[occupant.color]);
        });
        moveCollisions.push(
          { kind: "capture", piece: piece.type, color: plan.color, from: plan.from, to: dest,
            victim: { piece: occupant.type, color: occupant.color }, occupies: false, collision: true, moveCollision: true },
          { kind: "capture", piece: occupant.type, color: occupant.color, from: dest, to: dest,
            victim: { piece: piece.type, color: plan.color }, occupies: false, collision: true, moveCollision: true });
        board.delete(dest);
        board.delete(plan.from);
        destinationsWritten.delete(dest);
        moves.push({ piece: piece.type, color: plan.color, from: plan.from, to: dest });
        return;
      }
      board.delete(dest);
      const mineColor = clearOnCapture(dest, plan.color, piece.type);
      moveCollisions.push({ kind: "capture", piece: piece.type, color: plan.color, from: plan.from, to: dest,
        victim: { piece: occupant.type, color: occupant.color }, occupies: true, collision: true, moveCollision: true,
        ...(mineColor ? { mineColor } : {}) });
    }
    const trip = walkContact({ plan, piece, dest });
    effects?.group("C-move", () => {
      if (rammed) effects.destroy(rammed, seqFor(plan));
      if (occupant && occupant.color !== plan.color && occupant.type !== "k") effects.destroy(occupant, seqFor(plan));
      effects.move(piece, plan.from, dest, seqFor(plan));
      flushMines();
    });
    board.delete(plan.from);
    board.set(dest, piece);
    destinationsWritten.add(dest);
    moves.push({ piece: piece.type, color: plan.color, from: plan.from, to: dest });
    if (piece.type === "p" && plan.promotion && Number(dest[1]) === (plan.color === "w" ? 8 : 1)) {
      pendingPromos.push({ color: plan.color, from: plan.from, at: dest, unit: plan.promotion });
    }
    if (trip.kind === "detonated") {
      effects?.group("C-move", () => { effects.destroy(piece, seqFor(plan)); effects.mineContact(trip, seqFor(plan), mines); });
      mineTriggers.push({ kind: "mineBlast", piece: piece.type, color: plan.color, from: plan.from, to: trip.at,
        mineColor: trip.mineColor, victim: { piece: piece.type, color: plan.color }, ...(trip.chaseFrom ? { chaseFrom: trip.chaseFrom } : {}) });
      mines = withoutMine(mines, trip);
      board.delete(dest);
      moversDead.add(dest);
    }
  };
  const relocate = (plan: ClassicalPlan, mode: RelocateMode): void => {
    const landing = planLanding(plan, mode);
    if (landing) land(landing);
  };
  const scheduleOf = (landing: Landing) => timedMover(landing.plan.from, landing.dest, landing.piece.type,
    { diesOnLanding: walkContact(landing).kind === "detonated" });
  const stopShortOf = (landing: Landing, at: Square): Landing | null => {
    if (leapsPiece(landing.piece.type)) return null;
    const before = squareBeforeOnRay(landing.plan.from, at);
    return before ? { ...landing, dest: before } : null;
  };
  const collide = (a: Landing, b: Landing, contact: MoverContact): void => {
    const [rammer, held] = contact.first === "a" ? [b, a] : [a, b];
    effects?.group("C-move", () => { effects.destroy(a.piece, seqFor(b.plan)); effects.destroy(b.piece, seqFor(a.plan)); });
    moveCollisions.push(
      { kind: "capture", piece: rammer.piece.type, color: rammer.plan.color, from: rammer.plan.from, to: contact.at,
        victim: { piece: held.piece.type, color: held.plan.color }, occupies: false, collision: true, moveCollision: true },
      { kind: "capture", piece: held.piece.type, color: held.plan.color, from: contact.first === "both" ? held.plan.from : contact.at,
        to: contact.at, victim: { piece: rammer.piece.type, color: rammer.plan.color }, occupies: false, collision: true, moveCollision: true });
    for (const landing of [a, b]) {
      board.delete(landing.plan.from);
      moves.push({ piece: landing.piece.type, color: landing.plan.color, from: landing.plan.from, to: contact.at });
    }
  };
  const ccTakes = (cc: Landing, other: Landing, at: Square): void => {
    const mineColor = clearOnCapture(at, cc.plan.color, cc.piece.type);
    moveCollisions.push({ kind: "capture", piece: cc.piece.type, color: cc.plan.color, from: cc.plan.from, to: at,
      victim: { piece: other.piece.type, color: other.plan.color }, occupies: true, collision: true, moveCollision: true,
      ...(mineColor ? { mineColor } : {}) });
    board.delete(other.plan.from);
    moves.push({ piece: other.piece.type, color: other.plan.color, from: other.plan.from, to: at });
    land(cc, other.piece);
  };
  const moveWave = (wave: readonly (readonly [ClassicalPlan, RelocateMode])[]): void => {
    const landings = wave.map(([plan, mode]) => planLanding(plan, mode)).filter((landing): landing is Landing => landing !== null);
    const [a, b] = landings;
    const contact = a && b && landings.length === 2 && a.plan.color !== b.plan.color ? moverContact(scheduleOf(a), scheduleOf(b)) : null;
    if (!a || !b || !contact) { for (const landing of landings) land(landing); return; }
    const aCC = a.piece.type === "k", bCC = b.piece.type === "k";
    if (aCC && bCC) return;
    if (!aCC && !bCC) { collide(a, b, contact); return; }
    const [cc, other, ccFirst] = aCC ? [a, b, contact.first === "a"] : [b, a, contact.first === "b"];
    if (!ccFirst) { ccTakes(cc, other, contact.at); return; }
    land(cc);
    const short = stopShortOf(other, contact.at);
    if (short && short.dest !== short.plan.from) land(short);
  };
  moveWave([...occupy.map(plan => [plan, "occupy"] as const), ...quiets.map(plan => [plan, "quiet"] as const)]);
  const pathRevealAttacks: ResolveAttack[] = [], pathRevealMineTriggers: ResolveAttack[] = [];
  const firedFrom = new Set<Square>();
  let phase3: PathRevealSnap & { ccLives: Record<StarChessColor, number> } = {
    placement: mapToPlacement(board), mines: [...mines], ccLives: { ...lives },
  };
  const applyApproachMine = (attack: ResolveApproach): StarChessColor | undefined => {
    const trip = approachMineContact(attack, phase3.mines);
    if (trip.kind === "inert") return undefined;
    if (trip.kind === "cleared") {
      effects?.group("C-path", () => effects.mineContact(trip, sources[attack.color], phase3.mines));
      phase3 = { ...phase3, mines: withoutMine(phase3.mines, trip) };
      return trip.mineColor;
    }
    const current = placementToMap(phase3.placement);
    effects?.bindBoard(current);
    effects?.group("C-path", () => {
      const victim = current.get(trip.at);
      if (victim) effects.destroy(victim, sources[attack.color]);
      effects.mineContact(trip, sources[attack.color], phase3.mines);
    });
    current.delete(trip.at);
    phase3 = { placement: mapToPlacement(current), mines: withoutMine(phase3.mines, trip), ccLives: { ...phase3.ccLives } };
    pathRevealMineTriggers.push({ kind: "mineBlast", piece: attack.piece, color: attack.color, from: attack.pathRevealFrom!,
      to: trip.at, mineColor: trip.mineColor, victim: { piece: attack.piece, color: attack.color }, ...(trip.chaseFrom ? { chaseFrom: trip.chaseFrom } : {}) });
    return undefined;
  };
  for (const attack of pathRevealPending) {
    if ((attack.kind !== "capture" && attack.kind !== "ccShot") || !attack.pathRevealFrom ||
        input.siegedTanks?.includes(attack.pathRevealFrom) || destinationsWritten.has(attack.pathRevealFrom)) continue;
    if (attack.kind === "capture") {
      const applied = applyPathRevealAttack(phase3, attack, effects, sources[attack.color], approachQueries.get(attack));
      if (!applied.fired) continue;
      firedFrom.add(attack.pathRevealFrom);
      phase3 = { placement: applied.placement, mines: [...applied.mines], ccLives: { ...phase3.ccLives } };
      const mineColor = applyApproachMine(attack);
      pathRevealAttacks.push(mineColor ? { ...attack, mineColor } : attack);
      continue;
    }
    const applied = applyPathRevealCCShot(phase3, attack, effects, sources[attack.color], approachQueries.get(attack));
    if (!applied.fired) continue;
    phase3 = { placement: applied.placement, mines: [...applied.mines], ccLives: { ...applied.ccLives } };
    lives.w = applied.ccLives.w;
    lives.b = applied.ccLives.b;
    const fired = { ...attack, livesAfter: applied.ccLives[attack.target] };
    applyApproachMine(fired);
    pathRevealAttacks.push(fired);
  }
  mines = [...phase3.mines];
  const orderedDelayed = [...delayed];
  if (orderedDelayed.length === 2 && orderedDelayed[0]!.to === orderedDelayed[1]!.from && orderedDelayed[1]!.to !== orderedDelayed[0]!.from) orderedDelayed.reverse();
  for (const plan of orderedDelayed) {
    if (firedFrom.has(plan.from)) continue;
    const current = placementToMap(phase3.placement);
    effects?.bindBoard(current);
    if (!isActorAnchored(board, current, plan) || isApproachOwnedDestination(board, current, plan)) continue;
    clearDepartedGhost(board, current, plan);
    const actor = board.get(plan.from)!;
    const cross = orderedDelayed.find(other => other !== plan && other.from === plan.to && !firedFrom.has(other.from) && other.to === plan.from);
    if (cross) {
      const otherActor = board.get(cross.from);
      if (!otherActor || otherActor.color !== cross.color) continue;
      effects?.group("C-move", () => {
        effects.move(actor, plan.from, cross.from, seqFor(plan));
        effects.move(otherActor, cross.from, plan.from, seqFor(cross));
      });
      board.delete(plan.from);
      board.delete(cross.from);
      board.set(cross.from, actor);
      board.set(plan.from, otherActor);
      moves.push({ piece: actor.type, color: plan.color, from: plan.from, to: cross.from },
        { piece: otherActor.type, color: cross.color, from: cross.from, to: plan.from });
      current.delete(plan.from);
      current.delete(cross.from);
      current.set(cross.from, actor);
      current.set(plan.from, otherActor);
      for (const [from, to, piece, color] of [[plan.from, cross.from, actor, plan.color], [cross.from, plan.from, otherActor, cross.color]] as const) {
        const trip = mineContact({ mines, color, piece: piece.type, squares: [to], mode: "walk" });
        if (trip.kind !== "detonated") continue;
        effects?.group("C-move", () => { effects.destroy(piece, sources[color]); effects.mineContact(trip, sources[color], mines); });
        board.delete(to);
        current.delete(to);
        mines = withoutMine(mines, trip);
        mineTriggers.push({ kind: "mineBlast", piece: piece.type, color, from, to: trip.at, mineColor: trip.mineColor,
          victim: { piece: piece.type, color }, ...(trip.chaseFrom ? { chaseFrom: trip.chaseFrom } : {}) });
      }
      phase3 = { ...phase3, placement: mapToPlacement(current), mines: [...mines] };
      firedFrom.add(plan.from);
      firedFrom.add(cross.from);
      continue;
    }
    const movesBefore = moves.length, triggersBefore = mineTriggers.length, collisionsBefore = moveCollisions.length;
    relocate(plan, "occupy");
    if (moves.length === movesBefore) continue;
    const move = moves[moves.length - 1]!;
    if (mineTriggers.length > triggersBefore) {
      const trip = mineTriggers[mineTriggers.length - 1]!;
      const at = trip.kind === "mineBlast" ? trip.chaseFrom ?? trip.to : trip.to;
      current.delete(plan.from);
      current.delete(move.to);
      phase3 = { ...phase3, placement: mapToPlacement(current), mines: phase3.mines.filter(mine => mine.at !== at) };
      continue;
    }
    if (moveCollisions.length > collisionsBefore) {
      const hit = moveCollisions[moveCollisions.length - 1]!;
      current.delete(plan.from);
      current.delete(hit.to);
      if (hit.kind === "capture" && hit.occupies) current.set(hit.to, { type: hit.piece, color: hit.color });
      phase3 = { ...phase3, placement: mapToPlacement(current),
        mines: "mineColor" in hit && hit.mineColor ? phase3.mines.filter(mine => mine.at !== hit.to) : phase3.mines };
      continue;
    }
    current.delete(plan.from);
    current.set(move.to, { type: move.piece, color: move.color });
    phase3 = { ...phase3, placement: mapToPlacement(current) };
  }
  const afterMove = { placement: mapToPlacement(board), ccLives: { ...lives }, mines: [...mines] };
  const promoted = placementToMap(phase3.placement);
  effects?.bindBoard(promoted);
  const promotions: ResolvePromotion[] = [];
  for (const promotion of pendingPromos) {
    if (moversDead.has(promotion.at)) continue;
    const landed = promoted.get(promotion.at);
    if (!landed || landed.type !== "p" || landed.color !== promotion.color) continue;
    effects?.group("C-promotion", () => effects.transform(landed, promotion.unit, sources[promotion.color]));
    promoted.set(promotion.at, { type: promotion.unit, color: promotion.color });
    promotions.push(promotion);
  }
  return { attacks, afterAttack, moves, mineTriggers, pathRevealMineTriggers, moveCollisions, pathRevealAttacks, promotions,
    afterMove, afterAll: { placement: mapToPlacement(promoted), ccLives: { ...lives }, mines: [...phase3.mines] }, pendingCCShotsArmed: [] };
}
