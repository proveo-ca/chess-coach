/**
 * Match title helpers for Review detail header.
 */
import { describe, expect, it } from "vitest";

import type { StarChessGameRecord } from "~/types/review";
import {
  LIVE_ADJUTANT_MATCH_TITLE,
  adjutantKindLabel,
  liveAdjutantMatchTitle,
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

describe("live match title names the chosen opponent", () => {
  it("distinguishes the two Adjutant scripts", () => {
    expect(liveAdjutantMatchTitle("naive")).toBe("Game vs Adjutant (Script)");
    expect(liveAdjutantMatchTitle("strategic")).toBe("Game vs Adjutant (Strategic)");
  });

  it("matches the labels the New Game modal offers", () => {
    // The modal's <option> text and the in-game header must agree, or picking
    // "Adjutant (Strategic)" appears to start a Script game.
    expect(adjutantKindLabel("naive")).toBe("Adjutant (Script)");
    expect(adjutantKindLabel("strategic")).toBe("Adjutant (Strategic)");
  });
});

describe("the matchup line names the script that played", () => {
  it("names the strategic script when the record carries it", () => {
    const g = { ...base, opponent: "strategic" as const };
    expect(formatMatchLabel(g)).toBe("Alex (Blue) vs Adjutant (Strategic) (Red)");
  });

  it("names the naive script when the record carries it", () => {
    const g = { ...base, opponent: "naive" as const };
    expect(formatMatchLabel(g)).toBe("Alex (Blue) vs Adjutant (Script) (Red)");
  });

  it("stays on the unqualified Adjutant for records written before the field existed", () => {
    // Records live in localStorage, so history predating the opponent select
    // has no `opponent` — it must read exactly as it always did.
    expect(base.opponent).toBeUndefined();
    expect(formatMatchLabel(base)).toBe("Alex (Blue) vs Adjutant (Red)");
  });

  it("arena imports still show both scripts, ignoring `opponent`", () => {
    const g = {
      ...base,
      opponent: "strategic" as const,
      arenaPlayers: { w: "adjutant-naive", b: "adjutant-strategic" },
    };
    expect(formatMatchLabel(g)).toBe(
      "adjutant (naive) (Blue) vs adjutant (strategic) (Red)",
    );
  });
});
