// SPEC: _spec/apps/starchess/vfx-tier.puml
/**
 * Combat VFX tier — `full` or `lite` — decided per device by the silent menu
 * CPU probe (`presentation/animations/vfxProbe.ts`), never by the user agent.
 *
 * Visual only: the tier changes what a cue draws, never the timeline's pace
 * (multiplayer clients advance in lockstep). Sole writer of
 * `<html data-vfx-tier>`, which the CSS modules key their lite rules on; JS
 * reads `vfxTier()` only where the element count changes.
 */
import { createEffect, createRoot, createSignal } from "solid-js";

import { createPersistedStore } from "~/store/createPersistedStore";
import type { ProbeMetrics, ProbeVerdict, VfxTier } from "~/types/vfxTier";

export const VFX_TIER_STORAGE_KEY = "starchess_vfx_tier";
/** A settled result is re-measured after this long (thermal / battery drift). */
export const PROBE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
/** Consecutive `lite` verdicts before downgrading — one bad probe is noise. */
export const LITE_AFTER_PROBES = 2;

type VfxTierState = {
  tier: VfxTier;
  /** `Date.now()` of the last conclusive probe; 0 = never probed. */
  probedAt: number;
  /** `PROBE_VERSION` that probe ran under — a VFX change re-probes. */
  probeVersion: number;
  /** Consecutive `lite` verdicts not yet acted on. */
  liteStreak: number;
  /** Last conclusive probe's signals — for `?debug=perf` and calibration. */
  lastLagMs: number;
  lastJankRatio: number;
};

const [state, setState] = createPersistedStore<VfxTierState>(VFX_TIER_STORAGE_KEY, {
  tier: "full",
  probedAt: 0,
  probeVersion: 0,
  liteStreak: 0,
  lastLagMs: 0,
  lastJankRatio: 0,
});

const [pinned, setPinned] = createSignal<VfxTier | null>(null);

export const vfxTier = (): VfxTier => pinned() ?? state.tier;

export const pinVfxTier = (tier: VfxTier | null): void => {
  setPinned(tier);
};

/** True when the menu should measure again. */
export const probeIsStale = (probeVersion: number, now: number = Date.now()): boolean =>
  state.probeVersion !== probeVersion ||
  state.liteStreak > 0 ||
  now - state.probedAt > PROBE_MAX_AGE_MS;

/** Fold one probe verdict in: `full` restores at once, `lite` needs a streak. */
export const recordProbe = (
  verdict: ProbeVerdict,
  probeVersion: number,
  now: number = Date.now(),
  metrics?: ProbeMetrics,
): void => {
  if (verdict === "inconclusive") return;
  const liteStreak = verdict === "lite" ? state.liteStreak + 1 : 0;
  const tier: VfxTier =
    verdict === "full" ? "full" : liteStreak >= LITE_AFTER_PROBES ? "lite" : state.tier;
  setState({
    tier,
    probedAt: now,
    probeVersion,
    liteStreak: tier === "lite" ? 0 : liteStreak,
    lastLagMs: Math.round(metrics?.lagMedianMs ?? 0),
    lastJankRatio: +(metrics?.jankRatio ?? 0).toFixed(3),
  });
};

createRoot(() => {
  createEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.vfxTier = vfxTier();
  });
});
