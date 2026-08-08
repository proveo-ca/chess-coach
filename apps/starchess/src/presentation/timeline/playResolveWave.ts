/**
 * Play a single resolve wave for tutorial steppers.
 */
import type { EndScTurnResult } from "@chess-coach/starchess-core";

import {
  playTimeline,
  type TimelineCallbacks,
} from "~/presentation/timeline/timelinePlayer";
import {
  splitResolveWaves,
  type ResolveWaveId,
} from "~/presentation/timeline/resolveWaves";
import type { Scheduler } from "~/types/ports";

export type { ResolveWaveId } from "~/types/tutorial";
export { splitResolveWaves, presentResolveWaveIds } from "~/presentation/timeline/resolveWaves";

export const playResolveWave = (
  result: EndScTurnResult,
  waveId: ResolveWaveId,
  scheduler: Scheduler,
  cb: TimelineCallbacks,
  opts?: { isLastWave?: boolean },
): (() => void) => {
  const waves = splitResolveWaves(result);
  const wave = waves.find((w) => w.id === waveId);
  if (!wave || wave.cues.length === 0) {
    queueMicrotask(() => cb.onDone());
    return () => undefined;
  }
  const isLast =
    opts?.isLastWave ?? waves[waves.length - 1]?.id === waveId;
  return playTimeline(result, scheduler, cb, {
    cues: wave.cues,
    finalize: isLast,
  });
};
