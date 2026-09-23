// SPEC: _spec/apps/chess/responsiveness/rules.md, _spec/apps/starchess/screens.puml
/**
 * Shared viewport media queries — mirrors `apps/chess/src/utils/breakpoints.ts`
 * and the `@media` bands in `theme.css` / the Screen stylesheets. One string
 * per band so JS gates (portaled docks, banner chrome) cannot drift from CSS.
 */

/** Phone / narrow — exclusive complement of desktop (`min-width: 720px`). */
export const MOBILE_MQ = "(max-width: 719px)";

/**
 * Dynamic band — mobile, short, and ≥480px wide (Storybook Dynamic 560×420).
 * `MobileBanner` owns the top chrome here; floating docks (gas rack, review
 * turn nav) pin bottom-right.
 */
export const DYNAMIC_MOBILE_MQ =
  "(max-width: 719px) and (min-width: 480px) and (max-height: 639px)";
