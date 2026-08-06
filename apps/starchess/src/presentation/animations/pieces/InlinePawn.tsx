import type { Component } from "solid-js";

import { svgPivotAround, svgPivotLocal } from "~/presentation/animations/attackAnim";
import {
  TEAM_LIGHT,
  TEAM_PRIMARY,
  TEAM_SHADOW,
  NERD_FRAME,
  type PieceColor,
} from "~/presentation/animations/teamColors";

type InlinePawnProps = {
  color?: PieceColor;
  /**
   * Camera-relative silhouette: `front` = glass visor (wP/bP); `back` = team helmet.
   * Friendly pawns fire up (`back`); opposing pawns fire down (`front`).
   */
  face?: "front" | "back";
  /**
   * When set, marine is attacking. Hull stays fixed at the public `*P.svg`
   * layout; only the gun aims.
   * - `front`: gray visor-block + cannon (wP.svg gun) yaw about the face.
   * - `back`: barrel from elevated TL/TR shoulder under the helmet.
   */
  aimDeg?: number;
};

/**
 * Front gun pivot — right edge of the wP.svg visor rect (x=8..24, y=24..33),
 * where the block meets the dome.
 */
const FRONT_GUN_PIVOT = { cx: 22.5, cy: 28.5 };

/**
 * Local +x = muzzle. At `aimDeg=180` this matches public wP.svg gun:
 * rect (8,24)-(24,33), barrel (4,26)-(8,30).
 */
const FRONT_GUN_LOCAL = {
  block: { x: -1.5, y: -4.5, w: 16, h: 9 },
  barrel: { x: 14.5, y: -2, w: 4, h: 4 },
  flash: { cx: 20.5, cy: 0 },
};

/** Elevated shoulders so diagonal muzzles clear the back-face helmet. */
const PIVOT_TOP_LEFT = { cx: 13, cy: 18.5 };
const PIVOT_TOP_RIGHT = { cx: 32, cy: 18.5 };

/**
 * Marine aligned with `public/pieces/nerd/wP.svg` (same translate/scale + body).
 */
export const InlinePawn: Component<InlinePawnProps> = (props) => {
  const color = () => props.color ?? "w";
  const team = () => TEAM_PRIMARY[color()];
  const aiming = () => props.aimDeg != null;
  const front = () => (props.face ?? "front") === "front";
  const aimDeg = () => props.aimDeg ?? 0;

  const backPivot = () =>
    Math.cos((aimDeg() * Math.PI) / 180) < 0 ? PIVOT_TOP_LEFT : PIVOT_TOP_RIGHT;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true" overflow="visible">
      <g transform={NERD_FRAME.P}>
      {/* Exact standstill framing from public *P.svg */}
      <g
        stroke="#222"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        transform="translate(2.25,2.25) scale(0.9)"
      >
        <ellipse
          data-part="body-shadow"
          fill={TEAM_SHADOW[color()]}
          cx="22.5"
          cy="28"
          rx="10"
          ry="7"
          opacity="0"
          stroke="none"
        />

        {/* Legs + body + shoulders — legs split for hop cycle (MoveAnimation). */}
        <g data-part="body">
          <g
            data-part="leg-left"
            style={{ "transform-box": "fill-box", "transform-origin": "center top" }}
          >
            <path fill={team()} d="M16 38 Q16 41 18 41 L20 41 Q21 41 21 39 L21 36z" />
          </g>
          <g
            data-part="leg-right"
            style={{ "transform-box": "fill-box", "transform-origin": "center top" }}
          >
            <path fill={team()} d="M24 36 L24 39 Q24 41 25 41 L27 41 Q29 41 29 38z" />
          </g>
          <ellipse fill={team()} cx="22.5" cy="34" rx="8" ry="5" />
          <circle fill={team()} cx="15" cy="31" r="2.5" />
          <circle fill={team()} cx="30" cy="31" r="2.5" />
        </g>
        {/*
          Back-face attack: barrel under the helmet (drawn before the dome).
          Front-face keeps the public draw order (gun after dome).
        */}
        {aiming() && !front() && (
          <g transform={svgPivotAround(backPivot().cx, backPivot().cy, aimDeg())}>
            <g data-part="barrel">
              <rect
                fill="#555"
                x={backPivot().cx}
                y={backPivot().cy - 2}
                width="12"
                height="4"
                rx="1"
              />
              <ellipse
                data-part="muzzle-flash"
                fill="#ffe08a"
                cx={backPivot().cx + 13.5}
                cy={backPivot().cy}
                rx="3.8"
                ry="2.8"
                stroke="none"
                opacity="0"
              />
            </g>
          </g>
        )}

        {front() ? (
          <g data-part="head">
            {/* Glass dome + shine — wP.svg */}
            <ellipse fill="#fff" cx="22.5" cy="22" rx="13" ry="14" />
            <path fill="#fff" stroke="none" d="M16 14 Q18 10 24 11 Q20 10 16 14z" />

            {aiming() ? (
              /* Visor gun block + cannon — same silhouette as wP, yaw to aimDeg. */
              <g transform={svgPivotLocal(FRONT_GUN_PIVOT.cx, FRONT_GUN_PIVOT.cy, aimDeg())}>
                <g data-part="barrel">
                  <rect
                    fill="#555"
                    x={FRONT_GUN_LOCAL.block.x}
                    y={FRONT_GUN_LOCAL.block.y}
                    width={FRONT_GUN_LOCAL.block.w}
                    height={FRONT_GUN_LOCAL.block.h}
                    rx="2"
                  />
                  <rect
                    fill="#555"
                    x={FRONT_GUN_LOCAL.barrel.x}
                    y={FRONT_GUN_LOCAL.barrel.y}
                    width={FRONT_GUN_LOCAL.barrel.w}
                    height={FRONT_GUN_LOCAL.barrel.h}
                  />
                  <ellipse
                    data-part="muzzle-flash"
                    fill="#ffe08a"
                    cx={FRONT_GUN_LOCAL.flash.cx}
                    cy={FRONT_GUN_LOCAL.flash.cy}
                    rx="3.8"
                    ry="2.8"
                    stroke="none"
                    opacity="0"
                  />
                </g>
              </g>
            ) : (
              <>
                {/* Idle gun — exact wP.svg paths */}
                <rect fill="#555" x="8" y="24" width="16" height="9" rx="2" />
                <path fill="#555" d="M8 26 L4 26 L4 30 L8 30z" />
              </>
            )}
          </g>
        ) : (
          <g data-part="head">
            {/* Team helmet toward camera */}
            <ellipse fill={team()} cx="22.5" cy="22" rx="13" ry="14" />
            <ellipse
              fill={TEAM_LIGHT[color()]}
              cx="19"
              cy="16"
              rx="5"
              ry="6"
              stroke="none"
              opacity="0.55"
            />
            {!aiming() && <path fill="#555" d="M8 26 L4 26 L4 30 L8 30z" />}
          </g>
        )}
      </g>
      </g>
    </svg>
  );
};
