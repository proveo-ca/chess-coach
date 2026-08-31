/**
 * Arena-owned CC (Command Center) search state — threads the strategic
 * adjutant's CC guess across settled plies, per side.
 *
 * The strategic script reads `SideContext.ccIntel` (thrown into
 * `StrategicAdjutantContext.ccIntel`); the arena updates after every
 * settled ply from the *resolved* board via `getCCBestGuess`.
 * When a Hoverbike is sent to the guessed CC square (e.g. `e8`) and finds
 * it empty, that square is proven `not CC` and the posterior becomes
 * `Adj(e8) \ VisibleEmpty` (probabilistically adjacent to e8, minus all
 * lit empty squares).
 *
 * Deterministic and stateless (input/output only — the runner owns the value).
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml
 */

import type { Square } from "chess.js";

import {
  emptyCCIntel,
  getCCBestGuess,
  placementToMap,
  type CCIntel,
  type PieceColor,
  type ScFenSnapshot,
  type ScPiece,
} from "@chess-coach/starchess-core";
import { getSideVision } from "@chess-coach/starchess-core";

export type { CCIntel };

export type CcIntelState = {
  perSide: { w: CCIntel; b: CCIntel };
};

export const seedCcIntelForOpening = (opening: ScFenSnapshot): CcIntelState => ({
  perSide: {
    w: emptyCCIntel("b"),
    b: emptyCCIntel("w"),
  },
});

export const updateCcIntelForSnap = (
  state: CcIntelState,
  snap: ScFenSnapshot,
): CcIntelState => {
  const perSide: CcIntelState["perSide"] = {
    w: { ...state.perSide.w, excluded: new Set(state.perSide.w.excluded), dist: new Map(state.perSide.w.dist) },
    b: { ...state.perSide.b, excluded: new Set(state.perSide.b.excluded), dist: new Map(state.perSide.b.dist) },
  };
  const map = placementToMap(snap.placement);
  for (const side of ["w", "b"] as const) {
    const enemy = side === "w" ? "b" : "w";
    const vision = getSideVision(snap.placement, side);
    perSide[side] = getCCBestGuess(
      state.perSide[side],
      map as unknown as Map<Square, ScPiece>,
      vision.litSquares as unknown as ReadonlySet<Square>,
      vision.revealedPieces as unknown as ReadonlySet<Square>,
      null,
      enemy as any,
    );
  }
  return { perSide };
};
