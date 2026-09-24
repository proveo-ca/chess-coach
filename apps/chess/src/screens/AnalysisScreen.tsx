// SPEC: _spec/apps/chess/components.puml
import { createSignal, onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";

import { OpponentCaptures, PlayerCaptures } from "~/components/atoms/CapturedPieces";
import { DebugControls } from "~/components/atoms/DebugControls";
import { EngineDepth } from "~/components/atoms/EngineDepth";
import { FenLoader } from "~/components/atoms/FenLoader";
import { MobileBanner } from "~/components/atoms/MobileBanner";
import { Modal } from "@chess-coach/ui-web/atoms/Modal";
import { BoardControls } from "~/components/features/BoardControls";
import { ChessBoard } from "~/components/features/ChessBoard";
import { MobileDrawer, openMobileDrawer } from "~/components/features/MobileDrawer";
import { MobileSidebar } from "~/components/features/MobileSidebar";
import { Sidebar } from "~/components/features/Sidebar";
import { DualNavButton } from "@chess-coach/ui-web/primitives/DualNavButton";
import { IconButton } from "@chess-coach/ui-web/primitives/IconButton";
import { Label } from "@chess-coach/ui-web/primitives/Label";
import {
  FlipBoardIcon,
  LoadFenIcon,
  PlusCircleIcon,
} from "@chess-coach/ui-web/primitives/icons";
import { Screen } from "@chess-coach/ui-web/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { useGameControls } from "~/hooks/useGameControls";
import styles from "~/screens/AnalysisScreen.module.css";
import { ANALYSIS_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { inProgressGame } from "~/store/gameHistoryStore";
import { persistFreshStart, resetGame } from "~/store/gameStore";
import { activePlayerColor, imLost, setActivePlayerColor, setImLost } from "~/store/settingsStore";

/**
 * Solo Analysis screen. No coach avatar, no advice panel, no replay or
 * travel overlays. Installs the Analysis capability set on mount so
 * downstream hooks switch to analysis behavior: continuous Stockfish
 * analysis with best-move highlighting, both colors playable, past
 * positions branch on new moves, no AI opponent, no blunder detection,
 * no hint button.
 *
 * Layout: top = desktop Back/title/FEN or mobile {@link MobileBanner}.
 * Dynamic (w≥480 · h<640): fused banner — Back · New Game · Flip · Load FEN ·
 * EngineDepth · history nav · menu — plus captures + board (no stacked FEN /
 * footer bar). Tall mobile: title banner + FenLoader + captures; footer
 * BoardControls. Middle = ChessBoard (+ Sidebar).
 */
export const AnalysisScreen: Component = () => {
  let previousImLost = false;
  const [fenOpen, setFenOpen] = createSignal(false);
  const {
    atStart,
    atLatest,
    isReplaying,
    handleBack,
    handleForward,
    handleBackToLive,
  } = useGameControls();

  onMount(() => {
    if (!inProgressGame()) persistFreshStart();

    setCapabilities(ANALYSIS_CAPABILITIES);
    previousImLost = imLost();
    setImLost(true);
  });

  onCleanup(() => {
    setImLost(previousImLost);
  });

  const flipBoard = () => {
    setActivePlayerColor(activePlayerColor() === "w" ? "b" : "w");
  };

  return (
    <Screen>
      <Screen.SidebarInset>
        <div class="desktop-only">
          <ScreenBackNav data-testid="analysis-back">
            <Label variant="title">Solo Analysis</Label>
            <FenLoader />
          </ScreenBackNav>
        </div>

        {/* Dynamic: fused strip = tools in banner. Tall: title banner pinned top + FEN below. */}
        <div data-fuse-root data-testid="mobile-fuse">
          <MobileBanner title="Solo Analysis" onMenu={openMobileDrawer} hideCentre />
          <MobileSidebar dynamicOnly>
            <MobileSidebar.Main>
              <EngineDepth />
            </MobileSidebar.Main>
            {/* Nearest-centre first → fan-out: [New Game][Flip][Load] · depth · nav */}
            <MobileSidebar.Item>
              <IconButton onClick={() => setFenOpen(true)} aria-label="Load FEN">
                <LoadFenIcon />
              </IconButton>
            </MobileSidebar.Item>
            <MobileSidebar.Item>
              <IconButton onClick={flipBoard} aria-label="Flip board">
                <FlipBoardIcon />
              </IconButton>
            </MobileSidebar.Item>
            <MobileSidebar.Item>
              <IconButton onClick={() => resetGame()} aria-label="New game">
                <PlusCircleIcon />
              </IconButton>
            </MobileSidebar.Item>
            <MobileSidebar.Item nav>
              <DualNavButton
                onBack={handleBack}
                onForward={handleForward}
                backDisabled={atStart()}
                forwardDisabled={atLatest()}
                inverted={isReplaying()}
                showBackToLive={isReplaying()}
                onBackToLive={handleBackToLive}
                label={isReplaying() ? "History" : undefined}
              />
            </MobileSidebar.Item>
          </MobileSidebar>
        </div>

        <div class={`mobile-only ${styles.tallOnly}`}>
          <div class={styles.mobileFen} data-testid="analysis-mobile-fen">
            <FenLoader />
          </div>
        </div>
        {/* Captures stay on dynamic (0.75 scale via CapturedPieces CSS). */}
        <OpponentCaptures />
      </Screen.SidebarInset>

      <Screen.BoardArea>
        <Screen.BoardColumn>
          <ChessBoard />
        </Screen.BoardColumn>
        <Sidebar />
      </Screen.BoardArea>

      <Screen.Footer>
        <PlayerCaptures />
        <div class={styles.tallOnly}>
          <BoardControls center={<EngineDepth />} omitDrawer />
        </div>
      </Screen.Footer>

      <Modal
        open={fenOpen()}
        title="Load FEN"
        onClose={() => setFenOpen(false)}
        contentClass={styles.fenModal}
      >
        <FenLoader onLoaded={() => setFenOpen(false)} />
      </Modal>

      <DebugControls />
      <MobileDrawer />
    </Screen>
  );
};
