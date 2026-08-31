/**
 * `StarChessFeed` — the node-side `EngineFeed` implementation backed by the
 * `StarChessEnginePool`.
 *
 * Accepts a batch of candidate projections (classical FENs from core
 * `scfenToFen`) and scores each through the pool. Each candidate is routed
 * through `pool.score()`, which round-robins an engine and serializes per
 * engine, so concurrent candidates that share a subprocess run one-after-
 * another (never corrupting the UCI line queue). Each eval is
 * `clearLineQueue()`d after `bestmove`, so a late line never polls the next
 * query.
 *
 * **Budget:** the caller's `movetimeMs` is split across the batch
 * (`movetimeMs / N` per candidate), so the whole batch's wall clock stays ≤ the
 * caller's budget. (Not "each candidate gets the full budget".)
 *
 * A per-candidate throw is absorbed: the query degrades to a no-op suggestion
 * (advisory by contract) instead of failing the whole planning window.
 *
 * // SPEC: _spec/apps/server/starchess-arena-feed.puml
 */

import type {
  EngineCandidate,
  EngineFeed,
  EngineFeedOptions,
  EngineSuggestion,
} from "@chess-coach/starchess-arena";

import type { StarChessEnginePool } from "./StarChessEnginePool.ts";

export class StarChessFeed implements EngineFeed {
  readonly name = "starchess-feed";

  constructor(private readonly pool: StarChessEnginePool) {}

  async evaluate(
    candidates: readonly EngineCandidate[],
    opts: EngineFeedOptions,
  ): Promise<readonly EngineSuggestion[]> {
    const { movetimeMs } = opts;
    const perCandidateMs =
      movetimeMs > 0 ? Math.max(1, Math.floor(movetimeMs / Math.max(1, candidates.length))) : 0;

    return Promise.all(
      candidates.map(async (candidate) => {
        try {
          const eval_ = await this.pool.score(candidate.fen, { movetimeMs: perCandidateMs });
          return {
            from: candidate.from,
            cp: eval_.isMate ? null : eval_.cp,
            mateIn: eval_.isMate ? eval_.mateIn : null,
            timedOut: false,
          };
        } catch {
          return { from: candidate.from, cp: null, mateIn: null, timedOut: true };
        }
      }),
    );
  }
}
