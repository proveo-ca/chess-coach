import { For, Show, type Component, type JSX } from "solid-js";

import {
  attackFaceFor,
  KING_REST_AIM_DEG,
  ROOK_REST_AIM_DEG,
} from "~/starchess/animations/attackAnim";
import {
  aimPoseFor,
  aimTransformCss,
  knightLegVecs,
  rookTravelPose,
  screenAngleDeg,
  squareAt,
  type AttackVec,
} from "~/starchess/animations/attackVectors";
import { squareBoxStyle, vecBetween } from "~/starchess/animations/boardGeom";
import styles from "~/starchess/animations/MoveAnimation.module.css";
import { moveDurationMs, moveTravelSquares } from "~/starchess/animations/moveTiming";
import { InlineBishop, type BishopCrank } from "~/starchess/animations/pieces/InlineBishop";
import { InlineKing } from "~/starchess/animations/pieces/InlineKing";
import { InlineKnight } from "~/starchess/animations/pieces/InlineKnight";
import { InlinePawn } from "~/starchess/animations/pieces/InlinePawn";
import { InlineQueen } from "~/starchess/animations/pieces/InlineQueen";
import { InlineRook } from "~/starchess/animations/pieces/InlineRook";
import type { MoveCue } from "~/starchess/animations/types";
import { rookModeAt } from "~/starchess/starChessStore";
import { MOVE_SQUARE_MS } from "~/starchess/constants";

export type MoveAnimationProps = {
  cues: readonly MoveCue[];
  /** 0 = still on `from`, 1 = sliding / on `to`. */
  progress: Record<string, 0 | 1>;
  /** Knight L-path facing: 0 = long leg, 1 = short leg (after elbow). */
  leg?: Record<string, 0 | 1>;
  boardWidth: number;
  boardHeight: number;
};

/** One hop cycle = right lean + left lean (2 waddles). One cycle per square. */
const pawnHopPlan = (from: MoveCue["from"], to: MoveCue["to"]) => {
  const hops = moveTravelSquares(from, to, "p");
  return { hops, hopMs: MOVE_SQUARE_MS };
};

/** Bishop hull facing — same `face` + `gunDeg` as {@link AttackAnimation}. */
const bishopMoverNode = (m: MoveCue, vec: AttackVec, crank?: BishopCrank): JSX.Element => (
  <InlineBishop
    color={m.color}
    face={attackFaceFor("b", vec)}
    gunDeg={screenAngleDeg(vec)}
    crank={crank}
  />
);

const moverNode = (m: MoveCue): JSX.Element => {
  switch (m.piece) {
    case "b":
      return <InlineBishop color={m.color} face="front" />;
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

/** Straight-line hull travel from `from` → `to` (humanoid walk / hop). */
const slideMoverStyle = (
  from: MoveCue["from"],
  to: MoveCue["to"],
  boardWidth: number,
  boardHeight: number,
): Record<string, string> => {
  const origin = squareBoxStyle(from, boardWidth, boardHeight);
  const dest = squareBoxStyle(to, boardWidth, boardHeight);
  const ox = Number.parseFloat(origin.left);
  const oy = Number.parseFloat(origin.top);
  return {
    ...origin,
    "--mx": `${Number.parseFloat(dest.left) - ox}px`,
    "--my": `${Number.parseFloat(dest.top) - oy}px`,
  };
};

/**
 * Bishop foot aim (SVG y-down, 0° = +file/right).
 * Locked diagonals per product note: top-left 45°, top-right 135°, then
 * continue around the compass (bottom-right 225°, bottom-left 315°).
 * Kept for callers / tests — walk VFX no longer aims feet independently
 * (steam-engine gait keeps feet rigid on the shin).
 */
export const bishopFootAimDeg = (vec: AttackVec): number => {
  const df = Math.sign(vec.df);
  const dr = Math.sign(vec.dr);
  if (df < 0 && dr > 0) return 45; // top-left
  if (df > 0 && dr > 0) return 135; // top-right
  if (df > 0 && dr < 0) return 225; // bottom-right
  if (df < 0 && dr < 0) return 315; // bottom-left
  // Ortho fallback (shouldn't appear on quiet bishop moves).
  return screenAngleDeg(vec);
};

/**
 * Quiet / occupy slide hulls. ChessBoard hides board `<img>` on `from`
 * while a cue is active (fxHidden). Knights use the L-path; pawns hop;
 * bishops steam-engine-walk on articulated legs (feet locked to shins).
 * Hull travel is {@link MOVE_SQUARE_MS} per square (not a fixed total).
 */
export const MoveAnimation: Component<MoveAnimationProps> = (props) => (
  <div
    class={styles.boardOverlay}
    data-starchess-move-layer
    style={{
      inset: "0",
    }}
  >
    <For each={[...props.cues]}>
      {(m) => {
        const started = () => props.progress[m.id] === 1;
        const vec = () => vecBetween(m.from, m.to);
        const travelMs = () => moveDurationMs(m.from, m.to, m.piece);

        if (m.piece === "n") {
          const legs = () => knightLegVecs(vec());
          const hasL = () => squareAt(m.from, legs().leg1) != null;
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
                style={{
                  ...knightMoverStyle(m.from, m.to, props.boardWidth, props.boardHeight),
                  "--move-ms": `${travelMs()}ms`,
                }}
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

        if (m.piece === "p") {
          const { hops, hopMs } = pawnHopPlan(m.from, m.to);
          return (
            <div
              class={styles.mover}
              classList={{ [styles.moverPawn]: started() }}
              style={{
                ...slideMoverStyle(m.from, m.to, props.boardWidth, props.boardHeight),
                "--move-ms": `${travelMs()}ms`,
                "--pawn-hop-ms": `${hopMs}ms`,
                "--hop-count": `${hops}`,
              }}
              data-square={m.from}
              data-move-id={m.id}
              data-move-piece="p"
            >
              <div class={`${styles.pieceFace} ${styles.pawnFace}`}>{moverNode(m)}</div>
            </div>
          );
        }

        if (m.piece === "b") {
          const steps = moveTravelSquares(m.from, m.to, "b");
          // Half as many full wheel turns as squares; each turn spans 2× MOVE_SQUARE_MS.
          const stepCount = Math.max(1, steps / 2);
          const stepMs = MOVE_SQUARE_MS * 2;
          const sense: 1 | -1 = Math.sign(vec().df) >= 0 ? 1 : -1;
          return (
            <div
              class={styles.mover}
              classList={{ [styles.moverBishop]: started() }}
              style={{
                ...slideMoverStyle(m.from, m.to, props.boardWidth, props.boardHeight),
                "--move-ms": `${travelMs()}ms`,
              }}
              data-square={m.from}
              data-move-id={m.id}
              data-move-piece="b"
            >
              <div class={`${styles.pieceFace} ${styles.bishopFace}`}>
                {bishopMoverNode(m, vec(), { stepMs, stepCount, sense })}
              </div>
            </div>
          );
        }

        if (m.piece === "q") {
          return (
            <div
              class={styles.mover}
              classList={{ [styles.moverQueen]: started() }}
              style={{
                ...slideMoverStyle(m.from, m.to, props.boardWidth, props.boardHeight),
                "--move-ms": `${travelMs()}ms`,
              }}
              data-square={m.from}
              data-move-id={m.id}
              data-move-piece="q"
            >
              <div
                class={`${styles.pieceFace} ${styles.moverFace}`}
                style={{ transform: aimTransformCss(aimPoseFor(vec())) }}
              >
                <InlineQueen color={m.color} />
              </div>
            </div>
          );
        }

        if (m.piece === "r") {
          // Rank: rest silhouette. File: mirror only (no 90° tip — hull is ¾ front).
          return (
            <div
              class={styles.mover}
              classList={{ [styles.moverRook]: started() }}
              style={{
                ...slideMoverStyle(m.from, m.to, props.boardWidth, props.boardHeight),
                "--move-ms": `${travelMs()}ms`,
              }}
              data-square={m.from}
              data-move-id={m.id}
              data-move-piece="r"
            >
              <div
                class={`${styles.pieceFace} ${styles.moverFace}`}
                style={{ transform: aimTransformCss(rookTravelPose(vec())) }}
              >
                <InlineRook
                  color={m.color}
                  aimDeg={ROOK_REST_AIM_DEG}
                  mode={rookModeAt(m.from)}
                />
              </div>
            </div>
          );
        }

        const sq = () => (props.progress[m.id] === 1 ? m.to : m.from);
        return (
          <div
            class={styles.mover}
            style={{
              ...squareBoxStyle(sq(), props.boardWidth, props.boardHeight),
              "--move-ms": `${travelMs()}ms`,
            }}
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
