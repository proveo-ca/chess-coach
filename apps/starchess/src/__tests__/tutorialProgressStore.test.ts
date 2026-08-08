import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import {
  TUTORIAL_CLEARED_KEY,
  isTutorialCleared,
  setTutorialCleared,
  shouldWarnTutorialIncomplete,
} from "~/store/tutorialProgressStore";

describe("tutorialProgressStore", () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memory.set(k, v);
      },
      removeItem: (k: string) => {
        memory.delete(k);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to not cleared", () => {
    expect(isTutorialCleared()).toBe(false);
  });

  it("persists cleared true/false under starchess_tutorial_cleared", () => {
    setTutorialCleared(true);
    expect(memory.get(TUTORIAL_CLEARED_KEY)).toBe("true");
    expect(isTutorialCleared()).toBe(true);
    setTutorialCleared(false);
    expect(memory.get(TUTORIAL_CLEARED_KEY)).toBe("false");
    expect(isTutorialCleared()).toBe(false);
  });

  it("warns only on tutorial gameOver with enemy HP 0 and uncleared", () => {
    expect(
      shouldWarnTutorialIncomplete({
        tutorial: true,
        phase: "gameOver",
        enemyKingLives: 0,
        cleared: false,
      }),
    ).toBe(true);
    expect(
      shouldWarnTutorialIncomplete({
        tutorial: true,
        phase: "gameOver",
        enemyKingLives: 0,
        cleared: true,
      }),
    ).toBe(false);
    expect(
      shouldWarnTutorialIncomplete({
        tutorial: true,
        phase: "planning",
        enemyKingLives: 0,
        cleared: false,
      }),
    ).toBe(false);
    expect(
      shouldWarnTutorialIncomplete({
        tutorial: true,
        phase: "gameOver",
        enemyKingLives: 1,
        cleared: false,
      }),
    ).toBe(false);
    expect(
      shouldWarnTutorialIncomplete({
        tutorial: false,
        phase: "gameOver",
        enemyKingLives: 0,
        cleared: false,
      }),
    ).toBe(false);
  });
});
