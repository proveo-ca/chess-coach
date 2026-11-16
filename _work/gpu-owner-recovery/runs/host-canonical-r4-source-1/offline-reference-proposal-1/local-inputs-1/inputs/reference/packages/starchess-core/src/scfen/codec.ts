/**
 * StarChess FEN dialect (StarChess-only). Classic FEN is a one-way render export —
 * never the rules oracle.
 * // SPEC: _spec/packages/starchess-core/scfen-wire.puml, _spec/packages/starchess-core/scfen-queue.puml, _spec/apps/starchess/core/scfen/document.puml
 * Wire / tickets: STARCHESS_FEN.md
 */

import type { Square } from "chess.js";

import { toClassicFen } from "../board/classicFen";
import { energyForTurn } from "../rules/constants";
import {
  assertMineCap,
  formatMinesExtra,
  parseMinesExtra,
} from "../board/mines";
import type { StarChessColor, ScPhaseCode, ScSpecialKind } from "../model/types";
import type {
  PieceColor,
  ScAction,
  ScFenError,
  ScFenSnapshot,
  ScPendingCCShot,
  ScTurnQueue,
  SpawnPiece,
} from "../model/types";
import { specialGasCost } from "../rules/specials/registry";
import { currentKind } from "./legacyKinds";

export type { ScPhaseCode, ScFenSnapshot, ScAction, ScTurnQueue, ScFenError };
export { toClassicFen, specialGasCost };

/**
 * Exactly one white `K` and one black `k` in placement — SCFEN invariant.
 * (`includes("K") && includes("k")` is too weak: it allows `KKk` / duplicates.)
 */
export const hasExactCCPair = (placement: string): boolean => {
  let w = 0;
  let b = 0;
  for (const ch of placement) {
    if (ch === "K") w += 1;
    else if (ch === "k") b += 1;
  }
  return w === 1 && b === 1;
};

const PHASE_OK = new Set<ScPhaseCode>(["P", "B", "A", "M", "F", "O"]);
const SQ_RE = /^[a-h][1-8]$/;
const SPECIAL_KINDS = new Set<ScSpecialKind>([
  "deploy",
  "stimStep",
  "spiderMine",
  "charonMissiles",
  "siegeMode",
  "tacticalJump",
]);
const PROMOS = new Set<SpawnPiece>(["q", "r", "b", "n"]);
const UNITS = new Set<SpawnPiece>(["p", "q", "r", "b", "n"]);

/** Classic FEN for ChessBoard / chess.js load — re-exported from core above. */

/** Planning snap from a classic placement (live `/starchess` seed). */
export const snapFromPlacement = (
  placement: string,
  turn = 1,
  ccLives: ScFenSnapshot["ccLives"] = { w: 3, b: 3 },
): ScFenSnapshot => {
  const income = energyForTurn(Math.max(1, turn));
  return {
    placement,
    turn,
    ccLives: { ...ccLives },
    phase: "P",
    gas: { w: income, b: income },
    gasIncome: { w: income, b: income },
    queue: { actions: [] },
  };
};

/** Pack specials-used squares for the SCFEN `U:` extras field. */
export const formatSpecialsUsedExtra = (squares: readonly Square[]): string | null => {
  if (squares.length === 0) return null;
  const uniq = [...new Set(squares)].filter((s) => SQ_RE.test(s)).sort();
  if (uniq.length === 0) return null;
  return `U:${uniq.join("")}`;
};

/** Parse `U:a1c4…` (and ignore unknown extras). */
export const parseSpecialsUsedExtra = (extra: string | undefined): Square[] => {
  if (!extra || !extra.startsWith("U:")) return [];
  const body = extra.slice(2);
  const out: Square[] = [];
  for (let i = 0; i + 1 < body.length; i += 2) {
    const sq = body.slice(i, i + 2);
    if (SQ_RE.test(sq)) out.push(sq as Square);
  }
  return out;
};

/** Pack sieged-tank squares for the SCFEN `S:` extras field. */
export const formatSiegedTanksExtra = (squares: readonly Square[]): string | null => {
  if (squares.length === 0) return null;
  const uniq = [...new Set(squares)].filter((s) => SQ_RE.test(s)).sort();
  if (uniq.length === 0) return null;
  return `S:${uniq.join("")}`;
};

/** Parse `S:c3f7…` sieged Siege Tank squares. */
export const parseSiegedTanksExtra = (extra: string | undefined): Square[] => {
  if (!extra || !extra.startsWith("S:")) return [];
  const body = extra.slice(2);
  const out: Square[] = [];
  for (let i = 0; i + 1 < body.length; i += 2) {
    const sq = body.slice(i, i + 2);
    if (SQ_RE.test(sq)) out.push(sq as Square);
  }
  return out;
};

const PIECE_OK = new Set(["p", "n", "b", "r", "q", "k"]);

/** Pack pending cc-checks for the SCFEN `H:` extras field. */
export const formatPendingCCShotsExtra = (
  shots: readonly ScPendingCCShot[],
): string | null => {
  if (shots.length === 0) return null;
  const parts = shots.map((s) => `${s.color}:${s.piece}:${s.from}${s.to}`);
  return `H:${parts.join(";")}`;
};

/**
 * Parse `H:b:n:c5e4` (`;`-separated hits). Attacker color, piece, from+to.
 */
export const parsePendingCCShotsExtra = (
  extra: string | undefined,
): ScPendingCCShot[] => {
  if (!extra || !extra.startsWith("H:")) return [];
  const body = extra.slice(2);
  if (!body) return [];
  const out: ScPendingCCShot[] = [];
  for (const part of body.split(";")) {
    const m = /^([wb]):([pnbrqk]):([a-h][1-8])([a-h][1-8])$/.exec(part);
    if (!m) {
      throw Object.assign(new Error(`Invalid SCFEN H: hit: ${part}`), { code: "SC_SCHEMA" });
    }
    const piece = m[2]!;
    if (!PIECE_OK.has(piece)) {
      throw Object.assign(new Error(`Invalid SCFEN H: piece: ${piece}`), { code: "SC_SCHEMA" });
    }
    out.push({
      color: m[1] as PieceColor,
      piece: piece as ScPendingCCShot["piece"],
      from: m[3] as Square,
      to: m[4] as Square,
    });
  }
  return out;
};

const formatGasField = (snap: ScFenSnapshot): string =>
  `G:${snap.gas.w}${snap.gas.b}:${snap.gasIncome.w}${snap.gasIncome.b}`;

/** Mineral bank extras — `B:<wStored>:<bStored>` (0–12 each). */
const formatStoredField = (stored: NonNullable<ScFenSnapshot["stored"]>): string =>
  `B:${stored.w}:${stored.b}`;

const parseStoredField = (raw: string): NonNullable<ScFenSnapshot["stored"]> => {
  const m = /^B:(\d{1,2}):(\d{1,2})$/.exec(raw);
  if (!m) {
    throw Object.assign(new Error(`Invalid SCFEN B: field: ${raw}`), { code: "SC_SCHEMA" });
  }
  const w = Number(m[1]);
  const b = Number(m[2]);
  if (w > 12 || b > 12) {
    throw Object.assign(new Error(`SCFEN B: out of range (max 12): ${raw}`), {
      code: "SC_SCHEMA",
    });
  }
  return { w, b };
};

const formatAction = (a: ScAction): string => {
  if (a.timing === "C") {
    const promo = a.promotion ?? "";
    return `C=${a.from}${a.to}${promo}`;
  }
  const to = a.to ? `:${a.to}` : "";
  const unit = a.unit ? `:${a.unit}` : "";
  const promo =
    a.kind === "stimStep" && a.promotion && !a.unit ? `:${a.promotion}` : "";
  return `${a.timing}=${a.kind}:${a.from}${to}${unit}${promo}`;
};

const formatSideQueue = (color: PieceColor, actions: readonly ScAction[]): string => {
  const side = actions
    .filter((a) => a.color === color)
    .slice()
    .sort((a, b) => a.seq - b.seq);
  return `${color}:${side.map(formatAction).join(",")}`;
};

export const formatQueueField = (queue: ScTurnQueue): string =>
  `Q:${formatSideQueue("w", queue.actions)};${formatSideQueue("b", queue.actions)}`;

const parseSquare = (raw: string, label: string): Square => {
  if (!SQ_RE.test(raw)) throw Object.assign(new Error(`Invalid SCFEN ${label}: ${raw}`), { code: "SC_SCHEMA" });
  return raw as Square;
};

const parseOneAction = (raw: string, color: PieceColor, seq: number): ScAction => {
  if (raw.startsWith("C=")) {
    const body = raw.slice(2);
    const from = parseSquare(body.slice(0, 2), "from");
    const to = parseSquare(body.slice(2, 4), "to");
    const promoRaw = body.slice(4);
    if (promoRaw && !PROMOS.has(promoRaw as SpawnPiece)) {
      throw Object.assign(new Error(`Invalid SCFEN promotion: ${promoRaw}`), { code: "SC_QUEUE_SHAPE" });
    }
    return {
      timing: "C",
      kind: "classical",
      color,
      from,
      to,
      ...(promoRaw ? { promotion: promoRaw as SpawnPiece } : {}),
      seq,
    };
  }
  const m = /^(B|F)=([a-zA-Z]+):([a-h][1-8])(?::([a-h][1-8]))?(?::([pqrbn]))?$/.exec(raw);
  if (!m) {
    throw Object.assign(new Error(`Invalid SCFEN action: ${raw}`), { code: "SC_QUEUE_SHAPE" });
  }
  const timing = m[1] as "B" | "F";
  // Older saves wrote the chess names (`mechaSnipe`, `spawn`, …).
  const kind = currentKind(m[2]!) as ScSpecialKind;
  if (!SPECIAL_KINDS.has(kind)) {
    throw Object.assign(new Error(`Unknown SCFEN special kind: ${kind}`), { code: "SC_QUEUE_SHAPE" });
  }
  const from = m[3] as Square;
  const to = m[4] as Square | undefined;
  const pieceRaw = m[5] as SpawnPiece | undefined;
  if (pieceRaw && !UNITS.has(pieceRaw)) {
    throw Object.assign(new Error(`Invalid SCFEN unit: ${pieceRaw}`), { code: "SC_QUEUE_SHAPE" });
  }
  if (kind === "stimStep" && pieceRaw) {
    return {
      timing,
      kind,
      color,
      from,
      ...(to ? { to } : {}),
      promotion: pieceRaw,
      seq,
    };
  }
  return {
    timing,
    kind,
    color,
    from,
    ...(to ? { to } : {}),
    ...(pieceRaw ? { unit: pieceRaw } : {}),
    seq,
  };
};

/** Parse `Q:w:…;b:…` into a turn queue. Throws on shape violations. */
export const parseQueueField = (raw: string): ScTurnQueue => {
  if (!raw.startsWith("Q:")) {
    throw Object.assign(new Error(`Invalid SCFEN queue (expected Q:): ${raw}`), { code: "SC_SCHEMA" });
  }
  const body = raw.slice(2);
  const semi = body.indexOf(";");
  if (semi < 0) {
    throw Object.assign(new Error(`Invalid SCFEN queue (missing ';'): ${raw}`), { code: "SC_QUEUE_SHAPE" });
  }
  const left = body.slice(0, semi);
  const right = body.slice(semi + 1);
  const parseSide = (sideRaw: string, expect: PieceColor): ScAction[] => {
    if (!sideRaw.startsWith(`${expect}:`)) {
      throw Object.assign(new Error(`Invalid SCFEN side queue: ${sideRaw}`), { code: "SC_QUEUE_SHAPE" });
    }
    const actionsRaw = sideRaw.slice(2);
    if (!actionsRaw) return [];
    return actionsRaw.split(",").filter(Boolean).map((a, i) => parseOneAction(a, expect, i));
  };
  const w = parseSide(left, "w");
  const b = parseSide(right, "b");
  // Reassign global seq: w wire order then b (local seq was per-side).
  let seq = 0;
  const actions: ScAction[] = [
    ...w.map((a) => ({ ...a, seq: seq++ })),
    ...b.map((a) => ({ ...a, seq: seq++ })),
  ];
  assertQueueShape(actions);
  return { actions };
};

const actionsFor = (actions: readonly ScAction[], color: PieceColor) =>
  actions.filter((a) => a.color === color);

export const assertQueueShape = (actions: readonly ScAction[]): void => {
  for (const color of ["w", "b"] as const) {
    const side = actionsFor(actions, color);
    const classical = side.filter((a) => a.timing === "C");
    if (classical.length > 1) {
      throw Object.assign(
        new Error(`SCFEN queue: at most one C per side (${color} has ${classical.length})`),
        { code: "SC_QUEUE_SHAPE" as const },
      );
    }
    /*
     * One special per unit per turn. A side may still special several *different*
     * units, and may still put a special before (B) or after (F) its classical —
     * what it may not do is give one unit two of them.
     *
     * `from` is the unit's identity for both timings: an F on a unit that also
     * moves this turn records the *pre*-classical square and resolves on the
     * post-C one (see `queueMultiSpecial` "F specials resolve on post-C square"),
     * so B and F on one unit share a key without tracking the move.
     */
    const specialed = new Set<string>();
    for (const a of side) {
      if (a.timing === "C") continue;
      if (specialed.has(a.from)) {
        throw Object.assign(
          new Error(
            `SCFEN queue: one special per unit (${color} stacks two on ${a.from})`,
          ),
          { code: "SC_QUEUE_SHAPE" as const },
        );
      }
      specialed.add(a.from);
    }
  }
};

/** Queue special gas spend per side (classical is free). */
export const queueGasSpent = (
  actions: readonly { timing: string; color: PieceColor; kind: string }[] | undefined,
): Record<PieceColor, number> => {
  const spent: Record<PieceColor, number> = { w: 0, b: 0 };
  for (const a of actions ?? []) {
    if (a.timing === "C") continue;
    spent[a.color as PieceColor] += specialGasCost(a.kind as Parameters<typeof specialGasCost>[0]);
  }
  return spent;
};

/**
 * Align `gasIncome` to {@link energyForTurn} and clamp remaining so rem+spent ≤ tier.
 * Used for legacy history plies that advanced `turn` without restamping income.
 */
export const normalizeSnapGas = (snap: ScFenSnapshot): ScFenSnapshot => {
  const tier = energyForTurn(snap.turn);
  const spent = queueGasSpent(snap.queue?.actions);
  const gasIncome = { w: tier, b: tier };
  const gas = {
    w: Math.max(0, Math.min(snap.gas.w, Math.max(0, tier - spent.w))),
    b: Math.max(0, Math.min(snap.gas.b, Math.max(0, tier - spent.b))),
  };
  if (
    gas.w === snap.gas.w &&
    gas.b === snap.gas.b &&
    snap.gasIncome.w === tier &&
    snap.gasIncome.b === tier
  ) {
    return snap;
  }
  return { ...snap, gas, gasIncome };
};

/**
 * Gas conservation for a planning snap whose `gas` is remaining **after**
 * queue spends: spent + remaining ≤ income, and spent ≤ income.
 * Income must match the turn tier (`energyForTurn`) — gas does not bank across turns.
 */
export const assertQueueGas = (
  snap: Pick<ScFenSnapshot, "turn" | "gas" | "gasIncome" | "queue">,
): void => {
  const tier = energyForTurn(snap.turn);
  const spent = queueGasSpent(snap.queue?.actions);
  for (const color of ["w", "b"] as const) {
    const rem = snap.gas[color];
    const inc = snap.gasIncome[color];
    if (rem < 0 || rem > 9 || inc < 0 || inc > 9) {
      throw Object.assign(new Error(`SCFEN gas: out of range for ${color}`), { code: "SC_GAS" as const });
    }
    if (inc !== tier) {
      throw Object.assign(
        new Error(
          `SCFEN gas: ${color} income ${inc} != turn tier ${tier} (turn ${snap.turn}; gas does not accumulate)`,
        ),
        { code: "SC_GAS" as const },
      );
    }
    if (spent[color] > inc) {
      throw Object.assign(
        new Error(`SCFEN gas: ${color} specials cost ${spent[color]} but income is ${inc}`),
        { code: "SC_GAS" as const },
      );
    }
    if (rem + spent[color] > inc) {
      throw Object.assign(
        new Error(
          `SCFEN gas: ${color} remaining ${rem} + spent ${spent[color]} exceeds income ${inc}`,
        ),
        { code: "SC_GAS" as const },
      );
    }
  }
};

const parseGasField = (raw: string): { gas: ScFenSnapshot["gas"]; gasIncome: ScFenSnapshot["gasIncome"] } => {
  const m = /^G:([0-9])([0-9]):([0-9])([0-9])$/.exec(raw);
  if (!m) {
    throw Object.assign(new Error(`Invalid SCFEN G: field: ${raw}`), { code: "SC_SCHEMA" });
  }
  return {
    gas: { w: Number(m[1]), b: Number(m[2]) },
    gasIncome: { w: Number(m[3]), b: Number(m[4]) },
  };
};

export const formatScFen = (snap: ScFenSnapshot): string => {
  const {
    placement,
    turn,
    ccLives,
    phase,
    specialsUsed,
    queue,
    mines,
    siegedTanks,
    pendingCCShots,
    stored,
  } = snap;
  let s = `SCFEN|${placement}|${turn}|${ccLives.w}${ccLives.b}|${phase}|${formatGasField(snap)}`;
  if (stored) s += `|${formatStoredField(stored)}`;
  if (queue) s += `|${formatQueueField(queue)}`;
  const used = formatSpecialsUsedExtra(specialsUsed ?? []);
  if (used) s += `|${used}`;
  const siegeField = formatSiegedTanksExtra(siegedTanks ?? []);
  if (siegeField) s += `|${siegeField}`;
  const hits = formatPendingCCShotsExtra(pendingCCShots ?? []);
  if (hits) s += `|${hits}`;
  const mineField = formatMinesExtra(mines ?? []);
  if (mineField) s += `|${mineField}`;
  return s;
};

export type ParseScFenOptions = {
  /**
   * Repair gasIncome to the turn tier and clamp remaining (legacy history plies
   * that advanced `turn` without restamping `G:` income).
   */
  repairGas?: boolean;
};

export const parseScFen = (raw: string, opts?: ParseScFenOptions): ScFenSnapshot => {
  const parts = raw.trim().split("|");
  if (parts[0] !== "SCFEN" || parts.length < 6) {
    throw Object.assign(new Error(`Invalid SCFEN (expected SCFEN|…|G:…): ${raw.slice(0, 64)}`), {
      code: "SC_SCHEMA",
    });
  }
  const placement = parts[1]!;
  const turn = Number(parts[2]);
  const lives = parts[3]!;
  const phase = parts[4] as ScPhaseCode;
  if (!Number.isFinite(turn) || turn < 0) {
    throw Object.assign(new Error(`Invalid SCFEN turn: ${parts[2]}`), { code: "SC_SCHEMA" });
  }
  if (!/^[0-3]{2}$/.test(lives)) {
    throw Object.assign(new Error(`Invalid SCFEN lives: ${lives}`), { code: "SC_SCHEMA" });
  }
  if (!PHASE_OK.has(phase)) {
    throw Object.assign(new Error(`Invalid SCFEN phase: ${phase}`), { code: "SC_PHASE" });
  }
  if (placement.split("/").length !== 8) {
    throw Object.assign(new Error(`Invalid SCFEN placement ranks: ${placement}`), {
      code: "SC_PLACEMENT",
    });
  }
  if (!hasExactCCPair(placement)) {
    throw Object.assign(
      new Error(
        `Invalid SCFEN placement (need exactly 1 Command Center per player): ${placement}`,
      ),
      { code: "SC_PLACEMENT" },
    );
  }

  let gasField: string | undefined;
  let storedField: string | undefined;
  let queueField: string | undefined;
  let usedField: string | undefined;
  let minesField: string | undefined;
  let siegeField: string | undefined;
  let hitsField: string | undefined;
  for (let i = 5; i < parts.length; i++) {
    const p = parts[i]!;
    if (p.startsWith("G:")) gasField = p;
    else if (p.startsWith("B:")) storedField = p;
    else if (p.startsWith("Q:")) queueField = p;
    else if (p.startsWith("U:")) usedField = p;
    else if (p.startsWith("S:")) siegeField = p;
    else if (p.startsWith("H:")) hitsField = p;
    else if (p.startsWith("M:")) minesField = p;
    else {
      throw Object.assign(new Error(`Unknown SCFEN extras field: ${p}`), { code: "SC_SCHEMA" });
    }
  }
  if (!gasField) {
    throw Object.assign(new Error("Invalid SCFEN: missing required G: field"), { code: "SC_SCHEMA" });
  }
  const { gas, gasIncome } = parseGasField(gasField);
  const stored = storedField ? parseStoredField(storedField) : undefined;
  const queue = queueField ? parseQueueField(queueField) : undefined;
  if (queue && phase !== "P" && phase !== "O") {
    throw Object.assign(new Error(`SCFEN queue only allowed on phase P/O (got ${phase})`), {
      code: "SC_QUEUE_SHAPE",
    });
  }
  const specialsUsed = parseSpecialsUsedExtra(usedField);
  const siegedTanks = parseSiegedTanksExtra(siegeField);
  const pendingCCShots = parsePendingCCShotsExtra(hitsField);
  const mines = parseMinesExtra(minesField);
  for (const color of ["w", "b"] as const) assertMineCap(mines, color);
  const snap: ScFenSnapshot = {
    placement,
    turn,
    ccLives: { w: Number(lives[0]), b: Number(lives[1]) },
    phase,
    gas,
    gasIncome,
    ...(stored ? { stored } : {}),
    ...(queue ? { queue } : {}),
    ...(specialsUsed.length ? { specialsUsed } : {}),
    ...(siegedTanks.length ? { siegedTanks } : {}),
    ...(pendingCCShots.length ? { pendingCCShots } : {}),
    ...(mines.length ? { mines } : {}),
  };
  // A destroyed Command Center ends the match: the turn bails out in the check phase, so a
  // 0-HP side can never sit in a playable snapshot. Reject authored / corrupted
  // input that would let a dead Command Center keep fighting.
  if ((snap.ccLives.w === 0 || snap.ccLives.b === 0) && phase !== "O") {
    throw Object.assign(
      new Error(
        `Invalid SCFEN: Command Center at 0 HP requires phase O (got ${phase}, lives ${lives})`,
      ),
      { code: "SC_SCHEMA" },
    );
  }
  const fixed = opts?.repairGas ? normalizeSnapGas(snap) : snap;
  // Always enforce turn-tier income + rem ≤ income (even snapshot-only / empty Q).
  assertQueueGas(fixed);
  return fixed;
};

export const validateScFen = (
  raw: string,
): { ok: true; snap: ScFenSnapshot } | { ok: false; error: ScFenError } => {
  try {
    const snap = parseScFen(raw);
    return { ok: true, snap };
  } catch (e) {
    const err = e as Error & { code?: ScFenError["code"] };
    return {
      ok: false,
      error: {
        code: err.code ?? "SC_SCHEMA",
        message: err.message,
      },
    };
  }
};

/** Classic FEN string from a SCFEN snapshot (render adapter). */
export const classicFenFromSc = (
  snap: ScFenSnapshot,
  sideToMove: StarChessColor = "w",
): string => toClassicFen(snap.placement, sideToMove, 0, Math.max(1, snap.turn));
