/**
 * SCFEN DualNav with intent ghosts → resolve.
 * Fog-edge collision + fog/move vision samples.
 * // SPEC: _spec/apps/ui/starchess/resolve.puml, _spec/apps/ui/starchess/demos.puml
 */

import { createMemo, createSignal, onCleanup, onMount, type Component } from "solid-js";
import type { Square } from "chess.js";

import type { FogEdgeScenario } from "~/starchess/demos/fogEdgeScenario";
import { endScTurn } from "~/starchess/endScTurn";
import { intentOverlaysFromQueue } from "~/starchess/intentOverlays";
import { classicFenFromSc, toClassicFen } from "~/starchess/scfen";
import {
  clearSiegedRooks,
  planningSnapshot,
  setPlanningSnapshot,
  setRookMode,
} from "~/starchess/starChessStore";
import { useStarChessCombat } from "~/starchess/hooks/useStarChessCombat";
import { StarChessBoard } from "~/starchess/StarChessBoard";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import styles from "~/starchess/animations/FogEdgeDemo.module.css";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import type { ScAction, ScFenSnapshot } from "~/starchess/types";
import { loadFen, setViewIndex } from "~/store/gameStore";
import { setActivePlayerColor, setPlayerIdentity } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";

export type FogEdgeDemoProps = {
  /** Pre-built SCFEN DualNav package from `demos/*` — stories feed this only. */
  scenario: FogEdgeScenario;
};

type NavPhase = "ready" | "intent" | "playing";

export const FogEdgeDemo: Component<FogEdgeDemoProps> = (props) => {
  const combat = useStarChessCombat();
  const scenario = () => props.scenario;
  const [caption, setCaption] = createSignal(scenario().startCaption);
  const [turnIndex, setTurnIndex] = createSignal(0);
  const [navPhase, setNavPhase] = createSignal<NavPhase>("ready");
  const [intentQueue, setIntentQueue] = createSignal<readonly ScAction[]>([]);
  /** DualNav scrub — re-baseline without deploy VFX (fogged enemies must stay hidden). */
  const [suppressAutoDeploy, setSuppressAutoDeploy] = createSignal(false);
  const total = () => scenario().steps.length;

  const ghosts = createMemo(() => {
    if (navPhase() !== "intent") return { destinations: [], canisters: [], checks: [] };
    return intentOverlaysFromQueue(intentQueue(), {
      placement: planningSnapshot()?.placement,
      siegedRooks: planningSnapshot()?.siegedRooks,
    });
  });

  const applySnap = (snap: ScFenSnapshot) => {
    setPlanningSnapshot(snap);
    clearSiegedRooks();
    loadFen(classicFenFromSc(snap, "w"));
    setViewIndex(snap.turn);
    if (scenario().rookTank) {
      const files = "abcdefgh";
      const ranks = snap.placement.split("/");
      for (let r = 0; r < 8; r++) {
        let file = 0;
        for (const ch of ranks[r]!) {
          if (ch >= "1" && ch <= "8") {
            file += Number(ch);
            continue;
          }
          if (ch === "R" || ch === "r") {
            setRookMode(`${files[file]}${8 - r}` as Square, "tank");
          }
          file += 1;
        }
      }
    }
  };

  const clearIntent = () => {
    setIntentQueue([]);
    setNavPhase("ready");
  };

  const showPosition = (index: number) => {
    combat.clear();
    clearIntent();
    setSuppressAutoDeploy(true);
    applySnap(scenario().plies[index]!);
    setTurnIndex(index);
    setCaption(
      index === 0 ? scenario().startCaption : scenario().steps[index - 1]!.caption,
    );
    queueMicrotask(() => setSuppressAutoDeploy(false));
  };

  const finishTurn = (indexPlaying: number, next: ScFenSnapshot) => {
    clearIntent();
    setSuppressAutoDeploy(true);
    applySnap(next);
    setTurnIndex(indexPlaying + 1);
    setCaption(scenario().steps[indexPlaying]!.caption);
    queueMicrotask(() => setSuppressAutoDeploy(false));
  };

  const showIntent = (indexPlaying: number) => {
    const step = scenario().steps[indexPlaying];
    const before = scenario().plies[indexPlaying];
    if (!step || !before) return;

    combat.clear();
    applySnap(before);
    const queued = scenario().queueStep(before, indexPlaying);
    // Placement unchanged — only Q: carries intent (ghost overlays).
    setPlanningSnapshot(queued);
    setIntentQueue(queued.queue?.actions ?? []);
    setNavPhase("intent");
    setCaption(step.intentCaption ?? `Intent · ${step.caption}`);
  };

  const resolveIntent = (indexPlaying: number) => {
    const step = scenario().steps[indexPlaying];
    const before = scenario().plies[indexPlaying];
    if (!step || !before) return;

    const queued = scenario().queueStep(before, indexPlaying);
    const { resolved, next, afterB } = endScTurn(queued);

    setIntentQueue([]);
    setNavPhase("playing");
    setCaption(step.caption);
    setPlanningSnapshot({
      ...queued,
      queue: { actions: [] },
      placement: afterB.placement,
      ...(afterB.mines.length ? { mines: afterB.mines } : { mines: undefined }),
    });

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

  onMount(() => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
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
      clearSiegedRooks();
    });
  });

  const review = () => scenario().reviewLabel ?? "Fog edge";
  const busy = () => navPhase() === "playing";

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <StarChessBoard
          variant="eclipse"
          fogOfWar
          suppressNativeMoves
          suppressAutoDeploy={suppressAutoDeploy()}
          intentDestinations={ghosts().destinations}
          intentCanisters={ghosts().canisters}
          intentChecks={ghosts().checks}
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
          forwardDisabled={busy() || (navPhase() === "ready" && turnIndex() >= total())}
        />
      </div>
      <p class={styles.caption}>
        Review · {review()} · {caption()}
      </p>
    </div>
  );
};
