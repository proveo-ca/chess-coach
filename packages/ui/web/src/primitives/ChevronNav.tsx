// SPEC: _spec/_plans/chess-ui-primitives.puml, _spec/apps/starchess/menu-flow.puml, _spec/apps/starchess/navigation-chrome.md
import { UiLink } from "../UiProvider";
import clsx from "clsx";
import type { Component, JSX } from "solid-js";

import chessStyles from "./ChevronNav.chess.module.css";
import starchessStyles from "./ChevronNav.starchess.module.css";
import { useUiStyles } from "../UiProvider";

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
  const styles = useUiStyles(chessStyles, starchessStyles);
  const cls = () =>
    clsx(styles.nav, props.direction === "back" ? styles.back : styles.forward, props.class);
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
      <UiLink
        class={cls()}
        href={props.href}
        aria-label={props["aria-label"]}
        data-testid={props["data-testid"]}
        onClick={props.onClick}
      >
        {body()}
      </UiLink>
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
