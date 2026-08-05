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
import { AddScActionError } from "~/starchess/scActions";
import { classicFenFromSc, parseScFen, snapFromPlacement, toClassicFen } from "~/starchess/scfen";
import { adjacentSquares } from "~/starchess/specials/adjacent";
import { StarChessBoard } from "~/starchess/StarChessBoard";
import {
  clearSiegedRooks,
  clearTurnDeadline,
  currentQueue,
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
import { Button } from "~/components/primitives/Button";
import { Label } from "~/components/primitives/Label";
import { Screen } from "~/components/primitives/Screen";
import { NERD_STARTING_FEN } from "~/starchess/nerdMode";
import styles from "~/starchess/screens/NerdScreen.module.css";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import { setCapabilities } from "~/store/capabilitiesStore";
import { currentIndex, loadFen, moveHistory } from "~/store/gameStore";
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
   * turn (e.g. King Hunt live DualNav flee + c5 marine promote).
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
  createEffect(() => {
    const mode = starChessMode();
    const scfen = props.startingScfen;
    const fen = props.startingFen ?? NERD_STARTING_FEN;
    const key = `${mode}|${scfen ?? fen}|${props.rookMode ?? ""}`;
    if (key === seedKey) return;
    seedKey = key;
    lastQueuedKey = null;
    combat.clear();
    setSpawnPhase("idle");
    setSpawnUnit(null);
    clearSiegedRooks();

    if (mode && scfen) {
      const snap = parseScFen(scfen);
      loadFen(classicFenFromSc(snap, "w"));
      setSiegedRooks(snap.siegedRooks ?? []);
      setPlanningSnapshot({
        ...snap,
        queue: snap.queue ?? { actions: [] },
      });
      setStatus("Plan a special and/or move · End to submit");
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

  // Board gestures → SCFEN classical queue. Placement stays put (intent ghost on
  // `to`); gameStore fen is restored so the unit does not relocate until End.
  createEffect(() => {
    if (!starChessMode()) return;
    const snap = planningSnapshot();
    if (!snap || snap.phase !== "P") return;
    const idx = currentIndex();
    const hist = moveHistory();
    if (idx <= 0) return;
    const m = hist[idx - 1];
    if (!m?.from || !m?.to) return;
    const key = `${idx}:${m.from}-${m.to}`;
    if (key === lastQueuedKey) return;
    const color = activePlayerColor();
    if (snap.queue?.actions.some((a) => a.timing === "C" && a.color === color)) {
      lastQueuedKey = key;
      // Already queued — snap board back to placement (reject second relocate).
      loadFen(toClassicFen(snap.placement, "w", 0, Math.max(1, snap.turn)));
      return;
    }
    try {
      const next = queueScAction({
        timing: "C",
        kind: "classical",
        color,
        from: m.from as Square,
        to: m.to as Square,
      });
      lastQueuedKey = key;
      // Intent only: keep units on SCFEN placement until resolve.
      loadFen(toClassicFen(next.placement, "w", 0, Math.max(1, next.turn)));
      setStatus(`Queued ${m.from}→${m.to} · End to resolve`);
    } catch {
      // Baseline / shape rejects — restore placement so the board does not drift.
      loadFen(toClassicFen(snap.placement, "w", 0, Math.max(1, snap.turn)));
    }
  });

  const submitPlan = (reason: "end" | "timeout") => {
    if (resolving) return;
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
      setPlanningSnapshot(result.next);
      setSiegedRooks(result.next.siegedRooks ?? []);
      loadFen(classicFenFromSc(result.next, "w"));
      resolving = false;
      if (result.next.phase === "P") {
        // AFK / next turn: re-arm the gauge so timeout keeps advancing SCFEN.
        startPlanningTimer();
        setStatus("Plan a special and/or move · End to submit");
      } else {
        setStatus("Match over");
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
        onDone: finishPlanning,
      });
    };

    // Hold post-B board (spawn / mine / siege) for auto-deploy VFX, then resolve.
    const placementChanged = result.afterB.placement !== before.placement;
    const minesChanged = minesKey(result.afterB.mines) !== minesKey(before.mines);
    const siegeChanged =
      (result.afterB.siegedRooks ?? []).join("") !==
      (before.siegedRooks ?? []).join("");
    // Intent siege must be visible before attack/move cues (HE / 9×9 fog).
    setSiegedRooks(result.afterB.siegedRooks ?? []);
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
      placementChanged ? DEPLOY_MS : 0,
      minesChanged ? MINE_DEPLOY_MS : 0,
      siegeChanged ? DEPLOY_MS : 0,
    );
    if (waitMs > 0) window.setTimeout(startCombat, waitMs);
    else startCombat();
  };

  const intentGhosts = createMemo(() => {
    if (!starChessMode()) return { destinations: [], canisters: [], checks: [] };
    const snap = planningSnapshot();
    return intentOverlaysFromQueue(currentQueue(), {
      placement: snap?.placement,
      siegedRooks: snap?.siegedRooks,
      mines: snap?.mines,
      viewer: activePlayerColor(),
    });
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
              <ResourceBar />
              <TurnBar
                resolveOnEnd={false}
                onEnd={() => submitPlan("end")}
                onTimeout={() => submitPlan("timeout")}
              />
            </div>
          </Show>
          <div class={styles.boardHost} ref={boardHost}>
            <StarChessBoard
              variant={props.boardVariant ?? "eclipse"}
              fogOfWar={fogOfWar()}
              suppressNativeMoves={starChessMode()}
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
              spiderMines={planningSnapshot()?.mines ?? []}
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
      <Show when={starChessMode()}>
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
