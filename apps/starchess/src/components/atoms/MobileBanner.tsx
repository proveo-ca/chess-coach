/**
 * Dynamic strip — three-slot grid (floating docks live bottom-right, not here):
 *   Back (4rem) · resources (minmax 0 1fr) · turn (auto)
 *   with `fixedResources`: Back (4rem) · resources (auto) · turn (minmax 0 1fr)
 * Live: fixed-width ResourceBar + compact TurnBar. Review detail: dual
 * ResourceBars (the ‹ › arrows dock instead). Review list: compact
 * MatchHistoryFilters.
 * // SPEC: _spec/apps/starchess/screens.puml
 * // SPEC: _spec/apps/ui/responsiveness/rules.md
 */
import { Show, type Component, type JSX } from "solid-js";

import styles from "~/components/atoms/MobileBanner.module.css";
import { ChevronNav } from "~/components/primitives/ChevronNav";

export type MobileBannerProps = {
  /** Leave the match (caller may confirm first). */
  onBack?: () => void;
  /** Prefer link navigation (review list → menu) — mirrors ScreenBackNav. */
  href?: string;
  /** Resource economy strip, or review-list filters (fills). */
  resources?: JSX.Element;
  /** Turn timer + End Turn (fills). */
  turn?: JSX.Element;
  /**
   * Live: the resource strip keeps its own width and the turn column takes the
   * slack. Off (default) the resources column fills — review needs that for
   * two ResourceBars / the filters + date pager.
   */
  fixedResources?: boolean;
  class?: string;
  "data-testid"?: string;
};

/**
 * Dynamic-only chrome row. Hidden on desktop / tall mobile where
 * ScreenBackNav + BoardSideRail own the layout. Floating docks (GasDeploy,
 * review turn arrows) pin bottom-right on dynamic — not banner slots.
 */
export const MobileBanner: Component<MobileBannerProps> = (props) => (
  <header
    class={`mobile-banner ${styles.banner} ${props.class ?? ""}`.trim()}
    data-testid={props["data-testid"] ?? "mobile-banner"}
    data-resources={props.fixedResources ? "fixed" : undefined}
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
