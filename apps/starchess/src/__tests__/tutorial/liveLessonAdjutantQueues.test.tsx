import { cleanup, render } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adjutantSpy = vi.hoisted(() => ({ calls: 0 }));

vi.mock("@chess-coach/starchess-core", async (importOriginal) => {
  const core = await importOriginal<typeof import("@chess-coach/starchess-core")>();
  return {
    ...core,
    adjutant: (...args: Parameters<typeof core.adjutant>) => {
      adjutantSpy.calls++;
      return core.adjutant(...args);
    },
  };
});

import { useMatchStore } from "~/ports/matchStore";
import { LiveLessonHost } from "~/demos/LiveLessonHost";
import { lessonBoard } from "~/tutorial/tutorialScript";
import type { MatchStore } from "~/types/match";

let store: MatchStore | null = null;
const StoreProbe = () => {
  store = useMatchStore();
  return null;
};

const enemyQueued = () =>
  (store?.shell().liveSnapshot.queue?.actions ?? []).filter((a) => a.color === "b").length;

const walk = (from: string) => {
  const [story, setStory] = createSignal(from);
  const history = createMemoryHistory();
  history.set({ value: "/" });
  render(() => (
    <MemoryRouter history={history}>
      <Route
        path="*"
        component={() => (
          <LiveLessonHost
            board={lessonBoard("live-play", story())}
            lessonKey={story()}
            tutorial
            footerExtra={<StoreProbe />}
          />
        )}
      />
    </MemoryRouter>
  ));
  return setStory;
};

const settle = async (ms = 1_000) => {
  for (let t = 0; t < ms; t += 50) await vi.advanceTimersByTimeAsync(50);
};

describe("live-play adjutant after in-app navigation (real BaseScreen)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    store = null;
    adjutantSpy.calls = 0;
    vi.useRealTimers();
  });

  it("defense-1 → attack-3: the adjutant queues enemy actions", async () => {
    const go = walk("live-play-defense-1");
    await settle();
    expect(store).not.toBeNull();
    expect(adjutantSpy.calls).toBe(0);
    go("live-play-attack-3");
    await settle();
    expect(adjutantSpy.calls).toBeGreaterThan(0);
    expect(enemyQueued()).toBeGreaterThan(0);
  });

  it("attack-3 → defense-1: no adjutant leaks into a lesson without one", async () => {
    const go = walk("live-play-attack-3");
    await settle();
    expect(adjutantSpy.calls).toBeGreaterThan(0);
    const before = adjutantSpy.calls;
    go("live-play-defense-1");
    await settle(10_000);
    expect(store!.shell().phase).toBe("planning");
    expect(store!.shell().deadlineAt).not.toBeNull();
    expect(adjutantSpy.calls).toBe(before);
  });
});
