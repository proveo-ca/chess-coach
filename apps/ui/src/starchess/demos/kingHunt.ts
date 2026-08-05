/**
 * King Hunt SCFEN history — pure engine builders (no Solid / board UI).
 * Tank (rook) starts on **g6** in **tank** mode (already in place).
 *
 * Checks are **implicit** and **fog-gated by side vision** (not per-piece range):
 * attack geometry is unlimited on rays; HP chips only if the checking side can
 * see the king. A sieged tank’s 9×9 can light the king so a distant bishop’s
 * diagonal check counts.
 */

import { findKing, placementToMap } from "~/starchess/board";
import { UNIT_COST } from "~/starchess/constants";
import { addScAction, addScMove, AddScActionError } from "~/starchess/scActions";
import { endScTurn } from "~/starchess/endScTurn";
import { classicFenFromSc, formatScFen, parseScFen } from "~/starchess/scfen";
import type { PieceColor, ScActionInput, ScFenSnapshot } from "~/starchess/types";

/** Black hunts white: ka8, rg6 (tank), nc5, Ke4, bh2 — Nc5 sees/checks Ke4. */
export const KING_HUNT_START_SCFEN =
  "SCFEN|k7/8/6r1/2n5/4K3/8/7b/8|0|33|P|G:11:11|Q:w:;b:";

/**
 * Ownership reversed (live play as White hunter): Ka8, Nc5, ke4, Bh2 — no tank;
 * player deploys the Siege Tank. Nc5 sees ke4 — first End chips HP before flee.
 */
export const KING_HUNT_LIVE_START_SCFEN =
  "SCFEN|K7/8/8/2N5/4k3/8/7B/8|0|33|P|G:11:11|Q:w:;b:";

export type KingHuntStep = {
  caption: string;
  /** ≤1 special + ≤1 classical per side (SCFEN queue shape). */
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

/** @deprecated Prefer KING_HUNT_PLY_SC */
export const KING_HUNT_PLY_FENS = KING_HUNT_PLY_SC.map((snap, ply) => ({
  ply,
  fen: classicFenFromSc(snap, "w"),
  scfen: formatScFen(snap),
  lives: snap.kingLives.w,
}));

export type KingHuntLiveOpponentResult = {
  snapshot: ScFenSnapshot;
  /** Minerals to debit when a spawn was queued (Command Center deploy). */
  spendMinerals?: { color: PieceColor; amount: number };
};

/**
 * Live enemy (black) script — DualNav defender path (e4→d5→c5→c6) plus, once
 * on c5: spawn a marine on c4, gas-double to c2, then promote c2→c1=q.
 * No-ops if black already has a queued action.
 */
export const queueKingHuntLiveOpponent = (
  snap: ScFenSnapshot,
): KingHuntLiveOpponentResult => {
  if (snap.phase !== "P") return { snapshot: snap };
  if (snap.queue?.actions.some((a) => a.color === "b")) return { snapshot: snap };

  const map = placementToMap(snap.placement);
  const king = findKing(map, "b");
  if (!king) return { snapshot: snap };

  const tryQueue = (build: (s: ScFenSnapshot) => ScFenSnapshot): ScFenSnapshot | null => {
    try {
      return build({ ...snap, queue: snap.queue ?? { actions: [] } });
    } catch (e) {
      if (e instanceof AddScActionError) return null;
      throw e;
    }
  };

  if (king === "e4") {
    const next = tryQueue((s) => addScMove(s, { color: "b", from: "e4", to: "d5" }));
    if (next) return { snapshot: next };
  }
  if (king === "d5") {
    const next = tryQueue((s) => addScMove(s, { color: "b", from: "d5", to: "c5" }));
    if (next) return { snapshot: next };
  }

  if (king === "c5") {
    const pawnC4 = map.get("c4");
    const pawnC2 = map.get("c2");
    const queenC1 = map.get("c1");

    if (!pawnC4 && !pawnC2 && !(queenC1 && queenC1.color === "b")) {
      const next = tryQueue((s) =>
        addScAction({
          snapshot: s,
          action: {
            timing: "B",
            kind: "spawn",
            color: "b",
            from: "c5",
            to: "c4",
            unit: "p",
          },
        }).snapshot,
      );
      if (next) {
        return {
          snapshot: next,
          spendMinerals: { color: "b", amount: UNIT_COST.p },
        };
      }
    }

    if (pawnC4?.type === "p" && pawnC4.color === "b" && !map.has("c2")) {
      const next = tryQueue((s) =>
        addScAction({
          snapshot: s,
          action: {
            timing: "B",
            kind: "pawnDouble",
            color: "b",
            from: "c4",
            to: "c2",
          },
        }).snapshot,
      );
      if (next) return { snapshot: next };
    }

    if (pawnC2?.type === "p" && pawnC2.color === "b" && !map.has("c1")) {
      const next = tryQueue((s) =>
        addScMove(s, { color: "b", from: "c2", to: "c1", promotion: "q" }),
      );
      if (next) return { snapshot: next };
    }

    const next = tryQueue((s) => addScMove(s, { color: "b", from: "c5", to: "c6" }));
    if (next) return { snapshot: next };
  }

  return { snapshot: snap };
};
