import { cleanup, render } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MatchStore } from "~/types/match";

const base = vi.hoisted(() => ({
  props: null as null | { hintAlertSquares?: readonly string[] },
  store: null as null | MatchStore,
}));

vi.mock("~/app/BaseScreen.tsx", async () => {
  const { useMatchStore } = await import("~/ports/matchStore");
  return {
    BaseScreen: (props: { hintAlertSquares?: readonly string[] }) => {
      base.props = props;
      base.store = useMatchStore();
      return null;
    },
  };
});

import { TutorialScreen } from "~/screens/TutorialScreen";
import { tutorialPath } from "~/tutorial/tutorialScript";

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("lesson state after winning and advancing (one host)", () => {
  it("winning attack-3 with its CC seen on d5, then advancing, opens attack-4 on the e8 default ring", async () => {
    vi.useFakeTimers();
    const history = createMemoryHistory();
    history.set({ value: tutorialPath("live-play", "live-play-attack-3") });
    render(() => (
      <MemoryRouter history={history}>
        <Route path="/tutorial/:section/:story" component={TutorialScreen} />
      </MemoryRouter>
    ));
    await vi.advanceTimersByTimeAsync(500);
    // CC seen on d5 (lit by a rook on d4), then the win: enemy CC at 0 lives.
    base.store!.dispatch({ type: "LOAD_SCFEN", scfen: "SCFEN|8/8/8/3k4/3R4/8/8/4K3|3|33|P|G:11:11|Q:w:;b:", stored: 3 });
    await vi.advanceTimersByTimeAsync(300);
    base.store!.dispatch({ type: "LOAD_SCFEN", scfen: "SCFEN|8/8/8/3k4/3R4/8/8/4K3|3|30|O|G:11:11|Q:w:;b:", stored: 3 });
    for (let i = 0; i < 40; i++) await vi.advanceTimersByTimeAsync(500);
    expect(history.get()).toContain("attack-4");
    expect(base.props?.hintAlertSquares).not.toContain("d5");
    expect(base.props?.hintAlertSquares).toContain("e8");
  });
});
