// SPEC: _spec/apps/starchess/architecture/board-entities.puml, _spec/apps/starchess/architecture/reactivity/presentation.md
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type Component,
  type JSX,
} from "solid-js";
import type { Square } from "chess.js";

import { attackFaceFor } from "~/presentation/animations/attackAnim";
import {
  CC_REST_AIM_DEG,
  TANK_REST_AIM_DEG,
} from "~/presentation/pieces/geometry";
import {
  aimPoseFor,
  aimPoseWithin,
  hoverbikeLegVecs,
  screenAngleDeg,
  squareAt,
  type AttackVec,
} from "~/presentation/animations/attackVectors";
import { squareBoxStyle, vecBetween } from "~/presentation/animations/boardGeom";
import styles from "~/presentation/animations/components/MoveAnimation.module.css";
import { moveDurationMs, moveTravelSquares } from "~/presentation/animations/moveTiming";
import { InlineMecha, type MechaCrank } from "~/presentation/pieces/InlineMecha";
import { InlineCommandCenter } from "~/presentation/pieces/InlineCommandCenter";
import { InlineHoverbike } from "~/presentation/pieces/InlineHoverbike";
import { InlineMarine } from "~/presentation/pieces/InlineMarine";
import { InlineBattleShip } from "~/presentation/pieces/InlineBattleShip";
import type { MoveCue } from "~/presentation/animations/types";
import { tankModeAt } from "~/presentation/animations/tankModeStore";
import { PieceGlyph } from "~/presentation/board/components/PieceGlyph";
import {
  HOVERBIKE_TURN_MS,
  MOVE_SQUARE_MS,
  SETTLE_MS,
  STIM_MOVE_SQUARE_MS,
} from "~/presentation/constants";

const NO_SPECIAL_USED: ReadonlySet<Square> = new Set();

export type MoveAnimationProps = {
  cues: readonly MoveCue[];
  /** 0 = still on `from`, 1 = sliding / on `to`. */
  progress: Record<string, 0 | 1>;
  /** Hoverbike L-path facing: 0 = long leg, 1 = short leg (after elbow). */
  leg?: Record<string, 0 | 1>;
  /** Squares with gas / U: — keep green aura on mover hulls. */
  specialUsedSquares?: ReadonlySet<Square> | readonly Square[];
  /**
   * Squares a Charon-firing Mecha held this resolve (`charonArmed.ts`). The
   * launchers follow that unit only — gas on a square is the green aura, not this.
   */
  charonSquares?: ReadonlySet<Square>;
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
const marineHopPlan = (from: MoveCue["from"], to: MoveCue["to"], stim?: boolean) => {
  const squares = moveTravelSquares(from, to, "p");
  if (stim) {
    return { hops: squares * 2, hopMs: STIM_MOVE_SQUARE_MS / 2 };
  }
  return { hops: squares, hopMs: MOVE_SQUARE_MS };
};

/** Mecha hull facing — same `face` + `gunDeg` as {@link AttackAnimation}. */
const mechaMoverNode = (
  m: MoveCue,
  vec: AttackVec,
  opts?: { crank?: MechaCrank; armed?: boolean },
): JSX.Element => (
  <InlineMecha
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
      return <InlineMecha color={m.color} face="front" armed={!!opts?.armed} />;
    case "n":
      return <InlineHoverbike color={m.color} />;
    case "q":
      return <InlineBattleShip color={m.color} />;
    case "k":
      // `seed` matches the damage overlay's, so the flames do not jump when
      // the persistent slot takes the hull back at the end of the slide.
      return (
        <InlineCommandCenter
          color={m.color}
          aimDeg={CC_REST_AIM_DEG}
          damage={m.damage}
          seed={m.seed}
        />
      );
    default:
      // Marine: helmet when walking up the board, glass visor when walking down
      // (same camera rule as attackFaceFor — red/black g8→g6 stays front).
      return (
        <InlineMarine
          color={m.color}
          face={attackFaceFor("p", vecBetween(m.from, m.to))}
        />
      );
  }
};

/** Origin box + L-path translate offsets (long leg → elbow → short leg). */
const hoverbikeMoverStyle = (
  from: MoveCue["from"],
  to: MoveCue["to"],
  boardWidth: number,
  boardHeight: number,
): Record<string, string> | null => {
  const vec = vecBetween(from, to);
  const { leg1 } = hoverbikeLegVecs(vec);
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
 * Mecha foot aim (SVG y-down, 0° = +file/right).
 * Locked diagonals per product note: top-left 45°, top-right 135°, then
 * continue around the compass (bottom-right 225°, bottom-left 315°).
 * Kept for callers / tests — walk VFX no longer aims feet independently
 * (steam-engine gait keeps feet rigid on the shin).
 */
export const mechaFootAimDeg = (vec: AttackVec): number => {
  const df = Math.sign(vec.df);
  const dr = Math.sign(vec.dr);
  if (df < 0 && dr > 0) return 45; // top-left
  if (df > 0 && dr > 0) return 135; // top-right
  if (df > 0 && dr < 0) return 225; // bottom-right
  if (df < 0 && dr < 0) return 315; // bottom-left
  // Ortho fallback (shouldn't appear on quiet Mecha moves).
  return screenAngleDeg(vec);
};

/**
 * Quiet / occupy slide hulls. ChessBoard hides board `<img>` on `from`
 * while a cue is active (fxHidden). Hoverbikes use the L-path; Marines hop;
 * Mechas steam-engine-walk on articulated legs (feet locked to shins).
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
  /** Launchers ride with the Mecha that fired Charon — never with gas on a square. */
  const firedCharon = (m: MoveCue) => m.piece === "b" && !!props.charonSquares?.has(m.from);

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
      // Inherited by every mover, so the hull normalize in `styles/unitPose.css`
      // and the parent travel aim settle over one shared window.
      "--settle-ms": `${SETTLE_MS}ms`,
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
        /**
         * Units whose art is normalized for aiming (hoverbike, battleship) must
         * be back in their resting silhouette *before* this mover unmounts and
         * the board glyph takes the square — a CSS transition cannot span that
         * hand-off. The aim is released **at touchdown** (not a settle-window
         * early), so the unwind only starts once the hull is parked on `to`. The
         * move wave's duration is extended by {@link SETTLE_MS} for these pieces
         * (`timelinePlayer` handleMoveWave), keeping the mover mounted long
         * enough for the transition to complete before the overlay unmounts.
         */
        const [settling, setSettling] = createSignal(false);
        createEffect(() => {
          if (!started()) {
            setSettling(false);
            return;
          }
          const releaseAt = Math.max(0, travelMs());
          const t = setTimeout(() => setSettling(true), releaseAt);
          onCleanup(() => clearTimeout(t));
        });

        if (m.piece === "n") {
          const legs = () => hoverbikeLegVecs(vec());
          const hasL = () => squareAt(m.from, legs().leg1) != null;
          // One side for the whole flight (an L always has a sideways part):
          // the side snaps, so it may change only at lift-off and touchdown.
          const mirrorX = () => vec().df < 0;
          const pose = () => {
            if (!hasL()) return aimPoseFor(vec());
            const { leg1, leg2 } = legs();
            return aimPoseWithin((props.leg?.[m.id] ?? 0) === 1 ? leg2 : leg1, mirrorX());
          };
          const aimPose = createMemo(() => (settling() ? undefined : pose()));
          const hullStyle = () => ({
            "--settle-ms": `${settling() ? SETTLE_MS : HOVERBIKE_TURN_MS}ms`,
          });
          const face = () => (
            <div
              class={`${styles.pieceFace} ${styles.moverFace}`}
              classList={{
                ["sc-special-used"]: gas(),
                [styles.hoverbikeLanding]: settling(),
              }}
              style={hullStyle()}
            >
              <InlineHoverbike color={m.color} aimPose={aimPose()} />
            </div>
          );
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
                  {face()}
                </div>
              }
            >
              <div
                class={styles.mover}
                classList={{ [styles.moverHoverbike]: started() }}
                style={{
                  ...hoverbikeMoverStyle(m.from, m.to, props.boardWidth, props.boardHeight),
                  "--move-ms": `${travelMs()}ms`,
                }}
                data-square={m.from}
                data-move-id={m.id}
                data-special-used={gas() ? "true" : undefined}
              >
                {face()}
              </div>
            </Show>
          );
        }

        if (m.piece === "p") {
          const { hops, hopMs } = marineHopPlan(m.from, m.to, m.stim);
          return (
            <div
              class={styles.mover}
              classList={{
                [styles.moverMarine]: started(),
                [styles.moverMarineStim]: started() && !!m.stim,
              }}
              style={{
                ...slideMoverStyle(m.from, m.to, props.boardWidth, props.boardHeight),
                "--move-ms": `${travelMs()}ms`,
                "--marine-hop-ms": `${hopMs}ms`,
                "--hop-count": `${hops}`,
              }}
              data-square={m.from}
              data-move-id={m.id}
              data-move-piece="p"
              data-stim={m.stim ? "true" : undefined}
              data-special-used={gas() ? "true" : undefined}
            >
              <div
                class={`${styles.pieceFace} ${styles.marineFace}`}
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
              classList={{ [styles.moverMecha]: started() }}
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
                class={`${styles.pieceFace} ${styles.mechaFace}`}
                classList={{ ["sc-special-used"]: gas() }}
              >
                {mechaMoverNode(m, vec(), {
                  crank: { stepMs, stepCount, sense },
                  armed: firedCharon(m),
                })}
              </div>
            </div>
          );
        }

        if (m.piece === "q") {
          return (
            <div
              class={styles.mover}
              classList={{ [styles.moverBattleShip]: started() }}
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
                class={`${styles.pieceFace} ${styles.settleFace}`}
                classList={{ ["sc-special-used"]: gas() }}
                style={
                  settling()
                    ? {}
                    // Bow is normalized to +x while aiming: rotate it along
                    // travel. Rotation only — never mirrored (papery).
                    : { transform: `rotate(${screenAngleDeg(vec())}deg)` }
                }
              >
                <InlineBattleShip color={m.color} aiming={!settling()} />
              </div>
            </div>
          );
        }

        if (m.piece === "r") {
          // Hull is a fixed ¾ front silhouette — the root never rotates or
          // mirrors (rotate(180°) puts the tracks on top; scaleX reads
          // papery). Only the turret yaws, along travel while sliding, back
          // to rest at touchdown for a seamless hand-off to the board glyph.
          // The touchdown swap snaps (turret aim is an SVG attribute with no
          // CSS transition) — same trade-off as AttackAnimation's mount swap,
          // and less jarring than a mid-slide flip.
          // cburnett: classic Tank for tank *or* siege. nerd: InlineTank at live mode.
          const mode = tankModeAt(m.from);
          const set = props.pieceSet ?? "nerd";
          return (
            <div
              class={styles.mover}
              classList={{ [styles.moverTank]: started() }}
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
              >
                <PieceGlyph
                  color={m.color}
                  type="r"
                  pieceSet={set}
                  mode={mode}
                  aimDeg={
                    set === "nerd"
                      ? settling()
                        ? TANK_REST_AIM_DEG
                        : screenAngleDeg(vec())
                      : undefined
                  }
                />
              </div>
            </div>
          );
        }

        const sq = () => (props.progress[m.id] === 1 ? m.to : m.from);
        return (
          <div
            class={styles.mover}
            classList={{ [styles.moverSlide]: started() }}
            style={{
              ...slideMoverStyle(m.from, m.to, props.boardWidth, props.boardHeight),
              "--move-ms": `${travelMs()}ms`,
            }}
            data-square={sq()}
            data-move-id={m.id}
            data-special-used={gas() ? "true" : undefined}
          >
            <div class={styles.pieceFace} classList={{ ["sc-special-used"]: gas() }}>
              {moverNode(m, { armed: firedCharon(m) })}
            </div>
          </div>
        );
      }}
    </For>
  </div>
  );
};
