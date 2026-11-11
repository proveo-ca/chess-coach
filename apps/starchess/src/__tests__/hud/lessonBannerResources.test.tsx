import { cleanup, render, screen } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveLessonHost } from "~/demos/LiveLessonHost";
import { lessonBoard } from "~/tutorial/tutorialScript";
import { DYNAMIC_MOBILE_MQ, MOBILE_MQ } from "~/utils/breakpoints";

const viewport = (matching: readonly string[]) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: matching.includes(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );

const mount = (hudResources: boolean) => {
  const history = createMemoryHistory();
  history.set({ value: "/" });
  return render(() => (
    <MemoryRouter history={history}>
      <Route
        path="*"
        component={() => (
          <LiveLessonHost
            board={lessonBoard("live-play", "live-play-attack-4")}
            lessonKey="attack-4#0"
            tutorial
            bannerTitle="Turtled Opponent"
            hudResources={hudResources}
            onExitToMenu={() => {}}
          />
        )}
      />
    </MemoryRouter>
  ));
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("lesson mobile banner", () => {
  beforeEach(() => viewport([MOBILE_MQ]));

  it("shows the lesson title while the coach teaches", () => {
    mount(false);
    const banner = screen.getByTestId("mobile-banner");
    expect(banner.textContent).toContain("Turtled Opponent");
    expect(banner.querySelector("[data-testid=resource-bar]")).toBeNull();
  });

  it("replaces the title with the ResourceBar once the coach hides", () => {
    mount(true);
    const banner = screen.getByTestId("mobile-banner");
    expect(banner.textContent).not.toContain("Turtled Opponent");
    expect(banner.querySelector("[data-testid=resource-bar]")).not.toBeNull();
    expect(screen.getAllByTestId("resource-bar")).toHaveLength(1);
  });
});

describe("lesson dynamic banner", () => {
  it("never shows the title", () => {
    viewport([MOBILE_MQ, DYNAMIC_MOBILE_MQ]);
    mount(false);
    expect(screen.getByTestId("mobile-banner").textContent).not.toContain("Turtled Opponent");
  });
});
