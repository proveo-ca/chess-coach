// SPEC: _spec/apps/starchess/architecture/timeline-perf.puml, _spec/apps/starchess/architecture/timeline-commit-batching.mmd, _spec/apps/starchess/animation-pipeline.md, _spec/apps/starchess/architecture/reactivity/presentation.md
/**
 * Binder-internal coalesce: same-turn onCommit patches → ≤1 TIMELINE_COMMIT.
 * Not a second clock — only MatchStore dispatch writes presentation state.
 */
import { batch } from "solid-js";

import type { MatchAction, TimelineCallbacks, TimelineCommitPatch } from "~/types/match";
import type { Scheduler } from "~/types/ports";

export type TimelineCommitGate = TimelineCallbacks & {
  flush: () => void;
  cancel: () => void;
};

const mergePatch = (
  a: TimelineCommitPatch | null,
  b: TimelineCommitPatch,
): TimelineCommitPatch => (a ? { ...a, ...b } : { ...b });

export const createTimelineCommitGate = (
  dispatch: (a: MatchAction) => void,
  scheduler: Scheduler,
): TimelineCommitGate => {
  let pending: TimelineCommitPatch | null = null;
  let cancelDelay: (() => void) | null = null;
  let cancelled = false;

  const clearSchedule = () => {
    cancelDelay?.();
    cancelDelay = null;
  };

  const flush = () => {
    clearSchedule();
    if (cancelled || !pending) return;
    const patch = pending;
    pending = null;
    dispatch({ type: "TIMELINE_COMMIT", ...patch });
  };

  const scheduleFlush = () => {
    if (cancelled || cancelDelay) return;
    cancelDelay = scheduler.delay(0, () => {
      cancelDelay = null;
      flush();
    });
  };

  return {
    onStart: (cues, placement) => {
      if (cancelled) return;
      batch(() => {
        flush();
        dispatch({ type: "TIMELINE_START", cues, placement });
      });
    },
    onCommit: (patch) => {
      if (cancelled) return;
      pending = mergePatch(pending, patch);
      scheduleFlush();
    },
    onDone: () => {
      /* caller invokes after flush — see bindTimeline */
    },
    flush,
    cancel: () => {
      cancelled = true;
      pending = null;
      clearSchedule();
    },
  };
};

/** Sole binder: timelinePlayer → gate → TIMELINE_* (no second playback path). */
export const bindTimeline = (
  dispatch: (a: MatchAction) => void,
  scheduler: Scheduler,
  onDone: () => void,
): { callbacks: TimelineCallbacks; cancelGate: () => void } => {
  const gate = createTimelineCommitGate(dispatch, scheduler);
  return {
    callbacks: {
      onStart: gate.onStart,
      onCommit: gate.onCommit,
      onDone: () =>
        batch(() => {
          gate.flush();
          onDone();
        }),
    },
    cancelGate: gate.cancel,
  };
};
