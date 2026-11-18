// SPEC: _spec/_plans/chess-ui-primitives.puml, _spec/apps/starchess/navigation-chrome.md
import type { Component, JSX } from "solid-js";

import styles from "./StarChessMobileSubBanner.module.css";

export type StarChessMobileSubBannerProps = {
  float?: boolean;
  children?: JSX.Element;
  class?: string;
  "data-testid"?: string;
};

export const StarChessMobileSubBanner: Component<StarChessMobileSubBannerProps> = (props) => (
  <div
    class={`mobile-sub-banner ${styles.subBanner} ${props.class ?? ""}`.trim()}
    data-sub-banner={props.float ? "float" : "inline"}
    data-testid={props["data-testid"] ?? "mobile-sub-banner"}
  >
    {props.children}
  </div>
);
