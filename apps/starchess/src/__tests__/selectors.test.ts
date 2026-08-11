import { describe, expect, it } from "vitest";

import {
  createInitialMatchState,
  matchReducer,
} from "~/app/matchReducer";
import {
  canSubmit,
  displayedSnapshot,
  fogForViewer,
  isTerminal,
  outcomeLabel,
  pieceMap,
} from "~/app/selectors";

describe("selectors", () => {
  it("canSubmit only in planning/targeting", () => {
    const s = createInitialMatchState();
    expect(canSubmit(s)).toBe(true);
    expect(canSubmit({ ...s, phase: "resolving" })).toBe(false);
    expect(canSubmit({ ...s, phase: "targeting" })).toBe(true);
  });

  it("isTerminal and outcomeLabel", () => {
    const s = createInitialMatchState();
    expect(isTerminal(s)).toBe(false);
    expect(outcomeLabel(s)).toBeNull();
    const over = {
      ...s,
      phase: "gameOver" as const,
      outcome: { winner: "w" as const },
    };
    expect(isTerminal(over)).toBe(true);
    expect(outcomeLabel(over)).toBe("White wins");
    expect(
      outcomeLabel({
        ...over,
        outcome: { winner: null, draw: true },
      }),
    ).toBe("Draw");
    expect(outcomeLabel({ ...over, outcome: null })).toBe("Game over");
  });

  it("displayedSnapshot overlays timeline during gameOver review", () => {
    let s = createInitialMatchState();
    s = {
      ...s,
      phase: "gameOver",
      outcome: { winner: "w" },
      settledSnapshots: [
        s.liveSnapshot,
        { ...s.liveSnapshot, placement: "4k3/8/8/8/8/8/8/4K3", turn: 1 },
      ],
      reviewIndex: 1,
      timeline: {
        ...s.timeline,
        active: true,
        displayPlacement: "4k3/8/8/8/8/4P2/8/4K3",
        displayKingLives: { w: 2, b: 3 },
        displayMines: [],
        displaySiegedRooks: ["a1"],
      },
    };
    const d = displayedSnapshot(s);
    expect(d.placement).toBe("4k3/8/8/8/8/4P2/8/4K3");
    expect(d.kingLives).toEqual({ w: 2, b: 3 });
    expect(d.siegedRooks).toEqual(["a1"]);
    s = {
      ...s,
      timeline: { ...s.timeline, active: false, displayPlacement: null },
    };
    expect(displayedSnapshot(s).placement).toBe("4k3/8/8/8/8/8/8/4K3");
  });

  it("merges specialsUsed into live display and fogForViewer", () => {
    let s = createInitialMatchState();
    s = matchReducer(s, {
      type: "LOAD_SCFEN",
      scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    });
    s = {
      ...s,
      specialsUsed: new Set(["e2"]),
      timeline: { ...s.timeline, displayPlacement: s.liveSnapshot.placement },
    };
    const d = displayedSnapshot(s);
    expect(d.specialsUsed).toContain("e2");
    expect(pieceMap(s).get("e2")?.type).toBe("p");
    const fog = fogForViewer(s);
    expect(fog.litSquares.size).toBeGreaterThan(0);
  });
});
