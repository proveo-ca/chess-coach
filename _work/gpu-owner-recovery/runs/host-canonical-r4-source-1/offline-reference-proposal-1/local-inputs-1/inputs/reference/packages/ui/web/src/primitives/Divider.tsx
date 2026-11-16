// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";

import styles from "./Divider.module.css";

export function Divider(props: { class?: string }) {
  return <div class={clsx(styles.divider, props.class)} />;
}
