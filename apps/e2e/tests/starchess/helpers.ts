import type { Page } from "@playwright/test";

/**
 * Settled unit only — matches either glyph form (legacy `img[alt]` or inline
 * SVG `data-piece-inline`) and excludes intent ghosts (`data-intent-dest`).
 */
export const settledPieceAt = (page: Page, sq: string, alt: string) => {
  const [, type] = alt.split(" ");
  const root = `[data-board-grid] [data-square='${sq}']`;
  return page.locator(
    `${root} img[alt='${alt}'], ${root} [data-piece-inline='${type}']:not([data-intent-dest])`,
  );
};
