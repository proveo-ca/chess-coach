import { adjutant, formatScFen } from "@chess-coach/starchess-core";
import type { Component, JSX } from "solid-js";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";

import { createMatchStateFromScfen } from "~/app/matchReducer";
import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { displayedSnapshot } from "~/app/selectors";
import { BaseScreen } from "~/app/BaseScreen.tsx";
import { TutorialCompleteConfirm } from "~/components/features/TutorialCompleteConfirm";
import { KING_HUNT_LIVE_START_SCFEN } from "~/demos/kingHunt";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import { setTutorialCleared } from "~/store/tutorialProgressStore";
import { resetTutorialNarration, setTutorialNarration } from "~/tutorial/tutorialNarrationStore";
import { resolveTutorialHints } from "~/tutorial/tutorialScript";
import type { KerriganEmotion } from "~/types/coach";
import type { TutorialBoardHint } from "~/types/tutorial";

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
  boardHints?: readonly TutorialBoardHint[];
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
        boardHints={props.boardHints}
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
  let completeTimer: ReturnType<typeof setTimeout> | undefined;

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
    void s.outcome;
    if (completeOffered) return;
    // Show graduation whenever the enemy CC dies in this run — even if the
    // player already cleared tutorial once (replay). `cleared` only gates menu.
    const enemyDead = s.liveSnapshot.kingLives.b === 0;
    const over =
      s.phase === "gameOver" ||
      s.liveSnapshot.phase === "O" ||
      s.outcome != null;
    if (!enemyDead || !over) return;
    completeOffered = true;
    // Do not clear this timer on effect re-runs (Solid onCleanup would cancel it).
    completeTimer = setTimeout(() => {
      completeTimer = undefined;
      setCompleteOpen(true);
    }, 1200);
  });

  const hintSquares = createMemo(() => {
    const snap = displayedSnapshot(store.state());
    return resolveTutorialHints(props.boardHints, formatScFen(snap));
  });

  onCleanup(() => {
    if (completeTimer != null) clearTimeout(completeTimer);
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
        hintSquares={hintSquares()}
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
