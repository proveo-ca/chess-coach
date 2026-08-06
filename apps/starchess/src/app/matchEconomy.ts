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
  toClassicFen,
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

/** Gas does not bank — remaining = snap.gas[viewer] (refills each turn from SCFEN). */
export const energyRemaining = (store: MatchStore) => {
  const snap = store.state().liveSnapshot;
  return Math.max(0, snap.gas[viewerColor(store)] ?? 0);
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
