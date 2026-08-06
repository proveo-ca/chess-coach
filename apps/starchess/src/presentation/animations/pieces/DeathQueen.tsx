import type { Component } from "solid-js";

import { Shard } from "~/presentation/animations/pieces/Shard";
import { TEAM_LIGHT, TEAM_PRIMARY, type PieceColor, NERD_FRAME } from "~/presentation/animations/teamColors";

type DeathQueenProps = {
  seed: number;
  color?: PieceColor;
};

/** Battlecruiser — jets, spine, and hammerhead peel off. */
export const DeathQueen: Component<DeathQueenProps> = (props) => {
  const team = () => TEAM_PRIMARY[props.color ?? "w"];
  const accent = () => TEAM_LIGHT[props.color ?? "w"];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true" overflow="visible">
      <g transform={NERD_FRAME.Q}>
      <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8">
        <Shard index={0} seed={props.seed}>
          <ellipse fill="#555" cx="22.5" cy="42" rx="16" ry="2" stroke="none" opacity=".25" />
        </Shard>
        <Shard index={1} seed={props.seed}>
          <rect fill="#555" x="13.5" y="2.5" width="7" height="12" rx="3" />
          <ellipse fill={accent()} cx="17" cy="3.5" rx="3" ry="1.6" />
        </Shard>
        <Shard index={2} seed={props.seed}>
          <rect fill="#555" x="24.5" y="2.5" width="7" height="12" rx="3" />
          <ellipse fill={accent()} cx="28" cy="3.5" rx="3" ry="1.6" />
        </Shard>
        <Shard index={3} seed={props.seed}>
          <path fill="#fff" d="M5 9 14 6 18 9h9l4-3 9 3-2 10-11-2-2 5h-5l-2-5-11 2z" />
        </Shard>
        <Shard index={4} seed={props.seed}>
          <path fill={team()} d="M7 10 14 8l3 3-2 4-8 1z" />
        </Shard>
        <Shard index={5} seed={props.seed}>
          <path fill={team()} d="m38 10-7-2-3 3 2 4 8 1z" />
        </Shard>
        <Shard index={6} seed={props.seed}>
          <path fill="#fff" d="m19 12 3.5-2 3.5 2 3 20-6.5 4-6.5-4z" />
          <path fill={team()} d="m18 22 4.5 3 4.5-3 1 7-5.5 4-5.5-4z" />
        </Shard>
        <Shard index={7} seed={props.seed}>
          <path fill="#fff" d="m4 32 12-4 6.5 3 6.5-3 12 4 1 7-9 4H12l-9-4z" />
        </Shard>
        <Shard index={8} seed={props.seed}>
          <path fill={team()} d="m6 33 9-3 3 3-3 6-9-1z" />
          <path fill="#222" d="m7 35 6-1 1 2-7 1z" />
        </Shard>
        <Shard index={9} seed={props.seed}>
          <path fill={team()} d="m39 33-9-3-3 3 3 6 9-1z" />
          <path fill="#222" d="m38 35-6-1-1 2 7 1z" />
        </Shard>
      </g>
    
      </g></svg>
  );
};
