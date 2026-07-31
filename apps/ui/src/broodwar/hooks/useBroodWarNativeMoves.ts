/**
 * When Brood War boards animate a move, classical `animationQueue` slides are
 * replaced by {@link MoveAnimation} (knight L-path, others ease to destination).
 * Wired through {@link BroodWarChessBoard} — shared ChessBoard stays cue-driven only.
 */

import type { Color, PieceSymbol, Square } from "chess.js";
import { createSignal, createEffect, onCleanup } from "solid-js";

import type { MoveCue } from "~/types/broodwar";
import type { BroodWarPiece } from "~/broodwar/animations/types";
import { knightElbowMs, moveDurationMs } from "~/broodwar/animations/moveTiming";
import type { MoveSquares } from "~/types/game";

let cueSeq = 0;
const nextId = () => `bw-native-mv-${++cueSeq}-${Date.now()}`;

export type NativeBroodWarMoves = {
  moveCues: () => MoveCue[];
  moveProgress: () => Record<string, 0 | 1>;
  moveLeg: () => Record<string, 0 | 1>;
  /** Destinations whose board `<img>` must hide while the overlay travels (FEN already committed). */
  hideDestinations: () => ReadonlySet<Square>;
};

/**
 * Consumes ChessBoard `animationQueue` entries and plays them as Brood War move cues.
 * No-ops while `suppressed` (parent already feeds combat `moveCues`).
 */
export function useBroodWarNativeMoves(opts: {
  enabled: () => boolean;
  suppressed: () => boolean;
  animationQueue: () => MoveSquares[];
  consumeAnimation: (m: MoveSquares) => void;
  pieceAt: (sq: Square) => { type: PieceSymbol; color: Color } | null | undefined;
}): NativeBroodWarMoves {
  const [moveCues, setMoveCues] = createSignal<MoveCue[]>([]);
  const [moveProgress, setMoveProgress] = createSignal<Record<string, 0 | 1>>({});
  const [moveLeg, setMoveLeg] = createSignal<Record<string, 0 | 1>>({});
  const [hideDestinations, setHideDestinations] = createSignal<ReadonlySet<Square>>(new Set());
  const [busy, setBusy] = createSignal(false);

  const timers: number[] = [];
  const after = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    while (timers.length) window.clearTimeout(timers.pop());
  };

  onCleanup(() => {
    clearTimers();
  });

  const clearCues = () => {
    setMoveCues([]);
    setMoveProgress({});
    setMoveLeg({});
    setHideDestinations(new Set());
    setBusy(false);
  };

  createEffect(() => {
    if (!opts.enabled()) {
      clearTimers();
      clearCues();
      return;
    }
    if (opts.suppressed() || busy()) return;

    const head = opts.animationQueue()[0];
    if (!head) return;

    const to = head.to as Square;
    const from = head.from as Square;
    const piece = opts.pieceAt(to);
    opts.consumeAnimation(head);

    if (!piece) return;

    const id = nextId();
    const cue: MoveCue = {
      id,
      piece: piece.type as BroodWarPiece,
      color: piece.color,
      from,
      to,
    };
    const travelMs = moveDurationMs(from, to, piece.type);

    setBusy(true);
    setMoveCues([cue]);
    setMoveProgress({ [id]: 0 });
    setHideDestinations(new Set([to]));
    if (piece.type === "n") setMoveLeg({ [id]: 0 });

    after(40, () => {
      setMoveProgress({ [id]: 1 });
    });
    if (piece.type === "n") {
      after(40 + knightElbowMs(from, to), () => {
        setMoveLeg((prev) => (id in prev ? { ...prev, [id]: 1 } : prev));
      });
    }
    after(40 + travelMs, () => {
      clearCues();
    });
  });

  return {
    moveCues,
    moveProgress,
    moveLeg,
    hideDestinations,
  };
}
