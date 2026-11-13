// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Supply read: what we have on the board and what the bank can pay for.
 * Observations only — the deploy *policy* built on top lives in
 * `strategies/economy.ts`.
 */

import type { Square } from "chess.js";

import { placementToMap, type ScPiece } from "../../board/placement";
import { MAX_STORED_MATERIAL, incomeForTurn } from "../../rules/constants";
import type { PieceColor, ScFenSnapshot } from "../../model/types";
import { isMarineClustered } from "./marines";
import type { MaterialIntel } from "./types";

export const countType = (
  map: Map<Square, ScPiece>,
  color: PieceColor,
  type: ScPiece["type"],
): number => {
  let n = 0;
  for (const piece of map.values()) {
    if (piece.color === color && piece.type === type) n += 1;
  }
  return n;
};

/**
 * Deterministic bank estimate for snap-only callers (the live story passes the
 * real store via `ctx.storedFor`). Mirrors the story's 1-mineral start + income,
 * then subtracts one mineral per deployed unit beyond the Command Center (CC) as a rough spend
 * ledger. Never the source of truth — the host bank gates the actual debit.
 */
export const estimateStoredFor =
  (snap: ScFenSnapshot, _us: PieceColor) =>
  (color: PieceColor): number => {
    let stored = 1;
    for (let turn = 2; turn <= snap.turn; turn += 1) {
      stored += incomeForTurn(turn);
    }
    let deployed = 0;
    for (const piece of placementToMap(snap.placement).values()) {
      if (piece.color === color) deployed += 1;
    }
    return Math.min(
      MAX_STORED_MATERIAL,
      Math.max(0, stored - Math.max(0, deployed - 1)),
    );
  };

export const buildMaterialIntel = (
  map: Map<Square, ScPiece>,
  us: PieceColor,
  storedFor: (color: PieceColor) => number,
): MaterialIntel => ({
  bank: storedFor(us),
  ownMechas: countType(map, us, "b"),
  ownHoverbikes: countType(map, us, "n"),
  congested: isMarineClustered(map, us),
});
