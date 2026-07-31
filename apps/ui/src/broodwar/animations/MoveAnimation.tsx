import { For, Show, type Component, type JSX } from "solid-js";

import {
  ROOK_REST_AIM_DEG,
  KING_REST_AIM_DEG,
} from "~/broodwar/animations/attackAnim";
import {
  aimPoseFor,
  aimTransformCss,
  knightLegVecs,
  squareAt,
} from "~/broodwar/animations/attackVectors";
import { squareBoxStyle, vecBetween } from "~/broodwar/animations/boardGeom";
import styles from "~/broodwar/animations/MoveAnimation.module.css";
import { InlineBishop } from "~/broodwar/animations/pieces/InlineBishop";
import { InlineKing } from "~/broodwar/animations/pieces/InlineKing";
import { InlineKnight } from "~/broodwar/animations/pieces/InlineKnight";
import { InlinePawn } from "~/broodwar/animations/pieces/InlinePawn";
import { InlineQueen } from "~/broodwar/animations/pieces/InlineQueen";
import { InlineRook } from "~/broodwar/animations/pieces/InlineRook";
import type { MoveCue } from "~/broodwar/animations/types";
import { MOVE_MS } from "~/broodwar/constants";

export type MoveAnimationProps = {
  cues: readonly MoveCue[];
  /** 0 = still on `from`, 1 = sliding / on `to`. */
  progress: Record<string, 0 | 1>;
  /** Knight L-path facing: 0 = long leg, 1 = short leg (after elbow). */
  leg?: Record<string, 0 | 1>;
  boardWidth: number;
  boardHeight: number;
};

const moverNode = (m: MoveCue): JSX.Element => {
  switch (m.piece) {
    case "b":
      return <InlineBishop color={m.color} face="front" />;
    case "r":
      return <InlineRook color={m.color} aimDeg={ROOK_REST_AIM_DEG} />;
    case "n":
      return <InlineKnight color={m.color} />;
    case "q":
      return <InlineQueen color={m.color} />;
    case "k":
      return <InlineKing color={m.color} aimDeg={KING_REST_AIM_DEG} />;
    default:
      return <InlinePawn color={m.color} face="back" />;
  }
};

/** Origin box + L-path translate offsets (long leg → elbow → short leg). */
const knightMoverStyle = (
  from: MoveCue["from"],
  to: MoveCue["to"],
  boardWidth: number,
  boardHeight: number,
): Record<string, string> | null => {
  const vec = vecBetween(from, to);
  const { leg1 } = knightLegVecs(vec);
  const elbowSq = squareAt(from, leg1);
  if (!elbowSq) return null;
  const origin = squareBoxStyle(from, boardWidth, boardHeight);
  const elbow = squareBoxStyle(elbowSq, boardWidth, boardHeight);
  const dest = squareBoxStyle(to, boardWidth, boardHeight);
  const ox = Number.parseFloat(origin.left);
  const oy = Number.parseFloat(origin.top);
  return {
    ...origin,
    "--kx1": `${Number.parseFloat(elbow.left) - ox}px`,
    "--ky1": `${Number.parseFloat(elbow.top) - oy}px`,
    "--kx2": `${Number.parseFloat(dest.left) - ox}px`,
    "--ky2": `${Number.parseFloat(dest.top) - oy}px`,
  };
};

/**
 * Quiet / occupy slide hulls. ChessBoard hides board `<img>` on `from`
 * while a cue is active (fxHidden). Knights use the L-path CSS animation.
 */
export const MoveAnimation: Component<MoveAnimationProps> = (props) => (
  <div
    class={styles.boardOverlay}
    data-broodwar-move-layer
    style={{ inset: "0", "--move-ms": `${MOVE_MS}ms` }}
  >
    <For each={[...props.cues]}>
      {(m) => {
        if (m.piece === "n") {
          const legs = () => knightLegVecs(vecBetween(m.from, m.to));
          const hasL = () => squareAt(m.from, legs().leg1) != null;
          const started = () => props.progress[m.id] === 1;
          const pose = () => {
            const { leg1, leg2 } = legs();
            return aimPoseFor((props.leg?.[m.id] ?? 0) === 1 ? leg2 : leg1);
          };
          return (
            <Show
              when={hasL()}
              fallback={
                <div
                  class={styles.mover}
                  style={squareBoxStyle(
                    props.progress[m.id] === 1 ? m.to : m.from,
                    props.boardWidth,
                    props.boardHeight,
                  )}
                  data-square={props.progress[m.id] === 1 ? m.to : m.from}
                  data-move-id={m.id}
                >
                  <div class={styles.pieceFace}>{moverNode(m)}</div>
                </div>
              }
            >
              <div
                class={styles.mover}
                classList={{ [styles.moverKnight]: started() }}
                style={knightMoverStyle(m.from, m.to, props.boardWidth, props.boardHeight) ?? undefined}
                data-square={m.from}
                data-move-id={m.id}
              >
                <div
                  class={`${styles.pieceFace} ${styles.moverFace}`}
                  style={{ transform: aimTransformCss(pose()) }}
                >
                  {moverNode(m)}
                </div>
              </div>
            </Show>
          );
        }

        const sq = () => (props.progress[m.id] === 1 ? m.to : m.from);
        return (
          <div
            class={styles.mover}
            style={squareBoxStyle(sq(), props.boardWidth, props.boardHeight)}
            data-square={sq()}
            data-move-id={m.id}
          >
            <div class={styles.pieceFace}>{moverNode(m)}</div>
          </div>
        );
      }}
    </For>
  </div>
);
