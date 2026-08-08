/**
 * Live StarChess screen — Command Column HUD (Resource → Board|SideRail → Gas).
 * Board variants: eclipse | butter | vermeer (default eclipse).
 * // SPEC: _spec/apps/ui/responsiveness/rules.md
 * // SPEC: _spec/apps/starchess/screens.puml
 */
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
import { displayedSnapshot, outcomeLabel } from "~/app/selectors";
import styles from "~/app/StarChessScreen.module.css";
import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { MobileBanner } from "~/components/atoms/MobileBanner";
import { ExitGameConfirm } from "~/components/features/ExitGameConfirm";
import { Label } from "~/components/primitives/Label";
import { PromotionModal } from "~/components/primitives/PromotionModal";
import { Screen } from "~/components/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { squareBoxStyle, findBoardGrid } from "~/presentation/animations/boardGeom";
import { LiveStarChessBoard } from "~/presentation/board/LiveStarChessBoard";
import { GasDeploy } from "~/presentation/features/GasDeploy";
import { usePieceSpecialArm } from "~/presentation/hooks/usePieceSpecialArm";
import { BoardSideRail } from "~/presentation/hud/BoardSideRail";
import { DeployModal } from "~/presentation/hud/DeployModal";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import { ResourceBar } from "~/presentation/hud/ResourceBar";
import { ReviewTurnNav } from "~/presentation/hud/ReviewTurnNav";
import { TurnBar } from "~/presentation/hud/TurnBar";
import { TurnBarSidebar } from "~/presentation/hud/TurnBarSidebar";
import { pawnGasArm, specialTimingFor, tryQueue } from "~/presentation/specials/pawnGasArm";
import { tacticalJumpTargets } from "~/presentation/specials/queenTacticalJump";
import { TUTORIAL_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { resetReviewVisionFilter, reviewVisionFilter } from "~/store/reviewVisionStore";
import type { BoardSkin, PieceSet } from "~/types/board";
import type { PromotionPiece } from "~/types/chess";
import type { KerriganEmotion } from "~/types/coach";

export type AutoQueueOpponentResult = {
  snapshot: ScFenSnapshot;
  spendMinerals?: { color: StarChessColor; amount: number };
};

export type StarChessScreenProps = {
  /**
   * StarChess ruleset (default true). When on, fog of war is always enabled.
   * Maps / terrain gallery sets `false` to preview boards without fog — matches
   * apps/ui `NerdScreen` `starChessMode`.
   */
  starChessMode?: boolean;
  /** When false, skip fog overlay. Defaults to `starChessMode`. */
  fog?: boolean;
  /** eclipse | butter | vermeer | classic — default eclipse. */
  boardVariant?: BoardSkin;
  /** Piece SVG set — `cburnett` for tutorial Chess mode. */
  pieceSet?: PieceSet;
  /** Auto-arm planning timer on mount. */
  armTimer?: boolean;
  /**
   * Story / demo AI: when set, queues the opponent’s next action each planning
   * turn (e.g. the King Hunt live `adjutant` defensive commander).
   */
  autoQueueOpponent?: (snap: ScFenSnapshot) => AutoQueueOpponentResult;
  /** Side-rail Home — return to StarChess menu (SPA) instead of leaving the app. */
  onExitToMenu?: () => void;
  /**
   * Optional live match title above ResourceBar (Review-style Label stack).
   * Hidden on short / dynamic viewports via ``max-height: 639px`` (height only).
   */
  matchTitle?: string;
  /**
   * HUD variation: `"sidebar"` moves turn chrome into `BoardSideRail`.
   * Default `"bar"` keeps `TurnBar`
   * above the board. `"none"` hides turn chrome (Fog of War tutorial).
   */
  turnChrome?: "bar" | "sidebar" | "none";
  /** Hide ResourceBars (tutorial). */
  hideResources?: boolean;
  /** Hide GasDeploy rack (Fog of War tutorial). */
  hideGas?: boolean;
  /** Tutorial HOME-only sidebar. */
  tutorial?: boolean;
  /**
   * Tutorial-only auto-End when the player queue meets a threshold:
   * - `first` — first intent (Fog of War; Command Center)
   * - `moveAndSpecial` — one classical + one special (other Special Moves)
   * Ignored unless `tutorial` is set.
   */
  endTurnAfterQueue?: "first" | "moveAndSpecial";
  /** Kerrigan emotion for CoachScreen-shaped header / mobile hero (tutorial). */
  coachEmotion?: KerriganEmotion;
  /** Floating guide ChatBubble (tutorial) — hangs under Header over ranks 7–8. */
  guideBubble?: import("solid-js").JSX.Element;
  /** Replaces SidebarInset when set (tutorial desktop header avatar slot). */
  header?: import("solid-js").JSX.Element;
  footerExtra?: import("solid-js").JSX.Element;
  /** Tutorial destination rings (e.g. fog/knight hop path). */
  hintSquares?: readonly Square[];
};

type OverlayBox = { top: number; left: number; width: number; height: number };

export const StarChessScreen: Component<StarChessScreenProps> = (props) => {
  const store = useMatchStore();
  const variant = (): BoardSkin => props.boardVariant ?? "eclipse";
  const starChessMode = () => props.starChessMode ?? true;
  const fogOfWar = () => props.fog ?? starChessMode();
  const ended = () => store.state().phase === "gameOver";
  const snap = () => store.state().liveSnapshot;
  const turnChrome = () => props.turnChrome ?? "bar";
  const turnInSidebar = () => turnChrome() === "sidebar";
  const turnHidden = () => turnChrome() === "none";

  const [spawnUnit, setSpawnUnit] = createSignal<SpawnPiece | null>(null);
  const [spawnPhase, setSpawnPhase] = createSignal<"idle" | "modal" | "pick">("idle");
  const [overlayBox, setOverlayBox] = createSignal<OverlayBox | null>(null);
  const [exitOpen, setExitOpen] = createSignal(false);
  /** Matches MobileBanner / gas-corner band (Storybook Dynamic 560×420). */
  const [dynamicMobile, setDynamicMobile] = createSignal(false);
  let boardHost: HTMLDivElement | undefined;

  onMount(() => {
    const mq = window.matchMedia(
      "(max-width: 719px) and (min-width: 480px) and (max-height: 639px)",
    );
    const sync = () => setDynamicMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    onCleanup(() => mq.removeEventListener("change", sync));
  });

  const liveMatch = () => {
    const phase = store.state().phase;
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

  /** B = living king; F (after queued C) = post-move Command Center ring. */
  const spawnAnchor = createMemo(() => {
    const color = viewerColor(store);
    const timing = specialTimingFor(snap().queue, color);
    return spawnKingAnchor(snap(), color, timing);
  });

  const spawnAdjacent = createMemo(() => {
    if (spawnPhase() !== "pick") return [] as Square[];
    const { king, occupied } = spawnAnchor();
    if (!king) return [] as Square[];
    return adjacentSquares(king, occupied);
  });

  const specialTargetSquares = createMemo((): Square[] => {
    const t = store.state().targeting;
    if (!t) return [];
    if (t.kind === "bishopSnipe") return [t.to];
    if (t.kind === "queenWarp") return [...t.targets];
    return [];
  });

  const modalPending = createMemo(() => {
    if (spawnPhase() !== "modal") return null;
    return { color: viewerColor(store) };
  });

  /** Intent-phase last-rank picker — same chrome surface as DeployModal. */
  const promotionPending = createMemo(() => {
    const s = store.state();
    if (!s.pendingPromotion) return null;
    const phase = liveMatchPhase({
      phase: s.phase,
      lastResolve: s.lastResolve,
      timelineActive: s.timeline.active,
      pendingPromotion: true,
    });
    return phase === "intent" ? s.pendingPromotion : null;
  });

  const resolvePromotion = (piece: PromotionPiece) => {
    const pending = store.state().pendingPromotion;
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
      // Mark used only when the snipe queues.
      return "pending";
    },
    q: (ctx) => {
      const color = viewerColor(store);
      const sieged = store.state().siegedRooks;
      const targets = tacticalJumpTargets(snap().placement, ctx.square, color, {
        rookModeFor: (sq) => (sieged.has(sq) ? "siege" : "tank"),
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
      // Mark used only when the jump queues.
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
    // Keep targeting in store for board input path as well.
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
    const before = store.state().economies[color].stored;
    store.dispatch({ type: "SPEND_STORED", color, amount: cost });
    if (store.state().economies[color].stored === before) {
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
    const t = store.state().targeting;
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
    const t = store.state().targeting;
    if (!t || t.kind !== "queenWarp" || !t.targets.includes(to)) return;
    const timing = specialTimingFor(snap().queue, t.color);
    const ok = tryQueue(
      store,
      { timing, kind: "queenWarp", color: t.color, from: t.from, to },
      `Tactical Jump ${t.from}→${to} queued · End to resolve`,
    );
    if (ok) store.dispatch({ type: "MARK_SPECIAL_USED", square: t.from });
  };

  // Demo AI: queue opponent once per open planning window (timer armed).
  createEffect(() => {
    if (!starChessMode()) return;
    const fn = props.autoQueueOpponent;
    if (!fn) return;
    if (store.state().deadlineAt == null) return;
    if (store.state().timeline.active) return;
    if (!store.state().turnStartChecksApplied) return;
    const s = store.state().liveSnapshot;
    if (s.phase !== "P") return;
    void s.turn;
    void s.placement;
    void (s.queue?.actions.length ?? 0);
    const result = fn(s);
    if (result.snapshot === s) return;
    if (result.spendMinerals) {
      const { color, amount } = result.spendMinerals;
      const before = store.state().economies[color].stored;
      store.dispatch({ type: "SPEND_STORED", color, amount });
      if (store.state().economies[color].stored === before) return;
    }
    store.dispatch({ type: "APPLY_SNAPSHOT", snapshot: result.snapshot });
  });

  /**
   * Keep the planning window armed after SCFEN load / check resolve.
   * Story mounts often load SCFEN after the first onMount armTimer — re-arm
   * whenever we sit in idle planning without a deadline.
   */
  createEffect(() => {
    if (props.armTimer === false || !starChessMode()) return;
    const s = store.state();
    void s.liveSnapshot.turn;
    void s.liveSnapshot.placement;
    if (s.phase !== "planning" && s.phase !== "targeting") return;
    if (s.timeline.active) return;
    if (s.deadlineAt != null) return;
    store.armTimer();
  });

  // Tutorial only: Fog ends on first intent; Specials on move+special (or first).
  let prevQueueReady = false;
  createEffect(() => {
    if (!props.tutorial) return;
    const mode = props.endTurnAfterQueue;
    if (!mode) return;
    const s = store.state();
    const color = s.playerColor;
    const side = (s.liveSnapshot.queue?.actions ?? []).filter((a) => a.color === color);
    const planning = s.phase === "planning" || s.phase === "targeting";
    if (!planning || s.timeline.active) {
      prevQueueReady = false;
      return;
    }
    // Wait for promotion / targeting modal to commit before End.
    if (s.pendingPromotion || s.targeting) {
      return;
    }
    const ready =
      mode === "first"
        ? side.length >= 1
        : side.some((a) => a.timing === "C") && side.some((a) => a.timing !== "C");
    const shouldEnd = ready && !prevQueueReady;
    prevQueueReady = ready;
    if (shouldEnd) store.submitTurn("end");
  });

  createEffect(() => {
    void snap().placement;
    void spawnPhase();
    void store.state().targeting;
    requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
  });

  onMount(() => {
    if (props.tutorial) setCapabilities(TUTORIAL_CAPABILITIES);
    const onKey = (e: KeyboardEvent) => {
      if (store.state().phase !== "gameOver") return;
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
    const s = store.state();
    const settled = s.settledSnapshots[s.reviewIndex];
    return Math.max(1, settled?.turn ?? snap().turn);
  };

  const reviewBusy = () =>
    store.state().timeline.active ||
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
            backDisabled={reviewBusy() || store.state().reviewIndex <= 0}
            forwardDisabled={
              reviewBusy() ||
              store.state().reviewIndex >= store.state().settledSnapshots.length - 1
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
                  snapshot={displayedSnapshot(store.state())}
                />
              </Show>
              <Show when={showBlackResources()}>
                <ResourceBar
                  class={styles.topResourceBar}
                  color="b"
                  snapshot={displayedSnapshot(store.state())}
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
      {/* Hidden king-lives probe for tests / demos */}
      <Show when={starChessMode()}>
        <span
          data-testid="king-lives"
          data-w={snap().kingLives.w}
          data-b={snap().kingLives.b}
          hidden
        />
      </Show>

      <Show
        when={props.header != null || props.tutorial}
        fallback={
          <Screen.SidebarInset class={styles.topPane}>
            <Show
              when={props.onExitToMenu}
              fallback={<div class={styles.topChrome} data-testid="nerd-board-chrome">{topChrome()}</div>}
            >
              {/* Dynamic: ‹ Back (4rem) · resources · turn — gas is bottom-right. */}
              <Show when={starChessMode() && !ended() && dynamicMobile()}>
                <MobileBanner
                  onBack={requestLeave}
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
              {/* Tall / desktop live chrome — hidden on dynamic while the banner owns HUD. */}
              <div classList={{ [styles.dynamicHide]: starChessMode() && !ended() && dynamicMobile() }}>
                <ScreenBackNav onBack={requestLeave} data-testid="live-back">
                  <Show when={props.matchTitle}>
                    <div class={styles.matchTitle} data-testid="live-match-title">
                      <Label variant="title" class={styles.matchupLine}>
                        {props.matchTitle}
                      </Label>
                    </div>
                  </Show>
                  <div class={styles.topChrome} data-testid="nerd-board-chrome">
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
            {/* CoachScreen: desktop header owns the avatar. */}
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
            {props.guideBubble}
          </div>
        </Screen.Header>
      </Show>

      <Screen.BoardArea>
        <Screen.BoardColumn>
          <Show when={props.tutorial}>
            {/* CoachScreen tall-mobile hero — same header slot as desktop. */}
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
          <div
            class={styles.boardHost}
            data-testid="nerd-play-layout"
            ref={(el) => (boardHost = el)}
          >
            <LiveStarChessBoard
              fog={ended() ? undefined : fogOfWar()}
              visionMode="player"
              variant={variant()}
              pieceSet={props.pieceSet}
              hintSquares={props.hintSquares}
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
                          const kind = store.state().targeting?.kind;
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
          </div>
        </Screen.BoardColumn>
        <BoardSideRail
          controlsVisible={starChessMode() && turnInSidebar() && !turnHidden()}
          onHome={props.onExitToMenu}
          controls={
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
                  backDisabled: reviewBusy() || store.state().reviewIndex <= 0,
                  forwardDisabled:
                    reviewBusy() ||
                    store.state().reviewIndex >= store.state().settledSnapshots.length - 1,
                }}
              />
            </Show>
          }
        />
      </Screen.BoardArea>

      <Screen.Footer>
        <div class={styles.footerStack}>
          <Show when={props.footerExtra}>{props.footerExtra}</Show>
          {/* Tall / desktop gas — in-flow footer. Dynamic uses Portaled corner dock. */}
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
            data-testid="nerd-gas-deploy"
          >
            <Show when={starChessMode() && !ended() && !props.hideGas}>
              <GasDeploy
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
          <Show when={!props.tutorial}>
            <div
              class={styles.statusLine}
              data-idle-plan={
                !outcomeLabel(store.state()) && store.state().statusText === "Plan your turn"
                  ? "true"
                  : "false"
              }
            >
              <Show
                when={starChessMode()}
                fallback={<p class={styles.placeholder}>Nerd mode is awakening…</p>}
              >
                <Show
                  when={outcomeLabel(store.state())}
                  fallback={<p class={styles.placeholder}>{store.state().statusText}</p>}
                >
                  {(label) => <p class={styles.placeholder}>{label()}</p>}
                </Show>
              </Show>
            </div>
          </Show>
        </div>
      </Screen.Footer>
      {/* Dynamic only: gas bottom-right via Portal (outside Screen overflow). */}
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
            data-testid="nerd-gas-deploy-dynamic"
            style={{
              display: "block",
              position: "fixed",
              bottom: "0.75rem",
              right: "0.75rem",
              top: "auto",
              "z-index": "70",
            }}
          >
            <GasDeploy
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
