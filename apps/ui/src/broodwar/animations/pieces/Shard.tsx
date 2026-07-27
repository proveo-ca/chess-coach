import type { Component, JSX } from "solid-js";

import { shardFlightStyle } from "~/broodwar/animations/deathAnim";

type ShardProps = {
  index: number;
  seed: number;
  /** Scale flight distance (pawn uses ~0.55 so the pop stays local). */
  distScale?: number;
  children: JSX.Element;
};

/** One disassembled body part; CSS reads --dx/--dy/--spin. */
export const Shard: Component<ShardProps> = (props) => {
  const style = () => {
    const flight = shardFlightStyle(props.index, props.seed, props.distScale ?? 1);
    // String style so SVG `<g>` always gets custom props (object form is flaky).
    return `--dx:${flight["--dx"]};--dy:${flight["--dy"]};--spin:${flight["--spin"]}`;
  };

  return (
    <g data-shard style={style()}>
      {props.children}
    </g>
  );
};
