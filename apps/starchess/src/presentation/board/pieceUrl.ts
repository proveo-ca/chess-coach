/** Base-aware piece asset URL — never hard-code `/chess/pieces`. */
export const pieceUrl = (
  color: "w" | "b",
  type: string,
  set = "nerd",
): string => {
  const base = import.meta.env.BASE_URL || "/starchess/";
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}pieces/${set}/${color}${type.toUpperCase()}.svg`;
};
