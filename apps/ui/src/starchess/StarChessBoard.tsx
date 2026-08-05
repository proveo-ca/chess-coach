import type { Component, ComponentProps } from "solid-js";
import { createEffect, createMemo, createSignal, mergeProps, splitProps } from "solid-js";
import type { Square } from "chess.js";

import {
  StarChessBoardView,
} from "~/starchess/board/StarChessBoardView";
import { useAutoDeploy, pieceMapFromBoard } from "~/starchess/hooks/useAutoDeploy";
import { useStarChessNativeMoves } from "~/starchess/hooks/useStarChessNativeMoves";
import { migrateSpecialUsed } from "~/starchess/starChessStore";
import { currentIndex, game, moveHistory } from "~/store/gameStore";
import type { MoveSquares } from "~/types/game";
import type { DeployCue } from "~/starchess/types";

export type StarChessBoardProps = ComponentProps<typeof StarChessBoardView> & {
  /**
   * When true, re-baseline occupancy without firing deploy VFX (DualNav scrub /
   * full-position jumps). Live adds still animate when this is false.
   */
  suppressAutoDeploy?: boolean;
  /**
   * When true, never synthesize MoveAnimation from classical gameStore history.
   * Live NerdScreen planning uses this so queued intent stays a ghost until End
   * resolve (combat `moveCues` still play). DualNav review leaves this off.
   */
  suppressNativeMoves?: boolean;
};

/**
 * StarChess board — native move synthesis + auto-deploy on top of
 * {@link StarChessBoardView} (owns fog vision, combat overlays, mines).
 *
 * Cue props are merged with getters ({@link mergeProps}) so updates stay reactive —
 * `{...props} moveCues={...}` can freeze the first empty array.
 */
export const StarChessBoard: Component<StarChessBoardProps> = (props) => {
  const [animProps, rest] = splitProps(props, [
    "moveCues",
    "moveProgress",
    "moveLeg",
    "deployCues",
    "suppressAutoDeploy",
    "suppressNativeMoves",
  ]);
  const [queue, setQueue] = createSignal<MoveSquares[]>([]);
  const [enqueuedKey, setEnqueuedKey] = createSignal<string | null>(null);

  const parentOwnsMoves = createMemo(
    () => (animProps.moveCues?.length ?? 0) > 0 || !!animProps.suppressNativeMoves,
  );

  const { autoDeployCues } = useAutoDeploy({
    pieces: () => pieceMapFromBoard((sq) => game().get(sq)),
    enabled: () => !animProps.suppressAutoDeploy,
  });

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

  const mergedDeployCues = createMemo((): DeployCue[] => [
    ...(animProps.deployCues ?? []),
    ...autoDeployCues(),
  ]);

  const boardProps = mergeProps(rest, {
    get moveCues() {
      if (animProps.suppressNativeMoves) return animProps.moveCues ?? [];
      return parentOwnsMoves() ? (animProps.moveCues ?? []) : native.moveCues();
    },
    get moveProgress() {
      if (animProps.suppressNativeMoves) return animProps.moveProgress ?? {};
      return parentOwnsMoves() ? (animProps.moveProgress ?? {}) : native.moveProgress();
    },
    get moveLeg() {
      if (animProps.suppressNativeMoves) return animProps.moveLeg ?? {};
      return parentOwnsMoves() ? (animProps.moveLeg ?? {}) : native.moveLeg();
    },
    get deployCues() {
      return mergedDeployCues();
    },
    get suppressAutoDeploy() {
      return !!animProps.suppressAutoDeploy;
    },
  });

  return <StarChessBoardView {...boardProps} />;
};
