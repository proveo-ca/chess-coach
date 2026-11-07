// SPEC: _spec/turn-planning.puml
import { parseSquare, sq } from "./board";
import { canMarineDoubleStep } from "./moves";
import type { ScAction, ScActionInput, Square } from "./types";

export const orderBHeadsFirst = (actions: readonly ScAction[]): ScAction[] => {
  const ordered: ScAction[] = [];
  const pending = [...actions].sort((a, b) => a.seq - b.seq);
  while (pending.length) {
    const heads = new Set(pending
      .filter(action => (action.kind === "stimStep" || action.kind === "tacticalJump") && !!action.to)
      .map(action => action.from));
    const index = pending.findIndex(action => {
      if ((action.kind !== "stimStep" && action.kind !== "tacticalJump") || !action.to) return true;
      const others = new Set(heads);
      others.delete(action.from);
      return ![...others].some(from => from === action.to);
    });
    ordered.push(index >= 0 ? pending.splice(index, 1)[0]! : pending.shift()!);
  }
  return ordered;
};

export const classicalRewriteCoordinatesAfterB = (
  prefix: readonly ScActionInput[],
  classical: Extract<ScActionInput, { timing: "C" }>,
): { from: Square; to: Square } | null => {
  const before = prefix.find(action => action.timing === "B" && action.color === classical.color &&
    action.from === classical.from && action.to && (action.kind === "stimStep" || action.kind === "tacticalJump"));
  if (!before?.to) return null;
  const origin = parseSquare(before.from);
  const arrival = parseSquare(before.to);
  const target = parseSquare(classical.to);
  const to = sq(target.file + arrival.file - origin.file, target.rank + arrival.rank - origin.rank);
  if (!to) return null;
  if (before.kind === "stimStep") {
    const ranks = Math.abs(Number(classical.to[1]) - Number(classical.from[1]));
    const forward = (Number(classical.to[1]) - Number(classical.from[1])) * (before.color === "w" ? 1 : -1) > 0;
    if (classical.kind !== "classical" || classical.from[0] !== classical.to[0] || !forward ||
      (ranks !== 1 && (ranks !== 2 || !canMarineDoubleStep(classical.from, before.color)))) return null;
  } else if (before.to !== classical.to) return null;
  return { from: before.to, to };
};
