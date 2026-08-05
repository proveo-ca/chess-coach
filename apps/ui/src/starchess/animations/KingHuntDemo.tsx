/**
 * King Hunt — SCFEN + engine-driven. Combat VFX from `endScTurn` → `useStarChessCombat`.
 */

import {
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";

import { kingDamageStateForLives } from "~/starchess/animations/kingDamage";
import {
  kingLives,
  planningSnapshot,
  resetStarChessEconomy,
  setPlanningSnapshot,
  setSiegedRooks,
} from "~/starchess/starChessStore";
import {
  KING_HUNT_PLY_SC,
  KING_HUNT_STEPS,
  queueKingHuntStep,
} from "~/starchess/demos/kingHunt";
import { endScTurn } from "~/starchess/endScTurn";
import { classicFenFromSc, toClassicFen } from "~/starchess/scfen";
import { useStarChessCombat } from "~/starchess/hooks/useStarChessCombat";
import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import styles from "~/starchess/animations/KingHuntDemo.module.css";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import type { ScFenSnapshot } from "~/starchess/types";
import { loadFen, setViewIndex } from "~/store/gameStore";
import { setActivePlayerColor, setPlayerIdentity } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";

export {
  KING_HUNT_PLY_SC,
  KING_HUNT_PLY_FENS,
  KING_HUNT_START_SCFEN,
  KING_HUNT_STEPS,
  buildKingHuntPlys,
} from "~/starchess/demos/kingHunt";

const TOTAL_TURNS = KING_HUNT_STEPS.length;
const START_CAPTION =
  "Start · 3 lives · Nc5 sees/checks Ke4 · Rg6 tank · Bh2 · side vision";

const applySnap = (snap: ScFenSnapshot) => {
  setPlanningSnapshot(snap);
  setSiegedRooks(snap.siegedRooks ?? []);
  loadFen(classicFenFromSc(snap, "w"));
  setViewIndex(snap.turn);
};

export const KingHuntDemo: Component = () => {
  const combat = useStarChessCombat();
  const [caption, setCaption] = createSignal(START_CAPTION);
  const [turnIndex, setTurnIndex] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const plies = KING_HUNT_PLY_SC;

  const prepare = () => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    resetStarChessEconomy({ turn: 0, startTimer: false, kingLives: { w: 3, b: 3 } });
  };

  const showPosition = (index: number) => {
    combat.clear();
    const snap = plies[index]!;
    applySnap(snap);
    combat.syncKingDamageFromBoard(snap.placement, snap.kingLives);
    setTurnIndex(index);
    setPlaying(false);
    setCaption(index === 0 ? START_CAPTION : KING_HUNT_STEPS[index - 1]!.caption);
  };

  const finishTurn = (indexPlaying: number, next: ScFenSnapshot) => {
    applySnap(next);
    combat.syncKingDamageFromBoard(next.placement, next.kingLives);
    setTurnIndex(indexPlaying + 1);
    setPlaying(false);
    setCaption(KING_HUNT_STEPS[indexPlaying]!.caption);
  };

  const playTurn = (indexPlaying: number) => {
    const step = KING_HUNT_STEPS[indexPlaying];
    const before = plies[indexPlaying];
    if (!step || !before) return;

    combat.clear();
    setPlaying(true);
    setCaption(step.caption);
    applySnap(before);

    const queued = queueKingHuntStep(before, step);
    const { resolved, next, afterB, afterPending } = endScTurn(queued);
    const hadChecks =
      before.kingLives.w !== afterPending.kingLives.w ||
      before.kingLives.b !== afterPending.kingLives.b ||
      before.placement !== afterPending.placement;

    combat.playResolve(resolved, {
      startPlacement: hadChecks ? afterPending.placement : afterB.placement,
      livesBefore: before.kingLives,
      commit: (snap) => {
        setSiegedRooks(next.siegedRooks ?? []);
        loadFen(toClassicFen(snap.placement, "w", 0, Math.max(1, before.turn + 1)));
        setPlanningSnapshot({
          ...(planningSnapshot() ?? before),
          placement: snap.placement,
          kingLives: { ...snap.kingLives },
          ...(snap.mines.length ? { mines: [...snap.mines] } : { mines: undefined }),
          ...(next.siegedRooks?.length
            ? { siegedRooks: [...next.siegedRooks] }
            : { siegedRooks: undefined }),
        });
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

  const livesLabel = () => {
    const lives = kingLives().w;
    const state = kingDamageStateForLives(lives);
    return `${lives} ${lives === 1 ? "life" : "lives"} · ${state}`;
  };

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
