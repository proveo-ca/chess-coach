// SPEC: _spec/_plans/chess-ui-primitives.puml
import { Show } from "solid-js";
import type { Component, JSX } from "solid-js";

import styles from "./SelectCard.module.css";
import { Button } from "../primitives/Button";

export interface SelectCardProps {
  /** Small uppercase header, e.g. "White" / "Play". */
  label: string;
  /** Highlight as the chosen / owned card. */
  selected?: boolean;

  onClick?: () => void;
  testId?: string;
  children: JSX.Element;
}

export const SelectCard: Component<SelectCardProps> = (props) => {
  const body = () => (
    <>
      <span class={styles.label}>{props.label}</span>
      {props.children}
    </>
  );
  return (
    <Show
      when={props.onClick}
      fallback={
        <div
          class={styles.card}
          classList={{ [styles.selected]: !!props.selected }}
          data-testid={props.testId}
        >
          {body()}
        </div>
      }
    >
      <Button
        type="button"
        class={styles.card}
        classList={{ [styles.selected]: !!props.selected }}
        aria-pressed={props.selected}
        onClick={() => props.onClick?.()}
        data-testid={props.testId}
      >
        {body()}
      </Button>
    </Show>
  );
};
