/**
 * Store-backed DualNav review host — sidebar DualNav + LiveStarChessBoard.
 * Scenario packages supply history; MatchStore owns seek / playback / VFX timeline.
 */
import { placementToMap, type StarChessColor } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";
import { createEffect, createMemo, onCleanup, onMount, Show, type Component } from "solid-js";

import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromReviewHistory } from "~/app/reviewHistory";
import { displayedSnapshot } from "~/app/selectors";
import { Sidebar } from "~/components/features/Sidebar";
import { Screen } from "~/components/primitives/Screen";
import styles from "~/demos/ReviewDemoScreen.module.css";
import { clearSiegedRooks, setRookMode } from "~/presentation/animations/rookModeStore";
import { LiveStarChessBoard } from "~/presentation/board/LiveStarChessBoard";
import { isCheckOnlyResolve } from "~/presentation/hud/isCheckOnlyResolve";
import { ResourceBar } from "~/presentation/hud/ResourceBar";
import { TurnBarSidebar } from "~/presentation/hud/TurnBarSidebar";
import {
  resetReviewVisionFilter,
  reviewVisionFilter,
  setReviewVisionFilter,
} from "~/store/reviewVisionStore";
import type { BoardVariant, VisionMode } from "~/types/board";
import type { ReviewHistory } from "~/types/review";

export type ReviewDemoScreenProps = {
  history: ReviewHistory;
  /** Prefix for footer caption (e.g. "Combat chain"). */
  reviewLabel?: string;
  visionMode?: VisionMode;
  fog?: boolean;
  variant?: BoardVariant;
  /** Force all rooks to tank mode (fog-edge rook story). */
  rookTank?: boolean;
  /** Human team for You / Adjutant vision labels. */
  playerColor?: StarChessColor;
  /** Sidebar Home — SPA navigate (review routes). */
  onHome?: () => void;
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

  onMount(() => {
    // Seed review vision: observer demos → BOTH; player fog demos → white vision.
    if (props.visionMode === "player" || props.fog === true) {
      setReviewVisionFilter("w");
      store.dispatch({ type: "SET_VIEWER", viewer: "w" });
    } else {
      resetReviewVisionFilter();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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

  return (
    <Screen>
      <Screen.SidebarInset class={styles.topPane}>
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
      </Screen.SidebarInset>
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class={styles.host}>
            <LiveStarChessBoard variant={props.variant ?? "eclipse"} />
          </div>
        </Screen.BoardColumn>
        <div class={styles.sideRail} data-testid="starchess-side-rail">
          <TurnBarSidebar
            review={{
              turn: reviewTurnNumber(),
              phase: store.reviewPhase(),
              onBack: () => store.reviewBack(),
              onForward: () => store.reviewForward(),
              backDisabled: reviewBusy() || store.state().reviewIndex <= 0,
              forwardDisabled:
                reviewBusy() ||
                store.state().reviewIndex >= store.state().settledSnapshots.length - 1,
            }}
          />
          <hr class={styles.sideRailDivider} />
          <Sidebar onHome={props.onHome} />
        </div>
      </Screen.BoardArea>
      <Screen.Footer>
        <div class={styles.footerStack}>
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
        visionMode={props.visionMode}
        fog={props.fog}
        variant={props.variant}
        rookTank={props.rookTank}
        onHome={props.onHome}
      />
    </MatchStoreProvider>
  );
};
