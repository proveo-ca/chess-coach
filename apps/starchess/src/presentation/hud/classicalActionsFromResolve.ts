/**
 * Reconstruct planning intent actions from a stored End resolve.
 * Prefer stamped `result.queue` (original Q:); fall back for legacy resolves.
 */
import type { EndScTurnResult, ScAction } from "@chess-coach/starchess-core";

export const classicalActionsFromResolve = (
  result: EndScTurnResult,
): readonly ScAction[] => {
  // New resolves stamp the planning queue — includes path-into-fog C= that
  // never appear in resolved.moves (path-reveal only).
  if (result.queue?.length) {
    return result.queue.map((a, seq) => ({ ...a, seq }));
  }

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
  // Path-reveal / move-collision captures still imply a classical intent.
  for (const a of result.resolved.pathRevealAttacks) {
    if (a.kind !== "capture" || !a.pathRevealFrom) continue;
    actions.push({
      timing: "C",
      kind: "classical",
      color: a.color,
      from: a.pathRevealFrom,
      to: a.to,
      seq: seq++,
    });
  }
  for (const a of result.resolved.moveCollisions) {
    if (a.kind !== "capture") continue;
    actions.push({
      timing: "C",
      kind: "classical",
      color: a.color,
      from: a.from,
      to: a.to,
      seq: seq++,
    });
  }
  for (const a of result.resolved.attacks) {
    if (a.kind !== "capture" || !a.occupies) continue;
    // Skip if already covered by a move with same from.
    if (actions.some((x) => x.timing === "C" && x.from === a.from)) continue;
    actions.push({
      timing: "C",
      kind: "classical",
      color: a.color,
      from: a.from,
      to: a.to,
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
