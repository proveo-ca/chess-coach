import type { PieceSymbol, Square } from "chess.js";
import { Chess } from "chess.js";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";

import {
  addDeployed,
  energyRemainingFor,
  refundEnergy,
  refundStored,
  removeDeployed,
  resetBroodWarEconomy,
  spendEnergy,
  spendStored,
  storedMaterial,
} from "~/broodwar/broodWarStore";
import { SPECIAL_ENERGY_COST, UNIT_COST } from "~/broodwar/constants";
import { findBoardGrid, squareBoxStyle } from "~/broodwar/animations/boardGeom";
import { LONG_PRESS_MS, adjacentSquares } from "~/broodwar/specials/adjacent";
import styles from "~/broodwar/specials/KingSpawnDemo.module.css";
import { ChessBoard } from "~/components/features/ChessBoard";
import { SpawnModal } from "~/components/primitives/SpawnModal";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { loadFen } from "~/store/gameStore";
import type { SpawnModalPending, SpawnPiece } from "~/types/broodwar";
import {
  playerPieceSet,
  setActivePlayerColor,
  setNerdModeUnlocked,
  setPlayerIdentity,
} from "~/store/settingsStore";

const KING_SQ: Square = "d4";
/** Both kings + spare rook so FEN stays loadable. */
const FEN_START = "r6k/8/8/8/3K4/8/8/7R w - - 0 1";

type Phase = "idle" | "spawnModal" | "pickAdjacent";

type OverlayBox = { top: number; left: number; width: number; height: number };

/**
 * Storybook: long-press king → SpawnModal → deploy on an adjacent empty square.
 */
export const KingSpawnDemo: Component = () => {
  const [fen, setFen] = createSignal(FEN_START);
  const [phase, setPhase] = createSignal<Phase>("idle");
  const [pendingSpawn, setPendingSpawn] = createSignal<SpawnPiece | null>(null);
  const [overlayBox, setOverlayBox] = createSignal<OverlayBox | null>(null);
  const [caption, setCaption] = createSignal("Long-press the king on d4 to open spawn");

  let hostRef = undefined as HTMLDivElement | undefined;
  let pressTimer = 0;

  const occupied = createMemo(() => {
    const g = new Chess(fen());
    const set = new Set<Square>();
    for (const row of g.board()) {
      for (const cell of row) {
        if (cell) set.add(cell.square);
      }
    }
    return set;
  });

  const adjacent = createMemo(() => adjacentSquares(KING_SQ, occupied()));

  const modalPending = createMemo((): SpawnModalPending | null => {
    if (phase() !== "spawnModal") return null;
    return {
      color: "w",
      pieceSet: playerPieceSet(),
    };
  });

  const syncOverlay = () => {
    const host = hostRef;
    if (!host) return;
    const el = findBoardGrid(host);
    if (!el) return;
    const hr = host.getBoundingClientRect();
    const br = el.getBoundingClientRect();
    // Align to the board content box (inside the 4px border), matching ChessBoard.
    setOverlayBox({
      top: br.top - hr.top + el.clientTop,
      left: br.left - hr.left + el.clientLeft,
      width: el.clientWidth,
      height: el.clientHeight,
    });
  };

  const seedEconomy = () => {
    resetBroodWarEconomy({
      turn: 1,
      white: { stored: 12, deployed: 3 },
      black: { stored: 0, deployed: 1 },
    });
  };

  const prepareBoard = () => {
    setStorybookCapabilities({ ...NERD_CAPABILITIES, readOnly: true });
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    loadFen(fen());
  };

  const clearPress = () => {
    window.clearTimeout(pressTimer);
    pressTimer = 0;
  };

  const openSpawn = () => {
    clearPress();
    if (energyRemainingFor("w") < SPECIAL_ENERGY_COST) {
      setCaption("Need vespene gas to use a special");
      return;
    }
    setPhase("spawnModal");
    setCaption("Pick a unit to spawn (pawn first in the grid)");
  };

  const onSelectUnit = (piece: SpawnPiece) => {
    setPendingSpawn(piece);
    setPhase("pickAdjacent");
    setCaption(`Tap an adjacent empty square to deploy ${piece.toUpperCase()}`);
  };

  const onCancelModal = () => {
    setPhase("idle");
    setPendingSpawn(null);
    setCaption("Long-press the king on d4 to open spawn");
  };

  const deployAt = (sq: Square) => {
    const piece = pendingSpawn();
    if (!piece) return;
    const cost = UNIT_COST[piece];
    if (!spendEnergy("w")) {
      setCaption("Need vespene gas to use a special");
      setPhase("idle");
      setPendingSpawn(null);
      return;
    }
    if (!spendStored("w", cost)) {
      refundEnergy("w");
      return;
    }
    if (!addDeployed("w", cost)) {
      refundStored("w", cost);
      refundEnergy("w");
      return;
    }

    const g = new Chess(fen());
    const ok = g.put({ type: piece as PieceSymbol, color: "w" }, sq);
    if (!ok) {
      refundStored("w", cost);
      removeDeployed("w", cost);
      refundEnergy("w");
      return;
    }

    const next = g.fen();
    setFen(next);
    loadFen(next);
    setPendingSpawn(null);
    setPhase("idle");
    setCaption(
      `Spawned ${piece.toUpperCase()} on ${sq} · stored ${storedMaterial()} · long-press king again`,
    );
    requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
  };

  onMount(() => {
    seedEconomy();
    prepareBoard();
    const ro = new ResizeObserver(() => syncOverlay());
    const kick = () => {
      syncOverlay();
      if (hostRef) ro.observe(hostRef);
      const grid = hostRef ? findBoardGrid(hostRef) : null;
      if (grid) ro.observe(grid);
    };
    requestAnimationFrame(() => requestAnimationFrame(kick));
    window.addEventListener("resize", syncOverlay);
    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener("resize", syncOverlay);
      clearPress();
    });
  });

  createEffect(() => {
    void fen();
    prepareBoard();
    requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
  });

  return (
    <div class={styles.demo}>
      <div class={styles.host} ref={hostRef}>
        <ChessBoard variant="eclipse" fogOfWar />
        <Show when={overlayBox()}>
          {(box) => (
            <div
              class={styles.boardOverlay}
              data-special="king-spawn"
              style={{
                top: `${box().top}px`,
                left: `${box().left}px`,
                width: `${box().width}px`,
                height: `${box().height}px`,
              }}
            >
              <Show when={phase() === "idle" || phase() === "spawnModal"}>
                <div
                  class={`${styles.hit} ${styles.hitKing}`}
                  style={squareBoxStyle(KING_SQ, box().width, box().height)}
                  data-square={KING_SQ}
                  data-long-press="king"
                  onPointerDown={(e) => {
                    if (phase() !== "idle") return;
                    e.preventDefault();
                    clearPress();
                    pressTimer = window.setTimeout(openSpawn, LONG_PRESS_MS);
                  }}
                  onPointerUp={clearPress}
                  onPointerLeave={clearPress}
                  onPointerCancel={clearPress}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </Show>

              <Show when={phase() === "pickAdjacent"}>
                <For each={adjacent()}>
                  {(sq) => (
                    <div
                      class={`${styles.hit} ${styles.hitAdjacent}`}
                      style={squareBoxStyle(sq, box().width, box().height)}
                      data-square={sq}
                      data-spawn-target
                      onClick={() => deployAt(sq)}
                    />
                  )}
                </For>
              </Show>
            </div>
          )}
        </Show>
        <SpawnModal pending={modalPending()} onSelect={onSelectUnit} onCancel={onCancelModal} />
      </div>
      <p class={styles.caption}>{caption()}</p>
    </div>
  );
};
