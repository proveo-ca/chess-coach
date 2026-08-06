/**
 * SCFEN history / replay validation — folds endScTurn over planning snaps.
 */
import { endScTurn, refillTurnGas } from "../resolve/submit-turn";
import { specialGasCost, validateScFen } from "../scfen";
import type { ScAction, ScFenError, ScFenSnapshot } from "../model/types";

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
 * Refills gas at each turn open between steps (matches `beginScTurn` / live).
 */
export const replayScFen = (
  start: ScFenSnapshot,
  steps: readonly ScAction[][],
): ScFenSnapshot => {
  let cur: ScFenSnapshot = refillTurnGas({ ...start, queue: { actions: [] } });
  for (const step of steps) {
    cur = endScTurn({ ...cur, phase: "P", queue: { actions: step } }).next;
    if (cur.phase === "P") cur = refillTurnGas(cur);
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
