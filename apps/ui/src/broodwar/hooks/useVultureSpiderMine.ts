import type { Square } from "chess.js";
import { Chess } from "chess.js";
import { createSignal, onCleanup } from "solid-js";

import { resetBroodWarEconomy, spendEnergy } from "~/broodwar/broodWarStore";
import type { PieceSpecialArmCtx } from "~/broodwar/hooks/usePieceSpecialArm";
import type { SpecialTiming } from "~/broodwar/types";
import { currentFen, loadFen } from "~/store/gameStore";
import { activePlayerColor } from "~/store/settingsStore";

const KNIGHT_START: Square = "d4";
/** Kings + vulture only — fog/BW outcomes suppress classical DRAW (no filler tanks). */
export const VULTURE_FEN_START = "4k3/8/8/8/3N4/8/8/4K3 w - - 0 1";

const whiteToMove = (fen: string): string => {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return fen;
  parts[1] = "w";
  return parts.join(" ");
};

const findWhiteKnight = (fen: string): Square | null => {
  const g = new Chess(fen);
  const cell = g.board().flat().find((c) => c?.type === "n" && c.color === "w");
  return cell?.square ?? null;
};

const placementKey = (fen: string) => fen.split(/\s+/).slice(0, 4).join(" ");

/**
 * Vulture (knight) special — Spider Mine.
 * Armed via GasDeploy; classical move via the board (L-path from
 * {@link BroodWarChessBoard}). Stack order sets timing.
 */
export const useVultureSpiderMine = (opts: {
  fen: () => string;
  setFen: (fen: string) => void;
}) => {
  const [timing, setTiming] = createSignal<SpecialTiming | null>(null);
  const [mineQueued, setMineQueued] = createSignal(false);
  const [mineAt, setMineAt] = createSignal<Square | null>(null);
  const [moveQueued, setMoveQueued] = createSignal(false);
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
    const origin = mineAt() ?? KNIGHT_START;
    setMineAt(origin);
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
      const here = moveTo() ?? findWhiteKnight(opts.fen()) ?? KNIGHT_START;
      setMineAt(here);
      finishPlan(`specialAfter: spider mine under vulture on ${here}`);
    });
  };

  const arm = (_ctx: PieceSpecialArmCtx) => {
    if (playing() || planDone() || mineQueued()) return;
    if (!spendEnergy(activePlayerColor())) {
      setCaption("Need vespene gas to arm a spider mine");
      return;
    }
    setMineQueued(true);

    if (moveQueued()) {
      resolveAfter();
      return;
    }

    setTiming("before");
    const here = findWhiteKnight(opts.fen()) ?? KNIGHT_START;
    setMineAt(here);
    setCaption(`Mine queued (before) on ${here} · move the vulture to auto-submit`);
  };

  /**
   * React to a board move ({@link BroodWarChessBoard} owns L-path VFX).
   * Normalizes side-to-move back to white and auto-submits when a mine is queued.
   */
  const syncFromBoard = (boardFen: string) => {
    if (playing() || planDone() || moveQueued()) return;
    if (placementKey(boardFen) === placementKey(VULTURE_FEN_START)) return;
    const here = findWhiteKnight(boardFen);
    if (!here || here === KNIGHT_START) return;

    const normalized = whiteToMove(boardFen);
    setMoveQueued(true);
    setMoveTo(here);
    opts.setFen(normalized);
    if (currentFen() !== normalized) loadFen(normalized);

    if (mineQueued()) {
      resolveBefore();
    } else {
      setCaption(`Move queued (${KNIGHT_START}→${here}) · drag gas onto the vulture for specialAfter`);
    }
  };

  const reset = () => {
    clearTimers();
    setPlaying(false);
    setPlanDone(false);
    setMineQueued(false);
    setMineAt(null);
    setMoveQueued(false);
    setMoveTo(null);
    setTiming(null);
    opts.setFen(VULTURE_FEN_START);
    loadFen(VULTURE_FEN_START);
    seedEconomy();
    setCaption(
      "Move the vulture, or drag gas onto it — order is special+move or move+special",
    );
  };

  return {
    knightStart: KNIGHT_START,
    timing,
    mineQueued,
    mineAt,
    moveQueued,
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
