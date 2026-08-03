/**
 * Combat Chain — SCFEN + engine-driven turn-shape reference.
 * Forward steps: queue via `addScMove` → `endScTurn` → combat VFX.
 */

import { createSignal, onCleanup, onMount, type Component } from "solid-js";

import { rookSquaresInPlacement } from "~/starchess/board";
import {
  COMBAT_CHAIN_PLY_SC,
  COMBAT_CHAIN_STEPS,
  queueCombatChainStep,
} from "~/starchess/demos/combatChain";
import { endScTurn } from "~/starchess/endScTurn";
import { classicFenFromSc, toClassicFen } from "~/starchess/scfen";
import { setPlanningSnapshot, setSiegedRooks } from "~/starchess/starChessStore";
import { useStarChessCombat } from "~/starchess/hooks/useStarChessCombat";
import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import styles from "~/screens/nerdDemo/NerdCombatDemo.module.css";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import type { ScFenSnapshot } from "~/types/starchess";
import { loadFen, setViewIndex } from "~/store/gameStore";
import {
  setActivePlayerColor,
  setNerdModeUnlocked,
  setPlayerIdentity,
} from "~/store/settingsStore";

export {
  COMBAT_CHAIN_PLY_SC,
  COMBAT_CHAIN_START_SCFEN,
  COMBAT_CHAIN_STEPS,
  buildCombatChainPlys,
} from "~/starchess/demos/combatChain";

const TOTAL_TURNS = COMBAT_CHAIN_STEPS.length;
const START_CAPTION = "Start · use arrows to review turns";

const applySnap = (snap: ScFenSnapshot) => {
  setPlanningSnapshot(snap);
  setSiegedRooks(rookSquaresInPlacement(snap.placement));
  loadFen(classicFenFromSc(snap, "w"));
  setViewIndex(snap.turn);
};

export const NerdCombatDemo: Component = () => {
  const combat = useStarChessCombat();
  const [caption, setCaption] = createSignal(START_CAPTION);
  const [turnIndex, setTurnIndex] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const plies = COMBAT_CHAIN_PLY_SC;

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
    setCaption(index === 0 ? START_CAPTION : COMBAT_CHAIN_STEPS[index - 1]!.caption);
  };

  const finishTurn = (indexPlaying: number, next: ScFenSnapshot) => {
    applySnap(next);
    setTurnIndex(indexPlaying + 1);
    setPlaying(false);
    setCaption(COMBAT_CHAIN_STEPS[indexPlaying]!.caption);
  };

  const playTurn = (indexPlaying: number) => {
    const step = COMBAT_CHAIN_STEPS[indexPlaying];
    const before = plies[indexPlaying];
    if (!step || !before) return;

    combat.clear();
    setPlaying(true);
    setCaption(step.caption);
    applySnap(before);

    const queued = queueCombatChainStep(before, step);
    const { resolved, next } = endScTurn(queued);

    combat.playResolve(resolved, {
      startPlacement: before.placement,
      livesBefore: before.kingLives,
      commit: (snap) => {
        setSiegedRooks(rookSquaresInPlacement(snap.placement));
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
      <p class={styles.caption}>Review · Combat chain · {caption()}</p>
    </div>
  );
};
