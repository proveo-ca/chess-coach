/**
 * Match-store selectors used by ResourceBar / TurnBar / GasDeploy.
 * Replaces apps/ui starChessStore reads for the standalone app.
 */
import {
  MAX_DEPLOYED_MATERIAL,
  canClassicalPawnDouble,
  deployedMaterialFromPlacement,
  energyForTurn,
  incomeForTurn,
  specialGasCost,
  toClassicFen,
  type ScAction,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { MatchStore } from "~/app/MatchStoreContext";
import { displayedSnapshot } from "~/app/selectors";

export const viewerColor = (store: MatchStore): StarChessColor => store.state().viewer;

export const storedMaterial = (store: MatchStore) =>
  store.state().economies[viewerColor(store)].stored;

export const materialIncome = (store: MatchStore) =>
  incomeForTurn(Math.max(1, store.state().liveSnapshot.turn));

export const energyCapacity = (store: MatchStore) =>
  energyForTurn(Math.max(1, store.state().liveSnapshot.turn));

/**
 * Display remaining vespene for a side.
 *
 * `snap.gas` is already net of `snap.queue` spends (`addScAction`). DualNav
 * intent may overlay reconstructed specials that are **not** on the snap —
 * debit those so ResourceBar matches GasDeploy when ghost canisters render.
 */
export const gasRemainingFor = (
  snap: Pick<ScFenSnapshot, "gas" | "queue">,
  color: StarChessColor,
  overlayActions?: readonly ScAction[] | null,
): number => {
  let rem = Math.max(0, snap.gas[color] ?? 0);
  if (!overlayActions?.length) return rem;
  const onSnap = new Set((snap.queue?.actions ?? []).map((a) => a.seq));
  for (const a of overlayActions) {
    if (a.color !== color || a.timing === "C") continue;
    if (onSnap.has(a.seq)) continue;
    rem -= specialGasCost(a.kind);
  }
  return Math.max(0, rem);
};

/** Gas does not bank — remaining refills at turn-open from gasIncome. */
export const energyRemaining = (store: MatchStore) => {
  const snap = store.state().liveSnapshot;
  return gasRemainingFor(snap, viewerColor(store), store.reviewIntentActions());
};

export const maxDeployedSupply = MAX_DEPLOYED_MATERIAL;

export const deployedMaterial = (store: MatchStore) => {
  try {
    return deployedMaterialFromPlacement(
      displayedSnapshot(store.state()).placement,
      viewerColor(store),
    );
  } catch {
    return 0;
  }
};

export const hasUsedSpecialThisTurn = (store: MatchStore, square: Square) =>
  store.state().specialsUsed.has(square);

export const classicFenForViewer = (store: MatchStore) => {
  const snap = displayedSnapshot(store.state());
  return toClassicFen(snap.placement, viewerColor(store), 0, Math.max(1, snap.turn));
};

export const canPawnDoubleFree = (store: MatchStore, square: Square) => {
  try {
    return canClassicalPawnDouble(classicFenForViewer(store), square);
  } catch {
    return false;
  }
};

export const currentQueue = (store: MatchStore) =>
  store.state().liveSnapshot.queue?.actions ?? [];

export const turnDeadlineAt = (store: MatchStore) => store.state().deadlineAt;

export const turnSecondsRemaining = (store: MatchStore, now = Date.now()) => {
  const at = store.state().deadlineAt;
  if (at == null) return 0;
  return Math.max(0, Math.ceil((at - now) / 1000));
};
