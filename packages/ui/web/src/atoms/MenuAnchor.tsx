// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import { Show, type Component, type JSX } from "solid-js";

import { MenuTitle } from "../primitives/MenuTitle";
import styles from "./MenuAnchor.module.css";

export type MenuAnchorProps = {
  label: string;
  hint?: string;
  disabled?: boolean;
  class?: string;
  /** Stable action id for tests / handlers (`data-action`). */
  action?: string;
  onActivate?: () => void;
  /** Sky prop / FX rendered with the title (debris, signal, moon, black hole…). */
  children?: JSX.Element;
  "data-testid"?: string;
};

export const MenuAnchor: Component<MenuAnchorProps> = (props) => {
  const activate = () => {
    if (props.disabled) return;
    props.onActivate?.();
  };

  const onKeyDown: JSX.EventHandlerUnion<HTMLButtonElement, KeyboardEvent> = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };

  return (
    <button
      type="button"
      class={clsx(styles.root, props.disabled && styles.disabled, props.class)}
      disabled={props.disabled}
      aria-disabled={props.disabled || undefined}
      data-action={props.action}
      data-testid={props["data-testid"]}
      onClick={activate}
      onKeyDown={onKeyDown}
    >
      <Show when={props.children}>
        <div class={styles.visual} aria-hidden="true">
          {props.children}
        </div>
      </Show>
      <MenuTitle disabled={props.disabled} hint={props.hint}>
        {props.label}
      </MenuTitle>
    </button>
  );
};
