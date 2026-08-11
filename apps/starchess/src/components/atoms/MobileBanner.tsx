/**
 * Dynamic live strip — three-slot grid (gas lives bottom-right, not here):
 *   Back (4rem) · resources (10rem) · turn (minmax 0 1fr → queue + End + timer)
 * // SPEC: _spec/apps/starchess/screens.puml
 * // SPEC: _spec/apps/ui/responsiveness/rules.md
 */
import type { Component, JSX } from "solid-js";

import styles from "~/components/atoms/MobileBanner.module.css";
import { ChevronNav } from "~/components/primitives/ChevronNav";

export type MobileBannerProps = {
  /** Leave the match (caller may confirm first). */
  onBack: () => void;
  /** Resource economy strip (fills). */
  resources?: JSX.Element;
  /** Turn timer + End Turn (fills). */
  turn?: JSX.Element;
  class?: string;
  "data-testid"?: string;
};

/**
 * Dynamic-only chrome row. Hidden on desktop / tall mobile where
 * ScreenBackNav + BoardSideRail own the layout. GasDeploy is positioned
 * separately (bottom-right) on dynamic — not a banner slot.
 */
export const MobileBanner: Component<MobileBannerProps> = (props) => (
  <header
    class={`mobile-banner ${styles.banner} ${props.class ?? ""}`.trim()}
    data-testid={props["data-testid"] ?? "mobile-banner"}
  >
    <div class={styles.back} data-slot="back">
      <ChevronNav
        direction="back"
        onClick={() => props.onBack()}
        aria-label="Back"
        data-testid="mobile-banner-back"
      >
        Back
      </ChevronNav>
    </div>
    <div class={styles.resources} data-slot="resources">
      {props.resources}
    </div>
    <div class={styles.turn} data-slot="turn">
      {props.turn}
    </div>
  </header>
);
