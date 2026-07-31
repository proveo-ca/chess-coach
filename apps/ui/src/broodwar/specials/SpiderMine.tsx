import type { Component } from "solid-js";

import styles from "~/broodwar/specials/SpiderMine.module.css";
import {
  TEAM_LIGHT,
  TEAM_PRIMARY,
  type PieceColor,
} from "~/broodwar/animations/teamColors";

type SpiderMineProps = {
  /** Owning player — white hull + team-color accents. */
  color?: PieceColor;
};

/**
 * Standstill spider mine — tooth-crown silhouette (no legs), two bumps.
 * Geometry is drawn already rotated 90° (bumps top/bottom). White + player color.
 * Legs stay hidden until an emerge anim (later).
 */
export const SpiderMine: Component<SpiderMineProps> = (props) => {
  const color = () => props.color ?? "w";
  const team = () => TEAM_PRIMARY[color()];
  const teamLight = () => TEAM_LIGHT[color()];

  return (
    <svg
      class={styles.mine}
      viewBox="0 0 40 40"
      aria-hidden="true"
      data-spider-mine
      data-color={color()}
    >
      <ellipse cx="20" cy="26.5" rx="8" ry="2.2" fill="rgba(0,0,0,0.14)" />

      {/*
        Tooth crown, 90° from the prior left/right-bump layout:
        long axis vertical; two bumps on the top and bottom sides.
      */}
      <path
        class={styles.enamel}
        fill="#fff"
        stroke="#222"
        stroke-width="1.15"
        stroke-linejoin="round"
        d="
          M16.5 14
          C12.2 14 10 16.4 10 20
          C10 23.6 12.2 26 16.5 26
          C16.8 28.8 18.4 30.5 20.8 30.5
          C23.4 30.5 25.2 28.6 25.5 26
          C28.2 25.2 30 22.8 30 20
          C30 17.2 28.2 14.8 25.5 14
          C25.2 11.4 23.4 9.5 20.8 9.5
          C18.4 9.5 16.8 11.2 16.5 14
          Z
        "
      />

      {/* Top / bottom bumps (was left / right, flipped 90°) */}
      <ellipse cx="20.6" cy="11.2" rx="3.4" ry="3.1" fill={team()} stroke="#222" stroke-width="0.9" />
      <ellipse cx="20.6" cy="28.8" rx="3.4" ry="3.1" fill={team()} stroke="#222" stroke-width="0.9" />
      <ellipse cx="19.4" cy="11.2" rx="1.2" ry="1.6" fill={teamLight()} opacity="0.7" />
      <ellipse cx="19.4" cy="28.8" rx="1.2" ry="1.6" fill={teamLight()} opacity="0.7" />

      <ellipse cx="16.2" cy="20" rx="2.2" ry="4.2" fill="#fff" opacity="0.5" />

      <circle cx="20.5" cy="20" r="2.1" fill={team()} stroke="#222" stroke-width="0.85" />
      <circle class={styles.sensor} cx="20.2" cy="20" r="1.05" fill={teamLight()} />
    </svg>
  );
};
