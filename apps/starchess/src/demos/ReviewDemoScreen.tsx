// SPEC: _spec/apps/starchess/screens.puml, _spec/apps/starchess/architecture/screen-entities.puml, _spec/apps/starchess/navigation-chrome.md

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
import { Portal } from "solid-js/web";

import {
  clearAchievementBubbles,
  pushAchievementBubbles,
} from "~/achievements/achievementLive";
import { foldGame, foldPlyFromResolve, plySeenBy } from "~/achievements/analysis";
import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromReviewHistory } from "~/app/reviewHistory";
import { displayedSnapshot } from "~/app/selectors";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { DYNAMIC_MOBILE_MQ } from "~/utils/breakpoints";
import { Label } from "@chess-coach/ui-web/primitives/Label";
import { Screen } from "@chess-coach/ui-web/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import styles from "~/demos/ReviewDemoScreen.module.css";
import { clearSiegedTanks, setTankMode } from "~/presentation/animations/tankModeStore";
import { StarChessMobileBanner as MobileBanner } from "@chess-coach/ui-web/atoms/StarChessMobileBanner";
import { LiveBoardBinding } from "~/presentation/board/components/LiveBoardBinding";
import { displayPlayerName } from "~/utils/playerName";
import { formatScriptLabel } from "~/utils/matchTitle";
import { isCheckOnlyResolve } from "~/presentation/hud/isCheckOnlyResolve";
import { MatchBoardHost } from "~/presentation/hud/components/MatchBoardHost";
import { ResourceBar } from "~/presentation/hud/components/ResourceBar";
import { ReviewTurnNav } from "@chess-coach/ui-web/atoms/ReviewTurnNav";
import { TurnBarSidebar } from "~/presentation/hud/components/TurnBarSidebar";
import { TUTORIAL_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import {
  resetReviewVisionFilter,
  reviewVisionFilter,
  setReviewVisionFilter,
} from "~/store/reviewVisionStore";
import { resetTutorialNarration, setTutorialNarration } from "~/tutorial/tutorialNarrationStore";
import type { BoardSkin, PieceSet, VisionMode } from "~/types/board";
import type { ReviewHistory, StarChessMatchResult } from "~/types/review";

export type ReviewMatchTitle = {

  resultLine: string;

  result: StarChessMatchResult;

  matchup: string;
};

export type ReviewDemoScreenProps = {
  history: ReviewHistory;

  reviewLabel?: string;

  matchTitle?: ReviewMatchTitle;
  visionMode?: VisionMode;
  fog?: boolean;
  variant?: BoardSkin;
  pieceSet?: PieceSet;

  packedTank?: boolean;

  playerColor?: StarChessColor;

  playerName?: string;

  arenaPlayers?: { w: string; b: string };

  onHome?: () => void;

  hideResources?: boolean;

  hideDualNav?: boolean;

  tutorial?: boolean;

  header?: JSX.Element;
  footerExtra?: JSX.Element;

  /**
   * Replay both sides' achievement bubbles as turns play forward. `winner`
   * gates the end-of-game levels; `opponent` names the Adjutant tier a side
   * beat (Flawless levels on it).
   */
  achievements?: {
    winner: StarChessColor | null;
    opponent?: Partial<Record<StarChessColor, string>>;
  };
};

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

  }
};

const ReviewDemoInner: Component<ReviewDemoScreenProps> = (props) => {
  const store = useMatchStore();
  const snap = createMemo(() => displayedSnapshot(store.state()));

  const dynamicMobile = useMediaQuery(DYNAMIC_MOBILE_MQ);

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
    syncTankModes(s.placement, s.siegedTanks, props.packedTank);
  });

  createEffect(() => {
    if (!props.tutorial) return;
    setTutorialNarration({
      reviewPhase: store.reviewPhase(),
      timelineActive: store.state().timeline.active,
    });
  });

  // Achievements: the whole match is folded once; each forward step raises the
  // bubbles of the resolve that just finished. Any other seek clears the board.
  const plies = props.history.settledResolves.map((esr, i) =>
    foldPlyFromResolve(esr, props.history.settledSnapshots[i]?.placement),
  );
  const opening = props.history.settledSnapshots[0];
  const game =
    props.achievements && opening ? foldGame(opening, plies, props.achievements) : null;
  let shownIndex = store.state().reviewIndex;
  createEffect(() => {
    const index = store.state().reviewIndex;
    if (!game || index === shownIndex) return;
    const from = shownIndex;
    shownIndex = index;
    if (index !== from + 1) {
      clearAchievementBubbles();
      return;
    }
    const ply = plies[from];
    const filter = reviewVisionFilter();
    const last = index >= props.history.settledSnapshots.length - 1;
    const raised = [...(game.perPly[from] ?? []), ...(last ? game.final : [])];
    // A side's vision filter hides the other side's bubbles it could not see.
    pushAchievementBubbles(
      raised.filter(
        (bubble) =>
          filter === "both" ||
          bubble.side === filter ||
          (ply != null && plySeenBy(ply, filter, bubble.origin)),
      ),
    );
  });
  onCleanup(clearAchievementBubbles);

  onMount(() => {
    if (props.tutorial) setCapabilities(TUTORIAL_CAPABILITIES);

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
      clearSiegedTanks();
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

  const sideName = (color: StarChessColor): string => {
    if (props.arenaPlayers) {
      return formatScriptLabel(props.arenaPlayers[color]);
    }
    return color === (props.playerColor ?? "w")
      ? displayPlayerName(props.playerName)
      : "Adjutant";
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
        <ResourceBar
          compact={dynamicMobile()}
          color="w"
          snapshot={snap()}
          name={dynamicMobile() ? undefined : sideName("w")}
        />
      </Show>
      <Show when={showBlackResources()}>
        <ResourceBar
          compact={dynamicMobile()}
          color="b"
          snapshot={snap()}
          name={dynamicMobile() ? undefined : sideName("b")}
        />
      </Show>
    </div>
  );

  const reviewNavDisabled = () => ({
    back: reviewBusy() || store.state().reviewIndex <= 0,
    forward: reviewBusy() || store.state().reviewIndex >= store.state().settledSnapshots.length - 1,
  });

  return (
    <Screen>

      <MobileBanner
        onBack={() => props.onHome?.()}
        resources={dualResourceBars()}
      />
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
                  </div>
                )}
              </Show>
            </ScreenBackNav>
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

      <Show when={dynamicMobile() && !props.hideDualNav}>
        <Portal>
          <div
            class={styles.navDockDynamic}
            data-testid="review-turn-nav-dynamic"
          >
            <ReviewTurnNav
              onBack={() => store.reviewBack()}
              onForward={() => store.reviewForward()}
              backDisabled={reviewNavDisabled().back}
              forwardDisabled={reviewNavDisabled().forward}
            >
              <span />
            </ReviewTurnNav>
          </div>
        </Portal>
      </Show>
    </Screen>
  );
};

export const ReviewDemoScreen: Component<ReviewDemoScreenProps> = (props) => {
  const store = createMatchStore({
    initial: createMatchStateFromReviewHistory(props.history, {
      playerColor: props.playerColor ?? "w",
      ...(props.arenaPlayers ? { arenaPlayers: props.arenaPlayers } : {}),
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
        packedTank={props.packedTank}
        playerColor={props.playerColor}
        playerName={props.playerName}
        arenaPlayers={props.arenaPlayers}
        onHome={props.onHome}
        hideResources={props.hideResources}
        hideDualNav={props.hideDualNav}
        tutorial={props.tutorial}
        header={props.header}
        footerExtra={props.footerExtra}
        achievements={props.achievements}
      />
    </MatchStoreProvider>
  );
};

