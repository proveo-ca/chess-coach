/**
 * Planning intent overlays — ghost destinations from the SCFEN queue.
 * DualNav demos omit `viewer` so both sides' classical intentions show.
 */
import type { PieceSymbol, Square } from "chess.js";

import {
  placementToMap,
  rookModeAfterB,
  type RookMode,
  type ScAction,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import type { IntentGhost } from "~/presentation/board/EclipseBoard";

export type IntentOverlayOpts = {
  placement?: string;
  siegedRooks?: readonly Square[];
  /**
   * Local player — only that side’s queue ghosts. Omit for DualNav / observers
   * (both intentions).
   */
  viewer?: StarChessColor;
};

/**
 * Map planning `Q:` classical (+ relocating specials) → destination ghosts.
 * Matches UI `intentOverlaysFromQueue(...).destinations` (canisters/checks omitted —
 * EclipseBoard only renders destination ghosts today).
 */
export const intentOverlaysFromQueue = (
  actions: readonly ScAction[] | undefined,
  opts?: IntentOverlayOpts,
): IntentGhost[] => {
  const destinations: IntentGhost[] = [];
  const seenDest = new Set<string>();
  const map = opts?.placement ? placementToMap(opts.placement) : null;
  const viewer = opts?.viewer;
  const queue = actions ?? [];

  for (const a of queue) {
    if (viewer && a.color !== viewer) continue;
    if (a.timing === "C") {
      const actor = map?.get(a.from);
      const piece = actor?.type;
      if (!piece) continue;
      const key = `${a.color}:${a.to}`;
      if (seenDest.has(key)) continue;
      seenDest.add(key);
      destinations.push({
        at: a.to,
        color: a.color,
        piece,
        ...(piece === "r"
          ? { rookMode: rookModeAfterB(a.from, opts?.siegedRooks, queue) as RookMode }
          : {}),
      });
      continue;
    }
    // B / F specials — destination ghost when `to` relocates / spawns.
    if (!a.to || a.to === a.from) continue;
    const piece: PieceSymbol | undefined =
      a.kind === "spawn" && a.unit ? a.unit : map?.get(a.from)?.type;
    if (!piece) continue;
    const key = `${a.color}:${a.to}`;
    if (seenDest.has(key)) continue;
    seenDest.add(key);
    destinations.push({
      at: a.to,
      color: a.color,
      piece,
      ...(piece === "r"
        ? {
            rookMode: (a.kind === "spawn"
              ? "tank"
              : rookModeAfterB(a.from, opts?.siegedRooks, queue)) as RookMode,
          }
        : {}),
    });
  }

  return destinations;
};
