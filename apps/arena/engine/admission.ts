// SPEC: _spec/apps/arena/burn-compat.puml
import {
  MAX_STORED_MATERIAL,
  UNIT_COST,
  addScAction,
  assertQueueGas,
  gasRemainingFor,
  queueGasSpent,
  type ScActionInput,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";

export type Bank = Readonly<Record<StarChessColor, number>>;
export type WindowRequests = Readonly<Record<StarChessColor, readonly ScActionInput[]>>;
type Costs = Readonly<{ minerals: Bank; gas: Bank }>;

export function explicitBank(snapshot: ScFenSnapshot): Bank {
  const bank = snapshot.stored;
  if (!bank) throw new Error("Smoke boundary requires an explicit mineral bank");
  for (const side of ["w", "b"] as const) {
    if (!Number.isInteger(bank[side]) || bank[side] < 0 || bank[side] > MAX_STORED_MATERIAL) {
      throw new Error(`Invalid mineral bank for ${side}`);
    }
  }
  return Object.freeze({ w: bank.w, b: bank.b });
}

export function assertOpenSnapshot(snapshot: ScFenSnapshot): void {
  explicitBank(snapshot);
  if (snapshot.phase !== "P" || !snapshot.queue || snapshot.queue.actions.length !== 0) {
    throw new Error("Smoke boundary requires phase P with an explicit empty queue");
  }
  assertQueueGas(snapshot);
}

function actionCosts(actions: readonly ScActionInput[]): Costs {
  const minerals = { w: 0, b: 0 };
  for (const action of actions) {
    if (action.kind === "deploy") {
      if (!action.unit) throw new Error("Deploy requires a native unit cost");
      minerals[action.color] += UNIT_COST[action.unit];
    }
  }
  return { minerals, gas: queueGasSpent(actions) };
}

function appendRequests(snapshot: ScFenSnapshot, requests: readonly ScActionInput[]): ScFenSnapshot {
  let staged = structuredClone(snapshot);
  for (const action of requests) {
    staged = addScAction({ snapshot: staged, action: structuredClone(action) }).snapshot;
  }
  return staged;
}

function assertResources(
  opening: ScFenSnapshot,
  staged: ScFenSnapshot,
  costs: Costs,
): Bank {
  const before = explicitBank(opening);
  const after = { w: before.w - costs.minerals.w, b: before.b - costs.minerals.b };
  assertQueueGas(staged);
  const nativeCosts = queueGasSpent(staged.queue?.actions);
  for (const side of ["w", "b"] as const) {
    if (after[side] < 0) throw new Error(`Insufficient minerals for ${side}`);
    if (nativeCosts[side] !== costs.gas[side] ||
        gasRemainingFor(staged, side) !== opening.gas[side] - costs.gas[side]) {
      throw new Error(`Native gas accounting disagrees for ${side}`);
    }
  }
  return Object.freeze(after);
}

export function stageSide(
  opening: ScFenSnapshot,
  side: StarChessColor,
  requests: readonly ScActionInput[],
): ScFenSnapshot {
  assertOpenSnapshot(opening);
  if (requests.some((action) => action.color !== side)) throw new Error("Side request contains an opposing action");
  const staged = appendRequests(opening, requests);
  const bank = assertResources(opening, staged, actionCosts(requests));
  return { ...staged, stored: { ...bank } };
}

export function commitWindow(
  opening: ScFenSnapshot,
  requests: WindowRequests,
): Readonly<{ snapshot: ScFenSnapshot; bank: Bank; costs: Costs }> {
  assertOpenSnapshot(opening);
  const white = stageSide(structuredClone(opening), "w", requests.w);
  const black = stageSide(structuredClone(opening), "b", requests.b);
  const ordered = [...requests.w, ...requests.b];
  const merged = appendRequests(opening, ordered);
  const costs = actionCosts(ordered);
  const bank = assertResources(opening, merged, costs);
  for (const [side, independent] of [["w", white], ["b", black]] as const) {
    if (independent.gas[side] !== merged.gas[side] || explicitBank(independent)[side] !== bank[side]) {
      throw new Error(`Independent staging disagrees with merged resources for ${side}`);
    }
  }
  return { snapshot: { ...merged, stored: { ...bank } }, bank, costs };
}
