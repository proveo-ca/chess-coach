/**
 * `strategicScript` — the strategic adjutant as an arena player.
 *
 * Feeds `StrategicAdjutantContext` with the arena-threaded `kvs` (the strate-
 * gic planner's whole point vs the naive one) and translates the strategic
 * result's `spendMinerals` into a bank debit for the runner.
 *
 * Engine lookahead is an *optional* `EngineFeed` seam (`opts.feed`). When a
 * feed is attached AND `ctx.movetimeMs > 0` the player rescues candidate
 * *scores* from the engine but never lets it decide legality:
 *
 *   1. rank candidates deterministically (`strategicCandidates`),
 *   2. commit each of the top-K in turn, project the post-action snapshot to a
 *      classical FEN (`scfenToFen`), skip ineligible projections,
 *   3. score that subset with the feed, fold `cp`/`mateIn` back into the rank
 *      (perspective flip: after our candidate the opponent is to move),
 *   4. re-sort and commit the first *legal* move via the pure core gate.
 *
 * Deterministic whenever no feed is attached or `movetimeMs === 0` — the
 * runner refuses to hand the player a budget in that case, so mirror-
 * determinism tests stay green.
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml, _spec/apps/server/starchess-arena-feed.puml
 */

import {
  applyCandidate,
  strategicAdjutant,
  strategicCandidates,
  scfenToFen,
  type Candidate,
  type ScFenSnapshot,
  type StrategicAdjutantContext,
} from "@chess-coach/starchess-core";

import type { EngineFeed } from "../feed/types";
import type { ScriptPlayer, SideContext } from "./types";

export const STRATEGIC_SCRIPT_NAME = "adjutant-strategic";

/** Candidates scored by the engine (`origIndex` = position in the ranked list). */
type ScoredCandidate = { origIndex: number; candidate: Candidate };

export const DEFAULT_ENGINE_TOP_K = 8;
export const MATE_PENALTY = 10_000;

/**
 * Fold an engine suggestion back into a candidate's deterministic score.
 * `cp`/`mateIn` are from the *engine's* side to move — after our candidate
 * that is the opponent, so we negate `cp` and treat a positive `mateIn`
 * (opponent mates us) as a disaster. `timedOut` suggestions keep the
 * deterministic score (never trust a partial eval for ranking).
 */
export const foldSuggestion = (
  score: number,
  cp: number | null,
  mateIn: number | null,
): number => {
  if (mateIn != null && mateIn !== 0) {
    return mateIn > 0 ? -MATE_PENALTY : MATE_PENALTY;
  }
  if (cp == null) return score;
  // Cap Stockfish cp to ±200 (2 pawns) so a single Tank on a closed file
  // doesn't outweigh Mecha/Ship horizon bonuses (BATTLESHIP_FINISH etc.)
  const capped = Math.max(-200, Math.min(200, cp));
  return score - capped / 100;
};

/** Builds the strategic arena player with an optional engine feed. */
export const strategicScript = (
  opts: {
    feed?: EngineFeed | null;
    name?: string;
    topK?: number;
  } = {},
): ScriptPlayer => {
  const feed = opts.feed ?? null;
  const topK = opts.topK ?? DEFAULT_ENGINE_TOP_K;
  const name = opts.name ?? STRATEGIC_SCRIPT_NAME;

  return {
    name,
    // Async: engine lookahead is a wall-clock await when a feed is attached.
    async play(snap: ScFenSnapshot, ctx: SideContext) {
      const adjCtx: StrategicAdjutantContext = {
        color: ctx.color,
        storedFor: (color: "w" | "b") => Object.entries(ctx.bank).find(([side]) => side === color)![1],
        kvs: ctx.kvs,
        ccIntel: ctx.ccIntel,
        lastCCProbe: ctx.lastCCProbe,
        runnerMemory: ctx.runnerMemory,
        attackerMemory: ctx.attackerMemory,
        rng: ctx.rng,
      };

      // No engine budget → the plain deterministic path (mirror-determinism).
      if (!feed || !ctx.movetimeMs || ctx.movetimeMs <= 0) {
        const plain = strategicAdjutant(snap, adjCtx);
        return { snapshot: plain.snapshot, spendMinerals: plain.spendMinerals?.amount };
      }

      // Engine path: rank, score a top-K subset, fold, re-rank, commit.
      try {
        return await playWithFeed(snap, ctx, adjCtx, feed, topK);
      } catch {
        // A feed/projection failure never decides a game — fall back to the
        // deterministic rank (same guarantee as a plain run).
        const plain = strategicAdjutant(snap, adjCtx);
        return { snapshot: plain.snapshot, spendMinerals: plain.spendMinerals?.amount };
      }
    },
  };
};

const playWithFeed = async (
  snap: ScFenSnapshot,
  ctx: SideContext,
  adjCtx: StrategicAdjutantContext,
  feed: EngineFeed,
  topK: number,
): Promise<{ snapshot: ScFenSnapshot; spendMinerals?: number }> => {
  const built = strategicCandidates(snap, adjCtx);
  if (!built) return { snapshot: snap };

  // Commit each top-K candidate to its post-action snapshot + projection.
  // `origIndex` = position in the ranked list, so a boost later re-applies to
  // the exact candidate it was scored for even when earlier ones were skipped.
  const scored: ScoredCandidate[] = [];
  const projections: { origIndex: number; fen: string }[] = [];
  for (let i = 0; i < built.candidates.length && scored.length < topK; i += 1) {
    const candidate = built.candidates[i]!;
    const result = applyCandidate(snap, candidate, ctx.color);
    if (!result) continue;
    const projected = scfenToFen(result.snapshot);
    if (!projected.ok) continue;
    scored.push({ origIndex: i, candidate });
    projections.push({ origIndex: i, fen: projected.fen });
  }
  if (projections.length === 0) {
    // Nothing engine-playable — fall through to the deterministic first legal.
    const first = firstLegal(snap, built.candidates, ctx.color);
    return first;
  }

  const suggestions = await feed.evaluate(
    projections.map((p) => ({ fen: p.fen, from: String(p.origIndex) })),
    { movetimeMs: ctx.movetimeMs! },
  );

  /** Coarse open-file test — no Marine of either colour on the landing file. */
  const isOpenFileFor = (to: string, snap: ScFenSnapshot): boolean => {
    const file = to[0];
    const placement = snap.placement;
    const boardFiles = placement.split("/").map((rank) => rank.replace(/\d/g, (n) => "1".repeat(Number(n))));
    let hasMarine = false;
    for (const rank of boardFiles) {
      let f = 0;
      for (const ch of rank) {
        const fileChar = String.fromCharCode(97 + f);
        if (fileChar === file && (ch === "p" || ch === "P")) hasMarine = true;
        f += 1;
      }
    }
    return !hasMarine;
  };
  const boost = new Map<number, number>();
  for (let i = 0; i < suggestions.length && i < scored.length; i += 1) {
    const s = suggestions[i]!;
    if (!s || s.timedOut) continue;
    const cand = scored[i]!.candidate;
    // If this candidate is a Tank deploy not on an open file, don't let Stockfish
    // over-boost it — cap to deterministic score (ignore engine cp for that case)
    const tankSpawn = cand.actions.find((a) => a.kind === "deploy" && (a as { unit?: string }).unit === "r");
    if (tankSpawn && !isOpenFileFor((tankSpawn as { to: string }).to, snap)) {
      // Keep deterministic score for closed-file Tanks
      continue;
    }
    boost.set(scored[i]!.origIndex, foldSuggestion(cand.score, s.cp, s.mateIn));
  }

  const reranked = built.candidates.map((candidate, i) => ({
    candidate,
    effective: boost.get(i) ?? candidate.score,
  }));
  reranked.sort((a, b) => b.effective - a.effective);

  for (const { candidate } of reranked) {
    const result = applyCandidate(snap, candidate, ctx.color);
    if (result) {
      return { snapshot: result.snapshot, spendMinerals: result.spendMinerals?.amount };
    }
  }
  return { snapshot: snap };
};

const firstLegal = (
  snap: ScFenSnapshot,
  candidates: readonly Candidate[],
  color: "w" | "b",
): { snapshot: ScFenSnapshot; spendMinerals?: number } => {
  for (const candidate of candidates) {
    const result = applyCandidate(snap, candidate, color);
    if (result) {
      return { snapshot: result.snapshot, spendMinerals: result.spendMinerals?.amount };
    }
  }
  return { snapshot: snap };
};

export type { EngineFeed };
