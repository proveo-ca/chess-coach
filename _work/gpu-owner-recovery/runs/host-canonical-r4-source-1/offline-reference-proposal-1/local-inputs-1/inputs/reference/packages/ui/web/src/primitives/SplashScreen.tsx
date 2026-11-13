// SPEC: _spec/_plans/chess-ui-primitives.puml, _spec/apps/ui/components.puml
import { type Component, type JSX, Show } from "solid-js";

import styles from "./SplashScreen.module.css";

export interface SplashScreenProps {
  /** Optional heading shown above the content. */
  title?: string;
  /** Optional avatar/illustration rendered in the centered avatar slot. */
  avatar?: JSX.Element;
  /** Widen the content column (e.g. LanScreen's lobby, which holds a checklist). */
  wide?: boolean;
  /** Render as a fixed, full-viewport backdrop (used by LoadingOverlay). */
  fullscreen?: boolean;
  /** Inline styles applied to the fullscreen backdrop (e.g. opacity transition). */
  style?: JSX.CSSProperties;
  children?: JSX.Element;
}

export const SplashScreen: Component<SplashScreenProps> = (props) => {
  const content = (
    <div
      classList={{
        [styles["splash-content"]]: true,
        [styles["splash-content--wide"]]: !!props.wide,
      }}
    >
      <Show when={props.avatar}>
        <div class={styles["splash-avatar-wrapper"]}>{props.avatar}</div>
      </Show>
      <Show when={props.title}>
        <h2 class={styles["splash-title"]}>{props.title}</h2>
      </Show>
      {props.children}
    </div>
  );

  return (
    <Show when={props.fullscreen} fallback={content}>
      <div class={styles["splash-screen"]} style={props.style}>
        {content}
      </div>
    </Show>
  );
};
