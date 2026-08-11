// SPEC: _spec/apps/starchess/core/board/planning-projection.puml, _spec/apps/starchess/core/engine-boundary.puml
import type { Square } from "chess.js";
import { createMemo } from "solid-js";
import {
  UNIT_COST,
  adjacentSquares,
  placementToMap,
  scMovesFrom,
  spawnKingAnchor,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { playerFogOccultsMoves } from "~/app/intentOverlayPolicy";
import { useMatchStore } from "~/app/MatchStoreContext";
import { canSubmit, displayedSnapshot } from "~/app/selectors";
import {
  isViewerBRelocateOrigin,
  occupancyForQueuedMoves,
  pieceAtQueuedSquare,
} from "~/presentation/board/occupancyForQueuedMoves";
import { occupancyForViewerMoves } from "~/presentation/board/occupancyForViewerMoves";
import { rookModeForSieged } from "~/presentation/board/rookMode";
import { useBoardVision } from "~/presentation/combat/hooks/useIntentOverlays";
import type { VisionMode } from "~/types/board";
import type { PromotionPiece } from "~/types/chess";

/**
 * Gas then same-vector classical (B e6→e7 + C e6→e7) rewrites to e7→e8.
 * That stack is how a stim+step reaches the last rank in one End — open the
 * picker and attach `promotion` on the pre-rewrite C (core rewrite keeps it).
 */
export const gasStackPromotes = (
  snap: ScFenSnapshot,
  color: StarChessColor,
  from: Square,
  to: Square,
): boolean => {
  const b = (snap.queue?.actions ?? []).find(
    (a) =>
      a.timing === "B" &&
      a.kind === "pawnDouble" &&
      a.color === color &&
      a.from === from &&
      a.to === to,
  );
  if (!b?.to) return false;
  const dir = color === "w" ? 1 : -1;
  const land = Number(to[1]) + dir;
  return land === (color === "w" ? 8 : 1);
};

/**
 * Classical mid-step already queued (C from→mid) + gas on the same vector would
 * F-step from mid onto the last rank — parks a marine with no picker.
 * Caller should peel C, queue B, and open {@link PromotionModal}.
 */
export const moveThenGasPromotes = (
  snap: ScFenSnapshot,
  color: StarChessColor,
  from: Square,
  gasTo: Square,
): { seq: number } | null => {
  const c = (snap.queue?.actions ?? []).find(
    (a) =>
      a.timing === "C" &&
      a.kind === "classical" &&
      a.color === color &&
      a.from === from &&
      a.to === gasTo,
  );
  if (!c || c.timing !== "C") return null;
  const dir = color === "w" ? 1 : -1;
  const land = Number(gasTo[1]) + dir;
  if (land !== (color === "w" ? 8 : 1)) return null;
  return { seq: c.seq };
};

/**
 * @param visionOverrides — same optional fog / visionMode overrides as
 *   {@link useBoardVision} / LiveStarChessBoard (maps gallery fog-off, etc.).
 *   Live play defaults: fog on + player → occulted occupancy always.
 */
export const useBoardInput = (
  visionOverrides?: () => { fog?: boolean; visionMode?: VisionMode },
) => {
  const store = useMatchStore();
  const vision = useBoardVision(store, visionOverrides);
  const pendingPromotion = createMemo(() => store.state().pendingPromotion);

  const clearSelection = () => {
    store.dispatch({ type: "SELECT_SQUARE", square: null });
    store.dispatch({ type: "SET_LEGAL_DESTS", dests: [] });
  };

  /** Pre-B fog map + viewer B projection (spawn / gas / warp) + post-B siege. */
  const planningMoves = (state: ReturnType<typeof store.state>) => {
    const snap = displayedSnapshot(state);
    const raw = placementToMap(snap.placement);
    return occupancyForQueuedMoves(
      raw,
      state.viewer,
      playerFogOccultsMoves(vision()),
      snap,
      state.siegedRooks,
    );
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
    if (pending.via === "gas") {
      store.dispatch({
        type: "QUEUE_ACTION",
        action: {
          timing: "B",
          kind: "pawnDouble",
          color: pending.color,
          from: pending.from,
          to: pending.to,
          promotion: piece,
        },
      });
      store.dispatch({ type: "MARK_SPECIAL_USED", square: pending.from });
      return;
    }
    queueClassical(pending.from, pending.to, pending.color, piece);
  };

  const cancelPromotion = () => {
    store.dispatch({ type: "CLEAR_PENDING_PROMOTION" });
  };

  const onSquareClick = (square: Square) => {
    const state = store.state();
    if (!canSubmit(state)) return;
    if (state.pendingPromotion) return;

    if (state.targeting?.kind === "spawn") {
      const color = state.targeting.color;
      const unit = state.targeting.unit;
      const map = placementToMap(state.liveSnapshot.placement);
      const kingSq = [...map.entries()].find(
        ([, p]) => p.type === "k" && p.color === color,
      )?.[0];
      if (!kingSq) return;
      const timing = state.liveSnapshot.queue?.actions.some(
        (a) => a.color === color && a.timing === "C",
      )
        ? "F"
        : "B";
      const { king: anchor, occupied } = spawnKingAnchor(
        state.liveSnapshot,
        color,
        timing,
      );
      if (!anchor || !adjacentSquares(anchor, occupied).includes(square)) return;
      const cost = UNIT_COST[unit];
      const before = state.economies[color].stored;
      store.dispatch({ type: "SPEND_STORED", color, amount: cost });
      if (store.state().economies[color].stored === before) return;
      store.dispatch({
        type: "QUEUE_ACTION",
        action: {
          timing,
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
      if (square !== t.to) return;
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
      if (!t.targets.includes(square)) return;
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
    const snap = displayedSnapshot(state);
    const raw = placementToMap(snap.placement);
    const actions = snap.queue?.actions;
    const { map: postBMap, siegedRooks } = planningMoves(state);
    // Gas/warp origin: legal dests from pre-B occupancy (engine rewrite stack).
    // Landing / spawn: legal dests from post-B occupancy.
    const mapFor = (from: Square) => {
      if (isViewerBRelocateOrigin(from, state.viewer, actions)) {
        return occupancyForViewerMoves(
          raw,
          state.viewer,
          playerFogOccultsMoves(vision()),
          { rookModeFor: rookModeForSieged(siegedRooks) },
        );
      }
      return postBMap;
    };
    const piece =
      pieceAtQueuedSquare(raw, square, state.viewer, actions) ??
      raw.get(square) ??
      null;

    if (!selected) {
      if (!piece || piece.color !== state.viewer) {
        store.dispatch({ type: "SELECT_SQUARE", square: null });
        return;
      }
      const map = mapFor(square);
      const moves = scMovesFrom(map, square, piece.color, { siegedRooks });
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
        const map = mapFor(square);
        const moves = scMovesFrom(map, square, piece.color, { siegedRooks });
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

    const mover =
      pieceAtQueuedSquare(raw, selected, state.viewer, actions) ??
      raw.get(selected) ??
      null;
    if (!mover) return;
    const map = mapFor(selected);
    const move = scMovesFrom(map, selected, mover.color, { siegedRooks }).find(
      (m) => m.to === square,
    );

    const needsPromo =
      !!move?.promotes ||
      (mover.type === "p" &&
        gasStackPromotes(state.liveSnapshot, mover.color, selected, square));

    if (needsPromo) {
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
