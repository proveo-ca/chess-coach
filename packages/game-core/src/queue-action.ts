// SPEC: _spec/turn-planning.puml
import { assertQueueShape } from "./queue-contract";
import { assertActionAdmission, assertNativeClassicalDependencies, ScValidateError } from "./queue-validation";
import { specialGasCost } from "./specials";
import type { ScAction, ScActionInput, ScFenSnapshot } from "./types";

export type AddScActionErrorCode = "SC_PHASE" | "SC_QUEUE_SHAPE" | "SC_GAS" | "SC_BASELINE_FEN" | "SC_SPECIAL";
export class AddScActionError extends Error {
  constructor(readonly code: AddScActionErrorCode, message: string) { super(message); this.name = "AddScActionError"; }
}
export class RemoveScActionError extends Error {
  constructor(readonly code: "SC_PHASE" | "SC_NOT_FOUND", message: string) { super(message); this.name = "RemoveScActionError"; }
}

export const addScAction = (input: { snapshot: ScFenSnapshot; action: ScActionInput }): { snapshot: ScFenSnapshot; action: ScAction } => {
  const snap = input.snapshot;
  if (snap.phase !== "P") throw new AddScActionError("SC_PHASE", `addScAction requires phase P (got ${snap.phase})`);
  try { assertActionAdmission(snap, input.action); } catch (error) {
    if (error instanceof ScValidateError) throw new AddScActionError(error.code, error.message);
    throw error;
  }
  const existing = snap.queue?.actions ?? [];
  const action: ScAction = { ...input.action, seq: Math.max(-1, ...existing.map(value => value.seq)) + 1 };
  const side = existing.filter(value => value.color === action.color);
  if (action.timing === "C") {
    if (side.some(value => value.timing === "C")) throw new AddScActionError("SC_QUEUE_SHAPE", `side ${action.color} already has a classical action`);
  } else {
    if (side.some(value => value.timing !== "C" && value.from === action.from)) throw new AddScActionError("SC_QUEUE_SHAPE", `unit on ${action.from} already used its special this turn`);
    const cost = specialGasCost(action.kind);
    if (snap.gas[action.color] < cost) throw new AddScActionError("SC_GAS", `side ${action.color} needs ${cost} gas but has ${snap.gas[action.color]}`);
  }
  const actions = [...existing, action];
  assertQueueShape(actions);
  try { assertNativeClassicalDependencies(snap, actions, action.color); } catch (error) {
    if (error instanceof ScValidateError) throw new AddScActionError(error.code, error.message);
    throw error;
  }
  const gas = action.timing === "C" ? snap.gas : { ...snap.gas, [action.color]: snap.gas[action.color] - specialGasCost(action.kind) };
  return { snapshot: { ...snap, gas, queue: { actions } }, action };
};

export const removeScAction = (input: { snapshot: ScFenSnapshot; seq: number }): { snapshot: ScFenSnapshot; removed: ScAction } => {
  const snap = input.snapshot;
  if (snap.phase !== "P") throw new RemoveScActionError("SC_PHASE", `removeScAction requires phase P (got ${snap.phase})`);
  const existing = snap.queue?.actions ?? [];
  const removed = existing.find(action => action.seq === input.seq);
  if (!removed) throw new RemoveScActionError("SC_NOT_FOUND", `no queued action with seq ${input.seq}`);
  const actions = existing.filter(action => action.seq !== input.seq);
  assertQueueShape(actions);
  assertNativeClassicalDependencies(snap, actions, removed.color);
  let gas = snap.gas;
  if (removed.timing !== "C") gas = { ...snap.gas, [removed.color]: Math.min(snap.gasIncome[removed.color], snap.gas[removed.color] + specialGasCost(removed.kind)) };
  let specialsUsed = snap.specialsUsed ? [...snap.specialsUsed] : undefined;
  if (removed.timing !== "C" && specialsUsed) {
    specialsUsed = specialsUsed.filter(at => at !== removed.from);
    if (!specialsUsed.length) specialsUsed = undefined;
  }
  const next = { ...snap, gas, queue: { actions } };
  if (specialsUsed) next.specialsUsed = specialsUsed;
  else delete next.specialsUsed;
  return { snapshot: next, removed };
};
