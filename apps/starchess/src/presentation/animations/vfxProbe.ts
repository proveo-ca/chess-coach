// SPEC: _spec/apps/starchess/vfx-tier.puml
/**
 * Silent menu CPU probe — measures the real combat VFX the menu's
 * `DebrisMarinePlayground` already loops, then picks the device's VFX tier.
 *
 * Signals are device-relative, not raw fps:
 * - **clock lag** per cue from `syncToClock` — how late this device starts VFX
 *   (the measured bottleneck: mounting a cue, not running it);
 * - **jank** — frames longer than twice the display's own median interval, so
 *   a 30 Hz low-power or 120 Hz display is judged against itself.
 *
 * After a `WARMUP_MS` settle the probe runs until it has `MIN_CUES` lag samples
 * or `PROBE_MAX_MS`, then stops for good; a hidden tab aborts it without a
 * verdict.
 */
import { schedule } from "~/adapters/timers";
import { onClockLag } from "~/presentation/animations/clockSync";
import type { Cancel } from "~/types/ports";
import type { ProbeVerdict, VfxTier } from "~/types/vfxTier";

/** Bump when combat VFX change enough that stored tiers are stale. */
export const PROBE_VERSION = 1;

/*
 * Calibrated so only a ~20× CPU slowdown picks lite (CDP
 * `Emulation.setCPUThrottlingRate`, menu playground after the warm-up,
 * 2026-09-26, three runs each):
 *
 *   rate   median lag   jank      (a live /single resolve lags ~5× the
 *   1×       3–4ms      0%         menu: 129ms at 20×)
 *   6×       7–10ms     ≤0.1%
 *   10×      14ms       0.3%
 *   20×     25–29ms     3–6%
 *
 * Either signal past its line is enough; both sit between 10× and 20×.
 */
/** Median cue clock lag above this → lite. */
export const LAG_LITE_MS = 20;
/** Share of janky frames above this → lite. */
export const JANK_LITE_RATIO = 0.02;
/** Already lite: upgrading needs this fraction of the thresholds (hysteresis). */
export const UPGRADE_MARGIN = 0.5;
/** A frame this many times the median interval counts as jank. */
export const JANK_FRAME_FACTOR = 2;
/** Fewer lag samples than this is no verdict. */
export const MIN_CUES = 8;
/** Hard stop for one probe, counted after the warm-up. */
export const PROBE_MAX_MS = 12_000;
/**
 * Ignore the first seconds after the menu turns interactive: lazy chunks,
 * fonts and the sky are still loading, and they read as VFX lag.
 */
export const WARMUP_MS = 3_000;
/** Too few frames to judge cadence. */
const MIN_FRAMES = 30;

export type ProbeSamples = {
  /** Clock lag (ms) per settled cue. */
  lagsMs: readonly number[];
  /** rAF frame intervals (ms). */
  framesMs: readonly number[];
};

export type ProbeResult = {
  verdict: ProbeVerdict;
  lagMedianMs: number;
  jankRatio: number;
};

const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** Pure verdict from one probe's samples, given the tier it ran under. */
export const decideVfxTier = (samples: ProbeSamples, current: VfxTier): ProbeResult => {
  const lagMedianMs = median(samples.lagsMs);
  const interval = median(samples.framesMs);
  const janky = samples.framesMs.filter((ms) => ms > interval * JANK_FRAME_FACTOR).length;
  const jankRatio = samples.framesMs.length ? janky / samples.framesMs.length : 0;
  if (samples.lagsMs.length < MIN_CUES || samples.framesMs.length < MIN_FRAMES) {
    return { verdict: "inconclusive", lagMedianMs, jankRatio };
  }
  const scale = current === "lite" ? UPGRADE_MARGIN : 1;
  const slow = lagMedianMs > LAG_LITE_MS * scale || jankRatio > JANK_LITE_RATIO * scale;
  return { verdict: slow ? "lite" : "full", lagMedianMs, jankRatio };
};

/**
 * Collect samples until enough cues settled (or the deadline), then call
 * `onResult`. Returns `stop` — calling it (unmount) ends the probe with no
 * verdict. A hidden tab stops it the same way: background rAF is throttled.
 */
export const startVfxProbe = (
  current: VfxTier,
  onResult: (result: ProbeResult) => void,
): (() => void) => {
  // Background-only: a hidden tab throttles rAF and would stall the warmup
  // timers, leaving the caller waiting. Abort with no verdict instead.
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return () => {};
  }
  const lagsMs: number[] = [];
  const framesMs: number[] = [];
  let raf = 0;
  let last = 0;
  let done = false;
  let offLag = () => {};
  let cancelDeadline: Cancel = () => {};

  const stop = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    cancelWarmup();
    cancelDeadline();
    offLag();
    document.removeEventListener("visibilitychange", onHidden);
  };
  const finish = () => {
    if (done) return;
    stop();
    onResult(decideVfxTier({ lagsMs, framesMs }, current));
  };
  const onHidden = () => {
    if (document.visibilityState === "hidden") stop();
  };
  const tick = (now: number) => {
    if (last) framesMs.push(now - last);
    last = now;
    raf = requestAnimationFrame(tick);
  };

  const cancelWarmup = schedule(WARMUP_MS, () => {
    offLag = onClockLag((lag) => {
      lagsMs.push(lag);
      if (lagsMs.length >= MIN_CUES) finish();
    });
    cancelDeadline = schedule(PROBE_MAX_MS, finish);
    raf = requestAnimationFrame(tick);
  });
  document.addEventListener("visibilitychange", onHidden);
  return stop;
};
