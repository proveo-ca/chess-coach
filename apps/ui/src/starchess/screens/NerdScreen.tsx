/**
 * StarChess mode screen — exclusive UI surface for the StarChess engine.
 * // SPEC: _spec/apps/ui/starchess/starchess-mode.puml, _spec/apps/ui/starchess/index.puml
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
import type { RouteSectionProps } from "@solidjs/router";
import { Chess, type Square } from "chess.js";

import { findBoardGrid, squareBoxStyle } from "~/starchess/animations/boardGeom";
import { findKing, placementToMap } from "~/starchess/board";
import { DEPLOY_MS, MINE_DEPLOY_MS, UNIT_COST } from "~/starchess/constants";
import { endScTurn } from "~/starchess/endScTurn";
import { GasDeploy } from "~/starchess/features/GasDeploy";
import { usePieceSpecialArm } from "~/starchess/hooks/usePieceSpecialArm";
import { useStarChessCombat } from "~/starchess/hooks/useStarChessCombat";
import { intentOverlaysFromQueue } from "~/starchess/intentOverlays";
import { DeployModal } from "~/starchess/primitives/DeployModal";
import { ResourceBar } from "~/starchess/primitives/ResourceBar";
import { TurnBar } from "~/starchess/primitives/TurnBar";
import {
  appendSettledTurn,
  canGoBack,
  canGoForward,
  clearMatchHistory,
  displayedSnapshot,
  gameEnded,
  goHistoryBack,
  goHistoryForward,
  resetMatchHistory,
  reviewLabel,
} from "~/starchess/matchHistory";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import { AddScActionError } from "~/starchess/scActions";
import { scOutcome } from "~/starchess/scOutcome";
import { classicFenFromSc, parseScFen, snapFromPlacement, toClassicFen } from "~/starchess/scfen";
import { adjacentSquares } from "~/starchess/specials/adjacent";
import { StarChessBoard } from "~/starchess/StarChessBoard";
import {
  clearSiegedRooks,
  clearTurnDeadline,
  currentQueue,
  kingLives,
  markSpecialUsed,
  planningSnapshot,
  queueScAction,
  refundStored,
  resetStarChessEconomy,
  setPlanningSnapshot,
  setRookMode,
  setSiegedRooks,
  spendStored,
  startPlanningTimer,
  storedMaterial,
  turnDeadlineAt,
} from "~/starchess/starChessStore";
import { pawnSingleTarget } from "~/starchess/specials/pawnDouble";
import { Button } from "~/components/primitives/Button";
import { Label } from "~/components/primitives/Label";
import { Screen } from "~/components/primitives/Screen";
import { NERD_STARTING_FEN } from "~/starchess/nerdMode";
import styles from "~/starchess/screens/NerdScreen.module.css";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import { setCapabilities } from "~/store/capabilitiesStore";
import { loadFen } from "~/store/gameStore";
import { activePlayerColor, playerPieceSet, setActivePlayerColor, setPlayerIdentity } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";
import type {
  PieceColor,
  RookMode,
  ScFenSnapshot,
  ScMine,
  SpawnPiece,
} from "~/starchess/types";
import type { NerdBoardVariant } from "~/starchess/types";

const minesKey = (mines: readonly ScMine[] | undefined) =>
  (mines ?? [])
    .map((m) => `${m.color}:${m.at}`)
    .sort()
    .join("|");

type OverlayBox = { top: number; left: number; width: number; height: number };

export type AutoQueueOpponentResult = {
  snapshot: ScFenSnapshot;
  spendMinerals?: { color: PieceColor; amount: number };
};

type NerdScreenProps = Partial<RouteSectionProps> & {
  boardVariant?: NerdBoardVariant;
  /** Classic FEN seed (used when `startingScfen` is omitted). */
  startingFen?: string;
  /**
   * Full SCFEN seed — placement, lives, gas, mines, siege (`S:`).
   * When set, wins over {@link startingFen}.
   */
  startingScfen?: string;
  /**
   * StarChess ruleset (default true on `/starchess`).
   * When on, fog of war is **always** enabled — not overridable.
   * Maps / terrain gallery sets `false` to preview boards without fog.
   */
  starChessMode?: boolean;
  /**
   * Storybook seed: force every rook on the starting FEN into this mode
   * (writes {@link setRookMode} / clears siege state).
   * Ignored when `startingScfen` already carries `S:`.
   */
  rookMode?: RookMode;
  /** Initial stored minerals per side (default 12). */
  startingStoredMaterial?: number;
  /**
   * Story / demo AI: when set, queues the opponent’s next action each planning
   * turn (e.g. the King Hunt live `adjutant` defensive commander).
   * A returned `spendMinerals` is debited from the host bank before the snapshot
   * is applied; the whole result is discarded when the bank cannot cover it.
   */
  autoQueueOpponent?: (snap: ScFenSnapshot) => AutoQueueOpponentResult;
};

/** B if no classical yet this turn for the side; else F (stack order). */
const specialTimingFor = (color: "w" | "b"): "B" | "F" => {
  const side = currentQueue().filter((a) => a.color === color);
  return side.some((a) => a.timing === "C") ? "F" : "B";
};

export const NerdScreen: Component<NerdScreenProps> = (props) => {
  const starChessMode = () => props.starChessMode ?? true;
  /** Non-negotiable: StarChess / Nerd gameplay always has cumulative fog. */
  const fogOfWar = () => starChessMode();
  const [status, setStatus] = createSignal("Plan a special and/or move · End to submit");
  const combat = useStarChessCombat();
  let lastQueuedKey: string | null = null;
  let seedKey: string | null = null;
  /** Blocks End/timeout re-entry while combat (or post-B deploy hold) is playing. */
  let resolving = false;

  const [spawnUnit, setSpawnUnit] = createSignal<SpawnPiece | null>(null);
  const [spawnPhase, setSpawnPhase] = createSignal<"idle" | "modal" | "pick">("idle");
  const [overlayBox, setOverlayBox] = createSignal<OverlayBox | null>(null);
  let boardHost: HTMLDivElement | undefined;

  const activeKingSq = createMemo((): Square | null => {
    const snap = planningSnapshot();
    if (!snap) return null;
    return findKing(placementToMap(snap.placement), activePlayerColor());
  });

  const spawnAdjacent = createMemo(() => {
    const king = activeKingSq();
    const snap = planningSnapshot();
    if (!king || !snap || spawnPhase() !== "pick") return [] as Square[];
    const occupied = new Set(placementToMap(snap.placement).keys());
    return adjacentSquares(king, occupied);
  });

  const modalPending = createMemo(() => {
    if (spawnPhase() !== "modal") return null;
    return { color: activePlayerColor(), pieceSet: playerPieceSet() };
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

  const queueSpecial = (
    action: Parameters<typeof queueScAction>[0],
    okMsg: string,
  ): boolean => {
    try {
      queueScAction(action);
      setStatus(okMsg);
      return true;
    } catch (e) {
      const msg = e instanceof AddScActionError ? e.message : "Could not queue special";
      setStatus(msg);
      return false;
    }
  };

  const { onGasDeploy } = usePieceSpecialArm({
    k: () => {
      if (!activeKingSq()) {
        setStatus("No command center on the board");
        return false;
      }
      setSpawnUnit(null);
      setSpawnPhase("modal");
      setStatus(`Pick a unit to deploy · minerals ${storedMaterial()}`);
      return false; // mark used only after spawn commits
    },
    r: (ctx) => {
      const color = activePlayerColor();
      const timing = specialTimingFor(color);
      return queueSpecial(
        { timing, kind: "rookSiege", color, from: ctx.square },
        `Siege Tank toggle queued on ${ctx.square} · End to resolve`,
      )
        ? "armed"
        : false;
    },
    n: (ctx) => {
      const color = activePlayerColor();
      const timing = specialTimingFor(color);
      return queueSpecial(
        { timing, kind: "knightMine", color, from: ctx.square, to: ctx.square },
        `Spider Mine queued on ${ctx.square} · End to resolve`,
      )
        ? "armed"
        : false;
    },
    p: (ctx) => {
      const color = activePlayerColor();
      const timing = specialTimingFor(color);
      const to = pawnSingleTarget(ctx.square, color);
      if (!to) {
        setStatus("Pawn cannot step forward off the board");
        return false;
      }
      return queueSpecial(
        { timing, kind: "pawnDouble", color, from: ctx.square, to },
        `Gas step ${ctx.square}→${to} queued · End to resolve`,
      )
        ? "armed"
        : false;
    },
  });

  const onSelectSpawnUnit = (piece: SpawnPiece) => {
    const cost = UNIT_COST[piece];
    if (storedMaterial() < cost) {
      setStatus(`Need ${cost} minerals (have ${storedMaterial()})`);
      return;
    }
    setSpawnUnit(piece);
    setSpawnPhase("pick");
    setStatus(`Tap an adjacent empty square to deploy ${piece.toUpperCase()}`);
    requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
  };

  const onCancelSpawn = () => {
    setSpawnPhase("idle");
    setSpawnUnit(null);
    setStatus("Plan a special and/or move · End to submit");
  };

  const deploySpawnAt = (to: Square) => {
    const unit = spawnUnit();
    const from = activeKingSq();
    const color = activePlayerColor();
    if (!unit || !from) return;
    const cost = UNIT_COST[unit];
    if (!spendStored(color, cost)) {
      setStatus(`Need ${cost} minerals (have ${storedMaterial()})`);
      return;
    }
    const timing = specialTimingFor(color);
    const ok = queueSpecial(
      { timing, kind: "spawn", color, from, to, unit },
      `Deploy ${unit.toUpperCase()} → ${to} queued · End to drop`,
    );
    if (!ok) {
      refundStored(color, cost);
      return;
    }
    markSpecialUsed(from);
    setSpawnPhase("idle");
    setSpawnUnit(null);
  };

  onMount(() => {
    setCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    if (starChessMode()) {
      const stored = props.startingStoredMaterial ?? 12;
      // Turn matches SCFEN when present; gas refills to tier (does not bank).
      const turn = props.startingScfen
        ? Math.max(1, parseScFen(props.startingScfen).turn || 1)
        : 1;
      resetStarChessEconomy({
        turn,
        white: { stored, deployed: 1 },
        black: { stored, deployed: 1 },
      });
    }
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
      });
    } else {
      syncOverlay();
      window.addEventListener("resize", syncOverlay);
      onCleanup(() => window.removeEventListener("resize", syncOverlay));
    }
  });

  // Storybook reuses this screen across fog variants — reload when seed / mode changes.
  // E2E / deep-link: `?scfen=` wins over props.startingScfen.
  createEffect(() => {
    const mode = starChessMode();
    let urlScfen: string | undefined;
    try {
      const q = new URLSearchParams(window.location.search).get("scfen");
      if (q) urlScfen = decodeURIComponent(q);
    } catch {
      urlScfen = undefined;
    }
    const scfen = urlScfen ?? props.startingScfen;
    const fen = props.startingFen ?? NERD_STARTING_FEN;
    const key = `${mode}|${scfen ?? fen}|${props.rookMode ?? ""}`;
    if (key === seedKey) return;
    seedKey = key;
    lastQueuedKey = null;
    combat.clear();
    setSpawnPhase("idle");
    setSpawnUnit(null);
    clearSiegedRooks();
    clearMatchHistory();

    if (mode && scfen) {
      const snap = parseScFen(scfen);
      loadFen(classicFenFromSc(snap, "w"));
      setSiegedRooks(snap.siegedRooks ?? []);
      setPlanningSnapshot({
        ...snap,
        queue: snap.queue ?? { actions: [] },
      });
      resetMatchHistory({
        ...snap,
        queue: snap.queue ?? { actions: [] },
      });
      setStatus(
        snap.phase === "O"
          ? "Match over · Review with the arrows"
          : "Plan a special and/or move · End to submit",
      );
      return;
    }

    loadFen(fen);
    if (props.rookMode === "siege") {
      const g = new Chess(fen);
      for (const row of g.board()) {
        for (const cell of row) {
          if (cell?.type === "r") setRookMode(cell.square as Square, "siege");
        }
      }
    }
    if (mode) {
      const placement = fen.trim().split(/\s+/)[0] ?? fen;
      const snap = snapFromPlacement(placement, 1);
      setPlanningSnapshot(snap);
      resetMatchHistory(snap);
      // Do not force siege — fog stories / live play default to tank unless rookMode prop says otherwise.
    }
  });

  createEffect(() => {
    void planningSnapshot()?.placement;
    void spawnPhase();
    requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
  });

  // Demo AI: queue opponent once per open planning window (timer armed).
  // Skip while deadline is null (resolving / combat) so mid-resolve snaps
  // do not get a premature next-ply action.
  createEffect(() => {
    if (!starChessMode()) return;
    const fn = props.autoQueueOpponent;
    if (!fn) return;
    if (turnDeadlineAt() == null) return;
    const snap = planningSnapshot();
    if (!snap || snap.phase !== "P") return;
    void snap.turn;
    void snap.placement;
    void (snap.queue?.actions.length ?? 0);
    const result = fn(snap);
    if (result.snapshot === snap) return;
    if (result.spendMinerals) {
      const { color, amount } = result.spendMinerals;
      if (!spendStored(color, amount)) return;
    }
    setPlanningSnapshot(result.snapshot);
  });

  // Board gestures commit via BoardMoveProvider → queueScAction (sc-moves.puml).
  // Reflect the queued classical on the status line; no moveHistory bridge.
  createEffect(() => {
    if (!starChessMode()) return;
    const snap = planningSnapshot();
    if (!snap || snap.phase !== "P") return;
    const color = activePlayerColor();
    const classical = snap.queue?.actions.find(
      (a) => a.timing === "C" && a.color === color && a.kind === "classical",
    );
    if (!classical || !("to" in classical) || !classical.to) return;
    const key = `${snap.turn}:${classical.from}-${classical.to}:${classical.seq}`;
    if (key === lastQueuedKey) return;
    lastQueuedKey = key;
    setStatus(`Queued ${classical.from}→${classical.to} · End to resolve`);
  });

  const submitPlan = (reason: "end" | "timeout") => {
    if (resolving || gameEnded()) return;
    const before = planningSnapshot();
    if (!before || before.phase !== "P") {
      setStatus(reason === "timeout" ? "Turn locked — time up" : "Turn submitted");
      return;
    }
    resolving = true;
    const livesBefore = { ...before.kingLives };
    const result = endScTurn(before);
    clearTurnDeadline();
    setStatus(reason === "timeout" ? "Turn locked — time up" : "Turn submitted");
    lastQueuedKey = null;
    setSpawnPhase("idle");
    setSpawnUnit(null);

    const finishPlanning = () => {
      appendSettledTurn(before, result.next);
      setPlanningSnapshot(result.next);
      setSiegedRooks(result.next.siegedRooks ?? []);
      loadFen(classicFenFromSc(result.next, "w"));
      resolving = false;
      if (result.next.phase === "P") {
        // AFK / next turn: re-arm the gauge so timeout keeps advancing SCFEN.
        startPlanningTimer();
        setStatus("Plan a special and/or move · End to submit");
      } else {
        // HP is the source of truth: both kings at 0 (face-to-face duel) is a draw.
        const outcome = scOutcome(result.next);
        setStatus(
          outcome?.draw
            ? "Match over · Draw — both Kings destroyed · Review with the arrows"
            : outcome
              ? `Match over · ${outcome.winner === "w" ? "White" : "Black"} wins · Review with the arrows`
              : "Match over · Review with the arrows",
        );
      }
    };

    const hadPending =
      before.kingLives.w !== result.afterPending.kingLives.w ||
      before.kingLives.b !== result.afterPending.kingLives.b ||
      before.placement !== result.afterPending.placement;

    const startCombat = () => {
      combat.playResolve(result.resolved, {
        // Pending checks resolve before B — start from pre-special board so
        // kingShot / collision attack VFX match engine order.
        startPlacement: hadPending
          ? result.afterPending.placement
          : result.afterB.placement,
        livesBefore,
        commit: (snap) => {
          setSiegedRooks(result.next.siegedRooks ?? []);
          loadFen(toClassicFen(snap.placement, "w", 0, Math.max(1, result.next.turn)));
          const cur = planningSnapshot();
          if (cur) {
            setPlanningSnapshot({
              ...cur,
              placement: snap.placement,
              kingLives: { ...snap.kingLives },
              ...(snap.mines.length ? { mines: [...snap.mines] } : { mines: undefined }),
              ...(result.next.siegedRooks?.length
                ? { siegedRooks: [...result.next.siegedRooks] }
                : { siegedRooks: undefined }),
            });
          }
        },
        onDone: () => {
          if (result.fMoves.length === 0) {
            finishPlanning();
            return;
          }
          // Animate F gas-steps onto the final board, then settle planning.
          combat.playRelocates(
            result.fMoves,
            {
              placement: result.next.placement,
              kingLives: result.next.kingLives,
              phase: result.next.phase === "O" ? "O" : "P",
              mines: result.next.mines ?? [],
            },
            {
              startPlacement: result.resolved.afterAll.placement,
              livesBefore: result.next.kingLives,
              commit: (snap) => {
                loadFen(toClassicFen(snap.placement, "w", 0, Math.max(1, result.next.turn)));
                const cur = planningSnapshot();
                if (cur) {
                  setPlanningSnapshot({
                    ...cur,
                    placement: snap.placement,
                    kingLives: { ...snap.kingLives },
                  });
                }
              },
              onDone: finishPlanning,
            },
          );
        },
      });
    };

    // Hold post-B board (spawn / mine / siege) for auto-deploy VFX, then resolve.
    // Gas-step B moves animate from the pre-B board first (no teleport).
    const placementChanged = result.afterB.placement !== before.placement;
    const minesChanged = minesKey(result.afterB.mines) !== minesKey(before.mines);
    const siegeChanged =
      (result.afterB.siegedRooks ?? []).join("") !==
      (before.siegedRooks ?? []).join("");
    // Intent siege must be visible before attack/move cues (HE / 9×9 fog).
    setSiegedRooks(result.afterB.siegedRooks ?? []);

    const armPostBHold = () => {
      setPlanningSnapshot({
        ...before,
        placement: result.afterB.placement,
        kingLives: { ...result.afterPending.kingLives },
        ...(result.afterB.mines.length ? { mines: result.afterB.mines } : { mines: undefined }),
        ...(result.afterB.siegedRooks.length
          ? { siegedRooks: [...result.afterB.siegedRooks] }
          : { siegedRooks: undefined }),
        queue: { actions: [] },
      });
      if (placementChanged || hadPending) {
        loadFen(toClassicFen(result.afterB.placement, "w", 0, Math.max(1, before.turn)));
      }
      const waitMs = Math.max(
        placementChanged && result.bMoves.length === 0 ? DEPLOY_MS : 0,
        minesChanged ? MINE_DEPLOY_MS : 0,
        siegeChanged ? DEPLOY_MS : 0,
      );
      if (waitMs > 0) window.setTimeout(startCombat, waitMs);
      else startCombat();
    };

    if (result.bMoves.length > 0) {
      combat.playRelocates(
        result.bMoves,
        {
          placement: result.afterB.placement,
          kingLives: { ...result.afterPending.kingLives },
          phase: "P",
          mines: result.afterB.mines,
        },
        {
          startPlacement: before.placement,
          livesBefore,
          commit: (snap) => {
            loadFen(toClassicFen(snap.placement, "w", 0, Math.max(1, before.turn)));
            const cur = planningSnapshot();
            if (cur) {
              setPlanningSnapshot({
                ...cur,
                placement: snap.placement,
                kingLives: { ...snap.kingLives },
                ...(snap.mines.length ? { mines: [...snap.mines] } : { mines: undefined }),
              });
            }
          },
          onDone: armPostBHold,
        },
      );
    } else {
      armPostBHold();
    }
  };

  const intentGhosts = createMemo(() => {
    if (!starChessMode() || gameEnded()) return { destinations: [], canisters: [], checks: [] };
    const snap = planningSnapshot();
    return intentOverlaysFromQueue(currentQueue(), {
      placement: snap?.placement,
      siegedRooks: snap?.siegedRooks,
      mines: snap?.mines,
      viewer: activePlayerColor(),
    });
  });

  // Terminal review: show the selected settled snapshot without mutating live state.
  createEffect(() => {
    if (!starChessMode() || !gameEnded()) return;
    const view = displayedSnapshot();
    if (!view) return;
    combat.clear();
    setSiegedRooks(view.siegedRooks ?? []);
    loadFen(classicFenFromSc(view, "w"));
    // Keep planning snap as the live terminal position; board reads gameStore FEN.
  });

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!gameEnded()) return;
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
        goHistoryBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goHistoryForward();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

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
                data-w={kingLives().w}
                data-b={kingLives().b}
                hidden
              />
              <Show
                when={gameEnded()}
                fallback={
                  <>
                    <ResourceBar />
                    <TurnBar
                      resolveOnEnd={false}
                      onEnd={() => submitPlan("end")}
                      onTimeout={() => submitPlan("timeout")}
                    />
                  </>
                }
              >
                <DualNavButton
                  inverted
                  inline
                  label={reviewLabel()}
                  onBack={goHistoryBack}
                  onForward={goHistoryForward}
                  backDisabled={!canGoBack()}
                  forwardDisabled={!canGoForward()}
                />
              </Show>
            </div>
          </Show>
          <div class={styles.boardHost} ref={(el) => (boardHost = el)}>
            <StarChessBoard
              variant={props.boardVariant ?? "eclipse"}
              fogOfWar={fogOfWar()}
              suppressNativeMoves={starChessMode()}
              suppressAutoDeploy={gameEnded()}
              intentDestinations={intentGhosts().destinations}
              intentCanisters={intentGhosts().canisters}
              intentChecks={intentGhosts().checks}
              attackCues={combat.attackCues()}
              attackDying={combat.attackDying()}
              deathCues={combat.deathCues()}
              moveCues={combat.moveCues()}
              moveProgress={combat.moveProgress()}
              moveLeg={combat.moveLeg()}
              kingDamage={combat.kingDamage()}
              chasingMines={combat.chasingMines()}
              mineMissiles={combat.mineMissiles()}
              mineMissileTrails={combat.mineMissileTrails()}
              spentMines={combat.spentMines()}
              spiderMines={
                (gameEnded() ? displayedSnapshot()?.mines : planningSnapshot()?.mines) ?? []
              }
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
            <p class={styles.placeholder}>{status()}</p>
          </Show>
        </Screen.BoardColumn>
      </Screen.BoardArea>
      <Show when={starChessMode() && !gameEnded()}>
        <Screen.Footer>
          <div class={styles.gasFooter} data-testid="nerd-gas-deploy">
            <GasDeploy
              onDeploy={onGasDeploy}
              onCancel={() => setStatus("Cancelled — canister returned")}
            />
          </div>
        </Screen.Footer>
      </Show>
    </Screen>
  );
};
