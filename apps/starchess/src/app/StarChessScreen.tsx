/**
 * Live StarChess screen — Screen top/middle/bottom grid matches NerdScreen.
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
  findKing,
  pawnSingleTarget,
  placementToMap,
  type ScFenSnapshot,
  type SpawnPiece,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { useMatchStore } from "~/app/MatchStoreContext";
import { Button } from "~/components/primitives/Button";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import { Label } from "~/components/primitives/Label";
import { Screen } from "~/components/primitives/Screen";
import { squareBoxStyle, findBoardGrid } from "~/presentation/animations/boardGeom";
import { StarChessBoard, type BoardVariant } from "~/presentation/board/StarChessBoard";
import { GasDeploy } from "~/presentation/features/GasDeploy";
import { DeployModal } from "~/presentation/hud/DeployModal";
import { ResourceBar } from "~/presentation/hud/ResourceBar";
import { TurnBar } from "~/presentation/hud/TurnBar";
import { usePieceSpecialArm } from "~/presentation/hooks/usePieceSpecialArm";
import { storedMaterial, viewerColor } from "~/app/matchEconomy";
import { outcomeLabel } from "~/app/selectors";
import styles from "~/app/NerdScreen.module.css";

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

  const [spawnUnit, setSpawnUnit] = createSignal<SpawnPiece | null>(null);
  const [spawnPhase, setSpawnPhase] = createSignal<"idle" | "modal" | "pick">("idle");
  const [overlayBox, setOverlayBox] = createSignal<OverlayBox | null>(null);
  let boardHost: HTMLDivElement | undefined;

  const activeKingSq = createMemo((): Square | null => {
    const s = snap();
    return findKing(placementToMap(s.placement), viewerColor(store));
  });

  const spawnAdjacent = createMemo(() => {
    const king = activeKingSq();
    if (!king || spawnPhase() !== "pick") return [] as Square[];
    const occupied = new Set(placementToMap(snap().placement).keys());
    return adjacentSquares(king, occupied);
  });

  const modalPending = createMemo(() => {
    if (spawnPhase() !== "modal") return null;
    return { color: viewerColor(store) };
  });

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
      return false; // mark used only after spawn commits
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
      return tryQueue(
        { timing, kind: "pawnDouble", color, from: ctx.square, to },
        `Gas step ${ctx.square}→${to} queued · End to resolve`,
      )
        ? "armed"
        : false;
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
      const max = store.state().settledSnapshots.length - 1;
      const i = store.state().reviewIndex;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (i > 0) store.dispatch({ type: "REVIEW_SEEK", index: i - 1 });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (i < max) store.dispatch({ type: "REVIEW_SEEK", index: i + 1 });
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

  const reviewLabel = () => {
    const s = store.state();
    const max = Math.max(0, s.settledSnapshots.length - 1);
    const i = s.reviewIndex;
    if (i <= 0) return "Start";
    if (i >= max) return "Final";
    return `Turn ${i} of ${max}`;
  };

  return (
    <Screen>
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class={styles.header}>
            <Button href="/">Back</Button>
            <div>
              <Label variant="title">StarChess</Label>
              <p class={styles.matchup}>Nerd vs Selena</p>
            </div>
          </div>
          <Show when={starChessMode()}>
            <div class={styles.topChrome} data-testid="nerd-board-chrome">
              <span
                data-testid="king-lives"
                data-w={snap().kingLives.w}
                data-b={snap().kingLives.b}
                hidden
              />
              <Show
                when={!ended()}
                fallback={
                  <DualNavButton
                    inverted
                    inline
                    label={reviewLabel()}
                    onBack={() =>
                      store.dispatch({
                        type: "REVIEW_SEEK",
                        index: store.state().reviewIndex - 1,
                      })
                    }
                    onForward={() =>
                      store.dispatch({
                        type: "REVIEW_SEEK",
                        index: store.state().reviewIndex + 1,
                      })
                    }
                    backDisabled={store.state().reviewIndex <= 0}
                    forwardDisabled={
                      store.state().reviewIndex >=
                      store.state().settledSnapshots.length - 1
                    }
                  />
                }
              >
                <ResourceBar />
                <TurnBar
                  autoStart={false}
                  resolveOnEnd={false}
                  onEnd={() => store.submitTurn("end")}
                />
              </Show>
            </div>
          </Show>
          <div class={styles.boardHost} ref={(el) => (boardHost = el)}>
            <StarChessBoard fog={fogOfWar()} variant={variant()} />
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
                </div>
              )}
            </Show>
            <Show when={starChessMode()}>
              <DeployModal
                pending={modalPending()}
                onSelect={onSelectSpawnUnit}
                onCancel={onCancelSpawn}
              />
            </Show>
          </div>
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
        </Screen.BoardColumn>
      </Screen.BoardArea>
      <Show when={starChessMode() && !ended()}>
        <Screen.Footer>
          <div class={styles.gasFooter} data-testid="nerd-gas-deploy">
            <GasDeploy
              onDeploy={onGasDeploy}
              onCancel={() =>
                store.dispatch({
                  type: "QUEUE_REJECT",
                  message: "Cancelled — canister returned",
                })
              }
            />
          </div>
        </Screen.Footer>
      </Show>
    </Screen>
  );
};
