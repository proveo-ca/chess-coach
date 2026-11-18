// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import type { Component, JSX } from "solid-js";

import styles from "./PanelTitle.module.css";

export type PanelTitleProps = {
  children: JSX.Element;
  class?: string;
  "data-testid"?: string;
};

export const PanelTitle: Component<PanelTitleProps> = (props) => (
  <span class={clsx(styles.title, props.class)} data-testid={props["data-testid"] ?? "panel-title"}>
    {props.children}
  </span>
);
