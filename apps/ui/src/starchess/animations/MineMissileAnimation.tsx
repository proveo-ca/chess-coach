import { For, type Component, type JSX } from "solid-js";
import type { Square } from "chess.js";

import {
  cellSize,
  squareBoxStyle,
} from "~/starchess/animations/attackAnim";
import {
  aimPoseFor,
  aimTransformCss,
  screenAngleDeg,
} from "~/starchess/animations/attackVectors";
import { vecBetween } from "~/starchess/animations/boardGeom";
import styles from "~/starchess/animations/MineMissileAnimation.module.css";
import { SpiderMine } from "~/starchess/specials/SpiderMine";
import {
  MINE_MISSILE_LAUNCH_MS,
  MINE_MISSILE_LIFT_MS,
  MINE_MISSILE_MS,
  MINE_TRAIL_MS,
} from "~/starchess/constants";
import type { MineMissileCue, QueenJumpTrail } from "~/types/starchess";

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

const missileGeom = (from: Square, to: Square, boardWidth: number, boardHeight: number) => {
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

export type MineMissileAnimationProps = {
  /** Self-missile hulls (chaseFrom → detonation square). */
  cues: MineMissileCue[];
  /** Single green thruster trails (queen/battlecruiser palette). */
  trails: QueenJumpTrail[];
  boardWidth: number;
  boardHeight: number;
};

/**
 * Spider Mine chase missile — after the victim lands: lift
 * ({@link MINE_MISSILE_LIFT_MS}) then launch ({@link MINE_MISSILE_LAUNCH_MS})
 * along a green trail (total {@link MINE_MISSILE_MS}).
 */
export const MineMissileAnimation: Component<MineMissileAnimationProps> = (props) => (
  <div
    class={styles.boardOverlay}
    data-starchess-mine-missile-layer
    style={{
      inset: "0",
      "--mine-missile-ms": `${MINE_MISSILE_MS}ms`,
      "--mine-missile-lift-ms": `${MINE_MISSILE_LIFT_MS}ms`,
      "--mine-missile-launch-ms": `${MINE_MISSILE_LAUNCH_MS}ms`,
      "--mine-trail-ms": `${MINE_TRAIL_MS}ms`,
    }}
  >
    <For each={props.trails}>
      {(trail) => {
        const g = () => missileGeom(trail.from, trail.to, props.boardWidth, props.boardHeight);
        return (
          <div
            class={styles.trailFrame}
            style={{
              ...squareBoxStyle(trail.from, props.boardWidth, props.boardHeight),
              transform: aimTransformCss(g().pose),
              "--mine-span": `${g().span}px`,
            }}
            data-square={trail.from}
            data-mine-trail-frame={trail.id}
          >
            <div class={styles.trail} data-mine-trail />
          </div>
        );
      }}
    </For>

    <For each={props.cues}>
      {(cue) => {
        const g = () => missileGeom(cue.from, cue.to, props.boardWidth, props.boardHeight);
        const zero = () => cue.from === cue.to || g().span < 1;
        return (
          <BoardFx
            class={styles.travel}
            style={{
              ...squareBoxStyle(cue.from, props.boardWidth, props.boardHeight),
              "--mine-span": `${g().span}px`,
            }}
          >
            <div class={styles.lift} data-mine-lift>
              <div
                class={styles.aimed}
                style={zero() ? undefined : { transform: aimTransformCss(g().pose) }}
              >
                <div
                  class={styles.hull}
                  classList={{ [styles.hullStationary]: zero() }}
                  data-square={cue.from}
                  data-mine-missile={cue.id}
                  data-mine-deg={g().deg}
                >
                  <SpiderMine color={cue.color} state="missile" />
                </div>
              </div>
            </div>
          </BoardFx>
        );
      }}
    </For>
  </div>
);
