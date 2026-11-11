/**
 * Engine-feed rescue for the strategic player — Phase 2 node-side parity.
 *
 * When no feed is attached (or `movetimeMs` is 0) the strategic script is
 * exactly the deterministic adjutant. When a feed is attached WITH a budget it
 * scores a top-K subset of the deterministic candidates, folds `cp`/`mateIn`
 * back into the rank, re-sorts, and commits the first legal move. Coverage:
 *   - folding semantics for `cp` and both `mateIn` signs,
 *   - the feed is consulted with the caller's `movetimeMs` budget,
 *   - a feed that down-ranks the deterministic pick changes the chosen move,
 *   - a throwing feed degrades to the deterministic path (never crashes).
 */
import { describe, expect, it } from "vitest";

import { parseScFen } from "@chess-coach/starchess-core";
import type { EngineFeed, EngineSuggestion } from "../feed/types";
import { foldSuggestion, MATE_PENALTY, strategicScript } from "../players/strategic";

const SNAP = parseScFen(
  "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:",
);

const noopFeed = (suggestions: EngineSuggestion[]): EngineFeed => ({
  name: "fake",
  evaluate: async (cands, opts) =>
    suggestions.slice(0, cands.length).map((s, i) => ({ ...s, from: cands[i]!.from })),
});

describe("foldSuggestion", () => {
  it("negates cp from engine perspective to our rank", () => {
    expect(foldSuggestion(50, 200, null)).toBe(50 - 2); // engine +2cp → we -2
    expect(foldSuggestion(50, -100, null)).toBe(50 + 1); // engine -1cp → we +1
  });

  it("caps cp at ±200 so a single heavy unit cannot outweigh horizon bonuses", () => {
    // ±200 (2 marines) is the clamp — see `foldSuggestion` in players/strategic.ts.
    expect(foldSuggestion(50, -300, null)).toBe(50 + 2);
    expect(foldSuggestion(50, 900, null)).toBe(50 - 2);
  });

  it("treats opponent-mates-us as a disaster and we-mate as a win", () => {
    expect(foldSuggestion(50, null, 3)).toBe(-MATE_PENALTY);
    expect(foldSuggestion(50, null, -2)).toBe(MATE_PENALTY);
  });

  it("keeps the deterministic score when cp is unknown and ignores mateIn 0", () => {
    expect(foldSuggestion(50, null, 0)).toBe(50);
  });
});

describe("strategicScript engine rescue", () => {
  it("ignores the feed when movetimeMs is 0 (deterministic)", async () => {
    let consulted = false;
    const feed: EngineFeed = {
      name: "spy",
      evaluate: async () => {
        consulted = true;
        return [];
      },
    };
    const player = strategicScript({ feed });
    await player.play(SNAP, {
      color: "b",
      storedFor: 1,
      bank: { w: 1, b: 1 },
      kvs: { known: 0, seen: 0, derivable: 0, hidden: 0 },
      movetimeMs: 0,
    });
    expect(consulted).toBe(false);
  });

  it("consults the feed with the caller's budget when movetimeMs > 0", async () => {
    const budgets: number[] = [];
    const feed: EngineFeed = {
      name: "spy",
      evaluate: async (_c, opts) => {
        budgets.push(opts.movetimeMs);
        return [];
      },
    };
    const player = strategicScript({ feed });
    await player.play(SNAP, {
      color: "b",
      storedFor: 1,
      bank: { w: 1, b: 1 },
      kvs: { known: 0, seen: 0, derivable: 0, hidden: 0 },
      movetimeMs: 250,
    });
    expect(budgets).toEqual([250]);
  });

  it("a feed that penalizes the deterministic pick changes the chosen move", async () => {
    // The deterministic pick (slot 0) gets crushed by MATE_PENALTY; the player
    // must then commit a different candidate instead of that one.
    const feed: EngineFeed = {
      name: "penalize-first",
      evaluate: async (cands) =>
        cands.map((_, i) => ({
          from: "",
          cp: null,
          mateIn: i === 0 ? 3 : null, // only slot 0 is a disaster
          timedOut: false,
        })),
    };

    const plain = strategicScript();
    const rescued = strategicScript({ feed });

    const plainRes = await plain.play(SNAP, {
      color: "b",
      storedFor: 1,
      bank: { w: 1, b: 1 },
      kvs: { known: 0, seen: 0, derivable: 0, hidden: 0 },
      movetimeMs: 250,
    });
    const rescuedRes = await rescued.play(SNAP, {
      color: "b",
      storedFor: 1,
      bank: { w: 1, b: 1 },
      kvs: { known: 0, seen: 0, derivable: 0, hidden: 0 },
      movetimeMs: 250,
    });

    // Both commit a legal move; the deterministic pick must be displaced.
    const { endScTurn, placementToMap } = await import("@chess-coach/starchess-core");
    const plainNext = endScTurn(plainRes.snapshot, { skipTurnStartChecks: true }).next;
    const rescuedNext = endScTurn(rescuedRes.snapshot, { skipTurnStartChecks: true }).next;
    expect(placementToMap(plainNext.placement)).not.toEqual(
      placementToMap(rescuedNext.placement),
    );
  });

  it("a throwing feed degrades to the deterministic path", async () => {
    const feed: EngineFeed = {
      name: "boom",
      evaluate: async () => {
        throw new Error("stockfish died");
      },
    };
    const plain = strategicScript();
    const rescued = strategicScript({ feed });
    const plainRes = await plain.play(SNAP, {
      color: "b",
      storedFor: 1,
      bank: { w: 1, b: 1 },
      kvs: { known: 0, seen: 0, derivable: 0, hidden: 0 },
      movetimeMs: 250,
    });
    const rescuedRes = await rescued.play(SNAP, {
      color: "b",
      storedFor: 1,
      bank: { w: 1, b: 1 },
      kvs: { known: 0, seen: 0, derivable: 0, hidden: 0 },
      movetimeMs: 250,
    });
    expect(rescuedRes.snapshot).toEqual(plainRes.snapshot);
  });
});
