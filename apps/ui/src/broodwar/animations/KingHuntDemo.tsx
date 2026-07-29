import {
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";

import { kingDamageStateForLives } from "~/broodwar/animations/kingDamage";
import {
  kingLives,
  resetBroodWarEconomy,
  setKingLives,
} from "~/broodwar/broodWarStore";
import { classicFenFromBw, formatBwFen, type BwFenSnapshot } from "~/broodwar/bwfen";
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

/**
 * King Hunt — BWFEN story only. Combat VFX comes from resolveTurn +
 * useBroodWarCombat (attack → death → occupy). Same W & B grammar as Combat Chain.
 *
 *   0. … & Nc5+              → 3→2
 *   1. Kd5 & Bh2→Bg1
 *   2. Kxc5 (Bg1+) & Rf8→Rf6 → walk into check
 *   3. Kc6 & Bg1→c5          → 2→1
 *   4. … & Rf6+              → 1→0
 */
const PLACEMENT_START = "k4r2/8/8/2n5/4K3/8/7b/8";

type StoryTurn = {
  caption: string;
  white: ClassicalPlan | null;
  black: ClassicalPlan | null;
};

/** One planning snap per review index (0 = start). */
export const KING_HUNT_PLY_BW: readonly BwFenSnapshot[] = [
  {
    placement: PLACEMENT_START,
    turn: 0,
    kingLives: { w: 3, b: 3 },
    phase: "P",
  },
  {
    placement: "k4r2/8/8/2n5/4K3/8/7b/8",
    turn: 1,
    kingLives: { w: 2, b: 3 },
    phase: "P",
  },
  {
    placement: "k4r2/8/8/2nK4/8/8/8/6b1",
    turn: 2,
    kingLives: { w: 2, b: 3 },
    phase: "P",
  },
  {
    placement: "k7/8/5r2/2K5/8/8/8/6b1",
    turn: 3,
    kingLives: { w: 2, b: 3 },
    phase: "P",
  },
  {
    placement: "k7/8/2K2r2/8/8/8/8/6b1",
    turn: 4,
    kingLives: { w: 1, b: 3 },
    phase: "P",
  },
  {
    placement: "k7/8/2K2r2/8/8/8/8/6b1",
    turn: 4,
    kingLives: { w: 0, b: 3 },
    phase: "O",
  },
] as const;

const TURNS: readonly StoryTurn[] = [
  {
    caption: "0. … & Nc5+",
    white: null,
    black: { color: "b", from: "c5", to: "e4" },
  },
  {
    caption: "1. Kd5 & Bh2→Bg1",
    white: { color: "w", from: "e4", to: "d5" },
    black: { color: "b", from: "h2", to: "g1" },
  },
  {
    caption: "2. Kxc5 (Bg1+) & Rf8→Rf6",
    white: { color: "w", from: "d5", to: "c5" },
    black: { color: "b", from: "f8", to: "f6" },
  },
  {
    caption: "3. Kc6 & Bg1→c5",
    white: { color: "w", from: "c5", to: "c6" },
    black: { color: "b", from: "g1", to: "c5" },
  },
  {
    caption: "4. … & Rf6+ · game over",
    white: null,
    black: { color: "b", from: "f6", to: "c6" },
  },
];

const TOTAL_TURNS = TURNS.length;
const START_CAPTION = "Start · 3 lives · pristine · Nc5 · Bh2 · Rf8";

/** @deprecated Prefer KING_HUNT_PLY_BW */
export const KING_HUNT_PLY_FENS = KING_HUNT_PLY_BW.map((snap, ply) => ({
  ply,
  fen: classicFenFromBw(snap, "w"),
  bwfen: formatBwFen(snap),
  lives: snap.kingLives.w,
}));

const applySnap = (snap: BwFenSnapshot) => {
  setKingLives(snap.kingLives);
  loadFen(classicFenFromBw(snap, "w"));
  setViewIndex(snap.turn);
};

/**
 * Visual agreement only: arrow through BWFEN snaps; resolveTurn + combat hook
 * own attack → death → occupy.
 */
export const KingHuntDemo: Component = () => {
  const combat = useBroodWarCombat();
  const [caption, setCaption] = createSignal(START_CAPTION);
  const [turnIndex, setTurnIndex] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);

  const prepare = () => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    resetBroodWarEconomy({ turn: 0, startTimer: false, kingLives: { w: 3, b: 3 } });
  };

  const showPosition = (index: number) => {
    combat.clear();
    const snap = KING_HUNT_PLY_BW[index]!;
    applySnap(snap);
    combat.syncKingDamageFromBoard(snap.placement, snap.kingLives);
    setTurnIndex(index);
    setPlaying(false);
    setCaption(index === 0 ? START_CAPTION : TURNS[index - 1]!.caption);
  };

  const finishTurn = (indexPlaying: number) => {
    const next = indexPlaying + 1;
    const snap = KING_HUNT_PLY_BW[next]!;
    applySnap(snap);
    combat.syncKingDamageFromBoard(snap.placement, snap.kingLives);
    setTurnIndex(next);
    setPlaying(false);
    setCaption(TURNS[indexPlaying]!.caption);
  };

  const playTurn = (indexPlaying: number) => {
    const turn = TURNS[indexPlaying];
    const before = KING_HUNT_PLY_BW[indexPlaying];
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
        setKingLives(snap.kingLives);
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

  const livesLabel = () => {
    const lives = kingLives().w;
    const state = kingDamageStateForLives(lives);
    return `${lives} ${lives === 1 ? "life" : "lives"} · ${state}`;
  };

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
          kingDamage={combat.kingDamage()}
        />
      </div>
      <div class={styles.reviewBar}>
        <DualNavButton
          inverted
          inline
          label={`Turn ${turnIndex()} / ${TOTAL_TURNS} · ${livesLabel()}`}
          onBack={goBack}
          onForward={goForward}
          backDisabled={playing() || turnIndex() <= 0}
          forwardDisabled={playing() || turnIndex() >= TOTAL_TURNS}
        />
      </div>
      <p class={styles.caption} data-king-damage={kingDamageStateForLives(kingLives().w)}>
        Review · King hunt · {caption()}
      </p>
    </div>
  );
};
