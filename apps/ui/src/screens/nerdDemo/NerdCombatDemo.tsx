/**
 * Combat Chain — BWFEN turn-shape reference story.
 * Visual agreement only: arrows step snaps; resolveTurn + useBroodWarCombat
 * own attack → death → occupy / slides (same pipeline as King Hunt).
 *
 *   1. d2-d4 & Be8-c6
 *   2. d4xe5 & Nf6-e4
 *   3. Rc3xc6 & Ne4xc3
 */

import { createSignal, onCleanup, onMount, type Component } from "solid-js";

import { classicFenFromBw, type BwFenSnapshot } from "~/broodwar/bwfen";
import { useBroodWarCombat } from "~/broodwar/hooks/useBroodWarCombat";
import { resolveTurn, type ClassicalPlan } from "~/broodwar/resolveTurn";
import { ChessBoard } from "~/components/features/ChessBoard";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import styles from "~/screens/nerdDemo/NerdCombatDemo.module.css";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { loadFen, setViewIndex } from "~/store/gameStore";
import {
  setActivePlayerColor,
  setNerdModeUnlocked,
  setPlayerIdentity,
} from "~/store/settingsStore";

type StoryTurn = {
  caption: string;
  white: ClassicalPlan | null;
  black: ClassicalPlan | null;
};

const LIVES = { w: 3, b: 3 } as const;

/** One planning snap per review index (0 = start). */
export const COMBAT_CHAIN_PLY_BW: readonly BwFenSnapshot[] = [
  {
    placement: "4bk2/8/5n2/4p3/8/2R5/3P4/4K3",
    turn: 0,
    kingLives: { ...LIVES },
    phase: "P",
  },
  {
    placement: "5k2/8/2b2n2/4p3/3P4/2R5/8/4K3",
    turn: 1,
    kingLives: { ...LIVES },
    phase: "P",
  },
  {
    placement: "5k2/8/2b5/4P3/4n3/2R5/8/4K3",
    turn: 2,
    kingLives: { ...LIVES },
    phase: "P",
  },
  {
    placement: "5k2/8/8/4P3/8/2n5/8/4K3",
    turn: 3,
    kingLives: { ...LIVES },
    phase: "P",
  },
] as const;

const TURNS: readonly StoryTurn[] = [
  {
    caption: "1. d2-d4 & Be8-c6",
    white: { color: "w", from: "d2", to: "d4" },
    black: { color: "b", from: "e8", to: "c6" },
  },
  {
    caption: "2. d4xe5 & Nf6-e4",
    white: { color: "w", from: "d4", to: "e5" },
    black: { color: "b", from: "f6", to: "e4" },
  },
  {
    caption: "3. Rc3xc6 & Ne4xc3",
    white: { color: "w", from: "c3", to: "c6" },
    black: { color: "b", from: "e4", to: "c3" },
  },
];

const TOTAL_TURNS = TURNS.length;
const START_CAPTION = "Start · use arrows to review turns";

const applySnap = (snap: BwFenSnapshot) => {
  loadFen(classicFenFromBw(snap, "w"));
  setViewIndex(snap.turn);
};

export const NerdCombatDemo: Component = () => {
  const combat = useBroodWarCombat();
  const [caption, setCaption] = createSignal(START_CAPTION);
  const [turnIndex, setTurnIndex] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);

  const prepare = () => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
  };

  const showPosition = (index: number) => {
    combat.clear();
    applySnap(COMBAT_CHAIN_PLY_BW[index]!);
    setTurnIndex(index);
    setPlaying(false);
    setCaption(index === 0 ? START_CAPTION : TURNS[index - 1]!.caption);
  };

  const finishTurn = (indexPlaying: number) => {
    const next = indexPlaying + 1;
    applySnap(COMBAT_CHAIN_PLY_BW[next]!);
    setTurnIndex(next);
    setPlaying(false);
    setCaption(TURNS[indexPlaying]!.caption);
  };

  const playTurn = (indexPlaying: number) => {
    const turn = TURNS[indexPlaying];
    const before = COMBAT_CHAIN_PLY_BW[indexPlaying];
    if (!turn || !before) return;

    combat.clear();
    setPlaying(true);
    setCaption(turn.caption);
    applySnap(before);

    const resolved = resolveTurn({
      placement: before.placement,
      kingLives: before.kingLives,
      white: turn.white,
      black: turn.black,
    });

    combat.playResolve(resolved, {
      startPlacement: before.placement,
      livesBefore: before.kingLives,
      commit: (snap) => {
        loadFen(
          classicFenFromBw(
            {
              placement: snap.placement,
              turn: before.turn + (snap.phase === "P" || snap.phase === "O" ? 1 : 0),
              kingLives: snap.kingLives,
              phase: snap.phase,
            },
            "w",
          ),
        );
      },
      onDone: () => finishTurn(indexPlaying),
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
        <ChessBoard
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
