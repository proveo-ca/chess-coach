// SPEC: _spec/apps/ui/components.puml
import clsx from "clsx";
import type { Component } from "solid-js";
import type { Color } from "chess.js";

import styles from "~/components/atoms/ColorSwatch.module.css";

/**
 * Tiny White/Black square used by LAN seat cards and Review “Playing as” tiles.
 */
export const ColorSwatch: Component<{
  color: Color;
  /** `md` for LAN SelectCard seats; default compact for filter tiles. */
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
