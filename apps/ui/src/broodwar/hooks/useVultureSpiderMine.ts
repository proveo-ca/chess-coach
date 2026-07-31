import type { Square } from "chess.js";
import { Chess } from "chess.js";
import { createSignal, onCleanup } from "solid-js";

import { resetBroodWarEconomy, spendEnergy } from "~/broodwar/broodWarStore";
import type { PieceSpecialArmCtx } from "~/broodwar/hooks/usePieceSpecialArm";
import type { SpecialTiming } from "~/broodwar/types";
import { currentFen, loadFen } from "~/store/gameStore";
import { activePlayerColor } from "~/store/settingsStore";

/** Kings + vulture only — fog/BW outcomes suppress classical DRAW (no filler tanks). */
export const VULTURE_FEN_START = "4k3/8/8/8/3N4/8/8/4K3 w - - 0 1";

const whiteToMove = (fen: string): string => {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return fen;
  parts[1] = "w";
  return parts.join(" ");
};

const whiteKnightSquares = (fen: string): Set<Square> => {
  const g = new Chess(fen);
  const out = new Set<Square>();
  for (const row of g.board()) {
    for (const cell of row) {
      if (cell?.type === "n" && cell.color === "w") out.add(cell.square);
    }
  }
  return out;
};

/**
 * Vulture (knight) special — Spider Mine.
 * Armed via GasDeploy on a specific knight; classical move via the board
 * (L-path from {@link BroodWarChessBoard}). Stack order sets timing.
 */
export const useVultureSpiderMine = (opts: {
  fen: () => string;
  setFen: (fen: string) => void;
  /** Reset target when calling {@link reset} (Storybook). */
  startingFen?: string;
}) => {
  const startFen = () => opts.startingFen ?? VULTURE_FEN_START;

  const [timing, setTiming] = createSignal<SpecialTiming | null>(null);
  const [mineQueued, setMineQueued] = createSignal(false);
  const [mineAt, setMineAt] = createSignal<Square | null>(null);
  const [moveQueued, setMoveQueued] = createSignal(false);
  const [moveFrom, setMoveFrom] = createSignal<Square | null>(null);
  const [moveTo, setMoveTo] = createSignal<Square | null>(null);
  const [playing, setPlaying] = createSignal(false);
  const [planDone, setPlanDone] = createSignal(false);
  const [caption, setCaption] = createSignal(
    "Move the vulture, or drag gas onto it — order is special+move or move+special",
  );

  const timers: number[] = [];
  const after = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    while (timers.length) window.clearTimeout(timers.pop());
  };

  onCleanup(clearTimers);

  const seedEconomy = () => {
    resetBroodWarEconomy({
      turn: 1,
      white: { stored: 12, deployed: 4 },
      black: { stored: 0, deployed: 1 },
      energy: 1,
      startTimer: false,
    });
  };

  const finishPlan = (msg: string) => {
    setCaption(msg);
    setPlaying(false);
    setPlanDone(true);
  };

  const resolveBefore = () => {
    setPlaying(true);
    setTiming("before");
    const origin = mineAt() ?? moveFrom();
    if (origin) setMineAt(origin);
    setCaption(`specialBefore: spider mine on ${origin}`);
    after(400, () => {
      finishPlan(
        `specialBefore → move: mine stays on ${origin} · vulture on ${moveTo() ?? "…"}`,
      );
    });
  };

  const resolveAfter = () => {
    setPlaying(true);
    setTiming("after");
    setCaption(`move: vulture → ${moveTo() ?? "…"}`);
    after(450, () => {
      const here = moveTo();
      if (here) setMineAt(here);
      finishPlan(`specialAfter: spider mine under vulture on ${here ?? "…"}`);
    });
  };

  const arm = (ctx: PieceSpecialArmCtx): boolean => {
    if (ctx.piece !== "n") return false;
    if (playing() || planDone() || mineQueued()) return false;
    if (!spendEnergy(activePlayerColor())) {
      setCaption("Need vespene gas to arm a spider mine");
      return false;
    }
    setMineQueued(true);

    if (moveQueued()) {
      // Prefer mine under the knight that received gas (usually the moved one).
      if (!moveTo()) setMoveTo(ctx.square);
      resolveAfter();
      return true;
    }

    setTiming("before");
    setMineAt(ctx.square);
    setMoveFrom(ctx.square);
    setCaption(`Mine queued (before) on ${ctx.square} · move the vulture to auto-submit`);
    return true;
  };

  /**
   * React to a board move ({@link BroodWarChessBoard} owns L-path VFX).
   * Diffs white-knight squares vs the last planned fen.
   */
  const syncFromBoard = (boardFen: string) => {
    if (playing() || planDone() || moveQueued()) return;
    const prev = whiteKnightSquares(opts.fen());
    const next = whiteKnightSquares(boardFen);
    const departed = [...prev].filter((s) => !next.has(s));
    const arrived = [...next].filter((s) => !prev.has(s));
    if (departed.length !== 1 || arrived.length !== 1) return;

    const from = departed[0]!;
    const to = arrived[0]!;
    // If a mine is already queued on another knight, ignore unrelated jumps.
    const armed = mineAt();
    if (armed && armed !== from) return;

    const normalized = whiteToMove(boardFen);
    setMoveQueued(true);
    setMoveFrom(from);
    setMoveTo(to);
    opts.setFen(normalized);
    if (currentFen() !== normalized) loadFen(normalized);

    if (mineQueued()) {
      resolveBefore();
    } else {
      setCaption(`Move queued (${from}→${to}) · drag gas onto the vulture for specialAfter`);
    }
  };

  const reset = () => {
    clearTimers();
    setPlaying(false);
    setPlanDone(false);
    setMineQueued(false);
    setMineAt(null);
    setMoveQueued(false);
    setMoveFrom(null);
    setMoveTo(null);
    setTiming(null);
    opts.setFen(startFen());
    loadFen(startFen());
    seedEconomy();
    setCaption(
      "Move the vulture, or drag gas onto it — order is special+move or move+special",
    );
  };

  return {
    timing,
    mineQueued,
    mineAt,
    moveQueued,
    moveFrom,
    moveTo,
    playing,
    planDone,
    caption,
    seedEconomy,
    arm,
    syncFromBoard,
    reset,
  };
};
