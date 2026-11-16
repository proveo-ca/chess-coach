// SPEC: _spec/_plans/chess-ui-primitives.puml, _spec/apps/starchess/navigation-chrome.md
import { Show, type Component, type JSX } from "solid-js";

import styles from "./StarChessMobileBanner.module.css";
import { ChevronNav } from "../primitives/ChevronNav";
import { Label, type LabelColor } from "../primitives/Label";

export type StarChessMobileBannerProps = {
  onBack?: () => void;
  href?: string;
  title?: string;
  titleColor?: LabelColor;
  center?: JSX.Element;
  fill?: boolean;
  class?: string;
  "data-testid"?: string;
};

export const StarChessMobileBanner: Component<StarChessMobileBannerProps> = (props) => (
  <header
    class={`mobile-banner ${styles.banner} ${props.class ?? ""}`.trim()}
    data-testid={props["data-testid"] ?? "mobile-banner"}
    data-fill={props.fill ? "true" : undefined}
  >
    <div class={styles.back} data-slot="back">
      <Show
        when={props.href != null && props.onBack == null}
        fallback={
          <ChevronNav
            direction="back"
            onClick={() => props.onBack?.()}
            aria-label="Back"
            data-testid="mobile-banner-back"
          >
            Back
          </ChevronNav>
        }
      >
        <ChevronNav
          direction="back"
          href={props.href}
          aria-label="Back"
          data-testid="mobile-banner-back"
        >
          Back
        </ChevronNav>
      </Show>
    </div>
    <div class={styles.title} data-slot="title">
      <Show when={!props.center} fallback={props.center}>
      <Show when={props.title}>
        {(title) => (
          <Label
            variant="title"
            color={props.titleColor}
            class={styles.titleText}
            data-testid="mobile-banner-title"
          >
            {title()}
          </Label>
        )}
      </Show>
      </Show>
    </div>
    <div class={styles.end} aria-hidden="true" />
  </header>
);
