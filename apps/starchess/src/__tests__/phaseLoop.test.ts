import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, createSignal } from "solid-js";

import { createFrameClock } from "~/adapters/timers";
import { createPhaseClock } from "~/presentation/animations/phaseLoop";

type PhaseStep = Parameters<typeof createPhaseClock>[0][number];

const flush = () => Promise.resolve();

const mount = (steps: readonly PhaseStep[], cycleMs: number) => {
  const [t, setT] = createSignal(0);
  let clock!: ReturnType<typeof createPhaseClock>;
  const dispose = createRoot((d) => {
    clock = createPhaseClock(steps, cycleMs, t);
    return d;
  });
  return { setT, clock, dispose };
};

const logSteps = (log: string[]): PhaseStep[] => [
  [0, (k) => log.push(`idle${k}`)],
  [100, (k) => log.push(`act${k}`)],
  [250, (k) => log.push(`hold${k}`)],
];

describe("createPhaseClock", () => {
  afterEach(() => vi.useRealTimers());

  it("derives cycle and phase from elapsed time", () => {
    const { setT, clock, dispose } = mount(logSteps([]), 400);
    const at = (t: number) => (setT(t), [clock.cycle(), clock.phase()]);
    expect(at(0)).toEqual([0, 0]);
    expect(at(99)).toEqual([0, 0]);
    expect(at(100)).toEqual([0, 1]);
    expect(at(399)).toEqual([0, 2]);
    expect(at(400)).toEqual([1, 0]);
    expect(at(650)).toEqual([1, 2]);
    dispose();
  });

  it("runs every crossed step once, in order, even when one frame skips several", async () => {
    const log: string[] = [];
    const { setT, dispose } = mount(logSteps(log), 400);
    await flush();
    expect(log).toEqual(["idle0"]);
    setT(260);
    await flush();
    expect(log).toEqual(["idle0", "act0", "hold0"]);
    setT(420);
    await flush();
    setT(430);
    await flush();
    expect(log).toEqual(["idle0", "act0", "hold0", "idle1"]);
    setT(810);
    await flush();
    expect(log.slice(4)).toEqual(["act1", "hold1", "idle2"]);
    dispose();
  });

  it("a gap longer than a cycle resumes at the current cycle instead of replaying stale ones", async () => {
    const log: string[] = [];
    const { setT, dispose } = mount(logSteps(log), 400);
    await flush();
    setT(10_000 + 150);
    await flush();
    expect(log).toEqual(["idle0", "idle25", "act25"]);
    dispose();
  });

  it("rejects an offset at or past the cycle length in dev", () => {
    expect(() => mount([[0, () => {}], [200, () => {}]], 200)).toThrow(/< cycleMs/);
  });
});

describe("createFrameClock", () => {
  afterEach(() => vi.useRealTimers());

  it("counts ms from the first frame and stops scheduling frames on dispose", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    let elapsed!: () => number;
    const dispose = createRoot((d) => {
      elapsed = createFrameClock();
      return d;
    });
    vi.advanceTimersByTime(16);
    const first = elapsed();
    vi.advanceTimersByTime(160);
    expect(elapsed() - first).toBeGreaterThanOrEqual(144);
    dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
