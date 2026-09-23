// SPEC: _spec/_plans/chess-ui-primitives.puml
/** Presentational chip — turn / phase labels, queue badges, compact tags. */
import clsx from "clsx";
import { Show, type JSX } from "solid-js";

import styles from "./Chip.module.css";
import type { ChipSize, ChipTone } from "../types/ui";

export type ChipProps = {
  children: JSX.Element;
  class?: string;
  tone?: ChipTone;
  size?: ChipSize;
  /** When set, renders a × control that calls this handler. */
  onRemove?: (e: MouseEvent) => void;
  removeLabel?: string;
  removeTestId?: string;
  "data-testid"?: string;
  "data-timing"?: string;
  "data-seq"?: number | string;
};

export const Chip = (props: ChipProps) => (
  <span
    class={clsx(
      styles.chip,
      props.size === "sm" && styles.sm,
      props.tone === "before" && styles.before,
      props.tone === "classical" && styles.classical,
      props.tone === "after" && styles.after,
      props.tone === "muted" && styles.muted,
      props.tone === "turn" && styles.turn,
      props.tone === "check" && styles.check,
      props.tone === "intent" && styles.intent,
      props.tone === "resolve" && styles.resolve,
      props.class,
    )}
    data-testid={props["data-testid"]}
    data-timing={props["data-timing"]}
    data-seq={props["data-seq"]}
  >
    <span class={styles.text}>{props.children}</span>
    <Show when={props.onRemove !== undefined}>
      <button
        type="button"
        class={styles.remove}
        data-testid={props.removeTestId}
        aria-label={props.removeLabel ?? "Remove"}
        onClick={(e) => props.onRemove?.(e)}
      >
        ×
      </button>
    </Show>
  </span>
);
