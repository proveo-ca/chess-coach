import { For, type Component, type JSX } from "solid-js";

import {
  DEPLOY_DROP_MS,
  DEPLOY_LAND_MS,
  DEPLOY_MS,
  DEPLOY_THRUST_MS,
  MECHANOID_THRUST,
  deployKindFor,
} from "~/starchess/animations/deployAnim";
import styles from "~/starchess/animations/DeployAnimation.module.css";
import { squareBoxStyle } from "~/starchess/animations/boardGeom";
import { InlineBishop } from "~/starchess/animations/pieces/InlineBishop";
import { InlineKnight } from "~/starchess/animations/pieces/InlineKnight";
import { InlinePawn } from "~/starchess/animations/pieces/InlinePawn";
import { InlineQueen } from "~/starchess/animations/pieces/InlineQueen";
import { InlineRook } from "~/starchess/animations/pieces/InlineRook";
import { TEAM_PRIMARY, type PieceColor } from "~/starchess/animations/teamColors";
import type { StarChessPiece, DeployCue } from "~/types/starchess";

const hull = (piece: StarChessPiece, color: PieceColor): JSX.Element | null => {
  switch (piece) {
    case "p":
      return <InlinePawn color={color} face="back" />;
    case "b":
      return <InlineBishop color={color} face="back" />;
    case "n":
      return <InlineKnight color={color} />;
    case "r":
      return <InlineRook color={color} />;
    case "q":
      return <InlineQueen color={color} />;
    default:
      return null;
  }
};

export type DeployAnimationProps = {
  cues: DeployCue[];
  boardWidth: number;
  boardHeight: number;
};

/**
 * Command Center deploy VFX — drop from above into `at`.
 * Humanoid: {@link DEPLOY_DROP_MS} fall + {@link DEPLOY_LAND_MS} crouch.
 * Mechanoid: same split with thrust brake on landing.
 * Total {@link DEPLOY_MS}; board FEN / fog should update only after the cue ends.
 */
export const DeployAnimation: Component<DeployAnimationProps> = (props) => (
  <div
    class={styles.boardOverlay}
    data-starchess-deploy-layer
    style={{
      inset: "0",
      width: "100%",
      height: "100%",
      "--deploy-ms": `${DEPLOY_MS}ms`,
      "--deploy-drop-ms": `${DEPLOY_DROP_MS}ms`,
      "--deploy-land-ms": `${DEPLOY_LAND_MS}ms`,
      "--thrust-ms": `${DEPLOY_THRUST_MS}ms`,
      /* Start well above the board so the drop reads clearly. */
      "--fall-from": `${Math.max(props.boardHeight, 320) + 48}px`,
    }}
  >
    <For each={props.cues}>
      {(cue) => {
        const kind = deployKindFor(cue.piece);
        if (!kind) return null;
        const thrust =
          kind === "mechanoid" && (cue.piece === "n" || cue.piece === "r" || cue.piece === "q")
            ? MECHANOID_THRUST[cue.piece]
            : null;
        return (
          <div
            class={styles.slot}
            classList={{
              [styles.humanoid]: kind === "humanoid",
              [styles.mechanoid]: kind === "mechanoid",
              [styles.mechanoidHeavy]: cue.piece === "r" || cue.piece === "q",
            }}
            style={{
              ...squareBoxStyle(cue.at, props.boardWidth, props.boardHeight),
              ...(thrust === "team"
                ? { "--thrust-team": TEAM_PRIMARY[cue.color] }
                : {}),
            }}
            data-deploy-piece={cue.piece}
            data-deploy-kind={kind}
          >
            <div class={styles.hull}>{hull(cue.piece, cue.color)}</div>
            {thrust === "air" && <span class={`${styles.thrust} ${styles.thrustAir}`} />}
            {thrust === "fuel" && (
              <span class={`${styles.thrust} ${styles.thrustFuel} ${styles.thrustLow}`} />
            )}
            {thrust === "team" && (
              <span class={`${styles.thrust} ${styles.thrustTeam} ${styles.thrustLow}`} />
            )}
          </div>
        );
      }}
    </For>
  </div>
);
