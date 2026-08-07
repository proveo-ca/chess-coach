/**
 * Shared DualNav scenario package — stories feed this into FogEdgeDemo only.
 * // SPEC: _spec/apps/starchess/demos.puml
 */
import type { ScFenSnapshot } from "@chess-coach/starchess-core";

import type { VisionMode } from "~/types/board";

export type FogEdgeScenarioStep = {
  caption: string;
  intentCaption?: string;
};

export type FogEdgeScenario = {
  plies: readonly ScFenSnapshot[];
  steps: readonly FogEdgeScenarioStep[];
  startCaption: string;
  queueStep: (snap: ScFenSnapshot, stepIndex: number) => ScFenSnapshot;
  /** Force tank mode on all rooks (fog-edge rook story). */
  rookTank?: boolean;
  /** Review label prefix (default "Fog edge"). */
  reviewLabel?: string;
  /**
   * Review DualNav: `observer` = full board + dual vision borders (default for
   * non-fog demos). Fog-of-war move stories keep `player` + fog veil.
   */
  visionMode?: VisionMode;
  /** Player fog veil — off under observer review. Default true for fog samples. */
  fog?: boolean;
};
