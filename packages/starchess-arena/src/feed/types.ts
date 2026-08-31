/**
 * `EngineFeed` — the arena's engine-lookahead seam.
 *
 * The strategic adjutant's planned Stockfish lookahead has to work outside a
 * browser. The browser-grade `UciDriver`/`StockfishEngine` stack lives in
 * `apps/server`; this contract is the pure seam the node service implements
 * (Phase 2) and arena tests fake. Phase 1 ships the seam + a deterministic
 * fallback only — scripts rank without the engine when no feed is attached.
 *
 * Candidates are classical FENs projected from the pure engine via core
 * `scfenToFen`; the projector's `ok:false` candidates are skipped before any
 * engine call, so the native parser never sees an ineligible StarChess
 * position (back-rank pawns, missing king pair).
 *
 * The feed is advisory: hints adjust candidate *scores* only. The core
 * `addScAction` legality gate stays authoritative — an engine "best move" is
 * limited before the pure engine vetoes illegality the same turn.
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml, _spec/apps/server/starchess-arena-feed.puml
 */

/** One position to score, projected from a StarChess snapshot. */
export type EngineCandidate = {
  /** Classical FEN projection (core `scfenToFen`, `fen` when `ok`). */
  fen: string;
  /** The `from` candidate this position represents (for scoring feedback). */
  from: string;
};

/** Scoring feedback for one candidate, one per input (order preserved). */
export type EngineSuggestion = {
  from: string;
  /** Central pawn-equivalent score from the engine's side to move; null when unknown. */
  cp: number | null;
  /** Mate-in-N from the engine's side to move; null when not mate. */
  mateIn: number | null;
  /** True when the query exceeded its budget and returned partial data. */
  timedOut: boolean;
};

export type EngineFeedOptions = {
  /** Wall-clock budget per query; the feed may split it across candidates. */
  movetimeMs: number;
};

/**
 * Scores candidate positions (async; a missing feed means "score nothing").
 * Implementations must be safe to serialize per query — the implementation
 * drains its UCI line queue so late `bestmove` lines are never attributed to
 * the next query.
 */
export type EngineFeed = {
  readonly name: string;
  evaluate(
    candidates: readonly EngineCandidate[],
    opts: EngineFeedOptions,
  ): Promise<readonly EngineSuggestion[]>;
};