import { adjutant, formatScFen } from "@chess-coach/starchess-core";
import type { Component, JSX } from "solid-js";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";

import { createMatchStateFromScfen } from "~/app/matchReducer";
import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { displayedSnapshot } from "~/app/selectors";
import { BaseScreen } from "~/app/BaseScreen.tsx";
import { TutorialCompleteConfirm } from "~/components/features/TutorialCompleteConfirm";
import { KING_HUNT_LIVE_START_SCFEN } from "~/demos/kingHunt";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import {
  isTutorialCleared,
  setTutorialCleared,
  shouldOfferTutorialComplete,
} from "~/store/tutorialProgressStore";
import { resetTutorialNarration, setTutorialNarration } from "~/tutorial/tutorialNarrationStore";
import type { KerriganEmotion } from "~/types/coach";

export type KingHuntLiveScreenProps = {
  /** Skip outer LiveMatchShell when nested in the tutorial shell. */
  embedded?: boolean;
  tutorial?: boolean;
  /** Keep ResourceBars for the live final test (default true). */
  hideResources?: boolean;
  onExitToMenu?: () => void;
  header?: JSX.Element;
  coachEmotion?: KerriganEmotion;
  guideBubble?: JSX.Element;
  footerExtra?: JSX.Element;
  turnChrome?: "bar" | "sidebar";
};

/**
 * King Hunt (live) — same HUD shell as `/starchess/single`.
 * Tutorial embeds without a second sky shell.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
export const KingHuntLiveScreen: Component<KingHuntLiveScreenProps> = (props) => {
  const store = createMatchStore({
    initial: createMatchStateFromScfen(KING_HUNT_LIVE_START_SCFEN, 1),
    autoArmTimer: props.tutorial ? true : undefined,
  });

  const body = (
    <MatchStoreProvider store={store}>
      <KingHuntLiveInner
        tutorial={props.tutorial}
        hideResources={props.hideResources}
        onExitToMenu={props.onExitToMenu}
        header={props.header}
        coachEmotion={props.coachEmotion}
        footerExtra={props.footerExtra}
        turnChrome={props.turnChrome}
        guideBubble={props.guideBubble}
      />
    </MatchStoreProvider>
  );

  if (props.embedded) return body;
  return <LiveMatchShell world="eclipse">{body}</LiveMatchShell>;
};

const KingHuntLiveInner: Component<Omit<KingHuntLiveScreenProps, "embedded">> = (props) => {
  const store = useMatchStore();
  const [completeOpen, setCompleteOpen] = createSignal(false);
  let completeOffered = false;

  createEffect(() => {
    if (!props.tutorial) return;
    const s = store.state();
    const board = displayedSnapshot(s);
    const phase = liveMatchPhase({
      phase: s.phase,
      lastResolve: s.lastResolve,
      timelineActive: s.timeline.active,
      pendingPromotion: !!s.pendingPromotion,
    });
    setTutorialNarration({
      reviewPhase: phase,
      timelineActive: s.timeline.active,
      scfen: formatScFen(board),
      // Seed SCFEN uses turn 0 for the first planning window; +1 → 1-based ordinal
      // so turn-gated lines drop after the first End (wire turn 1 → ordinal 2).
      turn: board.turn + 1,
    });
  });

  createEffect(() => {
    if (!props.tutorial) return;
    const s = store.state();
    void s.phase;
    void s.liveSnapshot.kingLives.b;
    if (completeOffered) return;
    if (
      !shouldOfferTutorialComplete({
        tutorial: true,
        phase: s.phase,
        enemyKingLives: s.liveSnapshot.kingLives.b,
        cleared: isTutorialCleared(),
      })
    ) {
      return;
    }
    completeOffered = true;
    setCompleteOpen(true);
  });

  onCleanup(() => {
    if (props.tutorial) resetTutorialNarration();
  });

  const onGoHome = () => {
    setTutorialCleared(true);
    setCompleteOpen(false);
    props.onExitToMenu?.();
  };

  return (
    <>
      <BaseScreen
        boardVariant="eclipse"
        starChessMode
        armTimer
        tutorial={props.tutorial}
        hideResources={props.hideResources}
        turnChrome={props.turnChrome ?? "sidebar"}
        onExitToMenu={props.onExitToMenu}
        header={props.header}
        coachEmotion={props.coachEmotion}
        guideBubble={props.guideBubble}
        footerExtra={props.footerExtra}
        autoQueueOpponent={(snap) =>
          adjutant(snap, {
            color: "b",
            storedFor: (color) => store.state().economies[color].stored,
          })
        }
      />
      <Show when={props.tutorial}>
        <TutorialCompleteConfirm open={completeOpen()} onGoHome={onGoHome} />
      </Show>
    </>
  );
};
