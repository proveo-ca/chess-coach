/**
 * SCFEN DualNav with intent ghosts → resolve.
 * Fog-edge collision + fog/move vision samples.
 * // SPEC: _spec/apps/ui/starchess/resolve.puml, _spec/apps/ui/starchess/demos.puml
 */
import { createMemo, createSignal, onCleanup, onMount, type Component } from "solid-js";
import type { Square } from "chess.js";

import {
  endScTurn,
  placementToMap,
  type ScAction,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import { DualNavButton } from "~/components/primitives/DualNavButton";
import type { FogEdgeScenario } from "~/demos/fogEdgeScenario";
import styles from "~/demos/FogEdgeDemo.module.css";
import { AnimationStage } from "~/presentation/animations/AnimationStage";
import {
  clearSiegedRooks,
  setRookMode,
} from "~/presentation/animations/rookModeStore";
import type { IntentGhost } from "~/presentation/board/EclipseBoard";
import { buildFxHiddenSquares } from "~/presentation/combat/boardFx";
import { intentOverlaysFromQueue } from "~/presentation/combat/intentOverlays";
import {
  playResolve,
  type CombatFxState,
  type PlayResolveHandle,
} from "~/presentation/combat/playResolve";
import type {
  AttackCue,
  DeathCue,
  KingDamageCue,
  MoveCue,
} from "~/presentation/types";

export type FogEdgeDemoProps = {
  /** Pre-built SCFEN DualNav package from `demos/*` — stories feed this only. */
  scenario: FogEdgeScenario;
};

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

const syncRookModes = (snap: ScFenSnapshot, forceTank: boolean | undefined) => {
  clearSiegedRooks();
  if (!forceTank) {
    for (const sq of snap.siegedRooks ?? []) setRookMode(sq, "siege");
    return;
  }
  const map = placementToMap(snap.placement);
  for (const [sq, piece] of map) {
    if (piece.type === "r") setRookMode(sq as Square, "tank");
  }
};

export const FogEdgeDemo: Component<FogEdgeDemoProps> = (props) => {
  const scenario = () => props.scenario;
  const [caption, setCaption] = createSignal(scenario().startCaption);
  const [turnIndex, setTurnIndex] = createSignal(0);
  const [navPhase, setNavPhase] = createSignal<NavPhase>("ready");
  const [snap, setSnap] = createSignal<ScFenSnapshot>(scenario().plies[0]!);
  const [intentQueue, setIntentQueue] = createSignal<readonly ScAction[]>([]);
  const [attackCues, setAttackCues] = createSignal<AttackCue[]>([]);
  const [attackDying, setAttackDying] = createSignal<Record<string, boolean>>({});
  const [deathCues, setDeathCues] = createSignal<DeathCue[]>([]);
  const [moveCues, setMoveCues] = createSignal<MoveCue[]>([]);
  const [moveProgress, setMoveProgress] = createSignal<Record<string, 0 | 1>>({});
  const [moveLeg, setMoveLeg] = createSignal<Record<string, 0 | 1>>({});
  const [kingDamage, setKingDamage] = createSignal<KingDamageCue[]>([]);

  let playback: PlayResolveHandle | null = null;

  const total = () => scenario().steps.length;

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

  const clearVfx = () => applyFx(emptyFx());

  const cancelPlayback = () => {
    playback?.cancel();
    playback = null;
  };

  const applySnap = (next: ScFenSnapshot) => {
    setSnap(next);
    syncRookModes(next, scenario().rookTank);
  };

  const showPosition = (index: number) => {
    cancelPlayback();
    clearVfx();
    setIntentQueue([]);
    applySnap(scenario().plies[index]!);
    setTurnIndex(index);
    setNavPhase("ready");
    setCaption(
      index === 0 ? scenario().startCaption : scenario().steps[index - 1]!.caption,
    );
  };

  const finishTurn = (indexPlaying: number, next: ScFenSnapshot) => {
    playback = null;
    clearVfx();
    setIntentQueue([]);
    applySnap(next);
    setTurnIndex(indexPlaying + 1);
    setNavPhase("ready");
    setCaption(scenario().steps[indexPlaying]!.caption);
  };

  const showIntent = (indexPlaying: number) => {
    const step = scenario().steps[indexPlaying];
    const before = scenario().plies[indexPlaying];
    if (!step || !before) return;

    cancelPlayback();
    clearVfx();
    applySnap(before);
    const queued = scenario().queueStep(before, indexPlaying);
    setSnap({ ...before, queue: queued.queue });
    setIntentQueue(queued.queue?.actions ?? []);
    setNavPhase("intent");
    setCaption(step.intentCaption ?? `Intent · ${step.caption}`);
  };

  const resolveIntent = (indexPlaying: number) => {
    const step = scenario().steps[indexPlaying];
    const before = scenario().plies[indexPlaying];
    if (!step || !before) return;

    cancelPlayback();
    setIntentQueue([]);
    setNavPhase("playing");
    setCaption(step.caption);
    applySnap(before);

    const queued = scenario().queueStep(before, indexPlaying);
    const { resolved, next, afterB } = endScTurn(queued);

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
          if (next.siegedRooks) syncRookModes(next, scenario().rookTank);
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
    if (i >= total()) return;
    showIntent(i);
  };

  const navLabel = () => {
    const i = turnIndex();
    const n = total();
    if (navPhase() === "intent") return `Intent ${i + 1} / ${n}`;
    if (navPhase() === "playing") return `Resolve ${i + 1} / ${n}`;
    return `Turn ${i} / ${n}`;
  };

  const review = () => scenario().reviewLabel ?? "Fog edge";
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
          fog={
            scenario().visionMode === "observer"
              ? false
              : scenario().fog !== false
          }
          visionMode={scenario().visionMode ?? "player"}
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
          forwardDisabled={busy() || (navPhase() === "ready" && turnIndex() >= total())}
        />
      </div>
      <p class={styles.caption}>
        Review · {review()} · {caption()}
      </p>
    </div>
  );
};
