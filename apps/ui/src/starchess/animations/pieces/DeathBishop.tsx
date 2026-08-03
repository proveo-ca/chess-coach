import type { Component } from "solid-js";

import {
  TEAM_PRIMARY,
  type PieceColor, NERD_FRAME } from "~/starchess/animations/teamColors";
import { Shard } from "~/starchess/animations/pieces/Shard";

type DeathBishopProps = {
  color?: PieceColor;
  /** Per-occurrence scatter seed (from death cue id). */
  seed: number;
};

const Gatling = (props: { cx: number; cy: number; team: string }) => (
  <>
    <ellipse fill={props.team} cx={props.cx} cy={props.cy} rx="5" ry="6" />
    <circle fill="#fff" cx={props.cx} cy={props.cy} r="3.6" stroke="#222" stroke-width="1.2" />
    <circle fill="#555" cx={props.cx} cy={props.cy} r="2.9" stroke="none" />
    <circle fill="#222" cx={props.cx + 2} cy={props.cy} r="0.7" stroke="none" />
    <circle fill="#222" cx={props.cx + 1} cy={props.cy + 1.73} r="0.7" stroke="none" />
    <circle fill="#222" cx={props.cx - 1} cy={props.cy + 1.73} r="0.7" stroke="none" />
    <circle fill="#222" cx={props.cx - 2} cy={props.cy} r="0.7" stroke="none" />
    <circle fill="#222" cx={props.cx - 1} cy={props.cy - 1.73} r="0.7" stroke="none" />
    <circle fill="#222" cx={props.cx + 1} cy={props.cy - 1.73} r="0.7" stroke="none" />
  </>
);

/**
 * Goliath shatter — legs, canopy halves, shine, and both gatlings each fly
 * on their own vector (seeded per death cue).
 */
export const DeathBishop: Component<DeathBishopProps> = (props) => {
  const team = () => TEAM_PRIMARY[props.color ?? "w"];
  const seed = () => props.seed;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true" overflow="visible">
      <g transform={NERD_FRAME.B}>
      <defs>
        <clipPath id={`sc-bishop-left-${seed()}`}>
          <rect x="0" y="0" width="22.5" height="45" />
        </clipPath>
        <clipPath id={`sc-bishop-right-${seed()}`}>
          <rect x="22.5" y="0" width="22.5" height="45" />
        </clipPath>
      </defs>
      <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
        <Shard index={0} seed={seed()}>
          <ellipse fill={team()} cx="12" cy="40" rx="5" ry="2.5" />
          <line x1="14" y1="38" x2="18" y2="28" stroke-width="2.5" />
        </Shard>
        <Shard index={1} seed={seed()}>
          <ellipse fill={team()} cx="33" cy="40" rx="5" ry="2.5" />
          <line x1="31" y1="38" x2="27" y2="28" stroke-width="2.5" />
        </Shard>
        {/* Cockpit split so the big dome doesn't read as one flying SVG. */}
        <Shard index={2} seed={seed()}>
          <ellipse
            fill="#fff"
            cx="22.5"
            cy="20"
            rx="10"
            ry="12"
            clip-path={`url(#sc-bishop-left-${seed()})`}
          />
        </Shard>
        <Shard index={3} seed={seed()}>
          <ellipse
            fill="#fff"
            cx="22.5"
            cy="20"
            rx="10"
            ry="12"
            clip-path={`url(#sc-bishop-right-${seed()})`}
          />
        </Shard>
        <Shard index={4} seed={seed()}>
          <ellipse fill="#fff" cx="18" cy="16" rx="3" ry="5" stroke="none" />
        </Shard>
        <Shard index={5} seed={seed()}>
          <Gatling cx={10} cy={20} team={team()} />
        </Shard>
        <Shard index={6} seed={seed()}>
          <Gatling cx={35} cy={20} team={team()} />
        </Shard>
      </g>
    
      </g></svg>
  );
};
