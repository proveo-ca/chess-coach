/**
 * Deep SCFEN validators — SC_BASELINE_FEN + SC_SPECIAL.
 * chess.js FEN load is never the oracle (sc-moves.puml).
 *
 * // SPEC: _spec/packages/starchess-core/sc-moves.puml, _spec/packages/starchess-core/scfen-queue.puml, _spec/packages/starchess-core/gas-phase-vacancy.puml
 */

import type { Square } from "chess.js";

import { placementToMap } from "../board/placement";
import { charonDiagonalSquares } from "./specials/mechaCharon";
import { minesFor, MAX_MINES_PER_SIDE, mineAt } from "../board/mines";
import { isTankSiegedAfterB } from "../board/siege";
import { hasExactCCPair } from "../scfen/codec";
import { spawnCCAnchor } from "./specials/adjacent";
import { marineSingleTarget } from "./specials/stimStep";
import type { ScAction, ScActionInput, ScFenSnapshot, StarChessColor } from "../model/types";

export class ScValidateError extends Error {
  readonly code: "SC_BASELINE_FEN" | "SC_SPECIAL";
  constructor(code: "SC_BASELINE_FEN" | "SC_SPECIAL", message: string) {
    super(message);
    this.code = code;
    this.name = "ScValidateError";
  }
}

export type ClassicalVacancy = {
  bOrigins: ReadonlySet<Square>;
  transit: ReadonlySet<Square>;
  gasPairs: ReadonlySet<string>;
};

export const gasPairKey = (from: Square, to: Square): string => `${from}:${to}`;

export const classifyClassicalVacancy = (
  actions: readonly ScAction[] | undefined,
  color: StarChessColor,
): ClassicalVacancy => {
  const bOrigins = new Set<Square>();
  const transit = new Set<Square>();
  const gasPairs = new Set<string>();
  for (const a of actions ?? []) {
    if (a.timing !== "B" || a.color !== color) continue;
    if (a.kind !== "stimStep" && a.kind !== "tacticalJump") continue;
    if (!a.to) continue;
    bOrigins.add(a.from);
    transit.add(a.to);
    gasPairs.add(gasPairKey(a.from, a.to));
  }
  return { bOrigins, transit, gasPairs };
};

/** SCFEN placement invariants — not chess.js FEN validation. */
export const assertBaselineFen = (snap: ScFenSnapshot): void => {
  if (snap.placement.split("/").length !== 8) {
    throw new ScValidateError(
      "SC_BASELINE_FEN",
      `bad placement ranks: ${snap.placement}`,
    );
  }
  if (!hasExactCCPair(snap.placement)) {
    throw new ScValidateError(
      "SC_BASELINE_FEN",
      `placement needs exactly 1 Command Center per side: ${snap.placement}`,
    );
  }
};

/**
 * Soft classical probe for C actions: piece exists on `from`.
 * Destination may be empty, enemy-occupied, **or the enemy Command Center** — fog of war
 * overrides classical FEN check / mate filters (scfen-queue.puml). Path blockers are
 * not rejected at queue time; resolve walks the ray.
 */
export const assertClassicalBaseline = (
  snap: ScFenSnapshot,
  action: Extract<ScAction, { timing: "C" }>,
  vacancy?: ClassicalVacancy,
): void => {
  const v = vacancy ?? classifyClassicalVacancy(snap.queue?.actions, action.color);
  const pairedGas = v.gasPairs.has(gasPairKey(action.from, action.to));
  if (!pairedGas && v.transit.has(action.to)) {
    throw new ScValidateError(
      "SC_BASELINE_FEN",
      `cannot classical-target transit ${action.to}`,
    );
  }
  const map = placementToMap(snap.placement);
  let piece = map.get(action.from);
  // Same-turn B relocates/spawns the actor onto `from` before classical.
  if (!piece || piece.color !== action.color) {
    const b = (snap.queue?.actions ?? []).find(
      (a) =>
        a.timing === "B" &&
        a.color === action.color &&
        a.to === action.from &&
        (a.kind === "deploy" || a.kind === "stimStep" || a.kind === "tacticalJump"),
    );
    if (b && b.timing === "B" && b.kind === "deploy" && b.unit) {
      piece = { type: b.unit, color: action.color };
    } else if (b && b.timing === "B" && (b.kind === "stimStep" || b.kind === "tacticalJump")) {
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
        (a.kind === "stimStep" || a.kind === "tacticalJump"),
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
  // Like a regular piece attacking an empty square, the tank may shell any
  // square on its cross — resolve walks the ray (first blocker intercepts).
  if (
    piece.type === "r" &&
    isTankSiegedAfterB(action.from, snap.siegedTanks, snap.queue?.actions)
  ) {
    const destPiece = map.get(action.to);
    const destMine = mineAt(snap.mines, action.to);
    const onCross =
      action.from[0] === action.to[0] || action.from[1] === action.to[1];
    const isEnemyAttack =
      (!!destPiece && destPiece.color !== action.color) ||
      (!destPiece && !!destMine && destMine.color !== action.color) ||
      (!destPiece && !destMine && onCross);
    if (!isEnemyAttack) {
      throw new ScValidateError(
        "SC_SPECIAL",
        `sieged Tank on ${action.from} cannot relocate`,
      );
    }
  }
  // Allow empty or enemy-occupied destinations (incl. Command Center for fog path intents).
  // Allies are never classical targets — mines ignore allies (no friendly-fire).
  const dest = map.get(action.to);
  if (dest && dest.color === action.color && !v.bOrigins.has(action.to)) {
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
    case "deploy": {
      if (actor.type !== "k") {
        throw new ScValidateError("SC_SPECIAL", "spawn requires Command Center");
      }
      if (!action.to || !action.unit) {
        throw new ScValidateError("SC_SPECIAL", "spawn needs to + unit");
      }
      // F = classical-then-gas: ring + empties are relative to the post-move Command Center.
      const { commandCenter, allyOccupied } = spawnCCAnchor(
        snap,
        action.color,
        action.timing,
      );
      if (!commandCenter) throw new ScValidateError("SC_SPECIAL", "Command Center missing");
      // Occupied targets are legal (the deploy crushes the occupant and
      // records it as victim); only cc-occupied squares are blocked.
      if (allyOccupied.has(action.to)) {
        throw new ScValidateError("SC_SPECIAL", "spawn square occupied by Command Center");
      }
      const kf = commandCenter.charCodeAt(0);
      const kr = Number(commandCenter[1]);
      const tf = action.to.charCodeAt(0);
      const tr = Number(action.to[1]);
      if (Math.abs(kf - tf) > 1 || Math.abs(kr - tr) > 1 || action.to === commandCenter) {
        throw new ScValidateError("SC_SPECIAL", "spawn not adjacent");
      }
      break;
    }
    case "charonMissiles": {
      if (actor.type !== "b") {
        throw new ScValidateError("SC_SPECIAL", "Charon requires mecha");
      }
      if (!action.to) {
        throw new ScValidateError("SC_SPECIAL", "Charon needs aim square");
      }
      // Free aim: any on-board Mecha diagonal is queueable. Whether the shot
      // kills (first ship on the ray) or fizzles off-board is resolve's call.
      // F after a same-mecha classical fires from the post-move square, so
      // validate the diagonal from there (project the C onto a map copy).
      let origin = action.from;
      let originMap = map;
      if (action.timing === "F") {
        const c = (snap.queue?.actions ?? []).find(
          (a) =>
            a.timing === "C" &&
            a.kind === "classical" &&
            a.color === action.color &&
            a.from === action.from,
        );
        if (c && c.timing === "C") {
          const projected = new Map(map);
          const mecha = projected.get(action.from);
          if (mecha) {
            projected.delete(action.from);
            projected.set(c.to, mecha);
          }
          origin = c.to;
          originMap = projected;
        }
      }
      if (!charonDiagonalSquares(originMap, origin).includes(action.to)) {
        throw new ScValidateError("SC_SPECIAL", "Charon aim must be on a Mecha diagonal");
      }
      break;
    }
    case "tacticalJump": {
      if (actor.type !== "q") {
        throw new ScValidateError("SC_SPECIAL", "Jump requires BattleShip");
      }
      if (!action.to) {
        throw new ScValidateError("SC_SPECIAL", "Jump needs destination");
      }
      if (map.has(action.to)) {
        throw new ScValidateError("SC_SPECIAL", "Jump destination occupied");
      }
      break;
    }
    case "stimStep": {
      if (actor.type !== "p") {
        throw new ScValidateError("SC_SPECIAL", "stimStep requires Marine");
      }
      if (!action.to) {
        throw new ScValidateError("SC_SPECIAL", "stimStep needs to");
      }
      // Gas step is +1 forward only (not classical start-rank double).
      const expected = marineSingleTarget(action.from, action.color);
      if (!expected || action.to !== expected) {
        throw new ScValidateError(
          "SC_SPECIAL",
          `stimStep must step +1 to ${expected ?? "off-board"} (got ${action.to})`,
        );
      }
      // Last-rank gas step must carry a promotion choice (picker / timeout default).
      const lastRank = action.color === "w" ? 8 : 1;
      if (Number(action.to[1]) === lastRank && !action.promotion) {
        throw new ScValidateError(
          "SC_SPECIAL",
          "stimStep onto last rank needs promotion",
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
          const land = marineSingleTarget(c.to, action.color);
          if (land && Number(land[1]) === lastRank) {
            throw new ScValidateError(
              "SC_SPECIAL",
              "stimStep after move onto last rank needs gas-first + promotion",
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
        const chainHead = (snap.queue?.actions ?? []).some(
          (a) =>
            a.timing === "B" &&
            a.kind === "stimStep" &&
            a.color === action.color &&
            a.from === action.to,
        );
        if (action.timing === "B" && chainHead) return;
        if (!(action.timing === "F" && c && c.timing === "C" && c.to === action.to)) {
          throw new ScValidateError("SC_SPECIAL", "stimStep blocked");
        }
      }
      break;
    }
    case "spiderMine": {
      if (actor.type !== "n") {
        throw new ScValidateError("SC_SPECIAL", "mine requires Hoverbike");
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
    case "siegeMode": {
      if (actor.type !== "r") {
        throw new ScValidateError("SC_SPECIAL", "siege requires Tank");
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
