/**
 * Match title helpers for Review detail header.
 */
import { describe, expect, it } from "vitest";

import type { StarChessGameRecord } from "~/types/review";
import {
  LIVE_ADJUTANT_MATCH_TITLE,
  formatMatchLabel,
  formatMatchResultTitle,
} from "~/utils/matchTitle";

const base: StarChessGameRecord = {
  id: "t",
  startedAt: "2026-08-01T00:00:00.000Z",
  endedAt: "2026-08-01T00:10:00.000Z",
  result: "win",
  map: "eclipse",
  playerColor: "w",
  playerName: "Alex",
  scfens: [],
  resolves: [],
};

describe("matchTitle", () => {
  it("formats result + Blue/Red like Coach Review titles", () => {
    expect(formatMatchResultTitle(base)).toBe("Win (Blue)");
    expect(formatMatchLabel(base)).toBe("Alex (Blue) vs Adjutant (Red)");
  });

  it("falls back to You when playerName is unset", () => {
    const g = { ...base, playerName: undefined, playerColor: "b" as const, result: "loss" as const };
    expect(formatMatchResultTitle(g)).toBe("Loss (Red)");
    expect(formatMatchLabel(g)).toBe("You (Red) vs Adjutant (Blue)");
  });

  it("exports the live Single Player Adjutant title", () => {
    expect(LIVE_ADJUTANT_MATCH_TITLE).toBe("Game vs Adjutant (Script)");
  });
});
