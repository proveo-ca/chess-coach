import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";

import styles from "~/broodwar/animations/DeathAnimations.module.css";
import {
  DEATH_MS,
  FEN_BY_PIECE,
  HOLD_MS,
  IDLE_MS,
  ORIGIN,
  type DeathPiece,
} from "~/broodwar/animations/deathAnim";
import type { DeathCue } from "~/broodwar/animations/types";
import { ChessBoard } from "~/components/features/ChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setNerdModeUnlocked, setPlayerIdentity } from "~/store/settingsStore";

/** Empty d4 after death (kings + spare rook so FEN stays loadable). */
const FEN_GONE: Record<DeathPiece, string> = {
  p: "r6k/8/8/8/8/8/8/K6R w - - 0 1",
  n: "r6k/8/8/8/8/8/8/K6R w - - 0 1",
  b: "r6k/8/8/8/8/8/8/K6R w - - 0 1",
  r: "r6k/8/8/8/8/8/8/K6R w - - 0 1",
  q: "r6k/8/8/8/8/8/8/K6R w - - 0 1",
  k: "r6k/8/8/8/8/8/8/7R w - - 0 1",
};

type DeathPhase = "idle" | "dying" | "gone";

type DeathBoardDemoProps = {
  piece: DeathPiece;
};

/**
 * Storybook harness: plays death cues through ChessBoard's production
 * `deathCues` → `DeathAnimation` layer.
 */
export const DeathBoardDemo: Component<DeathBoardDemoProps> = (props) => {
  const [phase, setPhase] = createSignal<DeathPhase>("idle");
  const [cue, setCue] = createSignal<DeathCue | null>(null);

  let stepTimer = 0;
  let loopTimer = 0;

  const prepare = () => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    loadFen(FEN_BY_PIECE[props.piece]);
  };

  const runOnce = () => {
    window.clearTimeout(stepTimer);
    setCue(null);
    setPhase("idle");
    loadFen(FEN_BY_PIECE[props.piece]);
    stepTimer = window.setTimeout(() => {
      setPhase("dying");
      setCue({
        id: `story-death-${props.piece}-${Date.now()}`,
        piece: props.piece,
        color: "w",
        at: ORIGIN,
      });
      stepTimer = window.setTimeout(() => {
        setCue(null);
        setPhase("gone");
        loadFen(FEN_GONE[props.piece]);
      }, DEATH_MS);
    }, IDLE_MS);
  };

  const armLoop = () => {
    window.clearInterval(loopTimer);
    runOnce();
    loopTimer = window.setInterval(runOnce, IDLE_MS + DEATH_MS + HOLD_MS);
  };

  onMount(() => {
    prepare();
  });

  createEffect(() => {
    void props.piece;
    prepare();
    armLoop();
    onCleanup(() => {
      window.clearInterval(loopTimer);
      window.clearTimeout(stepTimer);
    });
  });

  const dramatic = () => props.piece !== "p";
  const phaseLabel = () => {
    if (phase() === "idle") return "idle";
    if (phase() === "dying") return dramatic() ? "boom + shards" : "bubble rip";
    return "gone";
  };

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <ChessBoard
          variant="eclipse"
          fogOfWar
          deathCues={cue() ? [cue()!] : []}
        />
      </div>
      <p class={styles.caption}>
        Brood War · {props.piece.toUpperCase()} death · {phaseLabel()}
        {dramatic() ? " · 500ms shatter" : " · 500ms outward pop"} · ChessBoard deathCues
      </p>
    </div>
  );
};
