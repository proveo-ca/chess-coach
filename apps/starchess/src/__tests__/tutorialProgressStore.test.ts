import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import {
  TUTORIAL_CLEARED_KEY,
  isTutorialCleared,
  setTutorialCleared,
  shouldOfferTutorialComplete,
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

  it("offers complete only on tutorial gameOver with enemy HP 0 and uncleared", () => {
    expect(
      shouldOfferTutorialComplete({
        tutorial: true,
        phase: "gameOver",
        enemyCCLives: 0,
        cleared: false,
      }),
    ).toBe(true);
    expect(
      shouldOfferTutorialComplete({
        tutorial: true,
        phase: "gameOver",
        enemyCCLives: 0,
        cleared: true,
      }),
    ).toBe(false);
    expect(
      shouldOfferTutorialComplete({
        tutorial: true,
        phase: "planning",
        enemyCCLives: 0,
        cleared: false,
      }),
    ).toBe(false);
    expect(
      shouldOfferTutorialComplete({
        tutorial: true,
        phase: "gameOver",
        enemyCCLives: 1,
        cleared: false,
      }),
    ).toBe(false);
    expect(
      shouldOfferTutorialComplete({
        tutorial: false,
        phase: "gameOver",
        enemyCCLives: 0,
        cleared: false,
      }),
    ).toBe(false);
  });
});
