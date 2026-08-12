// SPEC: _spec/apps/starchess/architecture/board-entities.puml
import { For, type Component, type JSX } from "solid-js";
import type { Square } from "chess.js";

import {
  cellSize,
  centeredBoxStyle,
  squareBoxStyle,
} from "~/presentation/animations/attackAnim";
import {
  aimPoseFor,
  aimTransformCss,
  screenAngleDeg,
  squareCenterPx,
} from "~/presentation/animations/attackVectors";
import { vecBetween } from "~/presentation/animations/boardGeom";
import { InlineQueen } from "~/presentation/animations/pieces/components/InlineQueen";
import styles from "~/presentation/animations/components/QueenJumpAnimation.module.css";
import type { MoveCue } from "~/presentation/animations/types";
import {
  TACTICAL_JUMP_APPEAR_MS,
  TACTICAL_JUMP_TRAIL_MS,
  TACTICAL_JUMP_TRAVEL_MS,
} from "~/presentation/specials/queenTacticalJump";
import type { QueenJumpTrail } from "~/presentation/types";

type BoardFxProps = {
  class: string;
  style: Record<string, string>;
  children?: JSX.Element;
};

const BoardFx: Component<BoardFxProps> = (props) => (
  <div class={`${styles.boardFx} ${props.class}`} style={props.style} aria-hidden="true">
    {props.children}
  </div>
);

const jumpGeom = (from: Square, to: Square, boardWidth: number, boardHeight: number) => {
  const vec = vecBetween(from, to);
  const { w: cell } = cellSize({ width: boardWidth, height: boardHeight });
  return {
    vec,
    pose: aimPoseFor(vec),
    deg: screenAngleDeg(vec),
    span: cell * Math.hypot(vec.df, vec.dr),
    cell,
  };
};

export type QueenJumpAnimationProps = {
  /** Active teleport hull/appear cues (0–250ms); also own fx-hidden squares. */
  cues: MoveCue[];
  /** Long-lived green thruster trails (1000ms); do not hide board pieces. */
  trails: QueenJumpTrail[];
  boardWidth: number;
  boardHeight: number;
};

/**
 * BattleShip Tactical Jump — 200ms stretched-thin light travel, 50ms appear
 * burst on the destination, and 1000ms fading twin thruster trails.
 */
export const QueenJumpAnimation: Component<QueenJumpAnimationProps> = (props) => (
  <div
    class={styles.boardOverlay}
    data-starchess-jump-layer
    style={{
      inset: "0",
      "--jump-ms": `${TACTICAL_JUMP_TRAVEL_MS}ms`,
      "--jump-appear-ms": `${TACTICAL_JUMP_APPEAR_MS}ms`,
      "--jump-trail-ms": `${TACTICAL_JUMP_TRAIL_MS}ms`,
    }}
  >
    <For each={props.trails}>
      {(trail) => {
        const g = () => jumpGeom(trail.from, trail.to, props.boardWidth, props.boardHeight);
        return (
          <div
            class={styles.jumpTrailFrame}
            style={{
              ...squareBoxStyle(trail.from, props.boardWidth, props.boardHeight),
              transform: aimTransformCss(g().pose),
              "--jump-span": `${g().span}px`,
            }}
            data-square={trail.from}
            data-jump-trail-frame={trail.id}
          >
            <div class={`${styles.jumpTrail} ${styles.jumpTrailA}`} data-jump-trail="a" />
            <div class={`${styles.jumpTrail} ${styles.jumpTrailB}`} data-jump-trail="b" />
          </div>
        );
      }}
    </For>

    <For each={props.cues}>
      {(cue) => {
        const g = () => jumpGeom(cue.from, cue.to, props.boardWidth, props.boardHeight);
        return (
          <>
            <div
              class={styles.jumpTravel}
              style={{
                ...squareBoxStyle(cue.from, props.boardWidth, props.boardHeight),
                transform: aimTransformCss(g().pose),
                "--jump-span": `${g().span}px`,
              }}
              data-square={cue.from}
              data-move-id={cue.id}
              data-jump-piece="q"
              data-jump-deg={g().deg}
            >
              <div class={styles.jumpHull}>
                <InlineQueen color={cue.color} />
              </div>
            </div>
            <BoardFx
              class={styles.jumpAppear}
              style={centeredBoxStyle(
                squareCenterPx(cue.to, props.boardWidth, props.boardHeight),
                g().cell * 1.25,
                g().cell * 1.25,
              )}
            >
              <div class={styles.jumpAppearCore} />
            </BoardFx>
          </>
        );
      }}
    </For>
  </div>
);
