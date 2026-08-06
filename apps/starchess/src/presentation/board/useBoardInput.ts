/**
 * Snapshot-driven board input — queues classical moves / spawn via match aggregate.
 */
import type { Square } from "chess.js";
import {
  UNIT_COST,
  adjacentSquares,
  placementToMap,
  scMovesFrom,
} from "@chess-coach/starchess-core";

import { useMatchStore } from "~/app/MatchStoreContext";
import { canSubmit, displayedSnapshot } from "~/app/selectors";

export const useBoardInput = () => {
  const store = useMatchStore();

  const onSquareClick = (square: Square) => {
    const state = store.state();
    if (!canSubmit(state)) return;

    if (state.targeting?.kind === "spawn") {
      const color = state.targeting.color;
      const unit = state.targeting.unit;
      const map = placementToMap(state.liveSnapshot.placement);
      const kingSq = [...map.entries()].find(
        ([, p]) => p.type === "k" && p.color === color,
      )?.[0];
      if (!kingSq) return;
      const occupied = new Set(map.keys());
      if (!adjacentSquares(kingSq, occupied).includes(square)) return;
      const cost = UNIT_COST[unit];
      const before = state.economies[color].stored;
      store.dispatch({ type: "SPEND_STORED", color, amount: cost });
      if (store.state().economies[color].stored === before) return;
      store.dispatch({
        type: "QUEUE_ACTION",
        action: {
          timing: state.liveSnapshot.queue?.actions.some(
            (a) => a.color === color && a.timing === "C",
          )
            ? "F"
            : "B",
          kind: "spawn",
          color,
          from: kingSq,
          to: square,
          unit,
        },
      });
      if (store.state().targeting) {
        store.dispatch({ type: "REFUND_STORED", color, amount: cost });
        return;
      }
      store.dispatch({ type: "MARK_SPECIAL_USED", square: kingSq });
      return;
    }

    const selected = state.selected;
    const map = placementToMap(displayedSnapshot(state).placement);
    const piece = map.get(square);

    if (!selected) {
      if (!piece || piece.color !== state.viewer) {
        store.dispatch({ type: "SELECT_SQUARE", square: null });
        return;
      }
      const moves = scMovesFrom(map, square, piece.color, {
        siegedRooks: [...state.siegedRooks],
      });
      store.dispatch({ type: "SELECT_SQUARE", square });
      store.dispatch({
        type: "SET_LEGAL_DESTS",
        dests: moves.map((m) => m.to),
      });
      return;
    }

    if (selected === square) {
      store.dispatch({ type: "SELECT_SQUARE", square: null });
      store.dispatch({ type: "SET_LEGAL_DESTS", dests: [] });
      return;
    }

    if (!state.legalDests.includes(square)) {
      if (piece && piece.color === state.viewer) {
        const moves = scMovesFrom(map, square, piece.color, {
          siegedRooks: [...state.siegedRooks],
        });
        store.dispatch({ type: "SELECT_SQUARE", square });
        store.dispatch({
          type: "SET_LEGAL_DESTS",
          dests: moves.map((m) => m.to),
        });
      } else {
        store.dispatch({ type: "SELECT_SQUARE", square: null });
        store.dispatch({ type: "SET_LEGAL_DESTS", dests: [] });
      }
      return;
    }

    const mover = map.get(selected);
    if (!mover) return;
    const move = scMovesFrom(map, selected, mover.color, {
      siegedRooks: [...state.siegedRooks],
    }).find((m) => m.to === square);

    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color: mover.color,
        from: selected,
        to: square,
        ...(move?.promotes ? { promotion: move.promotion ?? "q" } : {}),
      },
    });
  };

  return { onSquareClick };
};
