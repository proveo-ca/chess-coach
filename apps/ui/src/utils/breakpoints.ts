// SPEC: _spec/apps/ui/responsiveness/rules.md
/**
 * Shared viewport media queries — keep in sync with `theme.css` `@custom-media`
 * (`--desktop` = min-width 720px). Prefer the 720 desktop token; mobile is the
 * exclusive complement (`max-width: 719px`).
 */

/** Desktop / landscape-wide chrome (`theme.css` `--desktop`). */
export const DESKTOP_MQ = "(min-width: 720px)";

/** Phone / narrow — exclusive complement of {@link DESKTOP_MQ}. */
export const MOBILE_MQ = "(max-width: 719px)";

/** Tall phone — hero avatar / title toolbars (e.g. 390×844). */
export const TALL_MOBILE_MQ = "(max-width: 719px) and (min-height: 640px)";

/** Short / dynamic — compact chrome (e.g. 390×560). */
export const SHORT_MOBILE_MQ = "(max-width: 719px) and (max-height: 639px)";
