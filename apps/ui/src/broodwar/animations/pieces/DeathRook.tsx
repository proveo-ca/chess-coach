import type { Component } from "solid-js";

import { Shard } from "~/broodwar/animations/pieces/Shard";

type DeathRookProps = {
  seed: number;
};

/** Siege tank — hull panels and twin cannons scatter. */
export const DeathRook: Component<DeathRookProps> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true" overflow="visible">
    <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
      <Shard index={0} seed={props.seed}>
        <path fill="#999" d="M5 36 L10 26 L35 26 L40 36z" />
      </Shard>
      <Shard index={1} seed={props.seed}>
        <path fill="#3b7dd8" d="M6 35 L10 28 L14 28 L10 35z" />
      </Shard>
      <Shard index={2} seed={props.seed}>
        <path fill="#3b7dd8" d="M31 28 L35 28 L39 35 L35 35z" />
      </Shard>
      <Shard index={3} seed={props.seed}>
        <path fill="#3b7dd8" d="M14 28 L22.5 26 L31 28 L31 30 L14 30z" />
      </Shard>
      <Shard index={4} seed={props.seed}>
        <path fill="#aaa" d="M12 26 L22.5 22 L33 26z" />
      </Shard>
      <Shard index={5} seed={props.seed}>
        <rect fill="#3b7dd8" x="18" y="19" width="9" height="5" rx="1" />
      </Shard>
      <Shard index={6} seed={props.seed}>
        <path fill="#999" stroke="#222" d="M20 20 L12 12 L14 11 L22 19z" />
        <rect fill="#888" x="11" y="10" width="4" height="3" rx="0.5" transform="rotate(-45 13 11.5)" />
      </Shard>
      <Shard index={7} seed={props.seed}>
        <path fill="#999" stroke="#222" d="M25 20 L17 12 L19 11 L27 19z" />
        <rect fill="#888" x="16" y="10" width="4" height="3" rx="0.5" transform="rotate(-45 18 11.5)" />
      </Shard>
      <Shard index={8} seed={props.seed}>
        <rect fill="#333" x="20" y="32" width="5" height="3" rx="1" />
      </Shard>
    </g>
  </svg>
);
