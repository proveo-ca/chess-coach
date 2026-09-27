import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "solid-js";

import { createPhaseLoop } from "~/presentation/animations/phaseLoop";

describe("createPhaseLoop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("plays every step at its offset from one origin, each cycle", () => {
    const log: string[] = [];
    const dispose = createRoot((d) => {
      createPhaseLoop(
        [
          [0, (k) => log.push(`idle${k}`)],
          [100, (k) => log.push(`act${k}`)],
          [250, (k) => log.push(`hold${k}`)],
        ],
        400,
      );
      return d;
    });
    expect(log).toEqual(["idle0"]);
    vi.advanceTimersByTime(250);
    expect(log).toEqual(["idle0", "act0", "hold0"]);
    vi.advanceTimersByTime(150);
    expect(log.at(-1)).toBe("idle1");
    vi.advanceTimersByTime(100);
    expect(log.at(-1)).toBe("act1");
    dispose();
  });

  it("cancels the previous cycle's pending steps when a cycle is shorter than its steps", () => {
    const late = vi.fn();
    const dispose = createRoot((d) => {
      createPhaseLoop([[0, () => {}], [300, late]], 200);
      return d;
    });
    vi.advanceTimersByTime(1_000);
    expect(late).not.toHaveBeenCalled();
    dispose();
  });

  it("disposing the owner stops the loop and leaves no timers", () => {
    const step = vi.fn();
    const dispose = createRoot((d) => {
      createPhaseLoop([[0, step], [50, step]], 100);
      return d;
    });
    vi.advanceTimersByTime(60);
    dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1_000);
    expect(step).toHaveBeenCalledTimes(2);
  });
});
