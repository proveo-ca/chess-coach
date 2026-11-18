// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import type { Component } from "solid-js";

import styles from "./VisionSwatch.module.css";
import type { ReviewVisionFilter } from "../types/visual";

export type VisionSwatchProps = {
  value: ReviewVisionFilter;
  /** Button title under the swatch (e.g. You / Adjutant / Both). */
  label: string;
  /** Swatch paint — white for Both; team blue/red for You / Adjutant. */
  swatch: "both" | "w" | "b";
  /** Accessible name (defaults to label). */
  ariaLabel?: string;
  selected?: boolean;
  onSelect?: () => void;
  class?: string;
};

export const VisionSwatch: Component<VisionSwatchProps> = (props) => (
  <button
    type="button"
    class={clsx(
      styles.tile,
      styles[`tile--${props.swatch}`],
      props.selected && styles.selected,
      props.class,
    )}
    aria-pressed={props.selected ?? false}
    aria-label={props.ariaLabel ?? props.label}
    data-testid={`vision-swatch-${props.value}`}
    onClick={() => props.onSelect?.()}
  >
    <span class={styles.swatch} aria-hidden="true" />
    <span class={styles.title}>{props.label}</span>
  </button>
);
