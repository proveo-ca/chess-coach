import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import styles from "~/components/primitives/Select.module.css";

export type SelectProps = JSX.SelectHTMLAttributes<HTMLSelectElement>;

export function Select(props: SelectProps) {
  const [local, others] = splitProps(props, ["class"]);
  return <select class={clsx(styles["common-select"], local.class)} {...others} />;
}
