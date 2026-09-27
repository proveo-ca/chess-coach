// SPEC: _spec/apps/starchess/tutorial/hints-and-coach.md
import { Show, type JSX } from "solid-js";

import styles from "~/presentation/hud/components/CancelHint.module.css";

export const CancelHint = (props: {
  active: boolean;
  direction?: "down" | "right";
  children: JSX.Element;
}) => (
  <span class={styles.wrap} data-cancel-hint={props.active ? "" : undefined}>
    {props.children}
    <Show when={props.active}>
      <svg
        class={styles.chevron}
        data-direction={props.direction ?? "down"}
        viewBox="0 0 12 10"
        aria-hidden="true"
      >
        <path d="M1.5 1.5 6 7.5 10.5 1.5" />
      </svg>
    </Show>
  </span>
);
