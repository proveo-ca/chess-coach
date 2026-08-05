import type { Square } from "chess.js";
import {
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";

import { findBoardGrid, squareBoxStyle } from "~/starchess/animations/boardGeom";
import { GasDeploy } from "~/starchess/features/GasDeploy";
import { useCommandCenterDeploy } from "~/starchess/hooks/useCommandCenterDeploy";
import { usePieceSpecialArm } from "~/starchess/hooks/usePieceSpecialArm";
import styles from "~/starchess/specials/KingSpawnDemo.module.css";
import { DeployModal } from "~/starchess/primitives/DeployModal";
import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setPlayerIdentity } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";

const KING_SQ: Square = "d4";
/** Both kings + spare rook so FEN stays loadable. */
const FEN_START = "r6k/8/8/8/3K4/8/8/7R w - - 0 1";

type OverlayBox = { top: number; left: number; width: number; height: number };

/**
 * Storybook: GasDeploy → Command Center (king) Deploy special → adjacent place.
 */
export const KingSpawnDemo: Component = () => {
  const [fen, setFen] = createSignal(FEN_START);
  const [overlayBox, setOverlayBox] = createSignal<OverlayBox | null>(null);

  const special = useCommandCenterDeploy({
    fen,
    setFen,
    kingSquare: KING_SQ,
    startingFen: FEN_START,
  });

  const { onGasDeploy } = usePieceSpecialArm({
    k: special.arm,
  });

  let hostRef = undefined as HTMLDivElement | undefined;

  const syncOverlay = () => {
    const host = hostRef;
    if (!host) return;
    const el = findBoardGrid(host);
    if (!el) return;
    const hr = host.getBoundingClientRect();
    const br = el.getBoundingClientRect();
    setOverlayBox({
      top: br.top - hr.top + el.clientTop,
      left: br.left - hr.left + el.clientLeft,
      width: el.clientWidth,
      height: el.clientHeight,
    });
  };

  const prepareBoard = () => {
    setStorybookCapabilities({ ...NERD_CAPABILITIES, readOnly: true });
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    loadFen(fen());
  };

  onMount(() => {
    special.seedEconomy();
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
        <StarChessChessBoard variant="eclipse" fogOfWar />
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
              <Show when={special.phase() === "pickAdjacent"}>
                <For each={special.adjacent()}>
                  {(sq) => (
                    <div
                      class={`${styles.hit} ${styles.hitAdjacent}`}
                      style={squareBoxStyle(sq, box().width, box().height)}
                      data-square={sq}
                      data-spawn-target
                      onClick={() => {
                        special.deployAt(sq);
                        requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
                      }}
                    />
                  )}
                </For>
              </Show>
            </div>
          )}
        </Show>
        <DeployModal
          pending={special.modalPending()}
          onSelect={special.onSelectUnit}
          onCancel={special.onCancelModal}
        />
      </div>
      <div class={styles.gasRow}>
        <GasDeploy onDeploy={onGasDeploy} />
      </div>
      <p class={styles.caption}>{special.caption()}</p>
    </div>
  );
};
