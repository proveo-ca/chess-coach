// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import { Show } from "solid-js";
import type { JSX } from "solid-js";

import styles from "./Label.module.css";

export type LabelVariant = "muted" | "caption" | "section" | "title";
export type LabelColor = "win" | "loss" | "draw" | string;

export interface LabelProps {
  variant?: LabelVariant;
  color?: LabelColor;
  class?: string;
  "data-testid"?: string;
  children: JSX.Element;
}

export function Label(props: LabelProps) {
  const variant = () => props.variant ?? "muted";
  const color = () => props.color;
  const cls = () => clsx(styles.label, styles[variant()], color() && styles[color()!], props.class);
  const testId = () => props["data-testid"];

  return (
    <Show
      when={variant() === "section"}
      fallback={
        <span class={cls()} data-testid={testId()}>
          {props.children}
        </span>
      }
    >
      <p class={cls()} data-testid={testId()}>
        {props.children}
      </p>
    </Show>
  );
}
