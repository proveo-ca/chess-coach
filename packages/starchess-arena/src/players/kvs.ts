/**
 * Arena-owned known-vs-seen accumulator — threads the strategic adjutant's
 * material model across settled plies, per side.
 *
 * The strategic script reads `SideContext.kvs` (thrown straight into
 * `StrategicAdjutantContext.kvs`); the app host does the same for browser
 * play. The arena updates after every settled ply from the *resolved* board:
 *
 *   - `known`    — core's income ledger (`knownForTurn`) for the opponent.
 *   - `scouted`  — cumulative enemy material we have *seen* (lit/revealed via
 *                  `getSideVision`); keeps a non-decreasing upper bound so an
 *                  emptied board never erases material we once accounted for.
 *   - `captured` — cumulative enemy material removed, estimated from the
 *                  opponent's deployed-material *deficit* delta between plies.
 *                  This is an estimator, not an exact capture count: an enemy
 *                  spawn/promotion in the same ply can mask a real capture
 *                  (net delta near zero), so `captured` never exceeds deployed
 *                  loss and may undercount in busy plies (Phase-1 heuristic).
 *
 * Deterministic and stateless (input/output only — the runner owns the value).
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml
 */

import {
  UNIT_COST,
  combineKnownVsSeen,
  deployedMaterialFromPlacement,
  getSideVision,
  knownForTurn,
  placementToMap,
  type KnownVsSeen,
  type PieceColor,
  type ScFenSnapshot,
  type Square,
} from "@chess-coach/starchess-core";

export type { PieceColor, ScFenSnapshot, KnownVsSeen };

/** Per-side accumulator plus the opponent's deployed value seen last ply. */
export type KvsState = {
  perSide: { w: KnownVsSeen; b: KnownVsSeen };
  lastDeployed: { w: number; b: number };
};

/** A fresh account at the opening: nothing seen/captured yet. */
export const seedKvsForOpening = (opening: ScFenSnapshot): KvsState => ({
  perSide: {
    w: combineKnownVsSeen(knownForTurn(0), 0, 0),
    b: combineKnownVsSeen(knownForTurn(0), 0, 0),
  },
  lastDeployed: {
    w: deployedMaterialFromPlacement(opening.placement, "b"),
    b: deployedMaterialFromPlacement(opening.placement, "w"),
  },
});

/** Enemy material value `side` currently sees (lit or revealed). */
const visibleEnemyValue = (snap: ScFenSnapshot, side: "w" | "b"): number => {
  const vision = getSideVision(snap.placement, side);
  let total = 0;
  for (const sq of [...vision.litSquares, ...vision.revealedPieces]) {
    const piece = placementToMap(snap.placement).get(sq as Square);
    if (piece && piece.color !== side) total += UNIT_COST[piece.type];
  }
  return total;
};

/** Enemy deployed-material value for `side` (opposite color). */
const enemyDeployed = (snap: ScFenSnapshot, side: "w" | "b"): number =>
  deployedMaterialFromPlacement(snap.placement, side === "w" ? "b" : "w");

/**
 * Fold one settled snap into the account, per side. Deterministic: same snap →
 * same fold. Call exactly once per recorded ply.
 */
export const updateKvsForSnap = (
  state: KvsState,
  snap: ScFenSnapshot,
): KvsState => {
  const perSide: KvsState["perSide"] = {
    w: { ...state.perSide.w },
    b: { ...state.perSide.b },
  };
  const lastDeployed = { ...state.lastDeployed };

  for (const side of ["w", "b"] as const) {
    const now = enemyDeployed(snap, side);
    const shown = visibleEnemyValue(snap, side);
    const prev = perSide[side];

    const scouted = Math.max(prev.scouted, shown);
    const captured =
      prev.captured + Math.max(0, lastDeployed[side] - now);
    lastDeployed[side] = now;

    perSide[side] = combineKnownVsSeen(
      knownForTurn(snap.turn),
      scouted,
      captured,
    );
  }

  return { perSide, lastDeployed };
};