/**
 * Center-slot title for {@link ScreenBackNav} — tracked uppercase panel label.
 * Pair with {@link ChevronNav} (`‹ Back` · title · trailing).
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import clsx from "clsx";
import type { Component, JSX } from "solid-js";

import styles from "~/components/primitives/PanelTitle.module.css";

export type PanelTitleProps = {
  children: JSX.Element;
  class?: string;
  "data-testid"?: string;
};

export const PanelTitle: Component<PanelTitleProps> = (props) => (
  <span
    class={clsx(styles.title, props.class)}
    data-testid={props["data-testid"] ?? "panel-title"}
  >
    {props.children}
  </span>
);
