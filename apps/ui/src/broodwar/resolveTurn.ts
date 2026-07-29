/**
 * Brood War classical resolve — attack then move (simultaneous dual plans).
 * Pure board math; no DOM / timers. Classic FEN is render-export only.
 */

import type { Square } from "chess.js";

import {
  findKing,
  mapToPlacement,
  placementToMap,
  type BwPiece,
} from "~/broodwar/board";
import type { BroodWarColor } from "~/broodwar/types";

export type ClassicalPlan = {
  color: BroodWarColor;
  from: Square;
  to: Square;
};

export type ResolveAttack =
  | {
      kind: "capture";
      piece: BwPiece["type"];
      color: BroodWarColor;
      from: Square;
      to: Square;
      victim: { piece: BwPiece["type"]; color: BroodWarColor };
      /** Attacker also dies (mutual / tanked). */
      dies?: boolean;
      /** When false, survivor does not relocate onto `to`. */
      occupies?: boolean;
    }
  | {
      kind: "kingShot";
      piece: BwPiece["type"];
      color: BroodWarColor;
      from: Square;
      to: Square;
      /** Side whose king was hit. */
      target: BroodWarColor;
      /** Lives after this shot (0 = rubble). */
      livesAfter: number;
    };

export type ResolveMove = {
  piece: BwPiece["type"];
  color: BroodWarColor;
  from: Square;
  to: Square;
};

export type ResolveTurnInput = {
  placement: string;
  kingLives: Record<BroodWarColor, number>;
  white: ClassicalPlan | null;
  black: ClassicalPlan | null;
};

export type ResolveTurnResult = {
  attacks: ResolveAttack[];
  /** Victims gone / HP applied; capturers still on `from`. */
  afterAttack: {
    placement: string;
    kingLives: Record<BroodWarColor, number>;
  };
  moves: ResolveMove[];
  /** Survivors occupied; quiet relocates applied. */
  afterMove: {
    placement: string;
    kingLives: Record<BroodWarColor, number>;
  };
};

const clampLives = (n: number) => Math.max(0, Math.min(3, Math.floor(n)));

const plansOf = (input: ResolveTurnInput): ClassicalPlan[] => {
  const out: ClassicalPlan[] = [];
  if (input.white) out.push({ ...input.white, color: "w" });
  if (input.black) out.push({ ...input.black, color: "b" });
  return out;
};

/**
 * Resolve one Brood War turn of dual classical plans.
 * Attack phase reads the start board; move phase relocates survivors.
 */
export const resolveTurn = (input: ResolveTurnInput): ResolveTurnResult => {
  const start = placementToMap(input.placement);
  const lives = {
    w: clampLives(input.kingLives.w),
    b: clampLives(input.kingLives.b),
  };
  const plans = plansOf(input);

  const attacks: ResolveAttack[] = [];
  const deadSquares = new Set<Square>();
  /** Capturers that will occupy after attack (from → to). */
  const occupy: ClassicalPlan[] = [];
  /** Quiet relocates (no capture). */
  const quiets: ClassicalPlan[] = [];

  for (const plan of plans) {
    const actor = start.get(plan.from);
    if (!actor || actor.color !== plan.color) continue;

    const target = start.get(plan.to);
    if (target && target.color !== plan.color && target.type === "k") {
      const hit = plan.color === "w" ? "b" : "w";
      const livesAfter = clampLives(lives[hit] - 1);
      lives[hit] = livesAfter;
      attacks.push({
        kind: "kingShot",
        piece: actor.type,
        color: plan.color,
        from: plan.from,
        to: plan.to,
        target: hit,
        livesAfter,
      });
      // Keep both kings in placement (ChessBoard / chess.js). Death cue hides rubble.
      // Non-king never occupies the king square (rule §11.3).
      continue;
    }

    if (target && target.color !== plan.color) {
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
      occupy.push(plan);
      continue;
    }

    quiets.push(plan);
  }

  // After-attack board: drop victims / rubble kings; attackers stay on `from`.
  const mid = new Map(start);
  for (const sq of deadSquares) mid.delete(sq);

  const afterAttack = {
    placement: mapToPlacement(mid),
    kingLives: { ...lives },
  };

  // Move phase: quiet relocates + capture occupy (skip if capturer died).
  const board = new Map(mid);
  const moves: ResolveMove[] = [];

  const relocate = (plan: ClassicalPlan) => {
    if (deadSquares.has(plan.from)) return;
    const piece = board.get(plan.from);
    if (!piece || piece.color !== plan.color) return;
    board.delete(plan.from);
    board.set(plan.to, piece);
    moves.push({
      piece: piece.type,
      color: plan.color,
      from: plan.from,
      to: plan.to,
    });
  };

  for (const plan of occupy) relocate(plan);
  for (const plan of quiets) relocate(plan);

  return {
    attacks,
    afterAttack,
    moves,
    afterMove: {
      placement: mapToPlacement(board),
      kingLives: { ...lives },
    },
  };
};
