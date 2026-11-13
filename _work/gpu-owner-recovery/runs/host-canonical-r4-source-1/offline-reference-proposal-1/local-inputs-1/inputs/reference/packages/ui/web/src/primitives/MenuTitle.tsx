// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import { Show, type Component, type JSX } from "solid-js";

import styles from "./MenuTitle.module.css";

export type MenuTitleProps = {
  children: JSX.Element;
  hint?: string;
  disabled?: boolean;
  class?: string;
  "data-testid"?: string;
};

export const MenuTitle: Component<MenuTitleProps> = (props) => (
  <span
    class={clsx(styles.root, props.disabled && styles.disabled, props.class)}
    data-testid={props["data-testid"]}
  >
    <span class={styles.label}>{props.children}</span>
    <Show when={!!props.hint}>
      <span class={styles.hint}>{props.hint}</span>
    </Show>
  </span>
);
