// SPEC: _spec/apps/starchess/architecture/timeline-perf.puml, _spec/apps/starchess/architecture/board-entities.puml, _spec/apps/starchess/vfx-tier.puml
/**
 * Combat VFX performance helpers — stable lists, concurrency caps, DPR clamp.
 * Look-preserving GPU relief for AnimationStage overlays.
 */

import { vfxTier } from "~/store/vfxTierStore";

/** Max simultaneous cues of one kind on tight viewports (dynamic / phone). */
export const VFX_CAP_TIGHT = 4;
/** Max simultaneous cues of one kind on desktop. */
export const VFX_CAP_DESKTOP = 8;

/** Review playback runs same-kind VFX under tighter caps (match replay, no fog). */
export const VFX_CAP_REVIEW_TIGHT = 2;
export const VFX_CAP_REVIEW_DESKTOP = 4;

/** VFX density mode — `review` = match replay, `full` = live play. */
export type VfxDensity = "full" | "review";

/** Lite VFX tier runs half as many same-kind cues at once (never below one). */
export const liteCap = (cap: number): number => Math.max(1, Math.floor(cap / 2));

/** Cap for a density mode on the current viewport and VFX tier. */
export const capForDensity = (density: VfxDensity): number => {
  const cap = isTightVfxViewport()
    ? density === "review"
      ? VFX_CAP_REVIEW_TIGHT
      : VFX_CAP_TIGHT
    : density === "review"
      ? VFX_CAP_REVIEW_DESKTOP
      : VFX_CAP_DESKTOP;
  return vfxTier() === "lite" ? liteCap(cap) : cap;
};

const TIGHT_MQ = "(max-width: 719px), (max-height: 639px)";

export const isTightVfxViewport = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(TIGHT_MQ).matches;
};

/** Cap a cue list; prefer earliest ids (already playing) so CSS doesn't restart. */
export const capCues = <T>(cues: readonly T[], cap?: number): readonly T[] => {
  const limit = cap ?? capForDensity("full");
  if (cues.length <= limit) return cues;
  return cues.slice(0, limit);
};

/**
 * Overlay pixel ratio — clamp phone 3× DPR to 2 to cut fill-rate on combat layers.
 * Does not change layout CSS pixels.
 */
export const overlayDevicePixelRatio = (): number => {
  if (typeof window === "undefined") return 1;
  const dpr = window.devicePixelRatio || 1;
  return Math.min(dpr, 2);
};

/** Inline style bag for combat root — wires DPR for CSS relief hooks. */
export const overlayRootPerfStyle = (): Record<string, string> => {
  const dpr = overlayDevicePixelRatio();
  return {
    "--overlay-dpr": String(dpr),
    // layout+style only — never paint (trails overflow the box).
    contain: "layout style",
  };
};

/** Stable empty arrays shared across memos. */
export const EMPTY_ARR: never[] = [];
