import { cleanup, render, screen } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { afterEach, describe, expect, it } from "vitest";

import { LiveLessonHost } from "~/demos/LiveLessonHost";
import { useMatchStore } from "~/ports/matchStore";
import { lessonBoard } from "~/tutorial/tutorialScript";
import type { MatchStore } from "~/types/match";

const GAME_OVER = "SCFEN|4k3/8/8/8/8/8/8/4K3|5|30|O|G:11:11|Q:w:;b:";

let store: MatchStore | null = null;
const StoreProbe = () => {
  store = useMatchStore();
  return null;
};

afterEach(() => {
  cleanup();
  store = null;
});

const mount = () => {
  const history = createMemoryHistory();
  history.set({ value: "/" });
  return render(() => (
    <MemoryRouter history={history}>
      <Route
        path="*"
        component={() => (
          <LiveLessonHost
            board={lessonBoard("live-play", "live-play-attack-3")}
            lessonKey="attack-3#0"
            fullMatchHud
            footerExtra={<StoreProbe />}
          />
        )}
      />
    </MemoryRouter>
  ));
};

describe("live HUD at game over", () => {
  it("stays mounted, held inert and hidden, so the rows around the board keep their size", () => {
    mount();
    const gas = screen.getByTestId("gas-deploy");
    const heldBefore = gas.closest("[data-hud-held]");
    expect(heldBefore).toBeNull();

    store!.dispatch({ type: "LOAD_SCFEN", scfen: GAME_OVER, stored: 3 });
    expect(store!.shell().phase).toBe("gameOver");

    const gasAfter = screen.getByTestId("gas-deploy");
    const hold = gasAfter.closest("[data-hud-held]") as HTMLElement | null;
    expect(hold).not.toBeNull();
    expect(hold!.hasAttribute("inert")).toBe(true);
    expect(hold!.getAttribute("aria-hidden")).toBe("true");
  });
});
