/**
 * Deep SCFEN validators — SC_BASELINE_FEN + SC_SPECIAL.
 */

import { Chess, type Square } from "chess.js";

import { findKing, placementToMap } from "../board/placement";
import { charonTargetQueenFromPlacement } from "./specials/bishopCharon";
import { minesFor, MAX_MINES_PER_SIDE, mineAt } from "../board/mines";
import { isRookSiegedAfterB } from "../board/siege";
import { classicFenFromSc } from "../scfen/classic";
import { pawnSingleTarget } from "./specials/pawnDouble";
import type { ScAction, ScActionInput, ScFenSnapshot } from "../model/types";

export class ScValidateError extends Error {
  readonly code: "SC_BASELINE_FEN" | "SC_SPECIAL";
  constructor(code: "SC_BASELINE_FEN" | "SC_SPECIAL", message: string) {
    super(message);
    this.code = code;
    this.name = "ScValidateError";
  }
}

/** Classic export must load in chess.js (both kings already checked by parse). */
export const assertBaselineFen = (snap: ScFenSnapshot): void => {
  try {
    const fen = classicFenFromSc(snap, "w");
    // eslint-disable-next-line no-new
    new Chess(fen);
  } catch (e) {
    throw new ScValidateError(
      "SC_BASELINE_FEN",
      `classic export not loadable: ${(e as Error).message}`,
    );
  }
};

/**
 * Soft classical probe for C actions: piece exists on `from`.
 * Destination may be empty, enemy-occupied, **or the enemy king** — fog of war
 * overrides classical FEN check / mate filters (scfen-queue.puml). Path blockers are
 * not rejected at queue time; resolve walks the ray.
 */
export const assertClassicalBaseline = (
  snap: ScFenSnapshot,
  action: Extract<ScAction, { timing: "C" }>,
): void => {
  const map = placementToMap(snap.placement);
  let piece = map.get(action.from);
  // Same-turn B relocates/spawns the actor onto `from` before classical.
  if (!piece || piece.color !== action.color) {
    const b = (snap.queue?.actions ?? []).find(
      (a) =>
        a.timing === "B" &&
        a.color === action.color &&
        a.to === action.from &&
        (a.kind === "spawn" || a.kind === "pawnDouble" || a.kind === "queenWarp"),
    );
    if (b && b.timing === "B" && b.kind === "spawn" && b.unit) {
      piece = { type: b.unit, color: action.color };
    } else if (b && b.timing === "B" && (b.kind === "pawnDouble" || b.kind === "queenWarp")) {
      // Actor still lives on B.from in the planning placement.
      const origin = map.get(b.from);
      if (origin && origin.color === action.color) piece = origin;
    }
  }
  // Also accept C authored on the pre-B square when B will move that piece
  // (UI clicks before B resolve; endScTurn rewrites C by B's vector).
  if (!piece || piece.color !== action.color) {
    const bFrom = (snap.queue?.actions ?? []).find(
      (a) =>
        a.timing === "B" &&
        a.color === action.color &&
        a.from === action.from &&
        (a.kind === "pawnDouble" || a.kind === "queenWarp"),
    );
    if (bFrom) {
      const origin = map.get(action.from);
      if (origin && origin.color === action.color) piece = origin;
    }
  }
  if (!piece || piece.color !== action.color) {
    throw new ScValidateError(
      "SC_BASELINE_FEN",
      `no ${action.color} piece on ${action.from}`,
    );
  }
  // Siege Tank: immobile while sieged after B intents (quiet relocate blocked).
  // Intent unsiege unlocks relocate; attacks on enemy squares stay legal (no occupy).
  if (
    piece.type === "r" &&
    isRookSiegedAfterB(action.from, snap.siegedRooks, snap.queue?.actions)
  ) {
    const destPiece = map.get(action.to);
    const isEnemyAttack = !!destPiece && destPiece.color !== action.color;
    if (!isEnemyAttack) {
      throw new ScValidateError(
        "SC_SPECIAL",
        `sieged rook on ${action.from} cannot relocate`,
      );
    }
  }
  // Allow empty or enemy-occupied destinations (incl. king for fog path intents).
  // Allies are never classical targets — mines ignore allies (no friendly-fire).
  const dest = map.get(action.to);
  if (dest && dest.color === action.color) {
    throw new ScValidateError(
      "SC_BASELINE_FEN",
      `cannot classical-target ally on ${action.to}`,
    );
  }
};

export const assertSpecialLegal = (
  snap: ScFenSnapshot,
  action: Extract<ScAction, { timing: "B" | "F" }>,
): void => {
  const map = placementToMap(snap.placement);
  const actor = map.get(action.from);
  if (!actor || actor.color !== action.color) {
    throw new ScValidateError("SC_SPECIAL", `no actor on ${action.from}`);
  }

  switch (action.kind) {
    case "spawn": {
      if (actor.type !== "k") {
        throw new ScValidateError("SC_SPECIAL", "spawn requires king");
      }
      if (!action.to || !action.unit) {
        throw new ScValidateError("SC_SPECIAL", "spawn needs to + unit");
      }
      if (map.has(action.to)) {
        throw new ScValidateError("SC_SPECIAL", "spawn square occupied");
      }
      const king = findKing(map, action.color);
      if (!king) throw new ScValidateError("SC_SPECIAL", "king missing");
      const kf = king.charCodeAt(0);
      const kr = Number(king[1]);
      const tf = action.to.charCodeAt(0);
      const tr = Number(action.to[1]);
      if (Math.abs(kf - tf) > 1 || Math.abs(kr - tr) > 1) {
        throw new ScValidateError("SC_SPECIAL", "spawn not adjacent");
      }
      break;
    }
    case "bishopSnipe": {
      if (actor.type !== "b") {
        throw new ScValidateError("SC_SPECIAL", "Charon requires bishop");
      }
      if (!action.to) {
        throw new ScValidateError("SC_SPECIAL", "Charon needs target");
      }
      const legal = charonTargetQueenFromPlacement(snap.placement, action.from);
      if (legal !== action.to) {
        throw new ScValidateError("SC_SPECIAL", "Charon target not unique diagonal queen");
      }
      break;
    }
    case "queenWarp": {
      if (actor.type !== "q") {
        throw new ScValidateError("SC_SPECIAL", "Jump requires queen");
      }
      if (!action.to) {
        throw new ScValidateError("SC_SPECIAL", "Jump needs destination");
      }
      if (map.has(action.to)) {
        throw new ScValidateError("SC_SPECIAL", "Jump destination occupied");
      }
      break;
    }
    case "pawnDouble": {
      if (actor.type !== "p") {
        throw new ScValidateError("SC_SPECIAL", "pawnDouble requires pawn");
      }
      if (!action.to) {
        throw new ScValidateError("SC_SPECIAL", "pawnDouble needs to");
      }
      // Gas step is +1 forward only (not classical start-rank double).
      const expected = pawnSingleTarget(action.from, action.color);
      if (!expected || action.to !== expected) {
        throw new ScValidateError(
          "SC_SPECIAL",
          `pawnDouble must step +1 to ${expected ?? "off-board"} (got ${action.to})`,
        );
      }
      // F after C: dest may be free only post-classical; queue-time checks
      // planning placement. For F, allow occupied-by-self-from when C will leave.
      if (map.has(action.to)) {
        const c = (snap.queue?.actions ?? []).find(
          (a) => a.timing === "C" && a.color === action.color && a.from === action.from,
        );
        if (!(action.timing === "F" && c && c.timing === "C" && c.to === action.to)) {
          throw new ScValidateError("SC_SPECIAL", "pawnDouble blocked");
        }
      }
      break;
    }
    case "knightMine": {
      if (actor.type !== "n") {
        throw new ScValidateError("SC_SPECIAL", "mine requires knight");
      }
      const at = (action.to ?? action.from) as Square;
      if (mineAt(snap.mines, at)) {
        throw new ScValidateError("SC_SPECIAL", "mine already on square");
      }
      if (minesFor(snap.mines, action.color).length >= MAX_MINES_PER_SIDE) {
        throw new ScValidateError(
          "SC_SPECIAL",
          `mine cap ${MAX_MINES_PER_SIDE} reached`,
        );
      }
      break;
    }
    case "rookSiege": {
      if (actor.type !== "r") {
        throw new ScValidateError("SC_SPECIAL", "siege requires rook");
      }
      break;
    }
    default:
      break;
  }
};

export const assertActionDeep = (snap: ScFenSnapshot, action: ScActionInput): void => {
  assertBaselineFen(snap);
  if (action.timing === "C") {
    assertClassicalBaseline(snap, action as Extract<ScAction, { timing: "C" }>);
  } else {
    assertSpecialLegal(snap, action as Extract<ScAction, { timing: "B" | "F" }>);
  }
};
