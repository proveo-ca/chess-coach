/**
 * Shared DualNav scenario package — stories feed this into FogEdgeDemo only.
 * // SPEC: _spec/apps/ui/starchess/scfen.md §5
 */

import type { ScFenSnapshot } from "~/types/starchess";

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
};
