/**
 * Live fog lesson host — player fog, HOME-only sidebar, playable SCFEN seed.
 * Replaces DualNav FogEdgeDemo for Storybook Fog of War + tutorial stage 1.
 * // SPEC: _spec/apps/starchess/demos.puml
 */
import { formatScFen, placementToMap } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";
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
  clearSiegedRooks,
  setRookMode,
} from "~/presentation/animations/rookModeStore";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import {
  TUTORIAL_CAPABILITIES,
  setCapabilities,
} from "~/store/capabilitiesStore";
import {
  resetTutorialNarration,
  setTutorialNarration,
} from "~/tutorial/tutorialNarrationStore";
import { resolveTutorialHints } from "~/tutorial/tutorialScript";
import type { BoardSkin, PieceSet } from "~/types/board";
import type { KerriganEmotion } from "~/types/coach";

export type FogLiveScenarioScreenProps = {
  scfen: string;
  stored?: number;
  /** Force every rook to tank mode (fog-edge rook tank lesson). */
  rookTank?: boolean;
  /** Force every rook to siege mode when SCFEN has no `S:`. */
  rookSiege?: boolean;
  boardVariant?: BoardSkin;
  pieceSet?: PieceSet;
  armTimer?: boolean;
  onExitToMenu?: () => void;
  /** HOME-only chrome (Storybook + tutorial). */
  homeOnly?: boolean;
  hideResources?: boolean;
  /** Hide GasDeploy (Fog of War tutorial). */
  hideGas?: boolean;
  header?: JSX.Element;
  coachEmotion?: KerriganEmotion;
  guideBubble?: JSX.Element;
  footerExtra?: JSX.Element;
  turnChrome?: "bar" | "sidebar" | "none";
  /** Push review-phase narration for Selena reactions. */
  narrate?: boolean;
  /** Tutorial-only auto-End threshold (omit outside `/tutorial`). */
  endTurnAfterQueue?: "first" | "moveAndSpecial";
  /** Script-driven board hint rings (resolved against live SCFEN). */
  boardHints?: readonly import("~/tutorial/tutorialScript").TutorialBoardHint[];
};

const FogLiveInner: Component<FogLiveScenarioScreenProps> = (props) => {
  const store = useMatchStore();

  createEffect(() => {
    const placement = store.state().liveSnapshot.placement;
    clearSiegedRooks();
    if (props.rookTank || props.rookSiege) {
      try {
        const map = placementToMap(placement);
        for (const [sq, piece] of map) {
          if (piece.type === "r") {
            // rook-tank lesson: always tank InlineRook — never siege chassis.
            setRookMode(sq as Square, props.rookSiege ? "siege" : "tank");
          }
        }
      } catch {
        /* ignore */
      }
    }
    // Keep MatchStore sieged set aligned (Observer reads snap.siegedRooks).
    if (props.rookTank) {
      const s = store.state();
      if (s.siegedRooks.size > 0 || (s.liveSnapshot.siegedRooks?.length ?? 0) > 0) {
        store.dispatch({
          type: "APPLY_SNAPSHOT",
          snapshot: { ...s.liveSnapshot, siegedRooks: [] },
        });
      }
    }
  });

  createEffect(() => {
    if (!props.narrate) return;
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
    });
  });

  const hintSquares = createMemo(() => {
    const snap = displayedSnapshot(store.state());
    return resolveTutorialHints(props.boardHints, formatScFen(snap));
  });

  onMount(() => {
    if (props.homeOnly !== false) setCapabilities(TUTORIAL_CAPABILITIES);
    onCleanup(() => {
      clearSiegedRooks();
      if (props.narrate) resetTutorialNarration();
    });
  });

  return (
    <BaseScreen
      boardVariant={props.boardVariant ?? "eclipse"}
      pieceSet={props.pieceSet}
      starChessMode
      fog
      armTimer={props.armTimer === true}
      tutorial={props.homeOnly !== false}
      hideResources={props.hideResources ?? true}
      hideGas={props.hideGas}
      turnChrome={props.turnChrome ?? "sidebar"}
      onExitToMenu={props.onExitToMenu}
      header={props.header}
      coachEmotion={props.coachEmotion}
      guideBubble={props.guideBubble}
      footerExtra={props.footerExtra}
      endTurnAfterQueue={props.endTurnAfterQueue}
      hintSquares={hintSquares()}
    />
  );
};

export const FogLiveScenarioScreen: Component<FogLiveScenarioScreenProps> = (
  props,
) => {
  const store = createMatchStore({
    initial: createMatchStateFromScfen(props.scfen, props.stored ?? 4),
    autoArmTimer: props.armTimer === true,
  });

  return (
    <MatchStoreProvider store={store}>
      <FogLiveInner {...props} />
    </MatchStoreProvider>
  );
};
