import type { Square } from "chess.js";

import { scMovesFrom, placementToMap } from "@chess-coach/starchess-core";

import { useMatchStore } from "~/app/MatchStoreContext";
import { canSubmit, displayedSnapshot } from "~/app/selectors";

/**
 * Snapshot-driven board input — queues classical moves via the match aggregate.
 * No gameStore / useChessBoard.
 */
export const useBoardInput = () => {
  const store = useMatchStore();

  const onSquareClick = (square: Square) => {
    const state = store.state();
    if (!canSubmit(state)) return;

    if (state.targeting?.kind === "spawn") {
      const kingSq = [...placementToMap(state.liveSnapshot.placement).entries()].find(
        ([, p]) => p.type === "k" && p.color === state.targeting!.color,
      )?.[0];
      if (!kingSq) return;
      store.dispatch({
        type: "QUEUE_ACTION",
        action: {
          timing: "B",
          kind: "spawn",
          color: state.targeting.color,
          from: kingSq,
          to: square,
          unit: state.targeting.unit,
        },
      });
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
