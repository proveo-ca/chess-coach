import type { Component } from "solid-js";

import { ROOK_REST_AIM_DEG, ROOK_FRAME_SCALE, svgPivotAroundAniso, SIEGE_TOGGLE_MS } from "~/presentation/pieces/rookAim";
import styles from "~/presentation/pieces/InlineRook.module.css";
import { TwinBattery, TWIN_BATTERY_SCALE_ROOK } from "~/presentation/pieces/TwinBattery";
import {
  INK_BLACK,
  INK_DARK_GRAY,
  INK_WHITE,
  PIECE_FRAME,
  TEAM_PRIMARY,
  type PieceColor,
} from "~/presentation/pieces/teamColors";
import type { RookMode } from "@chess-coach/starchess-core";

export type { RookMode };

type InlineRookProps = {
  color?: PieceColor;
  /**
   * Absolute screen aim degrees (0 = +file/right, 90 = toward rank 1).
   * Defaults to {@link ROOK_REST_AIM_DEG} (−135°, upper-left).
   */
  aimDeg?: number;
  /**
   * Tank ↔ siege — store-backed via {@link rookModeAt} / sieged SCFEN `S:`.
   * Siege: ea839cb wedge armor + filled white twins. Tank: squared hull + treads + TwinBattery.
   * Defaults to **tank**. Chess/`cburnett` skin never uses this component — both
   * modes map to the classic rook via {@link RookGlyph}.
   */
  mode?: RookMode;
};

type HullProps = {
  team: string;
};

type GunProps = {
  team: string;
};

/** Turret pivot on the hull deck — matches static `*R.svg` (siege rest). */
const PIVOT = { x: 22.5, y: 23.5 };

/** Content scale inside {@link PIECE_FRAME.R} — hull size, not barrel crop. */
export const ROOK_CONTENT_SCALE = 1.28;

const ROOK_STROKE = 1;

const RX = 2.2;
const RX_TURRET = 1;

/** Siege twin gun size bump (on top of base iconic length). */
const SIEGE_GUN_SCALE = 1.1;

/**
 * Iconic ea839cb siege reach: tubes ~12 + tips ~3.6 along local +x.
 */
const SIEGE_BARREL_LEN = 12;
const SIEGE_BARREL_H = 2.6;
const SIEGE_TIP_W = 3.6;

/**
 * Filled twin barrels in local +x (siege face). Solid rects + gap strip.
 */
const SiegeTwins: Component<GunProps> = (props) => {
  const L = SIEGE_BARREL_LEN;
  const h = SIEGE_BARREL_H;
  const tipW = SIEGE_TIP_W;
  const gap = 0.7;
  const tipX = L - 0.8;

  return (
    <g data-part="shock" stroke-width={ROOK_STROKE}>
      <g data-part="shock-mantlet">
        <rect fill={props.team} x="-4.5" y="-2.5" width="9" height="5" rx={RX_TURRET} />
      </g>
      <rect fill={INK_DARK_GRAY} x="1.2" y={-gap / 2} width={L * 0.9} height={gap} rx="0.3" />
      <rect fill={INK_WHITE} x="1.2" y={-h - gap / 2} width={L} height={h} rx="0.7" />
      <rect fill={INK_WHITE} x="1.2" y={gap / 2} width={L} height={h} rx="0.7" />
      <rect fill={INK_DARK_GRAY} x={tipX} y={-h - gap / 2} width={tipW} height={h} rx="0.5" />
      <rect fill={INK_DARK_GRAY} x={tipX} y={gap / 2} width={tipW} height={h} rx="0.5" />
      <ellipse
        data-part="battery-blast"
        fill="#fff2a8"
        cx={L + 4}
        cy="0"
        rx="4.8"
        ry="3.5"
        stroke="none"
        opacity="0"
      />
      <g data-part="battery-smoke" opacity="0">
        <ellipse
          fill={INK_DARK_GRAY}
          cx={L + 2.5}
          cy="-1.6"
          rx="2.2"
          ry="1.3"
          stroke="none"
          opacity="0.85"
        />
        <ellipse
          fill={INK_DARK_GRAY}
          cx={L + 3.8}
          cy="-2.8"
          rx="2.5"
          ry="1.6"
          stroke="none"
          opacity="0.55"
        />
        <ellipse
          fill={INK_BLACK}
          cx={L + 4.8}
          cy="-3.4"
          rx="1.7"
          ry="1.1"
          stroke="none"
          opacity="0.5"
        />
      </g>
    </g>
  );
};

/**
 * Dual hull: tank chassis under; siege armor (white wedge + team plates) on top.
 * Siege armor retracts in tank mode to reveal treads.
 */
const Hull: Component<HullProps> = (props) => (
  <g data-part="hull">
    <g data-part="tracks">
      <rect fill={INK_BLACK} x="10" y="32.2" width="25" height="6" rx={RX} />
      <rect fill={INK_DARK_GRAY} x="11.2" y="33" width="22.6" height="4.2" rx="2.1" />
      <path
        fill="none"
        stroke={INK_BLACK}
        stroke-width="1.15"
        stroke-linecap="round"
        d="M13 34.8h2.8M17.2 34.8h2.8M21.4 34.8h2.8M25.6 34.8h2.8M29.8 34.8h2.4"
      />
      <rect fill={INK_BLACK} x="12.6" y="33.9" width="2.6" height="2.6" rx="0.9" />
      <rect fill={INK_BLACK} x="17.1" y="33.9" width="2.6" height="2.6" rx="0.9" />
      <rect fill={INK_BLACK} x="21.2" y="33.9" width="2.6" height="2.6" rx="0.9" />
      <rect fill={INK_BLACK} x="25.3" y="33.9" width="2.6" height="2.6" rx="0.9" />
      <rect fill={INK_BLACK} x="29.6" y="33.9" width="2.6" height="2.6" rx="0.9" />
    </g>

    <g data-part="hull-tank">
      <rect fill={INK_WHITE} x="9" y="25.5" width="27" height="8" rx={RX} />
      {/* Player-color flank stripes — visible in tank mode under packed siege armor. */}
      <g data-part="hull-stripes">
        <rect fill={props.team} x="9.6" y="26.4" width="2.1" height="5.8" rx="0.7" />
        <rect fill={props.team} x="12.2" y="26.4" width="2.1" height="5.8" rx="0.7" />
        <rect fill={props.team} x="30.7" y="26.4" width="2.1" height="5.8" rx="0.7" />
        <rect fill={props.team} x="33.3" y="26.4" width="2.1" height="5.8" rx="0.7" />
      </g>
      <rect fill={INK_WHITE} x="12.2" y="21.2" width="20.6" height="5.8" rx={RX} />
      {/* Siege peak overlaid on the top deck (was a ghost line when armor packed). */}
      <path fill={INK_WHITE} d="M14 21.2 L22.5 17.6 L31 21.2z" />
      <rect fill={INK_BLACK} x="20" y="28.8" width="5" height="3" rx="1.2" />
    </g>

    <g data-part="siege-armor">
      <g data-part="siege-hull">
        {/* Bottom flush with track ground (y=38.2) — same plant as piece-sets static. */}
        <path fill={INK_WHITE} d="M5 38.2 L10 26 L35 26 L40 38.2z" />
        <path fill={INK_WHITE} d="M12 26 L22.5 22 L33 26z" />
        <rect fill={INK_BLACK} x="20" y="33.5" width="5" height="3" rx="1" />
      </g>
      <g data-part="skirt-front">
        <path fill={props.team} d="M14 28 L22.5 26 L31 28 L31 30 L14 30z" />
      </g>
      <g data-part="skirt-left">
        <path fill={props.team} d="M6 38.2 L10 28 L14 28 L10 38.2z" />
      </g>
      <g data-part="skirt-right">
        <path fill={props.team} d="M31 28 L35 28 L39 38.2 L35 38.2z" />
      </g>
    </g>
  </g>
);

const Turret: Component<{ team: string }> = (props) => (
  <g transform={`translate(${PIVOT.x} ${PIVOT.y})`}>
    {/*
      Dual-faced deck: twins (+x) vs siege twins on the reverse face (rotate 180).
      CSS rotates the deck 180° tank↔siege so the team mantlet spins while one
      face withdraws and the other draws. Rest siege ≡ wR.svg (deck 180 + face
      180 cancel → local +x under aim −135 × scale 1.1).
    */}
    <g data-part="turret-deck">
      <g data-part="shock-face" transform="rotate(180)">
        <g data-part="battery-recoil">
          <g data-part="shock-slide">
            <g transform={`scale(${SIEGE_GUN_SCALE})`}>
              <SiegeTwins team={props.team} />
            </g>
          </g>
        </g>
      </g>

      <g data-part="twins-face">
        <g data-part="twins-slide">
          <g transform={`scale(${TWIN_BATTERY_SCALE_ROOK})`}>
            <TwinBattery team={props.team} gap={1.2} />
          </g>
        </g>
      </g>
    </g>
  </g>
);

/**
 * Siege Tank — siege rest matches `public/pieces/nerd/*R.svg`; tank chassis unchanged.
 * Turret deck spins 180° on toggle; armor plates stagger independently.
 */
export const InlineRook: Component<InlineRookProps> = (props) => {
  const color = (): PieceColor => props.color ?? "w";
  const team = () => TEAM_PRIMARY[color()];
  const mode = (): RookMode => props.mode ?? "tank";
  const aimDeg = () => props.aimDeg ?? ROOK_REST_AIM_DEG;

  return (
    <svg
      class={styles.root}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 45 45"
      aria-hidden="true"
      overflow="visible"
      data-rook-mode={mode()}
      style={{ "--siege-toggle-ms": `${SIEGE_TOGGLE_MS}ms` }}
    >
      <g transform={PIECE_FRAME.R}>
        <g transform={`translate(22.5 22.5) scale(${ROOK_CONTENT_SCALE}) translate(-22.5 -22.5)`}>
          <g
            stroke={INK_BLACK}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width={ROOK_STROKE}
          >
            <Hull team={team()} />
            <g
              transform={svgPivotAroundAniso(
                PIVOT.x,
                PIVOT.y,
                aimDeg(),
                ROOK_FRAME_SCALE.sx,
                ROOK_FRAME_SCALE.sy,
              )}
            >
              <Turret team={team()} />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
};
