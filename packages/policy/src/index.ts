// SPEC: _spec/representation.puml
import { decodeCandidate, decodeObservation } from "@chess-coach/contracts";
import type { Candidate, Observation } from "@chess-coach/contracts";
import type { Square, StarChessColor } from "@chess-coach/game-core";
import layout from "../../../schemas/feature-layout.json";

export { ENUMERATION_VERSION, MAX_CANDIDATES, MAX_CANDIDATE_ACTIONS, MAX_CANDIDATE_EXTENSIONS, enumerateCandidates } from "./candidates";
export type { CandidateBatch } from "./candidates";

for (const value of Object.values(layout)) if (Array.isArray(value)) Object.freeze(value);
Object.freeze(layout);

export const FEATURE_VERSION = layout.version;
export const FEATURES = layout.dimension;
export const STATE_FEATURES = layout.stateDimension;
export const ACTION_SLOT_FEATURES = layout.actionSlotDimension;
export const FEATURE_LAYOUT = layout;

export function relativeSquare(square: Square, side: StarChessColor): number {
  return (square.charCodeAt(0) - 97) * 8 + (side === "w" ? Number(square[1]) - 1 : 8 - Number(square[1]));
}

function stateFeatures(observation: Observation): Float64Array {
  const state = new Float64Array(STATE_FEATURES);
  const set = (channel: string, square: Square, value = 1): void => {
    const index = layout.boardChannels.indexOf(channel);
    if (index < 0) throw new Error("Unknown board channel");
    state[index * 64 + relativeSquare(square, observation.side)] = value;
  };
  for (const cell of observation.cells) {
    if (cell.visibility === "unknown") continue;
    set(`visibility.${cell.visibility}`, cell.square);
    if (cell.piece) set(`${cell.piece.color === observation.side ? "own" : "enemy"}.${cell.piece.type}`, cell.square);
  }
  for (const sighting of observation.memory) {
    set(`memory.${sighting.piece.type}`, sighting.square);
    set("memory.age", sighting.square, (observation.turn - sighting.observedTurn) / layout.memoryAgeScale);
  }
  for (const at of observation.everLit) set("visibility.everLit", at);
  for (const at of observation.own.mines) set("mine.own", at);
  for (const at of observation.own.siegedTanks) set("siege.own", at);
  for (const unit of observation.ownUnitLineage) {
    set("economic.ownPaidBasis", unit.square, unit.paidBasis / layout.ownUnitValueScale);
    set("economic.ownReplacement", unit.square, unit.replacementValue / layout.ownUnitValueScale);
  }
  const own = observation.own;
  const economy = observation.economy;
  const scalars = [
    observation.turn / 45, own.minerals / 12, own.gas / 3, own.gasIncome / 3, own.ccLives / 3,
    economy.ownPaidDebits / 576, economy.ownPaidSurviving / 576, economy.ownPaidDestroyed / 576, economy.ownPaidWasted / 576,
    economy.ownReplacementDestroyed / 1152, economy.enemyLoss.confirmedUnitCount / 128, economy.enemyLoss.replacementLowerBound / 1152,
    economy.receipts.length / 64, economy.receipts.filter(receipt => receipt.disposition.kind === "unmaterialized").length / 64,
    economy.retiredOwnIds.length / 128,
  ];
  if (scalars.length !== layout.scalars.length || layout.boardChannels.length * 64 + scalars.length !== STATE_FEATURES) throw new Error("State layout mismatch");
  state.set(scalars, layout.boardChannels.length * 64);
  return state;
}

function writeActions(output: Float64Array, offset: number, candidate: Candidate, side: StarChessColor): void {
  candidate.actions.forEach((action, index) => {
    const start = offset + index * ACTION_SLOT_FEATURES;
    output[start] = 1;
    output[start + 1 + layout.actionKinds.indexOf(action.kind)] = 1;
    output[start + 8 + layout.timings.indexOf(action.timing)] = 1;
    output[start + 11 + relativeSquare(action.from, side)] = 1;
    if ("to" in action) output[start + 75 + relativeSquare(action.to, side)] = 1;
    if (action.kind === "deploy") output[start + 139 + layout.spawnChoices.indexOf(action.unit)] = 1;
    if ((action.kind === "classical" || action.kind === "stimStep") && action.promotion) output[start + 144 + layout.promotionChoices.indexOf(action.promotion)] = 1;
  });
}

export type EncodedFeatures = { readonly featureVersion: string; readonly rows: number; readonly values: Float64Array };

export function encodeFeatures(observationJson: string, candidateJsons: readonly string[]): EncodedFeatures {
  if (candidateJsons.length < 1 || candidateJsons.length > 512) throw new RangeError("Expected 1..512 candidates");
  const observation = decodeObservation(observationJson);
  const candidates = candidateJsons.map(json => decodeCandidate(json, observation.side));
  if (STATE_FEATURES + layout.actionSlots * ACTION_SLOT_FEATURES !== FEATURES) throw new Error("Feature layout mismatch");
  const state = stateFeatures(observation);
  const values = new Float64Array(candidates.length * FEATURES);
  candidates.forEach((candidate, row) => {
    const offset = row * FEATURES;
    values.set(state, offset);
    writeActions(values, offset + STATE_FEATURES, candidate, observation.side);
  });
  return { featureVersion: FEATURE_VERSION, rows: candidates.length, values };
}
