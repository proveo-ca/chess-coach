import { createEffect, createSignal, on, type Component } from "solid-js";

import {
  DEPLOY_FEN_EMPTY,
  DEPLOY_FEN_LANDED,
  DEPLOY_MS,
  type DeployPiece,
} from "~/presentation/animations/deployAnim";
import styles from "~/presentation/animations/components/DeployBoardDemo.module.css";
import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import { createPhaseLoop } from "~/presentation/animations/phaseLoop";
import { Screen } from "@chess-coach/ui-web/primitives/Screen";
import type { DeployCue } from "~/presentation/types";

const DEMO_ORIGIN = "e4" as const;
const FALL_AT_MS = 400;
const LOOP_TAIL_MS = 900;

type DeployPhase = "idle" | "falling" | "landed";

export const DeployBoardDemo: Component<{ piece: DeployPiece }> = (props) => {
  const [phase, setPhase] = createSignal<DeployPhase>("idle");
  const [fen, setFen] = createSignal(DEPLOY_FEN_EMPTY);
  const [cues, setCues] = createSignal<DeployCue[]>([]);
  const [hide, setHide] = createSignal<string[]>([]);

  createEffect(
    on(
      () => props.piece,
      (piece) =>
        createPhaseLoop(
          [
            [
              0,
              () => {
                setPhase("idle");
                setFen(DEPLOY_FEN_EMPTY);
                setCues([]);
                setHide([]);
              },
            ],
            [
              FALL_AT_MS,
              () => {
                setPhase("falling");
                setFen(DEPLOY_FEN_LANDED[piece]);
                setHide([DEMO_ORIGIN]);
                setCues([{ id: `deploy-${piece}`, piece, color: "w", at: DEMO_ORIGIN }]);
              },
            ],
            [
              FALL_AT_MS + DEPLOY_MS,
              () => {
                setPhase("landed");
                setCues([]);
                setHide([]);
              },
            ],
          ],
          DEPLOY_MS + LOOP_TAIL_MS,
        ),
    ),
  );

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
