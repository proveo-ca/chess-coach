// SPEC: _spec/apps/starchess/screens.puml
import { describe, expect, it } from "vitest";

import { recordFromMatchState } from "~/store/matchHistoryStore";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { STAR_STARTING_SCFEN } from "~/app/seeds";
import { formatMatchLabel } from "~/utils/matchTitle";
import { PLAYER_NAME_MAX, clampPlayerName, displayPlayerName } from "~/utils/playerName";
import { playerName, setPlayerName } from "~/store/settingsStore";

const LONG = "Wily Tiglon Of The Seventh Nebula";

describe("player name cap", () => {
  it("clamps, trims, and collapses whitespace", () => {
    expect(clampPlayerName(LONG)).toHaveLength(PLAYER_NAME_MAX);
    expect(clampPlayerName("  spaced   out  ")).toBe("spaced out");
    expect(clampPlayerName(undefined)).toBe("");
    expect(displayPlayerName(undefined)).toBe("You");
  });

  it("enforces on write, so nothing longer ever reaches a layout", () => {
    setPlayerName(LONG);
    expect(playerName()).toHaveLength(PLAYER_NAME_MAX);
  });

  it("enforces on the persisted record", () => {
    const state = createMatchStateFromScfen(STAR_STARTING_SCFEN, 3);
    const record = recordFromMatchState(
      // a record only exists for a finished match
      { ...state, phase: "gameOver", outcome: { winner: "w" } },
      { id: "t", startedAt: "2026-08-10T00:00:00.000Z", map: "eclipse", playerName: LONG },
    );
    expect(record?.playerName ?? "").toHaveLength(PLAYER_NAME_MAX);
  });

  it("enforces in the match title", () => {
    const label = formatMatchLabel({
      id: "t", startedAt: "", endedAt: "", result: "win",
      map: "eclipse", playerColor: "w", playerName: LONG, scfens: [], resolves: [],
    });
    expect(label).toContain(clampPlayerName(LONG));
    expect(label).not.toContain(LONG);
  });
});
