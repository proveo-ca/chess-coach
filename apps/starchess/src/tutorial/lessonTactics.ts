// SPEC: _spec/apps/starchess/menu-flow.puml
import {
  attacksSquare,
  placementToMap,
  type ScPiece,
  type StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type {
  AttackTrajectory,
  SquareCoverer,
  SquareCovers,
} from "~/types/tutorial";

export const SHIP_WATCH_SQUARES: readonly Square[] = ["e1", "f1", "g1"];

export const attackersOfSquare = (
  map: Map<Square, ScPiece>,
  square: Square,
  color: StarChessColor,
): SquareCoverer[] => {
  const out: SquareCoverer[] = [];
  for (const [from, piece] of map) {
    if (piece.color !== color) continue;
    if (attacksSquare(map, from, square)) out.push({ from, kind: piece.type });
  }
  return out;
};

export const coveredEnemyShips = (
  scfen: string | undefined,
  viewer: StarChessColor,
  squares: readonly Square[] = SHIP_WATCH_SQUARES,
): SquareCovers => {
  if (!scfen) return {};
  const placement = scfen.split("|")[1];
  if (!placement) return {};
  let map: Map<Square, ScPiece>;
  try {
    map = placementToMap(placement);
  } catch {
    return {};
  }
  const out: SquareCovers = {};
  for (const square of squares) {
    const occupant = map.get(square);
    if (!occupant || occupant.type !== "q" || occupant.color === viewer) continue;
    out[square] = attackersOfSquare(map, square, viewer);
  }
  return out;
};

/** Minerals needed to deploy a Mecha (bishop) from the Command Center. */
const MECHA_DEPLOY_MINERALS = 3;

const storedMinerals = (scfen: string, viewer: StarChessColor): number | null => {
  for (const part of scfen.split("|")) {
    if (!part.startsWith("B:")) continue;
    const n = Number(part.split(":")[viewer === "w" ? 1 : 2]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

type TrajectoryRule = {
  key: string;
  from: Square;
  to: Square;
  /** Deploy money the staging post demands (0 = already on board). */
  minerals: number;
};

/**
 * Staging posts against the enemy Command Center. Each row is one
 * deploy-or-ride beat: stage on `from`, and the enemy CC on `to` falls.
 * New rows extend the coach without touching the matcher.
 */
const TRAJECTORY_TABLE: readonly TrajectoryRule[] = [
  { key: "deploy-b-g2-d5", from: "g2", to: "d5", minerals: MECHA_DEPLOY_MINERALS },
];

/**
 * Open attack trajectories — enemy Command Center on `to`, staging square
 * vacant, deploy money banked. Preferred over longer rides when affordable,
 * since the drop lands already attacking.
 */
export const availableTrajectories = (
  scfen: string | undefined,
  viewer: StarChessColor,
): AttackTrajectory[] => {
  if (!scfen) return [];
  const placement = scfen.split("|")[1];
  if (!placement) return [];
  let map: Map<Square, ScPiece>;
  try {
    map = placementToMap(placement);
  } catch {
    return [];
  }
  const stored = storedMinerals(scfen, viewer) ?? 0;
  const out: AttackTrajectory[] = [];
  for (const row of TRAJECTORY_TABLE) {
    const target = map.get(row.to);
    if (!target || target.type !== "k" || target.color === viewer) continue;
    if (map.has(row.from)) continue;
    if (stored < row.minerals) continue;
    out.push({ key: row.key, from: row.from, to: row.to });
  }
  return out;
};
