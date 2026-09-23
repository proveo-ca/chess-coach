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
 * A Mecha already stands on g2 and the Attack/Move is still open, so the
 * coaching beat is to aim that piece at the Command Center.
 */
export const mechaThreatOpen = (scfen: string, viewer: StarChessColor = "w"): boolean => {
  if (viewer !== "w") return false;
  if (/C=/.test(whiteQueue(scfen))) return false;
  const map = placementMap(scfen);
  if (!map) return false;
  const piece = map.get("g2");
  return !!piece && piece.color === viewer && piece.type === "b";
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

/** Empty g2, beside a Command Center on h1. Empty h2 stays empty — the h-file push outranks a deploy there. */
const FORWARD_DEPLOYS: readonly Square[] = ["g2"];

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
 * Deploy on empty g2 once the Attack/Move is queued, ahead of gassing the
 * marine. Empty h2 is left empty so that gas can push the h-file marine.
 * A square an ally still occupies is not a target — that deploy would crush it.
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

/** White pawn on h6 or h7 can still promote this turn, and has not chosen a piece. */
export const promotionChoiceOpen = (
  scfen: string,
  viewer: StarChessColor = "w",
): Square | null => {
  if (viewer !== "w") return null;
  const map = placementMap(scfen);
  if (!map) return null;
  const queue = whiteQueue(scfen);
  for (const sq of ["h7", "h6"] as const) {
    const pawn = map.get(sq);
    if (!pawn || pawn.color !== viewer || pawn.type !== "p") continue;
    if (new RegExp(`C=${sq}|[BF]=pawnDouble:${sq}`).test(queue)) continue;
    if (whiteGas(scfen) >= 1 || !/C=/.test(queue)) return sq;
  }
  return null;
};

/**
 * Promoted BattleShip or Tank on h8, the Attack/Move is still open, and no
 * enemy heavy is already on our back rank. A nearby enemy Marine does not
 * hide this beat — the charge arrows are how the player is shown the shot.
 */
export const chargeFromH8 = (scfen: string, viewer: StarChessColor = "w"): boolean => {
  if (viewer !== "w") return false;
  if (/C=/.test(whiteQueue(scfen))) return false;
  if (g1GuardNeeded(scfen, viewer)) return false;
  const map = placementMap(scfen);
  if (!map) return false;
  const piece = map.get("h8");
  if (!piece || piece.color !== viewer || (piece.type !== "q" && piece.type !== "r")) {
    return false;
  }
  const back = viewer === "w" ? "1" : "8";
  const enemy = viewer === "w" ? "b" : "w";
  for (const [sq, occ] of map) {
    if (occ.color !== enemy) continue;
    if ((occ.type === "q" || occ.type === "r") && sq[1] === back) return false;
  }
  return true;
};

const G2_DIAGONAL: readonly Square[] = ["f3", "e4", "d5", "c6", "b7", "a8"];
const G2_KNIGHT: readonly Square[] = ["e1", "e3", "f4", "h4", "c1", "c3"];

/**
 * Which unit the g2 gas-deploy beat should name. A Mecha when one eyes the
 * enemy Command Center (or another heavy) down g2–a8; a Hoverbike when a
 * knight leap from g2 is the contact instead; a Marine when 3 minerals
 * aren't banked.
 */
export const g2DeployName = (
  scfen: string,
  viewer: StarChessColor = "w",
): "Marine" | "Hoverbike" | "Mecha" => {
  if ((storedMinerals(scfen, viewer) ?? 0) < UNIT_COST.b) return "Marine";
  const map = placementMap(scfen);
  if (!map) return "Mecha";
  const enemy = viewer === "w" ? "b" : "w";
  const heavyThere = (squares: readonly Square[]) =>
    squares.some((sq) => {
      const piece = map.get(sq);
      return (
        !!piece &&
        piece.color === enemy &&
        (piece.type === "k" || piece.type === "q" || piece.type === "r")
      );
    });
  if (heavyThere(G2_DIAGONAL)) return "Mecha";
  if (heavyThere(G2_KNIGHT)) return "Hoverbike";
  return "Mecha";
};

const queuedOnto = (queue: string, square: Square): boolean =>
  new RegExp(`C=[a-h][1-8]${square}|[BF]=[A-Za-z]+:[a-h][1-8]:${square}`).test(queue);

/**
 * Arrow from the unit that stops an enemy Marine to that Marine. The most
 * advanced Marine on the last three ranks, skipped when a stop is already
 * queued or the h-file push is the open beat against the f3 Marine. A unit
 * that already attacks it wins; otherwise the nearest friendly unit, so the
 * line never asks the player to stop a Marine with no arrow.
 */
export const runnerStop = (
  scfen: string,
  viewer: StarChessColor = "w",
): { from: Square; to: Square } | null => {
  if (viewer !== "w") return null;
  const map = placementMap(scfen);
  if (!map) return null;
  const queue = whiteQueue(scfen);
  const pushingH = /C=h2h[34]/.test(queue);
  const runners: Square[] = [];
  for (const [sq, piece] of map) {
    if (piece.color !== "b" || piece.type !== "p") continue;
    if (Number(sq[1]) > 3) continue;
    if (pushingH && sq === "f3") continue;
    if (queuedOnto(queue, sq)) continue;
    runners.push(sq);
  }
  if (runners.length === 0) return null;
  runners.sort(
    (a, b) => Number(a[1]) - Number(b[1]) || a.charCodeAt(0) - b.charCodeAt(0),
  );
  const runner = runners[0]!;
  const prefer = (type: ScPiece["type"]) =>
    type === "p" ? 0 : type === "n" ? 1 : type === "b" ? 2 : type === "r" ? 3 : 4;
  const attackers: Square[] = [];
  for (const [sq, piece] of map) {
    if (piece.color !== viewer || piece.type === "k") continue;
    if (attacksSquare(map, sq, runner)) attackers.push(sq);
  }
  const pool =
    attackers.length > 0
      ? attackers
      : [...map.entries()]
          .filter(([, piece]) => piece.color === viewer && piece.type !== "k")
          .map(([sq]) => sq);
  if (pool.length === 0) return null;
  const dist = (sq: Square) =>
    Math.max(
      Math.abs(sq.charCodeAt(0) - runner.charCodeAt(0)),
      Math.abs(Number(sq[1]) - Number(runner[1])),
    );
  pool.sort((a, b) => {
    if (attackers.length > 0) {
      const byType = prefer(map.get(a)!.type) - prefer(map.get(b)!.type);
      if (byType !== 0) return byType;
    }
    const byDist = dist(a) - dist(b);
    if (byDist !== 0) return byDist;
    return b.charCodeAt(0) - a.charCodeAt(0);
  });
  return { from: pool[0]!, to: runner };
};

const squareSieged = (scfen: string, square: Square): boolean => {
  const siege = scfen.split("|").find((part) => part.startsWith("S:"));
  if (!siege) return false;
  const body = siege.slice(2);
  for (let i = 0; i + 1 < body.length; i += 2) {
    if (body.slice(i, i + 2) === square) return true;
  }
  return false;
};

const tankReadyToSiege = (
  map: Map<Square, ScPiece>,
  square: Square,
  viewer: StarChessColor,
  scfen: string,
  queue: string,
): boolean => {
  const piece = map.get(square);
  if (!piece || piece.color !== viewer || piece.type !== "r") return false;
  if (new RegExp(`[BF]=rookSiege:${square}`).test(queue)) return false;
  return !squareSieged(scfen, square);
};

/**
 * Where to drop Gas to siege a Tank. A queued slide onto d8 or h5 highlights
 * the Tank where it still stands. A Tank already on h5 highlights that square.
 * `null` when there is no gas, the piece is not a Tank, or siege is already on.
 */
export const tankSiegeSquare = (scfen: string, viewer: StarChessColor = "w"): Square | null => {
  if (viewer !== "w" || whiteGas(scfen) < 1) return null;
  const map = placementMap(scfen);
  if (!map) return null;
  const queue = whiteQueue(scfen);
  const classical = /C=([a-h][1-8])([a-h][1-8])/.exec(queue);
  if (classical && (classical[2] === "d8" || classical[2] === "h5")) {
    const from = classical[1] as Square;
    if (tankReadyToSiege(map, from, viewer, scfen, queue)) return from;
  }
  if (tankReadyToSiege(map, "h5", viewer, scfen, queue)) return "h5";
  return null;
};

/** A Tank can still be sieged with Gas this intent. */
export const tankSiegeOnH5 = (scfen: string, viewer: StarChessColor = "w"): boolean =>
  tankSiegeSquare(scfen, viewer) != null;

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
