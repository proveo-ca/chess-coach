/**
 * StarChess classical resolve — attack then move (simultaneous dual plans).
 * Fog: visible targets attack; fogged occupancy → move collision capture/occupy.
 * King HP: turn-open checks only, except fog path-discovery onto a hidden king.
 * // SPEC: _spec/packages/starchess-core/resolve.puml
 */

import type { Square } from "chess.js";

import {
  mapToPlacement,
  placementToMap,
  type ScPiece,
} from "../board/placement";
import { firstBlockerOnRay, mineAt, pathContactSquares, rayBetween } from "../board/mines";
import type { StarChessColor } from "../model/types";
import type {
  ClassicalPlan,
  RookMode,
  ScMine,
  ScPendingKingShot,
  SpawnPiece,
} from "../model/types";
import { pathRevealSteps } from "../board/vision";

export type { ClassicalPlan };

/** Successful post-move promotion — pawn vacated, new unit deploys. */
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
      /** Intermediates walked before `to` became visible (resolve.puml). */
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
      /**
       * Fog path-discovery onto a hidden king (phase 3). Original intent
       * origin; combat plays approach then the HP chip.
       */
      pathRevealFrom?: Square;
      pathRevealSteps?: number;
      /** Square the slider stops on (before the king; never occupies it). */
      stopAt?: Square;
    }
  | {
      kind: "mineBlast";
      piece: ScPiece["type"];
      color: StarChessColor;
      from: Square;
      to: Square;
      /** Mine owner. */
      mineColor: StarChessColor;
      /** Unit removed with the mine (chase victim). */
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
  /** Progressive path vision (resolve.puml) — rook mode + mines for mid-walk checks. */
  pathVisionOpts?: {
    rookModeFor?: (square: Square) => RookMode;
    mines?: readonly ScMine[];
  };
  /**
   * Squares in siege after B specials. Sieged rooks still attack but do not
   * relocate (immobile until packed via a later `rookSiege`).
   */
  siegedRooks?: readonly Square[];
};

export type ResolveTurnResult = {
  /** Phase 1 — direct attacks (targets visible at resolve start). */
  attacks: ResolveAttack[];
  afterAttack: {
    placement: string;
    kingLives: Record<StarChessColor, number>;
    mines: ScMine[];
  };
  /** Phase 2 — classical moves (occupy + quiet) for survivors of phase 1. */
  moves: ResolveMove[];
  afterMove: {
    placement: string;
    kingLives: Record<StarChessColor, number>;
    mines: ScMine[];
  };
  /**
   * Phase 3 — fog approaches (path-reveal) that FIRED: the attacker walked
   * toward a hidden target, lit it, and captured it. Entries are dropped when
   * the approach fizzles: attacker died in phases 1–2, its square was
   * re-occupied by a phase-2 mover, it is sieged (rooks never relocate), or
   * `to` no longer holds the in-the-way opponent the intent discovered (empty,
   * converging ally, or a different enemy that is not in the way).
   */
  pathRevealAttacks: ResolveAttack[];
  /** Board after all three phases (phase 3 applied). */
  afterAll: {
    placement: string;
    kingLives: Record<StarChessColor, number>;
    mines: ScMine[];
  };
  /** Mine + unit explosions during the move phase. */
  mineTriggers: ResolveAttack[];
  /** Fog / path move collisions: capture/occupy (or fogged kingShot). */
  moveCollisions: ResolveAttack[];
  /**
   * Promotions applied after attack/move/mine settlement. Empty when the
   * promoting pawn died (e.g. stepped onto a hostile mine).
   */
  promotions: ResolvePromotion[];
  /**
   * King-aimed `C=` this turn — armed for next-turn HP / collision (no lives
   * change this resolve).
   */
  pendingKingShotsArmed: ScPendingKingShot[];
};

const clampLives = (n: number) => Math.max(0, Math.min(3, Math.floor(n)));

/** Post-phase-2 board state that phase-3 fog approaches apply onto. */
export type PathRevealSnap = {
  placement: string;
  mines: readonly ScMine[];
  kingLives?: Record<StarChessColor, number>;
};

export type PathRevealApply = PathRevealSnap & { fired: boolean };

/**
 * Apply ONE fog approach to a post-phase-2 snap — the single source of truth
 * for the engine phase-3 loop and the UI replay.
 *
 * Fizzles (`fired: false`, snap unchanged) when the attacker no longer occupies
 * `pathRevealFrom` (color/type mismatch) or `to` no longer holds the exact
 * in-the-way opponent that the intent discovered — empty (already removed in
 * phases 1–2), a same-side unit (a converging attack claimed it), or a
 * different enemy that just happens to sit there (discovered, but not in the
 * way of the intent — never captured).
 *
 * The two remaining fizzle gates are engine-turn context (not board state) and
 * are enforced by the `resolveTurn` phase-3 loop before an attack is added to
 * `pathRevealAttacks`: a sieged origin (`siegedRooks` — rooks never relocate)
 * and an origin re-occupied by a phase-2 mover (`destinationsWritten`). The
 * UI replays only the fired list, so this function never sees those cases.
 */
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
  let mines = [...snap.mines];
  map.delete(a.pathRevealFrom);
  map.delete(a.to);
  const m = mineAt(mines, a.to);
  if (m && m.color !== a.color) mines = mines.filter((x) => x.at !== a.to);
  map.set(a.to, actor);
  return {
    placement: mapToPlacement(map),
    mines,
    kingLives: snap.kingLives ? { ...snap.kingLives } : undefined,
    fired: true,
  };
};

/**
 * Fog path-discovery onto a hidden king — the only mid-resolve king HP chip.
 * Stops on `stopAt` (before the king); never occupies or removes the king.
 */
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

/** Square immediately before `blocker` on the ray from `from` (or null). */
const squareBeforeOnRay = (from: Square, blocker: Square): Square | null => {
  const mids = rayBetween(from, blocker);
  if (mids.length) return mids[mids.length - 1]!;
  return null;
};

/**
 * Apply legal king-checks at turn start (before B specials).
 * Sliding ray with a blocker → collision (no HP). Clear ray / knight → HP −1.
 * Fizzles if attacker gone or enemy king no longer on `to`.
 * Callers pass {@link collectLegalKingChecks} (implicit geometry), not armed `H:`.
 *
 * King attackers leap ({@link leapsPiece}), so face-to-face kings never take the
 * blocker branch — adjacency always chips. Firing is gated only on board
 * occupancy and target identity, never on the shooter's own HP: a king already
 * reduced to 0 in this same pass still returns fire. That is deliberate — it is
 * what makes equal-HP contact end 0/0 as a draw rather than a win for whoever
 * is ordered first. Do not "fix" it.
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
  /** Phase-3 fog approaches — collected here, applied after moves. */
  const pathRevealPending: ResolveAttack[] = [];
  /** Squares a phase-2 mover landed on — re-occupied attacker squares fizzle. */
  const destinationsWritten = new Set<Square>();
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

    // King square as classical `to`: never arm deferred HP (checks are implicit
    // at turn start). Fog path-discovery onto a hidden blocker still occupies.
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

        // Hidden blocker that lights mid-walk → Bxg7-style occupy (not a check).
        // Phase 3: fog approach — deferred until after moves, fizzles if the
        // attacker dies in phase 1 or 2.
        if (becomesVisible && !startVisible) {
          const mids = rayBetween(plan.from, plan.to);
          const discovery = mids[reveal! - 1]!;
          pathRevealPending.push({
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
          continue;
        }
      }
      continue;
    }

    // Allies and enemy kings never arm a mine — only hostile non-kings do.
    if (target && target.color === plan.color) {
      continue;
    }

    // Sliding: mid-path units always beat a further destination target.
    // Re e1→e8 with pe7 + re8 must discover/capture the pawn first (not skip to e8).
    if (
      target &&
      target.color !== plan.color &&
      !leapsPiece(actor.type)
    ) {
      const mids = rayBetween(plan.from, plan.to);
      let pathHandled = false;
      for (let i = 0; i < mids.length; i++) {
        const s = mids[i]!;
        const occ = start.get(s);
        if (!occ) continue;
        if (occ.color === plan.color) {
          // Ally blocks — truncate in move phase (fall through to quiet path).
          pathHandled = false;
          break;
        }
        if (occ.type === "k") {
          // Leave king-on-path to the shared mid-path walk below.
          break;
        }
        const reveal = pathRevealSteps(
          input.placement,
          plan.from,
          plan.to,
          plan.color,
          s,
          input.pathVisionOpts,
        );
        const startVisible = canSee(plan.color, s);
        const becomesVisible = !startVisible && reveal != null && reveal > 0;
        if (!startVisible && !becomesVisible) {
          if (input.siegedRooks?.includes(plan.from)) {
            pathHandled = true;
            break;
          }
          const hit: ResolveAttack = {
            kind: "capture",
            piece: actor.type,
            color: plan.color,
            from: plan.from,
            to: s,
            victim: { piece: occ.type, color: occ.color },
            occupies: true,
            collision: true,
            moveCollision: true,
          };
          moveCollisions.push(hit);
          deadSquares.add(s);
          if (mineAt(mines, s) && mineAt(mines, s)!.color !== plan.color) {
            removeMineAt(s);
          }
          occupy.push({ color: plan.color, from: plan.from, to: s });
          pathHandled = true;
          break;
        }
        if (becomesVisible) {
          const discovery = mids[reveal! - 1]!;
          pathRevealPending.push({
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
          pathHandled = true;
          break;
        }
        // Visible mid-path enemy — phase-1 capture + occupy.
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
      // Ally mid-path (pathHandled false after ally break): treat as quiet truncate.
      if (mids.some((sq) => {
        const o = start.get(sq);
        return o && o.color === plan.color;
      })) {
        quiets.push(plan);
        continue;
      }
    }

    if (target && target.color !== plan.color) {
      let visible = visible0;
      let revealSteps: number | null = null;
      // resolve.puml: fog lifts along the path — discover then attack from that square.
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
        // Sieged rooks never relocate, so they cannot "contact" a fogged
        // square — a fogged target (adjacent, or one that never lights up)
        // is not attacked at all. Visible targets still die to the turret.
        if (input.siegedRooks?.includes(plan.from) && actor.type === "r") {
          continue;
        }
        // Still fogged at contact: clear + occupy, skip attack cue.
        // Phase owner is moveCollisions only — never dual-list in attacks.
        const hit: ResolveAttack = {
          kind: "capture",
          piece: actor.type,
          color: plan.color,
          from: plan.from,
          to: plan.to,
          victim: { piece: target.type, color: target.color },
          occupies: true,
          collision: true,
          moveCollision: true,
        };
        moveCollisions.push(hit);
        deadSquares.add(plan.to);
        if (mineAt(mines, plan.to) && mineAt(mines, plan.to)!.color !== plan.color) {
          removeMineAt(plan.to);
        }
        occupy.push(plan);
        continue;
      }
      // Path discovery: shoot from the first square that lights the target.
      // Phase 3: deferred approach — attacker must survive phases 1–2.
      if (revealSteps != null && revealSteps > 0) {
        const mids = rayBetween(plan.from, plan.to);
        const discovery = mids[revealSteps - 1]!;
        pathRevealPending.push({
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

    // Hostile mine on empty destination.
    // Kings are immune (occupy without arming). Allies never arm.
    // Every other piece that lands on a hostile mine dies with it in the move
    // phase (walk-over trigger) — including units that "attack" the empty square.
    // Sieged rooks cannot relocate onto a fogged mine (same fizzle as above).
    if (!target) {
      const m = mineAt(mines, plan.to);
      if (m && m.color !== plan.color && actor.type !== "k") {
        if (!visible0 && input.siegedRooks?.includes(plan.from) && actor.type === "r") {
          continue;
        }
        quiets.push(plan);
        continue;
      }
    }

    // resolve.puml: sliding intent into fog may pass a still-hidden unit.
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
          // King HP mid-resolve only via fog path-discovery (phase 3).
          // Visible kings already paid at turn open (`beginScTurn`) — stop
          // before the king with no further chip. Still-fogged kings that never
          // light up also do not chip (truncate only).
          const startVisible = canSee(plan.color, s);
          const reveal = pathRevealSteps(
            input.placement,
            plan.from,
            plan.to,
            plan.color,
            s,
            input.pathVisionOpts,
          );
          const becomesVisible = !startVisible && reveal != null && reveal > 0;
          const stopAt: Square | null = i === 0 ? null : mids[i - 1]!;

          if (becomesVisible) {
            const discovery = mids[reveal! - 1]!;
            const hit = plan.color === "w" ? "b" : "w";
            pathRevealPending.push({
              kind: "kingShot",
              piece: actor.type,
              color: plan.color,
              from: discovery,
              to: s,
              target: hit,
              livesAfter: 0,
              pathRevealFrom: plan.from,
              pathRevealSteps: reveal!,
              stopAt: stopAt ?? plan.from,
            });
            pathHandled = true;
            break;
          }

          if (stopAt && stopAt !== plan.from) {
            occupy.push({ color: plan.color, from: plan.from, to: stopAt });
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
        // Path-discovery only when the unit was fogged at the start square.
        // `pathRevealSteps` does not test `from` vision — a lit target can still
        // return >0 as the mover walks; that must not defer to phase-3 approach.
        const becomesVisible = !startVisible && reveal != null && reveal > 0;
        if (!startVisible && !becomesVisible) {
          // Sieged rooks never relocate, so a fogged mid-path unit they can
          // never reach is not contacted either — fizzle the whole intent.
          if (input.siegedRooks?.includes(plan.from)) {
            pathHandled = true;
            break;
          }
          // Fogged mid-path contact — moveCollisions only (no phase-1 attack cue).
          const hit: ResolveAttack = {
            kind: "capture",
            piece: actor.type,
            color: plan.color,
            from: plan.from,
            to: s,
            victim: { piece: occ.type, color: occ.color },
            occupies: true,
            collision: true,
            moveCollision: true,
          };
          moveCollisions.push(hit);
          deadSquares.add(s);
          if (mineAt(mines, s) && mineAt(mines, s)!.color !== plan.color) {
            removeMineAt(s);
          }
          occupy.push({ color: plan.color, from: plan.from, to: s });
          pathHandled = true;
          break;
        }
        if (becomesVisible) {
          const discovery = mids[reveal! - 1]!;
          pathRevealPending.push({
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

  const afterAttack = {
    placement: mapToPlacement(mid),
    kingLives: { ...lives },
    mines: [...mines],
  };

  const board = new Map(mid);
  const moves: ResolveMove[] = [];
  const mineTriggers: ResolveAttack[] = [];
  const moversDead = new Set<Square>();
  /** Promotions deferred until after move/mine settlement. */
  const pendingPromos: ResolvePromotion[] = [];

  const relocate = (plan: ClassicalPlan, fromOccupyList: boolean) => {
    if (deadSquares.has(plan.from) || moversDead.has(plan.from)) return;
    const piece = board.get(plan.from);
    if (!piece || piece.color !== plan.color) return;
    // Intent siege (B) resolves before move — unpacked tanks stay put.
    if (
      piece.type === "r" &&
      (input.siegedRooks ?? []).includes(plan.from)
    ) {
      return;
    }

    let dest = plan.to;

    // Quiet slides: path unit blocks → truncate; capture/occupy enemy blocker.
    // Kings are never occupied — stop on the square before (SCFEN: 1 king / side).
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

    // Fog / destination collision: enemy still on dest → capture/occupy.
    // Never delete or replace a king (simultaneous arrive / path truncate).
    // Kings are immune to spider mines — they neither trigger nor clear them.
    const occ = board.get(dest);
    if (occ?.type === "k") {
      if (occ.color === plan.color) {
        const before = squareBeforeOnRay(plan.from, dest);
        if (!before || before === plan.from) return;
        dest = before;
      } else {
        // Enemy king — bounce: stop before, or abort if adjacent / leap.
        const before = squareBeforeOnRay(plan.from, dest);
        if (!before || before === plan.from || board.get(before)) return;
        dest = before;
      }
    } else if (occ && occ.color !== plan.color) {
      // Same-square race: another mover already landed here this phase → both die
      // (no survivor, no attack cue). Stationary / fog contact still capture+occupy.
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
    }

    // Wake predicate only: mid-path hostile mines (chase). Kings immune.
    // Destination-on-mine for units that cannot attack `dest` is handled after
    // landing (walk-over trigger below). Attack-clearable dest mines are
    // already removed in the attack phase.
    let woke: ScMine | null = null;
    let wakeAt: Square | null = null;
    if (piece.type !== "k") {
      const contacts = pathContactSquares(plan.from, dest, piece.type);
      for (const contact of contacts) {
        const m = mineAt(mines, contact);
        if (!m || m.color === plan.color) continue;
        woke = m;
        wakeAt = contact;
        break;
      }
    }

    board.delete(plan.from);
    // Land as the moving piece — promotion is deferred until after mines settle.
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

    // Destination walk-over: quiet step onto a hostile mine (e.g. pawn forward).
    // Mine triggers — mover dies with the mine; no promotion / occupy left behind.
    if (piece.type !== "k") {
      const destMine = mineAt(mines, dest);
      if (destMine && destMine.color !== plan.color) {
        mineTriggers.push({
          kind: "mineBlast",
          piece: piece.type,
          color: plan.color,
          from: plan.from,
          to: dest,
          mineColor: destMine.color,
          victim: { piece: piece.type, color: plan.color },
        });
        removeMineAt(dest);
        board.delete(dest);
        moversDead.add(dest);
        return;
      }
    }

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

  const afterMove = {
    placement: mapToPlacement(board),
    kingLives: { ...lives },
    mines: [...mines],
  };

  // Phase 3 — fog approaches fire after moves. Fizzle unless the same attacker
  // still occupies `pathRevealFrom` (not sieged — they never relocate — and its
  // square was not re-occupied by a phase-2 mover) and an enemy still holds `to`
  // (empty target or converging attack ⇒ fizzle). `pathRevealAttacks` therefore
  // contains only attacks that actually fired.
  // King HP mid-resolve is only fog path-discovery onto a hidden king.
  const pathRevealAttacks: ResolveAttack[] = [];
  let phase3: PathRevealSnap & { kingLives: Record<StarChessColor, number> } = {
    placement: afterMove.placement,
    mines: [...mines],
    kingLives: { ...lives },
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
      pathRevealAttacks.push(a);
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
    pathRevealAttacks.push({
      ...a,
      livesAfter: applied.kingLives[a.target],
    });
  }

  // Phase 4 — promotions for pawns that survived attack/move/mines.
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
