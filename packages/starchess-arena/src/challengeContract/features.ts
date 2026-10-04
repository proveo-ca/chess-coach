// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { MAX_GAME_TURNS, MAX_STORED_MATERIAL, specialGasCost, UNIT_COST, type ScActionInput, type Square } from "@chess-coach/starchess-core";
import { deepFreeze } from "../challenge/config";
import { SQUARES } from "../challenge/observation";
import type { AuthorizedObservation } from "../challenge/types";
import { ACTION_KINDS, decodeCandidate, MAX_QUEUE_ACTIONS, type EncodedCandidate } from "./candidateCodec";
import { validateObservation } from "./observationCodec";
import { fail, PIECE_TYPES, SPAWN_TYPES } from "./validation";

export const FEATURE_VERSION = "challenge-features-v1";
const kinds = (prefix: string, values: readonly string[]) => values.map((value) => `${prefix}.${value}`);
export const GLOBAL_FEATURE_NAMES = Object.freeze([
  "side.w", "side.b", "turn", "own.minerals", "own.gas", "own.gasIncome", "own.ccLives",
  ...kinds("own.count", PIECE_TYPES), ...kinds("observedEnemy.count", PIECE_TYPES),
  "cells.unknown", "cells.lit", "cells.revealed", "rememberedSquare.count",
]);
export const CELL_FEATURE_NAMES = Object.freeze([
  "visibility.unknown", "visibility.lit", "visibility.revealed", "knownEmpty", "ownPiece", "enemyPiece",
  ...kinds("piece", PIECE_TYPES), "ownMine", "ownTankMode.applicable", "ownTankMode.sieged",
  "enemyMine.unknown", "enemyTankMode.unknown", "memory.present", ...kinds("memory.piece", PIECE_TYPES), "memory.age",
]);
export const OBSERVATION_FEATURE_NAMES = Object.freeze([...GLOBAL_FEATURE_NAMES, ...SQUARES.flatMap((at) => CELL_FEATURE_NAMES.map((name) => `${at}.${name}`))]);
export const ACTION_FEATURE_NAMES = Object.freeze([
  "relativeIndex", ...kinds("kind", ACTION_KINDS), ...kinds("timing", ["B", "C", "F"]),
  "from.file", "from.rank", "to.present", "to.file", "to.rank",
  "deployUnit.present", ...kinds("deployUnit", SPAWN_TYPES), "promotion.present", ...kinds("promotion", SPAWN_TYPES),
  "requestedGas", "requestedMinerals", "actor.present", ...kinds("actor.piece", PIECE_TYPES), "actorTankMode.applicable", "actorTankMode.sieged",
  "targetVisibility.unknown", "targetVisibility.lit", "targetVisibility.revealed", "target.knownEmpty", "target.ownPiece", "target.enemyPiece",
  ...kinds("target.piece", PIECE_TYPES), "target.ownMine", "target.enemyMine.unknown", "target.enemyTankMode.unknown",
  "targetMemory.present", ...kinds("targetMemory.piece", PIECE_TYPES), "targetMemory.age", "delta.file", "delta.forward",
]);
const RANKER_GLOBAL_NAMES = ["bias", "pass", "actionCount", "requestedMinerals", "requestedGas", "mineralMargin", "gasMargin"];
export const RANKER_FEATURE_NAMES = Object.freeze([
  ...RANKER_GLOBAL_NAMES, ...GLOBAL_FEATURE_NAMES.map((name) => `observation.${name}`),
  ...ACTION_FEATURE_NAMES.map((name) => `sum.${name}`), ...ACTION_FEATURE_NAMES.map((name) => `positionWeighted.${name}`),
]);
export const FEATURE_SCHEMA = deepFreeze({ version: FEATURE_VERSION,
  observationNames: OBSERVATION_FEATURE_NAMES, actionNames: ACTION_FEATURE_NAMES, rankerNames: RANKER_FEATURE_NAMES,
  scales: { minerals: MAX_STORED_MATERIAL, gas: 3, ccLives: 3, turn: MAX_GAME_TURNS, squareCount: 64, coordinate: 7, actionCount: MAX_QUEUE_ACTIONS, relativeIndex: MAX_QUEUE_ACTIONS - 1 },
  actionPositionWeight: "index+1", ownership: "side-relative", squareOrder: "a1..a8,b1..b8,...,h1..h8",
  aggregation: "ordered rows plus sums and position-weighted sums; fixed-width summaries can collide",
});
export type NumericFeatures = { version: typeof FEATURE_VERSION; observation: number[]; actions: number[][]; ranker: number[] };
const oneHot = (values: readonly string[], value: string | undefined) => values.map((entry) => Number(value === entry));
const coordinate = (at: Square | undefined): number[] => at ? [(at.charCodeAt(0) - 97) / 7, (Number(at[1]) - 1) / 7] : [0, 0];
const age = (observation: AuthorizedObservation, at: Square | undefined): number => at ? (observation.turn - (observation.memory.find((entry) => entry.square === at)?.observedTurn ?? observation.turn)) / MAX_GAME_TURNS : 0;

const globals = (observation: AuthorizedObservation): number[] => [
  Number(observation.side === "w"), Number(observation.side === "b"), observation.turn / MAX_GAME_TURNS,
  observation.own.minerals / MAX_STORED_MATERIAL, observation.own.gas / 3, observation.own.gasIncome / 3, observation.own.ccLives / 3,
  ...PIECE_TYPES.map((type) => observation.own.pieces.filter((entry) => entry.piece.type === type).length / 64),
  ...PIECE_TYPES.map((type) => observation.cells.filter((cell) => cell.visibility !== "unknown" && cell.piece?.color !== observation.side && cell.piece?.type === type).length / 64),
  ...["unknown", "lit", "revealed"].map((visibility) => observation.cells.filter((cell) => cell.visibility === visibility).length / 64),
  observation.memory.length / 64,
];
const cellFeatures = (observation: AuthorizedObservation, at: Square): number[] => {
  const cell = observation.cells[SQUARES.indexOf(at)]!;
  const current = cell.visibility === "unknown" ? null : cell.piece;
  const own = current?.color === observation.side;
  const sighting = observation.memory.find((entry) => entry.square === at);
  return [
    ...oneHot(["unknown", "lit", "revealed"], cell.visibility), Number(cell.visibility === "lit" && current === null), Number(own), Number(!!current && !own),
    ...oneHot(PIECE_TYPES, current?.type), Number(observation.own.mines.includes(at)), Number(own && current?.type === "r"), Number(observation.own.siegedTanks.includes(at)),
    1, Number(cell.visibility === "unknown" || (!!current && !own && current.type === "r")), Number(!!sighting), ...oneHot(PIECE_TYPES, sighting?.piece.type), age(observation, at),
  ];
};
const actionFeatures = (observation: AuthorizedObservation, action: ScActionInput, index: number): number[] => {
  const actor = observation.own.pieces.find((entry) => entry.square === action.from)?.piece;
  const target = action.to ? observation.cells[SQUARES.indexOf(action.to)] : undefined;
  const victim = target?.visibility === "unknown" ? undefined : target?.piece;
  const remembered = observation.memory.find((entry) => entry.square === action.to);
  const ownTarget = victim?.color === observation.side;
  const unit = action.kind === "deploy" ? action.unit : undefined;
  return [
    index / (MAX_QUEUE_ACTIONS - 1), ...oneHot(ACTION_KINDS, action.kind), ...oneHot(["B", "C", "F"], action.timing),
    ...coordinate(action.from), Number(!!action.to), ...coordinate(action.to),
    Number(!!unit), ...oneHot(SPAWN_TYPES, unit), Number(!!action.promotion), ...oneHot(SPAWN_TYPES, action.promotion),
    (action.kind === "classical" ? 0 : specialGasCost(action.kind)) / 3, (unit ? UNIT_COST[unit] : 0) / MAX_STORED_MATERIAL,
    Number(!!actor), ...oneHot(PIECE_TYPES, actor?.type), Number(actor?.type === "r"), Number(observation.own.siegedTanks.includes(action.from)),
    ...oneHot(["unknown", "lit", "revealed"], target?.visibility), Number(target?.visibility === "lit" && victim === null), Number(ownTarget), Number(!!victim && !ownTarget),
    ...oneHot(PIECE_TYPES, victim?.type), Number(!!action.to && observation.own.mines.includes(action.to)), Number(!!action.to),
    Number(target?.visibility === "unknown" || (!!victim && !ownTarget && victim.type === "r")),
    Number(!!remembered), ...oneHot(PIECE_TYPES, remembered?.piece.type), age(observation, action.to),
    action.to ? (action.to.charCodeAt(0) - action.from.charCodeAt(0)) / 7 : 0,
    action.to ? (Number(action.to[1]) - Number(action.from[1])) * (observation.side === "w" ? 1 : -1) / 7 : 0,
  ];
};

export const encodeFeatures = (input: AuthorizedObservation, value: EncodedCandidate): NumericFeatures => {
  const observation = validateObservation(input);
  const candidate = decodeCandidate(value, observation.side);
  const global = globals(observation);
  const observationVector = [...global, ...SQUARES.flatMap((at) => cellFeatures(observation, at))];
  const actions = candidate.actions.map((action, index) => actionFeatures(observation, action, index));
  const ranker = [1, Number(actions.length === 0), actions.length / MAX_QUEUE_ACTIONS,
    candidate.ownSpend.minerals / MAX_STORED_MATERIAL, candidate.ownSpend.gas / 3,
    (observation.own.minerals - candidate.ownSpend.minerals) / MAX_STORED_MATERIAL,
    (observation.own.gas - candidate.ownSpend.gas) / 3, ...global,
    ...ACTION_FEATURE_NAMES.map((_, index) => actions.reduce((sum, row) => sum + row[index]!, 0)),
    ...ACTION_FEATURE_NAMES.map((_, index) => actions.reduce((sum, row, position) => sum + (position + 1) * row[index]!, 0)),
  ];
  if (observationVector.length !== OBSERVATION_FEATURE_NAMES.length || ranker.length !== RANKER_FEATURE_NAMES.length ||
    actions.some((row) => row.length !== ACTION_FEATURE_NAMES.length) || [...observationVector, ...ranker, ...actions.flat()].some((number) => !Number.isFinite(number))) fail("$.features", "FEATURES");
  return deepFreeze({ version: FEATURE_VERSION, observation: observationVector, actions, ranker });
};
