import { For, createMemo, createUniqueId, type Component, type JSX } from "solid-js";

import { rubbleSettleStyle } from "~/starchess/animations/deathAnim";
import { FireColumn, pickFireSpots } from "~/starchess/animations/pieces/kingFire";
import styles from "~/starchess/animations/pieces/DeathKing.module.css";
import { TEAM_DARK, TEAM_LIGHT, type PieceColor, NERD_FRAME } from "~/starchess/animations/teamColors";
import type { KingDamageState } from "~/starchess/types";

type DeathKingProps = {
  seed?: number;
  color?: PieceColor;
  /**
   * King HP presentation:
   * - `pristine` — intact command center
   * - `smallFire` — little fires (2 lives)
   * - `bigFire` — large fires (1 life)
   * - `destroyed` — rubble pile (0 lives)
   */
  damage?: KingDamageState;
  /**
   * When true with `destroyed`, animate parts collapsing into rubble (death cue).
   * When false/omitted, show the settled rubble pile.
   */
  collapse?: boolean;
};

/** Command center — damage states + rubble collapse (no outward shatter). */
export const DeathKing: Component<DeathKingProps> = (props) => {
  const uid = createUniqueId();
  const bodyGrad = `${uid}-body`;
  const teamGrad = `${uid}-team`;
  /** Stable per-instance seed when parent doesn't pass one (overlay HP states). */
  const instanceSeed = Math.floor(Math.random() * 0xffffffff);

  const damage = (): KingDamageState => props.damage ?? "destroyed";
  const collapse = () => !!props.collapse && damage() === "destroyed";
  const fireSeed = () => props.seed ?? instanceSeed;
  const color = (): PieceColor => props.color ?? "w";

  const smallSpots = createMemo(() => pickFireSpots(fireSeed(), 1));
  const bigSpots = createMemo(() => pickFireSpots(fireSeed() ^ 0x9e3779b9, 2));

  const wrap = (index: number, children: JSX.Element): JSX.Element => {
    if (damage() !== "destroyed") return children;
    const settle = rubbleSettleStyle(index, props.seed ?? 0);
    const style = `--rx:${settle["--rx"]};--ry:${settle["--ry"]};--rspin:${settle["--rspin"]}`;
    return (
      <g data-rubble style={style}>
        {children}
      </g>
    );
  };

  return (
    <svg
      class={styles.root}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 45 45"
      aria-hidden="true"
      overflow="visible"
      data-king-damage={damage()}
      data-collapse={collapse() ? "true" : "false"}
      data-team={color()}
    >
      <g transform={NERD_FRAME.K}>
      <defs>
        <linearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" />
          <stop offset="1" stop-color="#555" />
        </linearGradient>
        <linearGradient id={teamGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={TEAM_LIGHT[color()]} />
          <stop offset="1" stop-color={TEAM_DARK[color()]} />
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
      <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35">
        {wrap(0, <ellipse cx="22.5" cy="28.8" rx="19" ry="13.7" fill="#555" />)}
        {wrap(1, <ellipse cx="22.5" cy="35.5" rx="15.8" ry="7.5" fill={TEAM_LIGHT[color()]} />)}
        {wrap(
          2,
          <>
            <ellipse cx="8.5" cy="27" rx="5.8" ry="8.3" fill={`url(#${teamGrad})`} />
            <ellipse cx="8" cy="34" rx="4.5" ry="5" fill={TEAM_DARK[color()]} />
          </>,
        )}
        {wrap(
          3,
          <>
            <ellipse cx="36.5" cy="27" rx="5.8" ry="8.3" fill={`url(#${teamGrad})`} />
            <ellipse cx="37" cy="34" rx="4.5" ry="5" fill={TEAM_DARK[color()]} />
          </>,
        )}
        {wrap(
          4,
          <>
            <ellipse cx="22.5" cy="25.5" rx="14.3" ry="10.5" fill={`url(#${bodyGrad})`} />
            <ellipse cx="22.5" cy="28" rx="12.8" ry="7" fill="#fff" />
          </>,
        )}
        {wrap(
          5,
          <>
            <ellipse cx="22.5" cy="19" rx="10.2" ry="6" fill={`url(#${teamGrad})`} />
            <ellipse cx="22.5" cy="15.5" rx="9" ry="4.2" fill={TEAM_LIGHT[color()]} />
            <ellipse cx="22.5" cy="15.1" rx="6.2" ry="2.7" fill="#555" />
            <ellipse cx="22.5" cy="14.3" rx="3.8" ry="2" fill="#222" />
          </>,
        )}
        {wrap(
          6,
          <>
            <ellipse cx="22.5" cy="35" rx="7.3" ry="7.5" fill="#222" />
            <ellipse cx="22.5" cy="35.5" rx="5.3" ry="5.8" fill="#222" />
            <ellipse cx="22.5" cy="32.5" rx="5.1" ry="1.5" fill={TEAM_DARK[color()]} />
            <path d="M19.1 36.4h6.8M19 39h7" fill="none" stroke="#555" stroke-width=".9" />
          </>,
        )}
        {wrap(
          7,
          <g fill={TEAM_LIGHT[color()]} stroke={TEAM_LIGHT[color()]} stroke-width=".65">
            <circle cx="12.2" cy="34.2" r="1" />
            <circle cx="9.3" cy="25.1" r=".8" />
          </g>,
        )}
        {wrap(
          8,
          <g fill={TEAM_LIGHT[color()]} stroke={TEAM_LIGHT[color()]} stroke-width=".65">
            <circle cx="32.8" cy="34.2" r="1" />
            <circle cx="35.7" cy="25.1" r=".8" />
          </g>,
        )}

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
    
      </g></svg>
  );
};
