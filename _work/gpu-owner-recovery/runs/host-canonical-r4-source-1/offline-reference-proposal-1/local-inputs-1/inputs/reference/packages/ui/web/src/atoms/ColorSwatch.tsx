// SPEC: _spec/_plans/chess-ui-primitives.puml, _spec/apps/ui/components.puml
import clsx from "clsx";
import type { Component } from "solid-js";
import type { SideColor as Color } from "../types/visual";

import chessStyles from "./ColorSwatch.module.css";
import starStyles from "./ColorSwatch.starchess.module.css";
import { useUi } from "../UiProvider";

export const ColorSwatch: Component<{
  color: Color;
  /** `md` for LAN SelectCard seats; default compact for filter tiles. */
  size?: "sm" | "md";
  class?: string;
}> = (props) => {
  const ui = useUi();
  const styles = () => (ui.product === "starchess" ? starStyles : chessStyles);
  return (
    <span
      class={clsx(
        styles().swatch,
        props.size === "md" && styles()["swatch--md"],
        styles()[`swatch--${props.color}`],
        props.class,
      )}
      aria-hidden="true"
    />
  );
};
