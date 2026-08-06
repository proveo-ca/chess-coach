/**
 * Chat-style special explainer — unit title, special name, short description.
 * Pure presentational; used while dragging gas over a unit.
 */
import type { Component } from "solid-js";

import styles from "~/components/primitives/SpecialPreview.module.css";

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
