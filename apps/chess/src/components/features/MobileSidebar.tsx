// SPEC: _spec/apps/chess/components.puml
import clsx from "clsx";
import type { Component, JSX } from "solid-js";

import styles from "~/components/features/MobileSidebar.module.css";

/** Centred (or toolbar-leading) label slot content. */
const Main: Component<{ children?: JSX.Element }> = (props) => (
  <span class={styles.main}>{props.children}</span>
);

const MatchupLabel: Component<{
  children: JSX.Element;
  class?: string;
  "data-testid"?: string;
}> = (props) => (
  <span
    class={clsx(styles["main-label"], props.class)}
    data-testid={props["data-testid"]}
  >
    {props.children}
  </span>
);

const NavActions: Component<{ children: JSX.Element }> = (props) => (
  <div class={styles["nav-actions"]}>{props.children}</div>
);

/**
 * A control. Up to four render; CSS fans them out around the centre. Mark the
 * single nav control with `nav` so it survives `timeline` mode (and pass a
 * `ref` to drive the dock → top-right FLIP animation from the parent). Mark
 * the menu trigger with `drawer` to pin it rightmost (top-right when tall
 * mobile or timeline; stays in-bar on the right on short / dynamic).
 */
const Item: Component<{
  children: JSX.Element;
  nav?: boolean;
  drawer?: boolean;
  ref?: (el: HTMLDivElement) => void;
}> = (props) => (
  <div
    class={clsx(
      styles.item,
      props.nav && styles["nav-item"],
      props.drawer && styles["drawer-item"],
    )}
    ref={props.ref}
  >
    {props.children}
  </div>
);

const Root: Component<{
  children: JSX.Element;
  timeline?: boolean;
  /** Let an oversized centre slot (the Coach avatar) overflow a slimmed bar. */
  centerOverflow?: boolean;
  /**
   * Review matchup chrome: label fills the left; nav actions sit on the right
   * (`Win (White) vs Selena` · [back][share]) instead of avatar-style centering.
   */
  toolbar?: boolean;
  /**
   * Analysis title toolbar: on short / dynamic, CSS collapses to a floated
   * drawer only (hides the “Solo Analysis” label).
   */
  collapseOnShort?: boolean;
  /**
   * Dynamic-only tool strip (Analysis / Review detail) — hidden outside
   * `--dynamic-mobile` (tall mobile keeps footer BoardControls instead).
   */
  dynamicOnly?: boolean;
}> = (props) => (
  <div
    classList={{
      [styles.bar]: true,
      [styles.timeline]: !!props.timeline,
      [styles["center-overflow"]]: !!props.centerOverflow,
      [styles.toolbar]: !!props.toolbar,
      [styles["collapse-on-short"]]: !!props.collapseOnShort,
    }}
    data-testid="mobile-fuse-bar"
    data-dynamic-only={props.dynamicOnly ? "" : undefined}
  >
    {props.children}
  </div>
);

/**
 * Mobile-only horizontal control bar above the board, shared by every board
 * screen. Compose it with one `<MobileSidebar.Main>` (geometrically centred)
 * and up to four `<MobileSidebar.Item>` controls. Positioning is CSS-only:
 * `.main` is absolutely pinned to 50% of the bar so CoachAvatar stays in the
 * exact middle even when three left icons outweigh the history nav on the
 * right. Single-button items stack on the left by source order (1st nearest
 * the centre); any 5th+ item is dropped. The `nav` item (dual history arrows)
 * owns the right via `margin-left: auto`. The `drawer` item pins rightmost on
 * short viewports; on tall mobile (`min-height: 640px`) it floats fixed
 * top-right (same chrome as timeline) so the bar can pack tools without the
 * With `toolbar`, Main stretches after an optional leading `drawer` Item and
 * nav stays right (Review / Analysis matchup) — absolute centering is disabled.
 * Hidden on desktop, where {@link Sidebar} takes over.
 *
 * In `timeline` mode (replay / travel) the bar collapses: `Main` and every
 * non-`nav` / non-`drawer` item are hidden; the `nav` item floats top-right
 * (inset for the menu) and the `drawer` item floats outermost top-right. See
 * {@link BoardControls} for the FLIP animation on the nav dock.
 */
export const MobileSidebar = Object.assign(Root, { Main, Item, MatchupLabel, NavActions });
