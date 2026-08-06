/**
 * Combat Chain — DualNav review demo matching NerdCombatDemo layout.
 * Intent ghosts → endScTurn → classical playResolve on AnimationStage.
 * Observer dual-vision (no fog veil; per-player getSideVision borders).
 * // SPEC: _spec/apps/ui/starchess/demos.puml
 */
import { createMemo, createSignal, onCleanup, onMount, type Component } from "solid-js";
import type { Square } from "chess.js";

import {
  endScTurn,
  type ScAction,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import { DualNavButton } from "~/components/primitives/DualNavButton";
import {
  COMBAT_CHAIN_PLY_SC,
  COMBAT_CHAIN_STEPS,
  queueCombatChainStep,
} from "~/demos/combatChain";
import styles from "~/demos/CombatChainDemo.module.css";
import { AnimationStage } from "~/presentation/animations/AnimationStage";
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

const TOTAL_TURNS = COMBAT_CHAIN_STEPS.length;
const START_CAPTION = "Start · tank on c3 · use arrows to review turns";

type NavPhase = "ready" | "intent" | "playing";

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

export const CombatChainDemo: Component = () => {
  const [caption, setCaption] = createSignal(START_CAPTION);
  const [turnIndex, setTurnIndex] = createSignal(0);
  const [navPhase, setNavPhase] = createSignal<NavPhase>("ready");
  const [snap, setSnap] = createSignal<ScFenSnapshot>(COMBAT_CHAIN_PLY_SC[0]!);
  const [intentQueue, setIntentQueue] = createSignal<readonly ScAction[]>([]);
  const [attackCues, setAttackCues] = createSignal<AttackCue[]>([]);
  const [attackDying, setAttackDying] = createSignal<Record<string, boolean>>({});
  const [deathCues, setDeathCues] = createSignal<DeathCue[]>([]);
  const [moveCues, setMoveCues] = createSignal<MoveCue[]>([]);
  const [moveProgress, setMoveProgress] = createSignal<Record<string, 0 | 1>>({});
  const [moveLeg, setMoveLeg] = createSignal<Record<string, 0 | 1>>({});
  const [kingDamage, setKingDamage] = createSignal<KingDamageCue[]>([]);
  const plies = COMBAT_CHAIN_PLY_SC;

  let playback: PlayResolveHandle | null = null;

  const ghosts = createMemo((): IntentGhost[] => {
    if (navPhase() !== "intent") return [];
    // No viewer → both players' classical destinations (UI DualNav parity).
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

  const clearVfx = () => {
    applyFx(emptyFx());
  };

  const cancelPlayback = () => {
    playback?.cancel();
    playback = null;
  };

  const showPosition = (index: number) => {
    cancelPlayback();
    clearVfx();
    setIntentQueue([]);
    setSnap(plies[index]!);
    setTurnIndex(index);
    setNavPhase("ready");
    setCaption(index === 0 ? START_CAPTION : COMBAT_CHAIN_STEPS[index - 1]!.caption);
  };

  const finishTurn = (indexPlaying: number, next: ScFenSnapshot) => {
    playback = null;
    clearVfx();
    setIntentQueue([]);
    setSnap(next);
    setTurnIndex(indexPlaying + 1);
    setNavPhase("ready");
    setCaption(COMBAT_CHAIN_STEPS[indexPlaying]!.caption);
  };

  const showIntent = (indexPlaying: number) => {
    const step = COMBAT_CHAIN_STEPS[indexPlaying];
    const before = plies[indexPlaying];
    if (!step || !before) return;
    cancelPlayback();
    clearVfx();
    setSnap(before);
    const queued = queueCombatChainStep(before, step);
    setSnap({ ...before, queue: queued.queue });
    setIntentQueue(queued.queue?.actions ?? []);
    setNavPhase("intent");
    setCaption(`Intent · ${step.caption}`);
  };

  const resolveIntent = (indexPlaying: number) => {
    const step = COMBAT_CHAIN_STEPS[indexPlaying];
    const before = plies[indexPlaying];
    if (!step || !before) return;
    cancelPlayback();
    setIntentQueue([]);
    setNavPhase("playing");
    setCaption(step.caption);
    setSnap(before);

    const queued = queueCombatChainStep(before, step);
    const { resolved, next, afterB } = endScTurn(queued);

    // Match NerdCombatDemo / useStarChessCombat: viewer defaults to white so
    // fog gates opponent move hulls (turn 1: only d2-d4 slides; Be8-c6 is silent).
    playback = playResolve(
      resolved,
      {
        startPlacement: afterB.placement,
        livesBefore: before.kingLives,
        viewer: "w",
        siegedRooks: afterB.siegedRooks,
        commit: (snapCommit) => {
          setSnap((cur) => ({
            ...cur,
            placement: snapCommit.placement,
            kingLives: { ...snapCommit.kingLives },
            phase: snapCommit.phase,
            ...(snapCommit.mines.length
              ? { mines: [...snapCommit.mines] }
              : { mines: undefined }),
            ...(next.siegedRooks?.length
              ? { siegedRooks: [...next.siegedRooks] }
              : { siegedRooks: undefined }),
          }));
        },
        onDone: () => finishTurn(indexPlaying, next),
      },
      applyFx,
    );
  };

  const goBack = () => {
    if (navPhase() === "playing") return;
    if (navPhase() === "intent") {
      showPosition(turnIndex());
      return;
    }
    const i = turnIndex();
    if (i <= 0) return;
    showPosition(i - 1);
  };

  const goForward = () => {
    if (navPhase() === "playing") return;
    const i = turnIndex();
    if (navPhase() === "intent") {
      resolveIntent(i);
      return;
    }
    if (i >= TOTAL_TURNS) return;
    showIntent(i);
  };

  const navLabel = () => {
    const i = turnIndex();
    const n = TOTAL_TURNS;
    if (navPhase() === "intent") return `Intent ${i + 1} / ${n}`;
    if (navPhase() === "playing") return `Resolve ${i + 1} / ${n}`;
    return `Turn ${i} / ${n}`;
  };

  const busy = () => navPhase() === "playing";

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
      clearVfx();
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
          label={navLabel()}
          onBack={goBack}
          onForward={goForward}
          backDisabled={busy() || (navPhase() === "ready" && turnIndex() <= 0)}
          forwardDisabled={busy() || (navPhase() === "ready" && turnIndex() >= TOTAL_TURNS)}
        />
      </div>
      <p class={styles.caption}>Review · Combat chain · {caption()}</p>
    </div>
  );
};
