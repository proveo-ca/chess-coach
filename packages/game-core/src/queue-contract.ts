// SPEC: _spec/turn-planning.puml
import { energyForTurn } from "./constants";
import { specialGasCost } from "./specials";
import type { ScAction, ScFenSnapshot, Square, StarChessColor } from "./types";

export const assertQueueShape = (actions: readonly ScAction[]): void => {
  for (const color of ["w", "b"] as const) {
    const side = actions.filter(action => action.color === color);
    const classical = side.filter(action => action.timing === "C");
    if (classical.length > 1) throw Object.assign(
      new Error(`SCFEN queue: at most one C per side (${color} has ${classical.length})`), { code: "SC_QUEUE_SHAPE" as const },
    );
    const specialed = new Set<Square>();
    for (const action of side) {
      if (action.timing === "C") continue;
      if (specialed.has(action.from)) throw Object.assign(
        new Error(`SCFEN queue: one special per unit (${color} stacks two on ${action.from})`), { code: "SC_QUEUE_SHAPE" as const },
      );
      specialed.add(action.from);
    }
  }
};

export const queueGasSpent = (
  actions: readonly Pick<ScAction, "timing" | "color" | "kind">[] | undefined,
): Record<StarChessColor, number> => {
  const spent = { w: 0, b: 0 };
  for (const action of actions ?? []) {
    if (action.timing !== "C") spent[action.color] += specialGasCost(action.kind as Parameters<typeof specialGasCost>[0]);
  }
  return spent;
};

export const assertQueueGas = (snap: Pick<ScFenSnapshot, "turn" | "gas" | "gasIncome" | "queue">): void => {
  const tier = energyForTurn(snap.turn);
  const spent = queueGasSpent(snap.queue?.actions);
  for (const color of ["w", "b"] as const) {
    const remaining = snap.gas[color], income = snap.gasIncome[color];
    if (remaining < 0 || remaining > 9 || income < 0 || income > 9) throw Object.assign(
      new Error(`SCFEN gas: out of range for ${color}`), { code: "SC_GAS" as const },
    );
    if (income !== tier) throw Object.assign(
      new Error(`SCFEN gas: ${color} income ${income} != turn tier ${tier} (turn ${snap.turn}; gas does not accumulate)`), { code: "SC_GAS" as const },
    );
    if (spent[color] > income) throw Object.assign(
      new Error(`SCFEN gas: ${color} specials cost ${spent[color]} but income is ${income}`), { code: "SC_GAS" as const },
    );
    if (remaining + spent[color] > income) throw Object.assign(
      new Error(`SCFEN gas: ${color} remaining ${remaining} + spent ${spent[color]} exceeds income ${income}`), { code: "SC_GAS" as const },
    );
  }
};
