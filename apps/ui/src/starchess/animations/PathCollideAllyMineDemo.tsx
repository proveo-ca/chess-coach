/**
 * Path collide (ally mine) — SCFEN DualNav: enemy rook walks over white a4 mine.
 */

import { createSignal, onCleanup, onMount, type Component } from "solid-js";

import {
  PATH_COLLIDE_ALLY_MINE_PLY_SC,
  PATH_COLLIDE_ALLY_MINE_STEPS,
  queuePathCollideAllyMineStep,
} from "~/starchess/demos/pathCollideAllyMine";
import { endScTurn } from "~/starchess/endScTurn";
import { classicFenFromSc, toClassicFen } from "~/starchess/scfen";
import {
  clearSiegedRooks,
  planningSnapshot,
  setPlanningSnapshot,
  setSiegedRooks,
} from "~/starchess/starChessStore";
import { DEPLOY_MS, MINE_DEPLOY_MS } from "~/starchess/constants";
import { useStarChessCombat } from "~/starchess/hooks/useStarChessCombat";
import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import styles from "~/starchess/animations/PathCollideDemo.module.css";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import type { ScFenSnapshot, ScMine } from "~/starchess/types";
import { loadFen, setViewIndex } from "~/store/gameStore";
import { setActivePlayerColor, setPlayerIdentity } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";

const TOTAL_TURNS = PATH_COLLIDE_ALLY_MINE_STEPS.length;
const START_CAPTION = "Start · Nw a4 · Ke1 · ke8 · arrows play 2 parallel turns";

const minesKey = (mines: readonly ScMine[] | undefined) =>
  (mines ?? [])
    .map((m) => `${m.color}:${m.at}`)
    .sort()
    .join("|");

const applySnap = (snap: ScFenSnapshot) => {
  setPlanningSnapshot(snap);
  clearSiegedRooks();
  loadFen(classicFenFromSc(snap, "w"));
  setViewIndex(snap.turn);
};

export const PathCollideAllyMineDemo: Component = () => {
  const combat = useStarChessCombat();
  const [caption, setCaption] = createSignal(START_CAPTION);
  const [turnIndex, setTurnIndex] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  /** DualNav scrub — re-baseline without spawn VFX on full-position jumps. */
  const [suppressAutoDeploy, setSuppressAutoDeploy] = createSignal(false);
  const plies = PATH_COLLIDE_ALLY_MINE_PLY_SC;
  let deployWait = 0;

  const mines = () => planningSnapshot()?.mines ?? plies[turnIndex()]?.mines ?? [];

  const prepare = () => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
  };

  const showPosition = (index: number) => {
    window.clearTimeout(deployWait);
    combat.clear();
    setSuppressAutoDeploy(true);
    applySnap(plies[index]!);
    setTurnIndex(index);
    setPlaying(false);
    setCaption(
      index === 0 ? START_CAPTION : PATH_COLLIDE_ALLY_MINE_STEPS[index - 1]!.caption,
    );
    queueMicrotask(() => setSuppressAutoDeploy(false));
  };

  const finishTurn = (indexPlaying: number, next: ScFenSnapshot) => {
    setSuppressAutoDeploy(true);
    applySnap(next);
    setTurnIndex(indexPlaying + 1);
    setPlaying(false);
    setCaption(PATH_COLLIDE_ALLY_MINE_STEPS[indexPlaying]!.caption);
    queueMicrotask(() => setSuppressAutoDeploy(false));
  };

  const playTurn = (indexPlaying: number) => {
    const step = PATH_COLLIDE_ALLY_MINE_STEPS[indexPlaying];
    const before = plies[indexPlaying];
    if (!step || !before) return;

    window.clearTimeout(deployWait);
    combat.clear();
    setPlaying(true);
    setCaption(step.caption);

    const queued = queuePathCollideAllyMineStep(before, step);
    const { resolved, next, afterB } = endScTurn(queued);

    const startCombat = () => {
      combat.playResolve(resolved, {
        startPlacement: afterB.placement,
        livesBefore: before.kingLives,
        commit: (snap) => {
          loadFen(toClassicFen(snap.placement, "w", 0, Math.max(1, before.turn + 1)));
          setPlanningSnapshot({
            ...(planningSnapshot() ?? before),
            placement: snap.placement,
            kingLives: { ...snap.kingLives },
            ...(snap.mines.length ? { mines: [...snap.mines] } : { mines: undefined }),
          });
        },
        onDone: () => {
          setSiegedRooks(next.siegedRooks ?? []);
          finishTurn(indexPlaying, next);
        },
      });
    };

    // Re-baseline on `before`, then clear suppress so post-B spawn / mine deploy can run.
    setSuppressAutoDeploy(true);
    applySnap(before);
    queueMicrotask(() => {
      setSuppressAutoDeploy(false);
      const placementChanged = afterB.placement !== before.placement;
      const minesChanged = minesKey(afterB.mines) !== minesKey(before.mines);
      if (!placementChanged && !minesChanged) {
        startCombat();
        return;
      }
      queueMicrotask(() => {
        setPlanningSnapshot({
          ...before,
          placement: afterB.placement,
          ...(afterB.mines.length ? { mines: afterB.mines } : { mines: undefined }),
        });
        loadFen(toClassicFen(afterB.placement, "w", 0, Math.max(1, before.turn)));
        const waitMs = Math.max(
          placementChanged ? DEPLOY_MS : 0,
          minesChanged ? MINE_DEPLOY_MS : 0,
        );
        deployWait = window.setTimeout(startCombat, waitMs);
      });
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
      window.clearTimeout(deployWait);
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
          suppressAutoDeploy={suppressAutoDeploy()}
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
      <p class={styles.caption}>Review · Path collide (ally mine) · {caption()}</p>
    </div>
  );
};
