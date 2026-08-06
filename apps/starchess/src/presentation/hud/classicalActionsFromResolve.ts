/**
 * Reconstruct classical intent actions from a stored End resolve (queue is cleared on settle).
 */
import type { EndScTurnResult, ScAction } from "@chess-coach/starchess-core";

export const classicalActionsFromResolve = (
  result: EndScTurnResult,
): readonly ScAction[] => {
  let seq = 0;
  const actions: ScAction[] = [];
  for (const m of result.resolved.moves) {
    actions.push({
      timing: "C",
      kind: "classical",
      color: m.color,
      from: m.from,
      to: m.to,
      seq: seq++,
    });
  }
  for (const m of result.bMoves) {
    actions.push({
      timing: "B",
      kind: "pawnDouble",
      color: m.color,
      from: m.from,
      to: m.to,
      seq: seq++,
    });
  }
  for (const m of result.fMoves) {
    actions.push({
      timing: "F",
      kind: "pawnDouble",
      color: m.color,
      from: m.from,
      to: m.to,
      seq: seq++,
    });
  }
  return actions;
};
