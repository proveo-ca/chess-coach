// SPEC: _spec/packages/starchess-core/resolve.puml, _spec/packages/starchess-core/overview.puml, _spec/packages/starchess-core/resolve-turn-activity.puml, _spec/packages/starchess-core/mine-contact.puml, _spec/apps/starchess/core/turn/resolve-pipeline.puml, _spec/packages/starchess-core/gas-phase-vacancy.puml
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
  RookMode,
  ScMine,
  ScPendingKingShot,
  SpawnPiece,
} from "../model/types";
import { scanRay, type RayContact } from "../board/ray-scan";
import { pathRevealSteps } from "../board/vision";

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
      kind: "kingShot";
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
  kingLives: Record<StarChessColor, number>;
  white: ClassicalPlan | null;
  black: ClassicalPlan | null;
  ignoreAttacksOn?: readonly Square[];
  mines?: readonly ScMine[];
  isTargetVisible?: (color: StarChessColor, square: Square) => boolean;
  pathVisionOpts?: {
    rookModeFor?: (square: Square) => RookMode;
    mines?: readonly ScMine[];
  };
  siegedRooks?: readonly Square[];
};

export type ResolveTurnResult = {
  attacks: ResolveAttack[];
  afterAttack: {
    placement: string;
    kingLives: Record<StarChessColor, number>;
    mines: ScMine[];
  };
  moves: ResolveMove[];
  afterMove: {
    placement: string;
    kingLives: Record<StarChessColor, number>;
    mines: ScMine[];
  };
  pathRevealAttacks: ResolveAttack[];
  afterAll: {
    placement: string;
    kingLives: Record<StarChessColor, number>;
    mines: ScMine[];
  };
  mineTriggers: ResolveAttack[];
  pathRevealMineTriggers: ResolveAttack[];
  moveCollisions: ResolveAttack[];
  promotions: ResolvePromotion[];
  pendingKingShotsArmed: ScPendingKingShot[];
};

const clampLives = (n: number) => Math.max(0, Math.min(3, Math.floor(n)));

export type PathRevealSnap = {
  placement: string;
  mines: readonly ScMine[];
  kingLives?: Record<StarChessColor, number>;
};

export type PathRevealApply = PathRevealSnap & { fired: boolean };

export const applyPathRevealAttack = (
  snap: PathRevealSnap,
  a: ResolveAttack,
): PathRevealApply => {
  if (a.kind !== "capture" || !a.pathRevealFrom) return { ...snap, fired: false };
  const map = placementToMap(snap.placement);
  const actor = map.get(a.pathRevealFrom);
  if (!actor || actor.color !== a.color || actor.type !== a.piece) {
    return { ...snap, fired: false };
  }
  const occ = map.get(a.to);
  if (!occ || occ.color !== a.victim.color || occ.type !== a.victim.piece) {
    return { ...snap, fired: false };
  }
  map.delete(a.pathRevealFrom);
  map.delete(a.to);
  map.set(a.to, actor);
  return {
    placement: mapToPlacement(map),
    mines: [...snap.mines],
    kingLives: snap.kingLives ? { ...snap.kingLives } : undefined,
    fired: true,
  };
};

export const applyPathRevealKingShot = (
  snap: PathRevealSnap & { kingLives: Record<StarChessColor, number> },
  a: Extract<ResolveAttack, { kind: "kingShot" }>,
): PathRevealApply & { kingLives: Record<StarChessColor, number> } => {
  if (!a.pathRevealFrom || a.stopAt == null) {
    return { ...snap, kingLives: { ...snap.kingLives }, fired: false };
  }
  const map = placementToMap(snap.placement);
  const actor = map.get(a.pathRevealFrom);
  if (!actor || actor.color !== a.color || actor.type !== a.piece) {
    return { ...snap, kingLives: { ...snap.kingLives }, fired: false };
  }
  const king = map.get(a.to);
  if (!king || king.type !== "k" || king.color === a.color) {
    return { ...snap, kingLives: { ...snap.kingLives }, fired: false };
  }
  if (a.stopAt !== a.pathRevealFrom) {
    if (map.has(a.stopAt)) {
      return { ...snap, kingLives: { ...snap.kingLives }, fired: false };
    }
    map.delete(a.pathRevealFrom);
    map.set(a.stopAt, actor);
  }
  const kingLives = {
    w: clampLives(snap.kingLives.w),
    b: clampLives(snap.kingLives.b),
  };
  kingLives[a.target] = clampLives(kingLives[a.target] - 1);
  return {
    placement: mapToPlacement(map),
    mines: [...snap.mines],
    kingLives,
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
  const landing = a.kind === "kingShot" ? (a.stopAt ?? origin) : a.to;
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
    // stopped the ray. A `kingShot` stops *short* and shoots from range, so the
    // tile it settles on was never fired upon and stays part of the walk.
    mode: a.kind === "capture" ? "walkThenAttack" : "walk",
  });

const squareBeforeOnRay = (from: Square, blocker: Square): Square | null => {
  const mids = rayBetween(from, blocker);
  if (mids.length) return mids[mids.length - 1]!;
  return null;
};

export const applyPendingKingShots = (input: {
  placement: string;
  kingLives: Record<StarChessColor, number>;
  pending: readonly ScPendingKingShot[];
  mines?: readonly ScMine[];
}): {
  placement: string;
  kingLives: Record<StarChessColor, number>;
  mines: ScMine[];
  attacks: ResolveAttack[];
} => {
  const map = placementToMap(input.placement);
  const lives = {
    w: clampLives(input.kingLives.w),
    b: clampLives(input.kingLives.b),
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
      map.delete(blocker);
      const mineColor = clearOnCapture(blocker, shot.color, actor.type);
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
    attacks.push({
      kind: "kingShot",
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
    kingLives: lives,
    mines,
    attacks,
  };
};

export const resolveTurn = (input: ResolveTurnInput): ResolveTurnResult => {
  const start = placementToMap(input.placement);
  const lives = {
    w: clampLives(input.kingLives.w),
    b: clampLives(input.kingLives.b),
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
  const pendingKingShotsArmed: ScPendingKingShot[] = [];
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
  ): StarChessColor | undefined => {
    const hit = mineContact({ mines, color, piece, squares: [at], mode: "attack" });
    mines = withoutMine(mines, hit);
    return hit.kind === "cleared" ? hit.mineColor : undefined;
  };

  const scanFor = (plan: ClassicalPlan) =>
    scanRay({
      board: start,
      placement: input.placement,
      from: plan.from,
      intentTo: plan.to,
      color: plan.color,
      canSee,
      visionOpts: input.pathVisionOpts,
    });

  type PlanContext = {
    plan: ClassicalPlan;
    actor: ScPiece;
    target: ScPiece | undefined;
    visible0: boolean;
    leaps: boolean;
    siegedFrom: boolean;
    siegedRook: boolean;
    scan: () => ReturnType<typeof scanFor>;
  };

  type PlanOutcome =
    | { kind: "drop" }
    | { kind: "quiet"; to?: Square }
    | { kind: "occupy"; to: Square }
    | { kind: "capture"; at: Square; victim: ScPiece; fogged?: boolean }
    | { kind: "mineClear"; at: Square; mineColor: StarChessColor }
    | { kind: "shelling"; at: Square }
    | { kind: "approach"; shot: ResolveAttack };

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
        const mineColor = clearOnCapture(out.at, plan.color, actor.type);
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
        mines = mines.filter((m) => m.at !== out.at);
        if (!ctx.siegedRook) occupy.push(plan);
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
        pathRevealPending.push(out.shot);
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

  const revealTo = (ctx: PlanContext, target: Square): number | null =>
    pathRevealSteps(
      input.placement,
      ctx.plan.from,
      ctx.plan.to,
      ctx.plan.color,
      target,
      input.pathVisionOpts,
    );

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
      name: "enemyKingSquare",
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
        const startVisible = canSee(plan.color, blocker);
        const reveal = leaps ? null : revealTo(ctx, blocker);
        if (startVisible || reveal == null || reveal <= 0) return { kind: "drop" };
        const mids = rayBetween(plan.from, plan.to);
        return {
          kind: "approach",
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
        const revealSteps = !visible0 && !leaps ? revealTo(ctx, plan.to) : null;
        const lightsUp = revealSteps != null && revealSteps > 0;
        if (!visible0 && !lightsUp) {
          if (ctx.siegedRook) return { kind: "drop" };
          return { kind: "capture", at: plan.to, victim: target, fogged: true };
        }
        if (lightsUp) {
          const mids = rayBetween(plan.from, plan.to);
          return {
            kind: "approach",
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
        if (ctx.siegedRook && !ctx.leaps && firstBlockerOnRay(start, plan.from, plan.to)) {
          return null;
        }
        if (!visible0 && ctx.siegedRook) return { kind: "drop" };
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
            shot: {
              kind: "kingShot",
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
        if (!ctx.siegedRook || target) return null;
        // Cross geometry only — defense in depth, resolve trusts plans.
        if (plan.from[0] !== plan.to[0] && plan.from[1] !== plan.to[1]) return null;
        // Anything in the way holds fire: visible enemies already collided
        // upstream (slideIntoFog); allies and kings never eat a shell.
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
    if (!actor || actor.color !== plan.color) continue;

    let scanned: ReturnType<typeof scanFor> | null = null;
    const siegedFrom = !!input.siegedRooks?.includes(plan.from);
    const ctx: PlanContext = {
      plan,
      actor,
      target: start.get(plan.to),
      visible0: canSee(plan.color, plan.to),
      leaps: leapsPiece(actor.type),
      siegedFrom,
      siegedRook: siegedFrom && actor.type === "r",
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
  for (const sqDead of deadSquares) mid.delete(sqDead);

  const afterAttack = {
    placement: mapToPlacement(mid),
    kingLives: { ...lives },
    mines: [...mines],
  };

  const board = new Map(mid);
  const moves: ResolveMove[] = [];
  const mineTriggers: ResolveAttack[] = [];
  const moversDead = new Set<Square>();
  const pendingPromos: ResolvePromotion[] = [];

  const relocate = (plan: ClassicalPlan, fromOccupyList: boolean) => {
    if (deadSquares.has(plan.from) || moversDead.has(plan.from)) return;
    const piece = board.get(plan.from);
    if (!piece || piece.color !== plan.color) return;
    if (
      piece.type === "r" &&
      (input.siegedRooks ?? []).includes(plan.from)
    ) {
      return;
    }

    let dest = plan.to;

    if (!fromOccupyList && !leapsPiece(piece.type)) {
      const blocker = firstBlockerOnRay(board, plan.from, plan.to);
      if (blocker) {
        const blocking = board.get(blocker)!;
        if (blocking.type === "k") {
          const before = squareBeforeOnRay(plan.from, blocker);
          if (!before || before === plan.from) return;
          dest = before;
        } else if (blocking.color !== plan.color) {
          dest = blocker;
        } else {
          const before = squareBeforeOnRay(plan.from, blocker);
          if (!before || before === plan.from) return;
          dest = before;
        }
      }
    }

    const occ = board.get(dest);
    if (occ?.type === "k") {
      if (occ.color === plan.color) {
        const before = squareBeforeOnRay(plan.from, dest);
        if (!before || before === plan.from) return;
        dest = before;
      } else {
        const before = squareBeforeOnRay(plan.from, dest);
        if (!before || before === plan.from || board.get(before)) return;
        dest = before;
      }
    } else if (occ && occ.color !== plan.color) {
      if (destinationsWritten.has(dest)) {
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
      const collisionMine = clearOnCapture(dest, plan.color, piece.type);
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

    // One walk per marine. A queued Extra Step means `dest` is not the landing
    // tile, so the arrival check in phase 4 owns this contact list; a spent one
    // means the marine is standing on a tile it only reached this turn, so that
    // tile is still live. Either way the mine waits for the real destination.
    const trip: MineContact = plan.extraStepTo
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

  for (const plan of occupy) relocate(plan, true);
  for (const plan of quiets) relocate(plan, false);

  const afterMove = {
    placement: mapToPlacement(board),
    kingLives: { ...lives },
    mines: [...mines],
  };

  const pathRevealAttacks: ResolveAttack[] = [];
  const pathRevealMineTriggers: ResolveAttack[] = [];
  let phase3: PathRevealSnap & { kingLives: Record<StarChessColor, number> } = {
    placement: afterMove.placement,
    mines: [...mines],
    kingLives: { ...lives },
  };
  /**
   * Phase-3 approach contact. Returns the colour of a mine the shot **cleared**,
   * for the caller to stamp on its attack; a mine the approach walked into is
   * pushed as a trigger here instead and takes the mover with it.
   */
  const applyApproachMine = (a: ResolveApproach): StarChessColor | undefined => {
    const trip = approachMineContact(a, phase3.mines);
    if (trip.kind === "inert") return undefined;
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
      kingLives: { ...phase3.kingLives },
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
    if (a.kind !== "capture" && a.kind !== "kingShot") continue;
    if (!a.pathRevealFrom) continue;
    if ((input.siegedRooks ?? []).includes(a.pathRevealFrom)) continue;
    if (destinationsWritten.has(a.pathRevealFrom)) continue;
    if (a.kind === "capture") {
      const applied = applyPathRevealAttack(phase3, a);
      if (!applied.fired) continue;
      phase3 = {
        placement: applied.placement,
        mines: [...applied.mines],
        kingLives: { ...phase3.kingLives },
      };
      const approachMine = applyApproachMine(a);
      pathRevealAttacks.push(approachMine ? { ...a, mineColor: approachMine } : a);
      continue;
    }
    const applied = applyPathRevealKingShot(phase3, a);
    if (!applied.fired) continue;
    phase3 = {
      placement: applied.placement,
      mines: [...applied.mines],
      kingLives: { ...applied.kingLives },
    };
    lives.w = applied.kingLives.w;
    lives.b = applied.kingLives.b;
    const fired = { ...a, livesAfter: applied.kingLives[a.target] };
    applyApproachMine(fired);
    pathRevealAttacks.push(fired);
  }

  const promoBoard = placementToMap(phase3.placement);
  const promotions: ResolvePromotion[] = [];
  for (const promo of pendingPromos) {
    if (moversDead.has(promo.at)) continue;
    const landed = promoBoard.get(promo.at);
    if (!landed || landed.type !== "p" || landed.color !== promo.color) continue;
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
      kingLives: { ...lives },
      mines: [...phase3.mines],
    },
    pendingKingShotsArmed,
  };
};
