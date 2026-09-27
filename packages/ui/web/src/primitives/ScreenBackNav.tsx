// SPEC: _spec/_plans/chess-ui-primitives.puml
import { Show, type Component, type JSX } from "solid-js";
import { useUiStyles } from "../UiProvider";

import { ChevronNav } from "./ChevronNav";
import chessStyles from "./ScreenBackNav.chess.module.css";
import starchessStyles from "./ScreenBackNav.starchess.module.css";

export type ScreenBackNavProps = {
  /** Back action supplied by the host. */
  onBack?: () => void;
  /** Prefer link navigation (review list → menu). */
  href?: string;
  children?: JSX.Element;
  trailing?: JSX.Element;
  class?: string;
  "data-testid"?: string;
};

export const ScreenBackNav: Component<ScreenBackNavProps> = (props) => {
  const styles = useUiStyles(chessStyles, starchessStyles);

  return (
    <div class={`${styles.panel} ${props.class ?? ""}`.trim()} data-testid="screen-top-nav">
      <div class={`screen-back ${styles.side}`}>
        <Show
          when={props.href != null && props.onBack == null}
          fallback={
            <ChevronNav
              direction="back"
              onClick={props.onBack}
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
