// SPEC: _spec/apps/starchess/architecture/timers.puml
import { createEffect, createMemo, untrack, type Accessor } from "solid-js";

import { createFrameClock } from "~/adapters/timers";

/** `[offset from cycle start, step]`; the step receives the 0-based cycle index. */
export type PhaseStep = readonly [atMs: number, run: (cycle: number) => void];

export type PhaseClock = {
  /** 0-based cycle index. */
  cycle: Accessor<number>;
  /** Index into `steps` of the step whose window holds the clock. */
  phase: Accessor<number>;
};

type Position = { cycle: number; phase: number };

const positionAt = (t: number, offsets: readonly number[], cycleMs: number): Position => {
  const cycle = Math.floor(t / cycleMs);
  const within = t - cycle * cycleMs;
  let phase = 0;
  for (let i = 0; i < offsets.length; i++) if (offsets[i]! <= within) phase = i;
  return { cycle, phase };
};

/**
 * Derives the looping phase from one owner-bound frame clock, and runs each
 * step exactly once per cycle in offset order — a frame that skips several
 * steps runs every one it crossed. A gap of more than one whole cycle resumes
 * at the current cycle's start instead of replaying stale cycles.
 */
export const createPhaseClock = (
  steps: readonly PhaseStep[],
  cycleMs: number,
  elapsed: Accessor<number> = createFrameClock(),
): PhaseClock => {
  const offsets = steps.map(([at]) => at);
  if (import.meta.env.DEV) {
    if (offsets[0] !== 0) throw new Error("createPhaseClock: the first step must sit at offset 0");
    for (let i = 1; i < offsets.length; i++) {
      if (offsets[i]! < offsets[i - 1]!) throw new Error("createPhaseClock: offsets must ascend");
    }
    if (offsets.at(-1)! >= cycleMs) throw new Error("createPhaseClock: every offset must be < cycleMs");
  }

  const position = createMemo(() => positionAt(elapsed(), offsets, cycleMs), undefined, {
    equals: (a, b) => a.cycle === b.cycle && a.phase === b.phase,
  });

  let ran: Position = { cycle: 0, phase: -1 };
  createEffect(() => {
    const at = position();
    if (at.cycle > ran.cycle + 1) ran = { cycle: at.cycle, phase: -1 };
    while (ran.cycle < at.cycle || ran.phase < at.phase) {
      ran = ran.phase + 1 < steps.length ? { cycle: ran.cycle, phase: ran.phase + 1 } : { cycle: ran.cycle + 1, phase: 0 };
      const { cycle, phase } = ran;
      untrack(() => steps[phase]![1](cycle));
    }
  });

  return { cycle: () => position().cycle, phase: () => position().phase };
};
