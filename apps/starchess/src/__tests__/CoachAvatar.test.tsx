import { cleanup, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import type { CoachIdentity } from "~/types/coach";

const helm = () => screen.getByTestId("coach-avatar").dataset.helm;

describe("CoachAvatar helm", () => {
  beforeEach(() =>
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame"],
    }),
  );
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const mount = () => {
    const [id, setId] = createSignal<CoachIdentity>("selena");
    render(() => <CoachAvatar identity={id()} />);
    return setId;
  };

  it("selena → kerrigan drops the helm on over two frames, then settles on", () => {
    const setId = mount();
    setId("kerrigan");
    expect(helm()).toBe("off");
    vi.advanceTimersByTime(40);
    expect(helm()).toBe("dropping");
    vi.advanceTimersByTime(5_000);
    expect(helm()).toBe("on");
  });

  it("flipping back before the frames land cancels the pending drop", () => {
    const setId = mount();
    setId("kerrigan");
    setId("selena");
    vi.advanceTimersByTime(5_000);
    expect(helm()).toBe("off");
  });

  it("unmount mid-drop leaves no frame or timer pending", () => {
    const setId = mount();
    setId("kerrigan");
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });
});
