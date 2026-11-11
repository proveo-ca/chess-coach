// SPEC: _spec/apps/starchess/architecture/board-entities.puml
import type { PieceColor } from "@chess-coach/starchess-core";

/** StarChess team fills — the 4-swatch army every unit is painted from. */
export type { PieceColor };

/** Black stroke / darkest fills. */
export const INK_BLACK = "#222";
/** Mid mechanical grey. */
export const INK_DARK_GRAY = "#555";
/** Hull / cockpit enamel. */
export const INK_WHITE = "#fff";

export const TEAM_PRIMARY: Record<PieceColor, string> = {
  w: "#3b7dd8",
  b: "#a22",
};

/**
 * Same swatch as {@link TEAM_PRIMARY}, as an `r, g, b` triplet — VFX that needs
 * a translucent team tint writes `rgba(var(--team-rgb), 0.4)`.
 */
export const TEAM_RGB: Record<PieceColor, string> = {
  w: "59, 125, 216",
  b: "170, 34, 34",
};

/**
 * The team-tint contract for VFX. Set it on any cue element whose *own* colour
 * belongs to the player — a Hoverbike's deploy flame and frag boom, a Ship's
 * laser — then read `--team-tint` / `--team-rgb` in that layer's CSS with the
 * white swatch as the fallback.
 *
 * It must sit on the cue element, never the layer root: a phase-1 window plays
 * both sides' shots at once, so one tint per layer would paint black's ordnance
 * blue. Custom properties inherit, so a cue's slot covers its descendants.
 */
export const teamTintStyle = (color: PieceColor): Record<string, string> => ({
  "--team-tint": TEAM_PRIMARY[color],
  "--team-rgb": TEAM_RGB[color],
});

export const TEAM_SHADOW: Record<PieceColor, string> = {
  w: "#222",
  b: "#222",
};

/**
 * Outer framing (harmonic-negative-spaces fit) shared by every unit silhouette.
 * Inline art on the board and Death/attack VFX both wrap in it, which is what
 * keeps a firing unit aligned with the resting one on the same square.
 */
export const PIECE_FRAME: Record<"P" | "N" | "B" | "R" | "Q" | "K", string> = {
  P: "translate(22.5 39.2) scale(1.0191 1.0191) translate(-20.03 -39.15)",
  N: "translate(22.5 39.2) scale(0.8033 0.8033) translate(-23.33 -46.15)",
  B: "translate(22.5 39.2) scale(1.0374 1.0265) translate(-22.50 -42.50)",
  R: "translate(22.5 39.2) scale(0.8299 1.0503) translate(-22.50 -39.37)",
  Q: "translate(22.5 39.2) scale(0.8987 0.9927) translate(-22.50 -44.00)",
  K: "translate(22.5 39.2) scale(0.9169 1.1172) translate(-22.50 -43.00)",
};
