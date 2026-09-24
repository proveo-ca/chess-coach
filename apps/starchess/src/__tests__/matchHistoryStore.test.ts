/**
 * Match history helpers — result labeling + DualNav pack rebuild.
 */
import { describe, expect, it, vi } from "vitest";

import { createInitialMatchState } from "~/app/matchReducer";
import {
  historyFromRecord,
  makeMatchId,
  recordFromMatchState,
  resultForPlayer,
} from "~/store/matchHistoryStore";
import type { StarChessGameRecord } from "~/types/review";

describe("matchHistoryStore", () => {
  it("makeMatchId is unique-ish", () => {
    expect(makeMatchId()).not.toBe(makeMatchId());
  });

  it("resultForPlayer maps outcome to win/loss/draw from human seat", () => {
    const base = createInitialMatchState();
    expect(
      resultForPlayer({
        ...base,
        playerColor: "w",
        outcome: { winner: "w" },
      }),
    ).toBe("win");
    expect(
      resultForPlayer({
        ...base,
        playerColor: "w",
        outcome: { winner: "b" },
      }),
    ).toBe("loss");
    expect(
      resultForPlayer({
        ...base,
        playerColor: "b",
        outcome: { winner: "b" },
      }),
    ).toBe("win");
    expect(
      resultForPlayer({
        ...base,
        playerColor: "w",
        outcome: { winner: null, draw: true },
      }),
    ).toBe("draw");
  });

  it("recordFromMatchState + historyFromRecord round-trips SCFEN plies", () => {
    const base = createInitialMatchState();
    const match = {
      ...base,
      playerColor: "b" as const,
      outcome: { winner: "b" as const },
      settledSnapshots: [base.liveSnapshot],
      settledResolves: [],
    };
    const record = recordFromMatchState(match, {
      id: "sc-test",
      startedAt: "2026-01-01T00:00:00.000Z",
      map: "eclipse",
      playerName: "Tester",
    });
    expect(record).not.toBeNull();
    const r = record as StarChessGameRecord;
    expect(r.result).toBe("win");
    expect(r.playerColor).toBe("b");
    expect(r.scfens.length).toBe(1);
    const pack = historyFromRecord(r);
    expect(pack.settledSnapshots.length).toBe(1);
    expect(pack.settledSnapshots[0]!.placement).toBe(base.liveSnapshot.placement);
  });

  it("historyFromRecord repairs legacy gas income vs turn tier", () => {
    // Turn 11 requires income tier 2; stale G: income 1 used to throw on open.
    const stale =
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:11:11|B:3:3|Q:w:;b:";
    const record: StarChessGameRecord = {
      id: "sc-stale-gas",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: "2026-01-01T00:10:00.000Z",
      result: "win",
      map: "eclipse",
      playerColor: "w",
      scfens: [stale],
      resolves: [],
    };
    const pack = historyFromRecord(record);
    expect(pack.settledSnapshots).toHaveLength(1);
    expect(pack.settledSnapshots[0]!.turn).toBe(11);
    expect(pack.settledSnapshots[0]!.gasIncome).toEqual({ w: 2, b: 2 });
    expect(pack.settledSnapshots[0]!.gas.w).toBeLessThanOrEqual(2);
  });
});

describe("records remember which Adjutant script played", () => {
  const finished = () => {
    const base = createInitialMatchState();
    return {
      ...base,
      playerColor: "b" as const,
      outcome: { winner: "b" as const },
      settledSnapshots: [base.liveSnapshot],
      settledResolves: [],
    };
  };

  it("stores the opponent when the screen supplies it", () => {
    const record = recordFromMatchState(finished(), {
      id: "sc-strategic",
      startedAt: "2026-01-01T00:00:00.000Z",
      map: "eclipse",
      opponent: "strategic",
    });
    expect(record?.opponent).toBe("strategic");
  });

  it("leaves it absent when no opponent is supplied", () => {
    // Keeps every other caller (tutorial hosts, demos) writing the old shape.
    const record = recordFromMatchState(finished(), {
      id: "sc-plain",
      startedAt: "2026-01-01T00:00:00.000Z",
      map: "eclipse",
    });
    expect(record?.opponent).toBeUndefined();
  });
});

describe("matchHistoryStore · packed storage", () => {
  const playedGame = async (): Promise<StarChessGameRecord> => {
    const { addScMove, endScTurn, formatScFen, parseScFen } = await import(
      "@chess-coach/starchess-core"
    );
    let snap = parseScFen("SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|Q:w:;b:");
    const scfens = [formatScFen(snap)];
    const resolves = [];
    for (const [w, b] of [
      [["d2", "d3"], ["e7", "e6"]],
      [["e2", "e3"], ["d7", "d6"]],
    ] as const) {
      snap = addScMove(snap, { color: "w", from: w[0], to: w[1] });
      snap = addScMove(snap, { color: "b", from: b[0], to: b[1] });
      const r = endScTurn(snap, { skipTurnStartChecks: true });
      resolves.push(r);
      scfens.push(formatScFen(r.next));
      snap = r.next;
    }
    return {
      id: "sc-packed",
      startedAt: "2026-09-24T00:00:00.000Z",
      endedAt: "2026-09-24T00:10:00.000Z",
      result: "win",
      map: "eclipse",
      playerColor: "w",
      scfens,
      resolves,
    };
  };

  it("stores a finished game packed and still opens it", async () => {
    const store = await import("~/store/matchHistoryStore");
    const game = await playedGame();
    store.addMatchRecord(game);
    const saved = store.getMatchById("sc-packed")!;
    expect(saved.resolves).toBeUndefined();
    expect(saved.packed?.count).toBe(2);
    expect(saved.scsan).toEqual(["Q:w:C=d2d3;b:C=e7e6", "Q:w:C=e2e3;b:C=d7d6"]);
    expect(JSON.parse(JSON.stringify(store.historyFromRecord(saved)))).toEqual(
      JSON.parse(JSON.stringify(store.historyFromRecord(game))),
    );
    const persisted = localStorage.getItem(store.MATCH_HISTORY_KEY)!;
    expect(persisted.length).toBeLessThan(JSON.stringify(game).length);
  });

  it("packs a plain history left by an older build on load", async () => {
    const game = await playedGame();
    localStorage.setItem("starchess_match_history", JSON.stringify({ games: [game] }));
    vi.resetModules();
    const store = await import("~/store/matchHistoryStore");
    const [loaded] = store.matchHistory();
    expect(loaded!.resolves).toBeUndefined();
    expect(loaded!.packed).toBeDefined();
    expect(JSON.parse(JSON.stringify(store.historyFromRecord(loaded!)))).toEqual(
      JSON.parse(JSON.stringify(store.historyFromRecord(game))),
    );
  });
});
