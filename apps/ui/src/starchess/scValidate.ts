/**
 * Deep SCFEN validators — SC_BASELINE_FEN + SC_SPECIAL.
 */

import { Chess, type Square } from "chess.js";

import { findKing, placementToMap } from "~/starchess/board";
import { charonTargetQueenFromPlacement } from "~/starchess/specials/bishopCharon";
import { minesFor, MAX_MINES_PER_SIDE, mineAt } from "~/starchess/mines";
import { classicFenFromSc } from "~/starchess/scfen";
import type { ScAction, ScFenSnapshot } from "~/types/starchess";

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
 * overrides classical FEN check / mate filters (SCFEN §3–§4). Path blockers are
 * not rejected at queue time; resolve walks the ray.
 */
export const assertClassicalBaseline = (
  snap: ScFenSnapshot,
  action: Extract<ScAction, { timing: "C" }>,
): void => {
  const map = placementToMap(snap.placement);
  let piece = map.get(action.from);
  // Same-turn B=spawn:d1:r then C=d1a1 — piece appears only after B resolves.
  if (!piece || piece.color !== action.color) {
    const spawn = (snap.queue?.actions ?? []).find(
      (a) =>
        a.timing === "B" &&
        a.kind === "spawn" &&
        a.color === action.color &&
        a.to === action.from &&
        a.unit,
    );
    if (spawn && spawn.timing === "B" && spawn.kind === "spawn" && spawn.unit) {
      piece = { type: spawn.unit, color: action.color };
    }
  }
  if (!piece || piece.color !== action.color) {
    throw new ScValidateError(
      "SC_BASELINE_FEN",
      `no ${action.color} piece on ${action.from}`,
    );
  }
  // Siege Tank unpacked (`S:`) cannot relocate — pack first via rookSiege.
  if (
    piece.type === "r" &&
    (snap.siegedRooks ?? []).includes(action.from)
  ) {
    throw new ScValidateError(
      "SC_SPECIAL",
      `sieged rook on ${action.from} cannot relocate`,
    );
  }
  // Allow any destination that is empty or enemy-occupied (incl. king).
  const dest = map.get(action.to);
  if (dest && dest.color === action.color) {
    // Ally-on-mine friendly-fire is StarChess-legal — only reject plain ally squares without mine.
    if (!mineAt(snap.mines, action.to)) {
      throw new ScValidateError(
        "SC_BASELINE_FEN",
        `cannot classical-target ally on ${action.to}`,
      );
    }
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
      if (map.has(action.to)) {
        throw new ScValidateError("SC_SPECIAL", "pawnDouble blocked");
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

export const assertActionDeep = (snap: ScFenSnapshot, action: Omit<ScAction, "seq">): void => {
  assertBaselineFen(snap);
  if (action.timing === "C") {
    assertClassicalBaseline(snap, action as Extract<ScAction, { timing: "C" }>);
  } else {
    assertSpecialLegal(snap, action as Extract<ScAction, { timing: "B" | "F" }>);
  }
};
