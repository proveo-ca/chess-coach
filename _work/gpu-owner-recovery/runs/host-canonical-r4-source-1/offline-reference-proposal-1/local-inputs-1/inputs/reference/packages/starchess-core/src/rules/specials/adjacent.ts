// SPEC: _spec/apps/starchess/core/board/board-queries.puml, _spec/apps/starchess/core/turn/command-queue.puml
import type { Square } from "../../model/square";
import type { ScActionInput, ScFenSnapshot, StarChessColor } from "../../model/types";
import { placementToMap, type ScPiece } from "../../board/placement";

/** Empty squares adjacent to `origin` (Command Center spawn ring). */
export const adjacentSquares = (
  origin: Square,
  occupied: ReadonlySet<Square>,
): Square[] => {
  const file = origin.charCodeAt(0) - 97;
  const rank = Number(origin[1]);
  const out: Square[] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const f = file + df;
      const r = rank + dr;
      if (f < 0 || f > 7 || r < 1 || r > 8) continue;
      const sq = `${String.fromCharCode(97 + f)}${r}` as Square;
      if (!occupied.has(sq)) out.push(sq);
    }
  }
  return out;
};

/**
 * Command Center spawn ring anchor.
 *
 * - **B** (gas before classical): ring around the living Command Center; raw planning
 *   occupancy (B resolves before C — squares still full).
 * - **F** (classical then gas): ring around the **post-move** Command Center when a
 *   same-side classical relocates it; **all** same-side classical vacates count
 *   as empty so a unit can move off a square then receive an F deploy there.
 */
export const spawnCCAnchorFromMap = (
  map: ReadonlyMap<Square, ScPiece>,
  color: StarChessColor,
  timing: "B" | "F",
  prefix: readonly ScActionInput[],
): {
  commandCenter: Square | null;
  occupied: ReadonlySet<Square>;
  allyOccupied: ReadonlySet<Square>;
} => {
  let commandCenter: Square | null = null;
  for (const [square, piece] of map) {
    if (piece.type === "k" && piece.color === color) {
      commandCenter = square;
      break;
    }
  }
  const occupied = new Set(map.keys());
  // Command Centers block deploy (own center + enemy adjacent are never crushable).
  // Ally non-ccs are crushable: deployed unit replaces the occupant.
  const allyOccupied = new Set<Square>();
  for (const [sq, p] of map) {
    if (p.type === "k") allyOccupied.add(sq);
  }
  if (!commandCenter) return { commandCenter: null, occupied, allyOccupied };
  if (timing !== "F") return { commandCenter, occupied, allyOccupied };

  // Project same-side classical relocates (and B gas/warp) onto occupancy.
  // F spawns after B+C at resolve — vacated origins are legal deploy targets.
  // allyOccupied tracks Command Center squares only (Command Centers never crushable): B arms move
  // Marines/BattleShips or deploy non-ccs, so they never touch it; only a classical
  // Command Center move carries the block with it.
  for (const a of prefix) {
    if (a.color !== color) continue;
    if (a.timing === "B") {
      if (
        (a.kind === "stimStep" || a.kind === "tacticalJump") &&
        a.from &&
        a.to
      ) {
        occupied.delete(a.from);
        occupied.add(a.to);
      } else if (a.kind === "deploy" && a.to) {
        occupied.add(a.to);
      }
      continue;
    }
    if (a.timing !== "C" || a.kind !== "classical") continue;
    occupied.delete(a.from);
    occupied.add(a.to);
    if (a.from === commandCenter) {
      allyOccupied.delete(a.from);
      allyOccupied.add(a.to);
      commandCenter = a.to;
    }
  }
  return { commandCenter, occupied, allyOccupied };
};

export const spawnCCAnchor = (
  snap: ScFenSnapshot,
  color: StarChessColor,
  timing: "B" | "F",
): ReturnType<typeof spawnCCAnchorFromMap> =>
  spawnCCAnchorFromMap(placementToMap(snap.placement), color, timing, snap.queue?.actions ?? []);
