/**
 * StarChess FEN dialect (StarChess-only). Classic FEN is a one-way render export —
 * never the rules oracle.
 * // SPEC: _spec/apps/ui/starchess/scfen-wire.puml, _spec/apps/ui/starchess/scfen-queue.puml
 * Wire / tickets: STARCHESS_FEN.md
 */

import type { Square } from "chess.js";

import { endScTurn } from "~/starchess/endScTurn";
import { energyForTurn } from "~/starchess/constants";
import {
  assertMineCap,
  formatMinesExtra,
  parseMinesExtra,
} from "~/starchess/mines";
import type { StarChessColor, ScPhaseCode, SpecialKind } from "~/starchess/types";
import type {
  PieceColor,
  ScAction,
  ScFenError,
  ScFenSnapshot,
  ScPendingKingShot,
  ScSpecialKind,
  ScTurnQueue,
  SpawnPiece,
} from "~/starchess/types";

export type { ScPhaseCode, ScFenSnapshot, ScAction, ScTurnQueue, ScFenError };

/**
 * Exactly one white `K` and one black `k` in placement — SCFEN invariant.
 * (`includes("K") && includes("k")` is too weak: it allows `KKk` / duplicates.)
 */
export const hasExactKingPair = (placement: string): boolean => {
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
  "spawn",
  "pawnDouble",
  "knightMine",
  "bishopSnipe",
  "rookSiege",
  "queenWarp",
]);
const PROMOS = new Set<SpawnPiece>(["q", "r", "b", "n"]);
const UNITS = new Set<SpawnPiece>(["p", "q", "r", "b", "n"]);

/** Gas burned when queueing a special (Charon / Tactical Jump = 2). */
export const specialGasCost = (kind: ScSpecialKind | SpecialKind): number =>
  kind === "bishopSnipe" || kind === "queenWarp" ? 2 : 1;

/** Classic FEN for ChessBoard / chess.js load (always both kings in placement). */
export const toClassicFen = (
  placement: string,
  sideToMove: StarChessColor = "w",
  halfmove = 0,
  fullmove = 1,
): string => `${placement} ${sideToMove} - - ${halfmove} ${fullmove}`;

/** Planning snap from a classic placement (live `/starchess` seed). */
export const snapFromPlacement = (
  placement: string,
  turn = 1,
  kingLives: ScFenSnapshot["kingLives"] = { w: 3, b: 3 },
): ScFenSnapshot => {
  const income = energyForTurn(Math.max(1, turn));
  return {
    placement,
    turn,
    kingLives: { ...kingLives },
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

/** Pack sieged-rook squares for the SCFEN `S:` extras field. */
export const formatSiegedRooksExtra = (squares: readonly Square[]): string | null => {
  if (squares.length === 0) return null;
  const uniq = [...new Set(squares)].filter((s) => SQ_RE.test(s)).sort();
  if (uniq.length === 0) return null;
  return `S:${uniq.join("")}`;
};

/** Parse `S:c3f7…` sieged Siege Tank squares. */
export const parseSiegedRooksExtra = (extra: string | undefined): Square[] => {
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

/** Pack pending king-checks for the SCFEN `H:` extras field. */
export const formatPendingKingShotsExtra = (
  shots: readonly ScPendingKingShot[],
): string | null => {
  if (shots.length === 0) return null;
  const parts = shots.map((s) => `${s.color}:${s.piece}:${s.from}${s.to}`);
  return `H:${parts.join(";")}`;
};

/**
 * Parse `H:b:n:c5e4` (`;`-separated hits). Attacker color, piece, from+to.
 */
export const parsePendingKingShotsExtra = (
  extra: string | undefined,
): ScPendingKingShot[] => {
  if (!extra || !extra.startsWith("H:")) return [];
  const body = extra.slice(2);
  if (!body) return [];
  const out: ScPendingKingShot[] = [];
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
      piece: piece as ScPendingKingShot["piece"],
      from: m[3] as Square,
      to: m[4] as Square,
    });
  }
  return out;
};

const formatGasField = (snap: ScFenSnapshot): string =>
  `G:${snap.gas.w}${snap.gas.b}:${snap.gasIncome.w}${snap.gasIncome.b}`;

const formatAction = (a: ScAction): string => {
  if (a.timing === "C") {
    const promo = a.promotion ?? "";
    return `C=${a.from}${a.to}${promo}`;
  }
  const to = a.to ? `:${a.to}` : "";
  const unit = a.unit ? `:${a.unit}` : "";
  return `${a.timing}=${a.kind}:${a.from}${to}${unit}`;
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
  const kind = m[2] as ScSpecialKind;
  if (!SPECIAL_KINDS.has(kind)) {
    throw Object.assign(new Error(`Unknown SCFEN special kind: ${kind}`), { code: "SC_QUEUE_SHAPE" });
  }
  const from = m[3] as Square;
  const to = m[4] as Square | undefined;
  const unit = m[5] as SpawnPiece | undefined;
  if (unit && !UNITS.has(unit)) {
    throw Object.assign(new Error(`Invalid SCFEN unit: ${unit}`), { code: "SC_QUEUE_SHAPE" });
  }
  return { timing, kind, color, from, ...(to ? { to } : {}), ...(unit ? { unit } : {}), seq };
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
    const befores = side.filter((a) => a.timing === "B");
    const afters = side.filter((a) => a.timing === "F");
    if (classical.length > 1) {
      throw Object.assign(
        new Error(`SCFEN queue: at most one C per side (${color} has ${classical.length})`),
        { code: "SC_QUEUE_SHAPE" as const },
      );
    }
    if (befores.length + afters.length > 1) {
      throw Object.assign(
        new Error(`SCFEN queue: at most one special per side (${color})`),
        { code: "SC_QUEUE_SHAPE" as const },
      );
    }
    if (befores.length > 0 && afters.length > 0) {
      throw Object.assign(
        new Error(`SCFEN queue: B xor F per side (${color})`),
        { code: "SC_QUEUE_SHAPE" as const },
      );
    }
  }
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
  const spent: Record<PieceColor, number> = { w: 0, b: 0 };
  for (const a of snap.queue?.actions ?? []) {
    if (a.timing === "C") continue;
    spent[a.color] += specialGasCost(a.kind);
  }
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
    kingLives,
    phase,
    specialsUsed,
    queue,
    mines,
    siegedRooks,
    pendingKingShots,
  } = snap;
  let s = `SCFEN|${placement}|${turn}|${kingLives.w}${kingLives.b}|${phase}|${formatGasField(snap)}`;
  if (queue) s += `|${formatQueueField(queue)}`;
  const used = formatSpecialsUsedExtra(specialsUsed ?? []);
  if (used) s += `|${used}`;
  const siegeField = formatSiegedRooksExtra(siegedRooks ?? []);
  if (siegeField) s += `|${siegeField}`;
  const hits = formatPendingKingShotsExtra(pendingKingShots ?? []);
  if (hits) s += `|${hits}`;
  const mineField = formatMinesExtra(mines ?? []);
  if (mineField) s += `|${mineField}`;
  return s;
};

export const parseScFen = (raw: string): ScFenSnapshot => {
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
  if (!hasExactKingPair(placement)) {
    throw Object.assign(
      new Error(
        `Invalid SCFEN placement (need exactly 1 king per player): ${placement}`,
      ),
      { code: "SC_PLACEMENT" },
    );
  }

  let gasField: string | undefined;
  let queueField: string | undefined;
  let usedField: string | undefined;
  let minesField: string | undefined;
  let siegeField: string | undefined;
  let hitsField: string | undefined;
  for (let i = 5; i < parts.length; i++) {
    const p = parts[i]!;
    if (p.startsWith("G:")) gasField = p;
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
  const queue = queueField ? parseQueueField(queueField) : undefined;
  if (queue && phase !== "P" && phase !== "O") {
    throw Object.assign(new Error(`SCFEN queue only allowed on phase P/O (got ${phase})`), {
      code: "SC_QUEUE_SHAPE",
    });
  }
  const specialsUsed = parseSpecialsUsedExtra(usedField);
  const siegedRooks = parseSiegedRooksExtra(siegeField);
  const pendingKingShots = parsePendingKingShotsExtra(hitsField);
  const mines = parseMinesExtra(minesField);
  for (const color of ["w", "b"] as const) assertMineCap(mines, color);
  const snap: ScFenSnapshot = {
    placement,
    turn,
    kingLives: { w: Number(lives[0]), b: Number(lives[1]) },
    phase,
    gas,
    gasIncome,
    ...(queue ? { queue } : {}),
    ...(specialsUsed.length ? { specialsUsed } : {}),
    ...(siegedRooks.length ? { siegedRooks } : {}),
    ...(pendingKingShots.length ? { pendingKingShots } : {}),
    ...(mines.length ? { mines } : {}),
  };
  // Always enforce turn-tier income + rem ≤ income (even snapshot-only / empty Q).
  assertQueueGas(snap);
  return snap;
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

const snapCoreMatches = (got: ScFenSnapshot, expect: ScFenSnapshot): boolean => {
  if (
    got.placement !== expect.placement ||
    got.turn !== expect.turn ||
    got.kingLives.w !== expect.kingLives.w ||
    got.kingLives.b !== expect.kingLives.b ||
    got.gasIncome.w !== expect.gasIncome.w ||
    got.gasIncome.b !== expect.gasIncome.b ||
    got.phase !== expect.phase
  ) {
    return false;
  }
  for (const color of ["w", "b"] as const) {
    let spent = 0;
    for (const a of expect.queue?.actions ?? []) {
      if (a.color !== color || a.timing === "C") continue;
      spent += specialGasCost(a.kind);
    }
    if (got.gas[color] !== expect.gas[color] + spent) return false;
  }
  const pack = (mines: ScFenSnapshot["mines"]) =>
    (mines ?? [])
      .map((m) => `${m.color}${m.at}`)
      .sort()
      .join(",");
  if (pack(got.mines) !== pack(expect.mines)) return false;
  const packHits = (hits: ScFenSnapshot["pendingKingShots"]) =>
    (hits ?? [])
      .map((h) => `${h.color}${h.piece}${h.from}${h.to}`)
      .sort()
      .join(",");
  if (packHits(got.pendingKingShots) !== packHits(expect.pendingKingShots)) return false;
  return true;
};

export type ScFenValidation = {
  ok: boolean;
  replay: "ok" | "snapshot-only" | "failed";
  error?: ScFenError;
  snaps?: ScFenSnapshot[];
};

export type ScFenReplayResult = {
  ok: boolean;
  final?: ScFenSnapshot;
  error?: ScFenError;
};

/**
 * Fold `endScTurn` over successive action lists (each list = one planning queue).
 */
export const replayScFen = (
  start: ScFenSnapshot,
  steps: readonly ScAction[][],
): ScFenSnapshot => {
  let cur: ScFenSnapshot = { ...start, queue: { actions: [] } };
  for (const step of steps) {
    cur = endScTurn({ ...cur, phase: "P", queue: { actions: step } }).next;
  }
  return cur;
};

export const replayScFenHistory = (
  startRaw: string,
  historyRaws: string[],
): ScFenReplayResult => {
  const start = validateScFen(startRaw);
  if (!start.ok) return { ok: false, error: start.error };
  let cur = start.snap;
  for (let i = 0; i < historyRaws.length; i++) {
    const nextRaw = historyRaws[i]!;
    const next = validateScFen(nextRaw);
    if (!next.ok) return { ok: false, error: next.error };
    if (!cur.queue) {
      return {
        ok: false,
        error: {
          code: "SC_REPLAY",
          message: `snapshot-only at step ${i}; cannot prove queue provenance`,
        },
      };
    }
    const got = endScTurn(cur).next;
    if (!snapCoreMatches(got, next.snap)) {
      return {
        ok: false,
        error: {
          code: "SC_REPLAY",
          message: `replay drift at step ${i}: got ${got.placement} turn ${got.turn} gas ${got.gas.w}${got.gas.b}, expected ${next.snap.placement} turn ${next.snap.turn} gas ${next.snap.gas.w}${next.snap.gas.b}`,
        },
      };
    }
    cur = next.snap;
  }
  return { ok: true, final: cur };
};

/**
 * Validate a start snap + subsequent planning snaps.
 * When any snap omits `Q:`, returns `replay: "snapshot-only"`.
 */
export const validateScFenHistory = (
  startRaw: string,
  historyRaws: string[],
): ScFenValidation => {
  const all = [startRaw, ...historyRaws];
  const snaps: ScFenSnapshot[] = [];
  for (const raw of all) {
    const v = validateScFen(raw);
    if (!v.ok) return { ok: false, replay: "failed", error: v.error };
    snaps.push(v.snap);
  }
  if (snaps.some((s) => !s.queue)) {
    return { ok: true, replay: "snapshot-only", snaps };
  }
  for (let i = 0; i < snaps.length - 1; i++) {
    const got = endScTurn(snaps[i]!).next;
    const expect = snaps[i + 1]!;
    if (!snapCoreMatches(got, expect)) {
      return {
        ok: false,
        replay: "failed",
        error: {
          code: "SC_REPLAY",
          message: `history drift at ${i}→${i + 1}`,
        },
        snaps,
      };
    }
  }
  return { ok: true, replay: "ok", snaps };
};
