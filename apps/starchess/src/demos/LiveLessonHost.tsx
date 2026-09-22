// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml, _spec/apps/starchess/architecture/screen-entities.puml
/**
 * Sole live-lesson host — seeds a MatchStore from a catalog board, publishes
 * narration, resolves hints, and mounts {@link BaseScreen}.
 *
 * Replaces the six per-lesson hosts (Fog / GasDeploy / KingDefense I+II /
 * KingHunt / Vermeer). What varied between them was config plus a little
 * imperative store choreography; config lives on `board`, choreography behind
 * `board.choreography` — see `demos/choreography/`.
 */
import { adjutant, formatScFen, getSideVision, placementToMap } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  untrack,
  type Component,
} from "solid-js";

import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { displayedSnapshot } from "~/app/selectors";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import { BaseScreen } from "~/app/BaseScreen.tsx";
import { CHOREOGRAPHY } from "~/demos/choreography";
import { clearSiegedRooks, setRookMode } from "~/presentation/animations/rookModeStore";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import { TUTORIAL_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import {
  nextAlertLatch,
  resolveTutorialAlertSquares,
  resolveTutorialArrows,
  resolveTutorialHints,
} from "~/tutorial/tutorialScript";
import type { AlertLatch } from "~/types/tutorial";
import { availableTrajectories, coveredEnemyShips } from "~/tutorial/lessonTactics";
import { useLessonNarration } from "~/tutorial/useLessonNarration";
import type { MatchState, MatchStore } from "~/types/match";
import type { LiveLessonHostProps } from "~/types/lesson";


/** Storybook gas control — clamp into the 0–3 canister range. */
const withViewerGas = (state: MatchState, gas: number | undefined): MatchState => {
  if (gas == null) return state;
  const g = Math.min(3, Math.max(0, Math.floor(gas)));
  return {
    ...state,
    liveSnapshot: {
      ...state.liveSnapshot,
      gas: { ...state.liveSnapshot.gas, [state.viewer]: g },
    },
  };
};

/** Force every rook into a mode the seed cannot express (fog rook lessons). */
const useForcedRookMode = (store: MatchStore, mode: () => "tank" | "siege" | undefined) => {
  createEffect(() => {
    const forced = mode();
    const placement = store.state().liveSnapshot.placement;
    clearSiegedRooks();
    if (!forced) return;
    try {
      for (const [square, piece] of placementToMap(placement)) {
        if (piece.type === "r") setRookMode(square as Square, forced);
      }
    } catch {
      /* malformed placement — leave rook modes alone */
    }
    // Keep the MatchStore sieged set aligned (observer reads snap.siegedRooks).
    if (forced !== "tank") return;
    const s = store.state();
    if (s.siegedRooks.size > 0 || (s.liveSnapshot.siegedRooks?.length ?? 0) > 0) {
      store.dispatch({
        type: "APPLY_SNAPSHOT",
        snapshot: { ...s.liveSnapshot, siegedRooks: [] },
      });
    }
  });

  onCleanup(() => clearSiegedRooks());
};

const LiveLessonInner: Component<LiveLessonHostProps> = (props) => {
  const store = useMatchStore();

  const choreography = props.board.choreography
    ? CHOREOGRAPHY[props.board.choreography](store, {
        tutorial: props.tutorial === true,
        onExitToMenu: props.onExitToMenu,
      })
    : {};

  useForcedRookMode(store, () => props.board.rookMode);
  useLessonNarration(store, () => props.narrate === true);

  onMount(() => {
    if (props.tutorial) setCapabilities(TUTORIAL_CAPABILITIES);
  });

  const interactive = () => choreography.interactive?.() ?? true;

  const hintQuery = createMemo(() => {
    const s = store.state();
    const snap = displayedSnapshot(s);
    const scfen = formatScFen(snap);
    return {
      scfen,
      covers: coveredEnemyShips(scfen, s.viewer),
      trajectories: availableTrajectories(scfen, s.viewer),
      query: {
        reviewPhase: liveMatchPhase({
          phase: s.phase,
          lastResolve: s.lastResolve,
          timelineActive: s.timeline.active,
          pendingPromotion: !!s.pendingPromotion,
        }),
        turn: snap.turn + 1,
      },
    };
  });

  const hintSquares = createMemo(() => {
    if (!interactive()) return [];
    const q = hintQuery();
    return resolveTutorialHints(props.boardHints, q.scfen, q.covers, q.trajectories, q.query);
  });

  const scriptedAlerts = createMemo(() => {
    const q = hintQuery();
    return resolveTutorialAlertSquares(
      props.boardHints,
      q.scfen,
      q.covers,
      q.trajectories,
      q.query,
    );
  });

  const [alertLatch, setAlertLatch] = createSignal<AlertLatch>({ squares: [] });

  createEffect(() => {
    const scripted = scriptedAlerts();
    const followKing = props.board.alertLatch === "king";
    let kingAt: Square | undefined;
    let kingVisible = false;
    if (followKing) {
      const placement = hintQuery().scfen.split("|")[1];
      if (placement) {
        try {
          const map = placementToMap(placement);
          const viewer = store.state().viewer;
          const enemy = viewer === "w" ? "b" : "w";
          for (const [sq, piece] of map) {
            if (piece.type === "k" && piece.color === enemy) kingAt = sq;
          }
          if (kingAt) {
            const vision = getSideVision(map, viewer);
            kingVisible =
              vision.litSquares.has(kingAt) || vision.revealedPieces.has(kingAt);
          }
        } catch {
          // A mid-animation placement can be unreadable for a frame.
        }
      }
    }
    if (!props.board.alertLatch) return;
    setAlertLatch((prev) =>
      nextAlertLatch(prev, scripted, { followKing, kingAt, kingVisible }),
    );
  });

  const hintAlertSquares = createMemo(() => {
    if (!interactive()) return [];
    return props.board.alertLatch ? alertLatch().squares : scriptedAlerts();
  });

  const hintArrows = createMemo(() => {
    if (!interactive()) return [];
    const q = hintQuery();
    return resolveTutorialArrows(props.boardHints, q.scfen, q.covers, q.trajectories, q.query);
  });

  const Overlay = choreography.Overlay;

  return (
    <>
      <BaseScreen
        starChessMode
        fog={props.fog}
        boardVariant={props.boardVariant ?? "eclipse"}
        pieceSet={props.pieceSet}
        armTimer={props.armTimer ?? props.board.armTimer}
        tutorial={props.tutorial}
        fullMatchHud={props.fullMatchHud}
        matchTitle={props.matchTitle}
        hideResources={props.hideResources}
        hideGas={props.hideGas}
        turnChrome={props.turnChrome}
        onExitToMenu={props.onExitToMenu}
        header={props.header}
        coachEmotion={props.coachEmotion}
        guideBubble={props.guideBubble}
        footerExtra={props.footerExtra}
        endTurnAfterQueue={
          interactive() ? props.board.endTurnAfterQueue : undefined
        }
        hintSquares={hintSquares()}
        hintAlertSquares={hintAlertSquares()}
        hintArrows={hintArrows()}
        autoQueueOpponent={
          props.board.opponent === "adjutant"
            ? (snap) =>
                adjutant(snap, {
                  color: store.state().viewer === "w" ? "b" : "w",
                  storedFor: (color) => store.state().economies[color].stored,
                })
            : undefined
        }
      />
      {Overlay ? <Overlay /> : null}
    </>
  );
};

export const LiveLessonHost: Component<LiveLessonHostProps> = (props) => {
  const store = createMatchStore({
    initial: withViewerGas(
      createMatchStateFromScfen(props.board.scfen, props.board.stored ?? 4),
      props.gas,
    ),
    // `autoArmTimer !== false` enables — so `undefined` must stay `undefined`.
    autoArmTimer: props.armTimer ?? props.board.armTimer,
  });

  // Storybook control only — re-apply on change without wiping queued spends.
  createEffect(() => {
    const g = props.gas;
    if (g == null) return;
    const next = Math.min(3, Math.max(0, Math.floor(g)));
    untrack(() => {
      const s = store.state();
      if ((s.liveSnapshot.gas[s.viewer] ?? 0) === next) return;
      store.dispatch({
        type: "APPLY_SNAPSHOT",
        snapshot: {
          ...s.liveSnapshot,
          gas: { ...s.liveSnapshot.gas, [s.viewer]: next },
        },
      });
    });
  });

  const body = (
    <MatchStoreProvider store={store}>
      <LiveLessonInner {...props} />
    </MatchStoreProvider>
  );

  return props.shell ? <LiveMatchShell world={props.shell}>{body}</LiveMatchShell> : body;
};
