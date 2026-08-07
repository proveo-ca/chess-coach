/**
 * Live StarChess screen — Command Column HUD (Resource → Turn → Board|Sidebar → Gas).
 * Board variants: eclipse | butter | vermeer (default eclipse).
 * // SPEC: _spec/apps/ui/responsiveness/rules.md
 */
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import type { Component } from "solid-js";
import type { Square } from "chess.js";
import {
  UNIT_COST,
  adjacentSquares,
  charonTargetQueenFromPlacement,
  findKing,
  pawnSingleTarget,
  placementToMap,
  spawnKingAnchor,
  type ScFenSnapshot,
  type SpawnPiece,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { useMatchStore } from "~/app/MatchStoreContext";
import { Sidebar } from "~/components/features/Sidebar";
import { PromotionModal } from "~/components/primitives/PromotionModal";
import { Screen } from "~/components/primitives/Screen";
import { squareBoxStyle, findBoardGrid } from "~/presentation/animations/boardGeom";
import { LiveStarChessBoard } from "~/presentation/board/LiveStarChessBoard";
import { GasDeploy } from "~/presentation/features/GasDeploy";
import { DeployModal } from "~/presentation/hud/DeployModal";
import { ResourceBar } from "~/presentation/hud/ResourceBar";
import { TurnBar } from "~/presentation/hud/TurnBar";
import { TurnBarSidebar } from "~/presentation/hud/TurnBarSidebar";
import { usePieceSpecialArm } from "~/presentation/hooks/usePieceSpecialArm";
import type { BoardVariant } from "~/types/board";
import type { PromotionPiece } from "~/types/chess";
import { tacticalJumpTargets } from "~/presentation/specials/queenTacticalJump";
import { storedMaterial, viewerColor } from "~/app/matchEconomy";
import { displayedSnapshot, outcomeLabel } from "~/app/selectors";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import styles from "~/app/StarChessScreen.module.css";

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
  /** eclipse | butter | vermeer — default eclipse. */
  boardVariant?: BoardVariant;
  /** Auto-arm planning timer on mount. */
  armTimer?: boolean;
  /**
   * Story / demo AI: when set, queues the opponent’s next action each planning
   * turn (e.g. the King Hunt live `adjutant` defensive commander).
   */
  autoQueueOpponent?: (snap: ScFenSnapshot) => AutoQueueOpponentResult;
  /** Sidebar Home — return to StarChess menu (SPA) instead of leaving the app. */
  onExitToMenu?: () => void;
  /**
   * Experimental HUD variation: `"sidebar"` moves turn chrome into a vertical
   * rail beside the board (`TurnBarSidebar`). Default `"bar"` keeps `TurnBar`
   * above the board. Does not alter `TurnBar` itself.
   */
  turnChrome?: "bar" | "sidebar";
};

type OverlayBox = { top: number; left: number; width: number; height: number };

/** B if no classical yet this turn for the side; else F (stack order). */
const specialTimingFor = (
  queue: ScFenSnapshot["queue"],
  color: StarChessColor,
): "B" | "F" => {
  const side = queue?.actions.filter((a) => a.color === color) ?? [];
  return side.some((a) => a.timing === "C") ? "F" : "B";
};

export const StarChessScreen: Component<StarChessScreenProps> = (props) => {
  const store = useMatchStore();
  const variant = (): BoardVariant => props.boardVariant ?? "eclipse";
  const starChessMode = () => props.starChessMode ?? true;
  const fogOfWar = () => props.fog ?? starChessMode();
  const ended = () => store.state().phase === "gameOver";
  const snap = () => store.state().liveSnapshot;
  const turnChrome = () => props.turnChrome ?? "bar";
  const turnInSidebar = () => turnChrome() === "sidebar";

  const [spawnUnit, setSpawnUnit] = createSignal<SpawnPiece | null>(null);
  const [spawnPhase, setSpawnPhase] = createSignal<"idle" | "modal" | "pick">("idle");
  const [overlayBox, setOverlayBox] = createSignal<OverlayBox | null>(null);
  let boardHost: HTMLDivElement | undefined;

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

  const tryQueue = (
    action: {
      timing: "B" | "F" | "C";
      kind: string;
      color: StarChessColor;
      from: Square;
      to?: Square;
      unit?: SpawnPiece;
    },
    okMsg: string,
  ): boolean => {
    const beforeSnap = store.state().liveSnapshot;
    store.dispatch({
      type: "QUEUE_ACTION",
      action: action as never,
    });
    const after = store.state();
    if (after.liveSnapshot === beforeSnap) return false;
    store.dispatch({ type: "QUEUE_REJECT", message: okMsg });
    return true;
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
        { timing, kind: "knightMine", color, from: ctx.square, to: ctx.square },
        `Spider Mine queued on ${ctx.square} · End to resolve`,
      )
        ? "armed"
        : false;
    },
    p: (ctx) => {
      const color = viewerColor(store);
      const timing = specialTimingFor(snap().queue, color);
      const to = pawnSingleTarget(ctx.square, color);
      if (!to) {
        store.dispatch({
          type: "QUEUE_REJECT",
          message: "Pawn cannot step forward off the board",
        });
        return false;
      }
      const lastRank = color === "w" ? "8" : "1";
      if (to[1] === lastRank) {
        store.dispatch({
          type: "QUEUE_REJECT",
          message: "Last-rank advance is classical — click the promotion square",
        });
        return false;
      }
      return tryQueue(
        { timing, kind: "pawnDouble", color, from: ctx.square, to },
        `Gas step ${ctx.square}→${to} queued · End to resolve`,
      )
        ? "armed"
        : false;
    },
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

  createEffect(() => {
    void snap().placement;
    void spawnPhase();
    void store.state().targeting;
    requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
  });

  onMount(() => {
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

  onCleanup(() => store.cancelEffects());

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

      <Screen.SidebarInset class={styles.topPane}>
        <div class={styles.topChrome} data-testid="nerd-board-chrome">
          <Show when={starChessMode() && !turnInSidebar() && !ended()}>
            <TurnBar
              autoStart={false}
              resolveOnEnd={false}
              onEnd={() => store.submitTurn("end")}
            />
          </Show>
          <Show when={starChessMode()}>
            <Show
              when={ended()}
              fallback={<ResourceBar />}
            >
              <div
                class={styles.dualResources}
                role="group"
                aria-label="Both sides resources"
              >
                <ResourceBar
                  color="w"
                  snapshot={displayedSnapshot(store.state())}
                />
                <ResourceBar
                  color="b"
                  snapshot={displayedSnapshot(store.state())}
                />
              </div>
            </Show>
          </Show>
        </div>
      </Screen.SidebarInset>

      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div
            class={styles.boardHost}
            data-testid="nerd-play-layout"
            ref={(el) => (boardHost = el)}
          >
            <LiveStarChessBoard fog={fogOfWar()} variant={variant()} />
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
        <div class={styles.sideRail} data-testid="starchess-side-rail">
          <Show when={starChessMode() && turnInSidebar()}>
            <Show
              when={ended()}
              fallback={
                <>
                  <TurnBarSidebar
                    autoStart={false}
                    resolveOnEnd={false}
                    onEnd={() => store.submitTurn("end")}
                  />
                  <hr class={styles.sideRailDivider} />
                </>
              }
            >
              <TurnBarSidebar
                review={{
                  turn: reviewTurnNumber(),
                  phase: store.reviewPhase(),
                  onBack: () => store.reviewBack(),
                  onForward: () => store.reviewForward(),
                  backDisabled: reviewBusy() || store.state().reviewIndex <= 0,
                  forwardDisabled:
                    reviewBusy() ||
                    store.state().reviewIndex >=
                      store.state().settledSnapshots.length - 1,
                }}
              />
              <hr class={styles.sideRailDivider} />
            </Show>
          </Show>
          <Sidebar onHome={props.onExitToMenu} />
        </div>
      </Screen.BoardArea>

      <Screen.Footer>
        <div class={styles.footerStack}>
          <div class={styles.gasDock} data-testid="nerd-gas-deploy">
            <Show when={starChessMode() && !ended()}>
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
          <div class={styles.statusLine}>
            <Show
              when={starChessMode()}
              fallback={<p class={styles.placeholder}>Nerd mode is awakening…</p>}
            >
              <Show
                when={outcomeLabel(store.state())}
                fallback={
                  <p class={styles.placeholder}>{store.state().statusText}</p>
                }
              >
                {(label) => <p class={styles.placeholder}>{label()}</p>}
              </Show>
            </Show>
          </div>
        </div>
      </Screen.Footer>
    </Screen>
  );
};
