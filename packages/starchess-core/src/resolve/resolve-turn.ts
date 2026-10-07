// SPEC: _spec/packages/starchess-core/resolve.puml, _spec/packages/starchess-core/overview.puml, _spec/packages/starchess-core/resolve-turn-activity.puml, _spec/packages/starchess-core/mine-contact.puml, _spec/apps/starchess/core/turn/resolve-pipeline.puml, _spec/packages/starchess-core/gas-phase-vacancy.puml, _spec/packages/starchess-core/move-timing.puml
import type { Square } from "chess.js";

import {
  mapToPlacement,
  placementToMap,
  type ScPiece,
} from "../board/placement";
import { firstBlockerOnRay, pathContactSquares, rayBetween } from "../board/mines";
import {
  hostileMineOn,
  mineContact,
  withoutMine,
  type MineContact,
} from "../board/mine-contact";
import type { StarChessColor } from "../model/types";
import type {
  ClassicalPlan,
  TankMode,
  ScMine,
  ScPendingCCShot,
  SpawnPiece,
} from "../model/types";
import { scanRayKernel, type RayContact } from "../board/ray-scan";
import { moverContact, timedMover, type MoverContact } from "../board/move-timing";
import { pathRevealStepsKernel } from "../board/vision";
import type { ProvenanceRecorder } from "./provenance-recorder";
import type { MineId } from "./provenance-types";

export type { ClassicalPlan };

export type ResolvePromotion = {
  color: StarChessColor;
  from: Square;
  at: Square;
  unit: SpawnPiece;
};

export type ResolveAttack =
  | {
      kind: "capture";
      piece: ScPiece["type"];
      color: StarChessColor;
      from: Square;
      to: Square;
      victim: { piece: ScPiece["type"]; color: StarChessColor };
      /**
       * A hostile mine on the target tile, cleared by this same shot. The wreck
       * needs a cue of its own — `Rxe5` onto a mined e5 kills two things, and
       * without this the mine leaves the board with no death VFX.
       */
      mineColor?: StarChessColor;
      dies?: boolean;
      occupies?: boolean;
      collision?: boolean;
      moveCollision?: boolean;
      pathRevealFrom?: Square;
      pathRevealSteps?: number;
    }
  | {
      kind: "ccShot";
      piece: ScPiece["type"];
      color: StarChessColor;
      from: Square;
      to: Square;
      target: StarChessColor;
      livesAfter: number;
      moveCollision?: boolean;
      pathRevealFrom?: Square;
      pathRevealSteps?: number;
      stopAt?: Square;
    }
  | {
      kind: "mineBlast";
      piece: ScPiece["type"];
      color: StarChessColor;
      from: Square;
      to: Square;
      mineColor: StarChessColor;
      victim?: { piece: ScPiece["type"]; color: StarChessColor };
      chaseFrom?: Square;
    }
  | {
      /**
       * Siege Tank shelling empty ground: no victim, no relocate — the HE
       * impact still plays at `to` to resolve the fire intent. Timeline
       * renders the attack cue with no death cue.
       */
      kind: "shelling";
      piece: ScPiece["type"];
      color: StarChessColor;
      from: Square;
      to: Square;
    };

export type ResolveMove = {
  piece: ScPiece["type"];
  color: StarChessColor;
  from: Square;
  to: Square;
};

export type ResolveTurnInput = {
  placement: string;
  ccLives: Record<StarChessColor, number>;
  white: ClassicalPlan | null;
  black: ClassicalPlan | null;
  ignoreAttacksOn?: readonly Square[];
  mines?: readonly ScMine[];
  isTargetVisible?: (color: StarChessColor, square: Square) => boolean;
  pathVisionOpts?: {
    tankModeFor?: (square: Square) => TankMode;
    mines?: readonly ScMine[];
  };
  siegedTanks?: readonly Square[];
};

export type ResolveTurnResult = {
  attacks: ResolveAttack[];
  afterAttack: {
    placement: string;
    ccLives: Record<StarChessColor, number>;
    mines: ScMine[];
  };
  moves: ResolveMove[];
  afterMove: {
    placement: string;
    ccLives: Record<StarChessColor, number>;
    mines: ScMine[];
  };
  pathRevealAttacks: ResolveAttack[];
  afterAll: {
    placement: string;
    ccLives: Record<StarChessColor, number>;
    mines: ScMine[];
  };
  mineTriggers: ResolveAttack[];
  pathRevealMineTriggers: ResolveAttack[];
  moveCollisions: ResolveAttack[];
  promotions: ResolvePromotion[];
  pendingCCShotsArmed: ScPendingCCShot[];
};

const clampLives = (n: number) => Math.max(0, Math.min(3, Math.floor(n)));

export type PathRevealSnap = {
  placement: string;
  mines: readonly ScMine[];
  ccLives?: Record<StarChessColor, number>;
};

export type PathRevealApply = PathRevealSnap & { fired: boolean };

export const applyPathRevealAttack = (
  snap: PathRevealSnap,
  a: ResolveAttack,
): PathRevealApply => {
  return applyPathRevealAttackKernel(snap, a);
};

const applyPathRevealAttackKernel = (
  snap: PathRevealSnap,
  a: ResolveAttack,
  recorder?: ProvenanceRecorder,
  queryOrdinal?: number,
): PathRevealApply => {
  if (a.kind !== "capture" || !a.pathRevealFrom) return { ...snap, fired: false };
  const map = placementToMap(snap.placement);
  recorder?.board(map);
  const actor = map.get(a.pathRevealFrom);
  if (!actor || actor.color !== a.color || actor.type !== a.piece) {
    return { ...snap, fired: false };
  }
  const occ = map.get(a.to);
  if (!occ || occ.color !== a.victim.color || occ.type !== a.victim.piece) {
    return { ...snap, fired: false };
  }
  if (recorder) {
    const seq = recorder.queries[queryOrdinal!]!.sourceActionSeq;
    const frame = recorder.frame("C-path-reveal", () => {
      recorder.destroy(occ, seq);
      recorder.move(actor, a.pathRevealFrom!, a.to, seq);
    });
    recorder.consume(queryOrdinal!, frame, actor, occ, "capture");
  }
  map.delete(a.pathRevealFrom);
  map.delete(a.to);
  map.set(a.to, actor);
  return {
    placement: mapToPlacement(map),
    mines: [...snap.mines],
    ccLives: snap.ccLives ? { ...snap.ccLives } : undefined,
    fired: true,
  };
};

export const applyPathRevealCCShot = (
  snap: PathRevealSnap & { ccLives: Record<StarChessColor, number> },
  a: Extract<ResolveAttack, { kind: "ccShot" }>,
): PathRevealApply & { ccLives: Record<StarChessColor, number> } => {
  return applyPathRevealCCShotKernel(snap, a);
};

const applyPathRevealCCShotKernel = (
  snap: PathRevealSnap & { ccLives: Record<StarChessColor, number> },
  a: Extract<ResolveAttack, { kind: "ccShot" }>,
  recorder?: ProvenanceRecorder,
  queryOrdinal?: number,
): PathRevealApply & { ccLives: Record<StarChessColor, number> } => {
  if (!a.pathRevealFrom || a.stopAt == null) {
    return { ...snap, ccLives: { ...snap.ccLives }, fired: false };
  }
  const map = placementToMap(snap.placement);
  recorder?.board(map);
  const actor = map.get(a.pathRevealFrom);
  if (!actor || actor.color !== a.color || actor.type !== a.piece) {
    return { ...snap, ccLives: { ...snap.ccLives }, fired: false };
  }
  const commandCenter = map.get(a.to);
  if (!commandCenter || commandCenter.type !== "k" || commandCenter.color === a.color) {
    return { ...snap, ccLives: { ...snap.ccLives }, fired: false };
  }
  if (a.stopAt !== a.pathRevealFrom) {
    if (map.has(a.stopAt)) {
      return { ...snap, ccLives: { ...snap.ccLives }, fired: false };
    }
    map.delete(a.pathRevealFrom);
    map.set(a.stopAt, actor);
  }
  const ccLives = {
    w: clampLives(snap.ccLives.w),
    b: clampLives(snap.ccLives.b),
  };
  ccLives[a.target] = clampLives(ccLives[a.target] - 1);
  if (recorder) {
    const seq = recorder.queries[queryOrdinal!]!.sourceActionSeq;
    const frame = recorder.frame("C-path-reveal", () => {
      recorder.move(actor, a.pathRevealFrom!, a.stopAt!, seq);
      recorder.damage(a.target, ccLives[a.target], seq);
    });
    recorder.consume(queryOrdinal!, frame, actor, commandCenter, "cc-shot");
  }
  return {
    placement: mapToPlacement(map),
    mines: [...snap.mines],
    ccLives,
    fired: true,
  };
};

const plansOf = (input: ResolveTurnInput): ClassicalPlan[] => {
  const out: ClassicalPlan[] = [];
  if (input.white) out.push({ ...input.white, color: "w" });
  if (input.black) out.push({ ...input.black, color: "b" });
  return out;
};

const leapsPiece = (t: ScPiece["type"]) => t === "n" || t === "k" || t === "p";

const attacksOwnDest = (
  type: ScPiece["type"],
  from: Square,
  to: Square,
): boolean => {
  if (type === "p") return from[0] !== to[0];
  return true;
};

type ResolveApproach = Exclude<ResolveAttack, { kind: "mineBlast" } | { kind: "shelling" }>;

const approachWalk = (a: ResolveApproach): Square[] => {
  if (!a.pathRevealFrom) return [];
  const origin = a.pathRevealFrom;
  const landing = a.kind === "ccShot" ? (a.stopAt ?? origin) : a.to;
  if (landing === origin) return [];
  return [...rayBetween(origin, landing), landing];
};

const approachMineContact = (
  a: ResolveApproach,
  mines: readonly ScMine[],
): MineContact =>
  mineContact({
    mines,
    color: a.color,
    piece: a.piece,
    squares: approachWalk(a),
    // A capture fires at the tile it lands on — the blocking unit is what
    // stopped the ray. A `ccShot` stops *short* and shoots from range, so the
    // tile it settles on was never fired upon and stays part of the walk.
    mode: a.kind === "capture" ? "walkThenAttack" : "walk",
  });

const squareBeforeOnRay = (from: Square, blocker: Square): Square | null => {
  const mids = rayBetween(from, blocker);
  if (mids.length) return mids[mids.length - 1]!;
  return null;
};

export const applyPendingCCShots = (input: {
  placement: string;
  ccLives: Record<StarChessColor, number>;
  pending: readonly ScPendingCCShot[];
  mines?: readonly ScMine[];
}): {
  placement: string;
  ccLives: Record<StarChessColor, number>;
  mines: ScMine[];
  attacks: ResolveAttack[];
} => {
  return applyPendingCCShotsKernel(input);
};

export const applyPendingCCShotsKernel = (input: {
  placement: string;
  ccLives: Record<StarChessColor, number>;
  pending: readonly ScPendingCCShot[];
  mines?: readonly ScMine[];
}, recorder?: ProvenanceRecorder): {
  placement: string;
  ccLives: Record<StarChessColor, number>;
  mines: ScMine[];
  attacks: ResolveAttack[];
} => {
  const map = placementToMap(input.placement);
  recorder?.board(map);
  const lives = {
    w: clampLives(input.ccLives.w),
    b: clampLives(input.ccLives.b),
  };
  let mines: ScMine[] = [...(input.mines ?? [])];
  const attacks: ResolveAttack[] = [];
  /**
   * A capture lands on the target tile, so a mine sitting there goes with it.
   * Returns the mine's colour so the caller can stamp its attack — attack mode
   * only ever clears (never detonates), so there is nothing else to report.
   */
  const clearOnCapture = (
    at: Square,
    color: StarChessColor,
    piece: ScPiece["type"],
  ): StarChessColor | undefined => {
    const hit = mineContact({ mines, color, piece, squares: [at], mode: "attack" });
    recorder?.mineContact(hit, null, mines);
    mines = withoutMine(mines, hit);
    return hit.kind === "cleared" ? hit.mineColor : undefined;
  };

  const ordered = [...input.pending].sort((a, b) => {
    if (a.color !== b.color) return a.color === "w" ? -1 : 1;
    return 0;
  });

  for (const shot of ordered) {
    const actor = map.get(shot.from);
    if (!actor || actor.color !== shot.color || actor.type !== shot.piece) continue;
    const target = map.get(shot.to);
    if (!target || target.color === shot.color || target.type !== "k") continue;

    const leaps = leapsPiece(actor.type);
    const blocker = leaps ? null : firstBlockerOnRay(map, shot.from, shot.to);
    if (blocker) {
      const victim = map.get(blocker)!;
      let mineColor: StarChessColor | undefined;
      const apply = () => {
        recorder?.destroy(victim, null);
        map.delete(blocker);
        mineColor = clearOnCapture(blocker, shot.color, actor.type);
      };
      if (recorder) recorder.frame("turn-open", apply); else apply();
      attacks.push({
        kind: "capture",
        piece: actor.type,
        color: shot.color,
        from: shot.from,
        to: blocker,
        victim: { piece: victim.type, color: victim.color },
        occupies: false,
        collision: true,
        ...(mineColor ? { mineColor } : {}),
      });
      continue;
    }

    const hit = shot.color === "w" ? "b" : "w";
    const livesAfter = clampLives(lives[hit] - 1);
    lives[hit] = livesAfter;
    recorder?.frame("turn-open", () => recorder.damage(hit, livesAfter, null));
    attacks.push({
      kind: "ccShot",
      piece: actor.type,
      color: shot.color,
      from: shot.from,
      to: shot.to,
      target: hit,
      livesAfter,
    });
  }

  return {
    placement: mapToPlacement(map),
    ccLives: lives,
    mines,
    attacks,
  };
};

export type RelocateMode = "occupy" | "quiet";

export const hasDepartingPlan = (
  plans: readonly ClassicalPlan[],
  color: StarChessColor,
  square: Square,
): boolean =>
  plans.some((p) => p.color === color && p.from === square);

export const isActorAnchored = (
  board: ReadonlyMap<Square, ScPiece>,
  snapshot: ReadonlyMap<Square, ScPiece>,
  plan: ClassicalPlan,
): boolean => {
  const snapPiece = snapshot.get(plan.from);
  const livePiece = board.get(plan.from);
  return (
    !!snapPiece &&
    !!livePiece &&
    snapPiece.type === livePiece.type &&
    snapPiece.color === livePiece.color &&
    livePiece.color === plan.color
  );
};

export const isApproachOwnedDestination = (
  board: ReadonlyMap<Square, ScPiece>,
  snapshot: ReadonlyMap<Square, ScPiece>,
  plan: ClassicalPlan,
): boolean => {
  const snapDest = snapshot.get(plan.to);
  return !board.get(plan.to) && !!snapDest && snapDest.color !== plan.color;
};

export const clearDepartedGhost = (
  board: Map<Square, ScPiece>,
  snapshot: ReadonlyMap<Square, ScPiece>,
  plan: ClassicalPlan,
): void => {
  const liveDest = board.get(plan.to);
  if (liveDest && liveDest.color !== plan.color && !snapshot.get(plan.to)) {
    board.delete(plan.to);
  }
};

export const resolveTurn = (input: ResolveTurnInput): ResolveTurnResult => {
  return resolveTurnKernel(input);
};

export const resolveTurnKernel = (
  input: ResolveTurnInput,
  recorder?: ProvenanceRecorder,
  sources: Record<StarChessColor, number | null> = { w: null, b: null },
  nativeSiegedSet?: ReadonlySet<Square>,
): ResolveTurnResult => {
  const start = placementToMap(input.placement);
  recorder?.board(start);
  const queryBase = recorder?.image();
  const seqFor = (plan: ClassicalPlan) => sources[plan.color];
  const scanQueries = new Map<ClassicalPlan, number>();
  const approachQueries = new Map<ResolveAttack, number>();
  const waveVictims = new Map<Square, { piece: ScPiece; seq: number | null }>();
  const removedMines: { ids: MineId[]; seq: number | null }[] = [];
  const pendingMineIds = new Set<MineId>();
  const rememberMine = (hit: MineContact, seq: number | null) => {
    if (!recorder || hit.kind === "inert") return;
    const ids = recorder.mineRemovalIds(mines, hit, recorder.nativeMineOrder.filter(id => !pendingMineIds.has(id)));
    ids.forEach(id => pendingMineIds.add(id));
    removedMines.push({ ids, seq });
  };
  const flushMines = () => {
    for (const removal of removedMines) recorder?.mineRemove(removal.ids, removal.seq);
    removedMines.length = 0; pendingMineIds.clear();
  };
  const lives = {
    w: clampLives(input.ccLives.w),
    b: clampLives(input.ccLives.b),
  };
  const plans = plansOf(input);
  const ignoreAttacksOn = new Set<Square>(input.ignoreAttacksOn ?? []);
  let mines: ScMine[] = [...(input.mines ?? [])];
  const canSee = input.isTargetVisible ?? (() => true);

  const attacks: ResolveAttack[] = [];
  const moveCollisions: ResolveAttack[] = [];
  const deadSquares = new Set<Square>();
  const occupy: ClassicalPlan[] = [];
  const quiets: ClassicalPlan[] = [];
  const delayed: ClassicalPlan[] = [];
  const pendingCCShotsArmed: ScPendingCCShot[] = [];
  const pathRevealPending: ResolveAttack[] = [];
  const destinationsWritten = new Set<Square>();
  /**
   * A capture lands on the target tile, so a mine sitting there goes with it.
   * Returns the mine's colour so the caller can stamp its attack — attack mode
   * only ever clears (never detonates), so there is nothing else to report.
   */
  const clearOnCapture = (
    at: Square,
    color: StarChessColor,
    piece: ScPiece["type"],
    seq: number | null,
  ): StarChessColor | undefined => {
    const hit = mineContact({ mines, color, piece, squares: [at], mode: "attack" });
    rememberMine(hit, seq);
    mines = withoutMine(mines, hit);
    return hit.kind === "cleared" ? hit.mineColor : undefined;
  };

  const queryFor = (plan: ClassicalPlan, target: Square, site: "scan-ray" | "reveal-to") => {
    if (!recorder) return undefined;
    const bytes = new Uint8Array(8);
    for (const at of nativeSiegedSet ?? []) {
      const index = (at.charCodeAt(0) - 97) * 8 + Number(at[1]) - 1;
      bytes[Math.floor(index / 8)]! |= 1 << (7 - index % 8);
    }
    return recorder.query({
      sourceActionSeq: seqFor(plan)!, site, base: queryBase!, from: plan.from, to: plan.to,
      side: plan.color, target,
      visionInputs: {
        modeSource: input.pathVisionOpts?.tankModeFor ? "native-sieged-set" : "default-tank",
        siegeMaskHex: [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join(""),
        mineSource: input.pathVisionOpts?.mines === undefined ? "absent" : "provided",
        mines: (input.pathVisionOpts?.mines ?? []).map(mine => ({ ...mine })),
      },
    });
  };

  const scanFor = (plan: ClassicalPlan) =>
    scanRayKernel({
      board: start,
      placement: input.placement,
      from: plan.from,
      intentTo: plan.to,
      color: plan.color,
      canSee,
      visionOpts: input.pathVisionOpts,
    }, target => {
      const query = queryFor(plan, target, "scan-ray");
      if (query) scanQueries.set(plan, query.ordinal);
      return query;
    });

  type PlanContext = {
    plan: ClassicalPlan;
    actor: ScPiece;
    target: ScPiece | undefined;
    visible0: boolean;
    leaps: boolean;
    siegedFrom: boolean;
    siegedTank: boolean;
    scan: () => ReturnType<typeof scanFor>;
  };

  type PlanOutcome =
    | { kind: "drop" }
    | { kind: "quiet"; to?: Square }
    | { kind: "occupy"; to: Square }
    | { kind: "capture"; at: Square; victim: ScPiece; fogged?: boolean }
    | { kind: "mineClear"; at: Square; mineColor: StarChessColor }
    | { kind: "shelling"; at: Square }
    | { kind: "approach"; shot: ResolveAttack; queryOrdinal?: number };

  type PlanRule = {
    name: string;
    match: (ctx: PlanContext) => PlanOutcome | null;
  };

  const applyOutcome = (ctx: PlanContext, out: PlanOutcome): void => {
    const { plan, actor } = ctx;
    switch (out.kind) {
      case "drop":
        return;
      case "quiet":
        quiets.push(out.to ? { ...plan, to: out.to } : plan);
        return;
      case "occupy":
        occupy.push({ ...plan, to: out.to });
        return;
      case "capture": {
        if (out.fogged && hasDepartingPlan(plans, out.victim.color, out.at)) {
          delayed.push({ ...plan, to: out.at });
          return;
        }
        const mineColor = clearOnCapture(out.at, plan.color, actor.type, seqFor(plan));
        const hit: ResolveAttack = {
          kind: "capture",
          piece: actor.type,
          color: plan.color,
          from: plan.from,
          to: out.at,
          victim: { piece: out.victim.type, color: out.victim.color },
          occupies: true,
          ...(mineColor ? { mineColor } : {}),
          ...(out.fogged ? { collision: true, moveCollision: true } : {}),
        };
        (out.fogged ? moveCollisions : attacks).push(hit);
        deadSquares.add(out.at);
        waveVictims.set(out.at, { piece: start.get(out.at)!, seq: seqFor(plan) });
        occupy.push({ ...plan, to: out.at });
        return;
      }
      case "mineClear":
        attacks.push({
          kind: "mineBlast",
          piece: actor.type,
          color: plan.color,
          from: plan.from,
          to: out.at,
          mineColor: out.mineColor,
        });
        rememberMine({ kind: "cleared", at: out.at, mineColor: out.mineColor }, seqFor(plan));
        mines = mines.filter((m) => m.at !== out.at);
        if (!ctx.siegedTank) occupy.push(plan);
        return;
      case "shelling":
        attacks.push({
          kind: "shelling",
          piece: actor.type,
          color: plan.color,
          from: plan.from,
          to: out.at,
        });
        return;
      case "approach":
        if (recorder && out.queryOrdinal !== undefined) {
          approachQueries.set(out.shot, out.queryOrdinal);
          recorder.deferred(out.queryOrdinal);
        }
        pathRevealPending.push(out.shot);
        if (out.shot.kind === "capture" || out.shot.kind === "ccShot") {
          delayed.push(plan);
        }
        return;
    }
  };

  const rayContactOutcome = (
    ctx: PlanContext,
    c: RayContact,
  ): PlanOutcome => {
    if (!c.startVisible && !c.becomesVisible) {
      if (ctx.siegedFrom) return { kind: "drop" };
      return { kind: "capture", at: c.at, victim: c.occ, fogged: true };
    }
    if (c.becomesVisible) {
      return {
        kind: "approach",
        queryOrdinal: scanQueries.get(ctx.plan),
        shot: {
          kind: "capture",
          piece: ctx.actor.type,
          color: ctx.plan.color,
          from: c.discovery!,
          to: c.at,
          victim: { piece: c.occ.type, color: c.occ.color },
          occupies: true,
          pathRevealFrom: ctx.plan.from,
          pathRevealSteps: c.revealSteps!,
        },
      };
    }
    return { kind: "capture", at: c.at, victim: c.occ };
  };

  const revealTo = (ctx: PlanContext, target: Square) => {
    const query = queryFor(ctx.plan, target, "reveal-to");
    const steps = pathRevealStepsKernel(
      input.placement,
      ctx.plan.from,
      ctx.plan.to,
      ctx.plan.color,
      target,
      input.pathVisionOpts,
      query,
    );
    return { steps, queryOrdinal: query?.ordinal };
  };

  const RULES: readonly PlanRule[] = [
    {
      name: "jumpImmunity",
      match: ({ plan, target }) =>
        target &&
        target.color !== plan.color &&
        target.type === "q" &&
        ignoreAttacksOn.has(plan.to)
          ? { kind: "drop" }
          : null,
    },
    {
      name: "marineFrontStep",
      match: ({ plan, actor }) => {
        if (actor.type !== "p" || plan.to[0] !== plan.from[0]) return null;
        const path = [...rayBetween(plan.from, plan.to), plan.to];
        const blocked = path.findIndex((sq) => start.has(sq));
        if (blocked < 0) return null;
        const stopAt = blocked > 0 ? path[blocked - 1]! : null;
        return stopAt ? { kind: "quiet", to: stopAt } : { kind: "drop" };
      },
    },
    {
      name: "enemyCCSquare",
      match: (ctx) => {
        const { plan, actor, target, leaps } = ctx;
        if (!target || target.color === plan.color || target.type !== "k") {
          return null;
        }
        const blocker = leaps
          ? null
          : firstBlockerOnRay(start, plan.from, plan.to);
        if (!blocker) return { kind: "drop" };
        const victim = start.get(blocker)!;
        if (victim.color === plan.color || victim.type === "k") return { kind: "drop" };
        const startVisible = canSee(plan.color, blocker);
        const revealed = leaps ? null : revealTo(ctx, blocker);
        const reveal = revealed?.steps ?? null;
        if (!startVisible && reveal != null && reveal > 0) {
          const mids = rayBetween(plan.from, plan.to);
          return {
            kind: "approach",
            queryOrdinal: revealed?.queryOrdinal,
            shot: {
              kind: "capture",
              piece: actor.type,
              color: plan.color,
              from: mids[reveal - 1]!,
              to: blocker,
              victim: { piece: victim.type, color: victim.color },
              occupies: true,
              pathRevealFrom: plan.from,
              pathRevealSteps: reveal,
            },
          };
        }
        return {
          kind: "capture",
          at: blocker,
          victim,
          ...(!startVisible ? { fogged: true as const } : {}),
        };
      },
    },
    {
      name: "allyOccupied",
      match: ({ plan, target }) =>
        target && target.color === plan.color ? { kind: "drop" } : null,
    },
    {
      name: "marineDiagonalEmpty",
      match: ({ plan, actor, target, visible0 }) =>
        actor.type === "p" &&
        plan.to[0] !== plan.from[0] &&
        !target &&
        !(visible0 && hostileMineOn(mines, plan.color, plan.to))
          ? { kind: "drop" }
          : null,
    },
    {
      name: "midPathPrecedence",
      match: (ctx) => {
        const { plan, target, leaps } = ctx;
        if (!target || target.color === plan.color || leaps) return null;
        const { contact } = ctx.scan();
        if (!contact) return null;
        if (contact.occ.color === plan.color) return { kind: "quiet" };
        if (contact.occ.type === "k") return null;
        return rayContactOutcome(ctx, contact);
      },
    },
    {
      name: "targetOnDestination",
      match: (ctx) => {
        const { plan, actor, target, visible0, leaps } = ctx;
        if (!target || target.color === plan.color) return null;
        const victim = { piece: target.type, color: target.color };
        const revealed = !visible0 && !leaps ? revealTo(ctx, plan.to) : null;
        const revealSteps = revealed?.steps ?? null;
        const lightsUp = revealSteps != null && revealSteps > 0;
        if (!visible0 && !lightsUp) {
          if (ctx.siegedTank) return { kind: "drop" };
          return { kind: "capture", at: plan.to, victim: target, fogged: true };
        }
        if (lightsUp) {
          const mids = rayBetween(plan.from, plan.to);
          return {
            kind: "approach",
            queryOrdinal: revealed?.queryOrdinal,
            shot: {
              kind: "capture",
              piece: actor.type,
              color: plan.color,
              from: mids[revealSteps! - 1]!,
              to: plan.to,
              victim,
              occupies: true,
              pathRevealFrom: plan.from,
              pathRevealSteps: revealSteps!,
            },
          };
        }
        return { kind: "capture", at: plan.to, victim: target };
      },
    },
    {
      name: "minedEmptyDestination",
      match: (ctx) => {
        const { plan, actor, target, visible0 } = ctx;
        if (target) return null;
        const armed = mineContact({
          mines,
          color: plan.color,
          piece: actor.type,
          squares: [plan.to],
          mode: "attack",
        });
        if (armed.kind !== "cleared") return null;
        // Sieged fire through a blocker intercepts upstream — fall through
        // so slideIntoFog collides instead of quietly swallowing the shot
        // (the mine stays armed: the blast never reaches it).
        if (ctx.siegedTank && !ctx.leaps && firstBlockerOnRay(start, plan.from, plan.to)) {
          return null;
        }
        if (!visible0 && ctx.siegedTank) return { kind: "drop" };
        const reachable =
          ctx.leaps || !firstBlockerOnRay(start, plan.from, plan.to);
        if (visible0 && reachable && attacksOwnDest(actor.type, plan.from, plan.to)) {
          return { kind: "mineClear", at: plan.to, mineColor: armed.mineColor };
        }
        return { kind: "quiet" };
      },
    },
    {
      name: "slideIntoFog",
      match: (ctx) => {
        const { plan, actor, leaps } = ctx;
        if (leaps) return null;
        const { contact } = ctx.scan();
        if (!contact || contact.occ.color === plan.color) return null;
        if (contact.occ.type !== "k") return rayContactOutcome(ctx, contact);
        if (contact.becomesVisible) {
          return {
            kind: "approach",
            queryOrdinal: scanQueries.get(plan),
            shot: {
              kind: "ccShot",
              piece: actor.type,
              color: plan.color,
              from: contact.discovery!,
              to: contact.at,
              target: plan.color === "w" ? "b" : "w",
              livesAfter: 0,
              pathRevealFrom: plan.from,
              pathRevealSteps: contact.revealSteps!,
              stopAt: contact.stopBefore ?? plan.from,
            },
          };
        }
        return contact.stopBefore && contact.stopBefore !== plan.from
          ? { kind: "occupy", to: contact.stopBefore }
          : { kind: "drop" };
      },
    },
    {
      name: "siegedEmptyShelling",
      match: (ctx) => {
        const { plan, target, visible0 } = ctx;
        // Siege-only: regular pieces relocate onto empty squares (quiet).
        if (!ctx.siegedTank || target) return null;
        // Cross geometry only — defense in depth, resolve trusts plans.
        if (plan.from[0] !== plan.to[0] && plan.from[1] !== plan.to[1]) return null;
        // Anything in the way holds fire: visible enemies already collided
        // upstream (slideIntoFog); allies and Command Centers never eat a shell.
        if (ctx.scan().contact) return { kind: "drop" };
        // Fog fizzle preserved — no confirmed target, no explosion.
        if (!visible0) return null;
        return { kind: "shelling", at: plan.to };
      },
    },
    { name: "quietFallthrough", match: () => ({ kind: "quiet" }) },
  ];

  for (const plan of plans) {
    const actor = start.get(plan.from);
    recorder?.bind(seqFor(plan), actor);
    if (!actor || actor.color !== plan.color) continue;

    let scanned: ReturnType<typeof scanFor> | null = null;
    const siegedFrom = !!input.siegedTanks?.includes(plan.from);
    const ctx: PlanContext = {
      plan,
      actor,
      target: start.get(plan.to),
      visible0: canSee(plan.color, plan.to),
      leaps: leapsPiece(actor.type),
      siegedFrom,
      siegedTank: siegedFrom && actor.type === "r",
      scan: () => (scanned ??= scanFor(plan)),
    };

    for (const rule of RULES) {
      const outcome = rule.match(ctx);
      if (!outcome) continue;
      applyOutcome(ctx, outcome);
      break;
    }
  }

  const mid = new Map(start);
  recorder?.frame("C-attack", () => {
    for (const victim of waveVictims.values()) recorder.destroy(victim.piece, victim.seq);
    flushMines();
  });
  for (const sqDead of deadSquares) mid.delete(sqDead);

  const afterAttack = {
    placement: mapToPlacement(mid),
    ccLives: { ...lives },
    mines: [...mines],
  };

  const board = new Map(mid);
  const moves: ResolveMove[] = [];
  const mineTriggers: ResolveAttack[] = [];
  const moversDead = new Set<Square>();
  const pendingPromos: ResolvePromotion[] = [];

  type Landing = {
    plan: ClassicalPlan;
    piece: ScPiece;
    dest: Square;
  };

  const planLanding = (plan: ClassicalPlan, mode: RelocateMode): Landing | null => {
    if (deadSquares.has(plan.from) || moversDead.has(plan.from)) return null;
    const piece = board.get(plan.from);
    if (!piece || piece.color !== plan.color) return null;
    if (
      piece.type === "r" &&
      (input.siegedTanks ?? []).includes(plan.from)
    ) {
      return null;
    }

    let dest = plan.to;

    if (mode === "quiet" && !leapsPiece(piece.type)) {
      const blocker = firstBlockerOnRay(board, plan.from, plan.to);
      if (blocker) {
        const blocking = board.get(blocker)!;
        if (blocking.type === "k") {
          const before = squareBeforeOnRay(plan.from, blocker);
          if (!before || before === plan.from) return null;
          dest = before;
        } else if (blocking.color !== plan.color) {
          dest = blocker;
        } else {
          const before = squareBeforeOnRay(plan.from, blocker);
          if (!before || before === plan.from) return null;
          dest = before;
        }
      }
    }

    const occ = board.get(dest);
    if (occ?.type === "k") {
      if (occ.color === plan.color) {
        const before = squareBeforeOnRay(plan.from, dest);
        if (!before || before === plan.from) return null;
        dest = before;
      } else {
        const before = squareBeforeOnRay(plan.from, dest);
        if (!before || before === plan.from || board.get(before)) return null;
        dest = before;
      }
    }
    return { plan, piece, dest };
  };

  const walkContact = ({ plan, piece, dest }: Landing): MineContact =>
    plan.extraStepTo
      ? { kind: "inert" }
      : mineContact({
          mines,
          color: plan.color,
          piece: piece.type,
          squares: [
            ...(plan.extraStepFrom ? [plan.extraStepFrom] : []),
            ...pathContactSquares(plan.from, dest, piece.type),
            dest,
          ],
          mode: "walk",
        });

  const land = (landing: Landing) => {
    const { plan, piece, dest } = landing;
    const occ = board.get(dest);
    if (occ && occ.color !== plan.color && occ.type !== "k") {
      if (destinationsWritten.has(dest)) {
        recorder?.frame("C-move", () => {
          recorder.destroy(occ, seqFor(plan));
          recorder.destroy(piece, seqFor(plan));
        });
        moveCollisions.push({
          kind: "capture",
          piece: piece.type,
          color: plan.color,
          from: plan.from,
          to: dest,
          victim: { piece: occ.type, color: occ.color },
          occupies: false,
          collision: true,
          moveCollision: true,
        });
        moveCollisions.push({
          kind: "capture",
          piece: occ.type,
          color: occ.color,
          from: dest,
          to: dest,
          victim: { piece: piece.type, color: plan.color },
          occupies: false,
          collision: true,
          moveCollision: true,
        });
        board.delete(dest);
        board.delete(plan.from);
        destinationsWritten.delete(dest);
        moves.push({
          piece: piece.type,
          color: plan.color,
          from: plan.from,
          to: dest,
        });
        return;
      }
      board.delete(dest);
      const collisionMine = clearOnCapture(dest, plan.color, piece.type, seqFor(plan));
      moveCollisions.push({
        kind: "capture",
        piece: piece.type,
        color: plan.color,
        from: plan.from,
        to: dest,
        victim: { piece: occ.type, color: occ.color },
        occupies: true,
        collision: true,
        moveCollision: true,
        ...(collisionMine ? { mineColor: collisionMine } : {}),
      });
    }

    const trip = walkContact(landing);

    recorder?.frame("C-move", () => {
      if (occ && occ.color !== plan.color && occ.type !== "k") recorder.destroy(occ, seqFor(plan));
      flushMines();
      recorder.move(piece, plan.from, dest, seqFor(plan));
    });

    board.delete(plan.from);
    board.set(dest, piece);
    destinationsWritten.add(dest);
    moves.push({
      piece: piece.type,
      color: plan.color,
      from: plan.from,
      to: dest,
    });

    const promoRank = plan.color === "w" ? 8 : 1;
    if (
      piece.type === "p" &&
      plan.promotion &&
      Number(dest[1]) === promoRank
    ) {
      pendingPromos.push({
        color: plan.color,
        from: plan.from,
        at: dest,
        unit: plan.promotion,
      });
    }

    if (trip.kind === "detonated") {
      recorder?.frame("C-move", () => {
        recorder.destroy(piece, seqFor(plan));
        recorder.mineContact(trip, seqFor(plan), mines);
      });
      mineTriggers.push({
        kind: "mineBlast",
        piece: piece.type,
        color: plan.color,
        from: plan.from,
        to: trip.at,
        mineColor: trip.mineColor,
        victim: { piece: piece.type, color: plan.color },
        ...(trip.chaseFrom ? { chaseFrom: trip.chaseFrom } : {}),
      });
      mines = withoutMine(mines, trip);
      board.delete(dest);
      moversDead.add(dest);
    }
  };

  const relocate = (plan: ClassicalPlan, mode: RelocateMode) => {
    const landing = planLanding(plan, mode);
    if (landing) land(landing);
  };

  const scheduleOf = (l: Landing) =>
    timedMover(l.plan.from, l.dest, l.piece.type, {
      diesOnLanding: walkContact(l).kind === "detonated",
    });

  const stopShortOf = (l: Landing, at: Square): Landing | null => {
    if (leapsPiece(l.piece.type)) return null;
    const before = squareBeforeOnRay(l.plan.from, at);
    return before ? { ...l, dest: before } : null;
  };

  const collide = (a: Landing, b: Landing, contact: MoverContact) => {
    const [rammer, held] = contact.first === "a" ? [b, a] : [a, b];
    const at = contact.at;
    recorder?.frame("C-move", () => {
      recorder.destroy(a.piece, seqFor(b.plan));
      recorder.destroy(b.piece, seqFor(a.plan));
    });
    moveCollisions.push(
      {
        kind: "capture",
        piece: rammer.piece.type,
        color: rammer.plan.color,
        from: rammer.plan.from,
        to: at,
        victim: { piece: held.piece.type, color: held.plan.color },
        occupies: false,
        collision: true,
        moveCollision: true,
      },
      {
        kind: "capture",
        piece: held.piece.type,
        color: held.plan.color,
        from: contact.first === "both" ? held.plan.from : at,
        to: at,
        victim: { piece: rammer.piece.type, color: rammer.plan.color },
        occupies: false,
        collision: true,
        moveCollision: true,
      },
    );
    for (const l of [a, b]) {
      board.delete(l.plan.from);
      moves.push({ piece: l.piece.type, color: l.plan.color, from: l.plan.from, to: at });
    }
  };

  const ccTakes = (cc: Landing, other: Landing, at: Square) => {
    const mineColor = clearOnCapture(at, cc.plan.color, cc.piece.type, seqFor(cc.plan));
    recorder?.frame("C-move", () => {
      recorder.destroy(other.piece, seqFor(cc.plan));
      flushMines();
    });
    moveCollisions.push({
      kind: "capture",
      piece: cc.piece.type,
      color: cc.plan.color,
      from: cc.plan.from,
      to: at,
      victim: { piece: other.piece.type, color: other.plan.color },
      occupies: true,
      collision: true,
      moveCollision: true,
      ...(mineColor ? { mineColor } : {}),
    });
    board.delete(other.plan.from);
    moves.push({
      piece: other.piece.type,
      color: other.plan.color,
      from: other.plan.from,
      to: at,
    });
    land(cc);
  };

  const moveWave = (wave: readonly (readonly [ClassicalPlan, RelocateMode])[]) => {
    const landings = wave
      .map(([plan, mode]) => planLanding(plan, mode))
      .filter((l): l is Landing => l != null);
    const [a, b] = landings;
    const contact =
      a && b && landings.length === 2 && a.plan.color !== b.plan.color
        ? moverContact(scheduleOf(a), scheduleOf(b))
        : null;
    if (!a || !b || !contact) {
      for (const l of landings) land(l);
      return;
    }
    const aCC = a.piece.type === "k";
    const bCC = b.piece.type === "k";
    if (aCC && bCC) return;
    if (!aCC && !bCC) {
      collide(a, b, contact);
      return;
    }
    const [cc, other, ccFirst] = aCC
      ? [a, b, contact.first === "a"]
      : [b, a, contact.first === "b"];
    if (!ccFirst) {
      ccTakes(cc, other, contact.at);
      return;
    }
    land(cc);
    const short = stopShortOf(other, contact.at);
    if (short && short.dest !== short.plan.from) land(short);
  };

  moveWave([
    ...occupy.map((plan) => [plan, "occupy"] as const),
    ...quiets.map((plan) => [plan, "quiet"] as const),
  ]);

  const pathRevealAttacks: ResolveAttack[] = [];
  const pathRevealMineTriggers: ResolveAttack[] = [];
  const firedFrom = new Set<Square>();
  let phase3: PathRevealSnap & { ccLives: Record<StarChessColor, number> } = {
    placement: mapToPlacement(board),
    mines: [...mines],
    ccLives: { ...lives },
  };
  /**
   * Phase-3 approach contact. Returns the colour of a mine the shot **cleared**,
   * for the caller to stamp on its attack; a mine the approach walked into is
   * pushed as a trigger here instead and takes the mover with it.
   */
  const applyApproachMine = (a: ResolveApproach): StarChessColor | undefined => {
    const trip = approachMineContact(a, phase3.mines);
    if (trip.kind === "inert") return undefined;
    const seq = recorder ? recorder.queries[approachQueries.get(a)!]!.sourceActionSeq : null;
    recorder?.frame("C-path-reveal", () => {
      if (trip.kind === "detonated") {
        const liveBoard = placementToMap(phase3.placement);
        recorder.board(liveBoard);
        const victim = liveBoard.get(trip.at);
        if (victim) recorder.destroy(victim, seq);
      }
      recorder.mineContact(trip, seq, phase3.mines);
    });
    if (trip.kind === "cleared") {
      // Fired upon, so the mover lands alive and only the mine is spent.
      phase3 = { ...phase3, mines: withoutMine(phase3.mines, trip) };
      return trip.mineColor;
    }
    const board = placementToMap(phase3.placement);
    board.delete(trip.at);
    phase3 = {
      placement: mapToPlacement(board),
      mines: withoutMine(phase3.mines, trip),
      ccLives: { ...phase3.ccLives },
    };
    pathRevealMineTriggers.push({
      kind: "mineBlast",
      piece: a.piece,
      color: a.color,
      from: a.pathRevealFrom!,
      to: trip.at,
      mineColor: trip.mineColor,
      victim: { piece: a.piece, color: a.color },
      ...(trip.chaseFrom ? { chaseFrom: trip.chaseFrom } : {}),
    });
    return undefined;
  };
  for (const a of pathRevealPending) {
    if (a.kind !== "capture" && a.kind !== "ccShot") continue;
    if (!a.pathRevealFrom) continue;
    if ((input.siegedTanks ?? []).includes(a.pathRevealFrom)) continue;
    if (destinationsWritten.has(a.pathRevealFrom)) continue;
    if (a.kind === "capture") {
      const applied = applyPathRevealAttackKernel(phase3, a, recorder, approachQueries.get(a));
      if (!applied.fired) continue;
      firedFrom.add(a.pathRevealFrom!);
      phase3 = {
        placement: applied.placement,
        mines: [...applied.mines],
        ccLives: { ...phase3.ccLives },
      };
      const approachMine = applyApproachMine(a);
      pathRevealAttacks.push(approachMine ? { ...a, mineColor: approachMine } : a);
      continue;
    }
    const applied = applyPathRevealCCShotKernel(phase3, a, recorder, approachQueries.get(a));
    if (!applied.fired) continue;
    phase3 = {
      placement: applied.placement,
      mines: [...applied.mines],
      ccLives: { ...applied.ccLives },
    };
    lives.w = applied.ccLives.w;
    lives.b = applied.ccLives.b;
    const fired = { ...a, livesAfter: applied.ccLives[a.target] };
    if (recorder) approachQueries.set(fired, approachQueries.get(a)!);
    applyApproachMine(fired);
    pathRevealAttacks.push(fired);
  }

  mines = [...phase3.mines];
  const orderedDelayed = [...delayed];
  if (
    orderedDelayed.length === 2 &&
    orderedDelayed[0]!.to === orderedDelayed[1]!.from &&
    orderedDelayed[1]!.to !== orderedDelayed[0]!.from
  ) {
    orderedDelayed.reverse();
  }
  for (const plan of orderedDelayed) {
    if (firedFrom.has(plan.from)) continue;
    const pmap = placementToMap(phase3.placement);
    if (!isActorAnchored(board, pmap, plan)) continue;
    if (isApproachOwnedDestination(board, pmap, plan)) continue;
    clearDepartedGhost(board, pmap, plan);
    const livePiece = board.get(plan.from)!;
    const cross = orderedDelayed.find(
      (p) =>
        p !== plan &&
        p.from === plan.to &&
        !firedFrom.has(p.from) &&
        p.to === plan.from,
    );
    if (cross) {
      const actorA = livePiece;
      const actorB = board.get(cross.from);
      if (!actorB || actorB.color !== cross.color) continue;
      recorder?.frame("C-move", () => {
        recorder.move(actorA, plan.from, cross.from, seqFor(plan));
        recorder.move(actorB, cross.from, plan.from, seqFor(cross));
      });
      board.delete(plan.from);
      board.delete(cross.from);
      board.set(cross.from, actorA);
      board.set(plan.from, actorB);
      moves.push(
        { piece: actorA.type, color: plan.color, from: plan.from, to: cross.from },
        { piece: actorB.type, color: cross.color, from: cross.from, to: plan.from },
      );
      pmap.delete(plan.from);
      pmap.delete(cross.from);
      pmap.set(cross.from, actorA);
      pmap.set(plan.from, actorB);
      for (const [from, to, actor, color] of [
        [plan.from, cross.from, actorA, plan.color],
        [cross.from, plan.from, actorB, cross.color],
      ] as const) {
        const trip = mineContact({
          mines,
          color,
          piece: actor.type,
          squares: [to],
          mode: "walk",
        });
        if (trip.kind !== "detonated") continue;
        recorder?.frame("C-move", () => {
          recorder.destroy(actor, seqFor(color === plan.color ? plan : cross));
          recorder.mineContact(trip, seqFor(color === plan.color ? plan : cross), mines);
        });
        board.delete(to);
        pmap.delete(to);
        mines = withoutMine(mines, trip);
        mineTriggers.push({
          kind: "mineBlast",
          piece: actor.type,
          color,
          from,
          to: trip.at,
          mineColor: trip.mineColor,
          victim: { piece: actor.type, color },
          ...(trip.chaseFrom ? { chaseFrom: trip.chaseFrom } : {}),
        });
      }
      phase3 = {
        ...phase3,
        placement: mapToPlacement(pmap),
        mines: [...mines],
      };
      firedFrom.add(plan.from);
      firedFrom.add(cross.from);
      continue;
    }
    const movesBefore = moves.length;
    const trigBefore = mineTriggers.length;
    const collBefore = moveCollisions.length;
    relocate(plan, "occupy");
    if (moves.length === movesBefore) continue;
    const mv = moves[moves.length - 1]!;
    if (mineTriggers.length > trigBefore) {
      const trip = mineTriggers[mineTriggers.length - 1]!;
      const tripAt =
        trip.kind === "mineBlast" ? (trip.chaseFrom ?? trip.to) : trip.to;
      pmap.delete(plan.from);
      pmap.delete(mv.to);
      phase3 = {
        ...phase3,
        placement: mapToPlacement(pmap),
        mines: phase3.mines.filter((m) => m.at !== tripAt),
      };
      continue;
    }
    if (moveCollisions.length > collBefore) {
      const hit = moveCollisions[moveCollisions.length - 1]!;
      pmap.delete(plan.from);
      pmap.delete(hit.to);
      if (hit.kind === "capture" && hit.occupies) {
        pmap.set(hit.to, { type: hit.piece, color: hit.color });
      }
      phase3 = {
        ...phase3,
        placement: mapToPlacement(pmap),
        mines:
          "mineColor" in hit && hit.mineColor
            ? phase3.mines.filter((m) => m.at !== hit.to)
            : phase3.mines,
      };
      continue;
    }
    pmap.delete(plan.from);
    pmap.set(mv.to, { type: mv.piece, color: mv.color });
    phase3 = { ...phase3, placement: mapToPlacement(pmap) };
  }

  const afterMove = {
    placement: mapToPlacement(board),
    ccLives: { ...lives },
    mines: [...mines],
  };

  const promoBoard = placementToMap(phase3.placement);
  recorder?.board(promoBoard);
  const promotions: ResolvePromotion[] = [];
  for (const promo of pendingPromos) {
    if (moversDead.has(promo.at)) continue;
    const landed = promoBoard.get(promo.at);
    if (!landed || landed.type !== "p" || landed.color !== promo.color) continue;
    recorder?.frame("C-promotion", () => recorder.transform(landed, promo.unit, sources[promo.color]));
    promoBoard.set(promo.at, { type: promo.unit, color: promo.color });
    promotions.push(promo);
  }

  return {
    attacks,
    afterAttack,
    moves,
    mineTriggers,
    pathRevealMineTriggers,
    moveCollisions,
    pathRevealAttacks,
    promotions,
    afterMove,
    afterAll: {
      placement: mapToPlacement(promoBoard),
      ccLives: { ...lives },
      mines: [...phase3.mines],
    },
    pendingCCShotsArmed,
  };
};
