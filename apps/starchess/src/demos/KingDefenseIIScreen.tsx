/**
 * King Defense II live host — teaches deploy-crush and CC counter-attack.
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
  KING_DEFENSE_II_START_SCFEN,
  KING_DEFENSE_II_STORED,
} from "~/demos/kingDefenseII";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import {
  resetTutorialNarration,
  setTutorialNarration,
} from "~/tutorial/tutorialNarrationStore";
import { resolveTutorialHints } from "~/tutorial/tutorialScript";
import type { KerriganEmotion } from "~/types/coach";
import type { TutorialBoardHint } from "~/types/tutorial";

export type KingDefenseIIScreenProps = {
  onExitToMenu?: () => void;
  header?: JSX.Element;
  coachEmotion?: KerriganEmotion;
  guideBubble?: JSX.Element;
  footerExtra?: JSX.Element;
  turnChrome?: "bar" | "sidebar" | "none";
  boardHints?: readonly TutorialBoardHint[];
};

const KingDefenseIIInner: Component<KingDefenseIIScreenProps> = (props) => {
  const store = useMatchStore();

  onMount(() => {
    queueMicrotask(() => {
      store.ensureTurnOpenChecks();
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

  const interactive = createMemo(() => {
    const s = store.state();
    return (
      s.turnStartChecksApplied &&
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

export const KingDefenseIIScreen: Component<KingDefenseIIScreenProps> = (
  props,
) => {
  const store = createMatchStore({
    initial: createMatchStateFromScfen(
      KING_DEFENSE_II_START_SCFEN,
      KING_DEFENSE_II_STORED,
    ),
  });

  return (
    <MatchStoreProvider store={store}>
      <KingDefenseIIInner {...props} />
    </MatchStoreProvider>
  );
};
