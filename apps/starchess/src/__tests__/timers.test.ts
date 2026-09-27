import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEffect, createRoot, createSignal } from "solid-js";

import { createDelay, createRepeat, repeat, schedule, sleep } from "~/adapters/timers";

describe("adapters/timers", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("schedule fires once and its cancel prevents the fire", () => {
    const a = vi.fn();
    const b = vi.fn();
    schedule(100, a);
    const cancel = schedule(100, b);
    cancel();
    vi.advanceTimersByTime(100);
    expect(a).toHaveBeenCalledOnce();
    expect(b).not.toHaveBeenCalled();
  });

  it("repeat fires every period until cancelled", () => {
    const fn = vi.fn();
    const cancel = repeat(50, fn);
    vi.advanceTimersByTime(150);
    cancel();
    vi.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("createDelay and createRepeat cancel when their root disposes", () => {
    const once = vi.fn();
    const tick = vi.fn();
    const dispose = createRoot((d) => {
      createDelay(100, once);
      createRepeat(40, tick);
      return d;
    });
    vi.advanceTimersByTime(80);
    dispose();
    vi.advanceTimersByTime(500);
    expect(once).not.toHaveBeenCalled();
    expect(tick).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("createDelay inside an effect is cancelled by the effect's re-run", () => {
    const fired: number[] = [];
    const [n, setN] = createSignal(1);
    const dispose = createRoot((d) => {
      createEffect(() => {
        const v = n();
        createDelay(100, () => fired.push(v));
      });
      return d;
    });
    vi.advanceTimersByTime(50);
    setN(2);
    vi.advanceTimersByTime(100);
    dispose();
    expect(fired).toEqual([2]);
  });

  it("createDelay without an owner warns in dev and still returns a working cancel", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fn = vi.fn();
    const cancel = createDelay(10, fn);
    expect(warn).toHaveBeenCalledOnce();
    cancel();
    vi.advanceTimersByTime(10);
    expect(fn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("sleep resolves after ms, and an abort settles it early with no timer left", async () => {
    const done = vi.fn();
    void sleep(100).then(done);
    await vi.advanceTimersByTimeAsync(100);
    expect(done).toHaveBeenCalledOnce();

    const ctrl = new AbortController();
    const early = vi.fn();
    void sleep(1_000, ctrl.signal).then(early);
    ctrl.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(early).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sleep on an already-aborted signal resolves without scheduling", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await sleep(1_000, ctrl.signal);
    expect(vi.getTimerCount()).toBe(0);
  });
});
