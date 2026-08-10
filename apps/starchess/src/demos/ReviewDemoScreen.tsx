// SPEC: _spec/apps/starchess/screens.puml, _spec/apps/starchess/architecture/screen-entities.puml
/**
 * Store-backed DualNav review host — top ReviewTurnNav + LiveStarChessBoard.
 * Scenario packages supply history; MatchStore owns seek / playback / VFX timeline.
 */
import { placementToMap, type StarChessColor } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";
import {
  createEffect,
  createMemo,
  onCleanup,
  onMount,
  Show,
  type Component,
  type JSX,
} from "solid-js";

import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromReviewHistory } from "~/app/reviewHistory";
import { displayedSnapshot } from "~/app/selectors";
import { Label } from "~/components/primitives/Label";
import { Screen } from "~/components/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import styles from "~/demos/ReviewDemoScreen.module.css";
import { clearSiegedRooks, setRookMode } from "~/presentation/animations/rookModeStore";
import { LiveBoardBinding } from "~/presentation/board/LiveBoardBinding";
import { isCheckOnlyResolve } from "~/presentation/hud/isCheckOnlyResolve";
import { MatchBoardHost } from "~/presentation/hud/MatchBoardHost";
import { ResourceBar } from "~/presentation/hud/ResourceBar";
import { ReviewTurnNav } from "~/presentation/hud/ReviewTurnNav";
import { TurnBarSidebar } from "~/presentation/hud/TurnBarSidebar";
import { TUTORIAL_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import {
  resetReviewVisionFilter,
  reviewVisionFilter,
  setReviewVisionFilter,
} from "~/store/reviewVisionStore";
import { resetTutorialNarration, setTutorialNarration } from "~/tutorial/tutorialNarrationStore";
import type { BoardSkin, PieceSet, VisionMode } from "~/types/board";
import type { ReviewHistory, StarChessMatchResult } from "~/types/review";

/** Coach-style Review detail title stack (result + matchup). */
export type ReviewMatchTitle = {
  /** e.g. "Win (Blue)" */
  resultLine: string;
  /** win / loss / draw — colors the result Label */
  result: StarChessMatchResult;
  /** e.g. "Alex (Blue) vs Adjutant (Red)" */
  matchup: string;
};

export type ReviewDemoScreenProps = {
  history: ReviewHistory;
  /** Prefix for footer caption (e.g. "Combat chain"). */
  reviewLabel?: string;
  /** Optional result + matchup above DualNav (SPA `/review/:id`). */
  matchTitle?: ReviewMatchTitle;
  visionMode?: VisionMode;
  fog?: boolean;
  variant?: BoardSkin;
  pieceSet?: PieceSet;
  /** Force all rooks to tank mode (fog-edge rook story). */
  rookTank?: boolean;
  /** Human team for You / Adjutant vision labels. */
  playerColor?: StarChessColor;
  /** Side-rail Home — SPA navigate (review routes). */
  onHome?: () => void;
  /** Hide dual ResourceBars (tutorial). */
  hideResources?: boolean;
  /** Hide top ReviewTurnNav + rail turn chrome (tutorial steppers own advance). */
  hideDualNav?: boolean;
  /** Tutorial HOME-only sidebar chrome. */
  tutorial?: boolean;
  /** Replaces SidebarInset when set (tutorial avatar header). */
  header?: JSX.Element;
  footerExtra?: JSX.Element;
};

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
    /* invalid placement — ignore */
  }
};

const ReviewDemoInner: Component<ReviewDemoScreenProps> = (props) => {
  const store = useMatchStore();
  const snap = createMemo(() => displayedSnapshot(store.state()));

  const reviewBusy = () =>
    store.state().timeline.active ||
    store.reviewPhase() === "check" ||
    store.reviewPhase() === "intent" ||
    store.reviewPhase() === "resolve";

  const reviewTurnNumber = () => {
    const s = store.state();
    const settled = s.settledSnapshots[s.reviewIndex];
    return Math.max(1, settled?.turn ?? snap().turn);
  };

  const caption = createMemo(() => {
    const s = store.state();
    const phase = store.reviewPhase();
    const steps = props.history.steps;
    const startCaption = props.history.startCaption;
    if (s.reviewIndex <= 0 && (phase === "start" || phase === "final")) {
      return startCaption;
    }
    let endsBefore = 0;
    for (let i = 0; i < s.reviewIndex; i += 1) {
      const r = s.settledResolves[i];
      if (r && !isCheckOnlyResolve(r)) endsBefore += 1;
    }
    const playing = phase === "check" || phase === "intent" || phase === "resolve";
    const stepIdx = playing ? endsBefore : Math.max(0, endsBefore - 1);
    const step = steps[Math.min(stepIdx, Math.max(0, steps.length - 1))];
    if (!step) return startCaption;
    if (phase === "intent" && step.intentCaption) return step.intentCaption;
    if (phase === "check") return `Check · ${step.caption}`;
    if (phase === "intent") return `Intent · ${step.caption}`;
    return step.caption;
  });

  createEffect(() => {
    const s = snap();
    syncRookModes(s.placement, s.siegedRooks, props.rookTank);
  });

  createEffect(() => {
    if (!props.tutorial) return;
    setTutorialNarration({
      reviewPhase: store.reviewPhase(),
      timelineActive: store.state().timeline.active,
    });
  });

  onMount(() => {
    if (props.tutorial) setCapabilities(TUTORIAL_CAPABILITIES);

    // Seed review vision: observer demos → BOTH; player fog demos → white vision.
    if (props.visionMode === "player" || props.fog === true) {
      setReviewVisionFilter("w");
      store.dispatch({ type: "SET_VIEWER", viewer: "w" });
    } else {
      resetReviewVisionFilter();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (props.hideDualNav) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        store.reviewBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        store.reviewForward();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      store.cancelEffects();
      clearSiegedRooks();
      resetReviewVisionFilter();
      if (props.tutorial) resetTutorialNarration();
    });
  });

  const showWhiteResources = () => {
    const f = reviewVisionFilter();
    return f === "both" || f === "w";
  };
  const showBlackResources = () => {
    const f = reviewVisionFilter();
    return f === "both" || f === "b";
  };

  const dualResourceBars = () => (
    <div
      class={styles.dualResources}
      role="group"
      aria-label={
        reviewVisionFilter() === "both"
          ? "Both sides resources"
          : reviewVisionFilter() === "w"
            ? "Blue side resources"
            : "Red side resources"
      }
    >
      <Show when={showWhiteResources()}>
        <ResourceBar color="w" snapshot={snap()} />
      </Show>
      <Show when={showBlackResources()}>
        <ResourceBar color="b" snapshot={snap()} />
      </Show>
    </div>
  );

  const reviewNavDisabled = () => ({
    back: reviewBusy() || store.state().reviewIndex <= 0,
    forward: reviewBusy() || store.state().reviewIndex >= store.state().settledSnapshots.length - 1,
  });

  return (
    <Screen>
      <Show
        when={props.header}
        fallback={
          <Screen.SidebarInset class={styles.topPane}>
            <ScreenBackNav
              onBack={() => props.onHome?.()}
              data-testid="review-detail-back"
            >
              <Show when={props.matchTitle}>
                {(title) => (
                  <div
                    class={styles.matchTitle}
                    data-testid="review-match-title"
                  >
                    <Label
                      variant="title"
                      color={title().result}
                      class={styles.resultLine}
                    >
                      {title().resultLine}
                    </Label>
                    <Label variant="title" class={styles.matchupLine}>
                      {title().matchup}
                    </Label>
                  </div>
                )}
              </Show>
              <Show when={!props.hideResources}>
                <Show when={!props.hideDualNav} fallback={dualResourceBars()}>
                  <ReviewTurnNav
                    onBack={() => store.reviewBack()}
                    onForward={() => store.reviewForward()}
                    backDisabled={reviewNavDisabled().back}
                    forwardDisabled={reviewNavDisabled().forward}
                  >
                    {dualResourceBars()}
                  </ReviewTurnNav>
                </Show>
              </Show>
            </ScreenBackNav>
          </Screen.SidebarInset>
        }
      >
        <Screen.Header>{props.header}</Screen.Header>
      </Show>
      <MatchBoardHost>
        <MatchBoardHost.BoardColumn>
          <MatchBoardHost.BoardHost class={styles.host}>
            <LiveBoardBinding
              variant={props.variant ?? "eclipse"}
              pieceSet={props.pieceSet}
              fog={props.fog}
              visionMode={props.visionMode}
            />
          </MatchBoardHost.BoardHost>
        </MatchBoardHost.BoardColumn>
        <MatchBoardHost.Rail
          onHome={props.onHome}
          controlsVisible={!props.hideDualNav}
        >
          <TurnBarSidebar
            review={{
              turn: reviewTurnNumber(),
              phase: store.reviewPhase(),
              hideDualNav: true,
              onBack: () => store.reviewBack(),
              onForward: () => store.reviewForward(),
              backDisabled: reviewNavDisabled().back,
              forwardDisabled: reviewNavDisabled().forward,
            }}
          />
        </MatchBoardHost.Rail>
      </MatchBoardHost>
      <Screen.Footer>
        <div class={styles.footerStack}>
          <Show when={props.footerExtra}>{props.footerExtra}</Show>
          <p class={styles.caption}>
            Review · {props.reviewLabel ?? "Review"} · {caption()}
          </p>
        </div>
      </Screen.Footer>
    </Screen>
  );
};

export const ReviewDemoScreen: Component<ReviewDemoScreenProps> = (props) => {
  const store = createMatchStore({
    initial: createMatchStateFromReviewHistory(props.history, {
      playerColor: props.playerColor ?? "w",
    }),
    autoArmTimer: false,
  });

  return (
    <MatchStoreProvider store={store}>
      <ReviewDemoInner
        history={props.history}
        reviewLabel={props.reviewLabel}
        matchTitle={props.matchTitle}
        visionMode={props.visionMode}
        fog={props.fog}
        variant={props.variant}
        pieceSet={props.pieceSet}
        rookTank={props.rookTank}
        playerColor={props.playerColor}
        onHome={props.onHome}
        hideResources={props.hideResources}
        hideDualNav={props.hideDualNav}
        tutorial={props.tutorial}
        header={props.header}
        footerExtra={props.footerExtra}
      />
    </MatchStoreProvider>
  );
};
