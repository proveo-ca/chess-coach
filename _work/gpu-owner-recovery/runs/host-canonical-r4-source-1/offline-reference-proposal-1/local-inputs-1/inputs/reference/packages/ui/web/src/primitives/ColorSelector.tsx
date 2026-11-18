// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import type { Component } from "solid-js";
import { Show } from "solid-js";

import { Button } from "./Button";
import styles from "./ColorSelector.module.css";
import { DiceIcon } from "./icons";
import type { PlayerColorPref } from "../types/visual";

export interface ColorSelectorProps {
  value: PlayerColorPref;
  onChange: (val: PlayerColorPref) => void;
  hideRandom?: boolean;
}

export const ColorSelector: Component<ColorSelectorProps> = (props) => {
  return (
    <div class={styles["color-selector"]}>
      <Button
        class={clsx(props.value === "w" && styles.active)}
        onClick={() => props.onChange("w")}
      >
        White
      </Button>
      <Show when={!props.hideRandom}>
        <Button
          class={clsx(props.value === "random" && styles.active)}
          onClick={() => props.onChange("random")}
          aria-label="Random"
        >
          <DiceIcon />
        </Button>
      </Show>
      <Button
        class={clsx(props.value === "b" && styles.active)}
        onClick={() => props.onChange("b")}
      >
        Black
      </Button>
    </div>
  );
};
