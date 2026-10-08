// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { validateActions } from "@chess-coach/starchess-arena/intent-codec-v1";
import {
  appendTimeSpecialAnchor, knownAppendFailure, MAX_MINES_PER_SIDE,
  specialGasCost, UNIT_COST, type ScActionInput, type Square,
} from "@chess-coach/starchess-core";
import type { CandidateInput } from "./input";
import { MAX_GENERATED_ACTIONS, type PruneReason } from "./types";

export type MineReservation = Readonly<{ queueIndex: number; anchor: Square }>;
export type OwnPrefix = {
  actions: readonly ScActionInput[];
  minerals: number;
  gas: number;
  reservations: readonly MineReservation[];
};
export const emptyPrefix = (): OwnPrefix => ({ actions: [], minerals: 0, gas: 0, reservations: [] });

export const appendFailure = (input: CandidateInput, prefix: OwnPrefix, action: ScActionInput): PruneReason | null => {
  validateActions([action], input.observation.side);
  const known = knownAppendFailure(input.knowledge, prefix.actions, action);
  if (known === "actor" || known === "shape" || known === "timing") return known;
  if (prefix.actions.length >= MAX_GENERATED_ACTIONS) return "timing";
  const minerals = action.kind === "deploy" && action.unit ? UNIT_COST[action.unit] : 0;
  const gas = action.kind === "classical" ? 0 : specialGasCost(action.kind);
  if (prefix.minerals + minerals > input.observation.own.minerals || prefix.gas + gas > input.observation.own.gas) return "resources";
  if (action.kind === "spiderMine" && action.timing !== "C") {
    if (input.knowledge.ownMines.size + prefix.reservations.length >= MAX_MINES_PER_SIDE) return "mineCap";
    const anchor = appendTimeSpecialAnchor(prefix.actions, input.observation.side, action.from, action.timing);
    if (prefix.reservations.some((reservation) => reservation.anchor === anchor)) return "ownOccupancy";
  }
  return known;
};

export const appendPrefix = (prefix: OwnPrefix, action: ScActionInput): OwnPrefix => ({
  actions: [...prefix.actions, action],
  minerals: prefix.minerals + (action.kind === "deploy" && action.unit ? UNIT_COST[action.unit] : 0),
  gas: prefix.gas + (action.kind === "classical" ? 0 : specialGasCost(action.kind)),
  reservations: action.kind === "spiderMine" && action.timing !== "C"
    ? [...prefix.reservations, { queueIndex: prefix.actions.length,
      anchor: appendTimeSpecialAnchor(prefix.actions, action.color, action.from, action.timing) }]
    : prefix.reservations,
});
