/**
 * Session-local StarChess match history for terminal DualNav review.
 * Does not serialize into SCFEN.
 */
import { createSignal } from "solid-js";

import type { ScFenSnapshot } from "~/starchess/types";

export type SettledTurnRecord = {
  /** Snapshot submitted for the turn (includes queue). */
  before: ScFenSnapshot;
  /** Settled snapshot after resolve. */
  after: ScFenSnapshot;
};

const [_settled, _setSettled] = createSignal<ScFenSnapshot[]>([]);
const [_records, _setRecords] = createSignal<SettledTurnRecord[]>([]);
const [_reviewIndex, _setReviewIndex] = createSignal(0);
/** Latched when live match reaches phase O — survives seeking older snaps. */
const [_gameEnded, _setGameEnded] = createSignal(false);

export const settledSnapshots = () => _settled();
export const turnRecords = () => _records();
export const reviewIndex = () => _reviewIndex();
export const gameEnded = () => _gameEnded();

export const displayedSnapshot = (): ScFenSnapshot | null => {
  const snaps = _settled();
  const i = _reviewIndex();
  return snaps[i] ?? null;
};

export const reviewLabel = (): string => {
  const snaps = _settled();
  if (snaps.length === 0) return "";
  const i = _reviewIndex();
  if (i <= 0) return "Start";
  if (i >= snaps.length - 1) return "Final";
  return `Turn ${i} of ${snaps.length - 1}`;
};

export const canGoBack = () => _gameEnded() && _reviewIndex() > 0;
export const canGoForward = () =>
  _gameEnded() && _reviewIndex() < Math.max(0, _settled().length - 1);

/** Seed history with the opening settled position (clears prior match). */
export const resetMatchHistory = (initial: ScFenSnapshot) => {
  const seed = { ...initial, queue: initial.queue ?? { actions: [] } };
  _setSettled([seed]);
  _setRecords([]);
  _setReviewIndex(0);
  _setGameEnded(seed.phase === "O");
};

/** Append one settled turn after combat finishes. */
export const appendSettledTurn = (before: ScFenSnapshot, after: ScFenSnapshot) => {
  const settled = { ...after, queue: after.queue ?? { actions: [] } };
  _setRecords((prev) => [...prev, { before, after: settled }]);
  _setSettled((prev) => {
    const next = [...prev, settled];
    _setReviewIndex(next.length - 1);
    return next;
  });
  if (settled.phase === "O") _setGameEnded(true);
};

export const goHistoryBack = () => {
  if (!canGoBack()) return;
  _setReviewIndex((i) => Math.max(0, i - 1));
};

export const goHistoryForward = () => {
  if (!canGoForward()) return;
  _setReviewIndex((i) => Math.min(_settled().length - 1, i + 1));
};

export const clearMatchHistory = () => {
  _setSettled([]);
  _setRecords([]);
  _setReviewIndex(0);
  _setGameEnded(false);
};
