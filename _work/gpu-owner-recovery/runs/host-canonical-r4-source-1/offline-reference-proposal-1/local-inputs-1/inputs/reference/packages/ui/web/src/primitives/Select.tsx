// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import chessStyles from "./Select.chess.module.css";
import starchessStyles from "./Select.starchess.module.css";
import { useUiStyles } from "../UiProvider";

export type SelectProps = JSX.SelectHTMLAttributes<HTMLSelectElement> & {
  variant?: "default" | "neon";
};

export function Select(props: SelectProps) {
  const styles = useUiStyles(chessStyles, starchessStyles);
  const [local, others] = splitProps(props, ["class", "variant"]);
  return (
    <select
      class={clsx(
        styles["common-select"],
        local.variant === "neon" && styles["common-select--neon"],
        local.class,
      )}
      {...others}
    />
  );
}
