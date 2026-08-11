import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import styles from "~/components/primitives/Select.module.css";

export type SelectProps = JSX.SelectHTMLAttributes<HTMLSelectElement> & {
  /** Visual skin — neon = Brood War menu chrome (New Game opponent). */
  variant?: "default" | "neon";
};

export function Select(props: SelectProps) {
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
