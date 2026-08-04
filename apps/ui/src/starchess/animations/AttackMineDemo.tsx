/**
 * Attack mine — SCFEN DualNav: engine resolveTurn attack→occupy + combat VFX.
 */

import { createSignal, onCleanup, onMount, type Component } from "solid-js";

import {
  ATTACK_MINE_PLY_SC,
  ATTACK_MINE_STEPS,
  queueAttackMineStep,
} from "~/starchess/demos/attackMine";
import { endScTurn } from "~/starchess/endScTurn";
import { classicFenFromSc, toClassicFen } from "~/starchess/scfen";
import {
  planningSnapshot,
  setPlanningSnapshot,
} from "~/starchess/starChessStore";
import { useStarChessCombat } from "~/starchess/hooks/useStarChessCombat";
import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import styles from "~/starchess/animations/PathCollideDemo.module.css";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import type { ScFenSnapshot } from "~/types/starchess";
import { loadFen, setViewIndex } from "~/store/gameStore";
import {
  setActivePlayerColor,
  setNerdModeUnlocked,
  setPlayerIdentity,
} from "~/store/settingsStore";

const TOTAL_TURNS = ATTACK_MINE_STEPS.length;
const START_CAPTION = "Start · Nb mine c3 · Nd1 · arrow plays attack→occupy";

const applySnap = (snap: ScFenSnapshot) => {
  setPlanningSnapshot(snap);
  loadFen(classicFenFromSc(snap, "w"));
  setViewIndex(snap.turn);
};

export const AttackMineDemo: Component = () => {
  const combat = useStarChessCombat();
  const [caption, setCaption] = createSignal(START_CAPTION);
  const [turnIndex, setTurnIndex] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const plies = ATTACK_MINE_PLY_SC;

  const mines = () => planningSnapshot()?.mines ?? plies[turnIndex()]?.mines ?? [];

  const prepare = () => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
  };

  const showPosition = (index: number) => {
    combat.clear();
    applySnap(plies[index]!);
    setTurnIndex(index);
    setPlaying(false);
    setCaption(index === 0 ? START_CAPTION : ATTACK_MINE_STEPS[index - 1]!.caption);
  };

  const finishTurn = (indexPlaying: number, next: ScFenSnapshot) => {
    applySnap(next);
    setTurnIndex(indexPlaying + 1);
    setPlaying(false);
    setCaption(ATTACK_MINE_STEPS[indexPlaying]!.caption);
  };

  const playTurn = (indexPlaying: number) => {
    const step = ATTACK_MINE_STEPS[indexPlaying];
    const before = plies[indexPlaying];
    if (!step || !before) return;

    combat.clear();
    setPlaying(true);
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
    if (playing()) return;
    const i = turnIndex();
    if (i <= 0) return;
    showPosition(i - 1);
  };

  const goForward = () => {
    if (playing()) return;
    const i = turnIndex();
    if (i >= TOTAL_TURNS) return;
    playTurn(i);
  };

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
        <StarChessChessBoard
          variant="eclipse"
          fogOfWar
          spiderMines={mines()}
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
          label={`Turn ${turnIndex()} / ${TOTAL_TURNS}`}
          onBack={goBack}
          onForward={goForward}
          backDisabled={playing() || turnIndex() <= 0}
          forwardDisabled={playing() || turnIndex() >= TOTAL_TURNS}
        />
      </div>
      <p class={styles.caption}>Review · Attack mine · {caption()}</p>
    </div>
  );
};
