/**
 * Deep SCFEN validators — SC_BASELINE_FEN + SC_SPECIAL.
 * chess.js FEN load is never the oracle (sc-moves.puml).
 *
 * // SPEC: _spec/packages/starchess-core/sc-moves.puml, _spec/packages/starchess-core/scfen-queue.puml, _spec/packages/starchess-core/gas-phase-vacancy.puml
 */

import type { Square } from "chess.js";

import { placementToMap } from "../board/placement";
import { charonDiagonalSquaresFromSquare } from "./specials/mechaCharon";
import { minesFor, MAX_MINES_PER_SIDE, mineAt } from "../board/mines";
import { hasExactCCPair } from "../scfen/codec";
import { spawnCCAnchor } from "./specials/adjacent";
import { marineSingleTarget } from "./specials/stimStep";
import type { ScAction, ScActionInput, ScFenSnapshot } from "../model/types";
import {
  appendTimeSpecialAnchor,
  classifyClassicalVacancy,
  gasPairKey,
  type ClassicalVacancy,
} from "./planning-intents";
import { nativeClassicalChecks, type NativeClassicalEligibility } from "./nativeClassical";

export { classifyClassicalVacancy, gasPairKey, type ClassicalVacancy } from "./planning-intents";

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
  if (!hasExactCCPair(snap.placement)) {
    throw new ScValidateError(
      "SC_BASELINE_FEN",
      `placement needs exactly 1 Command Center per side: ${snap.placement}`,
    );
  }
};

/** Native classical admission and dependency validation. */
export const assertClassicalBaseline = (
  snap: ScFenSnapshot,
  action: Extract<ScAction, { timing: "C" }>,
  vacancy?: ClassicalVacancy,
): void => {
  assertClassicalAdmission(snap, action, vacancy);
  assertNativeClassicalDependencies(snap, actionsWithClassical(snap, action), action.color);
};

const actionsWithClassical = (snap: ScFenSnapshot, action: Extract<ScAction, { timing: "C" }>): ScAction[] => {
  const actions = snap.queue?.actions ?? [];
  if (actions.includes(action)) return [...actions];
  const seq = action.seq ?? Math.max(-1, ...actions.map(a => a.seq)) + 1;
  return [...actions, { ...action, seq }];
};

const eligibilityFor = (snap: ScFenSnapshot, actions: readonly ScAction[], action: Extract<ScAction, { timing: "C" }>) => {
  const ownUnits = new Map([...placementToMap(snap.placement)].filter(([, piece]) => piece.color === action.color));
  const ownSieged = new Set((snap.siegedTanks ?? []).filter(at => ownUnits.has(at)));
  return nativeClassicalChecks({ ownUnits, ownSieged }, actions.filter(a => a.color === action.color), action);
};

const assertClassicalTypeDependencies = (
  snap: ScFenSnapshot, action: Extract<ScAction, { timing: "C" }>, eligibility: NativeClassicalEligibility,
  clause?: "siege" | "promotion",
): void => {
  const piece = eligibility.actor;
  const map = placementToMap(snap.placement);
  if (clause !== "promotion" && piece?.type === "r" && eligibility.sieged.has(eligibility.from)) {
    const destPiece = map.get(action.to);
    const destMine = mineAt(snap.mines, action.to);
    const onCross = eligibility.from[0] === eligibility.to[0] || eligibility.from[1] === eligibility.to[1];
    const isEnemyAttack =
      (!!destPiece && destPiece.color !== action.color) ||
      (!destPiece && !!destMine && destMine.color !== action.color) ||
      (!destPiece && !destMine && onCross);
    if (!isEnemyAttack) {
      throw new ScValidateError("SC_SPECIAL", `sieged Tank on ${eligibility.from} cannot relocate`);
    }
  }
  if (clause !== "siege" && piece?.type === "p" && Number(action.to[1]) === (action.color === "w" ? 8 : 1) && !action.promotion) {
    throw new ScValidateError("SC_SPECIAL", `classical last-rank ${action.from}→${action.to} needs promotion`);
  }
};

export const assertNativeClassicalDependencies = (snap: ScFenSnapshot, actions: readonly ScAction[], color?: "w" | "b"): void => {
  for (const action of [...actions].sort((a, b) => a.seq - b.seq)) {
    if (action.timing !== "C" || (color !== undefined && action.color !== color)) continue;
    const checks = eligibilityFor(snap, actions, action);
    for (const eligibility of [checks.insertion, checks.resulting]) {
      assertClassicalTypeDependencies(snap, action, eligibility);
      if (eligibility.diagnostic) throw new ScValidateError(eligibility.diagnostic.code, eligibility.diagnostic.message);
    }
  }
};

const assertClassicalAdmission = (
  snap: ScFenSnapshot, action: Extract<ScAction, { timing: "C" }>, vacancy?: ClassicalVacancy,
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
  const actions = actionsWithClassical(snap, action);
  const current = actions.includes(action) ? action : actions[actions.length - 1]! as Extract<ScAction, { timing: "C" }>;
  const eligibility = eligibilityFor(snap, actions, current).insertion;
  assertClassicalTypeDependencies(snap, action, eligibility, "siege");
  // Allow empty or enemy-occupied destinations (incl. Command Center for fog path intents).
  // Allies are never classical targets — mines ignore allies (no friendly-fire).
  const dest = map.get(action.to);
  if (dest && dest.color === action.color && !v.bOrigins.has(action.to)) {
    throw new ScValidateError(
      "SC_BASELINE_FEN",
      `cannot classical-target ally on ${action.to}`,
    );
  }
  assertClassicalTypeDependencies(snap, action, eligibility, "promotion");
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
      const origin = appendTimeSpecialAnchor(
        snap.queue?.actions ?? [], action.color, action.from, action.timing,
      );
      if (!charonDiagonalSquaresFromSquare(origin).includes(action.to)) {
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
        const dest = c ? appendTimeSpecialAnchor(
          snap.queue?.actions ?? [], action.color, action.from, action.timing,
        ) : undefined;
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

export const assertActionAdmission = (snap: ScFenSnapshot, action: ScActionInput): void => {
  assertBaselineFen(snap);
  if (action.timing === "C") assertClassicalAdmission(snap, action as Extract<ScAction, { timing: "C" }>);
  else assertSpecialLegal(snap, action as Extract<ScAction, { timing: "B" | "F" }>);
};
