import { For, createMemo, createUniqueId, type Component } from "solid-js";

import { CC_REST_AIM_DEG, svgPivotLocal } from "~/presentation/pieces/geometry";
import { FireColumn, pickFireSpots } from "~/presentation/pieces/ccFire";
import { TwinBattery, TWIN_BATTERY_SCALE_CC } from "~/presentation/pieces/TwinBattery";
import styles from "~/presentation/pieces/InlineCommandCenter.module.css";
import {
  PIECE_FRAME,
  TEAM_PRIMARY,
  type PieceColor,
} from "~/presentation/pieces/teamColors";
import type { CCDamageState } from "~/presentation/types";

type InlineCommandCenterProps = {
  color?: PieceColor;
  /** Absolute screen aim degrees; dual cannons point along +x after pivot. */
  aimDeg?: number;
  /** Carry HP fire overlays through the attack anim (don't swap to pristine). */
  damage?: CCDamageState;
  /** Stable fire-spot seed — match the damage overlay so flames don't jump. */
  seed?: number;
};

/**
 * Experimental Command Center — matches `apps/chess/public/pieces/nerd/*K.svg` fills.
 * Base stays static; only the top dual cannons rotate to aim.
 */
export const InlineCommandCenter: Component<InlineCommandCenterProps> = (props) => {
  const uid = createUniqueId();
  const color = (): PieceColor => props.color ?? "w";
  const team = () => TEAM_PRIMARY[color()];
  const aimDeg = () => props.aimDeg ?? CC_REST_AIM_DEG;
  const damage = (): CCDamageState => props.damage ?? "pristine";
  const fireSeed = () => props.seed ?? 0xc0ffee;
  const smallSpots = createMemo(() => pickFireSpots(fireSeed(), 1));
  const bigSpots = createMemo(() => pickFireSpots(fireSeed() ^ 0x9e3779b9, 2));

  return (
    <svg
      class={styles.root}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 45 45"
      aria-hidden="true"
      overflow="visible"
      data-cc-damage={damage()}
      data-team={color()}
    >
      <g transform={PIECE_FRAME.K}>
        <defs>
          <radialGradient id={`${uid}-core`} cx="50%" cy="70%" r="55%">
            <stop offset="0" stop-color="#fff6d0" stop-opacity="0.95" />
            <stop offset="0.35" stop-color="#ffc14a" stop-opacity="0.9" />
            <stop offset="0.7" stop-color="#ff6a1a" stop-opacity="0.65" />
            <stop offset="1" stop-color="#ff3b1a" stop-opacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}-ember`} cx="50%" cy="60%" r="60%">
            <stop offset="0" stop-color="#ffb020" stop-opacity="0.85" />
            <stop offset="0.55" stop-color="#e04810" stop-opacity="0.55" />
            <stop offset="1" stop-color="#6a1808" stop-opacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}-smoke`} cx="50%" cy="80%" r="70%">
            <stop offset="0" stop-color="#d8d0c4" stop-opacity="0.55" />
            <stop offset="0.4" stop-color="#6a6560" stop-opacity="0.4" />
            <stop offset="1" stop-color="#2a2826" stop-opacity="0" />
          </radialGradient>
        </defs>
        <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35">
          <ellipse cx="22.5" cy="28.8" rx="19" ry="13.7" fill="#555" />
          <ellipse cx="22.5" cy="35.5" rx="15.8" ry="7.5" fill={team()} />
          <ellipse cx="8.5" cy="27" rx="5.8" ry="8.3" fill={team()} />
          <ellipse cx="36.5" cy="27" rx="5.8" ry="8.3" fill={team()} />
          <ellipse cx="8" cy="34" rx="4.5" ry="5" fill={team()} />
          <ellipse cx="37" cy="34" rx="4.5" ry="5" fill={team()} />
          <ellipse cx="22.5" cy="25.5" rx="14.3" ry="10.5" fill="#c8c8c8" />
          <ellipse cx="22.5" cy="28" rx="12.8" ry="7" fill="#fff" />

          <g data-part="hat">
            <ellipse cx="22.5" cy="19" rx="10.2" ry="6" fill={team()} />
            <ellipse cx="22.5" cy="15.5" rx="9" ry="4.2" fill={team()} />
            <ellipse cx="22.5" cy="15.1" rx="6.2" ry="2.7" fill="#555" />
            <ellipse cx="22.5" cy="14.3" rx="3.8" ry="2" fill="#222" />
          </g>

          <ellipse cx="22.5" cy="35" rx="7.3" ry="7.5" fill="#222" />
          <ellipse cx="22.5" cy="35.5" rx="5.3" ry="5.8" fill="#222" />
          <ellipse cx="22.5" cy="32.5" rx="5.1" ry="1.5" fill={team()} />
          <path d="M19.1 36.4h6.8M19 39h7" fill="none" stroke="#555" stroke-width=".9" />
          <g fill={team()} stroke={team()} stroke-width=".65">
            <circle cx="12.2" cy="34.2" r="1" />
            <circle cx="32.8" cy="34.2" r="1" />
            <circle cx="9.3" cy="25.1" r=".8" />
            <circle cx="35.7" cy="25.1" r=".8" />
          </g>

          {/* Exact same TwinBattery SVG as InlineTank tank mode (size-matched). */}
          <g transform={svgPivotLocal(22.5, 18, aimDeg())}>
            <g data-part="cannons" opacity="0" transform={`scale(${TWIN_BATTERY_SCALE_CC})`}>
              <TwinBattery team={team()} />
            </g>
          </g>

          <g data-part="fire-small" stroke="none">
            <For each={smallSpots()}>
              {(spot) => (
                <FireColumn
                  cx={spot.cx}
                  cy={spot.cy}
                  size="small"
                  coreId={`${uid}-core`}
                  emberId={`${uid}-ember`}
                  smokeId={`${uid}-smoke`}
                />
              )}
            </For>
          </g>
          <g data-part="fire-big" stroke="none">
            <For each={bigSpots()}>
              {(spot) => (
                <FireColumn
                  cx={spot.cx}
                  cy={spot.cy}
                  size="big"
                  coreId={`${uid}-core`}
                  emberId={`${uid}-ember`}
                  smokeId={`${uid}-smoke`}
                />
              )}
            </For>
          </g>
        </g>
      </g>
    </svg>
  );
};
