// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import type { Component } from "solid-js";

import styles from "./MapSwatch.module.css";
import type { BoardVariant } from "../types/visual";

export type MapSwatchProps = {
  variant: BoardVariant;
  label: string;
  selected?: boolean;
  onSelect?: () => void;
  class?: string;
};

const LABELS: Record<BoardVariant, string> = {
  eclipse: "Eclipse",
  butter: "Butter",
  vermeer: "Vermeer",
};

export const mapLabel = (variant: BoardVariant) => LABELS[variant];

export const MapSwatch: Component<MapSwatchProps> = (props) => (
  <button
    type="button"
    class={clsx(
      styles.tile,
      styles[`tile--${props.variant}`],
      props.selected && styles.selected,
      props.class,
    )}
    aria-pressed={props.selected ?? false}
    aria-label={props.label}
    data-testid={`map-swatch-${props.variant}`}
    onClick={() => props.onSelect?.()}
  >
    <span class={styles.grid} aria-hidden="true">
      <span class={styles.cell} data-tone="light" />
      <span class={styles.cell} data-tone="dark" />
      <span class={styles.cell} data-tone="dark" />
      <span class={styles.cell} data-tone="light" />
    </span>
    <span class={styles.title}>{props.label}</span>
  </button>
);
