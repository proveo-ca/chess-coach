// SPEC: _spec/apps/starchess/menu-flow.puml
import {
  attacksSquare,
  findKing,
  hostileMineOn,
  parseMinesExtra,
  placementToMap,
  UNIT_COST,
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
  // `G:wb:WB` packs one digit per side, so `G:21:22` is white remaining 2.
  const n = Number((field.split(":")[1] ?? "")[0]);
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
  if (!/C=/.test(queue)) return null;
  // A spawn is the forward deploy, not the marine. Any other gas action already
  // spends the canister this beat is about.
  if (/[BF]=(?!spawn\b)[A-Za-z]/.test(queue)) return null;
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

/** g2 first, then h2 — the two forward drops beside a Command Center on h1. */
const FORWARD_DEPLOYS: readonly Square[] = ["g2", "h2"];

const minesOf = (scfen: string) =>
  parseMinesExtra(scfen.split("|").find((part) => part.startsWith("M:")));

const squareNamed = (raw: string | undefined): Square | null =>
  raw && /^[a-h][1-8]$/.test(raw) ? (raw as Square) : null;

/**
 * Squares our queued move or gas-step leaves, minus squares something of ours
 * lands on. An F deploy can use a square the classical move just vacated.
 */
const deployVacancies = (
  queue: string,
): { vacated: Set<Square>; landed: Set<Square>; spawned: Set<Square> } => {
  const vacated = new Set<Square>();
  const landed = new Set<Square>();
  const spawned = new Set<Square>();
  const classical = /C=([a-h][1-8])([a-h][1-8])/.exec(queue);
  const from = squareNamed(classical?.[1]);
  const to = squareNamed(classical?.[2]);
  if (from && to) {
    vacated.add(from);
    landed.add(to);
  }
  for (const step of queue.matchAll(/[BF]=(?:pawnDouble|queenWarp):([a-h][1-8]):([a-h][1-8])/g)) {
    const left = squareNamed(step[1]);
    const arrived = squareNamed(step[2]);
    if (left) vacated.add(left);
    if (arrived) landed.add(arrived);
  }
  for (const spawn of queue.matchAll(/[BF]=spawn:[a-h][1-8]:([a-h][1-8])/g)) {
    const at = squareNamed(spawn[1]);
    if (at) spawned.add(at);
  }
  for (const sq of landed) vacated.delete(sq);
  return { vacated, landed, spawned };
};

const kingAfterMove = (
  map: Map<Square, ScPiece>,
  queue: string,
  viewer: StarChessColor,
): Square | null => {
  let king = findKing(map, viewer);
  const classical = /C=([a-h][1-8])([a-h][1-8])/.exec(queue);
  const from = squareNamed(classical?.[1]);
  const to = squareNamed(classical?.[2]);
  if (king && from === king && to) king = to;
  return king;
};

const adjacentTo = (king: Square, sq: Square): boolean => {
  const df = Math.abs(king.charCodeAt(0) - sq.charCodeAt(0));
  const dr = Math.abs(Number(king[1]) - Number(sq[1]));
  return df <= 1 && dr <= 1 && (df !== 0 || dr !== 0);
};

/**
 * Next forward deploy, g2 before h2. Beats gassing the marine that just moved:
 * with two gas, the first call is one square and the next call (after that
 * spawn is queued) is the other. Needs the Attack/Move already queued so the
 * push line still owns an open classical slot.
 */
export const forwardDeploySquare = (
  scfen: string,
  viewer: StarChessColor = "w",
): Square | null => {
  if (viewer !== "w") return null;
  if (whiteGas(scfen) < 1) return null;
  if ((storedMinerals(scfen, viewer) ?? 0) < UNIT_COST.p) return null;
  const queue = whiteQueue(scfen);
  if (!/C=/.test(queue)) return null;
  const map = placementMap(scfen);
  if (!map) return null;
  const king = kingAfterMove(map, queue, viewer);
  if (!king) return null;
  const { vacated, landed, spawned } = deployVacancies(queue);
  const mines = minesOf(scfen);
  for (const sq of FORWARD_DEPLOYS) {
    if (spawned.has(sq) || landed.has(sq) || hostileMineOn(mines, viewer, sq)) continue;
    if (!adjacentTo(king, sq)) continue;
    const occ = map.get(sq);
    if (occ && !vacated.has(sq)) continue;
    if (occ?.type === "k") continue;
    return sq;
  }
  return null;
};

/**
 * Gas-deploy a Marine onto g2, in place of the attacker that stands there,
 * while a Marine on h2 still has the classical Move. That Move is a double
 * step (h2–h4), which is the better spend. `open` means the Move is free;
 * `queued` means it is already the h2 step.
 */
export const g2Replacement = (
  scfen: string,
  viewer: StarChessColor = "w",
): "open" | "queued" | null => {
  if (viewer !== "w") return null;
  if (whiteGas(scfen) < 1) return null;
  if ((storedMinerals(scfen, viewer) ?? 0) < UNIT_COST.p) return null;
  if (g1GuardNeeded(scfen, viewer)) return null;
  const map = placementMap(scfen);
  if (!map) return null;
  const onH2 = map.get("h2");
  const onG2 = map.get("g2");
  if (onH2?.color !== viewer || onH2.type !== "p") return null;
  if (onG2?.color !== viewer || onG2.type !== "p") return null;
  for (const sq of ["e1", "f1", "g1"] as const) {
    const occ = map.get(sq);
    if (occ && occ.color !== viewer && (occ.type === "q" || occ.type === "r")) return null;
  }
  const queue = whiteQueue(scfen);
  if (/[BF]=spawn:[a-h][1-8]:g2/.test(queue) || /C=g2/.test(queue)) return null;
  const king = findKing(map, viewer);
  if (!king || !adjacentTo(king, "g2")) return null;
  if (hostileMineOn(minesOf(scfen), viewer, "g2")) return null;
  if (!/C=/.test(queue)) return "open";
  if (/C=h2h[34]/.test(queue)) return "queued";
  return null;
};

/**
 * Attack toward the last-seen Command Center. The g1 guard is defense, and so
 * is an enemy marine already on the last three ranks or a heavy piece sitting
 * on our back rank.
 */
export const offensePreferred = (scfen: string, viewer: StarChessColor = "w"): boolean => {
  if (g1GuardNeeded(scfen, viewer)) return false;
  const map = placementMap(scfen);
  if (!map) return false;
  const enemy = viewer === "w" ? "b" : "w";
  const back = viewer === "w" ? 1 : 8;
  const urgent = viewer === "w" ? 3 : 6;
  for (const [sq, piece] of map) {
    if (piece.color !== enemy) continue;
    const rank = Number(sq[1]);
    if (piece.type === "p" && (viewer === "w" ? rank <= urgent : rank >= urgent)) return false;
    if ((piece.type === "q" || piece.type === "r") && rank === back) return false;
  }
  return true;
};

/** White pawn on h7 can still promote this turn, and has not chosen a piece. */
export const promotionChoiceOpen = (scfen: string, viewer: StarChessColor = "w"): boolean => {
  if (viewer !== "w") return false;
  const map = placementMap(scfen);
  if (!map) return false;
  const pawn = map.get("h7");
  if (!pawn || pawn.color !== viewer || pawn.type !== "p") return false;
  const queue = whiteQueue(scfen);
  if (/C=h7h8|[BF]=pawnDouble:h7/.test(queue)) return false;
  if (whiteGas(scfen) >= 1) return true;
  return !/C=/.test(queue);
};

/**
 * Promoted BattleShip or Tank on h8, the Attack/Move is still open, and the
 * attack is the coaching choice.
 */
export const chargeFromH8 = (scfen: string, viewer: StarChessColor = "w"): boolean => {
  if (viewer !== "w" || !offensePreferred(scfen, viewer)) return false;
  if (/C=/.test(whiteQueue(scfen))) return false;
  const map = placementMap(scfen);
  if (!map) return false;
  const piece = map.get("h8");
  return !!piece && piece.color === viewer && (piece.type === "q" || piece.type === "r");
};

/** Packed Tank on h5 with a gas canister left and siege not already queued. */
export const tankSiegeOnH5 = (scfen: string, viewer: StarChessColor = "w"): boolean => {
  if (viewer !== "w" || whiteGas(scfen) < 1) return false;
  const map = placementMap(scfen);
  if (!map) return false;
  const piece = map.get("h5");
  if (!piece || piece.color !== viewer || piece.type !== "r") return false;
  if (/[BF]=rookSiege:h5/.test(whiteQueue(scfen))) return false;
  const siege = scfen.split("|").find((part) => part.startsWith("S:"));
  if (!siege) return true;
  const body = siege.slice(2);
  for (let i = 0; i + 1 < body.length; i += 2) {
    if (body.slice(i, i + 2) === "h5") return false;
  }
  return true;
};

/**
 * Where the white BattleShip is. `null` when the placement cannot be read, so
 * a mid-animation frame does not look like the ship just died.
 */
export const whiteQueenAtH8 = (
  scfen: string,
): { onH8: boolean; alive: boolean } | null => {
  const map = placementMap(scfen);
  if (!map) return null;
  let onH8 = false;
  let alive = false;
  for (const [sq, piece] of map) {
    if (piece.color !== "w" || piece.type !== "q") continue;
    alive = true;
    if (sq === "h8") onH8 = true;
  }
  return { onH8, alive };
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
