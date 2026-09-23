// SPEC: _spec/apps/starchess/architecture/board-entities.puml
import { For, Show, createMemo, untrack, type Component, type JSX } from "solid-js";
import type { Square } from "chess.js";

import {
  ANIM_BY_PIECE,
  ATTACK_MS,
  FRAG_FLIGHT_MS,
  attackFaceFor,
  cellSize,
  centeredBoxStyle,
  muzzleOffsetPx,
  screenAimDeg,
  squareBoxStyle,
} from "~/presentation/animations/attackAnim";
import { KING_REST_AIM_DEG, ROOK_REST_AIM_DEG } from "~/presentation/pieces/geometry";
import styles from "~/presentation/animations/components/AttackAnimation.module.css";
import {
  MECHA_CHARON,
  charonImpactStyle,
  charonVolleyStyle,
} from "~/presentation/animations/mechaCharon";
import { fragFlightMsCss } from "~/presentation/animations/impactTiming";
import { teamTintStyle } from "~/presentation/pieces/teamColors";
import {
  aimPoseFor,
  aimTransformCss,
  knightAimDiagVec,
  knightElbowVec,
  screenAngleDeg,
  squareAt,
  squareCenterPx,
} from "~/presentation/animations/attackVectors";
import { InlineBishop } from "~/presentation/pieces/InlineBishop";
import { InlineKing } from "~/presentation/pieces/InlineKing";
import { InlineKnight } from "~/presentation/pieces/InlineKnight";
import { InlinePawn } from "~/presentation/pieces/InlinePawn";
import { InlineQueen } from "~/presentation/pieces/InlineQueen";
import { InlineRook } from "~/presentation/pieces/InlineRook";
import {
  QUEEN_AIM_WRAP_SCALE,
  QUEEN_LASER_MUZZLE_X,
  QUEEN_PIECE_FACE_SCALE,
} from "~/presentation/animations/queenLaser";
import type { AttackCue } from "~/presentation/animations/types";
import { rookModeAt } from "~/presentation/animations/rookModeStore";
import { vecBetween } from "~/presentation/animations/boardGeom";

const NO_SPECIAL_USED: ReadonlySet<Square> = new Set();

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

/**
 * Built once per cue id: a re-emitted cue object (e.g. the king's `damage`
 * flipping at impact) must update props in place — rebuilding the hull
 * restarts every CSS timeline and the attack plays twice.
 */
const attackNode = (
  live: () => AttackCue,
  opts: { specialUsed: () => boolean; charon: () => boolean },
): JSX.Element => {
  const cue = untrack(live);
  const vec = vecBetween(cue.from, cue.to);
  const deg = screenAngleDeg(vec);
  const face = attackFaceFor(cue.piece, vec);
  const charon = opts.charon;
  // Charon pods stay up whenever this unit spent gas this turn (U: / absorb).
  const armed = () => opts.specialUsed() || charon();
  const faceClass = () => ({
    [styles.pieceFace]: true,
    ["sc-special-used"]: opts.specialUsed(),
  });
  switch (cue.piece) {
    case "p":
      return (
        <div classList={faceClass()}>
          <InlinePawn color={cue.color} face={face} aimDeg={deg} />
        </div>
      );
    case "n": {
      const pose = aimPoseFor(knightAimDiagVec(vec));
      return (
        <div classList={faceClass()}>
          <InlineKnight color={cue.color} aimPose={pose} />
        </div>
      );
    }
    case "b":
      return (
        <div classList={faceClass()}>
          <InlineBishop
            color={cue.color}
            face={face}
            gunDeg={deg}
            /* Charon volley: idle gatling faces so shoulder pods stay readable. */
            aiming={!charon()}
            armed={armed()}
            launcherDeg={charon() ? deg : undefined}
            launcherCapsVisible={!charon()}
          />
        </div>
      );
    case "r":
      return (
        <div classList={faceClass()}>
          <InlineRook
            color={cue.color}
            aimDeg={screenAimDeg(true, deg, ROOK_REST_AIM_DEG)}
            mode={live().rookMode ?? rookModeAt(cue.from)}
          />
        </div>
      );
    case "q":
      // Hull + laser share aim on `.aimWrap` (see `queenAimWrapStyle`).
      return (
        <div classList={faceClass()}>
          <InlineQueen color={cue.color} aiming />
        </div>
      );
    case "k":
      return (
        <div classList={faceClass()}>
          <InlineKing
            color={cue.color}
            aimDeg={screenAimDeg(true, deg, KING_REST_AIM_DEG)}
            damage={live().damage}
            seed={live().seed}
          />
        </div>
      );
  }
};

const fragLStyle = (
  cue: AttackCue,
  boardWidth: number,
  boardHeight: number,
): Record<string, string> | null => {
  if (cue.piece !== "n") return null;
  const vec = vecBetween(cue.from, cue.to);
  const elbowOff = knightElbowVec(vec);
  const elbowSq = squareAt(cue.from, elbowOff);
  if (!elbowSq) return null;

  const { w: cell } = cellSize({ width: boardWidth, height: boardHeight });
  const o = squareCenterPx(cue.from, boardWidth, boardHeight);
  const e = squareCenterPx(elbowSq, boardWidth, boardHeight);
  const t = squareCenterPx(cue.to, boardWidth, boardHeight);
  const pose = aimPoseFor(knightAimDiagVec(vec));
  const noseOff = muzzleOffsetPx(pose, cell * 0.45);
  const nose = { x: o.x + noseOff.x, y: o.y + noseOff.y };

  return {
    "--fx0": `${nose.x}px`,
    "--fy0": `${nose.y}px`,
    "--fx1": `${e.x}px`,
    "--fy1": `${e.y}px`,
    "--fx2": `${t.x}px`,
    "--fy2": `${t.y}px`,
  };
};

const rookImpactStyle = (
  cue: AttackCue,
  boardWidth: number,
  boardHeight: number,
): Record<string, string> | null => {
  if (cue.piece !== "r") return null;
  const { w: cell } = cellSize({ width: boardWidth, height: boardHeight });
  const c = squareCenterPx(cue.to, boardWidth, boardHeight);
  // Fat HE fireball centered on the hit square (not a thin ground “lighter”).
  const size = cell * 1.55;
  return centeredBoxStyle(c, size, size);
};

/**
 * Queen hull + laser bolt share this aim so the pulse travels toward `to`
 * (bolt CSS is +x-local; without this it always flies right).
 */
const queenAimWrapStyle = (cue: AttackCue): Record<string, string> | undefined => {
  if (cue.piece !== "q") return undefined;
  return { transform: aimTransformCss(aimPoseFor(vecBetween(cue.from, cue.to))) };
};

const laserStyle = (
  cue: AttackCue,
  boardWidth: number,
  boardHeight: number,
): Record<string, string> | null => {
  if (cue.piece !== "q") return null;
  const { w: cell } = cellSize({ width: boardWidth, height: boardHeight });
  const vec = vecBetween(cue.from, cue.to);
  const dist = cell * Math.hypot(vec.df, vec.dr);
  const facePx = cell * QUEEN_AIM_WRAP_SCALE * QUEEN_PIECE_FACE_SCALE;
  const muzzleFromCenter = ((QUEEN_LASER_MUZZLE_X - 22.5) / 45) * facePx;
  const span = Math.max(6, dist - muzzleFromCenter);
  const bolt = Math.max(14, span * 0.38);
  return {
    left: `calc(50% + ${muzzleFromCenter}px)`,
    top: "50%",
    width: `${bolt}px`,
    "--laser-span": `${span}px`,
  };
};

const laserStarStyle = (
  cue: AttackCue,
  boardWidth: number,
  boardHeight: number,
): Record<string, string> | null => {
  if (cue.piece !== "q") return null;
  const { w: cell } = cellSize({ width: boardWidth, height: boardHeight });
  const c = squareCenterPx(cue.to, boardWidth, boardHeight);
  const size = cell * 0.95;
  return centeredBoxStyle(c, size, size);
};

export type AttackAnimationProps = {
  cues: readonly AttackCue[];
  /** Cue ids whose hull has swapped to death art (stable — no remount). */
  dyingIds?: Record<string, boolean>;
  /** Squares with gas / U: — keep green aura on attack hulls. */
  specialUsedSquares?: ReadonlySet<Square> | readonly Square[];
  boardWidth: number;
  boardHeight: number;
  box?: { top: number; left: number };
};

/**
 * StarChess attack VFX layer — one cue per attacking unit.
 * CSS hooks: `data-attack-anim="pawnRifle"` (etc.).
 */
export const AttackAnimation: Component<AttackAnimationProps> = (props) => {
  const dying = (id: string) => !!props.dyingIds?.[id];
  const used = (): ReadonlySet<Square> => {
    const g = props.specialUsedSquares;
    if (!g) return NO_SPECIAL_USED;
    return g instanceof Set ? g : new Set(g);
  };
  const hullUsed = (cue: AttackCue, anim: string) =>
    anim === MECHA_CHARON || used().has(cue.from);
  const isCharon = (anim: string) => anim === MECHA_CHARON;

  const ids = createMemo(() => props.cues.map((c) => c.id));
  const byId = createMemo(() => {
    const m = new Map<string, AttackCue>();
    for (const c of props.cues) m.set(c.id, c);
    return m;
  });

  return (
    <div
      class={styles.boardOverlay}
      data-starchess-attack-layer
      style={{
        ...(props.box
          ? {
              top: `${props.box.top}px`,
              left: `${props.box.left}px`,
              width: `${props.boardWidth}px`,
              height: `${props.boardHeight}px`,
            }
          : {
              inset: "0",
              width: "100%",
              height: "100%",
            }),
        "--attack-ms": `${ATTACK_MS}ms`,
        "--frag-flight-ms": `${FRAG_FLIGHT_MS}ms`,
      }}
    >
      <For each={ids()}>
        {(id) => {
          const cue = () => byId().get(id)!;
          // Keyed by cue.id — keep hull CSS timelines across cue-object remap.
          const anim = () => cue().anim ?? ANIM_BY_PIECE[cue().piece];
          const isDying = () => dying(id);
          return (
            <>
              <div
                class={styles.targetSlot}
                style={squareBoxStyle(cue().to, props.boardWidth, props.boardHeight)}
                data-square={cue().to}
              />

              {/* HE impact is siege-only — tank mode uses king-style muzzle flashes. */}
              <Show when={cue().piece === "r" && (cue().rookMode ?? rookModeAt(cue().from)) === "siege"}>
                <BoardFx
                  class={styles.rookImpact}
                  style={rookImpactStyle(cue(), props.boardWidth, props.boardHeight)!}
                >
                  <div class={styles.rookImpactSmoke} />
                  <div class={styles.rookImpactFire} />
                  <div class={styles.rookImpactCore} />
                  <div class={styles.rookImpactEjecta} />
                  <div class={styles.rookImpactEjectaDiag} />
                </BoardFx>
              </Show>

              <Show when={cue().piece === "q"}>
                <BoardFx
                  class={styles.laserStar}
                  style={{
                    ...laserStarStyle(cue(), props.boardWidth, props.boardHeight)!,
                    ...teamTintStyle(cue().color),
                  }}
                >
                  <div class={styles.laserStarRays} />
                  <div class={styles.laserStarRaysDiag} />
                  <div class={styles.laserStarCore} />
                </BoardFx>
              </Show>

              <Show when={anim() === MECHA_CHARON}>
                <BoardFx
                  class={styles.charonVolley}
                  style={charonVolleyStyle(cue(), props.boardWidth, props.boardHeight)}
                >
                  <div class={styles.charonMissile} data-charon-missile="a">
                    <div class={`${styles.charonCurve} ${styles.charonCurveA}`}>
                      <div class={styles.charonMissileBody} />
                    </div>
                  </div>
                  <div class={styles.charonMissile} data-charon-missile="b">
                    <div class={`${styles.charonCurve} ${styles.charonCurveB}`}>
                      <div class={styles.charonMissileBody} />
                    </div>
                  </div>
                </BoardFx>
                <Show when={!cue().fizzle}>
                  <BoardFx
                    class={styles.charonImpact}
                    style={charonImpactStyle(cue(), props.boardWidth, props.boardHeight)}
                  >
                    <div class={styles.charonImpactCore} />
                  </BoardFx>
                </Show>
              </Show>

              {/*
                When the unit is captured mid-attack, hide the attack hull so
                DeathAnimation owns the death cue. Target-square FX (impact /
                frag) keep playing.
              */}
              <Show when={!isDying()}>
                <div
                  class={styles.originSlot}
                  classList={{ [styles[`anim-${anim()}`]]: true }}
                  style={{
                    ...squareBoxStyle(cue().from, props.boardWidth, props.boardHeight),
                    // Inherited by the hull and the Ship's laser pulse inside it.
                    ...teamTintStyle(cue().color),
                    // Per-weapon impact; board overlay keeps default FRAG_FLIGHT_MS.
                    "--frag-flight-ms": fragFlightMsCss(anim()),
                    ...(anim() === MECHA_CHARON
                      ? { "--attack-ms": `${FRAG_FLIGHT_MS}ms` }
                      : {}),
                  }}
                  data-square={cue().from}
                  data-attack-anim={anim()}
                  data-special-used={hullUsed(cue(), anim()) ? "true" : undefined}
                  data-rook-mode={
                    cue().piece === "r" ? (cue().rookMode ?? rookModeAt(cue().from)) : undefined
                  }
                >
                  <div class={styles.aimWrap} style={queenAimWrapStyle(cue())}>
                    {attackNode(cue, {
                      specialUsed: () => hullUsed(cue(), anim()),
                      charon: () => isCharon(anim()),
                    })}
                    <Show when={cue().piece === "q"}>
                      <div
                        class={styles.laserPulse}
                        style={laserStyle(cue(), props.boardWidth, props.boardHeight)!}
                        aria-hidden="true"
                      />
                    </Show>
                  </div>
                </div>
              </Show>

              <Show when={cue().piece === "n"}>
                <div
                  class={styles.fragL}
                  style={{
                    ...fragLStyle(cue(), props.boardWidth, props.boardHeight),
                    ...teamTintStyle(cue().color),
                  }}
                  aria-hidden="true"
                >
                  <div class={styles.fragCylinder} />
                </div>
              </Show>
            </>
          );
        }}
      </For>
    </div>
  );
};
