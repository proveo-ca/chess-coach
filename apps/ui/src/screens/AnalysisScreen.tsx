// SPEC: _spec/apps/ui/components.puml
import { useNavigate } from "@solidjs/router";
import { onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";

import { OpponentCaptures, PlayerCaptures } from "~/components/atoms/CapturedPieces";
import { DebugControls } from "~/components/atoms/DebugControls";
import { EngineDepth } from "~/components/atoms/EngineDepth";
import { FenLoader } from "~/components/atoms/FenLoader";
import { BoardControls } from "~/components/features/BoardControls";
import { ChessBoard } from "~/components/features/ChessBoard";
import { MobileDrawer, openMobileDrawer } from "~/components/features/MobileDrawer";
import { MobileSidebar } from "~/components/features/MobileSidebar";
import { Sidebar } from "~/components/features/Sidebar";
import { ChevronNav } from "~/components/primitives/ChevronNav";
import { IconButton } from "~/components/primitives/IconButton";
import { HamburgerIcon } from "~/components/primitives/icons";
import { Label } from "~/components/primitives/Label";
import { Screen } from "~/components/primitives/Screen";
import { ANALYSIS_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { inProgressGame } from "~/store/gameHistoryStore";
import { persistFreshStart } from "~/store/gameStore";
import { imLost, setImLost } from "~/store/settingsStore";
import { screenBackTarget } from "~/utils/navHistory";

import styles from "~/screens/AnalysisScreen.module.css";

/**
 * Solo Analysis screen. No coach avatar, no advice panel, no replay or
 * travel overlays. Installs the Analysis capability set on mount so
 * downstream hooks switch to analysis behavior: continuous Stockfish
 * analysis with best-move highlighting, both colors playable, past
 * positions branch on new moves, no AI opponent, no blunder detection,
 * no hint button.
 *
 * Mobile chrome mirrors Review `/:id`: title toolbar always mounted with
 * drawer left of the label + `omitDrawer` on BoardControls. Short / dynamic
 * hides the title toolbar; the menu sits in FenLoader’s leading slot (left of
 * the FEN input) so it never overlays the field. `‹ Back` sits top-left on
 * desktop and in the mobile toolbar.
 */
export const AnalysisScreen: Component = () => {
  const navigate = useNavigate();
  let previousImLost = false;

  onMount(() => {
    // Circuit-breaker: if no game is active, persist a clean starting
    // position so that navigating to /selena restores fresh instead of
    // loading a corrupted or stale game state from localStorage.
    if (!inProgressGame()) persistFreshStart();

    setCapabilities(ANALYSIS_CAPABILITIES);
    previousImLost = imLost();
    setImLost(true);
  });

  onCleanup(() => {
    setImLost(previousImLost);
  });

  const goBack = () => {
    const target = screenBackTarget();
    if (typeof target === "number") navigate(target);
    else navigate(target);
  };

  const menuButton = () => (
    <IconButton onClick={openMobileDrawer} aria-label="Open menu">
      <HamburgerIcon />
    </IconButton>
  );

  const backNav = () => (
    <ChevronNav
      direction="back"
      onClick={goBack}
      aria-label="Back"
      data-testid="analysis-back"
    >
      Back
    </ChevronNav>
  );

  return (
    <Screen>
      <div class="desktop-only">
        <Screen.SidebarInset>
          <div class={styles.topNav}>{backNav()}</div>
          <Label variant="title">Solo Analysis</Label>
          <FenLoader />
        </Screen.SidebarInset>
      </div>

      <Screen.BoardArea>
        <Screen.BoardColumn>
          <MobileSidebar toolbar collapseOnShort>
            <MobileSidebar.Item drawer>{menuButton()}</MobileSidebar.Item>
            <MobileSidebar.Item>{backNav()}</MobileSidebar.Item>
            <MobileSidebar.Main>
              <MobileSidebar.MatchupLabel data-testid="analysis-title">
                <Label variant="title">Solo Analysis</Label>
              </MobileSidebar.MatchupLabel>
            </MobileSidebar.Main>
          </MobileSidebar>
          <div class="mobile-only">
            <FenLoader leading={menuButton()} trailing={backNav()} />
          </div>
          <BoardControls center={<EngineDepth />} omitDrawer />
          <OpponentCaptures />
          <ChessBoard />
          <PlayerCaptures />
        </Screen.BoardColumn>
        <Sidebar />
      </Screen.BoardArea>

      <DebugControls />
      <MobileDrawer />
    </Screen>
  );
};
