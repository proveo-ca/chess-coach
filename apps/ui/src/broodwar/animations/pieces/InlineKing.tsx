import { For, createMemo, createUniqueId, type Component } from "solid-js";

import { KING_REST_AIM_DEG, svgPivotAround } from "~/broodwar/animations/attackAnim";
import { FireColumn, pickFireSpots } from "~/broodwar/animations/pieces/kingFire";
import damageStyles from "~/broodwar/animations/pieces/KingDamage.module.css";
import type { KingDamageState } from "~/broodwar/types";

type InlineKingProps = {
  /** Absolute screen aim degrees; dual cannons point along +x after pivot. */
  aimDeg?: number;
  /** Carry HP fire overlays through the attack anim (don't swap to pristine). */
  damage?: KingDamageState;
  /** Stable fire-spot seed — match the damage overlay so flames don't jump. */
  seed?: number;
};

/**
 * Experimental Command Center. Base stays static; only the top dual cannons
 * rotate to aim (same pattern as the siege-tank battery).
 * Optional `damage` keeps smallFire/bigFire columns during kingDualCannon.
 */
export const InlineKing: Component<InlineKingProps> = (props) => {
  const uid = createUniqueId();
  const bodyGrad = `${uid}-body`;
  const blueGrad = `${uid}-blue`;
  const aimDeg = () => props.aimDeg ?? KING_REST_AIM_DEG;
  const damage = (): KingDamageState => props.damage ?? "pristine";
  const fireSeed = () => props.seed ?? 0xc0ffee;
  const smallSpots = createMemo(() => pickFireSpots(fireSeed(), 1));
  const bigSpots = createMemo(() => pickFireSpots(fireSeed() ^ 0x9e3779b9, 2));

  return (
    <svg
      class={damageStyles.root}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 45 45"
      aria-hidden="true"
      overflow="visible"
      data-king-damage={damage()}
    >
      <defs>
        <linearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c7d0d8" />
          <stop offset="1" stop-color="#68727d" />
        </linearGradient>
        <linearGradient id={blueGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#55a7ff" />
          <stop offset="1" stop-color="#1f5cae" />
        </linearGradient>
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
      <g stroke="#20262c" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35">
        <ellipse cx="22.5" cy="28.8" rx="19" ry="13.7" fill="#4d5761" />
        <ellipse cx="22.5" cy="35.5" rx="15.8" ry="7.5" fill="#313a43" />
        <ellipse cx="8.5" cy="27" rx="5.8" ry="8.3" fill={`url(#${blueGrad})`} />
        <ellipse cx="36.5" cy="27" rx="5.8" ry="8.3" fill={`url(#${blueGrad})`} />
        <ellipse cx="8" cy="34" rx="4.5" ry="5" fill="#17477f" />
        <ellipse cx="37" cy="34" rx="4.5" ry="5" fill="#17477f" />
        <ellipse cx="22.5" cy="25.5" rx="14.3" ry="10.5" fill={`url(#${bodyGrad})`} />
        <ellipse cx="22.5" cy="28" rx="12.8" ry="7" fill="#8e9aa5" />

        <g data-part="hat">
          <ellipse cx="22.5" cy="19" rx="10.2" ry="6" fill={`url(#${blueGrad})`} />
          <ellipse cx="22.5" cy="15.5" rx="9" ry="4.2" fill="#80b9e9" />
          <ellipse cx="22.5" cy="15.1" rx="6.2" ry="2.7" fill="#49545e" />
          <ellipse cx="22.5" cy="14.3" rx="3.8" ry="2" fill="#2b333a" />
        </g>

        <ellipse cx="22.5" cy="35" rx="7.3" ry="7.5" fill="#2b333a" />
        <ellipse cx="22.5" cy="35.5" rx="5.3" ry="5.8" fill="#111820" />
        <ellipse cx="22.5" cy="32.5" rx="5.1" ry="1.5" fill="#286dbb" />
        <path d="M19.1 36.4h6.8M19 39h7" fill="none" stroke="#687782" stroke-width=".9" />
        <g fill="#ffd75a" stroke="#5c4610" stroke-width=".65">
          <circle cx="12.2" cy="34.2" r="1" />
          <circle cx="32.8" cy="34.2" r="1" />
          <circle cx="9.3" cy="25.1" r=".8" />
          <circle cx="35.7" cy="25.1" r=".8" />
        </g>

        {/* Pivot has no data-part; reveal+recoil on inner group. */}
        <g transform={svgPivotAround(22.5, 18, aimDeg())}>
          <g data-part="cannons" opacity="0">
            <g data-part="cannon-recoil">
              <rect x="24" y="15.5" width="14" height="3.2" rx="1" fill="#2b333a" />
              <rect x="24" y="20.5" width="14" height="3.2" rx="1" fill="#2b333a" />
              <ellipse
                data-part="cannon-flash"
                cx="39.5"
                cy="17.1"
                rx="2.8"
                ry="2"
                fill="#ffe08a"
                stroke="none"
              />
              <ellipse
                data-part="cannon-flash"
                cx="39.5"
                cy="22.1"
                rx="2.8"
                ry="2"
                fill="#ffe08a"
                stroke="none"
              />
            </g>
          </g>
        </g>

        {/* HP fires — same overlay language as DeathKing / kingDamageOverlay. */}
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
    </svg>
  );
};
