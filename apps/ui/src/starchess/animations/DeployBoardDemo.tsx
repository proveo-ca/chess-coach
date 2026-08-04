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
  type DeployPiece,
} from "~/starchess/animations/deployAnim";
import styles from "~/starchess/animations/DeployBoardDemo.module.css";
import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setNerdModeUnlocked, setPlayerIdentity } from "~/store/settingsStore";

type DeployPhase = "idle" | "falling" | "landed";

type DeployBoardDemoProps = {
  piece: DeployPiece;
};

/**
 * Storybook harness: put the unit on the board → StarChessChessBoard auto-deploy.
 */
export const DeployBoardDemo: Component<DeployBoardDemoProps> = (props) => {
  const [phase, setPhase] = createSignal<DeployPhase>("idle");

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
    setPhase("idle");
    loadFen(DEPLOY_FEN_EMPTY);
    stepTimer = window.setTimeout(() => {
      setPhase("falling");
      // Occupancy change triggers board auto-deploy (hide + DeployAnimation).
      loadFen(DEPLOY_FEN_LANDED[props.piece]);
      stepTimer = window.setTimeout(() => {
        setPhase("landed");
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
        <StarChessChessBoard variant="eclipse" fogOfWar />
      </div>
      <p class={styles.caption} data-phase={phase()}>
        {label()} · {phase()} · {DEPLOY_MS}ms
      </p>
    </div>
  );
};
