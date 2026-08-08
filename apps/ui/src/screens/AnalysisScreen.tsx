// SPEC: _spec/apps/ui/components.puml
import { onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";

import { OpponentCaptures, PlayerCaptures } from "~/components/atoms/CapturedPieces";
import { DebugControls } from "~/components/atoms/DebugControls";
import { EngineDepth } from "~/components/atoms/EngineDepth";
import { FenLoader } from "~/components/atoms/FenLoader";
import { MobileBanner } from "~/components/atoms/MobileBanner";
import { BoardControls } from "~/components/features/BoardControls";
import { ChessBoard } from "~/components/features/ChessBoard";
import { MobileDrawer, openMobileDrawer } from "~/components/features/MobileDrawer";
import { Sidebar } from "~/components/features/Sidebar";
import { Label } from "~/components/primitives/Label";
import { Screen } from "~/components/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import styles from "~/screens/AnalysisScreen.module.css";
import { ANALYSIS_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { inProgressGame } from "~/store/gameHistoryStore";
import { persistFreshStart } from "~/store/gameStore";
import { imLost, setImLost } from "~/store/settingsStore";

/**
 * Solo Analysis screen. No coach avatar, no advice panel, no replay or
 * travel overlays. Installs the Analysis capability set on mount so
 * downstream hooks switch to analysis behavior: continuous Stockfish
 * analysis with best-move highlighting, both colors playable, past
 * positions branch on new moves, no AI opponent, no blunder detection,
 * no hint button.
 *
 * Layout: top = desktop Back/title/FEN or mobile {@link MobileBanner} +
 * growing FenLoader (bottom-aligned in the top grid region) + opponent
 * captures; middle = ChessBoard (+ Sidebar) only; bottom = player captures
 * + EngineDepth {@link BoardControls}.
 */
export const AnalysisScreen: Component = () => {
  let previousImLost = false;

  onMount(() => {
    if (!inProgressGame()) persistFreshStart();

    setCapabilities(ANALYSIS_CAPABILITIES);
    previousImLost = imLost();
    setImLost(true);
  });

  onCleanup(() => {
    setImLost(previousImLost);
  });

  return (
    <Screen>
      <Screen.SidebarInset>
        <div class="desktop-only">
          <ScreenBackNav data-testid="analysis-back">
            <Label variant="title">Solo Analysis</Label>
            <FenLoader />
          </ScreenBackNav>
        </div>
        <MobileBanner title="Solo Analysis" onMenu={openMobileDrawer} />
        <div class={`mobile-only ${styles.mobileFen}`} data-testid="analysis-mobile-fen">
          <FenLoader />
        </div>
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
        <BoardControls center={<EngineDepth />} omitDrawer />
      </Screen.Footer>

      <DebugControls />
      <MobileDrawer />
    </Screen>
  );
};
