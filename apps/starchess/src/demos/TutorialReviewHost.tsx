/**
 * Tutorial review host — typewriter turn/phase footer (Check → Intent → Resolve).
 * // SPEC: _spec/apps/starchess/screens.puml
 */
import { placementToMap, formatScFen } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";
import {
  Show,
  createEffect,
  createMemo,
  createSignal,
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
import { createMatchStateFromReviewHistory } from "~/app/reviewHistory";
import { displayedSnapshot } from "~/app/selectors";
import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { TutorialTypewriterNav } from "~/components/features/TutorialTypewriterNav";
import { Sidebar } from "~/components/features/Sidebar";
import { Screen } from "~/components/primitives/Screen";
import styles from "~/demos/TutorialReviewHost.module.css";
import type { KerriganEmotion } from "~/types/coach";
import { clearSiegedRooks, setRookMode } from "~/presentation/animations/rookModeStore";
import { LiveStarChessBoard } from "~/presentation/board/LiveStarChessBoard";
import { classicalActionsFromResolve } from "~/presentation/hud/classicalActionsFromResolve";
import { isCheckOnlyResolve } from "~/presentation/hud/isCheckOnlyResolve";
import { TurnBarSidebar } from "~/presentation/hud/TurnBarSidebar";
import { splitResolveWaves } from "~/presentation/timeline/resolveWaves";
import {
  TUTORIAL_CAPABILITIES,
  setCapabilities,
} from "~/store/capabilitiesStore";
import {
  resetTutorialNarration,
  setTutorialNarration,
} from "~/tutorial/tutorialNarrationStore";
import {
  buildTypewriterBeats,
  endResultAt,
} from "~/tutorial/typewriterBeats";
import {
  resetReviewVisionFilter,
  setReviewVisionFilter,
} from "~/store/reviewVisionStore";
import type { BoardSkin, PieceSet, VisionMode } from "~/types/board";
import type { ReviewHistory } from "~/types/review";
import type { TypewriterBeat, TypewriterLine } from "~/types/tutorial";
import type { StarChessColor } from "@chess-coach/starchess-core";

const syncRookModes = (
  placement: string,
  sieged: readonly Square[] | undefined,
  forceTank: boolean | undefined,
) => {
  clearSiegedRooks();
  if (!forceTank) {
    for (const sq of sieged ?? []) setRookMode(sq, "siege");
    return;
  }
  try {
    const map = placementToMap(placement);
    for (const [sq, piece] of map) {
      if (piece.type === "r") setRookMode(sq as Square, "tank");
    }
  } catch {
    /* ignore */
  }
};

const beatLines = (beats: readonly TypewriterBeat[]): TypewriterLine[] =>
  beats.map((b) => ({
    text: b.text,
    indent: b.kind !== "turn",
  }));

export type TutorialReviewHostProps = {
  history: ReviewHistory;
  reviewLabel?: string;
  visionMode?: VisionMode;
  fog?: boolean;
  variant?: BoardSkin;
  pieceSet?: PieceSet;
  rookTank?: boolean;
  playerColor?: StarChessColor;
  onHome?: () => void;
  /** CoachScreen-shaped desktop header avatar. */
  header?: JSX.Element;
  coachEmotion?: KerriganEmotion;
  guideBubble?: JSX.Element;
  footerExtra?: JSX.Element;
  /** Show review TurnBarSidebar (turn + phase chips; DualNav hidden). */
  turnChrome?: "sidebar" | "none";
};

const TutorialReviewInner: Component<TutorialReviewHostProps> = (props) => {
  const store = useMatchStore();
  const snap = createMemo(() => displayedSnapshot(store.state()));
  const [beatIndex, setBeatIndex] = createSignal(0);
  const [busy, setBusy] = createSignal(false);

  const beats = createMemo(() =>
    buildTypewriterBeats(store.state().settledResolves),
  );
  const lines = createMemo(() => beatLines(beats()));

  const reviewTurnNumber = () => {
    const s = store.state();
    const settled = s.settledSnapshots[s.reviewIndex];
    return Math.max(1, settled?.turn ?? snap().turn);
  };

  createEffect(() => {
    const s = snap();
    syncRookModes(s.placement, s.siegedRooks, props.rookTank);
  });

  createEffect(() => {
    const s = store.state();
    const board = snap();
    setTutorialNarration({
      reviewPhase: store.reviewPhase(),
      timelineActive: s.timeline.active,
      scfen: formatScFen(board),
    });
  });

  const seekTurnStart = (resolveIndex: number) => {
    store.cancelEffects();
    store.dispatch({ type: "REVIEW_SEEK", index: resolveIndex });
    store.reviewShowIntent(null);
  };

  const showIntentFor = (resolveIndex: number) => {
    const end = endResultAt(store.state().settledResolves, resolveIndex);
    store.dispatch({ type: "REFILL_GAS" });
    store.reviewSetPhase("intent");
    if (end) store.reviewShowIntent(classicalActionsFromResolve(end));
    else store.reviewShowIntent(null);
  };

  /** Apply board/chrome for a beat without replaying resolve VFX (rewind). */
  const applyBeatStatic = (beat: TypewriterBeat) => {
    seekTurnStart(beat.resolveIndex);
    if (beat.kind === "turn") {
      store.reviewSetPhase("start");
      return;
    }
    if (beat.kind === "check") {
      store.dispatch({ type: "REFILL_GAS" });
      store.reviewSetPhase("check");
      return;
    }
    if (beat.kind === "intent") {
      showIntentFor(beat.resolveIndex);
      return;
    }
    store.reviewShowIntent(null);
    store.reviewSetPhase("resolve");
  };

  const playBeat = async (beat: TypewriterBeat) => {
    const s = store.state();
    const first = s.settledResolves[beat.resolveIndex];
    const end = endResultAt(s.settledResolves, beat.resolveIndex);

    if (beat.kind === "turn") {
      seekTurnStart(beat.resolveIndex);
      store.reviewSetPhase("start");
      return;
    }

    if (beat.kind === "check") {
      seekTurnStart(beat.resolveIndex);
      store.dispatch({ type: "REFILL_GAS" });
      store.reviewSetPhase("check");
      if (beat.hasCheck && first && isCheckOnlyResolve(first)) {
        await store.playReviewResolve(first);
      }
      return;
    }

    if (beat.kind === "intent") {
      seekTurnStart(beat.resolveIndex);
      showIntentFor(beat.resolveIndex);
      return;
    }

    if (beat.kind === "resolve" && end) {
      store.reviewShowIntent(null);
      store.reviewSetPhase("resolve");
      const waves = splitResolveWaves(end);
      if (waves.length === 0) {
        await store.playReviewResolve(end);
        return;
      }
      for (let w = 0; w < waves.length; w += 1) {
        const wave = waves[w]!;
        await store.playReviewResolveWave(end, wave.id, {
          isLastWave: w === waves.length - 1,
        });
      }
    }
  };

  onMount(() => {
    setCapabilities(TUTORIAL_CAPABILITIES);
    if (props.visionMode === "player" || props.fog === true) {
      setReviewVisionFilter("w");
      store.dispatch({ type: "SET_VIEWER", viewer: "w" });
    } else {
      resetReviewVisionFilter();
    }
    const first = beats()[0];
    if (first) void playBeat(first);
    onCleanup(() => {
      store.cancelEffects();
      clearSiegedRooks();
      resetReviewVisionFilter();
      resetTutorialNarration();
    });
  });

  const goNext = async () => {
    if (busy()) return;
    const list = beats();
    if (beatIndex() >= list.length - 1) return;
    const nextIdx = beatIndex() + 1;
    const beat = list[nextIdx];
    if (!beat) return;
    setBusy(true);
    try {
      await playBeat(beat);
      setBeatIndex(nextIdx);
    } finally {
      setBusy(false);
    }
  };

  const goPrev = () => {
    if (busy()) return;
    if (beatIndex() <= 0) return;
    const nextIdx = beatIndex() - 1;
    const beat = beats()[nextIdx];
    if (!beat) return;
    setBusy(true);
    try {
      applyBeatStatic(beat);
      setBeatIndex(nextIdx);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Screen.Header>
        <div class={styles.headerSlot}>
          <div class="desktop-only" data-testid="tutorial-header">
            <Show
              when={props.header}
              fallback={
                <CoachAvatar
                  identity="kerrigan"
                  emotion={props.coachEmotion ?? "idle"}
                />
              }
            >
              {props.header}
            </Show>
          </div>
          {props.guideBubble}
        </div>
      </Screen.Header>
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class="mobile-hero" data-testid="tutorial-mobile-hero">
            <CoachAvatar
              identity="kerrigan"
              emotion={props.coachEmotion ?? "idle"}
            />
          </div>
          <div class={styles.host}>
            <LiveStarChessBoard
              variant={props.variant ?? "eclipse"}
              pieceSet={props.pieceSet}
              fog={props.fog}
              visionMode={props.visionMode}
            />
          </div>
        </Screen.BoardColumn>
        <aside class={styles.sideboard} data-testid="starchess-side-rail">
          <Show when={props.turnChrome === "sidebar"}>
            <TurnBarSidebar
              review={{
                turn: reviewTurnNumber(),
                phase: store.reviewPhase(),
                hideDualNav: true,
              }}
            />
            <hr class={styles.sideboardDivider} />
          </Show>
          <Sidebar onHome={props.onHome} />
        </aside>
      </Screen.BoardArea>
      <Screen.Footer>
        <div class={styles.footerStack}>
          <Show when={props.footerExtra}>{props.footerExtra}</Show>
          <TutorialTypewriterNav
            lines={lines()}
            currentIndex={beatIndex()}
            busy={busy()}
            canPrev={beatIndex() > 0}
            canNext={beatIndex() < beats().length - 1}
            onPrev={goPrev}
            onNext={() => void goNext()}
          />
        </div>
      </Screen.Footer>
    </Screen>
  );
};

export const TutorialReviewHost: Component<TutorialReviewHostProps> = (props) => {
  const store = createMatchStore({
    initial: createMatchStateFromReviewHistory(props.history, {
      playerColor: props.playerColor ?? "w",
    }),
    autoArmTimer: false,
  });

  return (
    <MatchStoreProvider store={store}>
      <TutorialReviewInner {...props} />
    </MatchStoreProvider>
  );
};
