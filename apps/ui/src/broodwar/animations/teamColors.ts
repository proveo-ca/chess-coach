/** Brood War team fills — match `public/pieces/nerd/w*.svg` / `b*.svg`. */
export type PieceColor = "w" | "b";

export const TEAM_PRIMARY: Record<PieceColor, string> = {
  w: "#3b7dd8",
  b: "#a22",
};

export const TEAM_LIGHT: Record<PieceColor, string> = {
  w: "#7eb6f5",
  b: "#e87878",
};

export const TEAM_DARK: Record<PieceColor, string> = {
  w: "#1f5cae",
  b: "#7a1515",
};

export const TEAM_SHADOW: Record<PieceColor, string> = {
  w: "#1a3a6a",
  b: "#4a1010",
};
