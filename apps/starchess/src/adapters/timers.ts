// SPEC: _spec/apps/starchess/architecture/timers.puml
import { getOwner, onCleanup } from "solid-js";

import { browserInterval, browserScheduler } from "~/adapters/browser";
import type { Cancel } from "~/types/ports";

/** Unowned delay: the caller keeps the cancel. */
export const schedule = (ms: number, fn: () => void): Cancel => browserScheduler.delay(ms, fn);

/** Unowned repeat: the caller keeps the cancel. */
export const repeat = (ms: number, fn: () => void): Cancel => browserInterval.every(ms, fn);

const owned = (cancel: Cancel): Cancel => {
  if (getOwner()) onCleanup(cancel);
  return cancel;
};

/** Delay cancelled when the current owner (component, effect run) disposes. */
export const createDelay = (ms: number, fn: () => void): Cancel => owned(schedule(ms, fn));

/** Repeat cancelled when the current owner (component, effect run) disposes. */
export const createRepeat = (ms: number, fn: () => void): Cancel => owned(repeat(ms, fn));

/** Resolves after `ms`; an abort settles it early instead of stranding the awaiter. */
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
