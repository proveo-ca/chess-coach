// SPEC: _spec/apps/starchess/architecture/reactivity/app-screens.md
/**
 * Per-screen capabilities — a screen host provides them for its own tree;
 * SideRailTools and input hooks read flags instead of branching on a mode name.
 */
import { createContext, useContext, type Accessor } from "solid-js";

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

/** Tutorial — Home only; no flip / vision chrome. */
export const TUTORIAL_CAPABILITIES: ScreenCapabilities = {
  readOnly: false,
  freeColorControl: false,
  flipBoard: false,
  homeOnly: true,
};

const CapabilitiesContext = createContext<Accessor<ScreenCapabilities>>(() => LIVE_CAPABILITIES);

/** A screen host scopes its capabilities to its own tree; unmounting it ends them. */
export const CapabilitiesProvider = CapabilitiesContext.Provider;

/** The nearest host's capabilities; live-match defaults when no host provides any. */
export const useCapabilities = (): Accessor<ScreenCapabilities> => useContext(CapabilitiesContext);
