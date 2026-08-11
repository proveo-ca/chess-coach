import type { Component } from "solid-js";

import {
  TEAM_PRIMARY,
  type PieceColor,
  PIECE_FRAME,
} from "~/presentation/animations/teamColors";
import { Shard } from "~/presentation/animations/pieces/components/Shard";

type DeathPawnProps = {
  color?: PieceColor;
  seed: number;
};

export const DeathPawn: Component<DeathPawnProps> = (props) => {
  const color = () => props.color ?? "w";
  const team = () => TEAM_PRIMARY[color()];
  const seed = () => props.seed;
  /** Visor block: wP `#555`, bP `#222` (barrel stays `#555`). */
  const gunBlock = () => (color() === "b" ? "#222" : "#555");

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true" overflow="visible">
      <g transform={PIECE_FRAME.P}>
        {/* Exact standstill framing from public *P.svg / InlinePawn */}
        <g
          stroke="#222"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1"
          transform="translate(2.25,2.25) scale(0.9)"
        >
          <Shard index={0} seed={seed()} distScale={0.55}>
            <path fill={team()} d="M16 38 Q16 41 18 41 L20 41 Q21 41 21 39 L21 36z" />
          </Shard>
          <Shard index={1} seed={seed()} distScale={0.55}>
            <path fill={team()} d="M24 36 L24 39 Q24 41 25 41 L27 41 Q29 41 29 38z" />
          </Shard>
          <Shard index={2} seed={seed()} distScale={0.55}>
            <ellipse fill={team()} cx="22.5" cy="34" rx="8" ry="5" />
          </Shard>
          <Shard index={3} seed={seed()} distScale={0.55}>
            <circle fill={team()} cx="15" cy="31" r="2.5" />
          </Shard>
          <Shard index={4} seed={seed()} distScale={0.55}>
            <circle fill={team()} cx="30" cy="31" r="2.5" />
          </Shard>
          <Shard index={5} seed={seed()} distScale={0.6}>
            <ellipse fill="#fff" cx="22.5" cy="22" rx="13" ry="14" />
          </Shard>
          <Shard index={6} seed={seed()} distScale={0.5}>
            <path fill="#fff" stroke="none" d="M16 14 Q18 10 24 11 Q20 10 16 14z" />
          </Shard>
          <Shard index={7} seed={seed()} distScale={0.55}>
            <rect fill={gunBlock()} x="8" y="24" width="16" height="9" rx="2" />
          </Shard>
          <Shard index={8} seed={seed()} distScale={0.65}>
            <path fill="#555" d="M8 26 L4 26 L4 30 L8 30z" />
          </Shard>
        </g>

        <ellipse
          data-part="bubble-ring"
          cx="22.5"
          cy="24"
          rx="15"
          ry="16"
          fill="none"
          stroke="#c8e8ff"
          stroke-width="1"
          opacity="0"
        />
        <ellipse
          data-part="bubble-ring-outer"
          cx="22.5"
          cy="24"
          rx="17"
          ry="18"
          fill="none"
          stroke="rgba(180, 220, 255, 0.55)"
          stroke-width="1"
          opacity="0"
        />
        <ellipse
          data-part="bubble-shine"
          cx="16"
          cy="16"
          rx="4"
          ry="2.5"
          fill="#ffffff"
          stroke="none"
          opacity="0"
        />
      </g>
    </svg>
  );
};
