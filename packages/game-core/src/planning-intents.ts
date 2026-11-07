// SPEC: _spec/turn-planning.puml
import { MAX_MINES_PER_SIDE } from "./mines";
import { isScMoveShape, marineSingleTarget } from "./moves";
import { charonDiagonalSquaresFromSquare, isTankSiegedAfterB, spawnCCAnchorFromMap } from "./planning-specials";
import type { ScActionInput, ScPiece, SpawnPiece, Square, StarChessColor } from "./types";

export type PlanningKnowledge = {
  side: StarChessColor;
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
  actions: readonly ScActionInput[] | undefined, color: StarChessColor,
): ClassicalVacancy => {
  const bOrigins = new Set<Square>(), transit = new Set<Square>(), gasPairs = new Set<string>();
  for (const action of actions ?? []) {
    if (action.timing !== "B" || action.color !== color ||
      (action.kind !== "stimStep" && action.kind !== "tacticalJump") || !action.to) continue;
    bOrigins.add(action.from);
    transit.add(action.to);
    gasPairs.add(gasPairKey(action.from, action.to));
  }
  return { bOrigins, transit, gasPairs };
};

export const classicalActorAt = (
  knownPieces: ReadonlyMap<Square, ScPiece>, prefix: readonly ScActionInput[], side: StarChessColor, from: Square,
): ScPiece | undefined => {
  const current = knownPieces.get(from);
  if (current?.color === side) return current;
  const before = prefix.find(action => action.timing === "B" && action.color === side && action.to === from &&
    (action.kind === "deploy" || action.kind === "stimStep" || action.kind === "tacticalJump"));
  if (before?.timing === "B" && before.kind === "deploy" && before.unit) return { type: before.unit, color: side };
  if (before?.kind === "stimStep" || before?.kind === "tacticalJump") {
    const origin = knownPieces.get(before.from);
    if (origin?.color === side) return origin;
  }
  return undefined;
};

const sameActorClassical = (prefix: readonly ScActionInput[], side: StarChessColor, from: Square) => prefix.find(
  (action): action is Extract<ScActionInput, { timing: "C" }> =>
    action.timing === "C" && action.kind === "classical" && action.color === side && action.from === from,
);

export const appendTimeSpecialAnchor = (
  prefix: readonly ScActionInput[], side: StarChessColor, from: Square, timing: "B" | "F",
): Square => timing === "F" ? sameActorClassical(prefix, side, from)?.to ?? from : from;

export type KnownAppendFailure = "actor" | "shape" | "timing" | "mineCap" | "ownOccupancy";
const PROMOTIONS: readonly SpawnPiece[] = ["q", "r", "b", "n"];
const UNITS: readonly SpawnPiece[] = ["p", ...PROMOTIONS];
const SPECIAL_ACTORS = { deploy: "k", stimStep: "p", spiderMine: "n", charonMissiles: "b", siegeMode: "r", tacticalJump: "q" } as const;

export const knownAppendFailure = (
  knowledge: PlanningKnowledge, prefix: readonly ScActionInput[], action: ScActionInput,
): KnownAppendFailure | null => {
  const { side, knownPieces, ownMines, ownSiegedTanks } = knowledge;
  if (action.color !== side) return "actor";
  const actor = action.timing === "C" ? classicalActorAt(knownPieces, prefix, side, action.from) : knownPieces.get(action.from);
  if (!actor || actor.color !== side || (action.timing !== "C" && actor.type !== SPECIAL_ACTORS[action.kind])) return "actor";
  const lastRank = side === "w" ? 8 : 1;
  if (!/^[a-h][1-8]$/.test(action.from) || (action.to !== undefined && !/^[a-h][1-8]$/.test(action.to))) return "shape";
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
        if (!action.to || !charonDiagonalSquaresFromSquare(appendTimeSpecialAnchor(prefix, side, action.from, action.timing)).includes(action.to)) return "shape";
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
  const sidePrefix = prefix.filter(value => value.color === side);
  if (action.timing === "C") {
    if (sidePrefix.some(value => value.timing === "C")) return "timing";
  } else {
    if (sidePrefix.some(value => value.timing !== "C" && value.from === action.from)) return "timing";
    if (action.kind === "stimStep" && action.timing === "F") {
      const classical = sameActorClassical(prefix, side, action.from);
      const land = classical ? marineSingleTarget(classical.to, side) : null;
      if (land && Number(land[1]) === lastRank) return "timing";
    }
  }
  if (action.timing !== "C" && action.kind === "spiderMine" && ownMines.size >= MAX_MINES_PER_SIDE) return "mineCap";
  if (action.timing === "C") {
    const vacancy = classifyClassicalVacancy(prefix, side);
    if (!vacancy.gasPairs.has(gasPairKey(action.from, action.to)) && vacancy.transit.has(action.to)) return "ownOccupancy";
    const destination = knownPieces.get(action.to);
    if (actor.type === "r" && isTankSiegedAfterB(action.from, [...ownSiegedTanks], prefix)) {
      if (destination?.color === side || (!destination && ownMines.has(action.to))) return "ownOccupancy";
    }
    if (destination?.color === side && !vacancy.bOrigins.has(action.to)) return "ownOccupancy";
  } else {
    switch (action.kind) {
      case "deploy":
        if (spawnCCAnchorFromMap(knownPieces, side, action.timing, prefix).allyOccupied.has(action.to!)) return "ownOccupancy";
        break;
      case "tacticalJump":
        if (knownPieces.has(action.to!)) return "ownOccupancy";
        break;
      case "stimStep":
        if (knownPieces.has(action.to!)) {
          const classical = sameActorClassical(prefix, side, action.from);
          const chainHead = sidePrefix.some(value => value.timing === "B" && value.kind === "stimStep" && value.from === action.to);
          if (!(action.timing === "B" && chainHead) && !(action.timing === "F" && classical?.to === action.to)) return "ownOccupancy";
        }
        break;
      case "spiderMine":
        if (ownMines.has(appendTimeSpecialAnchor(prefix, side, action.from, action.timing))) return "ownOccupancy";
        break;
    }
  }
  return null;
};
