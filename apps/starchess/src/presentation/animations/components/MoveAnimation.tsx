// SPEC: _spec/apps/starchess/architecture/board-entities.puml
import { For, Show, createMemo, type Component, type JSX } from "solid-js";
import type { Square } from "chess.js";

import {
  attackFaceFor,
  KING_REST_AIM_DEG,
  ROOK_REST_AIM_DEG,
} from "~/presentation/animations/attackAnim";
import {
  aimPoseFor,
  aimTransformCss,
  knightLegVecs,
  rookTravelPose,
  screenAngleDeg,
  squareAt,
  type AttackVec,
} from "~/presentation/animations/attackVectors";
import { squareBoxStyle, vecBetween } from "~/presentation/animations/boardGeom";
import styles from "~/presentation/animations/components/MoveAnimation.module.css";
import { moveDurationMs, moveTravelSquares } from "~/presentation/animations/moveTiming";
import { InlineBishop, type BishopCrank } from "~/presentation/animations/pieces/components/InlineBishop";
import { InlineKing } from "~/presentation/animations/pieces/components/InlineKing";
import { InlineKnight } from "~/presentation/animations/pieces/components/InlineKnight";
import { InlinePawn } from "~/presentation/animations/pieces/components/InlinePawn";
import { InlineQueen } from "~/presentation/animations/pieces/components/InlineQueen";
import type { MoveCue } from "~/presentation/animations/types";
import { rookModeAt } from "~/presentation/animations/rookModeStore";
import { RookGlyph } from "~/presentation/board/components/RookGlyph";
import { MOVE_SQUARE_MS, STIM_MOVE_SQUARE_MS } from "~/presentation/constants";

const NO_SPECIAL_USED: ReadonlySet<Square> = new Set();

export type MoveAnimationProps = {
  cues: readonly MoveCue[];
  /** 0 = still on `from`, 1 = sliding / on `to`. */
  progress: Record<string, 0 | 1>;
  /** Knight L-path facing: 0 = long leg, 1 = short leg (after elbow). */
  leg?: Record<string, 0 | 1>;
  /** Squares with gas / U: — keep green aura on mover hulls. */
  specialUsedSquares?: ReadonlySet<Square> | readonly Square[];
  /** Tutorial Chess skin — flat SVGs instead of Inline* hulls. */
  pieceSet?: import("~/types/board").PieceSet;
  boardWidth: number;
  boardHeight: number;
};

/**
 * One hop cycle = right lean + left lean (2 waddles).
 * Classical: one cycle per square at {@link MOVE_SQUARE_MS}.
 * Stim gas-step: travel {@link STIM_MOVE_SQUARE_MS} (100ms) with **2×** hop
 * cycles packed into that window (50ms each) — stim look.
 */
const pawnHopPlan = (from: MoveCue["from"], to: MoveCue["to"], stim?: boolean) => {
  const squares = moveTravelSquares(from, to, "p");
  if (stim) {
    return { hops: squares * 2, hopMs: STIM_MOVE_SQUARE_MS / 2 };
  }
  return { hops: squares, hopMs: MOVE_SQUARE_MS };
};

/** Bishop hull facing — same `face` + `gunDeg` as {@link AttackAnimation}. */
const bishopMoverNode = (
  m: MoveCue,
  vec: AttackVec,
  opts?: { crank?: BishopCrank; armed?: boolean },
): JSX.Element => (
  <InlineBishop
    color={m.color}
    face={attackFaceFor("b", vec)}
    gunDeg={screenAngleDeg(vec)}
    crank={opts?.crank}
    armed={!!opts?.armed}
  />
);

const moverNode = (m: MoveCue, opts?: { armed?: boolean }): JSX.Element => {
  switch (m.piece) {
    case "b":
      return <InlineBishop color={m.color} face="front" armed={!!opts?.armed} />;
    case "n":
      return <InlineKnight color={m.color} />;
    case "q":
      return <InlineQueen color={m.color} />;
    case "k":
      // `seed` matches the damage overlay's, so the flames do not jump when
      // the persistent slot takes the hull back at the end of the slide.
      return (
        <InlineKing
          color={m.color}
          aimDeg={KING_REST_AIM_DEG}
          damage={m.damage}
          seed={m.seed}
        />
      );
    default:
      // Pawn: helmet when walking up the board, glass visor when walking down
      // (same camera rule as attackFaceFor — red/black g8→g6 stays front).
      return (
        <InlinePawn
          color={m.color}
          face={attackFaceFor("p", vecBetween(m.from, m.to))}
        />
      );
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
 * Rows key by cue.id so remapped cue objects do not remount / restart CSS.
 */
export const MoveAnimation: Component<MoveAnimationProps> = (props) => {
  const used = (): ReadonlySet<Square> => {
    const g = props.specialUsedSquares;
    if (!g) return NO_SPECIAL_USED;
    return g instanceof Set ? g : new Set(g);
  };
  const hullUsed = (m: MoveCue) =>
    !!m.stim || used().has(m.from) || used().has(m.to);

  const ids = createMemo(() => props.cues.map((c) => c.id));
  const byId = createMemo(() => {
    const m = new Map<string, MoveCue>();
    for (const c of props.cues) m.set(c.id, c);
    return m;
  });

  return (
  <div
    class={styles.boardOverlay}
    data-starchess-move-layer
    style={{
      inset: "0",
    }}
  >
    <For each={ids()}>
      {(id) => {
        const m = byId().get(id)!;
        const started = () => props.progress[m.id] === 1;
        const vec = () => vecBetween(m.from, m.to);
        const travelMs = () =>
          moveDurationMs(m.from, m.to, m.piece, { stim: !!m.stim });
        const gas = () => hullUsed(m);

        if (m.piece === "n") {
          const legs = () => knightLegVecs(vec());
          const hasL = () => squareAt(m.from, legs().leg1) != null;
          const pose = () => {
            const { leg1, leg2 } = legs();
            // Always face the active travel leg (long → short); destination vec if no L.
            if (!hasL()) return aimPoseFor(vec());
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
                  data-special-used={gas() ? "true" : undefined}
                >
                  <div
                    class={`${styles.pieceFace} ${styles.moverFace}`}
                    classList={{ ["sc-special-used"]: gas() }}
                  >
                    <InlineKnight color={m.color} aimPose={pose()} />
                  </div>
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
                data-special-used={gas() ? "true" : undefined}
              >
                <div
                  class={`${styles.pieceFace} ${styles.moverFace}`}
                  classList={{ ["sc-special-used"]: gas() }}
                >
                  <InlineKnight color={m.color} aimPose={pose()} />
                </div>
              </div>
            </Show>
          );
        }

        if (m.piece === "p") {
          const { hops, hopMs } = pawnHopPlan(m.from, m.to, m.stim);
          return (
            <div
              class={styles.mover}
              classList={{
                [styles.moverPawn]: started(),
                [styles.moverPawnStim]: started() && !!m.stim,
              }}
              style={{
                ...slideMoverStyle(m.from, m.to, props.boardWidth, props.boardHeight),
                "--move-ms": `${travelMs()}ms`,
                "--pawn-hop-ms": `${hopMs}ms`,
                "--hop-count": `${hops}`,
              }}
              data-square={m.from}
              data-move-id={m.id}
              data-move-piece="p"
              data-stim={m.stim ? "true" : undefined}
              data-special-used={gas() ? "true" : undefined}
            >
              <div
                class={`${styles.pieceFace} ${styles.pawnFace}`}
                classList={{ ["sc-special-used"]: gas() }}
              >
                {moverNode(m)}
              </div>
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
              data-special-used={gas() ? "true" : undefined}
            >
              <div
                class={`${styles.pieceFace} ${styles.bishopFace}`}
                classList={{ ["sc-special-used"]: gas() }}
              >
                {bishopMoverNode(m, vec(), {
                  crank: { stepMs, stepCount, sense },
                  armed: gas(),
                })}
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
              data-special-used={gas() ? "true" : undefined}
            >
              <div
                class={`${styles.pieceFace} ${styles.moverFace}`}
                classList={{ ["sc-special-used"]: gas() }}
                style={{ transform: aimTransformCss(aimPoseFor(vec())) }}
              >
                <InlineQueen color={m.color} />
              </div>
            </div>
          );
        }

        if (m.piece === "r") {
          // Rank: rest silhouette. File: mirror only (no 90° tip — hull is ¾ front).
          // cburnett: classic rook for tank *or* siege. nerd: InlineRook at live mode.
          const mode = rookModeAt(m.from);
          const set = props.pieceSet ?? "nerd";
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
              data-special-used={gas() ? "true" : undefined}
            >
              <div
                class={`${styles.pieceFace} ${styles.moverFace}`}
                classList={{ ["sc-special-used"]: gas() }}
                style={
                  set === "nerd"
                    ? { transform: aimTransformCss(rookTravelPose(vec())) }
                    : undefined
                }
              >
                <RookGlyph
                  color={m.color}
                  pieceSet={set}
                  mode={mode}
                  aimDeg={set === "nerd" ? ROOK_REST_AIM_DEG : undefined}
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
            data-special-used={gas() ? "true" : undefined}
          >
            <div class={styles.pieceFace} classList={{ ["sc-special-used"]: gas() }}>
              {moverNode(m, { armed: gas() })}
            </div>
          </div>
        );
      }}
    </For>
  </div>
  );
};
