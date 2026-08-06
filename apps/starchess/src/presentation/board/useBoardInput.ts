/**
 * Snapshot-driven board input — queues classical moves / spawn / Charon / Jump.
 * Last-rank pawn moves open {@link PromotionModal} instead of auto-queuing queen.
 * Timeout / End flushes a pending promotion as queen (see SUBMIT_TURN).
 */
import type { Square } from "chess.js";
import { createMemo } from "solid-js";
import {
  UNIT_COST,
  adjacentSquares,
  placementToMap,
  scMovesFrom,
} from "@chess-coach/starchess-core";

import { useMatchStore } from "~/app/MatchStoreContext";
import { canSubmit, displayedSnapshot } from "~/app/selectors";
import type { PromotionPiece } from "~/types/chess";

export const useBoardInput = () => {
  const store = useMatchStore();
  const pendingPromotion = createMemo(() => store.state().pendingPromotion);

  const clearSelection = () => {
    store.dispatch({ type: "SELECT_SQUARE", square: null });
    store.dispatch({ type: "SET_LEGAL_DESTS", dests: [] });
  };

  const queueClassical = (
    from: Square,
    to: Square,
    color: "w" | "b",
    promotion?: PromotionPiece,
  ) => {
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color,
        from,
        to,
        ...(promotion ? { promotion } : {}),
      },
    });
  };

  const resolvePromotion = (piece: PromotionPiece) => {
    const pending = pendingPromotion();
    if (!pending) return;
    store.dispatch({ type: "CLEAR_PENDING_PROMOTION" });
    queueClassical(pending.from, pending.to, pending.color, piece);
  };

  const cancelPromotion = () => {
    store.dispatch({ type: "CLEAR_PENDING_PROMOTION" });
    // Keep selection / dests so the player can re-pick or cancel the move.
  };

  const onSquareClick = (square: Square) => {
    const state = store.state();
    if (!canSubmit(state)) return;
    if (state.pendingPromotion) return; // modal owns the click until resolved/cancelled

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

    if (state.targeting?.kind === "bishopSnipe") {
      const t = state.targeting;
      if (square !== t.to) return; // stay armed on miss-clicks
      const timing = state.liveSnapshot.queue?.actions.some(
        (a) => a.color === t.color && a.timing === "C",
      )
        ? "F"
        : "B";
      const before = store.state().liveSnapshot;
      store.dispatch({
        type: "QUEUE_ACTION",
        action: {
          timing,
          kind: "bishopSnipe",
          color: t.color,
          from: t.from,
          to: t.to,
        },
      });
      if (store.state().liveSnapshot === before) return;
      store.dispatch({ type: "MARK_SPECIAL_USED", square: t.from });
      store.dispatch({
        type: "QUEUE_REJECT",
        message: `Charon Booster Missiles ${t.from}→${t.to} queued · End to fire`,
      });
      return;
    }

    if (state.targeting?.kind === "queenWarp") {
      const t = state.targeting;
      if (!t.targets.includes(square)) return; // stay armed on miss-clicks
      const timing = state.liveSnapshot.queue?.actions.some(
        (a) => a.color === t.color && a.timing === "C",
      )
        ? "F"
        : "B";
      const before = store.state().liveSnapshot;
      store.dispatch({
        type: "QUEUE_ACTION",
        action: {
          timing,
          kind: "queenWarp",
          color: t.color,
          from: t.from,
          to: square,
        },
      });
      if (store.state().liveSnapshot === before) return;
      store.dispatch({ type: "MARK_SPECIAL_USED", square: t.from });
      store.dispatch({
        type: "QUEUE_REJECT",
        message: `Tactical Jump ${t.from}→${square} queued · End to resolve`,
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
      clearSelection();
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
        clearSelection();
      }
      return;
    }

    const mover = map.get(selected);
    if (!mover) return;
    const move = scMovesFrom(map, selected, mover.color, {
      siegedRooks: [...state.siegedRooks],
    }).find((m) => m.to === square);

    if (move?.promotes) {
      store.dispatch({
        type: "SET_PENDING_PROMOTION",
        pending: {
          color: mover.color,
          from: selected,
          to: square,
        },
      });
      store.dispatch({
        type: "QUEUE_REJECT",
        message: `Promote ${selected}→${square} — pick a unit`,
      });
      return;
    }

    queueClassical(selected, square, mover.color);
  };

  return {
    onSquareClick,
    pendingPromotion,
    resolvePromotion,
    cancelPromotion,
  };
};
