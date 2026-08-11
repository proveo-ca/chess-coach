/**
 * King Defense live host — auto-resolves Turn 1 bishop slide, then player saves CC.
 */
import { formatScFen } from "@chess-coach/starchess-core";
import {
  createEffect,
  createMemo,
  onCleanup,
  onMount,
  type Component,
  type JSX,
} from "solid-js";

import {
  createMatchStore,
  MatchStoreProvider,
  useMatchStore,
} from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { displayedSnapshot } from "~/app/selectors";
import { BaseScreen } from "~/app/BaseScreen.tsx";
import {
  KING_DEFENSE_START_SCFEN,
  KING_DEFENSE_STORED,
} from "~/demos/kingDefense";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import {
  resetTutorialNarration,
  setTutorialNarration,
} from "~/tutorial/tutorialNarrationStore";
import { resolveTutorialHints } from "~/tutorial/tutorialScript";
import type { KerriganEmotion } from "~/types/coach";
import type { TutorialBoardHint } from "~/types/tutorial";

export type KingDefenseScreenProps = {
  onExitToMenu?: () => void;
  header?: JSX.Element;
  coachEmotion?: KerriganEmotion;
  guideBubble?: JSX.Element;
  footerExtra?: JSX.Element;
  turnChrome?: "bar" | "sidebar" | "none";
  boardHints?: readonly TutorialBoardHint[];
};

const KingDefenseInner: Component<KingDefenseScreenProps> = (props) => {
  const store = useMatchStore();
  let openingSubmitted = false;

  // Turn 1: resolve pre-queued Bh4→g3 so the check is visible, then player plans.
  onMount(() => {
    queueMicrotask(() => {
      if (openingSubmitted) return;
      const s = store.state();
      const blackQ = (s.liveSnapshot.queue?.actions ?? []).filter(
        (a) => a.color === "b",
      );
      if (s.liveSnapshot.turn !== 0 || blackQ.length === 0) return;
      openingSubmitted = true;
      store.submitTurn("end");
    });
    onCleanup(() => {
      resetTutorialNarration();
    });
  });

  createEffect(() => {
    const s = store.state();
    const snap = displayedSnapshot(s);
    const queue = (snap.queue?.actions ?? []).map((a) => ({
      timing: a.timing,
      kind: a.kind,
      color: a.color,
    }));
    setTutorialNarration({
      reviewPhase: liveMatchPhase({
        phase: s.phase,
        lastResolve: s.lastResolve,
        timelineActive: s.timeline.active,
        pendingPromotion: !!s.pendingPromotion,
      }),
      timelineActive: s.timeline.active,
      scfen: formatScFen(snap),
      queue,
      targetingKind: s.targeting?.kind ?? null,
      turn: snap.turn + 1,
    });
  });

  const hintSquares = createMemo(() => {
    const snap = displayedSnapshot(store.state());
    return resolveTutorialHints(props.boardHints, formatScFen(snap));
  });

  // Suppress player input until Turn 1 bishop resolve has settled (turn ≥ 1, idle).
  const interactive = createMemo(() => {
    const s = store.state();
    return (
      s.liveSnapshot.turn >= 1 &&
      !s.timeline.active &&
      (s.phase === "planning" || s.phase === "targeting")
    );
  });

  return (
    <BaseScreen
      boardVariant="eclipse"
      starChessMode
      tutorial
      hideResources={false}
      turnChrome={props.turnChrome ?? "sidebar"}
      onExitToMenu={props.onExitToMenu}
      header={props.header}
      coachEmotion={props.coachEmotion}
      guideBubble={props.guideBubble}
      footerExtra={props.footerExtra}
      endTurnAfterQueue={interactive() ? "moveAndSpecial" : undefined}
      hintSquares={interactive() ? hintSquares() : []}
    />
  );
};

export const KingDefenseScreen: Component<KingDefenseScreenProps> = (props) => {
  const store = createMatchStore({
    initial: createMatchStateFromScfen(
      KING_DEFENSE_START_SCFEN,
      KING_DEFENSE_STORED,
    ),
  });

  return (
    <MatchStoreProvider store={store}>
      <KingDefenseInner {...props} />
    </MatchStoreProvider>
  );
};
