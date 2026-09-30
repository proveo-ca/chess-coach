// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import { addScAction, AddScActionError, UNIT_COST, type PieceColor, type ScActionInput, type ScFenSnapshot } from "@chess-coach/starchess-core";
import type { Bank } from "../run/bank";
import type { ChallengeStop } from "./types";

export type StagedQueue = { side: PieceColor; intents: ScActionInput[]; gasAfter: number; spend: number };
export type StageResult = { ok: true; staged: StagedQueue } | { ok: false; failure: ChallengeStop };

const validIntent = (action: ScActionInput, side: PieceColor): boolean => {
  if (!action || typeof action !== "object" || "seq" in action || action.color !== side) return false;
  const square = (value: unknown) => typeof value === "string" && /^[a-h][1-8]$/.test(value);
  if (!square(action.from) || (action.to !== undefined && !square(action.to))) return false;
  if (action.promotion !== undefined && !["p", "n", "b", "r", "q"].includes(action.promotion)) return false;
  if (action.kind === "classical") return action.timing === "C" && square(action.to);
  if (action.timing !== "B" && action.timing !== "F") return false;
  if (!["deploy", "stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump"].includes(action.kind)) return false;
  if (action.unit !== undefined && !["p", "n", "b", "r", "q"].includes(action.unit)) return false;
  return action.kind !== "deploy" || (square(action.to) && action.unit !== undefined);
};

export const stageQueue = (
  open: ScFenSnapshot, bank: Bank, side: PieceColor, intents: readonly ScActionInput[], planningOrdinal: number,
): StageResult => {
  if ((open.queue?.actions.length ?? 0) !== 0) throw new Error("staging requires an empty precommit queue");
  if (!Number.isInteger(bank[side]) || bank[side] < 0 || bank[side] > 12) throw new Error("invalid bank");
  let snapshot = structuredClone(open);
  let spend = 0;
  if (!Array.isArray(intents)) return { ok: false, failure: {
    kind: "queue-rejected", phase: "admission", planningOrdinal, turn: open.turn, side, reason: "invalid-intent-array",
  } };
  for (const [actionIndex, action] of (intents as readonly ScActionInput[]).entries()) {
    const base: ChallengeStop = { kind: "queue-rejected", phase: "admission", planningOrdinal, turn: open.turn, side, actionIndex, action };
    if (!validIntent(action, side)) return { ok: false, failure: { ...base, reason: "invalid-intent" } };
    const cost = action.kind === "deploy" && action.unit ? UNIT_COST[action.unit] : 0;
    if (spend + cost > bank[side]) return { ok: false, failure: {
      ...base, reason: "minerals", requiredMinerals: spend + cost, availableMinerals: bank[side],
    } };
    try {
      snapshot = addScAction({ snapshot, action }).snapshot;
      spend += cost;
    } catch (error) {
      if (!(error instanceof AddScActionError)) throw error;
      return { ok: false, failure: { ...base, reason: error.message, engineCode: error.code } };
    }
  }
  return { ok: true, staged: { side, intents: structuredClone([...intents]), gasAfter: snapshot.gas[side], spend } };
};

export const commitPair = (open: ScFenSnapshot, bank: Bank, white: StagedQueue, black: StagedQueue) => {
  if (white.side !== "w" || black.side !== "b") throw new Error("incorrect merge seats");
  let snapshot = structuredClone(open);
  for (const stage of [white, black]) {
    for (const action of stage.intents) snapshot = addScAction({ snapshot, action }).snapshot;
    if (snapshot.gas[stage.side] !== stage.gasAfter || stage.spend > bank[stage.side]) throw new Error("staging/merge mismatch");
  }
  return { snapshot, bank: { w: bank.w - white.spend, b: bank.b - black.spend } };
};
