/**
 * Shared top panel: `‹ Back` | center | optional trailing.
 * Same row as ResourceBars / Review title — mirrors tutorial
 * Previous Lesson · Kerrigan · Next Lesson chrome.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 * // SPEC: _spec/apps/starchess/screens.puml
 */
import { Show, type Component, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";

import { ChevronNav } from "~/components/primitives/ChevronNav";
import styles from "~/components/primitives/ScreenBackNav.module.css";

export type ScreenBackNavProps = {
  /** Override default navigate to `/` (StarChess menu). */
  onBack?: () => void;
  /** Prefer link navigation (review list → menu). */
  href?: string;
  children?: JSX.Element;
  trailing?: JSX.Element;
  class?: string;
  "data-testid"?: string;
};

export const ScreenBackNav: Component<ScreenBackNavProps> = (props) => {
  const navigate = useNavigate();
  const goBack = () => {
    if (props.onBack) {
      props.onBack();
      return;
    }
    navigate(props.href ?? "/");
  };

  return (
    <div
      class={`${styles.panel} ${props.class ?? ""}`.trim()}
      data-testid="screen-top-nav"
    >
      <div class={styles.side}>
        <Show
          when={props.href != null && props.onBack == null}
          fallback={
            <ChevronNav
              direction="back"
              onClick={goBack}
              aria-label="Back"
              data-testid={props["data-testid"] ?? "screen-back"}
            >
              Back
            </ChevronNav>
          }
        >
          <ChevronNav
            direction="back"
            href={props.href}
            aria-label="Back"
            data-testid={props["data-testid"] ?? "screen-back"}
          >
            Back
          </ChevronNav>
        </Show>
      </div>
      <div class={styles.center}>
        <Show when={props.children}>{props.children}</Show>
      </div>
      <div class={`${styles.side} ${styles.trailing}`}>
        <Show when={props.trailing}>{props.trailing}</Show>
      </div>
    </div>
  );
};
