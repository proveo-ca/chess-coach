/** Injected clock — epoch ms. */
export type Clock = {
  now: () => number;
};

/** Cancellable delay — Storybook/tests inject a controllable scheduler. */
export type Scheduler = {
  delay: (ms: number, fn: () => void) => () => void;
};

/** Optional RNG for mine-leg jitter etc. */
export type RandomSource = {
  next: () => number; // [0, 1)
};

export type LocationPort = {
  search: () => string;
};
