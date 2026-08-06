import type { Component } from "solid-js";

import styles from "~/presentation/hud/SpecialPreview.module.css";
import type { SpecialCopy } from "~/presentation/hud/specialCopy";

type SpecialPreviewProps = {
  copy: SpecialCopy;
  class?: string;
};

/**
 * Chat-style special explainer — unit title, special name, short description.
 * Pure presentational; used while dragging gas over a unit.
 */
export const SpecialPreview: Component<SpecialPreviewProps> = (props) => (
  <aside
    class={`${styles.card}${props.class ? ` ${props.class}` : ""}`}
    data-testid="special-preview"
    aria-live="polite"
  >
    <h1 class={styles.unit}>{props.copy.unit}</h1>
    <h3 class={styles.name}>{props.copy.name}</h3>
    <p class={styles.description}>{props.copy.description}</p>
  </aside>
);
