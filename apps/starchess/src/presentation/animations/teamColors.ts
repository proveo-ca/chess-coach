import type { PieceColor } from "~/presentation/types";

/** StarChess team fills — match `public/pieces/nerd/` (4-swatch army). */
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

/** @deprecated flat 4-swatch — use TEAM_PRIMARY */
export const TEAM_LIGHT: Record<PieceColor, string> = {
  w: "#3b7dd8",
  b: "#a22",
};

/** @deprecated flat 4-swatch — use TEAM_PRIMARY */
export const TEAM_DARK: Record<PieceColor, string> = {
  w: "#3b7dd8",
  b: "#a22",
};

export const TEAM_SHADOW: Record<PieceColor, string> = {
  w: "#222",
  b: "#222",
};

/**
 * Outer framing from `public/pieces/nerd/` (harmonic-negative-spaces fit).
 * Wrap Inline/Death silhouettes so attack VFX lines up with board art.
 */
export const PIECE_FRAME: Record<"P" | "N" | "B" | "R" | "Q" | "K", string> = {
  P: "translate(22.5 39.2) scale(1.0191 1.0191) translate(-20.03 -39.15)",
  N: "translate(22.5 39.2) scale(0.8033 0.8033) translate(-23.33 -46.15)",
  B: "translate(22.5 39.2) scale(1.0374 1.0265) translate(-22.50 -42.50)",
  R: "translate(22.5 39.2) scale(0.8299 1.0503) translate(-22.50 -39.37)",
  Q: "translate(22.5 39.2) scale(0.8987 0.9927) translate(-22.50 -44.00)",
  K: "translate(22.5 39.2) scale(0.9169 1.1172) translate(-22.50 -43.00)",
};
