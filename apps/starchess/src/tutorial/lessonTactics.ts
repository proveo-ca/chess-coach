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

const FILES = "abcdefgh";

/** White half of `Q:w:…;b:…`. */
const whiteQueue = (scfen: string): string => {
  const field = scfen.split("|").find((part) => part.startsWith("Q:")) ?? "";
  return field.slice("Q:".length).replace(/^w:/, "").split(";")[0] ?? "";
};

const whiteGas = (scfen: string): number => {
  const field = scfen.split("|").find((part) => part.startsWith("G:"));
  if (!field) return 0;
  const n = Number(field.split(":")[1]);
  return Number.isFinite(n) ? n : 0;
};

const placementMap = (scfen: string): Map<Square, ScPiece> | null => {
  const placement = scfen.split("|")[1];
  if (!placement) return null;
  try {
    return placementToMap(placement);
  } catch {
    return null;
  }
};

/**
 * The g1 deploy warning. Allies already on the back rank are the guard that
 * drop would be, and an enemy on a lower file than some ally has not outflanked
 * the base (f1 holds against a d2 marine).
 */
export const g1GuardNeeded = (scfen: string, viewer: StarChessColor = "w"): boolean => {
  const map = placementMap(scfen);
  if (!map) return false;
  if (/C=[a-h][1-8]g1|[BF]=[A-Za-z]+:[a-h][1-8]:g1/.test(whiteQueue(scfen))) return false;
  if (map.has("g1")) return false;
  const enemy = viewer === "w" ? "b" : "w";
  const backRank = viewer === "w" ? "1" : "8";
  let maxAlly = -1;
  for (const [sq, piece] of map) {
    if (piece.color !== viewer) continue;
    if (sq[1] === backRank) return false;
    maxAlly = Math.max(maxAlly, FILES.indexOf(sq[0]!));
  }
  if (maxAlly < 0) return false;
  for (const [sq, piece] of map) {
    if (piece.color !== enemy) continue;
    if (FILES.indexOf(sq[0]!) > maxAlly) return true;
  }
  return false;
};

/**
 * Mecha on g2–a8. The g2 marine can still spend the classical Attack/Move
 * (nothing queued on `C`), and the bank can afford the Mecha that replaces it.
 */
export const mechaDiagonalOpen = (scfen: string, viewer: StarChessColor = "w"): boolean => {
  if (viewer !== "w") return false;
  if ((storedMinerals(scfen, viewer) ?? 0) < MECHA_DEPLOY_MINERALS) return false;
  if (/C=/.test(whiteQueue(scfen))) return false;
  const map = placementMap(scfen);
  if (!map) return false;
  const marine = map.get("g2");
  const blocker = map.get("f3");
  return marine?.color === "w" && marine.type === "p" && blocker?.color === "b";
};

/**
 * Square of the marine to gas once the classical move is queued and no gas
 * action is queued yet. The furthest-advanced ally marine, toward the h-file
 * on a tie — that is the one the push lines are walking.
 */
export const gasMarineSquare = (scfen: string, viewer: StarChessColor = "w"): Square | null => {
  if (viewer !== "w") return null;
  if (whiteGas(scfen) < 1) return null;
  const queue = whiteQueue(scfen);
  if (!/C=/.test(queue) || /[BF]=/.test(queue)) return null;
  const map = placementMap(scfen);
  if (!map) return null;
  const from = /C=([a-h][1-8])/.exec(queue)?.[1] as Square | undefined;
  const fromPiece = from ? map.get(from) : undefined;
  const moverIsPawn = fromPiece?.color === viewer && fromPiece.type === "p";
  // The h-file push just spent its move — gas is the extra step on that marine.
  if (moverIsPawn && from![0] === "h") return from!;
  let best: Square | null = null;
  let bestRank = -1;
  let bestFile = -1;
  for (const [sq, piece] of map) {
    if (piece.color !== viewer || piece.type !== "p") continue;
    if (moverIsPawn && sq === from) continue;
    const rank = Number(sq[1]);
    const file = FILES.indexOf(sq[0]!);
    if (rank > bestRank || (rank === bestRank && file > bestFile)) {
      best = sq;
      bestRank = rank;
      bestFile = file;
    }
  }
  return best ?? (moverIsPawn ? from! : null);
};

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
