import type { Component } from "solid-js";

import { Shard } from "~/presentation/animations/pieces/components/Shard";
import { TEAM_PRIMARY, type PieceColor, PIECE_FRAME } from "~/presentation/pieces/teamColors";

type DeathHoverbikeProps = {
  seed: number;
  color?: PieceColor;
};

/** Hoverbike — body parts scatter after the boom. */
export const DeathHoverbike: Component<DeathHoverbikeProps> = (props) => {
  const team = () => TEAM_PRIMARY[props.color ?? "w"];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true" overflow="visible">
      <Shard index={0} seed={props.seed}>
        <ellipse fill="#555" cx="22.5" cy="41" rx="11" ry="2.2" stroke="none" opacity="0.3" />
      </Shard>
      <g transform={PIECE_FRAME.N}>
        {/* Rest pose — same nest as InlineHoverbike with no aimPose, i.e. `*N.svg`.
            Must stay in step with it: a Hoverbike that dies while resting swaps to
            this hull in place, so any orientation gap shows as a rotation jump. */}
        <g transform="translate(22.5 22.5) scale(1.1) translate(-22.5 -22.5)">
        <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">
          <Shard index={1} seed={props.seed}>
            <ellipse fill={team()} cx="31" cy="10" rx="5" ry="3.5" transform="rotate(-50 31 10)" />
          </Shard>
          <Shard index={2} seed={props.seed}>
            <path fill="#fff" d="M5 40 Q1 37 4 33 L34 9 Q39 6 42 10 Q44 14 39 17z" />
          </Shard>
          <Shard index={3} seed={props.seed}>
            <path fill="#fff" stroke="none" d="M8 36 L36 10 Q41 8 41 12 L11 36z" />
          </Shard>
          <Shard index={4} seed={props.seed}>
            <ellipse fill={team()} cx="16" cy="34" rx="5" ry="3.5" transform="rotate(-30 -1 -14)" />
          </Shard>
          <Shard index={5} seed={props.seed}>
            <path fill="#fff" d="M14 32 L9 35 L11 34 L15 30z" />
          </Shard>
          <Shard index={6} seed={props.seed}>
            <path fill="#fff" d="M27 15 L22 18 L24 17 L28 13z" />
          </Shard>
          <Shard index={7} seed={props.seed}>
            <ellipse fill="#fff" cx="24" cy="20" rx="4" ry="3.5" />
            <ellipse fill="#fff" cx="24" cy="18" rx="3.5" ry="3" />
            <path fill={team()} d="M21.5 18 L24 16.5 L26.5 18 L24 19.5z" />
            <path fill="#fff" stroke="#222" stroke-width="1" d="M22 21 Q24 23.5 26 21z" />
          </Shard>
        </g>
        </g>
      </g>
    </svg>
  );
};
