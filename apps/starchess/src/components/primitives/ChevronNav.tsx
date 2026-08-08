/**
 * Text chevron nav — `‹ Back` (leading) or `Share ›` (trailing).
 * Shared leave / forward chrome (tutorial · review · live top panel).
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import { A } from "@solidjs/router";
import clsx from "clsx";
import type { Component, JSX } from "solid-js";

import styles from "~/components/primitives/ChevronNav.module.css";

export type ChevronNavProps = {
  direction: "back" | "forward";
  children: JSX.Element;
  href?: string;
  onClick?: () => void;
  class?: string;
  "aria-label"?: string;
  "data-testid"?: string;
};

export const ChevronNav: Component<ChevronNavProps> = (props) => {
  const cls = () =>
    clsx(
      styles.nav,
      props.direction === "back" ? styles.back : styles.forward,
      props.class,
    );
  const body = () =>
    props.direction === "back" ? (
      <>
        <span class={styles.chevron} aria-hidden="true">
          ‹
        </span>
        <span class={styles.label}>{props.children}</span>
      </>
    ) : (
      <>
        <span class={styles.label}>{props.children}</span>
        <span class={styles.chevron} aria-hidden="true">
          ›
        </span>
      </>
    );

  if (props.href != null) {
    return (
      <A
        class={cls()}
        href={props.href}
        aria-label={props["aria-label"]}
        data-testid={props["data-testid"]}
        onClick={props.onClick}
      >
        {body()}
      </A>
    );
  }

  return (
    <button
      type="button"
      class={cls()}
      aria-label={props["aria-label"]}
      data-testid={props["data-testid"]}
      onClick={props.onClick}
    >
      {body()}
    </button>
  );
};
