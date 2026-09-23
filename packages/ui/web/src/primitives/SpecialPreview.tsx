// SPEC: _spec/_plans/chess-ui-primitives.puml
import type { Component } from "solid-js";

import styles from "./SpecialPreview.module.css";

export type SpecialPreviewProps = {
  unit: string;
  name: string;
  description: string;
  class?: string;
};

export const SpecialPreview: Component<SpecialPreviewProps> = (props) => (
  <aside
    class={`${styles.card}${props.class ? ` ${props.class}` : ""}`}
    data-testid="special-preview"
    aria-live="polite"
  >
    <h1 class={styles.unit}>{props.unit}</h1>
    <h3 class={styles.name}>{props.name}</h3>
    <p class={styles.description}>{props.description}</p>
  </aside>
);
