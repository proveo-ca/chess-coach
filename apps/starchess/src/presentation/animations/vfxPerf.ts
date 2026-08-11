/**
 * Combat VFX performance helpers — stable lists, concurrency caps, DPR clamp.
 * Look-preserving GPU relief for AnimationStage overlays.
 */

/** Max simultaneous cues of one kind on tight viewports (dynamic / phone). */
export const VFX_CAP_TIGHT = 4;
/** Max simultaneous cues of one kind on desktop. */
export const VFX_CAP_DESKTOP = 8;

const TIGHT_MQ = "(max-width: 719px), (max-height: 639px)";

export const isTightVfxViewport = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(TIGHT_MQ).matches;
};

/** Cap a cue list; prefer earliest ids (already playing) so CSS doesn't restart. */
export const capCues = <T>(cues: readonly T[], cap?: number): readonly T[] => {
  const limit = cap ?? (isTightVfxViewport() ? VFX_CAP_TIGHT : VFX_CAP_DESKTOP);
  if (cues.length <= limit) return cues;
  return cues.slice(0, limit);
};

/**
 * Overlay pixel ratio — clamp phone 3x DPR to 2 to cut fill-rate on combat layers.
 * Does not change layout CSS pixels.
 */
export const overlayDevicePixelRatio = (): number => {
  if (typeof window === "undefined") return 1;
  const dpr = window.devicePixelRatio || 1;
  return Math.min(dpr, 2);
};

/** Stable empty arrays shared across memos. */
export const EMPTY_ARR: never[] = [];
