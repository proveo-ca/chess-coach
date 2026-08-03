import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";

import {
  DEPLOY_FEN_EMPTY,
  DEPLOY_FEN_LANDED,
  DEPLOY_MS,
  DEPLOY_ORIGIN,
  makeDeployCue,
  type DeployPiece,
} from "~/starchess/animations/deployAnim";
import styles from "~/starchess/animations/DeployBoardDemo.module.css";
import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { loadFen } from "~/store/gameStore";
import type { DeployCue } from "~/types/starchess";
import { setActivePlayerColor, setNerdModeUnlocked, setPlayerIdentity } from "~/store/settingsStore";

type DeployPhase = "idle" | "falling" | "landed";

type DeployBoardDemoProps = {
  piece: DeployPiece;
};

/**
 * Storybook harness: deploy drop through ChessBoard `deployCues`.
 * FEN / fog update only after {@link DEPLOY_MS}.
 */
export const DeployBoardDemo: Component<DeployBoardDemoProps> = (props) => {
  const [phase, setPhase] = createSignal<DeployPhase>("idle");
  const [cue, setCue] = createSignal<DeployCue | null>(null);

  let stepTimer = 0;
  let loopTimer = 0;

  const prepare = () => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    loadFen(DEPLOY_FEN_EMPTY);
  };

  const runOnce = () => {
    window.clearTimeout(stepTimer);
    setCue(null);
    setPhase("idle");
    loadFen(DEPLOY_FEN_EMPTY);
    stepTimer = window.setTimeout(() => {
      setPhase("falling");
      setCue(makeDeployCue(props.piece, "w", DEPLOY_ORIGIN));
      stepTimer = window.setTimeout(() => {
        setCue(null);
        setPhase("landed");
        loadFen(DEPLOY_FEN_LANDED[props.piece]);
      }, DEPLOY_MS);
    }, 400);
  };

  onMount(() => {
    prepare();
    runOnce();
    loopTimer = window.setInterval(runOnce, DEPLOY_MS + 900);
    onCleanup(() => {
      window.clearTimeout(stepTimer);
      window.clearInterval(loopTimer);
    });
  });

  createEffect(() => {
    void props.piece;
    prepare();
    runOnce();
  });

  const label = () => {
    const p = props.piece;
    if (p === "p") return "Marine · humanoid crouch landing";
    if (p === "b") return "Goliath · humanoid crouch landing";
    if (p === "n") return "Vulture · air thrusters";
    if (p === "r") return "Tank · fuel thrusters";
    return "Battlecruiser · team-color thrusters";
  };

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <StarChessChessBoard
          variant="eclipse"
          fogOfWar
          deployCues={cue() ? [cue()!] : []}
        />
      </div>
      <p class={styles.caption} data-phase={phase()}>
        {label()} · {phase()} · {DEPLOY_MS}ms
      </p>
    </div>
  );
};
