import type { Square } from "chess.js";

export const findBoardGrid = (host: HTMLElement): HTMLElement | null => {
  const hooked = host.querySelector<HTMLElement>("[data-board-grid]");
  if (hooked) return hooked;
  const container = host.querySelector<HTMLElement>("[data-testid='chessboard']");
  if (!container) return null;
  for (const child of Array.from(container.children)) {
    if (getComputedStyle(child).display === "grid") return child as HTMLElement;
  }
  return container.querySelector(":scope > div");
};

export const squareBoxStyle = (
  sq: Square,
  boardWidth: number,
  boardHeight: number,
): Record<string, string> => {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]);
  const w = boardWidth / 8;
  const h = boardHeight / 8;
  return {
    left: `${file * w}px`,
    top: `${(8 - rank) * h}px`,
    width: `${w}px`,
    height: `${h}px`,
  };
};

export const squareCenterPx = (
  sq: Square,
  boardWidth: number,
  boardHeight: number,
): { x: number; y: number } => {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]);
  const w = boardWidth / 8;
  const h = boardHeight / 8;
  return { x: (file + 0.5) * w, y: (8 - rank + 0.5) * h };
};

export const hideSquareImgs = (host: HTMLElement, squares: Square[]) => {
  for (const sq of squares) {
    host.querySelectorAll<HTMLElement>(`[data-square="${sq}"] img`).forEach((img) => {
      img.style.opacity = "0";
    });
  }
};

export const revealSquareImgs = (host: HTMLElement, squares: Square[]) => {
  for (const sq of squares) {
    host.querySelectorAll<HTMLElement>(`[data-square="${sq}"] img`).forEach((img) => {
      img.style.opacity = "";
    });
  }
};

/** Apply hide set without flashing every piece (no global clear). */
export const applyHiddenImgs = (host: HTMLElement, hidden: ReadonlySet<Square> | Square[]) => {
  const hide = hidden instanceof Set ? hidden : new Set(hidden);
  host.querySelectorAll<HTMLElement>("[data-square]").forEach((cell) => {
    const sq = cell.getAttribute("data-square") as Square | null;
    if (!sq) return;
    const opacity = hide.has(sq) ? "0" : "";
    cell.querySelectorAll<HTMLElement>("img").forEach((img) => {
      img.style.opacity = opacity;
    });
  });
};

export const clearHiddenImgs = (host: HTMLElement) => {
  host.querySelectorAll<HTMLElement>("[data-square] img").forEach((img) => {
    img.style.opacity = "";
  });
};

/** Board deltas from `from` → `to` (white’s +rank toward the opponent). */
export const vecBetween = (from: Square, to: Square): { df: number; dr: number } => ({
  df: to.charCodeAt(0) - from.charCodeAt(0),
  dr: Number(to[1]) - Number(from[1]),
});
