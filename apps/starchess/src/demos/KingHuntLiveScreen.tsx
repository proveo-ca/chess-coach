import type { Component, JSX } from "solid-js";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { adjutant, formatScFen } from "@chess-coach/starchess-core";

import {
  createMatchStore,
  MatchStoreProvider,
  useMatchStore,
} from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { displayedSnapshot } from "~/app/selectors";
import { StarChessScreen } from "~/app/StarChessScreen";
import { TutorialIncompleteConfirm } from "~/components/features/TutorialIncompleteConfirm";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import { KING_HUNT_LIVE_START_SCFEN } from "~/demos/kingHunt";
import {
  resetTutorialNarration,
  setTutorialNarration,
} from "~/tutorial/tutorialNarrationStore";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import {
  isTutorialCleared,
  setTutorialCleared,
  shouldWarnTutorialIncomplete,
} from "~/store/tutorialProgressStore";
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
export const KingHuntLiveScreen: Component<KingHuntLiveScreenProps> = (
  props,
) => {
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

const KingHuntLiveInner: Component<
  Omit<KingHuntLiveScreenProps, "embedded">
> = (props) => {
  const store = useMatchStore();
  const [incompleteOpen, setIncompleteOpen] = createSignal(false);
  let incompleteOffered = false;

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
    if (incompleteOffered) return;
    if (
      !shouldWarnTutorialIncomplete({
        tutorial: true,
        phase: s.phase,
        enemyKingLives: s.liveSnapshot.kingLives.b,
        cleared: isTutorialCleared(),
      })
    ) {
      return;
    }
    incompleteOffered = true;
    setIncompleteOpen(true);
  });

  onCleanup(() => {
    if (props.tutorial) resetTutorialNarration();
  });

  const onIncompleteNo = () => setIncompleteOpen(false);
  const onIncompleteYes = () => {
    setTutorialCleared(true);
    setIncompleteOpen(false);
    props.onExitToMenu?.();
  };

  return (
    <>
      <StarChessScreen
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
        <TutorialIncompleteConfirm
          open={incompleteOpen()}
          onNo={onIncompleteNo}
          onYes={onIncompleteYes}
        />
      </Show>
    </>
  );
};
