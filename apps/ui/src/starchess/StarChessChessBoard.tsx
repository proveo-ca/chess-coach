import type { Component, ComponentProps } from "solid-js";
import { createEffect, createMemo, createSignal, mergeProps, splitProps } from "solid-js";
import type { Square } from "chess.js";

import { useStarChessNativeMoves } from "~/starchess/hooks/useStarChessNativeMoves";
import { migrateSpecialUsed } from "~/starchess/starChessStore";
import { ChessBoard } from "~/components/features/ChessBoard";
import { currentIndex, game, moveHistory } from "~/store/gameStore";
import type { MoveSquares } from "~/types/game";

export type StarChessChessBoardProps = ComponentProps<typeof ChessBoard>;

/**
 * StarChess board — thin extension of shared {@link ChessBoard}.
 * Turns classical gameStore moves into {@link MoveAnimation} cues (knight L-path)
 * so fog / Nerd stories stay config-only. Parent-provided `moveCues` (combat
 * resolve) suppress native synthesis.
 *
 * Cue props are merged with getters ({@link mergeProps}) so updates stay reactive
 * into ChessBoard — `{...props} moveCues={...}` can freeze the first empty array.
 */
export const StarChessChessBoard: Component<StarChessChessBoardProps> = (props) => {
  const [animProps, rest] = splitProps(props, ["moveCues", "moveProgress", "moveLeg"]);
  const [queue, setQueue] = createSignal<MoveSquares[]>([]);
  const [enqueuedKey, setEnqueuedKey] = createSignal<string | null>(null);

  const parentOwnsMoves = createMemo(() => (animProps.moveCues?.length ?? 0) > 0);

  createEffect(() => {
    if (parentOwnsMoves()) {
      setQueue([]);
      setEnqueuedKey(null);
      return;
    }

    const idx = currentIndex();
    const hist = moveHistory();
    if (idx <= 0) {
      setQueue([]);
      setEnqueuedKey(null);
      return;
    }

    const m = hist[idx - 1];
    if (!m?.from || !m?.to) return;

    const key = `${idx}:${m.from}-${m.to}`;
    if (key === enqueuedKey()) return;

    setEnqueuedKey(key);
    migrateSpecialUsed(m.from as Square, m.to as Square);
    setQueue((q) => [...q, m]);
  });

  const native = useStarChessNativeMoves({
    enabled: () => !parentOwnsMoves(),
    suppressed: () => parentOwnsMoves(),
    animationQueue: queue,
    consumeAnimation: (m) => {
      setQueue((q) =>
        q.length && q[0]?.from === m.from && q[0]?.to === m.to ? q.slice(1) : q,
      );
    },
    pieceAt: (sq: Square) => game().get(sq),
  });

  const boardProps = mergeProps(rest, {
    get moveCues() {
      return parentOwnsMoves() ? (animProps.moveCues ?? []) : native.moveCues();
    },
    get moveProgress() {
      return parentOwnsMoves() ? (animProps.moveProgress ?? {}) : native.moveProgress();
    },
    get moveLeg() {
      return parentOwnsMoves() ? (animProps.moveLeg ?? {}) : native.moveLeg();
    },
  });

  return <ChessBoard {...boardProps} />;
};
