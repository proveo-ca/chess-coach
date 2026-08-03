import { Chess, type Square } from "chess.js";
import { createSignal } from "solid-js";

import { BISHOP_CHARON } from "~/starchess/animations/bishopCharon";
import {
  markSpecialUsed,
  refundEnergy,
  resetStarChessEconomy,
  spendEnergy,
} from "~/starchess/starChessStore";
import { useStarChessCombat } from "~/starchess/hooks/useStarChessCombat";
import type { PieceSpecialArmCtx } from "~/starchess/hooks/usePieceSpecialArm";
import {
  CHARON_GAS_COST,
  CHARON_IMPACT_MS,
  charonTargetQueenFromPlacement,
  placementAfterCharon,
} from "~/starchess/specials/bishopCharon";
import type { StarChessColor } from "~/starchess/types";
import { currentFen, loadFen } from "~/store/gameStore";
import { activePlayerColor } from "~/store/settingsStore";

/** Kings + Goliath d4, enemy queen h8, and two blockers on the same diagonal. */
export const BISHOP_CHARON_FEN = "k6q/8/4P3/4p3/3B4/8/8/K7 w - - 0 1";

const placementOf = (fen: string): string => fen.trim().split(/\s+/)[0]!;

const withSideToMove = (fen: string, color: StarChessColor): string => {
  const parts = fen.trim().split(/\s+/);
  if (parts.length >= 2) parts[1] = color;
  return parts.join(" ");
};

type CharonPhase = "idle" | "armed" | "firing";

/**
 * Goliath (bishop) special — Charon Booster Missiles.
 * Gas drop spends 2 vespene and only arms targeting; clicking the highlighted
 * queen fires the twin homing missiles (the Goliath does not relocate).
 */
export const useBishopCharon = (opts?: { startingFen?: string }) => {
  const startFen = () => opts?.startingFen ?? BISHOP_CHARON_FEN;
  const combat = useStarChessCombat();
  const [phase, setPhase] = createSignal<CharonPhase>("idle");
  const [from, setFrom] = createSignal<Square | null>(null);
  const [target, setTarget] = createSignal<Square | null>(null);
  const [targetColor, setTargetColor] = createSignal<StarChessColor>("b");
  const [caption, setCaption] = createSignal(
    "Drag 2 vespene canisters onto the Goliath, then click the queen",
  );

  const side = () => activePlayerColor();

  const seedEconomy = () => {
    resetStarChessEconomy({
      turn: 21,
      white: { stored: 12, deployed: 6 },
      black: { stored: 0, deployed: 2 },
      energy: 3,
      startTimer: false,
    });
  };

  const clearTargeting = () => {
    setPhase("idle");
    setFrom(null);
    setTarget(null);
  };

  const arm = (ctx: PieceSpecialArmCtx): boolean => {
    if (ctx.piece !== "b") return false;
    if (phase() !== "idle") {
      setCaption("Charon Booster Missiles already armed — click the highlighted queen");
      return false;
    }

    const g = new Chess(currentFen());
    const piece = g.get(ctx.square);
    if (!piece || piece.type !== "b" || piece.color !== side()) {
      setCaption("Drop gas on your own Goliath");
      return false;
    }

    const placement = placementOf(currentFen());
    const queen = charonTargetQueenFromPlacement(placement, ctx.square);
    if (!queen) {
      setCaption("Charon Booster Missiles needs exactly one enemy queen on a diagonal");
      return false;
    }
    if (!spendEnergy(side(), CHARON_GAS_COST)) {
      setCaption("Not enough gas (2 required)");
      return false;
    }

    setFrom(ctx.square);
    setTarget(queen);
    setTargetColor(piece.color === "w" ? "b" : "w");
    setPhase("armed");
    setCaption(`Charon Booster Missiles armed on ${ctx.square} — click the queen on ${queen}`);
    // Manage spend/mark manually (like Command Center): mark only when it fires.
    return false;
  };

  const fire = (origin: Square, queen: Square) => {
    const color = side();
    setPhase("firing");
    markSpecialUsed(origin);
    setCaption(`Charon Booster Missiles ${origin}→${queen}…`);
    combat.playRangedAttack({
      cue: {
        id: `charon-${origin}-${queen}-${Date.now()}`,
        piece: "b",
        color,
        from: origin,
        to: queen,
        anim: BISHOP_CHARON,
      },
      death: {
        id: `charon-death-${queen}-${Date.now()}`,
        piece: "q",
        color: targetColor(),
        at: queen,
      },
      impactMs: CHARON_IMPACT_MS,
      commit: () => {
        const g = new Chess(currentFen());
        const victim = g.get(queen);
        if (!victim || victim.type !== "q" || victim.color === color) {
          clearTargeting();
          setCaption(`Charon target on ${queen} moved before impact — shot fizzles`);
          return;
        }
        const parts = currentFen().trim().split(/\s+/);
        parts[0] = placementAfterCharon(placementOf(currentFen()), queen);
        loadFen(withSideToMove(parts.join(" "), color));
        clearTargeting();
        setCaption(`Charon Booster Missiles hit ${queen} — queen down, Goliath holds ${origin}`);
      },
    });
  };

  /** ChessBoard click interceptor: swallows every click while armed / firing. */
  const interceptSquareClick = (square: Square): boolean => {
    if (phase() === "firing") return true;
    if (phase() !== "armed") return false;
    const origin = from();
    const queen = target();
    if (origin && queen && square === queen) fire(origin, queen);
    // Wrong clicks are ignored — Charon stays armed.
    return true;
  };

  const specialTargets = (): Square[] => {
    const queen = target();
    return phase() === "armed" && queen ? [queen] : [];
  };

  const armedBishops = (): Square[] => {
    const origin = from();
    return phase() === "armed" && origin ? [origin] : [];
  };

  /** Drop targeting/combat state without touching FEN or economy (host story owns those). */
  const clear = () => {
    combat.clear();
    clearTargeting();
    setCaption("Drag 2 vespene canisters onto the Goliath, then click the queen");
  };

  const reset = () => {
    if (phase() === "armed") refundEnergy(side(), CHARON_GAS_COST);
    clear();
    loadFen(startFen());
    seedEconomy();
  };

  return {
    caption,
    phase,
    from,
    target,
    specialTargets,
    armedBishops,
    combat,
    seedEconomy,
    arm,
    interceptSquareClick,
    clear,
    reset,
    startingFen: startFen,
  };
};
