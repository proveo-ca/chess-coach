/**
 * King Hunt SCFEN history — pure engine builders (no Solid / board UI).
 * Tank (rook) starts on **g6** in **tank** mode (already in place).
 *
 * Checks are **implicit** and **fog-gated by side vision** (not per-piece range):
 * attack geometry is unlimited on rays; HP chips only if the checking side can
 * see the king. A sieged tank’s 9×9 can light the king so a distant bishop’s
 * diagonal check counts.
 */

import {
  addScAction,
  endScTurn,
  parseScFen,
  type ScActionInput,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

/** Black hunts white: ka8, rg6 (tank), nc5, Ke4, bh2 — Nc5 sees/checks Ke4. */
export const KING_HUNT_START_SCFEN =
  "SCFEN|k7/8/6r1/2n5/4K3/8/7b/8|0|33|P|G:11:11|Q:w:;b:";

/**
 * Ownership reversed (live play as White hunter): Kh1, Nc5, ke4, Bh2 — no tank;
 * player deploys the Siege Tank. Nc5 sees ke4 — first End chips HP before flee.
 */
export const KING_HUNT_LIVE_START_SCFEN =
  "SCFEN|8/8/8/2N5/4k3/8/7B/7K|0|33|P|G:11:11|Q:w:;b:";

export type KingHuntStep = {
  caption: string;
  /** N specials (all B or all F) + ≤1 classical per side (SCFEN queue shape). */
  actions: readonly ScActionInput[];
};

/**
 * DualNav plies — no spare turn to walk the tank. Turn 0 sieges g6 while the
 * bishop relocates; next End Bg1+ uses siege side vision, then Rg6+ finishes.
 */
export const KING_HUNT_STEPS: readonly KingHuntStep[] = [
  {
    caption: "0. Nc5+ · HP−1 · Kd5 & B siege g6 + Bh2→g1",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "e4", to: "d5" },
      { timing: "B", kind: "rookSiege", color: "b", from: "g6" },
      { timing: "C", kind: "classical", color: "b", from: "h2", to: "g1" },
    ],
  },
  {
    caption: "1. Kxc5",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "d5", to: "c5" },
    ],
  },
  {
    caption: "2. Bg1+ via siege vision · HP−1 · Kc6",
    actions: [
      { timing: "C", kind: "classical", color: "w", from: "c5", to: "c6" },
    ],
  },
  {
    caption: "3. Sieged Rg6+ · HP−1 lethal · game over",
    actions: [],
  },
];

export const queueKingHuntStep = (
  snap: ScFenSnapshot,
  step: KingHuntStep,
): ScFenSnapshot => {
  let next: ScFenSnapshot = { ...snap, queue: { actions: [] } };
  for (const action of step.actions) {
    next = addScAction({ snapshot: next, action }).snapshot;
  }
  return next;
};

export const buildKingHuntPlys = (): ScFenSnapshot[] => {
  const plies: ScFenSnapshot[] = [parseScFen(KING_HUNT_START_SCFEN)];
  let cur = plies[0]!;
  for (const step of KING_HUNT_STEPS) {
    cur = endScTurn(queueKingHuntStep(cur, step)).next;
    plies.push(cur);
  }
  return plies;
};

export const KING_HUNT_PLY_SC: readonly ScFenSnapshot[] = buildKingHuntPlys();
