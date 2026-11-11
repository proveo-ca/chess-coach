// SPEC: _spec/turn-planning.puml
import { parseSquare, sq } from "./board";
import type { ScActionInput, ScPiece, Square, StarChessColor } from "./types";

export const isTankSiegedAfterB = (
  from: Square, siegedTanks: readonly Square[] | undefined, actions: readonly ScActionInput[] | undefined,
): boolean => {
  let sieged = (siegedTanks ?? []).includes(from);
  for (const action of actions ?? []) {
    if (action.timing === "B" && action.kind === "siegeMode" && action.from === from) sieged = !sieged;
  }
  return sieged;
};

export const charonDiagonalSquaresFromSquare = (from: Square): Square[] => {
  const { file, rank } = parseSquare(from);
  const out: Square[] = [];
  for (const [df, dr] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    let f = file + df;
    let r = rank + dr;
    for (;;) {
      const at = sq(f, r);
      if (!at) break;
      out.push(at);
      f += df;
      r += dr;
    }
  }
  return out.sort();
};

export const spawnCCAnchorFromMap = (
  map: ReadonlyMap<Square, ScPiece>, color: StarChessColor, timing: "B" | "F", prefix: readonly ScActionInput[],
): { commandCenter: Square | null; occupied: ReadonlySet<Square>; allyOccupied: ReadonlySet<Square> } => {
  let commandCenter: Square | null = null;
  for (const [at, piece] of map) {
    if (piece.type === "k" && piece.color === color) { commandCenter = at; break; }
  }
  const occupied = new Set(map.keys());
  const allyOccupied = new Set<Square>();
  for (const [at, piece] of map) if (piece.type === "k") allyOccupied.add(at);
  if (!commandCenter || timing !== "F") return { commandCenter, occupied, allyOccupied };
  for (const action of prefix) {
    if (action.color !== color) continue;
    if (action.timing === "B") {
      if ((action.kind === "stimStep" || action.kind === "tacticalJump") && action.to) {
        occupied.delete(action.from);
        occupied.add(action.to);
      } else if (action.kind === "deploy" && action.to) occupied.add(action.to);
      continue;
    }
    if (action.timing !== "C" || action.kind !== "classical") continue;
    occupied.delete(action.from);
    occupied.add(action.to);
    if (action.from === commandCenter) {
      allyOccupied.delete(action.from);
      allyOccupied.add(action.to);
      commandCenter = action.to;
    }
  }
  return { commandCenter, occupied, allyOccupied };
};
