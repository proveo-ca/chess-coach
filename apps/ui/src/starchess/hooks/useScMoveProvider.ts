/**
 * UI adapter — implements {@link BoardMoveProvider} for StarChess.
 * Destinations from {@link scMovesFrom}; commit queues a C action and restores
 * the classic FEN to SCFEN placement (intent ghost, no relocate until End).
 *
 * // SPEC: _spec/apps/ui/starchess/sc-moves.puml
 */

import type { Color, Square } from "chess.js";
import { createMemo } from "solid-js";

import { placementToMap } from "~/starchess/board";
import { isRookSiegedAfterB } from "~/starchess/rookSiegeMode";
import { scMovesFrom } from "~/starchess/scMoves";
import { classicFenFromSc } from "~/starchess/scfen";
import {
  currentQueue,
  planningSnapshot,
  queueScAction,
  siegedRooks,
} from "~/starchess/starChessStore";
import type { BoardMoveProvider } from "~/types/board";
import type { PromotionPiece } from "~/types/chess";
import type { PieceSet } from "~/types/settings";
import { loadFen } from "~/store/gameStore";
import { activePlayerColor, opponentPieceSet, playerPieceSet } from "~/store/settingsStore";

const effectiveSieged = (from: Square, snapSieged: readonly Square[] | undefined): boolean =>
  isRookSiegedAfterB(from, snapSieged, currentQueue());

/**
 * Build an SC move provider bound to the live planning snap.
 * Call only when StarChess rules are active (fog / nerd board).
 */
export function useScMoveProvider(): BoardMoveProvider {
  const siegedAfterB = createMemo(() => {
    const snap = planningSnapshot();
    const base = snap?.siegedRooks ?? [...siegedRooks()];
    const set = new Set<Square>();
    const map = snap ? placementToMap(snap.placement) : null;
    if (!map) return set;
    for (const [sq, piece] of map) {
      if (piece.type !== "r") continue;
      if (effectiveSieged(sq, base)) set.add(sq);
    }
    return set;
  });

  const destinations = (from: Square): readonly string[] => {
    const snap = planningSnapshot();
    if (!snap || snap.phase !== "P") return [];
    const color = activePlayerColor();
    // ≤1 classical per side — no highlights once queued.
    if (snap.queue?.actions.some((a) => a.timing === "C" && a.color === color)) return [];
    const map = placementToMap(snap.placement);
    const moves = scMovesFrom(map, from, color, {
      siegedRooks: siegedAfterB(),
      mines: snap.mines,
    });
    // Filter dropsAtResolve — enemy-king squares burn the classical action.
    return moves.filter((m) => !m.dropsAtResolve).map((m) => m.to);
  };

  const commit = async (input: {
    from: Square;
    to: Square;
    requestPromotion: (color: Color, pieceSet: PieceSet) => Promise<PromotionPiece | null>;
  }): Promise<{ didMove: boolean; cancelled?: boolean }> => {
    const snap0 = planningSnapshot();
    if (!snap0 || snap0.phase !== "P") return { didMove: false };
    const color = activePlayerColor();
    if (snap0.queue?.actions.some((a) => a.timing === "C" && a.color === color)) {
      loadFen(classicFenFromSc(snap0));
      return { didMove: false };
    }
    const map0 = placementToMap(snap0.placement);
    const piece0 = map0.get(input.from);
    if (!piece0 || piece0.color !== color) return { didMove: false };

    const legal0 = scMovesFrom(map0, input.from, color, {
      siegedRooks: siegedAfterB(),
      mines: snap0.mines,
    }).find((m) => m.to === input.to && !m.dropsAtResolve);
    if (!legal0) return { didMove: false };

    let promotion: PromotionPiece | undefined;
    if (legal0.promotes) {
      const pieceSet =
        piece0.color === activePlayerColor() ? playerPieceSet() : opponentPieceSet();
      const choice = await input.requestPromotion(piece0.color, pieceSet);
      if (!choice) return { didMove: false, cancelled: true };
      promotion = choice;
    }

    // Re-read after the optional modal — turn may have advanced (timeout/End).
    const snap = planningSnapshot();
    if (!snap || snap.phase !== "P" || snap.turn !== snap0.turn) {
      if (snap) loadFen(classicFenFromSc(snap));
      return { didMove: false };
    }
    if (snap.queue?.actions.some((a) => a.timing === "C" && a.color === color)) {
      loadFen(classicFenFromSc(snap));
      return { didMove: false };
    }
    const map = placementToMap(snap.placement);
    const stillLegal = scMovesFrom(map, input.from, color, {
      siegedRooks: siegedAfterB(),
      mines: snap.mines,
    }).find((m) => m.to === input.to && !m.dropsAtResolve);
    if (!stillLegal) {
      loadFen(classicFenFromSc(snap));
      return { didMove: false };
    }

    try {
      const next = queueScAction({
        timing: "C",
        kind: "classical",
        color,
        from: input.from,
        to: input.to,
        ...(promotion ? { promotion } : {}),
      });
      loadFen(classicFenFromSc(next));
      return { didMove: true };
    } catch {
      const cur = planningSnapshot() ?? snap;
      loadFen(classicFenFromSc(cur));
      return { didMove: false };
    }
  };

  const canSelect = (square: Square): boolean => {
    const snap = planningSnapshot();
    if (!snap || snap.phase !== "P") return false;
    const color = activePlayerColor();
    if (snap.queue?.actions.some((a) => a.timing === "C" && a.color === color)) return false;
    const map = placementToMap(snap.placement);
    const piece = map.get(square);
    return !!piece && piece.color === color;
  };

  return {
    destinations,
    commit,
    canSelect,
    suppressHoverEval: true,
  };
}
