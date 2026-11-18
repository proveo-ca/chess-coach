// SPEC: _spec/_plans/chess-ui-primitives.puml, _spec/apps/ui/components.puml
import clsx from "clsx";
import { For, type JSX } from "solid-js";

import { Button } from "./Button";
import { Select } from "./Select";
import styles from "./SplitButton.module.css";

export interface SplitButtonOption<T extends string> {
  value: T;
  label: string;
}

export interface SplitButtonProps<T extends string> {
  /** Action label. */
  children: JSX.Element;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  value: T;
  onChange: (value: T) => void;
  options: readonly SplitButtonOption<T>[];
  /** Accessible name for the select — its options carry no context alone. */
  selectLabel: string;
  class?: string;
}

export function SplitButton<T extends string>(props: SplitButtonProps<T>) {
  return (
    <div class={clsx(styles.split, props.class)} data-testid="split-button">
      <Button
        class={styles.action}
        primary={props.primary}
        disabled={props.disabled}
        onClick={() => props.onClick?.()}
      >
        {props.children}
      </Button>
      <Select
        class={styles.select}
        aria-label={props.selectLabel}
        disabled={props.disabled}
        value={props.value}
        onChange={(e) => props.onChange(e.currentTarget.value as T)}
      >
        <For each={props.options}>
          {(option) => <option value={option.value}>{option.label}</option>}
        </For>
      </Select>
    </div>
  );
}
