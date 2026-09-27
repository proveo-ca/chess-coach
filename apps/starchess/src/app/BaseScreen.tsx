// SPEC: _spec/apps/chess/responsiveness/rules.md, _spec/apps/starchess/screens.puml, _spec/apps/starchess/architecture/screen-entities.puml, _spec/apps/starchess/architecture/base-screen.puml, _spec/apps/starchess/core/board/planning-projection.puml, _spec/apps/starchess/core/engine-boundary.puml, _spec/apps/starchess/navigation-chrome.md, _spec/apps/starchess/architecture/reactivity/app-screens.md
import {
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";
import {
  For,
  Show,
  batch,
  children,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  untrack,
} from "solid-js";
import type { Component, JSX, ParentComponent } from "solid-js";
import { Portal } from "solid-js/web";

import { afterPaint } from "~/adapters/timers";
import { viewerColor } from "~/app/matchEconomy";
import { useMatchStore } from "~/ports/matchStore";
import { outcomeLabel, readDisplayedSnapshot } from "~/app/selectors";
import styles from "~/app/BaseScreen.module.css";
import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { StarChessMobileBanner as MobileBanner } from "@chess-coach/ui-web/atoms/StarChessMobileBanner";
import { StarChessMobileSubBanner as MobileSubBanner } from "@chess-coach/ui-web/atoms/StarChessMobileSubBanner";
import { ExitGameConfirm } from "~/components/features/ExitGameConfirm";
import { TurnBonusBubble } from "~/components/features/TurnBonusBubble";
import { TutorialHudLabels } from "~/components/features/TutorialHudLabels";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { DYNAMIC_MOBILE_MQ, MOBILE_MQ } from "~/utils/breakpoints";
import { Label } from "@chess-coach/ui-web/primitives/Label";
import { PromotionModal } from "~/components/features/PromotionModal";
import { Screen } from "@chess-coach/ui-web/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { squareBoxStyle, findBoardGrid } from "~/presentation/animations/boardGeom";
import { LiveBoardBinding } from "~/presentation/board/components/LiveBoardBinding";
import { tankModeForSieged } from "~/presentation/board/tankMode";
import { GasRack } from "~/presentation/hud/components/GasRack";
import { usePieceSpecialArm } from "~/presentation/specials/hooks/usePieceSpecialArm";
import { DeployModal } from "~/presentation/hud/components/DeployModal";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import { MatchBoardHost } from "~/presentation/hud/components/MatchBoardHost";
import { ResourceBar } from "~/presentation/hud/components/ResourceBar";
import { ReviewTurnNav } from "@chess-coach/ui-web/atoms/ReviewTurnNav";
import { TurnBar } from "~/presentation/hud/components/TurnBar";
import { TurnBarSidebar } from "~/presentation/hud/components/TurnBarSidebar";
import { specialTimingFor, tryQueue } from "~/presentation/specials/queue";
import { createCCDeploy } from "~/presentation/specials/arms/CCDeploy";
import { marineGasArm } from "~/presentation/specials/arms/marineGas";
import { tankSiegeArm } from "~/presentation/specials/arms/tankSiege";
import { hoverbikeMineArm } from "~/presentation/specials/arms/hoverbikeMine";
import { mechaCharonArm } from "~/presentation/specials/arms/mechaCharon";
import { shipJumpArm } from "~/presentation/specials/arms/shipJump";
import { resetReviewVisionFilter, reviewVisionFilter } from "~/store/reviewVisionStore";
import type { BoardSkin, PieceSet } from "~/types/board";
import type { PromotionPiece } from "~/types/chess";
import type { Cancel } from "~/types/ports";
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
  autoQueueOpponent?: (snap: ScFenSnapshot) => AutoQueueOpponentResult;
  onExitToMenu?: () => void;
  matchTitle?: string;
  bannerTitle?: string;
  turnChrome?: "bar" | "sidebar" | "none";
  hideResources?: boolean;
  hudResources?: boolean;
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
  hintAlertSquares?: readonly Square[];
  hintGasSquares?: readonly Square[];
  hintArrows?: readonly TutorialBoardArrow[];
};

type OverlayBox = { top: number; left: number; width: number; height: number };

const NO_SQUARES: readonly Square[] = [];

const Slot: Component<{
  content: JSX.Element;
  fallback?: JSX.Element;
  wrap?: (content: JSX.Element) => JSX.Element;
}> = (props) => {
  const resolved = children(() => props.content);
  return (
    <Show when={resolved.toArray().length > 0} fallback={props.fallback}>
      {props.wrap ? props.wrap(resolved()) : resolved()}
    </Show>
  );
};

/** Keeps live HUD in the layout after the match ends: hidden and inert, never unmounted. */
const HudHold: ParentComponent<{ held: boolean }> = (props) => (
  <div
    class={styles.hudHold}
    data-hud-held={props.held ? "" : undefined}
    bool:inert={props.held}
    aria-hidden={props.held ? "true" : undefined}
  >
    {props.children}
  </div>
);

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

  const [overlayBox, setOverlayBox] = createSignal<OverlayBox | null>(null);
  const [exitOpen, setExitOpen] = createSignal(false);
  const dynamicMobile = useMediaQuery(DYNAMIC_MOBILE_MQ);
  const mobileViewport = useMediaQuery(MOBILE_MQ);
  let boardHost: HTMLDivElement | undefined;

  /**
   * Coach-header shell (lesson chrome: avatar band + guide bubble) instead of
   * the `/single` top pane. The final lesson (`fullMatchHud`) opts back out.
   * Memoized, `tutorial` first: `props.header` is a JSX getter, so each read
   * renders a fresh header — read from a click handler (the banner's `onBack`)
   * that runs outside the Route and `ScreenBackNav`'s `useNavigate` throws.
   */
  const coachHeader = createMemo(
    () => (props.tutorial || props.header != null) && !props.fullMatchHud,
  );

  /** Tall/narrow mobile loses the rail — TurnBar moves to the top chrome,
      compact under the resource bar (single End instance, never doubled).
      The footer keeps its own copy for the coach-header branch, which never
      renders topChrome — the two branches are mutually exclusive.
      A lesson keeps the banner through game over: the coach header's in-flow
      `‹ Back` is hidden only while a banner is mounted, so dropping it on a
      lost lesson resurfaces that nav. */
  const bannerOwnsChrome = () =>
    starChessMode() &&
    mobileViewport() &&
    (coachHeader() || (!ended() && !!props.onExitToMenu));

  const showTopTurnBar = () =>
    starChessMode() &&
    !turnHidden() &&
    !ended() &&
    (!turnInSidebar() || (mobileViewport() && !dynamicMobile()));

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

  // Command Center deploy flow lives in `presentation/specials/arms/CCDeploy.ts`.
  // `syncOverlay` is a hoisted function declaration below, so the open
  // callback can bind it even though the hook is created here (memos evaluate
  // eagerly and must see a ready hook).
  let cancelOverlaySync: Cancel = () => {};
  const syncOverlayAfterPaint = () => {
    cancelOverlaySync();
    cancelOverlaySync = afterPaint(syncOverlay);
  };
  onCleanup(() => cancelOverlaySync());
  const afterOpen = syncOverlayAfterPaint;
  const ccd = createCCDeploy(store, snap, { onAfterOpen: afterOpen });
  const spawnPhase = ccd.spawnPhase;
  const spawnAdjacent = ccd.spawnAdjacent;

  const specialTargetSquares = createMemo((): readonly Square[] => {
    const t = store.shell().targeting;
    if (!t) return NO_SQUARES;
    if (t.kind === "charonMissiles" || t.kind === "tacticalJump") return t.targets;
    return NO_SQUARES;
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

  const resolvePromotion = (piece: PromotionPiece) =>
    batch(() => resolvePromotionNow(piece));
  const resolvePromotionNow = (piece: PromotionPiece) => {
    const pending = store.shell().pendingPromotion;
    if (!pending) return;
    store.dispatch({ type: "CLEAR_PENDING_PROMOTION" });
    if (pending.via === "gas") {
      store.dispatch({
        type: "QUEUE_ACTION",
        action: {
          timing: "B",
          kind: "stimStep",
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

  function syncOverlay() {
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
  }

  const { onGasDeploy } = usePieceSpecialArm({
    k: () => ccd.openDeployModal(),
    r: (ctx) => tankSiegeArm(store, snap(), ctx),
    n: (ctx) => hoverbikeMineArm(store, snap(), ctx),
    p: (ctx) => marineGasArm(store, snap(), ctx),
    b: (ctx) =>
      mechaCharonArm(store, snap(), ctx, {
        resetSpawn: ccd.resetSpawn,
        onAfterOpen: afterOpen,
      }),
    q: (ctx) =>
      shipJumpArm(store, snap(), ctx, {
        resetSpawn: ccd.resetSpawn,
        onAfterOpen: afterOpen,
        tankModeFor: tankModeForSieged(store.shell().siegedTanks),
      }),
  });

  const onSelectSpawnUnit = ccd.onSelectSpawnUnit;
  const onCancelSpawn = ccd.onCancelSpawn;
  const deploySpawnAt = ccd.deploySpawnAt;

  const commitSpecialTarget = (sq: Square) =>
    batch(() => {
      const kind = store.shell().targeting?.kind;
      if (kind === "charonMissiles") commitCharonMissiles(sq);
      else if (kind === "tacticalJump") commitTacticalJump(sq);
    });

  const cancelArmed = () =>
    batch(() => {
      onCancelSpawn();
      store.dispatch({
        type: "QUEUE_REJECT",
        message: "Cancelled — canister returned",
      });
    });

  const commitCharonMissiles = (to: Square) => {
    const t = store.shell().targeting;
    if (!t || t.kind !== "charonMissiles" || !t.targets.includes(to)) return;
    const timing = specialTimingFor(snap().queue, t.color);
    const ok = tryQueue(
      store,
      { timing, kind: "charonMissiles", color: t.color, from: t.from, to },
      `Charon Booster Missiles ${t.from}→${to} queued · End to fire`,
    );
    if (ok) store.dispatch({ type: "MARK_SPECIAL_USED", square: t.from });
  };

  const commitTacticalJump = (to: Square) => {
    const t = store.shell().targeting;
    if (!t || t.kind !== "tacticalJump" || !t.targets.includes(to)) return;
    const timing = specialTimingFor(snap().queue, t.color);
    const ok = tryQueue(
      store,
      { timing, kind: "tacticalJump", color: t.color, from: t.from, to },
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
    const result = untrack(() => fn(s));
    if (result.snapshot === s) return;
    untrack(() => {
      if (result.spendMinerals) {
        const { color, amount } = result.spendMinerals;
        const before = store.shell().economies[color].stored;
        store.dispatch({ type: "SPEND_STORED", color, amount });
        if (store.shell().economies[color].stored === before) return;
      }
      store.dispatch({ type: "APPLY_SNAPSHOT", snapshot: result.snapshot });
    });
  });



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
    if (shouldEnd) store.submitTurnNextTask();
  });

  createEffect(() => {
    void snap().placement;
    void spawnPhase();
    void store.shell().targeting;
    syncOverlayAfterPaint();
  });

  // A board-click spawn commit (useBoardInput) queues without touching this
  // hook — but absence is racy here (signals flush before the external match
  // store notifies), so sync on positive evidence instead: once our spawn is
  // queued, the pick overlay's job is done.
  createEffect(() => {
    if (ccd.spawnPhase() !== "pick") return;
    const color = viewerColor(store);
    const queued = snap().queue?.actions.some(
      (a) => a.color === color && a.timing !== "C" && a.kind === "deploy",
    );
    if (queued) ccd.resetSpawn();
  });

  onMount(() => {
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
          cancelArmed();
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
      const cancelKick = afterPaint(kick);
      window.addEventListener("resize", syncOverlay);
      onCleanup(() => {
        cancelKick();
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

  /**
   * Live economy: viewer bar only — the adjutant side stays hidden outside
   * review. Dual bars ship on review detail / ended games, never live.
   */
  /**
   * Phones read bar first, TurnBar underneath — in DOM order, so keyboard
   * and screen-reader order match the visual (a CSS `order` swap would lie
   * to both). Desktop keeps TurnBar on top.
   */
  const barFirst = () => mobileViewport() && !dynamicMobile();

  const bannerBack = createMemo(() => (coachHeader() ? props.onExitToMenu : requestLeave));
  const bannerResources = createMemo(() =>
    coachHeader() ? !!props.hudResources : !props.hideResources,
  );
  const coachEmotion = createMemo(() => props.coachEmotion ?? "idle");
  const overlay = createMemo(() => (starChessMode() ? overlayBox() : null));
  const liveHud = createMemo(() => starChessMode() && !ended());
  const boardFog = createMemo(() => (ended() ? undefined : fogOfWar()));
  const dynamicGasDock = createMemo(
    () => !!props.onExitToMenu && liveHud() && !props.hideGas && dynamicMobile(),
  );
  const reviewNav = createMemo(() => {
    if (!ended()) return undefined;
    return {
      turn: reviewTurnNumber(),
      phase: store.reviewPhase(),
      hideDualNav: true,
      onBack: () => store.reviewBack(),
      onForward: () => store.reviewForward(),
      backDisabled: reviewBusy() || store.shell().reviewIndex <= 0,
      forwardDisabled:
        reviewBusy() ||
        store.shell().reviewIndex >= store.shell().settledSnapshots.length - 1,
    };
  });

  const topTurnBar = () => (
    <Show when={showTopTurnBar()}>
      <TurnBar
        compact={turnInSidebar()}
        class={styles.topTurnBar}
        autoStart={false}
        resolveOnEnd={false}
        onEnd={() => store.submitTurn("end")}
      />
    </Show>
  );

  const topResources = () => (
    <Show when={starChessMode() && !props.hideResources}>
      <Show
        when={ended()}
        fallback={<ResourceBar class={styles.topResourceBar} />}
      >
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
                compact
                class={styles.topResourceBar}
                color="w"
                snapshot={readDisplayedSnapshot(store)}
              />
            </Show>
            <Show when={showBlackResources()}>
              <ResourceBar
                compact
                class={styles.topResourceBar}
                color="b"
                snapshot={readDisplayedSnapshot(store)}
              />
            </Show>
          </div>
        </ReviewTurnNav>
      </Show>
    </Show>
  );

  const topChrome = () => (
    <>
      <Show when={barFirst()} fallback={<>{topTurnBar()}{topResources()}</>}>
        {topResources()}{topTurnBar()}
      </Show>
    </>
  );

  return (
    <Screen>
      {/* Names the deploy / promotion tiles and the ResourceBar strips — the
          labelled components stay unaware, see TutorialHudLabels. */}
      <TutorialHudLabels enabled={!!props.tutorial && !props.hudResources} />
      <Show when={starChessMode()}>
        <span
          data-testid="cc-lives"
          data-w={snap().ccLives.w}
          data-b={snap().ccLives.b}
          hidden
        />
      </Show>

      <Show when={bannerOwnsChrome()}>
        <Show
          when={!dynamicMobile()}
          fallback={
            <MobileBanner
              onBack={bannerBack()}
              fill
              center={
                <div class={styles.bannerInline}>
                  <Show when={bannerResources()}>
                    <ResourceBar compact class={`${styles.bannerInlineResources} ${styles.bannerResourceBar}`} />
                  </Show>
                  <Show when={!turnHidden()}>
                    <HudHold held={ended()}>
                      <TurnBar
                        compact
                        class={styles.bannerInlineTurn}
                        autoStart={false}
                        resolveOnEnd={false}
                        onEnd={() => store.submitTurn("end")}
                      />
                    </HudHold>
                  </Show>
                </div>
              }
            />
          }
        >
          <MobileBanner
            onBack={bannerBack()}
            title={coachHeader() && !bannerResources() ? props.bannerTitle : undefined}
            center={
              bannerResources() ? (
                <ResourceBar compact class={styles.bannerResourceBar} />
              ) : undefined
            }
          />
          <MobileSubBanner float={coachHeader()} class={styles.subBannerSplit}>
            <div class={styles.subBannerQueue}>
              <Show when={!turnHidden()}>
                <HudHold held={ended()}>
                  <TurnBar density="queueOnly" />
                </HudHold>
              </Show>
            </div>
            <div class={styles.subBannerMiddle} />
            <div class={styles.subBannerControls}>
              <Show when={!turnHidden()}>
                <HudHold held={ended()}>
                  <TurnBar
                    compact
                    hideQueue
                    autoStart={false}
                    resolveOnEnd={false}
                    onEnd={() => store.submitTurn("end")}
                  />
                </HudHold>
              </Show>
            </div>
          </MobileSubBanner>
        </Show>
      </Show>

      <Show
        when={coachHeader()}
        fallback={
          <Screen.SidebarInset class={styles.topPane}>
            <Slot
              content={props.guideBubble}
              wrap={(bubble) => <div class={styles.hudGuideSlot}>{bubble}</div>}
            />
            <Show
              when={props.onExitToMenu}
              fallback={
                <div class={styles.topNavRow}>
                  {/* No dynamicHide: no MobileBanner replacement here, so the
                      in-flow chrome is the only chrome in the dynamic band. */}
                  <div class={styles.topChrome} data-testid="starchess-board-chrome">{topChrome()}</div>
                </div>
              }
            >
              {/*
                Top section rows: the nav band owns Row 1 (`‹ Back` + title)
                and the chrome stack follows as its own rows below — the
                resource bars never share the nav grid track, so a long name
                or a second bar cannot squeeze `‹ Back` or overflow X.
              */}
              <Show when={!bannerOwnsChrome()}>
                <div class={styles.topNavRow}>
                  <ScreenBackNav onBack={requestLeave} data-testid="live-back">
                    <Show when={props.matchTitle}>
                      <div class={styles.matchTitle} data-testid="live-match-title">
                        <Label variant="title" class={styles.matchupLine}>
                          {props.matchTitle}
                        </Label>
                      </div>
                    </Show>
                  </ScreenBackNav>
                  <div class={styles.topChrome} data-testid="starchess-board-chrome">
                    {topChrome()}
                  </div>
                </div>
              </Show>
            </Show>
          </Screen.SidebarInset>
        }
      >
        <Screen.Header>
          <div class={styles.headerSlot}>
            <div class="desktop-only" data-testid="tutorial-header">
              <Slot
                content={props.header}
                fallback={
                  <CoachAvatar identity="kerrigan" emotion={coachEmotion()} />
                }
              />
            </div>
            {/* Mobile coach lives in the chrome track, never in the board
                column — see TutorialReviewHost. */}
            <Show when={props.tutorial && !props.fullMatchHud}>
              <div class="mobile-hero" data-testid="tutorial-mobile-hero">
                <Slot
                  content={props.header}
                  fallback={
                    <CoachAvatar identity="kerrigan" emotion={coachEmotion()} />
                  }
                />
              </div>
            </Show>
            {props.guideBubble}
            <Show when={props.hudResources && starChessMode() && !bannerOwnsChrome()}>
              <div class={styles.headerResources} data-testid="tutorial-hud-resources">
                <ResourceBar class={styles.topResourceBar} />
              </div>
            </Show>
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
              fog={boardFog()}
              visionMode="player"
              variant={variant()}
              pieceSet={props.pieceSet}
              hintSquares={props.hintSquares}
              hintAlertSquares={props.hintAlertSquares}
              hintGasSquares={props.hintGasSquares}
              hintArrows={props.hintArrows}
            />
            <Show when={overlay()}>
              {(box) => (
                <div
                  class={styles.boardOverlay}
                  data-special="cc-spawn"
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
                        onClick={() => commitSpecialTarget(sq)}
                      />
                    )}
                  </For>
                </div>
              )}
            </Show>
            <Show when={liveHud()}>
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
              <TurnBarSidebar review={reviewNav()} />
            </Show>
          </Show>
        </MatchBoardHost.Rail>
      </MatchBoardHost>

      <Screen.Footer>
        <div class={styles.footerStack}>
          {props.footerExtra}
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
            <Show when={starChessMode() && !props.hideGas}>
              <HudHold held={ended()}>
                <GasRack onDeploy={onGasDeploy} onCancel={cancelArmed} />
              </HudHold>
            </Show>
          </div>
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
      <Show when={dynamicGasDock()}>
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
            <GasRack onDeploy={onGasDeploy} onCancel={cancelArmed} />
          </div>
        </Portal>
      </Show>
      <ExitGameConfirm
        open={exitOpen()}
        onClose={() => setExitOpen(false)}
        onConfirm={confirmLeave}
      />
      <TurnBonusBubble />
    </Screen>
  );
};
