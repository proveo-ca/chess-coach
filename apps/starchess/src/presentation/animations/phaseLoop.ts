// SPEC: _spec/apps/starchess/architecture/timers.puml
import { onCleanup } from "solid-js";

import { createRepeat, schedule } from "~/adapters/timers";
import type { Cancel } from "~/types/ports";

/** `[offset from cycle start, step]`; the step receives the 0-based cycle index. */
export type PhaseStep = readonly [atMs: number, run: (cycle: number) => void];

/**
 * Plays `steps` from one origin every `cycleMs`. A new cycle cancels the
 * previous cycle's pending steps. Owner-bound: dispose stops the loop.
 */
export const createPhaseLoop = (steps: readonly PhaseStep[], cycleMs: number): void => {
  let pending: Cancel[] = [];
  let cycle = 0;
  const halt = () => {
    for (const cancel of pending) cancel();
    pending = [];
  };
  const start = () => {
    halt();
    const k = cycle++;
    for (const [at, run] of steps) {
      if (at === 0) run(k);
      else pending.push(schedule(at, () => run(k)));
    }
  };
  start();
  createRepeat(cycleMs, start);
  onCleanup(halt);
};
