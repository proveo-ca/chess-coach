// SPEC: _spec/_plans/chess-ui-primitives.puml, _spec/apps/starchess/navigation-chrome.md
import { Show, type Component, type JSX } from "solid-js";

import styles from "./StarChessMobileBanner.module.css";
import { ChevronNav } from "../primitives/ChevronNav";

export type StarChessMobileBannerProps = {
  onBack?: () => void;

  href?: string;

  resources?: JSX.Element;

  turn?: JSX.Element;

  fixedResources?: boolean;
  band?: "dynamic" | "mobile";
  class?: string;
  "data-testid"?: string;
};

export const StarChessMobileBanner: Component<StarChessMobileBannerProps> = (props) => (
  <header
    class={`mobile-banner ${styles.banner} ${props.class ?? ""}`.trim()}
    data-testid={props["data-testid"] ?? "mobile-banner"}
    data-resources={props.fixedResources ? "fixed" : undefined}
    data-band={props.band ?? "dynamic"}
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
    <div class={styles.resources} data-slot="resources">
      {props.resources}
    </div>
    <div class={styles.turn} data-slot="turn">
      {props.turn}
    </div>
  </header>
);
