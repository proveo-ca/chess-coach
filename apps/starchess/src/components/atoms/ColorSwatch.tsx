/**
 * Tiny Blue/Red square for Review “Playing as” filter tiles.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import clsx from "clsx";
import type { Component } from "solid-js";
import type { StarChessColor } from "@chess-coach/starchess-core";

import styles from "~/components/atoms/ColorSwatch.module.css";

export const ColorSwatch: Component<{
  color: StarChessColor;
  /** `md` for larger seats; default compact for filter tiles. */
  size?: "sm" | "md";
  class?: string;
}> = (props) => (
  <span
    class={clsx(
      styles.swatch,
      props.size === "md" && styles["swatch--md"],
      styles[`swatch--${props.color}`],
      props.class,
    )}
    aria-hidden="true"
  />
);
