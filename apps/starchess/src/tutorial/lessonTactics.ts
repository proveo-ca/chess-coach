// SPEC: _spec/apps/starchess/menu-flow.puml
import {
  attacksSquare,
  findCC,
  getSideVision,
  hostileMineOn,
  parseMinesExtra,
  placementToMap,
  UNIT_COST,
  type ScAction,
  type ScPiece,
  type StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type {
  AttackTrajectory,
  QueuedSpecial,
  SquareCoverer,
  SquareCovers,
  TutorialBoardArrow,
  TutorialBoardCondition,
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
 * Ally units that currently attack the enemy Command Center, wherever it
 * stands — a Mecha on its diagonal, a Marine a step away, anything with the
 * geometry, not a piece-type-specific check like {@link mechaThreatOpen}.
 */
export const ccPressureUnits = (
  scfen: string | undefined,
  viewer: StarChessColor = "w",
): { cc: Square; units: SquareCoverer[] } | null => {
  const map = scfen ? placementMap(scfen) : null;
  if (!map) return null;
  const enemy = viewer === "w" ? "b" : "w";
  const cc = findCC(map, enemy);
  if (!cc) return null;
  const units = attackersOfSquare(map, cc, viewer);
  return units.length > 0 ? { cc, units } : null;
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
  if (/[BF]=(?!deploy\b)[A-Za-z]/.test(queue)) return null;
  const map = placementMap(scfen);
  if (!map) return null;
  const from = /C=([a-h][1-8])/.exec(queue)?.[1] as Square | undefined;
  const fromPiece = from ? map.get(from) : undefined;
  const moverIsMarine = fromPiece?.color === viewer && fromPiece.type === "p";
  // The h-file push just spent its move — gas is the extra step on that marine.
  if (moverIsMarine && from![0] === "h") return from!;
  let best: Square | null = null;
  let bestRank = -1;
  let bestFile = -1;
  for (const [sq, piece] of map) {
    if (piece.color !== viewer || piece.type !== "p") continue;
    if (moverIsMarine && sq === from) continue;
    const rank = Number(sq[1]);
    const file = FILES.indexOf(sq[0]!);
    if (rank > bestRank || (rank === bestRank && file > bestFile)) {
      best = sq;
      bestRank = rank;
      bestFile = file;
    }
  }
  return best ?? (moverIsMarine ? from! : null);
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
  for (const step of queue.matchAll(/[BF]=(?:stimStep|tacticalJump):([a-h][1-8]):([a-h][1-8])/g)) {
    const left = squareNamed(step[1]);
    const arrived = squareNamed(step[2]);
    if (left) vacated.add(left);
    if (arrived) landed.add(arrived);
  }
  for (const spawn of queue.matchAll(/[BF]=deploy:[a-h][1-8]:([a-h][1-8])/g)) {
    const at = squareNamed(spawn[1]);
    if (at) spawned.add(at);
  }
  for (const sq of landed) vacated.delete(sq);
  return { vacated, landed, spawned };
};

const ccAfterMove = (
  map: Map<Square, ScPiece>,
  queue: string,
  viewer: StarChessColor,
): Square | null => {
  let commandCenter = findCC(map, viewer);
  const classical = /C=([a-h][1-8])([a-h][1-8])/.exec(queue);
  const from = squareNamed(classical?.[1]);
  const to = squareNamed(classical?.[2]);
  if (commandCenter && from === commandCenter && to) commandCenter = to;
  return commandCenter;
};

const adjacentTo = (commandCenter: Square, sq: Square): boolean => {
  const df = Math.abs(commandCenter.charCodeAt(0) - sq.charCodeAt(0));
  const dr = Math.abs(Number(commandCenter[1]) - Number(sq[1]));
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
  const commandCenter = ccAfterMove(map, queue, viewer);
  if (!commandCenter) return null;
  const { vacated, landed, spawned } = deployVacancies(queue);
  const mines = minesOf(scfen);
  for (const sq of FORWARD_DEPLOYS) {
    if (spawned.has(sq) || landed.has(sq) || hostileMineOn(mines, viewer, sq)) continue;
    if (!adjacentTo(commandCenter, sq)) continue;
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
    const marine = map.get(sq);
    if (!marine || marine.color !== viewer || marine.type !== "p") continue;
    if (new RegExp(`C=${sq}|[BF]=stimStep:${sq}`).test(queue)) continue;
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
const G2_HOVERBIKE: readonly Square[] = ["e1", "e3", "f4", "h4", "c1", "c3"];

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
  if (heavyThere(G2_HOVERBIKE)) return "Hoverbike";
  return "Mecha";
};

const queuedOnto = (queue: string, square: Square): boolean =>
  new RegExp(`C=[a-h][1-8]${square}|[BF]=[A-Za-z]+:[a-h][1-8]:${square}`).test(queue);

/**
 * Arrow from the unit that stops an enemy Marine to that Marine. Any file on
 * the last three ranks counts; the most advanced one wins, and a stop already
 * queued yields the next Marine. Only while the Attack/Move is still open —
 * a queued classical has spent the stop this beat asks for — and only against
 * a Marine the viewer can see: the coach does not read through fog. A unit
 * that already attacks it wins, otherwise the nearest friendly unit, and the
 * Command Center when nothing else is left — the line never asks the player
 * to stop a Marine with no arrow.
 */
export const runnerStop = (
  scfen: string,
  viewer: StarChessColor = "w",
): { from: Square; to: Square } | null => {
  if (viewer !== "w") return null;
  const map = placementMap(scfen);
  if (!map) return null;
  const queue = whiteQueue(scfen);
  if (/C=/.test(queue)) return null;
  const vision = getSideVision(map, viewer, {
    tankModeFor: (sq) => (squareSieged(scfen, sq) ? "siege" : "tank"),
    mines: minesOf(scfen),
  });
  const runners: Square[] = [];
  for (const [sq, piece] of map) {
    if (piece.color !== "b" || piece.type !== "p") continue;
    if (Number(sq[1]) > 3) continue;
    if (queuedOnto(queue, sq)) continue;
    if (!vision.litSquares.has(sq) && !vision.revealedPieces.has(sq)) continue;
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
  const allies = [...map.entries()]
    .filter(([, piece]) => piece.color === viewer && piece.type !== "k")
    .map(([sq]) => sq);
  const commandCenters = [...map.entries()]
    .filter(([, piece]) => piece.color === viewer && piece.type === "k")
    .map(([sq]) => sq);
  const pool = attackers.length > 0 ? attackers : allies.length > 0 ? allies : commandCenters;
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
  if (new RegExp(`[BF]=siegeMode:${square}`).test(queue)) return false;
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

/** Square of the viewer's BattleShip, wherever it jumped to. */
export const whiteBattleShipSquare = (scfen: string, viewer: StarChessColor = "w"): Square | null => {
  const map = placementMap(scfen);
  if (!map) return null;
  for (const [sq, piece] of map) {
    if (piece.color === viewer && piece.type === "q") return sq;
  }
  return null;
};

/**
 * Where the white BattleShip is. `null` when the placement cannot be read, so
 * a mid-animation frame does not look like the ship just died.
 */
export const whiteBattleShipAtH8 = (
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

/** Elbow of a knight hop, long leg first — the convention the hint arrows use. */
export const hoverbikeVia = (from: Square, to: Square): Square | undefined => {
  const df = to.charCodeAt(0) - from.charCodeAt(0);
  const dr = Number(to[1]) - Number(from[1]);
  const adf = Math.abs(df);
  const adr = Math.abs(dr);
  if (!((adf === 1 && adr === 2) || (adf === 2 && adr === 1))) return undefined;
  return (adr === 2 ? `${from[0]}${to[1]}` : `${to[0]}${from[1]}`) as Square;
};

/** Intents that carry their unit to `to` — the rest aim at it (snipe, deploy). */
const RELOCATES: ReadonlySet<ScAction["kind"]> = new Set(["classical", "tacticalJump", "stimStep"]);

/**
 * One arrow per intent that travels (`from → to`), for replaying a past turn.
 * Guide green by default; alert red is reserved for checks, read on the board
 * after every relocating intent of the turn has landed: the mover then attacks
 * the enemy Command Center, or the mover *is* a Command Center stepping onto a
 * square the enemy attacks. Stationary specials (siege, mine) draw nothing.
 */
export const intentArrows = (
  placement: string,
  actions: readonly ScAction[],
): TutorialBoardArrow[] => {
  let map: Map<Square, ScPiece>;
  try {
    map = placementToMap(placement);
  } catch {
    return [];
  }
  const after = new Map(map);
  for (const a of actions) {
    if (!a.to || !RELOCATES.has(a.kind)) continue;
    const piece = after.get(a.from);
    if (!piece) continue;
    after.delete(a.from);
    after.set(a.to, piece);
  }
  const checks = (a: ScAction & { to: Square }): boolean => {
    const mover = after.get(a.to);
    if (!mover || mover.color !== a.color) return false;
    if (mover.type === "k") {
      for (const [sq, piece] of after) {
        if (piece.color !== a.color && attacksSquare(after, sq, a.to)) return true;
      }
      return false;
    }
    const commandCenter = findCC(after, a.color === "w" ? "b" : "w");
    return !!commandCenter && attacksSquare(after, a.to, commandCenter);
  };
  const out: TutorialBoardArrow[] = [];
  for (const a of actions) {
    if (!a.to || a.to === a.from) continue;
    const moving = a as ScAction & { to: Square };
    const via = map.get(a.from)?.type === "n" ? hoverbikeVia(a.from, a.to) : undefined;
    out.push({
      from: a.from,
      to: a.to,
      ...(via ? { via } : {}),
      ...(checks(moving) ? { tone: "alert" as const } : {}),
    });
  }
  return out;
};

const HOVERBIKE_HOPS: readonly (readonly [number, number])[] = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

/**
 * The Hoverbike's closing picture: two or more of our Spider Mines down, and
 * the Hoverbike that laid them. `files` counts every file a mine or a hop
 * square sits on — the promotion lanes that one unit now watches.
 */
export const mineGuard = (
  scfen: string,
  viewer: StarChessColor = "w",
): { mines: Square[]; hops: TutorialBoardArrow[]; files: number } | null => {
  const mines = minesOf(scfen)
    .filter((m) => m.color === viewer)
    .map((m) => m.at);
  if (mines.length < 2) return null;
  const map = placementMap(scfen);
  if (!map) return null;
  const hoverbike = [...map.entries()].find(
    ([, piece]) => piece.color === viewer && piece.type === "n",
  )?.[0];
  if (!hoverbike) return null;
  const hops: TutorialBoardArrow[] = [];
  for (const [df, dr] of HOVERBIKE_HOPS) {
    const f = FILES.indexOf(hoverbike[0]!) + df;
    const r = Number(hoverbike[1]) + dr;
    if (f < 0 || f > 7 || r < 1 || r > 8) continue;
    const to = `${FILES[f]}${r}` as Square;
    if (map.get(to)?.color === viewer) continue;
    hops.push({ from: hoverbike, to, via: hoverbikeVia(hoverbike, to) });
  }
  const files = new Set([...mines, ...hops.map((h) => h.to)].map((sq) => sq[0]));
  return { mines, hops, files: files.size };
};

/** Tactical Jump costs all three canisters. */
const WARP_GAS = 3;

const chebyshev = (a: Square, b: Square): number =>
  Math.max(
    Math.abs(a.charCodeAt(0) - b.charCodeAt(0)),
    Math.abs(Number(a[1]) - Number(b[1])),
  );

/**
 * Where the viewer's BattleShip should jump next, read from wherever it
 * stands now. A landing must be lit and empty (Tactical Jump's own rule) and
 * attacked by nothing the enemy has on the board once the ship is there. Among
 * those, a square that re-checks the enemy Command Center wins; ties go to the
 * one furthest from that Command Center, then nearest the ship. `null` while a
 * jump is already queued, the three canisters are not there, or either
 * Command Center is gone.
 */
export const shipJuke = (
  scfen: string,
  viewer: StarChessColor = "w",
): { from: Square; to: Square } | null => {
  if (viewer !== "w" || whiteGas(scfen) < WARP_GAS) return null;
  if (/tacticalJump:/.test(whiteQueue(scfen))) return null;
  const map = placementMap(scfen);
  if (!map) return null;
  const from = whiteBattleShipSquare(scfen, viewer);
  if (!from) return null;
  const enemy = viewer === "w" ? "b" : "w";
  const enemyCC = findCC(map, enemy);
  // Either Command Center gone: the game is over, nothing left to juke.
  if (!enemyCC || !findCC(map, viewer)) return null;
  const vision = getSideVision(map, viewer, {
    tankModeFor: (sq) => (squareSieged(scfen, sq) ? "siege" : "tank"),
    mines: minesOf(scfen),
  });
  const ship = map.get(from)!;
  let best: { to: Square; checks: boolean; far: number; near: number } | null = null;
  for (const to of vision.litSquares) {
    if (to === from || map.has(to)) continue;
    const after = new Map(map);
    after.delete(from);
    after.set(to, ship);
    let attacked = false;
    for (const [sq, piece] of after) {
      if (piece.color === enemy && attacksSquare(after, sq, to)) {
        attacked = true;
        break;
      }
    }
    if (attacked) continue;
    const cand = {
      to,
      checks: attacksSquare(after, to, enemyCC),
      far: chebyshev(to, enemyCC),
      near: chebyshev(to, from),
    };
    if (
      !best ||
      (cand.checks !== best.checks
        ? cand.checks
        : cand.far !== best.far
          ? cand.far > best.far
          : cand.near !== best.near
            ? cand.near < best.near
            : cand.to < best.to)
    ) {
      best = cand;
    }
  }
  return best ? { from, to: best.to } : null;
};

const BOARD_CONDITION_KINDS: ReadonlySet<string> = new Set(["lives", "lost", "board"]);

export const isBoardCondition = (when: { kind: string }): when is TutorialBoardCondition =>
  BOARD_CONDITION_KINDS.has(when.kind);

const specialQueued = (queue: string, { kind, from }: QueuedSpecial): boolean =>
  new RegExp(`[BF]=${kind}:${from}(?=[:,]|$)`).test(queue);

/** True when the live SCFEN satisfies a named board condition. */
export const boardConditionHolds = (when: TutorialBoardCondition, scfen: string): boolean => {
  if (when.kind === "lives") {
    const lives = scfen.split("|")[3] ?? "";
    if (when.own != null && Number(lives[0]) !== when.own) return false;
    if (when.enemy != null && Number(lives[1]) !== when.enemy) return false;
    return /^\d\d$/.test(lives);
  }
  if (when.kind === "lost") {
    const placement = scfen.split("|")[1];
    return placement != null && when.pieces.every((p) => !placement.includes(p));
  }
  const map = placementMap(scfen);
  if (!map) return false;
  for (const [sq, letter] of Object.entries(when.at)) {
    const piece = map.get(sq as Square);
    const color = letter === letter.toUpperCase() ? "w" : "b";
    if (piece?.type !== letter.toLowerCase() || piece.color !== color) return false;
  }
  const queue = whiteQueue(scfen);
  if (when.queued && !specialQueued(queue, when.queued)) return false;
  if (when.notQueued && specialQueued(queue, when.notQueued)) return false;
  if (when.notQueuedOnto && queuedOnto(queue, when.notQueuedOnto)) return false;
  return true;
};
