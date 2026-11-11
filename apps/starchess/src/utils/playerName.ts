// SPEC: _spec/apps/starchess/screens.puml
/**
 * One rule for player names, enforced at every boundary they cross.
 *
 * Names are chrome, not content: they sit inside a fixed-width ResourceBar and
 * a match title that must not reflow. Clamping at the *setter* and at the
 * *record* keeps long names from ever reaching a layout — trusting each render
 * site to truncate is what lets one of them drift.
 */
export const PLAYER_NAME_MAX = 16;

/** Trim, collapse inner runs of whitespace, clamp to {@link PLAYER_NAME_MAX}. */
export const clampPlayerName = (raw: string | undefined): string =>
  (raw ?? "").replace(/\s+/g, " ").trim().slice(0, PLAYER_NAME_MAX);

/** Clamped name, or `fallback` when the result is empty. */
export const displayPlayerName = (
  raw: string | undefined,
  fallback = "You",
): string => clampPlayerName(raw) || fallback;
