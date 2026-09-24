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
} from "~/presentation/animations/deployAnim";
import styles from "~/presentation/animations/components/DeployBoardDemo.module.css";
import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import { Screen } from "@chess-coach/ui-web/primitives/Screen";
import type { DeployCue } from "~/presentation/types";

type DeployPhase = "idle" | "falling" | "landed";

export const DeployBoardDemo: Component<{ piece: DeployPiece }> = (props) => {
  const [phase, setPhase] = createSignal<DeployPhase>("idle");
  const [fen, setFen] = createSignal(DEPLOY_FEN_EMPTY);
  const [cues, setCues] = createSignal<DeployCue[]>([]);
  const [hide, setHide] = createSignal<string[]>([]);

  let stepTimer = 0;
  let loopTimer = 0;

  const runOnce = () => {
    window.clearTimeout(stepTimer);
    setPhase("idle");
    setFen(DEPLOY_FEN_EMPTY);
    setCues([]);
    setHide([]);
    stepTimer = window.setTimeout(() => {
      setPhase("falling");
      const landed = DEPLOY_FEN_LANDED[props.piece];
      setFen(landed);
      // Origin square for demos is e4 in deployAnim.
      const at = "e4" as const;
      setHide([at]);
      setCues([
        {
          id: `deploy-${props.piece}`,
          piece: props.piece,
          color: "w",
          at,
        },
      ]);
      stepTimer = window.setTimeout(() => {
        setPhase("landed");
        setCues([]);
        setHide([]);
      }, DEPLOY_MS);
    }, 400);
  };

  onMount(() => {
    runOnce();
    loopTimer = window.setInterval(runOnce, DEPLOY_MS + 900);
    onCleanup(() => {
      window.clearTimeout(stepTimer);
      window.clearInterval(loopTimer);
    });
  });

  createEffect(() => {
    void props.piece;
    runOnce();
  });

  const label = () => {
    const p = props.piece;
    if (p === "p") return "Marine · humanoid crouch landing";
    if (p === "b") return "Mecha · humanoid crouch landing";
    if (p === "n") return "Hoverbike · air thrusters";
    if (p === "r") return "Siege Tank · air thrusters";
    return "BattleShip · air thrusters";
  };

  return (
    <Screen>
      <Screen.SidebarInset />
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class={styles.host}>
            <AnimationStage
              fen={fen()}
              fog={false}
              combat={{ deployCues: cues() }}
              hideSquares={hide() as never}
            />
          </div>
        </Screen.BoardColumn>
      </Screen.BoardArea>
      <Screen.Footer>
        <p class={styles.caption}>
          StarChess · {label()} · {phase()} · deployCues
        </p>
      </Screen.Footer>
    </Screen>
  );
};
