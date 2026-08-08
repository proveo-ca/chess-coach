/** Base-aware piece asset URL — never hard-code `/chess/pieces`. */
import type { PieceSet } from "~/types/board";

export const pieceUrl = (
  color: "w" | "b",
  type: string,
  set: PieceSet = "nerd",
): string => {
  const base = import.meta.env.BASE_URL || "/starchess/";
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}pieces/${set}/${color}${type.toUpperCase()}.svg`;
};
