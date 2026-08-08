/**
 * Shared top panel: `‹ Back` | center | optional trailing (`Share ›`).
 * Same row as Coach avatar / titles / filters — mirrors StarChess tutorial
 * `< Previous Lesson` · Kerrigan · `Next Lesson >` chrome.
 * // SPEC: _spec/apps/ui/components.puml
 */
import { Show, type Component, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";

import { ChevronNav } from "~/components/primitives/ChevronNav";
import styles from "~/components/primitives/ScreenBackNav.module.css";
import { screenBackTarget } from "~/utils/navHistory";

export type ScreenBackNavProps = {
  /** Override default in-app back / main-menu fallback. */
  onBack?: () => void;
  /** Center slot — Coach avatar, titles, filters, matchup, etc. */
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
    const target = screenBackTarget();
    if (typeof target === "number") navigate(target);
    else navigate(target);
  };

  return (
    <div
      class={`${styles.panel} ${props.class ?? ""}`.trim()}
      data-testid="screen-top-nav"
    >
      <div class={styles.side}>
        <ChevronNav
          direction="back"
          onClick={goBack}
          aria-label="Back"
          data-testid={props["data-testid"] ?? "screen-back"}
        >
          Back
        </ChevronNav>
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
