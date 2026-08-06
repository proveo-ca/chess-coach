/**
 * King Hunt — SCFEN + engine-driven. Combat VFX from `endScTurn` → `useStarChessCombat`.
 */

import {
  createMemo,
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
import { intentOverlaysFromQueue } from "~/starchess/intentOverlays";
import { classicFenFromSc, toClassicFen } from "~/starchess/scfen";
import { useStarChessCombat } from "~/starchess/hooks/useStarChessCombat";
import { StarChessBoard } from "~/starchess/StarChessBoard";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import styles from "~/starchess/animations/KingHuntDemo.module.css";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import type { ScAction, ScFenSnapshot } from "~/starchess/types";
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

type NavPhase = "ready" | "intent" | "playing";

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
  const [navPhase, setNavPhase] = createSignal<NavPhase>("ready");
  const [intentQueue, setIntentQueue] = createSignal<readonly ScAction[]>([]);
  const plies = KING_HUNT_PLY_SC;

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
    resetStarChessEconomy({ turn: 0, startTimer: false, kingLives: { w: 3, b: 3 } });
  };

  const showPosition = (index: number) => {
    combat.clear();
    setIntentQueue([]);
    const snap = plies[index]!;
    applySnap(snap);
    combat.syncKingDamageFromBoard(snap.placement, snap.kingLives);
    setTurnIndex(index);
    setNavPhase("ready");
    setCaption(index === 0 ? START_CAPTION : KING_HUNT_STEPS[index - 1]!.caption);
  };

  const finishTurn = (indexPlaying: number, next: ScFenSnapshot) => {
    setIntentQueue([]);
    applySnap(next);
    combat.syncKingDamageFromBoard(next.placement, next.kingLives);
    setTurnIndex(indexPlaying + 1);
    setNavPhase("ready");
    setCaption(KING_HUNT_STEPS[indexPlaying]!.caption);
  };

  const showIntent = (indexPlaying: number) => {
    const step = KING_HUNT_STEPS[indexPlaying];
    const before = plies[indexPlaying];
    if (!step || !before) return;

    combat.clear();
    applySnap(before);
    const queued = queueKingHuntStep(before, step);
    // Placement unchanged — only Q: carries intent (ghost overlays).
    setPlanningSnapshot(queued);
    setIntentQueue(queued.queue?.actions ?? []);
    setNavPhase("intent");
    setCaption(`Intent · ${step.caption}`);
  };

  const resolveIntent = (indexPlaying: number) => {
    const step = KING_HUNT_STEPS[indexPlaying];
    const before = plies[indexPlaying];
    if (!step || !before) return;

    combat.clear();
    setIntentQueue([]);
    setNavPhase("playing");
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

  const livesLabel = () => {
    const lives = kingLives().w;
    const state = kingDamageStateForLives(lives);
    return `${lives} ${lives === 1 ? "life" : "lives"} · ${state}`;
  };

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <StarChessBoard
          variant="eclipse"
          fogOfWar
          intentDestinations={ghosts().destinations}
          intentCanisters={ghosts().canisters}
          intentChecks={ghosts().checks}
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
          label={`${navLabel()} · ${livesLabel()}`}
          onBack={goBack}
          onForward={goForward}
          backDisabled={busy() || (navPhase() === "ready" && turnIndex() <= 0)}
          forwardDisabled={busy() || (navPhase() === "ready" && turnIndex() >= TOTAL_TURNS)}
        />
      </div>
      <p class={styles.caption} data-king-damage={kingDamageStateForLives(kingLives().w)}>
        Review · King hunt · {caption()}
      </p>
    </div>
  );
};
