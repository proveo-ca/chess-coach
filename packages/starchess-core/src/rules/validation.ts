/**
 * Deep SCFEN validators — SC_BASELINE_FEN + SC_SPECIAL.
 * chess.js FEN load is never the oracle (sc-moves.puml).
 *
 * // SPEC: _spec/packages/starchess-core/sc-moves.puml, _spec/packages/starchess-core/scfen-queue.puml
 */

import type { Square } from "chess.js";

import { placementToMap } from "../board/placement";
import { charonTargetQueenFromPlacement } from "./specials/bishopCharon";
import { minesFor, MAX_MINES_PER_SIDE, mineAt } from "../board/mines";
import { isRookSiegedAfterB } from "../board/siege";
import { hasExactKingPair } from "../scfen/codec";
import { spawnKingAnchor } from "./specials/adjacent";
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

/** SCFEN placement invariants — not chess.js FEN validation. */
export const assertBaselineFen = (snap: ScFenSnapshot): void => {
  if (snap.placement.split("/").length !== 8) {
    throw new ScValidateError(
      "SC_BASELINE_FEN",
      `bad placement ranks: ${snap.placement}`,
    );
  }
  if (!hasExactKingPair(snap.placement)) {
    throw new ScValidateError(
      "SC_BASELINE_FEN",
      `placement needs exactly 1 king per side: ${snap.placement}`,
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
  // A hostile mine on the destination is an attack too — the turret clears it
  // in place (resolve.puml), so it must not read as a blocked relocate.
  if (
    piece.type === "r" &&
    isRookSiegedAfterB(action.from, snap.siegedRooks, snap.queue?.actions)
  ) {
    const destPiece = map.get(action.to);
    const destMine = mineAt(snap.mines, action.to);
    const isEnemyAttack =
      (!!destPiece && destPiece.color !== action.color) ||
      (!destPiece && !!destMine && destMine.color !== action.color);
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
  // Last-rank marine advance must carry a promotion choice (picker / timeout default).
  if (piece.type === "p") {
    const lastRank = action.color === "w" ? 8 : 1;
    if (Number(action.to[1]) === lastRank && !action.promotion) {
      throw new ScValidateError(
        "SC_SPECIAL",
        `classical last-rank ${action.from}→${action.to} needs promotion`,
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
      // F = classical-then-gas: ring + empties are relative to the post-move king.
      const { king, allyOccupied } = spawnKingAnchor(
        snap,
        action.color,
        action.timing,
      );
      if (!king) throw new ScValidateError("SC_SPECIAL", "king missing");
      // Occupied targets are legal (the deploy crushes the occupant and
      // records it as victim); only king-occupied squares are blocked.
      if (allyOccupied.has(action.to)) {
        throw new ScValidateError("SC_SPECIAL", "spawn square occupied by king");
      }
      const kf = king.charCodeAt(0);
      const kr = Number(king[1]);
      const tf = action.to.charCodeAt(0);
      const tr = Number(action.to[1]);
      if (Math.abs(kf - tf) > 1 || Math.abs(kr - tr) > 1 || action.to === king) {
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
      // Last-rank gas step must carry a promotion choice (picker / timeout default).
      const lastRank = action.color === "w" ? 8 : 1;
      if (Number(action.to[1]) === lastRank && !action.promotion) {
        throw new ScValidateError(
          "SC_SPECIAL",
          "pawnDouble onto last rank needs promotion",
        );
      }
      // Move-then-gas (F after C): post-C +1 must not be last rank either —
      // that path relocates onto 8/1 with no promotion picker. Convert to
      // gas-first + classical (or gas-only promote from the approach rank).
      if (action.timing === "F") {
        const c = (snap.queue?.actions ?? []).find(
          (a) =>
            a.timing === "C" &&
            a.kind === "classical" &&
            a.color === action.color &&
            a.from === action.from,
        );
        if (c && c.timing === "C") {
          const land = pawnSingleTarget(c.to, action.color);
          if (land && Number(land[1]) === lastRank) {
            throw new ScValidateError(
              "SC_SPECIAL",
              "pawnDouble after move onto last rank needs gas-first + promotion",
            );
          }
        }
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
      // F after same-piece C: drop lands on the post-move square (endScTurn
      // rewrite). Do not refuse because the origin already has a mine.
      let at = (action.to ?? action.from) as Square;
      if (action.timing === "F") {
        const c = (snap.queue?.actions ?? []).find(
          (a) =>
            a.timing === "C" &&
            a.kind === "classical" &&
            a.color === action.color &&
            a.from === action.from,
        );
        const dest = c?.to;
        if (dest) at = dest;
      }
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
