import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BUBBLE_STAGGER_MS,
  achievementBubbles,
  clearAchievementBubbles,
  pushAchievementBubbles,
  resetAchievementLive,
} from "~/achievements/achievementLive";
import type { AchievementBubble } from "~/types/achievements";

const bubble = (id: string): AchievementBubble => ({
  id,
  shortId: "stonks",
  level: 1,
  origin: "e4",
  icon: "",
  side: "w",
});

const ids = () => achievementBubbles().map((b) => b.id);

beforeEach(() => {
  vi.useFakeTimers();
  resetAchievementLive();
});

afterEach(() => {
  resetAchievementLive();
  vi.useRealTimers();
});

describe("achievement bubble queue", () => {
  it("shows the first bubble at once and releases the rest one per stagger", () => {
    pushAchievementBubbles([bubble("a"), bubble("b"), bubble("c")]);
    expect(ids()).toEqual(["a"]);
    vi.advanceTimersByTime(BUBBLE_STAGGER_MS);
    expect(ids()).toEqual(["a", "b"]);
    vi.advanceTimersByTime(BUBBLE_STAGGER_MS);
    expect(ids()).toEqual(["a", "b", "c"]);
  });

  it("queues a later push behind bubbles still waiting", () => {
    pushAchievementBubbles([bubble("a"), bubble("b")]);
    pushAchievementBubbles([bubble("c")]);
    expect(ids()).toEqual(["a"]);
    vi.advanceTimersByTime(BUBBLE_STAGGER_MS * 2);
    expect(ids()).toEqual(["a", "b", "c"]);
  });

  it("drops waiting bubbles on clear", () => {
    pushAchievementBubbles([bubble("a"), bubble("b")]);
    clearAchievementBubbles();
    vi.advanceTimersByTime(BUBBLE_STAGGER_MS * 4);
    expect(ids()).toEqual([]);
  });
});
