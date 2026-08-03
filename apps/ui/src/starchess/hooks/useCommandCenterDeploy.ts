import type { PieceSymbol, Square } from "chess.js";
import { Chess } from "chess.js";
import { createMemo, createSignal, onCleanup } from "solid-js";

import { makeDeployCue } from "~/starchess/animations/deployAnim";
import {
  addDeployed,
  markSpecialUsed,
  refundEnergy,
  refundStored,
  removeDeployed,
  resetStarChessEconomy,
  spendEnergy,
  spendStored,
  storedMaterial,
} from "~/starchess/starChessStore";
import { DEPLOY_MS, UNIT_COST } from "~/starchess/constants";
import type { PieceSpecialArmCtx } from "~/starchess/hooks/usePieceSpecialArm";
import { adjacentSquares } from "~/starchess/specials/adjacent";
import { loadFen } from "~/store/gameStore";
import { activePlayerColor, playerPieceSet } from "~/store/settingsStore";
import type { DeployCue, DeployModalPending, SpawnPiece } from "~/types/starchess";

export type CommandCenterPhase = "idle" | "spawnModal" | "pickAdjacent" | "deploying";

const KING_SQ: Square = "d4";

/**
 * Command Center (king) special — Deploy.
 * Armed via GasDeploy (no spend yet). On square pick: play deploy VFX, then
 * spend store minerals + gas and commit FEN (fog) after {@link DEPLOY_MS}.
 */
export const useCommandCenterDeploy = (opts: {
  fen: () => string;
  setFen: (fen: string) => void;
  kingSquare?: Square;
  startingFen: string;
}) => {
  const kingSq = () => opts.kingSquare ?? KING_SQ;
  const color = () => activePlayerColor();
  const [phase, setPhase] = createSignal<CommandCenterPhase>("idle");
  const [pendingSpawn, setPendingSpawn] = createSignal<SpawnPiece | null>(null);
  const [deployCue, setDeployCue] = createSignal<DeployCue | null>(null);
  const [caption, setCaption] = createSignal(
    `Drag a vespene canister onto the command center on ${kingSq()}`,
  );

  let deployTimer = 0;
  const clearDeployTimer = () => {
    window.clearTimeout(deployTimer);
    deployTimer = 0;
  };
  onCleanup(clearDeployTimer);

  const occupied = createMemo(() => {
    const g = new Chess(opts.fen());
    const set = new Set<Square>();
    for (const row of g.board()) {
      for (const cell of row) {
        if (cell) set.add(cell.square);
      }
    }
    return set;
  });

  const adjacent = createMemo(() => adjacentSquares(kingSq(), occupied()));

  const modalPending = createMemo((): DeployModalPending | null => {
    if (phase() !== "spawnModal") return null;
    return { color: color(), pieceSet: playerPieceSet() };
  });

  const seedEconomy = () => {
    resetStarChessEconomy({
      turn: 1,
      white: { stored: 12, deployed: 3 },
      black: { stored: 0, deployed: 1 },
      energy: 1,
      startTimer: false,
    });
  };

  /** GasDeploy drop — open picker; gas/minerals still in the store until place. */
  const arm = (_ctx: PieceSpecialArmCtx): boolean => {
    setPhase("spawnModal");
    setCaption(`Pick a unit to deploy · minerals ${storedMaterial()}`);
    // Special is not committed until `deployAt` spends gas — do not mark yet.
    return false;
  };

  const onSelectUnit = (piece: SpawnPiece) => {
    const cost = UNIT_COST[piece];
    if (storedMaterial() < cost) {
      setCaption(`Need ${cost} minerals (have ${storedMaterial()})`);
      return;
    }
    setPendingSpawn(piece);
    setPhase("pickAdjacent");
    setCaption(`Tap an adjacent empty square to deploy ${piece.toUpperCase()}`);
  };

  const onCancelModal = () => {
    setPhase("idle");
    setPendingSpawn(null);
    setCaption(`Drag a vespene canister onto the command center on ${kingSq()}`);
  };

  const deployAt = (sq: Square) => {
    const piece = pendingSpawn();
    if (!piece || phase() === "deploying") return;
    const cost = UNIT_COST[piece];
    const side = color();

    // Reserve economy up front; FEN / fog wait for the drop animation.
    if (!spendEnergy(side)) {
      setCaption("Need vespene gas to deploy");
      return;
    }
    if (!spendStored(side, cost)) {
      refundEnergy(side);
      setCaption(`Not enough minerals (have ${storedMaterial()}, need ${cost})`);
      return;
    }
    if (!addDeployed(side, cost)) {
      refundStored(side, cost);
      refundEnergy(side);
      setCaption("Deploy cap reached");
      return;
    }

    clearDeployTimer();
    setPendingSpawn(null);
    setPhase("deploying");
    setDeployCue(makeDeployCue(piece, side, sq));
    markSpecialUsed(kingSq());
    setCaption(`Deploying ${piece.toUpperCase()} → ${sq}…`);

    deployTimer = window.setTimeout(() => {
      const g = new Chess(opts.fen());
      const ok = g.put({ type: piece as PieceSymbol, color: side }, sq);
      if (!ok) {
        refundStored(side, cost);
        removeDeployed(side, cost);
        refundEnergy(side);
        setDeployCue(null);
        setPhase("idle");
        setCaption("Deploy failed — square blocked");
        return;
      }

      const next = g.fen();
      opts.setFen(next);
      loadFen(next);
      setDeployCue(null);
      setPhase("idle");
      setCaption(
        `Deployed ${piece.toUpperCase()} on ${sq} · minerals ${storedMaterial()} · special spent this turn`,
      );
    }, DEPLOY_MS);
  };

  const resetCaption = () =>
    setCaption(`Drag a vespene canister onto the command center on ${kingSq()}`);

  return {
    kingSq,
    phase,
    pendingSpawn,
    deployCue,
    caption,
    setCaption,
    adjacent,
    modalPending,
    seedEconomy,
    arm,
    onSelectUnit,
    onCancelModal,
    deployAt,
    resetCaption,
    startingHint: () => opts.startingFen,
    /** Live store read — accumulated minerals for the active player. */
    storedMaterial,
  };
};
