/**
 * StarChess classical resolve — attack then move (simultaneous dual plans).
 * Fog: visible targets attack; fogged occupancy → move collision capture/occupy.
 * // SPEC: _spec/apps/ui/starchess/scfen.md
 */

import type { Square } from "chess.js";

import {
  mapToPlacement,
  placementToMap,
  type ScPiece,
} from "~/starchess/board";
import { firstBlockerOnRay, mineAt, pathContactSquares, rayBetween } from "~/starchess/mines";
import type { StarChessColor } from "~/starchess/types";
import type { ClassicalPlan, RookMode, ScMine, ScPendingKingShot } from "~/types/starchess";
import { pathRevealSteps } from "~/starchess/vision";

export type { ClassicalPlan };

export type ResolveAttack =
  | {
      kind: "capture";
      piece: ScPiece["type"];
      color: StarChessColor;
      from: Square;
      to: Square;
      victim: { piece: ScPiece["type"]; color: StarChessColor };
      dies?: boolean;
      occupies?: boolean;
      /** King-shot command retargeted onto a ray blocker. */
      collision?: boolean;
      /** Move-phase fog / path collision (no attack cue). */
      moveCollision?: boolean;
      /**
       * Original `from` when the shot originates on a path-discovery square
       * (combat plays approach `pathRevealFrom` → `from`, then this attack).
       */
      pathRevealFrom?: Square;
      /** Intermediates walked before `to` became visible (SCFEN §4.1). */
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
      /** Fogged king — HP chip without attack cue. */
      moveCollision?: boolean;
    }
  | {
      kind: "mineBlast";
      piece: ScPiece["type"];
      color: StarChessColor;
      from: Square;
      to: Square;
      /** Mine owner. */
      mineColor: StarChessColor;
      /** Unit removed with the mine (ally friendly-fire or chase victim). */
      victim?: { piece: ScPiece["type"]; color: StarChessColor };
      /**
       * Hostile path crossed the mine tile — mine chased to classical `to`
       * and detonated there (not mid-path).
       */
      chaseFrom?: Square;
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
  /**
   * Attack visibility (lit ∪ revealed). Default: all squares visible
   * (tests / callers without fog). Production `endScTurn` passes post-B vision.
   */
  isTargetVisible?: (color: StarChessColor, square: Square) => boolean;
  /** Progressive path vision (SCFEN §4.1) — rook mode + mines for mid-walk checks. */
  pathVisionOpts?: {
    rookModeFor?: (square: Square) => RookMode;
    mines?: readonly ScMine[];
  };
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
  /** Mine + unit explosions during the move phase. */
  mineTriggers: ResolveAttack[];
  /** Fog / path move collisions: capture/occupy (or fogged kingShot). */
  moveCollisions: ResolveAttack[];
  /**
   * King-aimed `C=` this turn — armed for next-turn HP / collision (no lives
   * change this resolve).
   */
  pendingKingShotsArmed: ScPendingKingShot[];
};

const clampLives = (n: number) => Math.max(0, Math.min(3, Math.floor(n)));

const plansOf = (input: ResolveTurnInput): ClassicalPlan[] => {
  const out: ClassicalPlan[] = [];
  if (input.white) out.push({ ...input.white, color: "w" });
  if (input.black) out.push({ ...input.black, color: "b" });
  return out;
};

const leapsPiece = (t: ScPiece["type"]) => t === "n" || t === "k" || t === "p";

/** Square immediately before `blocker` on the ray from `from` (or null). */
const squareBeforeOnRay = (from: Square, blocker: Square): Square | null => {
  const mids = rayBetween(from, blocker);
  if (mids.length) return mids[mids.length - 1]!;
  return null;
};

/**
 * Apply pending king-checks after `B` (deploy-to-block window).
 * Sliding ray with a blocker → collision (no HP). Clear ray / knight → HP −1.
 * Fizzles if attacker gone or enemy king no longer on `to`.
 */
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
  const removeMineAt = (at: Square) => {
    mines = mines.filter((m) => m.at !== at);
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
      attacks.push({
        kind: "capture",
        piece: actor.type,
        color: shot.color,
        from: shot.from,
        to: blocker,
        victim: { piece: victim.type, color: victim.color },
        occupies: false,
        collision: true,
      });
      map.delete(blocker);
      if (mineAt(mines, blocker) && mineAt(mines, blocker)!.color !== shot.color) {
        removeMineAt(blocker);
      }
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
  const removeMineAt = (at: Square) => {
    mines = mines.filter((m) => m.at !== at);
  };

  for (const plan of plans) {
    const actor = start.get(plan.from);
    if (!actor || actor.color !== plan.color) continue;

    const target = start.get(plan.to);
    if (
      target &&
      target.color !== plan.color &&
      target.type === "q" &&
      ignoreAttacksOn.has(plan.to)
    ) {
      continue;
    }

    const visible0 = canSee(plan.color, plan.to);

    // Planned king-shot: arm pending for next-turn HP / collision (after B).
    // Same-turn fog discovery of a non-king blocker that lights mid-walk still
    // occupies (Bxg7-style) — that is not a deferred king check.
    // Knights never collide; sliding blockers are resolved when pending applies.
    if (target && target.color !== plan.color && target.type === "k") {
      const leaps = leapsPiece(actor.type);
      const blocker = leaps ? null : firstBlockerOnRay(start, plan.from, plan.to);
      if (blocker) {
        const victim = start.get(blocker)!;
        const startVisible = canSee(plan.color, blocker);
        const reveal = leaps
          ? null
          : pathRevealSteps(
              input.placement,
              plan.from,
              plan.to,
              plan.color,
              blocker,
              input.pathVisionOpts,
            );
        const becomesVisible = reveal != null && reveal > 0;

        // Hidden blocker that lights mid-walk → Bxg7-style occupy (not deferred check).
        if (becomesVisible && !startVisible) {
          const mids = rayBetween(plan.from, plan.to);
          const discovery = mids[reveal! - 1]!;
          attacks.push({
            kind: "capture",
            piece: actor.type,
            color: plan.color,
            from: discovery,
            to: blocker,
            victim: { piece: victim.type, color: victim.color },
            occupies: true,
            pathRevealFrom: plan.from,
            pathRevealSteps: reveal!,
          });
          deadSquares.add(blocker);
          if (mineAt(mines, blocker) && mineAt(mines, blocker)!.color !== plan.color) {
            removeMineAt(blocker);
          }
          occupy.push({ color: plan.color, from: discovery, to: blocker });
          continue;
        }
      }

      pendingKingShotsArmed.push({
        color: plan.color,
        piece: actor.type,
        from: plan.from,
        to: plan.to,
      });
      continue;
    }

    // Attack ally standing on a mine → explode ally + mine (rule 6), then occupy.
    if (target && target.color === plan.color) {
      const m = mineAt(mines, plan.to);
      if (m) {
        attacks.push({
          kind: "mineBlast",
          piece: actor.type,
          color: plan.color,
          from: plan.from,
          to: plan.to,
          mineColor: m.color,
          victim: { piece: target.type, color: target.color },
        });
        deadSquares.add(plan.to);
        removeMineAt(plan.to);
        occupy.push(plan);
      }
      continue;
    }

    if (target && target.color !== plan.color) {
      let visible = visible0;
      let revealSteps: number | null = null;
      // SCFEN §4.1: fog lifts along the path — discover then attack from that square.
      if (!visible && !leapsPiece(actor.type)) {
        revealSteps = pathRevealSteps(
          input.placement,
          plan.from,
          plan.to,
          plan.color,
          plan.to,
          input.pathVisionOpts,
        );
        if (revealSteps != null && revealSteps > 0) visible = true;
      }
      if (!visible) {
        // Still fogged at contact: clear + occupy, skip attack cue.
        attacks.push({
          kind: "capture",
          piece: actor.type,
          color: plan.color,
          from: plan.from,
          to: plan.to,
          victim: { piece: target.type, color: target.color },
          occupies: true,
          collision: true,
          moveCollision: true,
        });
        deadSquares.add(plan.to);
        if (mineAt(mines, plan.to) && mineAt(mines, plan.to)!.color !== plan.color) {
          removeMineAt(plan.to);
        }
        occupy.push(plan);
        moveCollisions.push(attacks[attacks.length - 1]!);
        continue;
      }
      // Path discovery: shoot from the first square that lights the target.
      if (revealSteps != null && revealSteps > 0) {
        const mids = rayBetween(plan.from, plan.to);
        const discovery = mids[revealSteps - 1]!;
        attacks.push({
          kind: "capture",
          piece: actor.type,
          color: plan.color,
          from: discovery,
          to: plan.to,
          victim: { piece: target.type, color: target.color },
          occupies: true,
          pathRevealFrom: plan.from,
          pathRevealSteps: revealSteps,
        });
        deadSquares.add(plan.to);
        if (mineAt(mines, plan.to) && mineAt(mines, plan.to)!.color !== plan.color) {
          removeMineAt(plan.to);
        }
        occupy.push({ color: plan.color, from: discovery, to: plan.to });
        continue;
      }
      attacks.push({
        kind: "capture",
        piece: actor.type,
        color: plan.color,
        from: plan.from,
        to: plan.to,
        victim: { piece: target.type, color: target.color },
        occupies: true,
      });
      deadSquares.add(plan.to);
      // Capturing onto a mine square also clears the mine (hostile contact).
      if (mineAt(mines, plan.to) && mineAt(mines, plan.to)!.color !== plan.color) {
        removeMineAt(plan.to);
      }
      occupy.push(plan);
      continue;
    }

    // Fogged hostile mine on empty square — clear + occupy, no attack cue.
    if (!target) {
      const m = mineAt(mines, plan.to);
      if (m && m.color !== plan.color) {
        const blast: ResolveAttack = {
          kind: "mineBlast",
          piece: actor.type,
          color: plan.color,
          from: plan.from,
          to: plan.to,
          mineColor: m.color,
        };
        if (!visible0) {
          moveCollisions.push(blast);
        } else {
          attacks.push(blast);
        }
        removeMineAt(plan.to);
        occupy.push(plan);
        continue;
      }
    }

    // SCFEN §4.1–4.2: sliding intent into fog may pass a still-hidden unit.
    // Walk the ray; first enemy that is (or becomes) visible → attack + stop.
    if (!leapsPiece(actor.type)) {
      const mids = rayBetween(plan.from, plan.to);
      let pathHandled = false;
      for (let i = 0; i < mids.length; i++) {
        const s = mids[i]!;
        const occ = start.get(s);
        if (!occ) continue;
        if (occ.color === plan.color) {
          // Ally blocks — truncate in move phase.
          break;
        }
        if (occ.type === "k") {
          // King on the path before intentTo — HP chip, stop before the king.
          const hit = plan.color === "w" ? "b" : "w";
          const livesAfter = clampLives(lives[hit] - 1);
          lives[hit] = livesAfter;
          const stop = i === 0 ? plan.from : mids[i - 1]!;
          attacks.push({
            kind: "kingShot",
            piece: actor.type,
            color: plan.color,
            from: stop === plan.from ? plan.from : stop,
            to: s,
            target: hit,
            livesAfter,
          });
          if (stop !== plan.from) {
            occupy.push({ color: plan.color, from: plan.from, to: stop });
          }
          pathHandled = true;
          break;
        }

        // Non-king enemy on the path (intent may continue past — fog legality).
        const reveal = pathRevealSteps(
          input.placement,
          plan.from,
          plan.to,
          plan.color,
          s,
          input.pathVisionOpts,
        );
        const startVisible = canSee(plan.color, s);
        const becomesVisible = reveal != null && reveal > 0;
        if (!startVisible && !becomesVisible) {
          attacks.push({
            kind: "capture",
            piece: actor.type,
            color: plan.color,
            from: plan.from,
            to: s,
            victim: { piece: occ.type, color: occ.color },
            occupies: true,
            collision: true,
            moveCollision: true,
          });
          deadSquares.add(s);
          if (mineAt(mines, s) && mineAt(mines, s)!.color !== plan.color) {
            removeMineAt(s);
          }
          occupy.push({ color: plan.color, from: plan.from, to: s });
          moveCollisions.push(attacks[attacks.length - 1]!);
          pathHandled = true;
          break;
        }
        if (becomesVisible) {
          const discovery = mids[reveal! - 1]!;
          attacks.push({
            kind: "capture",
            piece: actor.type,
            color: plan.color,
            from: discovery,
            to: s,
            victim: { piece: occ.type, color: occ.color },
            occupies: true,
            pathRevealFrom: plan.from,
            pathRevealSteps: reveal!,
          });
          deadSquares.add(s);
          if (mineAt(mines, s) && mineAt(mines, s)!.color !== plan.color) {
            removeMineAt(s);
          }
          occupy.push({ color: plan.color, from: discovery, to: s });
          pathHandled = true;
          break;
        }
        // Visible from the start square — attack from `from`, stop at `s`.
        attacks.push({
          kind: "capture",
          piece: actor.type,
          color: plan.color,
          from: plan.from,
          to: s,
          victim: { piece: occ.type, color: occ.color },
          occupies: true,
        });
        deadSquares.add(s);
        if (mineAt(mines, s) && mineAt(mines, s)!.color !== plan.color) {
          removeMineAt(s);
        }
        occupy.push({ color: plan.color, from: plan.from, to: s });
        pathHandled = true;
        break;
      }
      if (pathHandled) continue;
    }

    // Empty destination (friendly mine underfoot / clear path) — move-phase
    // path-cross chase / path unit collision handled in relocate.
    quiets.push(plan);
  }

  const mid = new Map(start);
  for (const sqDead of deadSquares) mid.delete(sqDead);
  // Path-reveal shots: mover is on the discovery square after the approach.
  for (const a of attacks) {
    if (a.kind !== "capture" || !a.pathRevealFrom || a.pathRevealFrom === a.from) continue;
    const piece = mid.get(a.pathRevealFrom);
    if (!piece || piece.color !== a.color) continue;
    mid.delete(a.pathRevealFrom);
    mid.set(a.from, piece);
  }

  const afterAttack = {
    placement: mapToPlacement(mid),
    kingLives: { ...lives },
    mines: [...mines],
  };

  const board = new Map(mid);
  const moves: ResolveMove[] = [];
  const mineTriggers: ResolveAttack[] = [];
  const moversDead = new Set<Square>();

  const relocate = (plan: ClassicalPlan, fromOccupyList: boolean) => {
    if (deadSquares.has(plan.from) || moversDead.has(plan.from)) return;
    const piece = board.get(plan.from);
    if (!piece || piece.color !== plan.color) return;

    let dest = plan.to;

    // Quiet slides: path unit blocks → truncate; capture/occupy enemy blocker.
    if (!fromOccupyList && !leapsPiece(piece.type)) {
      const blocker = firstBlockerOnRay(board, plan.from, plan.to);
      if (blocker) {
        const blocking = board.get(blocker)!;
        if (blocking.color !== plan.color) {
          dest = blocker;
        } else {
          const before = squareBeforeOnRay(plan.from, blocker);
          if (!before || before === plan.from) return;
          dest = before;
        }
      }
    }

    // Fog / destination collision: enemy still on dest → capture/occupy.
    const occ = board.get(dest);
    if (occ && occ.color !== plan.color) {
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
      });
      board.delete(dest);
      if (mineAt(mines, dest) && mineAt(mines, dest)!.color !== plan.color) {
        removeMineAt(dest);
      }
    } else if (!occ) {
      const m = mineAt(mines, dest);
      if (m && m.color !== plan.color) {
        moveCollisions.push({
          kind: "mineBlast",
          piece: piece.type,
          color: plan.color,
          from: plan.from,
          to: dest,
          mineColor: m.color,
        });
        removeMineAt(dest);
      }
    }

    // Wake predicate only: mid-path hostile mines (chase).
    let woke: ScMine | null = null;
    let wakeAt: Square | null = null;
    const contacts = pathContactSquares(plan.from, dest, piece.type);
    for (const contact of contacts) {
      const m = mineAt(mines, contact);
      if (!m || m.color === plan.color) continue;
      woke = m;
      wakeAt = contact;
      break;
    }

    board.delete(plan.from);
    board.set(dest, piece);
    moves.push({
      piece: piece.type,
      color: plan.color,
      from: plan.from,
      to: dest,
    });

    if (woke && wakeAt) {
      mineTriggers.push({
        kind: "mineBlast",
        piece: piece.type,
        color: plan.color,
        from: plan.from,
        to: dest,
        mineColor: woke.color,
        victim: { piece: piece.type, color: plan.color },
        chaseFrom: wakeAt,
      });
      removeMineAt(wakeAt);
      board.delete(dest);
      moversDead.add(dest);
    }
  };

  for (const plan of occupy) relocate(plan, true);
  for (const plan of quiets) relocate(plan, false);

  return {
    attacks,
    afterAttack,
    moves,
    mineTriggers,
    moveCollisions,
    pendingKingShotsArmed,
    afterMove: {
      placement: mapToPlacement(board),
      kingLives: { ...lives },
      mines: [...mines],
    },
  };
};
