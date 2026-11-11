// SPEC: _spec/_plans/chess-ui-primitives.puml, _spec/apps/starchess/navigation-chrome.md
/** Presentational chip — turn / phase labels, queue badges, compact tags. */
import { Show, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

import styles from "./Chip.module.css";
import type { ChipSize, ChipTone } from "../types/ui";

export type ChipProps = {
  children: JSX.Element;
  class?: string;
  tone?: ChipTone;
  size?: ChipSize;
  onRemove?: (e: MouseEvent) => void;
  removeLabel?: string;
  removeTestId?: string;
  "data-testid"?: string;
  "data-timing"?: string;
  "data-seq"?: number | string;
};

export const Chip = (props: ChipProps) => (
  <Dynamic
    component={props.onRemove ? "button" : "span"}
    type={props.onRemove ? "button" : undefined}
    class={props.class ? `${styles.chip} ${props.class}` : styles.chip}
    data-tone={props.tone}
    data-size={props.size}
    data-removable={props.onRemove ? "" : undefined}
    data-testid={(props.onRemove && props.removeTestId) || props["data-testid"]}
    data-timing={props["data-timing"]}
    data-seq={props["data-seq"]}
    aria-label={props.onRemove ? (props.removeLabel ?? "Remove") : undefined}
    onClick={props.onRemove}
  >
    <span class={styles.text}>{props.children}</span>
    <Show when={props.onRemove}>
      <span class={styles.remove} aria-hidden="true">
        ×
      </span>
    </Show>
  </Dynamic>
);
