import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMatchStateFromScfen } from "~/app/matchReducer";
import { createMatchStore, MatchStoreProvider } from "~/app/MatchStoreContext";
import { BoardSideRail } from "~/presentation/hud/BoardSideRail";
import { TurnBarSidebar } from "~/presentation/hud/TurnBarSidebar";
import {
  ANALYSIS_CAPABILITIES,
  LIVE_CAPABILITIES,
  setCapabilities,
} from "~/store/capabilitiesStore";
import { NERD_STARTING_SCFEN } from "~/stories/fixtures/seeds";

afterEach(() => {
  cleanup();
  setCapabilities(LIVE_CAPABILITIES);
});

const directDividers = (rail: HTMLElement) =>
  Array.from(rail.children).filter((child) => child.tagName === "HR");

describe("BoardSideRail", () => {
  it("wraps live controls and confirms before leaving", () => {
    setCapabilities(LIVE_CAPABILITIES);
    const onHome = vi.fn();
    const store = createMatchStore({
      initial: createMatchStateFromScfen(NERD_STARTING_SCFEN, 1),
    });

    render(() => (
      <MatchStoreProvider store={store}>
        <BoardSideRail
          controlsVisible
          controls={<TurnBarSidebar autoStart={false} resolveOnEnd={false} />}
          onHome={onHome}
        />
      </MatchStoreProvider>
    ));

    const rail = screen.getByTestId("starchess-side-rail");
    expect(screen.getByTestId("turn-bar-sidebar")).not.toBeNull();
    expect(screen.getByTestId("turn-end").textContent).toContain("End Turn");
    expect(screen.getByTestId("starchess-sidebar")).not.toBeNull();
    expect(directDividers(rail)).toHaveLength(1);
    expect(screen.queryByTestId("review-vision-filter")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onHome).not.toHaveBeenCalled();
    expect(screen.getByTestId("exit-game-confirm")).not.toBeNull();

    fireEvent.click(screen.getByTestId("exit-game-leave"));
    expect(onHome).toHaveBeenCalledOnce();
  });

  it("wraps review controls and exposes review-only tools", () => {
    setCapabilities(ANALYSIS_CAPABILITIES);
    const onHome = vi.fn();
    const base = createMatchStateFromScfen(NERD_STARTING_SCFEN, 1);
    const store = createMatchStore({
      initial: { ...base, phase: "gameOver" },
    });

    render(() => (
      <MatchStoreProvider store={store}>
        <BoardSideRail
          controlsVisible
          controls={<TurnBarSidebar review={{ turn: 1, phase: "resolve", hideDualNav: true }} />}
          onHome={onHome}
        />
      </MatchStoreProvider>
    ));

    const rail = screen.getByTestId("starchess-side-rail");
    expect(screen.getByTestId("turn-bar-sidebar-review")).not.toBeNull();
    expect(screen.queryByTestId("turn-end")).toBeNull();
    expect(screen.getByTestId("review-vision-filter")).not.toBeNull();
    expect(directDividers(rail)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onHome).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("exit-game-confirm")).toBeNull();
  });

  it("reactively toggles controls and the shared divider together", () => {
    const store = createMatchStore({
      initial: createMatchStateFromScfen(NERD_STARTING_SCFEN, 1),
    });
    const [controlsVisible, setControlsVisible] = createSignal(false);

    render(() => (
      <MatchStoreProvider store={store}>
        <BoardSideRail
          controlsVisible={controlsVisible()}
          controls={<div data-testid="hidden-controls" />}
        />
      </MatchStoreProvider>
    ));

    const rail = screen.getByTestId("starchess-side-rail");
    expect(screen.queryByTestId("hidden-controls")).toBeNull();
    expect(directDividers(rail)).toHaveLength(0);
    expect(screen.getByTestId("starchess-sidebar")).not.toBeNull();

    setControlsVisible(true);
    expect(screen.getByTestId("hidden-controls")).not.toBeNull();
    expect(directDividers(rail)).toHaveLength(1);

    setControlsVisible(false);
    expect(screen.queryByTestId("hidden-controls")).toBeNull();
    expect(directDividers(rail)).toHaveLength(0);
  });
});
