// SPEC: _spec/apps/starchess/architecture/board-entities.puml
/**
 * Base-aware piece asset URL — never hard-code `/chess/pieces`.
 * App asset paths only — piece sets are presentation, not starchess-core.
 *
 * `set` is required: this app ships `cburnett` and nothing else, so a defaulted
 * `nerd` would build a URL for art that no longer exists here. The two callers
 * allowed to reach for an asset both pass `cburnett` explicitly, and
 * `__tests__/bundle/bundleBoundary.test.ts` keeps that list closed.
 */
import type { PieceSet } from "~/types/board";

export const pieceUrl = (
  color: "w" | "b",
  type: string,
  set: PieceSet,
): string => {
  const base = import.meta.env.BASE_URL || "/starchess/";
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}pieces/${set}/${color}${type.toUpperCase()}.svg`;
};
