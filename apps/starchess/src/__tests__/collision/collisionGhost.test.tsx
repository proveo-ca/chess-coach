import { cleanup, render } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { addScAction } from "@chess-coach/starchess-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LiveLessonHost } from "~/demos/LiveLessonHost";
import { useMatchStore } from "~/ports/matchStore";
import { lessonBoard } from "~/tutorial/tutorialScript";
import type { MatchStore } from "~/types/match";

let store: MatchStore | null = null;
const StoreProbe = () => {
  store = useMatchStore();
  return null;
};

afterEach(() => {
  cleanup();
  store = null;
  vi.useRealTimers();
});

describe("collision landing ghost", () => {
  it("clears on the contact square while the colliding movers are in flight", async () => {
    vi.useFakeTimers();
    const history = createMemoryHistory();
    history.set({ value: "/" });
    const r = render(() => (
      <MemoryRouter history={history}>
        <Route
          path="*"
          component={() => (
            <LiveLessonHost
              board={lessonBoard("live-play", "live-play-defense-4")}
              lessonKey="defense-4#0"
              armTimer={false}
              footerExtra={<StoreProbe />}
            />
          )}
        />
      </MemoryRouter>
    ));
    await vi.advanceTimersByTimeAsync(50);
    const live = store!.shell().liveSnapshot;
    const queued = addScAction({
      snapshot: live,
      action: { timing: "C", kind: "classical", color: "w", from: "e5", to: "h2" },
    }).snapshot;
    store!.dispatch({ type: "APPLY_SNAPSHOT", snapshot: queued });
    await vi.advanceTimersByTimeAsync(0);
    expect(r.container.querySelector('[data-intent-dest="h2"]')).not.toBeNull();

    store!.submitTurn("end");
    for (let t = 0; t < 3_000; t += 25) {
      await vi.advanceTimersByTimeAsync(25);
      const s = store!.shell();
      const tl = store!.timeline();
      if (tl.cues.some((c) => c.kind === "move" && tl.playingIds.includes(c.id))) break;
      if (s.phase !== "resolving") break;
    }
    expect(store!.timeline().active).toBe(true);
    expect(r.container.querySelector('[data-intent-dest="h2"]')).toBeNull();
  });
});
