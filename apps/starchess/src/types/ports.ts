/** Injected clock — epoch ms. */
export type Clock = {
  now: () => number;
};

export type Cancel = () => void;

/** Cancellable delay — Storybook/tests inject a controllable scheduler. */
export type Scheduler = {
  delay: (ms: number, fn: () => void) => Cancel;
};

/** Cancellable fixed-period repeat. */
export type Interval = {
  every: (ms: number, fn: () => void) => Cancel;
};

/** One animation-frame callback with the frame's timestamp (ms, monotonic). */
export type Frames = {
  request: (fn: (now: number) => void) => Cancel;
};

/** Optional RNG for mine-leg jitter etc. */
export type RandomSource = {
  next: () => number; // [0, 1)
};

export type LocationPort = {
  search: () => string;
};
