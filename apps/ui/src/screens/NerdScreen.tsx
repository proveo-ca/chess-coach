import { Show, createEffect, createMemo, createSignal, onMount } from "solid-js";
import type { Component } from "solid-js";
import type { RouteSectionProps } from "@solidjs/router";
import { Chess, type Square } from "chess.js";

import { DEPLOY_MS, MINE_DEPLOY_MS } from "~/starchess/constants";
import { endScTurn } from "~/starchess/endScTurn";
import { intentOverlaysFromQueue } from "~/starchess/intentOverlays";
import { classicFenFromSc, parseScFen, snapFromPlacement, toClassicFen } from "~/starchess/scfen";
import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import {
  clearSiegedRooks,
  clearTurnDeadline,
  currentQueue,
  planningSnapshot,
  queueScAction,
  resetStarChessEconomy,
  setPlanningSnapshot,
  setRookMode,
  setSiegedRooks,
} from "~/starchess/starChessStore";
import { useStarChessCombat } from "~/starchess/hooks/useStarChessCombat";
import { ResourceBar } from "~/starchess/primitives/ResourceBar";
import { TurnBar } from "~/starchess/primitives/TurnBar";
import { Button } from "~/components/primitives/Button";
import { Label } from "~/components/primitives/Label";
import { Screen } from "~/components/primitives/Screen";
import { NERD_STARTING_FEN } from "~/data/nerdMode";
import styles from "~/screens/NerdScreen.module.css";
import { NERD_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { currentIndex, loadFen, moveHistory } from "~/store/gameStore";
import {
  activePlayerColor,
  setActivePlayerColor,
  setNerdModeUnlocked,
  setPlayerIdentity,
} from "~/store/settingsStore";
import type { RookMode, ScMine } from "~/types/starchess";
import type { NerdBoardVariant } from "~/types/ui";

const minesKey = (mines: readonly ScMine[] | undefined) =>
  (mines ?? [])
    .map((m) => `${m.color}:${m.at}`)
    .sort()
    .join("|");

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
};

export const NerdScreen: Component<NerdScreenProps> = (props) => {
  const starChessMode = () => props.starChessMode ?? true;
  /** Non-negotiable: StarChess / Nerd gameplay always has cumulative fog. */
  const fogOfWar = () => starChessMode();
  const [status, setStatus] = createSignal("Plan a special and/or move · End to submit");
  const combat = useStarChessCombat();
  let lastQueuedKey: string | null = null;
  let seedKey: string | null = null;

  onMount(() => {
    setCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    if (starChessMode()) {
      resetStarChessEconomy({
        turn: 1,
        white: { stored: 12, deployed: 1 },
        black: { stored: 12, deployed: 1 },
      });
    }
  });

  // Storybook reuses this screen across fog variants — reload when seed / mode changes.
  createEffect(() => {
    const mode = starChessMode();
    const scfen = props.startingScfen;
    const fen = props.startingFen ?? NERD_STARTING_FEN;
    const key = `${mode}|${scfen ?? fen}|${props.rookMode ?? ""}`;
    clearSiegedRooks();

    if (mode && scfen) {
      const snap = parseScFen(scfen);
      loadFen(classicFenFromSc(snap, "w"));
      setSiegedRooks(snap.siegedRooks ?? []);
      if (key !== seedKey) {
        seedKey = key;
        lastQueuedKey = null;
        combat.clear();
        setPlanningSnapshot({
          ...snap,
          queue: snap.queue ?? { actions: [] },
        });
        setStatus("Plan a special and/or move · End to submit");
      }
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
    if (mode && key !== seedKey) {
      seedKey = key;
      lastQueuedKey = null;
      combat.clear();
      const placement = fen.trim().split(/\s+/)[0] ?? fen;
      const snap = snapFromPlacement(placement, 1);
      setPlanningSnapshot(snap);
      // Do not force siege — fog stories / live play default to tank unless rookMode prop says otherwise.
    }
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
    const before = planningSnapshot();
    if (!before) {
      setStatus(reason === "timeout" ? "Turn locked — time up" : "Turn submitted");
      return;
    }
    const livesBefore = { ...before.kingLives };
    const result = endScTurn(before);
    clearTurnDeadline();
    setStatus(reason === "timeout" ? "Turn locked — time up" : "Turn submitted");
    lastQueuedKey = null;

    const startCombat = () => {
      combat.playResolve(result.resolved, {
        startPlacement: result.afterB.placement,
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
          setPlanningSnapshot(result.next);
          setSiegedRooks(result.next.siegedRooks ?? []);
          loadFen(classicFenFromSc(result.next, "w"));
          setStatus(
            result.next.phase === "O"
              ? "Match over"
              : "Plan a special and/or move · End to submit",
          );
        },
      });
    };

    // Hold post-B board (spawn + mine drops) for auto-deploy VFX, then resolve.
    const placementChanged = result.afterB.placement !== before.placement;
    const minesChanged = minesKey(result.afterB.mines) !== minesKey(before.mines);
    setPlanningSnapshot({
      ...before,
      placement: result.afterB.placement,
      ...(result.afterB.mines.length ? { mines: result.afterB.mines } : { mines: undefined }),
      queue: { actions: [] },
    });
    if (placementChanged) {
      loadFen(toClassicFen(result.afterB.placement, "w", 0, Math.max(1, before.turn)));
    }
    const waitMs = Math.max(
      placementChanged ? DEPLOY_MS : 0,
      minesChanged ? MINE_DEPLOY_MS : 0,
    );
    if (waitMs > 0) window.setTimeout(startCombat, waitMs);
    else startCombat();
  };

  const intentGhosts = createMemo(() =>
    starChessMode() ? intentOverlaysFromQueue(currentQueue()) : { destinations: [], canisters: [] },
  );

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
          <StarChessChessBoard
            variant={props.boardVariant ?? "eclipse"}
            fogOfWar={fogOfWar()}
            suppressNativeMoves={starChessMode()}
            intentDestinations={intentGhosts().destinations}
            intentCanisters={intentGhosts().canisters}
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
          <Show
            when={starChessMode()}
            fallback={<p class={styles.placeholder}>Nerd mode is awakening…</p>}
          >
            <p class={styles.placeholder}>{status()}</p>
          </Show>
        </Screen.BoardColumn>
      </Screen.BoardArea>
    </Screen>
  );
};
