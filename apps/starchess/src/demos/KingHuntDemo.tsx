/**
 * King Hunt — DualNav review: check → intent → resolve.
 * Turn-start king-checks play before intent ghosts.
 * // SPEC: _spec/apps/ui/starchess/demos.puml
 */
import { createMemo, createSignal, onCleanup, onMount, type Component } from "solid-js";
import type { Square } from "chess.js";

import {
  beginScTurn,
  endScTurn,
  type ScAction,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import { DualNavButton } from "~/components/primitives/DualNavButton";
import {
  KING_HUNT_PLY_SC,
  KING_HUNT_STEPS,
  queueKingHuntStep,
} from "~/demos/kingHunt";
import styles from "~/demos/KingHuntDemo.module.css";
import { AnimationStage } from "~/presentation/animations/AnimationStage";
import {
  kingDamageCuesFromBoard,
  kingDamageStateForLives,
} from "~/presentation/animations/kingDamage";
import {
  clearSiegedRooks,
  setRookMode,
} from "~/presentation/animations/rookModeStore";
import { buildFxHiddenSquares } from "~/presentation/combat/boardFx";
import { intentOverlaysFromQueue } from "~/presentation/combat/intentOverlays";
import {
  playResolve,
  type CombatFxState,
  type PlayResolveHandle,
} from "~/presentation/combat/playResolve";
import type { IntentGhost } from "~/presentation/board/EclipseBoard";
import type {
  AttackCue,
  DeathCue,
  KingDamageCue,
  MoveCue,
} from "~/presentation/types";

export {
  KING_HUNT_PLY_SC,
  KING_HUNT_PLY_FENS,
  KING_HUNT_START_SCFEN,
  KING_HUNT_STEPS,
  buildKingHuntPlys,
} from "~/demos/kingHunt";

const TOTAL_TURNS = KING_HUNT_STEPS.length;
const START_CAPTION =
  "Start · 3 lives · Nc5 sees/checks Ke4 · Rg6 tank · Bh2 · side vision";

type NavPhase = "ready" | "checking" | "intent" | "playing";

const emptyFx = (): CombatFxState => ({
  attackCues: [],
  attackDying: {},
  deathCues: [],
  moveCues: [],
  moveProgress: {},
  moveLeg: {},
  kingDamage: [],
  chasingMines: [],
  mineMissiles: [],
  mineMissileTrails: [],
  spentMines: [],
});

const syncSiegedRooks = (sieged: readonly Square[] | undefined) => {
  clearSiegedRooks();
  for (const sq of sieged ?? []) setRookMode(sq, "siege");
};

export const KingHuntDemo: Component = () => {
  const [caption, setCaption] = createSignal(START_CAPTION);
  const [turnIndex, setTurnIndex] = createSignal(0);
  const [navPhase, setNavPhase] = createSignal<NavPhase>("ready");
  const [snap, setSnap] = createSignal<ScFenSnapshot>(KING_HUNT_PLY_SC[0]!);
  const [intentQueue, setIntentQueue] = createSignal<readonly ScAction[]>([]);
  const [attackCues, setAttackCues] = createSignal<AttackCue[]>([]);
  const [attackDying, setAttackDying] = createSignal<Record<string, boolean>>({});
  const [deathCues, setDeathCues] = createSignal<DeathCue[]>([]);
  const [moveCues, setMoveCues] = createSignal<MoveCue[]>([]);
  const [moveProgress, setMoveProgress] = createSignal<Record<string, 0 | 1>>({});
  const [moveLeg, setMoveLeg] = createSignal<Record<string, 0 | 1>>({});
  const [kingDamage, setKingDamage] = createSignal<KingDamageCue[]>([]);
  const plies = KING_HUNT_PLY_SC;

  let playback: PlayResolveHandle | null = null;
  /** Board after turn-open checks for the in-flight turn (intent / resolve). */
  let afterCheckSnap: ScFenSnapshot | null = null;

  const ghosts = createMemo((): IntentGhost[] => {
    if (navPhase() !== "intent") return [];
    return intentOverlaysFromQueue(intentQueue(), {
      placement: snap().placement,
      siegedRooks: snap().siegedRooks,
    });
  });

  const hideSquares = createMemo((): ReadonlySet<Square> =>
    buildFxHiddenSquares({
      attacks: attackCues(),
      deaths: deathCues(),
      moves: moveCues(),
      kingDamage: kingDamage(),
    }),
  );

  const applyFx = (o: CombatFxState) => {
    setAttackCues(o.attackCues);
    setAttackDying(o.attackDying);
    setDeathCues(o.deathCues);
    setMoveCues(o.moveCues);
    setMoveProgress(o.moveProgress);
    setMoveLeg(o.moveLeg);
    setKingDamage(o.kingDamage);
  };

  const clearCombatLayers = () => {
    setAttackCues([]);
    setAttackDying({});
    setDeathCues([]);
    setMoveCues([]);
    setMoveProgress({});
    setMoveLeg({});
  };

  const syncDamageFromSnap = (s: ScFenSnapshot) => {
    setKingDamage((prev) => kingDamageCuesFromBoard(s.placement, s.kingLives, prev));
  };

  const cancelPlayback = () => {
    playback?.cancel();
    playback = null;
  };

  const applySnap = (next: ScFenSnapshot) => {
    setSnap(next);
    syncSiegedRooks(next.siegedRooks);
  };

  const showPosition = (index: number) => {
    cancelPlayback();
    clearCombatLayers();
    setIntentQueue([]);
    afterCheckSnap = null;
    const s = plies[index]!;
    applySnap(s);
    syncDamageFromSnap(s);
    setTurnIndex(index);
    setNavPhase("ready");
    setCaption(index === 0 ? START_CAPTION : KING_HUNT_STEPS[index - 1]!.caption);
  };

  const finishTurn = (indexPlaying: number, next: ScFenSnapshot) => {
    playback = null;
    clearCombatLayers();
    setIntentQueue([]);
    afterCheckSnap = null;
    applySnap(next);
    syncDamageFromSnap(next);
    setTurnIndex(indexPlaying + 1);
    setNavPhase("ready");
    setCaption(KING_HUNT_STEPS[indexPlaying]!.caption);
  };

  const showIntent = (indexPlaying: number, board: ScFenSnapshot) => {
    const step = KING_HUNT_STEPS[indexPlaying];
    if (!step) return;
    cancelPlayback();
    clearCombatLayers();
    applySnap(board);
    syncDamageFromSnap(board);
    const queued = queueKingHuntStep(board, step);
    setSnap({ ...board, queue: queued.queue });
    setIntentQueue(queued.queue?.actions ?? []);
    setNavPhase("intent");
    setCaption(`Intent · ${step.caption}`);
  };

  const playChecksThenIntent = (indexPlaying: number) => {
    const step = KING_HUNT_STEPS[indexPlaying];
    const before = plies[indexPlaying];
    if (!step || !before) return;

    cancelPlayback();
    clearCombatLayers();
    setIntentQueue([]);
    applySnap(before);
    syncDamageFromSnap(before);

    const begun = beginScTurn(before);
    afterCheckSnap = begun.next;

    if (!begun.changed || !begun.asResolve) {
      afterCheckSnap = before;
      showIntent(indexPlaying, before);
      return;
    }

    setNavPhase("checking");
    setCaption(`Check · ${step.caption}`);

    playback = playResolve(
      begun.asResolve.resolved,
      {
        startPlacement: before.placement,
        livesBefore: before.kingLives,
        viewer: "w",
        siegedRooks: before.siegedRooks,
        commit: (snapCommit) => {
          setSnap((cur) => ({
            ...cur,
            placement: snapCommit.placement,
            kingLives: { ...snapCommit.kingLives },
            phase: snapCommit.phase,
            ...(snapCommit.mines.length
              ? { mines: [...snapCommit.mines] }
              : { mines: undefined }),
          }));
        },
        onDone: () => {
          playback = null;
          clearCombatLayers();
          const after = begun.next;
          applySnap(after);
          syncDamageFromSnap(after);
          if (after.phase === "O") {
            finishTurn(indexPlaying, plies[indexPlaying + 1] ?? after);
            return;
          }
          showIntent(indexPlaying, after);
        },
      },
      applyFx,
    );
  };

  const resolveIntent = (indexPlaying: number) => {
    const step = KING_HUNT_STEPS[indexPlaying];
    const before = plies[indexPlaying];
    if (!step || !before) return;
    const board = afterCheckSnap ?? before;

    cancelPlayback();
    setIntentQueue([]);
    setNavPhase("playing");
    setCaption(step.caption);
    applySnap(board);

    const queued = queueKingHuntStep(board, step);
    const result = endScTurn(queued, { skipTurnStartChecks: true });

    playback = playResolve(
      result.resolved,
      {
        startPlacement: result.afterB.placement,
        livesBefore: board.kingLives,
        viewer: "w",
        siegedRooks: result.afterB.siegedRooks,
        commit: (snapCommit) => {
          setSnap((cur) => ({
            ...cur,
            placement: snapCommit.placement,
            kingLives: { ...snapCommit.kingLives },
            phase: snapCommit.phase,
            ...(snapCommit.mines.length
              ? { mines: [...snapCommit.mines] }
              : { mines: undefined }),
            ...(result.next.siegedRooks?.length
              ? { siegedRooks: [...result.next.siegedRooks] }
              : { siegedRooks: undefined }),
          }));
          if (result.next.siegedRooks) syncSiegedRooks(result.next.siegedRooks);
        },
        onDone: () => finishTurn(indexPlaying, result.next),
      },
      applyFx,
    );
  };

  const goBack = () => {
    if (navPhase() === "playing" || navPhase() === "checking") return;
    if (navPhase() === "intent") {
      showPosition(turnIndex());
      return;
    }
    const i = turnIndex();
    if (i <= 0) return;
    showPosition(i - 1);
  };

  const goForward = () => {
    if (navPhase() === "playing" || navPhase() === "checking") return;
    const i = turnIndex();
    if (navPhase() === "intent") {
      resolveIntent(i);
      return;
    }
    if (i >= TOTAL_TURNS) return;
    playChecksThenIntent(i);
  };

  const navLabel = () => {
    const i = turnIndex();
    const n = TOTAL_TURNS;
    if (navPhase() === "checking") return `Check ${i + 1} / ${n}`;
    if (navPhase() === "intent") return `Intent ${i + 1} / ${n}`;
    if (navPhase() === "playing") return `Resolve ${i + 1} / ${n}`;
    return `Turn ${i} / ${n}`;
  };

  const livesLabel = () => {
    const lives = snap().kingLives.w;
    const state = kingDamageStateForLives(lives);
    return `${lives} ${lives === 1 ? "life" : "lives"} · ${state}`;
  };

  const busy = () => navPhase() === "playing" || navPhase() === "checking";

  onMount(() => {
    showPosition(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goForward();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      cancelPlayback();
      clearSiegedRooks();
      applyFx(emptyFx());
    });
  });

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <AnimationStage
          snapshot={snap()}
          viewer="w"
          visionMode="observer"
          fog={false}
          variant="eclipse"
          intentGhosts={ghosts()}
          attackCues={attackCues()}
          attackDying={attackDying()}
          deathCues={deathCues()}
          moveCues={moveCues()}
          moveProgress={moveProgress()}
          moveLeg={moveLeg()}
          kingDamage={kingDamage()}
          hideSquares={hideSquares()}
        />
      </div>
      <div class={styles.reviewBar}>
        <DualNavButton
          inverted
          inline
          label={`${navLabel()} · ${livesLabel()}`}
          onBack={goBack}
          onForward={goForward}
          backDisabled={busy() || (navPhase() === "ready" && turnIndex() <= 0)}
          forwardDisabled={busy() || (navPhase() === "ready" && turnIndex() >= TOTAL_TURNS)}
        />
      </div>
      <p class={styles.caption} data-king-damage={kingDamageStateForLives(snap().kingLives.w)}>
        Review · King hunt · {caption()}
      </p>
    </div>
  );
};
