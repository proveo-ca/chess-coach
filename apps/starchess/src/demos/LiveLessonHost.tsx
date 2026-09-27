// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml, _spec/apps/starchess/architecture/screen-entities.puml, _spec/apps/starchess/tutorial/hints-and-coach.md, _spec/apps/starchess/architecture/reactivity/tutorial.md
/**
 * Sole live-lesson host — seeds a MatchStore from a catalog board, publishes
 * narration, resolves hints, and mounts {@link BaseScreen}.
 *
 * Replaces the six per-lesson hosts (Fog / GasDeploy / KingDefense I+II /
 * KingHunt / Vermeer). What varied between them was config plus a little
 * imperative store choreography; config lives on `board`, choreography behind
 * `board.choreography` — see `demos/choreography/`.
 */
import {
  adjutant,
  emptyCCIntel,
  getSideVision,
  placementToMap,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";
import {
  createComputed,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  untrack,
  type Component,
} from "solid-js";

import { createMatchStore } from "~/app/MatchStoreContext";
import { MatchStoreProvider, useMatchStore } from "~/ports/matchStore";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { QueueHintProvider } from "~/presentation/hud/queueHint";
import { BaseScreen } from "~/app/BaseScreen.tsx";
import { CHOREOGRAPHY, type ChoreographyResult } from "~/demos/choreography";
import { clearSiegedTanks, setTankMode } from "~/presentation/animations/tankModeStore";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import { CapabilitiesProvider, LIVE_CAPABILITIES, TUTORIAL_CAPABILITIES } from "~/store/capabilitiesStore";
import {
  nextAlertLatch,
  nextCCSighting,
  resolveTutorialHint,
  withCCAlert,
} from "~/tutorial/tutorialScript";
import type { AlertLatch, LiveLessonBoard, NarrationSink, TutorialBoardArrow } from "~/types/tutorial";
import { sameStructure } from "~/tutorial/sameStructure";
import { createLessonBoard, useLessonNarration } from "~/tutorial/useLessonNarration";
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
const useForcedTankMode = (store: MatchStore, mode: () => "tank" | "siege" | undefined) => {
  const placement = createMemo(() => store.shell().liveSnapshot.placement);
  const siegedCount = createMemo(
    () => store.shell().siegedTanks.size + (store.shell().liveSnapshot.siegedTanks?.length ?? 0),
  );
  createEffect(() => {
    const forced = mode();
    const current = placement();
    siegedCount();
    clearSiegedTanks();
    if (!forced) return;
    try {
      for (const [square, piece] of placementToMap(current)) {
        if (piece.type === "r") setTankMode(square as Square, forced);
      }
    } catch {
      /* malformed placement — leave rook modes alone */
    }
    // Keep the MatchStore sieged set aligned (observer reads snap.siegedTanks).
    if (forced !== "tank" || siegedCount() === 0) return;
    const live = untrack(() => store.shell().liveSnapshot);
    store.dispatch({
      type: "APPLY_SNAPSHOT",
      snapshot: { ...live, siegedTanks: [] },
    });
  });

  onCleanup(() => clearSiegedTanks());
};

const LessonScope: Component<{
  board: LiveLessonBoard;
  lessonBoard: ReturnType<typeof createLessonBoard>;
  onNarration?: NarrationSink;
  lessonKey: string;
  tutorial: boolean;
  onExitToMenu?: () => void;
  onChoreography: (c: ChoreographyResult) => void;
}> = (props) => {
  const store = useMatchStore();
  const choreography = untrack(() =>
    props.board.choreography
      ? CHOREOGRAPHY[props.board.choreography](store, {
          tutorial: props.tutorial,
          onExitToMenu: props.onExitToMenu,
        })
      : {},
  );
  props.onChoreography(choreography);
  onCleanup(() => props.onChoreography({}));
  useForcedTankMode(store, () => props.board.tankMode);
  useLessonNarration(props.lessonBoard, props.onNarration, untrack(() => props.lessonKey));
  const Overlay = choreography.Overlay;
  return Overlay ? <Overlay /> : null;
};

const NO_SQUARES: readonly Square[] = [];
const NO_ARROWS: readonly TutorialBoardArrow[] = [];

const LiveLessonInner: Component<LiveLessonHostProps> = (props) => {
  const store = useMatchStore();
  const [choreography, setChoreography] = createSignal<ChoreographyResult>({});
  const board = createLessonBoard(store);

  const interactive = () => choreography().interactive?.() ?? true;
  const lessonKey = () => props.lessonKey ?? "";

  const hintMarks = createMemo(
    () =>
      resolveTutorialHint(props.boardHints, {
        scfen: board.scfen(),
        covers: board.covers(),
        trajectories: board.trajectories(),
        targetingKind: board.targetingKind(),
        reviewPhase: board.reviewPhase(),
      }),
    undefined,
    { equals: sameStructure },
  );

  const hintSquares = createMemo(() => (interactive() ? hintMarks().squares : NO_SQUARES));
  const hintGasSquares = createMemo(() => (interactive() ? hintMarks().gasSquares : NO_SQUARES));
  const hintArrows = createMemo(() => (interactive() ? hintMarks().arrows : NO_ARROWS));
  const endTurnAfterQueue = createMemo(() =>
    interactive() ? props.board.endTurnAfterQueue : undefined,
  );
  const scriptedAlerts = () => hintMarks().alertSquares;

  const ccSight = createMemo(
    (): { ccAt?: Square; ccVisible: boolean } => {
      if (props.board.alertLatch !== "king" && props.board.alertLatch !== "cc") {
        return { ccVisible: false };
      }
      const placement = board.scfen().split("|")[1];
      if (!placement) return { ccVisible: false };
      try {
        const map = placementToMap(placement);
        const viewer = store.shell().viewer;
        const enemy = viewer === "w" ? "b" : "w";
        let ccAt: Square | undefined;
        for (const [sq, piece] of map) {
          if (piece.type === "k" && piece.color === enemy) ccAt = sq;
        }
        if (!ccAt) return { ccVisible: false };
        const vision = getSideVision(map, viewer);
        return { ccAt, ccVisible: vision.litSquares.has(ccAt) || vision.revealedPieces.has(ccAt) };
      } catch {
        return { ccVisible: false };
      }
    },
    undefined,
    { equals: sameStructure },
  );

  const enemyCCHome = (): Square =>
    emptyCCIntel(store.shell().viewer === "w" ? "b" : "w").focus;
  const ccSeenFold = createMemo<{ key: string; at: Square | undefined }>(
    (prev) => {
      const key = lessonKey();
      if (props.board.alertLatch !== "cc") return { key, at: undefined };
      const base = (prev.key === key ? prev.at : undefined) ?? enemyCCHome();
      return { key, at: nextCCSighting(base, ccSight()) };
    },
    { key: untrack(lessonKey), at: undefined },
  );
  const ccSeen = () => ccSeenFold().at;
  const alertLatchFold = createMemo<{ key: string; latch: AlertLatch }>(
    (prev) => {
      const key = lessonKey();
      const base: AlertLatch = prev.key === key ? prev.latch : { squares: [] };
      const latch = props.board.alertLatch;
      if (!latch || latch === "cc") return { key, latch: base };
      const { ccAt, ccVisible } = ccSight();
      return {
        key,
        latch: nextAlertLatch(base, scriptedAlerts(), { followCC: latch === "king", ccAt, ccVisible }),
      };
    },
    { key: untrack(lessonKey), latch: { squares: [] } },
  );
  const alertLatch = () => alertLatchFold().latch;

  const hintAlertSquares = createMemo(
    (): readonly Square[] => {
      if (!interactive()) return NO_SQUARES;
      if (props.board.alertLatch === "cc") return withCCAlert(scriptedAlerts(), ccSeen());
      return props.board.alertLatch ? alertLatch().squares : scriptedAlerts();
    },
    undefined,
    { equals: sameStructure },
  );

  const queueHint = createMemo(() => (interactive() ? hintMarks().cancelQueued : null));

  const queueAdjutant = (snap: ScFenSnapshot) => {
    const s = store.state();
    return adjutant(snap, {
      color: s.viewer === "w" ? "b" : "w",
      storedFor: (color) => store.state().economies[color].stored,
    });
  };
  const autoQueueOpponent = createMemo(() =>
    props.board.opponent === "adjutant" ? queueAdjutant : undefined,
  );

  const scope = () => (
    <LessonScope
      board={props.board}
      lessonBoard={board}
      onNarration={props.onNarration}
      lessonKey={lessonKey()}
      tutorial={props.tutorial === true}
      onExitToMenu={props.onExitToMenu}
      onChoreography={setChoreography}
    />
  );

  const scopeView = createMemo(on(lessonKey, () => scope()));

  return (
    <QueueHintProvider value={queueHint}>
      {scopeView()}
      <BaseScreen
        starChessMode
        fog={props.fog}
        boardVariant={props.boardVariant ?? "eclipse"}
        pieceSet={props.pieceSet}
        tutorial={props.tutorial}
        fullMatchHud={props.fullMatchHud}
        matchTitle={props.matchTitle}
        bannerTitle={props.bannerTitle}
        hideResources={props.hideResources}
        hudResources={props.hudResources}
        hideGas={props.hideGas}
        turnChrome={props.turnChrome}
        onExitToMenu={props.onExitToMenu}
        header={props.header}
        coachEmotion={props.coachEmotion}
        guideBubble={props.guideBubble}
        footerExtra={props.footerExtra}
        endTurnAfterQueue={endTurnAfterQueue()}
        hintSquares={hintSquares()}
        hintAlertSquares={hintAlertSquares()}
        hintGasSquares={hintGasSquares()}
        hintArrows={hintArrows()}
        autoQueueOpponent={autoQueueOpponent()}
      />
    </QueueHintProvider>
  );
};

export const LiveLessonHost: Component<LiveLessonHostProps> = (props) => {
  const store = createMatchStore({
    initial: withViewerGas(
      createMatchStateFromScfen(props.board.scfen, props.board.stored ?? 4),
      props.gas,
    ),
    // `autoArmTimer !== false` enables — so `undefined` must stay `undefined`.
    autoArmTimer: () => props.armTimer ?? props.board.armTimer,
  });

  createComputed(
    on(
      () => props.lessonKey,
      () =>
        untrack(() =>
          store.loadLesson({ scfen: props.board.scfen, stored: props.board.stored ?? 4, gas: props.gas }),
        ),
      { defer: true },
    ),
  );

  // Storybook control only — re-apply on change without wiping queued spends.
  createEffect(() => {
    const g = props.gas;
    if (g == null) return;
    untrack(() => store.setViewerGas(g));
  });

  const capabilities = () => (props.tutorial ? TUTORIAL_CAPABILITIES : LIVE_CAPABILITIES);
  const body = (
    <CapabilitiesProvider value={capabilities}>
      <MatchStoreProvider store={store}>
        <LiveLessonInner {...props} />
      </MatchStoreProvider>
    </CapabilitiesProvider>
  );

  return props.shell ? <LiveMatchShell world={props.shell}>{body}</LiveMatchShell> : body;
};
