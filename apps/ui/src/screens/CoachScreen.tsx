// SPEC: _spec/apps/ui/components.puml
import { createSignal, onMount } from "solid-js";
import type { Component } from "solid-js";

import { OpponentCaptures, PlayerCaptures } from "~/components/atoms/CapturedPieces";
import { CoachAvatar } from "~/components/atoms/CoachAvatar.tsx";
import {
  DebugControls,
  debugHistoryOverlay,
  debugLightSpeedOverlay,
} from "~/components/atoms/DebugControls";
import { LightSpeedOverlay } from "~/components/atoms/LightSpeedOverlay";
import { MobileBanner } from "~/components/atoms/MobileBanner";
import { Modal } from "~/components/atoms/Modal";
import { BoardControls } from "~/components/features/BoardControls";
import { ChessBoard } from "~/components/features/ChessBoard";
import { CoachPanel } from "~/components/features/CoachPanel.tsx";
import { MobileDrawer, openMobileDrawer } from "~/components/features/MobileDrawer";
import { Sidebar } from "~/components/features/Sidebar";
import { HistoryOverlay } from "~/components/primitives/HistoryOverlay";
import { Screen } from "~/components/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { useGameRecorder } from "~/hooks/useGameRecorder";
import { useLivePreAnalysis } from "~/hooks/useLivePreAnalysis";
import { fetchHello, postAdviceStream, postMove } from "~/services/api";
import { checkEngineSupport } from "~/services/browserSupport";
import { accumulateStream } from "~/services/streamUtils";
import { COACH_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import {
  dispatchCoachEvent,
  setAdvice,
  setBestMovePhrases,
  setThinkingPhrases,
} from "~/store/coachStore";
import {
  addMoveSan,
  currentFen,
  currentIndex,
  fenHistory,
  game,
  restoreGame,
} from "~/store/gameStore";
import { activePlayerColor, difficulty } from "~/store/settingsStore";
import { isTravelling } from "~/store/travelStore";
import { logger } from "~/utils/logger";

import styles from "~/screens/CoachScreen.module.css";

/**
 * "Playing with Selena" screen. Shows the coach avatar, advice panel, and
 * replay/travel overlays. Installs the Coach capability set on mount so
 * downstream hooks (useChessBoard, useHoverEvaluator, etc.) wire up the
 * full Coach experience: hint button, travel, blunder detection, AI
 * opponent, replay-lock on past positions.
 *
 * Layout: top = {@link MobileBanner} flush top; tall-mobile hero
 * {@link CoachAvatar} floats over the banner (z-index); then BoardControls,
 * opponent captures; desktop Back+avatar; middle = ChessBoard (+ Sidebar)
 * only; bottom = player captures / CoachPanel.
 * Mobile hero vs compact avatar is CSS-owned (`CoachScreen.module.css`).
 */
export const CoachScreen: Component = () => {
  const [unsupportedReason, setUnsupportedReason] = createSignal<string | null>(null);
  const [debugInfo, setDebugInfo] = createSignal<string>("");

  useGameRecorder();
  useLivePreAnalysis();

  onMount(async () => {
    setCapabilities(COACH_CAPABILITIES);
    restoreGame();

    try {
      const helloData = await fetchHello();

      if (fenHistory().length > 1) {
        setAdvice("Welcome back! Let's continue our game.");
      } else {
        setAdvice(helloData.greeting);
      }

      setThinkingPhrases(helloData.thinking);
      setBestMovePhrases(helloData.bestMove);
      dispatchCoachEvent({ type: "APP_READY" });

      const g = game();
      const turn = currentFen().split(" ")[1];

      if (!g.isGameOver() && turn !== activePlayerColor()) {
        dispatchCoachEvent({ type: "AI_THINKING" });
        setAdvice("Let me think about my next move...");

        postMove({
          humanMoveSan: "",
          fenAfterHuman: currentFen(),
          difficulty: difficulty(),
        })
          .then(async (moveData) => {
            addMoveSan(moveData.move);
            dispatchCoachEvent({ type: "AI_MOVED" });

            await accumulateStream(
              postAdviceStream,
              { humanMove: "", aiMove: moveData.move, fen: moveData.fen },
              setAdvice,
            );
          })
          .catch((err) => {
            logger.error("Failed to execute AI continuation move", err);
            setAdvice("Error getting my move.");
            dispatchCoachEvent({ type: "AI_ERROR" });
          });
      }
    } catch (err) {
      logger.error("Failed to fetch /hello", err);
      setAdvice("Hey! I couldn't connect to the server. Is it running?");
      dispatchCoachEvent({ type: "APP_ERROR" });
    }

    const { supported, reason, debug } = checkEngineSupport();
    if (!supported) {
      setUnsupportedReason(reason);
      setDebugInfo(debug);
    }
  });

  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  return (
    <Screen highlight={isTravelling() || isReplaying()}>
      <HistoryOverlay active={debugHistoryOverlay() || (isReplaying() && !isTravelling())} />
      <LightSpeedOverlay active={debugLightSpeedOverlay() || isTravelling()} />

      <Screen.Header>
        <div class="desktop-only">
          <ScreenBackNav data-testid="coach-back">
            <CoachAvatar />
          </ScreenBackNav>
        </div>
        {/* Dynamic: banner+bar fuse. Tall: display:contents — hero + bar layout unchanged. */}
        <div data-fuse-root data-testid="mobile-fuse">
          <MobileBanner title="Selena" onMenu={openMobileDrawer} hideCentre />
          <BoardControls center={<CoachAvatar compact />} centerOverflow omitDrawer />
        </div>
        {/* Outside fuse so tall-mobile margin-bottom:auto spacer still works. */}
        <div class={styles.mobileHero} data-testid="coach-mobile-hero">
          <CoachAvatar />
        </div>
        <OpponentCaptures />
      </Screen.Header>

      <Screen.BoardArea>
        <Screen.BoardColumn>
          <ChessBoard />
        </Screen.BoardColumn>
        <Sidebar />
      </Screen.BoardArea>

      <Screen.Footer>
        <PlayerCaptures />
        <CoachPanel />
      </Screen.Footer>

      <Modal
        open={!!unsupportedReason()}
        title="Browser Not Supported"
        onClose={() => setUnsupportedReason(null)}
      >
        <p>{unsupportedReason()}</p>
        <p>
          Please try <strong>Chrome</strong>, <strong>Brave</strong>, <strong>Safari</strong>,{" "}
          <strong>Edge</strong>, or <strong>Firefox</strong> for the best experience.
        </p>
        <details>
          <summary style={{ "font-size": "0.8rem", cursor: "pointer", color: "#999" }}>
            Debug info
          </summary>
          <pre style={{ "font-size": "0.7rem", "white-space": "pre-wrap", color: "#888" }}>
            {debugInfo()}
          </pre>
        </details>
      </Modal>

      <DebugControls />
      <MobileDrawer />
    </Screen>
  );
};
