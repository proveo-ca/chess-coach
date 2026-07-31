import type { Component } from "solid-js";

import { ROOK_REST_AIM_DEG, svgPivotAround } from "~/broodwar/animations/attackAnim";
import { TEAM_PRIMARY, type PieceColor, NERD_FRAME } from "~/broodwar/animations/teamColors";

type InlineRookProps = {
  color?: PieceColor;
  /**
   * Absolute screen aim degrees (0 = +file/right, 90 = toward rank 1).
   * Defaults to the resting muzzle angle from `public/pieces/nerd/*R.svg`.
   */
  aimDeg?: number;
};

/**
 * Experimental Siege Tank. Hull matches `public/pieces/nerd/wR.svg` /
 * `bR.svg`; only the turret + twin cannons rotate to aim.
 */
export const InlineRook: Component<InlineRookProps> = (props) => {
  const team = () => TEAM_PRIMARY[props.color ?? "w"];
  const aimDeg = () => props.aimDeg ?? ROOK_REST_AIM_DEG;
  const pivotDeg = () => aimDeg() - ROOK_REST_AIM_DEG;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true" overflow="visible">
      <g transform={NERD_FRAME.R}>
      <g transform="translate(22.5 22.5) scale(1.25) translate(-22.5 -22.5)">
        <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
          <path fill="#fff" d="M5 36 L10 26 L35 26 L40 36z" />
          <path fill={team()} d="M6 35 L10 28 L14 28 L10 35z" />
          <path fill={team()} d="M31 28 L35 28 L39 35 L35 35z" />
          <path fill={team()} d="M14 28 L22.5 26 L31 28 L31 30 L14 30z" />
          <path fill="#fff" d="M12 26 L22.5 22 L33 26z" />
          <rect fill="#222" x="20" y="32" width="5" height="3" rx="1" />

          <g transform={svgPivotAround(22.5, 21.5, pivotDeg())}>
            <g data-part="battery-recoil">
              <rect fill={team()} x="18" y="19" width="9" height="5" rx="1" />
              <path fill="#fff" stroke="#222" d="M20 20 L12 12 L14 11 L22 19z" />
              <path fill="#fff" stroke="#222" d="M25 20 L17 12 L19 11 L27 19z" />
              <rect
                fill="#fff"
                x="11"
                y="10"
                width="4"
                height="3"
                rx="0.5"
                transform="rotate(-45 13 11.5)"
              />
              <rect
                fill="#fff"
                x="16"
                y="10"
                width="4"
                height="3"
                rx="0.5"
                transform="rotate(-45 18 11.5)"
              />
              <ellipse
                data-part="battery-blast"
                fill="#fff2a8"
                cx="14.5"
                cy="11"
                rx="7.5"
                ry="5.6"
                stroke="none"
                opacity="0"
              />
              <g data-part="battery-smoke" opacity="0">
                <ellipse fill="#4a4540" cx="12" cy="9" rx="3.5" ry="2.2" stroke="none" opacity="0.85" />
                <ellipse fill="#6a635c" cx="10" cy="7.5" rx="4" ry="2.6" stroke="none" opacity="0.65" />
                <ellipse fill="#2e2b28" cx="8" cy="6.5" rx="2.8" ry="1.8" stroke="none" opacity="0.5" />
              </g>
            </g>
          </g>
        </g>
      </g>
    
      </g></svg>
  );
};
