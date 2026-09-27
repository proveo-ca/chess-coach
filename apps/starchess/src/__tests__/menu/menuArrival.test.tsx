import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSignal } from "solid-js";

import { MenuArrival } from "~/screens/menuSky/MenuArrival";
import type { MenuSurface } from "~/types/menu";
import {
  consumeChessMenuEntrance,
  markChessMenuEntrance,
} from "~/store/menuEntrance";

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  sessionStorage.clear();
});

describe("menuEntrance", () => {
  it("marks and consumes the from-chess flag once", () => {
    expect(consumeChessMenuEntrance()).toBe(false);
    markChessMenuEntrance();
    expect(consumeChessMenuEntrance()).toBe(true);
    expect(consumeChessMenuEntrance()).toBe(false);
  });
});

describe("MenuArrival", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.useFakeTimers();
  });

  it("starts on the Chess mockup and settles on StarChess after the arrival", () => {
    const [surface, setSurface] = createSignal<MenuSurface>("chess");
    const onArrived = vi.fn();
    const { getByTestId, queryByTestId } = render(() => (
      <MenuArrival surface={surface()} onArrived={onArrived} />
    ));

    expect(getByTestId("menu-arrival").getAttribute("data-phase")).toBe("chess");
    expect(getByTestId("chess-menu-mockup")).toBeTruthy();
    expect(getByTestId("chess-menu-mockup").getAttribute("data-glass")).toBe("solid");

    setSurface("starchess");
    expect(getByTestId("menu-arrival").getAttribute("data-phase")).toBe("glass");
    expect(getByTestId("chess-menu-mockup").getAttribute("data-glass")).toBe("clearing");

    vi.advanceTimersByTime(420);
    expect(getByTestId("menu-arrival").getAttribute("data-phase")).toBe("identity");

    vi.advanceTimersByTime(780 - 420);
    expect(getByTestId("menu-arrival").getAttribute("data-phase")).toBe("shatter");

    vi.advanceTimersByTime(1050 - 780);
    expect(getByTestId("menu-arrival").getAttribute("data-phase")).toBe("reveal");

    vi.advanceTimersByTime(2200 - 1050);
    expect(getByTestId("menu-arrival").getAttribute("data-phase")).toBe("starchess");
    expect(queryByTestId("chess-menu-mockup")).toBeNull();
    expect(onArrived).toHaveBeenCalledOnce();
  });

  it("a flip back to chess mid-arrival cancels every pending beat", () => {
    const [surface, setSurface] = createSignal<MenuSurface>("chess");
    const onArrived = vi.fn();
    const { getByTestId } = render(() => (
      <MenuArrival surface={surface()} onArrived={onArrived} />
    ));

    setSurface("starchess");
    vi.advanceTimersByTime(500);
    expect(getByTestId("menu-arrival").getAttribute("data-phase")).toBe("identity");

    setSurface("chess");
    vi.advanceTimersByTime(5_000);
    expect(getByTestId("menu-arrival").getAttribute("data-phase")).toBe("chess");
    expect(onArrived).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows Selena CoachAvatar on the Chess mockup", () => {
    const { getByTestId, getByLabelText } = render(() => (
      <MenuArrival surface="chess" />
    ));

    expect(getByTestId("chess-menu-avatar")).toBeTruthy();
    expect(getByLabelText("Selena")).toBeTruthy();
    expect(
      getByTestId("chess-menu-avatar")
        .querySelector("[data-identity]")
        ?.getAttribute("data-identity"),
    ).toBe("selena");
  });

  it("snaps back to Chess without reverse shatter", () => {
    const [surface, setSurface] = createSignal<MenuSurface>("starchess");
    const { getByTestId } = render(() => <MenuArrival surface={surface()} />);

    expect(getByTestId("menu-arrival").getAttribute("data-phase")).toBe("starchess");

    setSurface("chess");
    expect(getByTestId("menu-arrival").getAttribute("data-phase")).toBe("chess");
    expect(getByTestId("chess-menu-mockup").getAttribute("data-glass")).toBe("solid");
    expect(getByTestId("chess-menu-avatar")).toBeTruthy();
  });
});
