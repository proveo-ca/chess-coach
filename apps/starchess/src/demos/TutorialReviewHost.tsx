// SPEC: _spec/apps/starchess/screens.puml, _spec/apps/starchess/architecture/screen-entities.puml
/**
 * Tutorial review host — typewriter turn/phase footer (Check → Intent → Resolve).
 */
import { placementToMap, formatScFen } from "@chess-coach/starchess-core";
import type { StarChessColor } from "@chess-coach/starchess-core";
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

import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromReviewHistory } from "~/app/reviewHistory";
import { displayedSnapshot } from "~/app/selectors";
import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { StarChessMobileBanner as MobileBanner } from "@chess-coach/ui-web/atoms/StarChessMobileBanner";
import { ReviewTurnNav } from "@chess-coach/ui-web/atoms/ReviewTurnNav";
import { Screen } from "@chess-coach/ui-web/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import styles from "~/demos/TutorialReviewHost.module.css";
import { clearSiegedTanks, setTankMode } from "~/presentation/animations/tankModeStore";
import { LiveBoardBinding } from "~/presentation/board/components/LiveBoardBinding";

import { isCheckOnlyResolve } from "~/presentation/hud/isCheckOnlyResolve";
import { MatchBoardHost } from "~/presentation/hud/components/MatchBoardHost";
import { TurnBarSidebar } from "~/presentation/hud/components/TurnBarSidebar";
import { splitResolveWaves } from "~/presentation/timeline/resolveWaves";
import { TUTORIAL_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { resetReviewVisionFilter, setReviewVisionFilter } from "~/store/reviewVisionStore";
import { intentArrows } from "~/tutorial/lessonTactics";
import { resetTutorialNarration, setTutorialNarration } from "~/tutorial/tutorialNarrationStore";
import {
  boardIndexForBeat,
  buildTypewriterBeats,
  endPlayIndexForTurn,
  endResultAt,
} from "~/tutorial/typewriterBeats";
import type { BoardSkin, PieceSet, VisionMode } from "~/types/board";
import type { KerriganEmotion } from "~/types/coach";
import type { ReviewHistory } from "~/types/review";
import type { TypewriterBeat } from "~/types/tutorial";

const syncTankModes = (
  placement: string,
  sieged: readonly Square[] | undefined,
  forceTank: boolean | undefined,
) => {
  clearSiegedTanks();
  if (!forceTank) {
    for (const sq of sieged ?? []) setTankMode(sq, "siege");
    return;
  }
  try {
    const map = placementToMap(placement);
    for (const [sq, piece] of map) {
      if (piece.type === "r") setTankMode(sq as Square, "tank");
    }
  } catch {
    /* ignore */
  }
};

/** `Turn 2 · Intent` — the beat the arrows are parked on. */
const labelForBeat = (beat: TypewriterBeat | undefined, turn: number): string => {
  if (!beat) return "";
  return beat.kind === "turn" ? beat.text : `Turn ${turn} · ${beat.text}`;
};

export type TutorialReviewHostProps = {
  history: ReviewHistory;
  reviewLabel?: string;
  visionMode?: VisionMode;
  fog?: boolean;
  variant?: BoardSkin;
  pieceSet?: PieceSet;
  packedTank?: boolean;
  playerColor?: StarChessColor;
  onHome?: () => void;
  /** CoachScreen-shaped desktop header avatar. */
  header?: JSX.Element;
  coachEmotion?: KerriganEmotion;
  guideBubble?: JSX.Element;
  footerExtra?: JSX.Element;
  /** Show review TurnBarSidebar (turn + phase chips; DualNav hidden). */
  turnChrome?: "sidebar" | "none";
  /** Draw every queued intent as an arrow on the Intent beat (checks in red). */
  intentArrows?: boolean;
};

const TutorialReviewInner: Component<TutorialReviewHostProps> = (props) => {
  const store = useMatchStore();
  const snap = createMemo(() => displayedSnapshot(store.state()));
  const [beatIndex, setBeatIndex] = createSignal(0);
  const [busy, setBusy] = createSignal(false);

  const beats = createMemo(() => buildTypewriterBeats(store.state().settledResolves));
  /**
   * Turn comes from the most recent `turn` beat, not the store: the store's
   * review turn lags the cursor, which mislabelled `Turn 2 · Check` as
   * `Turn 1 · Check`.
   */
  const beatTurn = () => {
    const list = beats();
    let turn = 0;
    for (let i = 0; i <= beatIndex(); i += 1) {
      const b = list[i];
      if (b?.kind === "turn") turn = b.turn;
    }
    return turn || reviewTurnNumber();
  };

  const arrows = createMemo(() => {
    if (!props.intentArrows || store.reviewPhase() !== "intent") return [];
    const actions = store.reviewIntentActions();
    return actions ? intentArrows(snap().placement, actions) : [];
  });

  const beatLabel = () => labelForBeat(beats()[beatIndex()], beatTurn());

  const reviewTurnNumber = () => {
    const s = store.state();
    const settled = s.settledSnapshots[s.reviewIndex];
    return Math.max(1, settled?.turn ?? snap().turn);
  };

  createEffect(() => {
    const s = snap();
    syncTankModes(s.placement, s.siegedTanks, props.packedTank);
  });

  createEffect(() => {
    const s = store.state();
    const board = snap();
    const list = beats();
    const idx = beatIndex();
    const beat = list[idx];
    let typewriterTurn = 0;
    for (let i = 0; i <= idx; i += 1) {
      const b = list[i];
      if (b?.kind === "turn") typewriterTurn = b.turn;
    }
    setTutorialNarration({
      reviewPhase: store.reviewPhase(),
      // Busy covers resolve VFX await so completeWhen waits for Turn 3 end.
      timelineActive: s.timeline.active || busy(),
      scfen: formatScFen(board),
      typewriterTurn: typewriterTurn || undefined,
      typewriterBeat: beat?.kind,
    });
  });

  const seekBoard = (index: number) => {
    store.cancelEffects();
    store.dispatch({ type: "REVIEW_SEEK", index });
  };

  const seekTurnStart = (resolveIndex: number) => {
    seekBoard(resolveIndex);
    store.reviewShowIntent(null);
  };

  const showIntentFor = (resolveIndex: number) => {
    const end = endResultAt(store.state().settledResolves, resolveIndex);
    store.dispatch({ type: "REFILL_GAS" });
    store.reviewSetPhase("intent");
    if (end) store.reviewShowIntent(end.queue);
    else store.reviewShowIntent(null);
  };

  /** Apply board/chrome for a beat without replaying resolve VFX (rewind). */
  const applyBeatStatic = (beat: TypewriterBeat) => {
    const resolves = store.state().settledResolves;
    seekBoard(boardIndexForBeat(beat, resolves));
    if (beat.kind === "turn") {
      store.reviewShowIntent(null);
      store.reviewSetPhase("start");
      return;
    }
    if (beat.kind === "check") {
      store.reviewShowIntent(null);
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
      // DualNav stays on the post-check board after check TIMELINE_DONE — do not seek back.
      const intentBoard = boardIndexForBeat(beat, s.settledResolves);
      if (store.state().reviewIndex !== intentBoard) {
        seekBoard(intentBoard);
      }
      showIntentFor(beat.resolveIndex);
      return;
    }

    if (beat.kind === "resolve" && end) {
      store.reviewShowIntent(null);
      store.reviewSetPhase("resolve");
      // End plays at the DualNav cursor (post-check when a check ply exists).
      const playIndex = endPlayIndexForTurn(beat.resolveIndex, s.settledResolves);
      if (store.state().reviewIndex !== playIndex) {
        seekBoard(playIndex);
      }
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
      clearSiegedTanks();
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
      {/* Mobile chrome (CSS-gated). Short landscape: banner + board, the stepper
          hugging the right like Review's arrows. Tall phones: one black row,
          `‹ Back` left and the stepper centred. */}
      <MobileBanner
        band="mobile"
        turnPlacement="center"
        onBack={() => props.onHome?.()}
        turn={
          <ReviewTurnNav
            onBack={goPrev}
            onForward={() => void goNext()}
            backDisabled={beatIndex() <= 0 || busy()}
            forwardDisabled={beatIndex() >= beats().length - 1 || busy()}
          >
            <span class={styles.phaseLabel}>{beatLabel()}</span>
          </ReviewTurnNav>
        }
      />
      <Screen.Header>
        <div class={styles.headerSlot}>
          <div class={styles.reviewChrome}>
            <ScreenBackNav
              onBack={props.onHome}
              class={styles.reviewNav}
              data-testid="tutorial-review-back"
            >
              {/* Keys bind here, not on the banner copy above — both render at
                  once (the banner is CSS-gated, not unmounted), and two
                  listeners would step twice per press. */}
              <ReviewTurnNav
                keyboard
                onBack={goPrev}
                onForward={() => void goNext()}
                backDisabled={beatIndex() <= 0 || busy()}
                forwardDisabled={beatIndex() >= beats().length - 1 || busy()}
              >
                <span class={styles.phaseLabel} data-testid="tutorial-review-phase">
                  {beatLabel()}
                </span>
              </ReviewTurnNav>
            </ScreenBackNav>
            <div class="mobile-hero" data-testid="tutorial-mobile-hero">
              <CoachAvatar identity="kerrigan" emotion={props.coachEmotion ?? "idle"} />
            </div>
          </div>
          {props.guideBubble}
        </div>
      </Screen.Header>
      <MatchBoardHost>
        <MatchBoardHost.BoardColumn>
          <MatchBoardHost.BoardHost class={styles.host}>
            <LiveBoardBinding
              variant={props.variant ?? "eclipse"}
              pieceSet={props.pieceSet}
              fog={props.fog}
              visionMode={props.visionMode}
              hintArrows={arrows()}
            />
          </MatchBoardHost.BoardHost>
        </MatchBoardHost.BoardColumn>
        <MatchBoardHost.Rail
          onHome={props.onHome}
          controlsVisible={props.turnChrome === "sidebar"}
        >
          <TurnBarSidebar
            review={{
              turn: reviewTurnNumber(),
              phase: store.reviewPhase(),
              hideDualNav: true,
            }}
          />
        </MatchBoardHost.Rail>
      </MatchBoardHost>
      <Screen.Footer>
        <div class={styles.footerStack}>
          <Show when={props.footerExtra}>{props.footerExtra}</Show>
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
