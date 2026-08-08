/**
 * Shared board-side rail shell for live, review, and tutorial hosts.
 * // SPEC: _spec/apps/starchess/screens.puml
 */
import { Show, type Component, type JSX } from "solid-js";

import { SideRailTools } from "~/components/features/SideRailTools";
import styles from "~/presentation/hud/BoardSideRail.module.css";

export type BoardSideRailProps = {
  /** Mode-specific turn controls rendered above the shared tools. */
  controls?: JSX.Element;
  /** Reactive visibility for controls and their divider. */
  controlsVisible?: boolean;
  /** Prefer SPA navigation when leaving the current screen. */
  onHome?: () => void;
};

export const BoardSideRail: Component<BoardSideRailProps> = (props) => (
  <aside class={styles.rail} data-testid="starchess-side-rail">
    <Show when={props.controlsVisible ?? props.controls != null}>
      {props.controls}
      <hr class={styles.divider} />
    </Show>
    <SideRailTools onHome={props.onHome} />
  </aside>
);
