import type { Color, Square } from "chess.js";
import { Chess } from "chess.js";
import { createSignal, onCleanup } from "solid-js";

import { moveDurationMs } from "~/starchess/animations/moveTiming";
import type { MoveCue } from "~/starchess/animations/types";
import {
  hasUsedSpecialThisTurn,
  migrateSpecialUsed,
  resetStarChessEconomy,
  spendEnergy,
} from "~/starchess/starChessStore";
import type { PieceSpecialArmCtx } from "~/starchess/hooks/usePieceSpecialArm";
import type { ArmResult } from "~/starchess/specials/pieceSpecials";
import {
  canScPawnSingle,
  canClassicalPawnDouble,
  pawnDoubleTarget,
  pawnSingleTarget,
} from "~/starchess/specials/pawnDouble";
import { addMove, currentFen, loadFen } from "~/store/gameStore";
import { activePlayerColor } from "~/store/settingsStore";

/** Kings + start-rank pawn (free classical) + mid-board pawn (costs gas). */
export const MARINE_DOUBLE_FEN = "7k/8/8/8/8/4P3/3P4/4K3 w - - 0 1";

const whiteToMove = (fen: string): string => {
  const parts = fen.split(" ");
  parts[1] = "w";
  return parts.join(" ");
};

/**
 * Marine (pawn) special — double-step anytime.
 * Classical start-rank doubles: free `addMove` slide (no gas / no specials-used).
 * Otherwise: 1 gas, slide via move cues, then commit fen + specials-used on `to`.
 */
export const useMarineDoubleStep = () => {
  const [caption, setCaption] = createSignal(
    "Drag gas onto a pawn — start-rank doubles are free; gas moves 1 extra square",
  );
  const [moveCues, setMoveCues] = createSignal<MoveCue[]>([]);
  const [moveProgress, setMoveProgress] = createSignal<Record<string, 0 | 1>>({});

  const timers: number[] = [];
  const after = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };
  onCleanup(() => {
    while (timers.length) window.clearTimeout(timers.pop());
  });

  const seedEconomy = () => {
    resetStarChessEconomy({
      turn: 1,
      white: { stored: 4, deployed: 4 },
      black: { stored: 0, deployed: 1 },
      energy: 1,
      startTimer: false,
    });
  };

  const clearMoveFx = () => {
    setMoveCues([]);
    setMoveProgress({});
  };

  /** Slide overlay, then run `commit` (fen update). Board still has piece on `from` until commit. */
  const playDoubleSlide = (
    from: Square,
    to: Square,
    color: Color,
    commit: () => void,
  ) => {
    const id = `marine-${from}-${to}-${Date.now()}`;
    const travelMs = moveDurationMs(from, to, "p");
    clearMoveFx();
    setMoveCues([
      {
        id,
        piece: "p",
        color,
        from,
        to,
      },
    ]);
    setMoveProgress({ [id]: 0 });
    requestAnimationFrame(() => {
      setMoveProgress({ [id]: 1 });
    });
    after(40 + travelMs, () => {
      commit();
      clearMoveFx();
    });
  };

  const applyScDoubleFen = (from: Square, to: Square): boolean => {
    const g = new Chess(currentFen());
    const piece = g.get(from);
    if (!piece || piece.type !== "p") return false;
    g.remove(from);
    if (!g.put(piece, to)) return false;
    loadFen(whiteToMove(g.fen()));
    return true;
  };

  const arm = (ctx: PieceSpecialArmCtx): ArmResult => {
    if (ctx.piece !== "p") return false;
    if (moveCues().length > 0) return false;

    const fen = currentFen();
    const g = new Chess(fen);
    const piece = g.get(ctx.square);
    if (!piece || piece.type !== "p" || piece.color !== activePlayerColor()) {
      setCaption("Drop gas on your own marine");
      return false;
    }
    const classicalTo = pawnDoubleTarget(ctx.square, piece.color);
    const gasTo = pawnSingleTarget(ctx.square, piece.color);
    if (!classicalTo || !gasTo) {
      setCaption("No room to move forward");
      return false;
    }

    if (canClassicalPawnDouble(fen, ctx.square)) {
      try {
        const parts = fen.split(" ");
        if (parts[1] !== piece.color) {
          parts[1] = piece.color;
          loadFen(parts.join(" "));
        }
        addMove({ from: ctx.square, to: classicalTo });
        // Let StarChessBoard finish the hop before forcing side-to-move.
        const settleMs = 40 + moveDurationMs(ctx.square, classicalTo, "p");
        after(settleMs, () => {
          const normalized = whiteToMove(currentFen());
          if (normalized !== currentFen()) loadFen(normalized);
        });
        setCaption(`Free classical double ${ctx.square}→${classicalTo} — canister unused`);
        return "free";
      } catch {
        setCaption("Classical double failed");
        return false;
      }
    }

    if (hasUsedSpecialThisTurn(ctx.square)) {
      setCaption("This marine already used its special this turn");
      return false;
    }
    if (!canScPawnSingle(fen, ctx.square)) {
      setCaption("Path blocked — need the square ahead to be empty");
      return false;
    }
    if (!spendEnergy(activePlayerColor())) {
      setCaption("Need vespene gas for a non-classical extra step");
      return false;
    }

    const from = ctx.square;
    playDoubleSlide(from, gasTo, piece.color, () => {
      if (!applyScDoubleFen(from, gasTo)) {
        setCaption("Extra step failed");
        return;
      }
      migrateSpecialUsed(from, gasTo);
      setCaption(`Special extra step ${from}→${gasTo} · 1 gas`);
    });
    setCaption(`Special extra step ${from}→${gasTo}…`);
    return "armed";
  };

  return {
    caption,
    seedEconomy,
    arm,
    startingFen: MARINE_DOUBLE_FEN,
    moveCues,
    moveProgress,
  };
};
