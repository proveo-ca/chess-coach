// SPEC: _spec/packages/starchess-core/sc-moves.puml, _spec/packages/starchess-core/gas-phase-vacancy.puml, _spec/packages/starchess-training/candidate-generation.puml
import { MAX_MINES_PER_SIDE } from "../board/mines";
import { isScMoveShape } from "../board/moves";
import type { ScPiece } from "../board/placement";
import { isTankSiegedAfterB } from "../board/siege";
import type { Square } from "../model/square";
import type { PieceColor, ScActionInput, SpawnPiece } from "../model/types";
import { spawnCCAnchorFromMap } from "./specials/adjacent";
import { charonDiagonalSquaresFromSquare } from "./specials/mechaCharon";
import { marineSingleTarget } from "./specials/stimStep";

export type PlanningKnowledge = {
  side: PieceColor;
  knownPieces: ReadonlyMap<Square, ScPiece>;
  unknownSquares: ReadonlySet<Square>;
  ownMines: ReadonlySet<Square>;
  ownSiegedTanks: ReadonlySet<Square>;
};

export type ClassicalVacancy = {
  bOrigins: ReadonlySet<Square>;
  transit: ReadonlySet<Square>;
  gasPairs: ReadonlySet<string>;
};

export const gasPairKey = (from: Square, to: Square): string => `${from}:${to}`;

export const classifyClassicalVacancy = (
  actions: readonly ScActionInput[] | undefined,
  color: PieceColor,
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

export const classicalActorAt = (
  knownPieces: ReadonlyMap<Square, ScPiece>,
  prefix: readonly ScActionInput[],
  side: PieceColor,
  from: Square,
): ScPiece | undefined => {
  const current = knownPieces.get(from);
  if (current?.color === side) return current;
  const b = prefix.find(
    (a) => a.timing === "B" && a.color === side && a.to === from &&
      (a.kind === "deploy" || a.kind === "stimStep" || a.kind === "tacticalJump"),
  );
  if (b?.timing === "B" && b.kind === "deploy" && b.unit) {
    return { type: b.unit, color: side };
  }
  if (b?.kind === "stimStep" || b?.kind === "tacticalJump") {
    const origin = knownPieces.get(b.from);
    if (origin?.color === side) return origin;
  }
  return undefined;
};

const sameActorClassical = (prefix: readonly ScActionInput[], side: PieceColor, from: Square) =>
  prefix.find(
    (a): a is Extract<ScActionInput, { timing: "C" }> =>
      a.timing === "C" && a.kind === "classical" && a.color === side && a.from === from,
  );

/** Append-time F origin for mine drops and Charon aim. */
export const appendTimeSpecialAnchor = (
  prefix: readonly ScActionInput[],
  side: PieceColor,
  from: Square,
  timing: "B" | "F",
): Square => timing === "F" ? sameActorClassical(prefix, side, from)?.to ?? from : from;

export type KnownAppendFailure = "actor" | "shape" | "timing" | "mineCap" | "ownOccupancy";

const PROMOTIONS: readonly SpawnPiece[] = ["q", "r", "b", "n"];
const UNITS: readonly SpawnPiece[] = ["p", ...PROMOTIONS];
const SPECIAL_ACTORS = {
  deploy: "k",
  stimStep: "p",
  spiderMine: "n",
  charonMissiles: "b",
  siegeMode: "r",
  tacticalJump: "q",
} as const;

/** Known-board append constraints for candidate actions. */
export const knownAppendFailure = (
  knowledge: PlanningKnowledge,
  prefix: readonly ScActionInput[],
  action: ScActionInput,
): KnownAppendFailure | null => {
  const { side, knownPieces, ownMines, ownSiegedTanks } = knowledge;
  if (action.color !== side) return "actor";
  const actor = action.timing === "C"
    ? classicalActorAt(knownPieces, prefix, side, action.from)
    : knownPieces.get(action.from);
  if (!actor || actor.color !== side) return "actor";
  if (action.timing !== "C" && actor.type !== SPECIAL_ACTORS[action.kind]) return "actor";

  const lastRank = side === "w" ? 8 : 1;
  if (!/^[a-h][1-8]$/.test(action.from) ||
      (action.to !== undefined && !/^[a-h][1-8]$/.test(action.to))) return "shape";
  if (action.promotion !== undefined && !PROMOTIONS.includes(action.promotion)) return "shape";
  if (action.timing === "C") {
    if (!isScMoveShape(actor.type, action.from, action.to, side)) return "shape";
    const promotes = actor.type === "p" && Number(action.to[1]) === lastRank;
    if (promotes && action.promotion === undefined) return "shape";
    if (actor.type !== "p" && action.promotion !== undefined) return "shape";
  } else {
    if (action.kind !== "deploy" && "unit" in action) return "shape";
    if (action.kind !== "stimStep" && "promotion" in action) return "shape";
    switch (action.kind) {
      case "deploy": {
        if (!action.to || !action.unit || !UNITS.includes(action.unit)) return "shape";
        const { commandCenter } = spawnCCAnchorFromMap(knownPieces, side, action.timing, prefix);
        if (!commandCenter || action.to === commandCenter ||
            Math.abs(commandCenter.charCodeAt(0) - action.to.charCodeAt(0)) > 1 ||
            Math.abs(Number(commandCenter[1]) - Number(action.to[1])) > 1) return "shape";
        break;
      }
      case "stimStep": {
        if (action.to !== marineSingleTarget(action.from, side)) return "shape";
        const promotes = !!action.to && Number(action.to[1]) === lastRank;
        if (promotes !== (action.promotion !== undefined)) return "shape";
        break;
      }
      case "charonMissiles":
        if (!action.to || !charonDiagonalSquaresFromSquare(
          appendTimeSpecialAnchor(prefix, side, action.from, action.timing),
        ).includes(action.to)) return "shape";
        break;
      case "tacticalJump":
        if (!action.to || action.to === action.from) return "shape";
        break;
      case "spiderMine":
      case "siegeMode":
        if ("to" in action) return "shape";
        break;
    }
  }

  const sidePrefix = prefix.filter((a) => a.color === side);
  if (action.timing === "C") {
    if (sidePrefix.some((a) => a.timing === "C")) return "timing";
  } else {
    if (sidePrefix.some((a) => a.timing !== "C" && a.from === action.from)) return "timing";
    if (action.kind === "stimStep" && action.timing === "F") {
      const c = sameActorClassical(prefix, side, action.from);
      const land = c ? marineSingleTarget(c.to, side) : null;
      if (land && Number(land[1]) === lastRank) return "timing";
    }
  }

  if (action.timing !== "C" && action.kind === "spiderMine" &&
      ownMines.size >= MAX_MINES_PER_SIDE) return "mineCap";

  if (action.timing === "C") {
    const vacancy = classifyClassicalVacancy(prefix, side);
    if (!vacancy.gasPairs.has(gasPairKey(action.from, action.to)) && vacancy.transit.has(action.to)) {
      return "ownOccupancy";
    }
    const dest = knownPieces.get(action.to);
    if (actor.type === "r" && isTankSiegedAfterB(action.from, [...ownSiegedTanks], prefix)) {
      if (dest?.color === side || (!dest && ownMines.has(action.to))) return "ownOccupancy";
    }
    if (dest?.color === side && !vacancy.bOrigins.has(action.to)) return "ownOccupancy";
  } else {
    switch (action.kind) {
      case "deploy":
        if (spawnCCAnchorFromMap(knownPieces, side, action.timing, prefix).allyOccupied.has(action.to!)) {
          return "ownOccupancy";
        }
        break;
      case "tacticalJump":
        if (knownPieces.has(action.to!)) return "ownOccupancy";
        break;
      case "stimStep":
        if (knownPieces.has(action.to!)) {
          const c = sameActorClassical(prefix, side, action.from);
          const chainHead = sidePrefix.some(
            (a) => a.timing === "B" && a.kind === "stimStep" && a.from === action.to,
          );
          if (!(action.timing === "B" && chainHead) &&
              !(action.timing === "F" && c?.to === action.to)) return "ownOccupancy";
        }
        break;
      case "spiderMine":
        if (ownMines.has(appendTimeSpecialAnchor(prefix, side, action.from, action.timing))) {
          return "ownOccupancy";
        }
        break;
    }
  }
  return null;
};
