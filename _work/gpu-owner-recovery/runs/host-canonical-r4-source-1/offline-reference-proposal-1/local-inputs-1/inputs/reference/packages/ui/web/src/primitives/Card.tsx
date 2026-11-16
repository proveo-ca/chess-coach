// SPEC: _spec/_plans/chess-ui-primitives.puml
/** Polymorphic card shell — tinted panel, optionally clickable, optionally muted. */
import type { Component, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import clsx from "clsx";

import styles from "./Card.module.css";

export type CardProps = {
  children: JSX.Element;
  class?: string;
  /** Dimmed presentation — e.g. a not-yet-earned item. */
  muted?: boolean;
  onClick?: () => void;
  "data-testid"?: string;
  "data-short-id"?: string;
  "data-level"?: number | string;
  "data-obtained"?: string;
};

export const Card: Component<CardProps> = (props) => (
  <Dynamic
    component={props.onClick ? "button" : "article"}
    type={props.onClick ? "button" : undefined}
    class={clsx(styles.card, props.muted && styles.muted, props.class)}
    data-testid={props["data-testid"]}
    data-short-id={props["data-short-id"]}
    data-level={props["data-level"]}
    data-obtained={props["data-obtained"]}
    onClick={props.onClick}
  >
    {props.children}
  </Dynamic>
);
