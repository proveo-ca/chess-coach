// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import type { Component } from "solid-js";
import type { SideColor as StarChessColor } from "../types/visual";

import styles from "./TeamSwatch.module.css";

export type TeamSwatchProps = {
  color: StarChessColor;
  label: string;
  selected?: boolean;
  onSelect?: () => void;
  class?: string;
};

export const TeamSwatch: Component<TeamSwatchProps> = (props) => (
  <button
    type="button"
    class={clsx(
      styles.tile,
      styles[`tile--${props.color}`],
      props.selected && styles.selected,
      props.class,
    )}
    aria-pressed={props.selected ?? false}
    aria-label={props.label}
    data-testid={`team-swatch-${props.color}`}
    onClick={() => props.onSelect?.()}
  >
    <span class={styles.swatch} aria-hidden="true" />
    <span class={styles.title}>{props.label}</span>
  </button>
);
