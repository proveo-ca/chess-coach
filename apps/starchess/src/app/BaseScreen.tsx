// SPEC: _spec/apps/ui/responsiveness/rules.md, _spec/apps/starchess/screens.puml, _spec/apps/starchess/architecture/screen-entities.puml, _spec/apps/starchess/architecture/base-screen.puml, _spec/apps/starchess/core/board/planning-projection.puml, _spec/apps/starchess/core/engine-boundary.puml
import {
  UNIT_COST,
  adjacentSquares,
  charonTargetQueenFromPlacement,
  findKing,
  placementToMap,
  spawnKingAnchor,
  type ScFenSnapshot,
  type SpawnPiece,
  type StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";
import { Portal } from "solid-js/web";

import { storedMaterial, viewerColor } from "~/app/matchEconomy";
import { useMatchStore } from "~/app/MatchStoreContext";
import { canSubmit, outcomeLabel, readDisplayedSnapshot } from "~/app/selectors";
import styles from "~/app/BaseScreen.module.css";
import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { MobileBanner } from "~/components/atoms/MobileBanner";
import { ExitGameConfirm } from "~/components/features/ExitGameConfirm";
import { TutorialHudLabels } from "~/components/features/TutorialHudLabels";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { DYNAMIC_MOBILE_MQ, MOBILE_MQ } from "~/utils/breakpoints";
import { Label } from "~/components/primitives/Label";
import { PromotionModal } from "~/components/primitives/PromotionModal";
import { Screen } from "~/components/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { squareBoxStyle, findBoardGrid } from "~/presentation/animations/boardGeom";
import { LiveBoardBinding } from "~/presentation/board/components/LiveBoardBinding";
import { rookModeForSieged } from "~/presentation/board/rookMode";
import { GasRack } from "~/presentation/hud/components/GasRack";
import { usePieceSpecialArm } from "~/presentation/specials/hooks/usePieceSpecialArm";
import { DeployModal } from "~/presentation/hud/components/DeployModal";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import { MatchBoardHost } from "~/presentation/hud/components/MatchBoardHost";
import { ResourceBar } from "~/presentation/hud/components/ResourceBar";
import { ReviewTurnNav } from "~/components/atoms/ReviewTurnNav";
import { TurnBar } from "~/presentation/hud/components/TurnBar";
import { TurnBarSidebar } from "~/presentation/hud/components/TurnBarSidebar";
import { pawnGasArm, specialTimingFor, tryQueue } from "~/presentation/specials/pawnGasArm";
import { tacticalJumpTargets } from "~/presentation/specials/queenTacticalJump";
import { TUTORIAL_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { resetReviewVisionFilter, reviewVisionFilter } from "~/store/reviewVisionStore";
import type { BoardSkin, PieceSet } from "~/types/board";
import type { PromotionPiece } from "~/types/chess";
import type { KerriganEmotion } from "~/types/coach";
import type { TutorialBoardArrow } from "~/types/tutorial";

export type AutoQueueOpponentResult = {
  snapshot: ScFenSnapshot;
  spendMinerals?: { color: StarChessColor; amount: number };
};

export type StarChessScreenProps = {
  starChessMode?: boolean;
  fog?: boolean;
  boardVariant?: BoardSkin;
  pieceSet?: PieceSet;
  armTimer?: boolean;
  autoQueueOpponent?: (snap: ScFenSnapshot) => AutoQueueOpponentResult;
  onExitToMenu?: () => void;
  matchTitle?: string;
  turnChrome?: "bar" | "sidebar" | "none";
  hideResources?: boolean;
  hideGas?: boolean;
  tutorial?: boolean;
  /**
   * Tutorial lesson that renders the full match HUD (Home + title + ResourceBar
   * top pane) exactly like `/single`, instead of the coach header. Guide bubble
   * still docks below the pane; coach lesson-nav `header` is ignored. Intended
   * for the final tutorial lesson, used together with `tutorial`.
   */
  fullMatchHud?: boolean;
  endTurnAfterQueue?: "first" | "moveAndSpecial";
  coachEmotion?: KerriganEmotion;
  guideBubble?: import("solid-js").JSX.Element;
  header?: import("solid-js").JSX.Element;
  footerExtra?: import("solid-js").JSX.Element;
  hintSquares?: readonly Square[];
  hintArrows?: readonly TutorialBoardArrow[];
};

type OverlayBox = { top: number; left: number; width: number; height: number };

export const BaseScreen: Component<StarChessScreenProps> = (props) => {
  const store = useMatchStore();
  const variant = (): BoardSkin => props.boardVariant ?? "eclipse";
  const starChessMode = () => props.starChessMode ?? true;
  const fogOfWar = () => props.fog ?? starChessMode();
  const ended = () => store.shell().phase === "gameOver";
  const snap = () => store.shell().liveSnapshot;
  const turnChrome = () => props.turnChrome ?? "bar";
  const turnInSidebar = () => turnChrome() === "sidebar";
  const turnHidden = () => turnChrome() === "none";

  const [spawnUnit, setSpawnUnit] = createSignal<SpawnPiece | null>(null);
  const [spawnPhase, setSpawnPhase] = createSignal<"idle" | "modal" | "pick">("idle");
  const [overlayBox, setOverlayBox] = createSignal<OverlayBox | null>(null);
  const [exitOpen, setExitOpen] = createSignal(false);
  const dynamicMobile = useMediaQuery(DYNAMIC_MOBILE_MQ);
  const mobileViewport = useMediaQuery(MOBILE_MQ);
  let boardHost: HTMLDivElement | undefined;

  /**
   * Coach-header shell (lesson chrome: avatar band + guide bubble) instead of
   * the `/single` top pane. The final lesson (`fullMatchHud`) opts back out.
   */
  const coachHeader = () =>
    (props.header != null || props.tutorial) && !props.fullMatchHud;

  /** Tall/narrow mobile loses the rail — TurnBar under GasRack (no phase chips). */
  const showFooterTurnBar = () =>
    starChessMode() &&
    !ended() &&
    !turnHidden() &&
    turnInSidebar() &&
    mobileViewport() &&
    !dynamicMobile();

  const liveMatch = () => {
    const phase = store.shell().phase;
    return phase === "planning" || phase === "targeting" || phase === "resolving";
  };

  const requestLeave = () => {
    if (!props.onExitToMenu) return;
    if (liveMatch()) {
      setExitOpen(true);
      return;
    }
    props.onExitToMenu();
  };

  const confirmLeave = () => {
    setExitOpen(false);
    props.onExitToMenu?.();
  };

  const activeKingSq = createMemo((): Square | null => {
    const s = snap();
    return findKing(placementToMap(s.placement), viewerColor(store));
  });

  const spawnAnchor = createMemo(() => {
    const color = viewerColor(store);
    const timing = specialTimingFor(snap().queue, color);
    return spawnKingAnchor(snap(), color, timing);
  });

  const spawnAdjacent = createMemo(() => {
    if (spawnPhase() !== "pick") return [] as Square[];
    const { king, allyOccupied } = spawnAnchor();
    if (!king) return [] as Square[];
    return adjacentSquares(king, allyOccupied);
  });

  const specialTargetSquares = createMemo((): Square[] => {
    const t = store.shell().targeting;
    if (!t) return [];
    if (t.kind === "bishopSnipe") return [t.to];
    if (t.kind === "queenWarp") return [...t.targets];
    return [];
  });

  const modalPending = createMemo(() => {
    if (spawnPhase() !== "modal") return null;
    return { color: viewerColor(store) };
  });

  const promotionPending = createMemo(() => {
    const s = store.shell();
    if (!s.pendingPromotion) return null;
    const phase = liveMatchPhase({
      phase: s.phase,
      lastResolve: s.lastResolve,
      timelineActive: store.timeline().active,
      pendingPromotion: true,
    });
    return phase === "intent" ? s.pendingPromotion : null;
  });

  const resolvePromotion = (piece: PromotionPiece) => {
    const pending = store.shell().pendingPromotion;
    if (!pending) return;
    store.dispatch({ type: "CLEAR_PENDING_PROMOTION" });
    if (pending.via === "gas") {
      store.dispatch({
        type: "QUEUE_ACTION",
        action: {
          timing: "B",
          kind: "pawnDouble",
          color: pending.color,
          from: pending.from,
          to: pending.to,
          promotion: piece,
        },
      });
      store.dispatch({ type: "MARK_SPECIAL_USED", square: pending.from });
      return;
    }
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color: pending.color,
        from: pending.from,
        to: pending.to,
        promotion: piece,
      },
    });
  };

  const cancelPromotion = () => {
    store.dispatch({ type: "CLEAR_PENDING_PROMOTION" });
  };

  const syncOverlay = () => {
    const host = boardHost;
    if (!host) return;
    const el = findBoardGrid(host);
    if (!el) return;
    const hr = host.getBoundingClientRect();
    const br = el.getBoundingClientRect();
    setOverlayBox({
      top: br.top - hr.top + el.clientTop,
      left: br.left - hr.left + el.clientLeft,
      width: el.clientWidth,
      height: el.clientHeight,
    });
  };

  const { onGasDeploy } = usePieceSpecialArm({
    k: () => {
      if (!activeKingSq()) {
        store.dispatch({ type: "QUEUE_REJECT", message: "No command center on the board" });
        return false;
      }
      setSpawnUnit(null);
      setSpawnPhase("modal");
      store.dispatch({
        type: "QUEUE_REJECT",
        message: `Pick a unit to deploy · minerals ${storedMaterial(store)}`,
      });
      return "pending"; // open modal; mark used only after spawn commits
    },
    r: (ctx) => {
      const color = viewerColor(store);
      const timing = specialTimingFor(snap().queue, color);
      return tryQueue(
        store,
        { timing, kind: "rookSiege", color, from: ctx.square },
        `Siege Tank toggle queued on ${ctx.square} · End to resolve`,
      )
        ? "armed"
        : false;
    },
    n: (ctx) => {
      const color = viewerColor(store);
      const timing = specialTimingFor(snap().queue, color);
      return tryQueue(
        store,
        { timing, kind: "knightMine", color, from: ctx.square, to: ctx.square },
        `Spider Mine queued on ${ctx.square} · End to resolve`,
      )
        ? "armed"
        : false;
    },
    p: (ctx) => pawnGasArm(store, snap(), ctx),
    b: (ctx) => {
      const color = viewerColor(store);
      const queen = charonTargetQueenFromPlacement(snap().placement, ctx.square);
      if (!queen) {
        store.dispatch({
          type: "QUEUE_REJECT",
          message: "Charon Booster Missiles needs exactly one enemy queen on a diagonal",
        });
        return false;
      }
      setSpawnPhase("idle");
      setSpawnUnit(null);
      store.dispatch({
        type: "OPEN_BISHOP_SNIPE",
        color,
        from: ctx.square,
        to: queen,
      });
      requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
      return "pending";
    },
    q: (ctx) => {
      const color = viewerColor(store);
      const targets = tacticalJumpTargets(snap().placement, ctx.square, color, {
        rookModeFor: rookModeForSieged(store.shell().siegedRooks),
      });
      if (targets.length === 0) {
        store.dispatch({
          type: "QUEUE_REJECT",
          message: "Tactical Jump needs a visible empty square",
        });
        return false;
      }
      setSpawnPhase("idle");
      setSpawnUnit(null);
      store.dispatch({
        type: "OPEN_QUEEN_WARP",
        color,
        from: ctx.square,
        targets,
      });
      requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
      return "pending";
    },
  });

  const onSelectSpawnUnit = (piece: SpawnPiece) => {
    const cost = UNIT_COST[piece];
    if (storedMaterial(store) < cost) {
      store.dispatch({
        type: "QUEUE_REJECT",
        message: `Need ${cost} minerals (have ${storedMaterial(store)})`,
      });
      return;
    }
    setSpawnUnit(piece);
    setSpawnPhase("pick");
    store.dispatch({
      type: "QUEUE_REJECT",
      message: `Tap an adjacent empty square to deploy ${piece.toUpperCase()}`,
    });
    store.dispatch({
      type: "OPEN_SPAWN",
      color: viewerColor(store),
      unit: piece,
    });
    requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
  };

  const onCancelSpawn = () => {
    setSpawnPhase("idle");
    setSpawnUnit(null);
    store.dispatch({ type: "CANCEL_TARGET" });
  };

  const deploySpawnAt = (to: Square) => {
    const unit = spawnUnit();
    const from = activeKingSq();
    const color = viewerColor(store);
    if (!unit || !from) return;
    const cost = UNIT_COST[unit];
    const before = store.shell().economies[color].stored;
    store.dispatch({ type: "SPEND_STORED", color, amount: cost });
    if (store.shell().economies[color].stored === before) {
      store.dispatch({
        type: "QUEUE_REJECT",
        message: `Need ${cost} minerals (have ${storedMaterial(store)})`,
      });
      return;
    }
    const timing = specialTimingFor(snap().queue, color);
    const ok = tryQueue(
      store,
      { timing, kind: "spawn", color, from, to, unit },
      `Deploy ${unit.toUpperCase()} → ${to} queued · End to drop`,
    );
    if (!ok) {
      store.dispatch({ type: "REFUND_STORED", color, amount: cost });
      return;
    }
    store.dispatch({ type: "MARK_SPECIAL_USED", square: from });
    setSpawnPhase("idle");
    setSpawnUnit(null);
  };

  const commitBishopSnipe = (to: Square) => {
    const t = store.shell().targeting;
    if (!t || t.kind !== "bishopSnipe" || t.to !== to) return;
    const timing = specialTimingFor(snap().queue, t.color);
    const ok = tryQueue(
      store,
      { timing, kind: "bishopSnipe", color: t.color, from: t.from, to: t.to },
      `Charon Booster Missiles ${t.from}→${t.to} queued · End to fire`,
    );
    if (ok) store.dispatch({ type: "MARK_SPECIAL_USED", square: t.from });
  };

  const commitQueenWarp = (to: Square) => {
    const t = store.shell().targeting;
    if (!t || t.kind !== "queenWarp" || !t.targets.includes(to)) return;
    const timing = specialTimingFor(snap().queue, t.color);
    const ok = tryQueue(
      store,
      { timing, kind: "queenWarp", color: t.color, from: t.from, to },
      `Tactical Jump ${t.from}→${to} queued · End to resolve`,
    );
    if (ok) store.dispatch({ type: "MARK_SPECIAL_USED", square: t.from });
  };

  createEffect(() => {
    if (!starChessMode()) return;
    const fn = props.autoQueueOpponent;
    if (!fn) return;
    if (store.shell().deadlineAt == null) return;
    if (store.timeline().active) return;
    if (!store.shell().turnStartChecksApplied) return;
    const s = store.shell().liveSnapshot;
    if (s.phase !== "P") return;
    void s.turn;
    void s.placement;
    void (s.queue?.actions.length ?? 0);
    const result = fn(s);
    if (result.snapshot === s) return;
    if (result.spendMinerals) {
      const { color, amount } = result.spendMinerals;
      const before = store.shell().economies[color].stored;
      store.dispatch({ type: "SPEND_STORED", color, amount });
      if (store.shell().economies[color].stored === before) return;
    }
    store.dispatch({ type: "APPLY_SNAPSHOT", snapshot: result.snapshot });
  });

  createEffect(() => {
    if (props.armTimer === false || !starChessMode()) return;
    const s = store.shell();
    void s.liveSnapshot.turn;
    void s.liveSnapshot.placement;
    if (s.phase !== "planning" && s.phase !== "targeting") return;
    if (store.timeline().active) return;
    if (s.deadlineAt != null) return;
    store.armTimer();
  });

  /**
   * End the turn exactly the way the End button does. Auto-End must not
   * dispatch from inside a reactive effect: SUBMIT_TURN starts the resolve
   * timeline, and running that inside the effect's batch lands the timeline's
   * coalesced TIMELINE_COMMIT patches after TIMELINE_DONE — the cues are
   * cleared before any `playingIds` reach the overlays, so the move VFX never
   * renders and pieces appear to teleport. Deferring to a task puts the submit
   * in the same context a click would.
   */
  const endTurnLikeAClick = () => {
    setTimeout(() => {
      if (!canSubmit(store.shell())) return;
      store.submitTurn("end");
    }, 0);
  };

  let prevQueueReady = false;
  createEffect(() => {
    if (!props.tutorial) return;
    const mode = props.endTurnAfterQueue;
    if (!mode) return;
    const s = store.shell();
    const color = s.playerColor;
    const side = (s.liveSnapshot.queue?.actions ?? []).filter((a) => a.color === color);
    const planning = s.phase === "planning" || s.phase === "targeting";
    if (!planning || store.timeline().active) {
      prevQueueReady = false;
      return;
    }
    if (s.pendingPromotion || s.targeting) {
      return;
    }
    const ready =
      mode === "first"
        ? side.length >= 1
        : side.some((a) => a.timing === "C") && side.some((a) => a.timing !== "C");
    const shouldEnd = ready && !prevQueueReady;
    prevQueueReady = ready;
    if (shouldEnd) endTurnLikeAClick();
  });

  createEffect(() => {
    void snap().placement;
    void spawnPhase();
    void store.shell().targeting;
    requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
  });

  onMount(() => {
    if (props.tutorial) setCapabilities(TUTORIAL_CAPABILITIES);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      /**
       * Escape backs out of an armed special. Modals own their own Escape
       * (`Modal` is dismissible), so this only covers the states that have **no**
       * dismiss affordance: board-click targeting (Charon / Tactical Jump / the
       * deploy square pick) and a picker the resolve timeline has hidden —
       * `pendingPromotion` makes `onSquareClick` a no-op, so without this the
       * board swallows every click with nothing on screen to explain why.
       */
      if (e.key === "Escape") {
        if (exitOpen() || modalPending() || promotionPending()) return;
        const s = store.shell();
        if (s.targeting || spawnPhase() !== "idle") {
          e.preventDefault();
          onCancelSpawn();
          store.dispatch({
            type: "QUEUE_REJECT",
            message: "Cancelled — canister returned",
          });
          return;
        }
        if (s.pendingPromotion) {
          e.preventDefault();
          store.dispatch({ type: "CLEAR_PENDING_PROMOTION" });
        }
        return;
      }
      if (store.shell().phase !== "gameOver") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        store.reviewBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        store.reviewForward();
      }
    };
    window.addEventListener("keydown", onKey);
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => syncOverlay());
      const kick = () => {
        syncOverlay();
        if (boardHost) ro.observe(boardHost);
        const grid = boardHost ? findBoardGrid(boardHost) : null;
        if (grid) ro.observe(grid);
      };
      requestAnimationFrame(() => requestAnimationFrame(kick));
      window.addEventListener("resize", syncOverlay);
      onCleanup(() => {
        ro.disconnect();
        window.removeEventListener("resize", syncOverlay);
        window.removeEventListener("keydown", onKey);
      });
    } else {
      onCleanup(() => window.removeEventListener("keydown", onKey));
    }
  });

  onCleanup(() => {
    store.cancelEffects();
    resetReviewVisionFilter();
  });

  const reviewTurnNumber = () => {
    const s = store.shell();
    const settled = s.settledSnapshots[s.reviewIndex];
    return Math.max(1, settled?.turn ?? snap().turn);
  };

  const reviewBusy = () =>
    store.timeline().active ||
    store.reviewPhase() === "check" ||
    store.reviewPhase() === "intent" ||
    store.reviewPhase() === "resolve";

  const showWhiteResources = () => {
    const f = reviewVisionFilter();
    return f === "both" || f === "w";
  };
  const showBlackResources = () => {
    const f = reviewVisionFilter();
    return f === "both" || f === "b";
  };

  const topChrome = () => (
    <>
      <Show when={starChessMode() && !turnInSidebar() && !turnHidden() && !ended()}>
        <TurnBar
          class={styles.topTurnBar}
          autoStart={false}
          resolveOnEnd={false}
          onEnd={() => store.submitTurn("end")}
        />
      </Show>
      <Show when={starChessMode() && !props.hideResources}>
        <Show when={ended()} fallback={<ResourceBar class={styles.topResourceBar} />}>
          <ReviewTurnNav
            onBack={() => store.reviewBack()}
            onForward={() => store.reviewForward()}
            backDisabled={reviewBusy() || store.shell().reviewIndex <= 0}
            forwardDisabled={
              reviewBusy() ||
              store.shell().reviewIndex >= store.shell().settledSnapshots.length - 1
            }
          >
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
                  class={styles.topResourceBar}
                  color="w"
                  snapshot={readDisplayedSnapshot(store)}
                />
              </Show>
              <Show when={showBlackResources()}>
                <ResourceBar
                  class={styles.topResourceBar}
                  color="b"
                  snapshot={readDisplayedSnapshot(store)}
                />
              </Show>
            </div>
          </ReviewTurnNav>
        </Show>
      </Show>
    </>
  );

  return (
    <Screen>
      {/* Names the deploy / promotion tiles and the ResourceBar strips — the
          labelled components stay unaware, see TutorialHudLabels. */}
      <TutorialHudLabels enabled={!!props.tutorial} />
      <Show when={starChessMode()}>
        <span
          data-testid="king-lives"
          data-w={snap().kingLives.w}
          data-b={snap().kingLives.b}
          hidden
        />
      </Show>

      {/*
        Dynamic band owns the top strip. The coach header collapses to nothing
        there (its avatar is `desktop-only` / `mobile-hero`), and the rail and
        footer TurnBar are both off, so without this a lesson has no `‹ Back`
        and no End Turn. Same move `TutorialReviewHost` makes for the replays —
        a direct `Screen` child so the strip resolves full-bleed against the
        viewport, not against the inset chrome pane. Resources stay out: the
        tutorial shows no ResourceBar in any other band either.
      */}
      <Show when={coachHeader() && starChessMode() && !ended() && dynamicMobile()}>
        <MobileBanner
          onBack={props.onExitToMenu}
          turn={
            <Show when={!turnHidden()}>
              <TurnBar
                compact
                autoStart={false}
                resolveOnEnd={false}
                onEnd={() => store.submitTurn("end")}
              />
            </Show>
          }
        />
      </Show>

      <Show
        when={coachHeader()}
        fallback={
          <Screen.SidebarInset class={styles.topPane}>
            <Show when={props.guideBubble}>
              <div class={styles.hudGuideSlot}>{props.guideBubble}</div>
            </Show>
            <Show
              when={props.onExitToMenu}
              fallback={<div class={styles.topChrome} data-testid="starchess-board-chrome">{topChrome()}</div>}
            >
              <Show when={starChessMode() && !ended() && dynamicMobile()}>
                <MobileBanner
                  onBack={requestLeave}
                  fixedResources
                  resources={
                    <Show when={!props.hideResources}>
                      <ResourceBar compact />
                    </Show>
                  }
                  turn={
                    <Show when={!turnHidden()}>
                      <TurnBar
                        compact
                        autoStart={false}
                        resolveOnEnd={false}
                        onEnd={() => store.submitTurn("end")}
                      />
                    </Show>
                  }
                />
              </Show>
              <div
                class={styles.topNavRow}
                classList={{ [styles.dynamicHide]: starChessMode() && !ended() && dynamicMobile() }}
              >
                <ScreenBackNav onBack={requestLeave} data-testid="live-back">
                  <Show when={props.matchTitle}>
                    <div class={styles.matchTitle} data-testid="live-match-title">
                      <Label variant="title" class={styles.matchupLine}>
                        {props.matchTitle}
                      </Label>
                    </div>
                  </Show>
                  <div class={styles.topChrome} data-testid="starchess-board-chrome">
                    {topChrome()}
                  </div>
                </ScreenBackNav>
              </div>
            </Show>
          </Screen.SidebarInset>
        }
      >
        <Screen.Header>
          <div class={styles.headerSlot}>
            <div class="desktop-only" data-testid="tutorial-header">
              <Show
                when={props.header}
                fallback={
                  <CoachAvatar identity="kerrigan" emotion={props.coachEmotion ?? "idle"} />
                }
              >
                {props.header}
              </Show>
            </div>
            {/* Mobile coach lives in the chrome track, never in the board
                column — see TutorialReviewHost. */}
            <Show when={props.tutorial && !props.fullMatchHud}>
              <div class="mobile-hero" data-testid="tutorial-mobile-hero">
                <Show
                  when={props.header}
                  fallback={
                    <CoachAvatar identity="kerrigan" emotion={props.coachEmotion ?? "idle"} />
                  }
                >
                  {props.header}
                </Show>
              </div>
            </Show>
            {props.guideBubble}
          </div>
        </Screen.Header>
      </Show>

      <MatchBoardHost>
        <MatchBoardHost.BoardColumn>
          <MatchBoardHost.BoardHost
            class={styles.boardHost}
            data-testid="starchess-play-layout"
            ref={(el) => {
              boardHost = el;
            }}
          >
            <LiveBoardBinding
              fog={ended() ? undefined : fogOfWar()}
              visionMode="player"
              variant={variant()}
              pieceSet={props.pieceSet}
              hintSquares={props.hintSquares}
              hintArrows={props.hintArrows}
            />
            <Show when={starChessMode() && overlayBox()}>
              {(box) => (
                <div
                  class={styles.boardOverlay}
                  data-special="king-spawn"
                  style={{
                    top: `${box().top}px`,
                    left: `${box().left}px`,
                    width: `${box().width}px`,
                    height: `${box().height}px`,
                  }}
                >
                  <Show when={spawnPhase() === "pick"}>
                    <For each={spawnAdjacent()}>
                      {(sq) => (
                        <div
                          class={`${styles.hit} ${styles.hitAdjacent}`}
                          style={squareBoxStyle(sq, box().width, box().height)}
                          data-square={sq}
                          data-spawn-target
                          onClick={() => deploySpawnAt(sq)}
                        />
                      )}
                    </For>
                  </Show>
                  <For each={specialTargetSquares()}>
                    {(sq) => (
                      <div
                        class={`${styles.hit} ${styles.hitAdjacent}`}
                        style={squareBoxStyle(sq, box().width, box().height)}
                        data-square={sq}
                        data-special-target
                        onClick={() => {
                          const kind = store.shell().targeting?.kind;
                          if (kind === "bishopSnipe") commitBishopSnipe(sq);
                          else if (kind === "queenWarp") commitQueenWarp(sq);
                        }}
                      />
                    )}
                  </For>
                </div>
              )}
            </Show>
            <Show when={starChessMode() && !ended()}>
              <DeployModal
                pending={modalPending()}
                onSelect={onSelectSpawnUnit}
                onCancel={onCancelSpawn}
              />
              <PromotionModal
                pending={promotionPending()}
                onSelect={resolvePromotion}
                onCancel={cancelPromotion}
              />
            </Show>
          </MatchBoardHost.BoardHost>
        </MatchBoardHost.BoardColumn>
        <MatchBoardHost.Rail
          onHome={props.onExitToMenu}
          controlsVisible={
            starChessMode() && turnInSidebar() && !turnHidden() && !mobileViewport()
          }
        >
          <Show when={!mobileViewport()}>
            <Show
              when={ended()}
              fallback={
                <TurnBarSidebar
                  autoStart={false}
                  resolveOnEnd={false}
                  onEnd={() => store.submitTurn("end")}
                />
              }
            >
              <TurnBarSidebar
                review={{
                  turn: reviewTurnNumber(),
                  phase: store.reviewPhase(),
                  hideDualNav: true,
                  onBack: () => store.reviewBack(),
                  onForward: () => store.reviewForward(),
                  backDisabled: reviewBusy() || store.shell().reviewIndex <= 0,
                  forwardDisabled:
                    reviewBusy() ||
                    store.shell().reviewIndex >= store.shell().settledSnapshots.length - 1,
                }}
              />
            </Show>
          </Show>
        </MatchBoardHost.Rail>
      </MatchBoardHost>

      <Screen.Footer>
        <div class={styles.footerStack}>
          <Show when={props.footerExtra}>{props.footerExtra}</Show>
          <div
            classList={{
              [styles.gasDock]: true,
              [styles.dynamicHide]: !!(
                props.onExitToMenu &&
                starChessMode() &&
                !ended() &&
                dynamicMobile()
              ),
            }}
            data-testid="starchess-gas-deploy"
          >
            <Show when={starChessMode() && !ended() && !props.hideGas}>
              <GasRack
                onDeploy={onGasDeploy}
                onCancel={() => {
                  setSpawnPhase("idle");
                  setSpawnUnit(null);
                  store.dispatch({ type: "CANCEL_TARGET" });
                  store.dispatch({
                    type: "QUEUE_REJECT",
                    message: "Cancelled — canister returned",
                  });
                }}
              />
            </Show>
          </div>
          <Show when={showFooterTurnBar()}>
            <TurnBar
              density="default"
              hidePhase
              class={styles.footerTurnBar}
              autoStart={false}
              resolveOnEnd={false}
              onEnd={() => store.submitTurn("end")}
            />
          </Show>
          <Show when={!props.tutorial || props.fullMatchHud}>
            <div
              class={styles.statusLine}
              data-testid="status-line"
              data-idle-plan={
                !outcomeLabel(store.shell()) && store.shell().statusText === "Plan your turn"
                  ? "true"
                  : "false"
              }
            >
              <Show
                when={starChessMode()}
                fallback={<p class={styles.placeholder}>StarChess is loading…</p>}
              >
                <Show
                  when={outcomeLabel(store.shell())}
                  fallback={<p class={styles.placeholder}>{store.shell().statusText}</p>}
                >
                  {(label) => <p class={styles.placeholder}>{label()}</p>}
                </Show>
              </Show>
            </div>
          </Show>
        </div>
      </Screen.Footer>
      <Show
        when={
          !!(
            props.onExitToMenu &&
            starChessMode() &&
            !ended() &&
            !props.hideGas &&
            dynamicMobile()
          )
        }
      >
        <Portal>
          <div
            class={`gas-dock-dynamic ${styles.gasDockDynamic}`}
            data-testid="starchess-gas-deploy-dynamic"
            style={{
              display: "block",
              position: "fixed",
              bottom: "0.75rem",
              right: "0.75rem",
              top: "auto",
              "z-index": "70",
            }}
          >
            <GasRack
              onDeploy={onGasDeploy}
              onCancel={() => {
                setSpawnPhase("idle");
                setSpawnUnit(null);
                store.dispatch({ type: "CANCEL_TARGET" });
                store.dispatch({
                  type: "QUEUE_REJECT",
                  message: "Cancelled — canister returned",
                });
              }}
            />
          </div>
        </Portal>
      </Show>
      <ExitGameConfirm
        open={exitOpen()}
        onClose={() => setExitOpen(false)}
        onConfirm={confirmLeave}
      />
    </Screen>
  );
};
