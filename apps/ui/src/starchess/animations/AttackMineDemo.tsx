/**
 * Attack mine — SCFEN DualNav: engine resolveTurn attack→occupy + combat VFX.
 */

import { createMemo, createSignal, onCleanup, onMount, type Component } from "solid-js";

import {
  ATTACK_MINE_PLY_SC,
  ATTACK_MINE_STEPS,
  queueAttackMineStep,
} from "~/starchess/demos/attackMine";
import { endScTurn } from "~/starchess/endScTurn";
import { intentOverlaysFromQueue } from "~/starchess/intentOverlays";
import { classicFenFromSc, toClassicFen } from "~/starchess/scfen";
import {
  planningSnapshot,
  setPlanningSnapshot,
} from "~/starchess/starChessStore";
import { useStarChessCombat } from "~/starchess/hooks/useStarChessCombat";
import { StarChessBoard } from "~/starchess/StarChessBoard";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import styles from "~/starchess/animations/AttackMineDemo.module.css";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import type { ScAction, ScFenSnapshot } from "~/starchess/types";
import { loadFen, setViewIndex } from "~/store/gameStore";
import { setActivePlayerColor, setPlayerIdentity } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";

const TOTAL_TURNS = ATTACK_MINE_STEPS.length;
const START_CAPTION = "Start · Nb mine c3 · Nd1 · arrow plays attack→occupy";

type NavPhase = "ready" | "intent" | "playing";

const applySnap = (snap: ScFenSnapshot) => {
  setPlanningSnapshot(snap);
  loadFen(classicFenFromSc(snap, "w"));
  setViewIndex(snap.turn);
};

export const AttackMineDemo: Component = () => {
  const combat = useStarChessCombat();
  const [caption, setCaption] = createSignal(START_CAPTION);
  const [turnIndex, setTurnIndex] = createSignal(0);
  const [navPhase, setNavPhase] = createSignal<NavPhase>("ready");
  const [intentQueue, setIntentQueue] = createSignal<readonly ScAction[]>([]);
  const plies = ATTACK_MINE_PLY_SC;

  const mines = () => planningSnapshot()?.mines ?? plies[turnIndex()]?.mines ?? [];

  const ghosts = createMemo(() => {
    if (navPhase() !== "intent") return { destinations: [], canisters: [], checks: [] };
    // No `viewer` → both players' intentions render as ghosts.
    return intentOverlaysFromQueue(intentQueue(), {
      placement: planningSnapshot()?.placement,
      siegedRooks: planningSnapshot()?.siegedRooks,
      mines: planningSnapshot()?.mines,
    });
  });

  const prepare = () => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
  };

  const showPosition = (index: number) => {
    combat.clear();
    setIntentQueue([]);
    applySnap(plies[index]!);
    setTurnIndex(index);
    setNavPhase("ready");
    setCaption(index === 0 ? START_CAPTION : ATTACK_MINE_STEPS[index - 1]!.caption);
  };

  const finishTurn = (indexPlaying: number, next: ScFenSnapshot) => {
    setIntentQueue([]);
    applySnap(next);
    setTurnIndex(indexPlaying + 1);
    setNavPhase("ready");
    setCaption(ATTACK_MINE_STEPS[indexPlaying]!.caption);
  };

  const showIntent = (indexPlaying: number) => {
    const step = ATTACK_MINE_STEPS[indexPlaying];
    const before = plies[indexPlaying];
    if (!step || !before) return;

    combat.clear();
    applySnap(before);
    const queued = queueAttackMineStep(before, step);
    // Placement unchanged — only Q: carries intent (ghost overlays).
    setPlanningSnapshot(queued);
    setIntentQueue(queued.queue?.actions ?? []);
    setNavPhase("intent");
    setCaption(`Intent · ${step.caption}`);
  };

  const resolveIntent = (indexPlaying: number) => {
    const step = ATTACK_MINE_STEPS[indexPlaying];
    const before = plies[indexPlaying];
    if (!step || !before) return;

    combat.clear();
    setIntentQueue([]);
    setNavPhase("playing");
    setCaption(step.caption);
    applySnap(before);

    const queued = queueAttackMineStep(before, step);
    const { resolved, next, afterB } = endScTurn(queued);

    combat.playResolve(resolved, {
      startPlacement: afterB.placement,
      livesBefore: before.kingLives,
      commit: (snap) => {
        setPlanningSnapshot({
          ...before,
          placement: snap.placement,
          kingLives: { ...snap.kingLives },
          ...(snap.mines.length ? { mines: [...snap.mines] } : { mines: undefined }),
          queue: { actions: [] },
        });
        loadFen(toClassicFen(snap.placement, "w", 0, Math.max(1, before.turn + 1)));
      },
      onDone: () => finishTurn(indexPlaying, next),
    });
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
    prepare();
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
      combat.clear();
    });
  });

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <StarChessBoard
          variant="eclipse"
          fogOfWar
          spiderMines={mines()}
          intentDestinations={ghosts().destinations}
          intentCanisters={ghosts().canisters}
          intentChecks={ghosts().checks}
          chasingMines={combat.chasingMines()}
          mineMissiles={combat.mineMissiles()}
          mineMissileTrails={combat.mineMissileTrails()}
          spentMines={combat.spentMines()}
          attackCues={combat.attackCues()}
          attackDying={combat.attackDying()}
          deathCues={combat.deathCues()}
          moveCues={combat.moveCues()}
          moveProgress={combat.moveProgress()}
          moveLeg={combat.moveLeg()}
          kingDamage={combat.kingDamage()}
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
      <p class={styles.caption}>Review · Attack mine · {caption()}</p>
    </div>
  );
};
