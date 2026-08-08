/**
 * Match history helpers — result labeling + DualNav pack rebuild.
 */
import { describe, expect, it } from "vitest";

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
});
