import { describe, expect, it } from "vitest";

import {
  appendSettledTurn,
  canGoBack,
  canGoForward,
  clearMatchHistory,
  displayedSnapshot,
  gameEnded,
  goHistoryBack,
  goHistoryForward,
  resetMatchHistory,
  reviewIndex,
  reviewLabel,
  settledSnapshots,
} from "~/starchess/matchHistory";
import type { ScFenSnapshot } from "~/starchess/types";

const snap = (turn: number, phase: "P" | "O" = "P"): ScFenSnapshot => ({
  placement: "4k3/8/8/8/8/8/8/4K3",
  turn,
  kingLives: { w: phase === "O" ? 0 : 3, b: 3 },
  phase,
  gas: { w: 1, b: 1 },
  gasIncome: { w: 1, b: 1 },
  queue: { actions: [] },
});

describe("matchHistory", () => {
  it("seeds start and appends settled turns", () => {
    clearMatchHistory();
    resetMatchHistory(snap(1));
    expect(settledSnapshots()).toHaveLength(1);
    expect(reviewIndex()).toBe(0);
    expect(gameEnded()).toBe(false);

    appendSettledTurn(snap(1), snap(2));
    expect(settledSnapshots()).toHaveLength(2);
    expect(reviewIndex()).toBe(1);
    expect(reviewLabel()).toBe("Final");

    appendSettledTurn(snap(2), snap(3, "O"));
    expect(gameEnded()).toBe(true);
    expect(settledSnapshots()).toHaveLength(3);
    expect(canGoBack()).toBe(true);
    expect(canGoForward()).toBe(false);

    goHistoryBack();
    expect(reviewIndex()).toBe(1);
    expect(reviewLabel()).toBe("Turn 1 of 2");
    expect(displayedSnapshot()?.turn).toBe(2);
    expect(gameEnded()).toBe(true);

    goHistoryBack();
    expect(reviewIndex()).toBe(0);
    expect(canGoBack()).toBe(false);
    expect(reviewLabel()).toBe("Start");

    goHistoryForward();
    goHistoryForward();
    expect(reviewIndex()).toBe(2);
    expect(canGoForward()).toBe(false);
  });

  it("terminal deep-link seed has disabled arrows", () => {
    clearMatchHistory();
    resetMatchHistory(snap(5, "O"));
    expect(gameEnded()).toBe(true);
    expect(settledSnapshots()).toHaveLength(1);
    expect(canGoBack()).toBe(false);
    expect(canGoForward()).toBe(false);
  });
});
