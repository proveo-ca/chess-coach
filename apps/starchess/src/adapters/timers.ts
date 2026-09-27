// SPEC: _spec/apps/starchess/architecture/timers.puml
import { createSignal, getOwner, onCleanup, type Accessor } from "solid-js";

import { browserFrames, browserInterval, browserScheduler } from "~/adapters/browser";
import type { Cancel } from "~/types/ports";

/** Unowned delay: the caller keeps the cancel. */
export const schedule = (ms: number, fn: () => void): Cancel => browserScheduler.delay(ms, fn);

/** Unowned repeat: the caller keeps the cancel. */
export const repeat = (ms: number, fn: () => void): Cancel => browserInterval.every(ms, fn);

const owned = (cancel: Cancel): Cancel => {
  if (getOwner()) onCleanup(cancel);
  else if (import.meta.env.DEV) {
    console.warn("createDelay/createRepeat/createFrameClock ran with no owner; use schedule/repeat and keep the cancel.");
  }
  return cancel;
};

/** Delay cancelled when the current owner (component, effect run) disposes. */
export const createDelay = (ms: number, fn: () => void): Cancel => owned(schedule(ms, fn));

/** Repeat cancelled when the current owner (component, effect run) disposes. */
export const createRepeat = (ms: number, fn: () => void): Cancel => owned(repeat(ms, fn));

/** Unowned frame callback: the caller keeps the cancel. */
export const frame = (fn: (now: number) => void): Cancel => browserFrames.request(fn);

/** Ms since the first frame, updated once per animation frame; stops when the owner disposes. */
export const createFrameClock = (): Accessor<number> => {
  const [elapsed, setElapsed] = createSignal(0);
  let origin: number | undefined;
  let cancel: Cancel = () => {};
  const tick = (now: number) => {
    origin ??= now;
    setElapsed(now - origin);
    cancel = frame(tick);
  };
  cancel = frame(tick);
  owned(() => cancel());
  return elapsed;
};

/** Resolves after `ms`, or as soon as `signal` aborts. */
export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const cancel = schedule(ms, done);
    function done() {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }
    function onAbort() {
      cancel();
      done();
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
