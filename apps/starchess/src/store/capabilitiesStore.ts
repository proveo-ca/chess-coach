/**
 * Per-screen capabilities — screens / live board set on mount; Sidebar and
 * input hooks read flags instead of branching on a mode name.
 * Pattern mirrors apps/ui `capabilitiesStore`.
 */
import { createSignal } from "solid-js";

import type { ScreenCapabilities } from "~/types/capabilities";

export type { ScreenCapabilities } from "~/types/capabilities";

/** Live match (LiveStarChessBoard) — fixed viewer, no flip chrome. */
export const LIVE_CAPABILITIES: ScreenCapabilities = {
  readOnly: false,
  freeColorControl: false,
  flipBoard: false,
};

/** Analysis / free-view demos that may expose Flip. */
export const ANALYSIS_CAPABILITIES: ScreenCapabilities = {
  readOnly: false,
  freeColorControl: true,
  flipBoard: true,
};

/** Read-only maps / static boards. */
export const MAP_CAPABILITIES: ScreenCapabilities = {
  readOnly: true,
  freeColorControl: false,
  flipBoard: false,
};

export const [capabilities, setCapabilities] =
  createSignal<ScreenCapabilities>(LIVE_CAPABILITIES);
