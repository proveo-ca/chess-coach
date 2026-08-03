import { For, Show, type Component, type JSX } from "solid-js";

import {
  ANIM_BY_PIECE,
  ATTACK_MS,
  FRAG_FLIGHT_MS,
  KING_REST_AIM_DEG,
  ROOK_REST_AIM_DEG,
  attackFaceFor,
  cellSize,
  centeredBoxStyle,
  muzzleOffsetPx,
  screenAimDeg,
  squareBoxStyle,
} from "~/broodwar/animations/attackAnim";
import styles from "~/broodwar/animations/AttackAnimation.module.css";
import {
  BISHOP_CHARON,
  charonImpactStyle,
  charonVolleyStyle,
} from "~/broodwar/animations/bishopCharon";
import {
  aimPoseFor,
  aimTransformCss,
  knightAimDiagVec,
  knightElbowVec,
  screenAngleDeg,
  squareAt,
  squareCenterPx,
} from "~/broodwar/animations/attackVectors";
import { InlineBishop } from "~/broodwar/animations/pieces/InlineBishop";
import { InlineKing } from "~/broodwar/animations/pieces/InlineKing";
import { InlineKnight } from "~/broodwar/animations/pieces/InlineKnight";
import { InlinePawn } from "~/broodwar/animations/pieces/InlinePawn";
import { InlineQueen } from "~/broodwar/animations/pieces/InlineQueen";
import { InlineRook } from "~/broodwar/animations/pieces/InlineRook";
import {
  QUEEN_AIM_WRAP_SCALE,
  QUEEN_LASER_MUZZLE_X,
  QUEEN_PIECE_FACE_SCALE,
} from "~/broodwar/animations/queenLaser";
import type { AttackCue } from "~/broodwar/animations/types";
import { rookModeAt } from "~/broodwar/broodWarStore";
import { vecBetween } from "~/broodwar/animations/boardGeom";

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

const attackNode = (cue: AttackCue): JSX.Element => {
  const vec = vecBetween(cue.from, cue.to);
  const deg = screenAngleDeg(vec);
  const face = attackFaceFor(cue.piece, vec);
  switch (cue.piece) {
    case "p":
      return (
        <div class={styles.pieceFace}>
          <InlinePawn color={cue.color} face={face} aimDeg={deg} />
        </div>
      );
    case "n": {
      const pose = aimPoseFor(knightAimDiagVec(vec));
      return (
        <div class={styles.pieceFace} style={{ transform: aimTransformCss(pose) }}>
          <InlineKnight color={cue.color} />
        </div>
      );
    }
    case "b":
      return (
        <div class={styles.pieceFace}>
          <InlineBishop
            color={cue.color}
            face={face}
            gunDeg={deg}
            aiming
            armed={cue.anim === BISHOP_CHARON}
            launcherDeg={cue.anim === BISHOP_CHARON ? deg : undefined}
            launcherCapsVisible={cue.anim !== BISHOP_CHARON}
          />
        </div>
      );
    case "r":
      return (
        <div class={styles.pieceFace}>
          <InlineRook
            color={cue.color}
            aimDeg={screenAimDeg(true, deg, ROOK_REST_AIM_DEG)}
            mode={rookModeAt(cue.from)}
          />
        </div>
      );
    case "q":
      // Hull + laser share aim on `.aimWrap` (see `queenAimWrapStyle`).
      return (
        <div class={styles.pieceFace}>
          <InlineQueen color={cue.color} />
        </div>
      );
    case "k":
      return (
        <div class={styles.pieceFace}>
          <InlineKing
            color={cue.color}
            aimDeg={screenAimDeg(true, deg, KING_REST_AIM_DEG)}
            damage={cue.damage}
            seed={cue.seed}
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
  // Muzzle sits on local +x after InlineQueen’s bow normalize; map viewBox → aimWrap.
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
  cues: AttackCue[];
  /** Cue ids whose hull has swapped to death art (stable — no remount). */
  dyingIds?: Record<string, boolean>;
  boardWidth: number;
  boardHeight: number;
  /**
   * When set, positions the overlay absolutely relative to a host wrapper
   * (Storybook demos). Omit when nesting inside the ChessBoard grid (inset 0).
   */
  box?: { top: number; left: number };
};

/**
 * Brood War attack VFX layer — one cue per attacking unit.
 * CSS hooks: `data-attack-anim="pawnRifle"` (etc.).
 */
export const AttackAnimation: Component<AttackAnimationProps> = (props) => {
  const dying = (id: string) => !!props.dyingIds?.[id];

  return (
    <div
      class={styles.boardOverlay}
      data-broodwar-attack-layer
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
      <For each={props.cues}>
        {(cue) => {
          // Keyed by cue.id via stable cue objects from the combat bus — do not
          // rebuild the cues array mid-attack or CSS attack anims restart.
          const anim = cue.anim ?? ANIM_BY_PIECE[cue.piece];
          const isDying = () => dying(cue.id);
          return (
            <>
              <div
                class={styles.targetSlot}
                style={squareBoxStyle(cue.to, props.boardWidth, props.boardHeight)}
                data-square={cue.to}
              />

              {/* HE impact is siege-only — tank mode uses king-style muzzle flashes. */}
              <Show when={cue.piece === "r" && rookModeAt(cue.from) === "siege"}>
                <BoardFx
                  class={styles.rookImpact}
                  style={rookImpactStyle(cue, props.boardWidth, props.boardHeight)!}
                >
                  <div class={styles.rookImpactSmoke} />
                  <div class={styles.rookImpactFire} />
                  <div class={styles.rookImpactCore} />
                  <div class={styles.rookImpactEjecta} />
                  <div class={styles.rookImpactEjectaDiag} />
                </BoardFx>
              </Show>

              <Show when={cue.piece === "q"}>
                <BoardFx
                  class={styles.laserStar}
                  style={laserStarStyle(cue, props.boardWidth, props.boardHeight)!}
                >
                  <div class={styles.laserStarRays} />
                  <div class={styles.laserStarRaysDiag} />
                  <div class={styles.laserStarCore} />
                </BoardFx>
              </Show>

              <Show when={anim === BISHOP_CHARON}>
                <BoardFx
                  class={styles.charonVolley}
                  style={charonVolleyStyle(cue, props.boardWidth, props.boardHeight)}
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
                <BoardFx
                  class={styles.charonImpact}
                  style={charonImpactStyle(cue, props.boardWidth, props.boardHeight)}
                >
                  <div class={styles.charonImpactCore} />
                </BoardFx>
              </Show>

              {/*
                When the unit is captured mid-attack, hide the attack hull so
                DeathAnimation owns the death cue. Target-square FX (impact /
                frag) keep playing.
              */}
              <Show when={!isDying()}>
                <div
                  class={styles.originSlot}
                  classList={{ [styles[`anim-${anim}`]]: true }}
                  style={{
                    ...squareBoxStyle(cue.from, props.boardWidth, props.boardHeight),
                    ...(anim === BISHOP_CHARON
                      ? { "--attack-ms": `${FRAG_FLIGHT_MS}ms` }
                      : {}),
                  }}
                  data-square={cue.from}
                  data-attack-anim={anim}
                  data-rook-mode={cue.piece === "r" ? rookModeAt(cue.from) : undefined}
                >
                  <div class={styles.aimWrap} style={queenAimWrapStyle(cue)}>
                    {attackNode(cue)}
                    <Show when={cue.piece === "q"}>
                      <div
                        class={styles.laserPulse}
                        style={laserStyle(cue, props.boardWidth, props.boardHeight)!}
                        aria-hidden="true"
                      />
                    </Show>
                  </div>
                </div>
              </Show>

              <Show when={cue.piece === "n"}>
                <div
                  class={styles.fragL}
                  style={fragLStyle(cue, props.boardWidth, props.boardHeight) ?? undefined}
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
