import { Chess, type Square } from "chess.js";
import { createSignal, onCleanup } from "solid-js";

import {
  markSpecialUsed,
  refundEnergy,
  resetBroodWarEconomy,
  rookModeAt,
  spendEnergy,
} from "~/broodwar/broodWarStore";
import type { PieceSpecialArmCtx } from "~/broodwar/hooks/usePieceSpecialArm";
import {
  TACTICAL_JUMP_APPEAR_MS,
  TACTICAL_JUMP_GAS_COST,
  TACTICAL_JUMP_TRAIL_MS,
  TACTICAL_JUMP_TRAVEL_MS,
  tacticalJumpTargets,
} from "~/broodwar/specials/queenTacticalJump";
import type { BroodWarColor } from "~/broodwar/types";
import type { MoveCue, QueenJumpTrail } from "~/types/broodwar";
import { currentFen, loadFen } from "~/store/gameStore";
import { activePlayerColor } from "~/store/settingsStore";

/** Kings + Battlecruiser a1 (edge-clipped 7×7 vision keeps the target list small). */
export const QUEEN_TACTICAL_JUMP_FEN = "7k/8/8/8/8/8/8/Q6K w - - 0 1";

const withSideToMove = (fen: string, color: BroodWarColor): string => {
  const parts = fen.trim().split(/\s+/);
  if (parts.length >= 2) parts[1] = color;
  return parts.join(" ");
};

type TacticalJumpPhase = "idle" | "armed" | "firing";

/**
 * Battlecruiser (queen) special — Tactical Jump.
 * Gas drop spends 2 vespene and arms targeting; clicking a highlighted visible
 * empty square teleports the queen (blockers ignored, attacks on her ignored).
 */
export const useQueenTacticalJump = (opts?: { startingFen?: string }) => {
  const startFen = () => opts?.startingFen ?? QUEEN_TACTICAL_JUMP_FEN;
  const [phase, setPhase] = createSignal<TacticalJumpPhase>("idle");
  const [from, setFrom] = createSignal<Square | null>(null);
  const [targets, setTargets] = createSignal<Square[]>([]);
  const [jumpCues, setJumpCues] = createSignal<MoveCue[]>([]);
  const [jumpTrails, setJumpTrails] = createSignal<QueenJumpTrail[]>([]);
  const [caption, setCaption] = createSignal(
    "Drag 2 vespene canisters onto the battlecruiser, then click a highlighted empty square",
  );

  const timers: number[] = [];
  const after = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    while (timers.length) window.clearTimeout(timers.pop());
  };
  onCleanup(clearTimers);

  const side = () => activePlayerColor();

  const seedEconomy = () => {
    resetBroodWarEconomy({
      turn: 21,
      white: { stored: 12, deployed: 10 },
      black: { stored: 0, deployed: 1 },
      energy: 3,
      startTimer: false,
    });
  };

  const clearTargeting = () => {
    setPhase("idle");
    setFrom(null);
    setTargets([]);
  };

  const arm = (ctx: PieceSpecialArmCtx): boolean => {
    if (ctx.piece !== "q") return false;
    if (phase() !== "idle") {
      setCaption("Tactical Jump already armed — click a highlighted empty square");
      return false;
    }

    const g = new Chess(currentFen());
    const piece = g.get(ctx.square);
    if (!piece || piece.type !== "q" || piece.color !== side()) {
      setCaption("Drop gas on your own battlecruiser");
      return false;
    }

    const nextTargets = tacticalJumpTargets(g, ctx.square, { rookModeFor: rookModeAt });
    if (nextTargets.length === 0) {
      setCaption("Tactical Jump needs a visible empty square");
      return false;
    }
    if (!spendEnergy(side(), TACTICAL_JUMP_GAS_COST)) {
      setCaption("Not enough gas (2 required)");
      return false;
    }

    setFrom(ctx.square);
    setTargets(nextTargets);
    setPhase("armed");
    setCaption(
      `Tactical Jump armed on ${ctx.square} — click one of ${nextTargets.length} highlighted empty squares`,
    );
    // Spend/mark manually: mark only when the jump executes.
    return false;
  };

  const execute = (origin: Square, to: Square) => {
    const color = side();
    const g = new Chess(currentFen());
    const piece = g.get(origin);
    if (!piece || piece.type !== "q" || piece.color !== color || g.get(to)) {
      setCaption("Tactical Jump target is blocked — pick a highlighted empty square");
      return;
    }

    setPhase("firing");
    markSpecialUsed(origin);
    setCaption(`Tactical Jump ${origin}→${to}…`);
    const cue: MoveCue = {
      id: `jump-${origin}-${to}-${Date.now()}`,
      piece: "q",
      color,
      from: origin,
      to,
    };
    setJumpCues([cue]);
    setJumpTrails([{ id: `${cue.id}-trail`, color, from: origin, to }]);

    after(TACTICAL_JUMP_TRAVEL_MS, () => {
      const board = new Chess(currentFen());
      const jumper = board.get(origin);
      if (!jumper || jumper.type !== "q" || jumper.color !== color || board.get(to)) {
        setJumpCues([]);
        setJumpTrails([]);
        clearTargeting();
        setCaption(`Tactical Jump to ${to} fizzled — target blocked`);
        return;
      }
      board.remove(origin);
      board.put({ type: "q", color }, to);
      loadFen(withSideToMove(board.fen(), color));
    });

    after(TACTICAL_JUMP_TRAVEL_MS + TACTICAL_JUMP_APPEAR_MS, () => {
      setJumpCues([]);
      clearTargeting();
      setCaption(`Tactical Jump ${origin}→${to} complete — attacks on the queen ignored`);
    });

    after(TACTICAL_JUMP_TRAIL_MS, () => {
      setJumpTrails([]);
    });
  };

  /** ChessBoard click interceptor: swallows every click while armed / jumping. */
  const interceptSquareClick = (square: Square): boolean => {
    if (phase() === "firing") return true;
    if (phase() !== "armed") return false;
    const origin = from();
    if (origin && targets().includes(square)) execute(origin, square);
    // Wrong clicks are ignored — Tactical Jump stays armed.
    return true;
  };

  const specialTargets = (): Square[] => (phase() === "armed" ? targets() : []);

  /** ResolveTurn input hook — attacks on the jumping queen's origin are ignored. */
  const ignoreAttacksOn = (): Square[] => {
    const origin = from();
    return phase() === "firing" && origin ? [origin] : [];
  };

  /** Drop targeting/animation state without touching FEN or economy (host story owns those). */
  const clear = () => {
    clearTimers();
    setJumpCues([]);
    setJumpTrails([]);
    clearTargeting();
    setCaption(
      "Drag 2 vespene canisters onto the battlecruiser, then click a highlighted empty square",
    );
  };

  const reset = () => {
    if (phase() === "armed") refundEnergy(side(), TACTICAL_JUMP_GAS_COST);
    clear();
    loadFen(startFen());
    seedEconomy();
  };

  return {
    caption,
    phase,
    from,
    targets,
    specialTargets,
    ignoreAttacksOn,
    jumpCues,
    jumpTrails,
    seedEconomy,
    arm,
    interceptSquareClick,
    clear,
    reset,
    startingFen: startFen,
  };
};
