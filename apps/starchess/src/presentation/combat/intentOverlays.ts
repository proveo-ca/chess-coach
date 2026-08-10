/**
 * Planning intent overlays — ghost destinations + canister badges + check rings
 * from the live SCFEN queue (and DualNav intent phase).
 *
 * Red dashed rings (`checks`):
 * - fog-visible standing king-checks on the board (resolve at next turn open)
 * - checks that appear after applying queued classical moves (projected)
 * - capture/attack destinations (enemy on classical `to`)
 */
import type { PieceSymbol, Square } from "chess.js";

import {
  collectLegalKingChecks,
  getSideVision,
  mapToPlacement,
  placementToMap,
  rookModeAfterB,
  type RookMode,
  type ScAction,
  type ScMine,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { pieceAtQueuedSquare } from "~/presentation/board/occupancyForQueuedMoves";
import type { IntentGhost } from "~/types/board";

export type IntentCanisterGhost = {
  at: Square;
  color: StarChessColor;
};

/** Threatened square — red dashed ring (king check or capture intent). */
export type IntentCheckGhost = {
  at: Square;
};

export type IntentOverlays = {
  destinations: IntentGhost[];
  /**
   * Ghost vespene badge: gas/warp/siege on the live actor; spawn on the
   * deploy square so a deploy ghost reads “with gas” vs a pure move ghost.
   */
  canisters: IntentCanisterGhost[];
  checks: IntentCheckGhost[];
};

export type IntentOverlayOpts = {
  placement?: string;
  siegedRooks?: readonly Square[];
  mines?: readonly ScMine[];
  /**
   * Local player — only that side’s queue ghosts. Omit for DualNav / observers
   * (both intentions). Check rings stay global (threat is public once lit).
   */
  viewer?: StarChessColor;
};

const fogVisibleGate = (
  placement: string,
  siegedRooks: readonly Square[] | undefined,
  mines: readonly ScMine[] | undefined,
) => {
  const sieged = new Set(siegedRooks ?? []);
  const rookModeFor = (sq: Square): RookMode =>
    sieged.has(sq) ? "siege" : "tank";
  const vOpts = { rookModeFor, mines: mines ? [...mines] : undefined };
  const visionW = getSideVision(placement, "w", vOpts);
  const visionB = getSideVision(placement, "b", vOpts);
  return (color: StarChessColor, square: Square) => {
    const v = color === "w" ? visionW : visionB;
    return v.litSquares.has(square) || v.revealedPieces.has(square);
  };
};

/** Apply queued classical relocates for check projection (captures clear `to`). */
const placementAfterClassicalQueue = (
  placement: string,
  actions: readonly ScAction[],
): string => {
  const map = placementToMap(placement);
  for (const a of actions) {
    if (a.timing !== "C" || a.kind !== "classical") continue;
    const actor = map.get(a.from);
    if (!actor || actor.color !== a.color) continue;
    const target = map.get(a.to);
    // Engine never occupies the enemy king via classical `C=` — skip projection.
    if (target?.type === "k" && target.color !== actor.color) continue;
    map.delete(a.from);
    if (target && target.color !== actor.color) map.delete(a.to);
    map.set(a.to, actor);
  }
  return mapToPlacement(map);
};

const pushCheck = (
  checks: IntentCheckGhost[],
  seen: Set<string>,
  at: Square,
) => {
  if (seen.has(at)) return;
  seen.add(at);
  checks.push({ at });
};

/**
 * Map planning `Q:` → destination ghosts + canister badges + red check rings.
 */
export const intentOverlaysFromQueue = (
  actions: readonly ScAction[] | undefined,
  opts?: IntentOverlayOpts,
): IntentOverlays => {
  const destinations: IntentGhost[] = [];
  const canisters: IntentCanisterGhost[] = [];
  const checks: IntentCheckGhost[] = [];
  const seenDest = new Set<string>();
  const seenCan = new Set<string>();
  const seenCheck = new Set<string>();
  const map = opts?.placement ? placementToMap(opts.placement) : null;
  const viewer = opts?.viewer;
  const queue = actions ?? [];

  for (const a of queue) {
    if (viewer && a.color !== viewer) continue;
    if (a.timing === "C") {
      // Resolve actor via post-B occupancy (spawn / gas / warp landing) so a
      // classical after deploy paints a move ghost — not only the B ghost.
      const piece = map
        ? pieceAtQueuedSquare(map, a.from, a.color, queue)?.type
        : undefined;
      if (!piece) continue;
      const key = `${a.color}:${a.to}`;
      if (!seenDest.has(key)) {
        seenDest.add(key);
        destinations.push({
          at: a.to,
          color: a.color,
          piece,
          ...(piece === "r"
            ? { rookMode: rookModeAfterB(a.from, opts?.siegedRooks, queue) as RookMode }
            : {}),
        });
      }
      // Capture / attack intent — red ring on the enemy square.
      const target = map?.get(a.to);
      if (target && target.color !== a.color) {
        pushCheck(checks, seenCheck, a.to);
      }
      continue;
    }
    // B / F specials — canister badge + destination ghost when relocating.
    // Spawn: badge rides the deploy ghost (to), not the king — differentiates
    // deploy-with-gas vs pure classical move ghost (no canister).
    // Gas/warp/etc.: badge on live actor (from). F after C: follow C landing.
    const canAt =
      a.kind === "spawn" && a.to
        ? a.to
        : a.timing === "F"
          ? (() => {
              const c = queue.find(
                (q) =>
                  q.timing === "C" &&
                  q.kind === "classical" &&
                  q.color === a.color &&
                  q.from === a.from,
              );
              return c?.to ?? a.from;
            })()
          : a.from;
    const canKey = `${a.color}:${canAt}`;
    if (!seenCan.has(canKey)) {
      seenCan.add(canKey);
      canisters.push({ at: canAt, color: a.color });
    }
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

  // Fog-visible legal checks — standing now, and after *viewer* classical moves
  // (projected discovered checks). Never apply opponent queue to the projection
  // — that would leak their intent.
  if (opts?.placement) {
    const placements = [opts.placement];
    const projectQueue = viewer
      ? queue.filter((a) => a.color === viewer)
      : queue;
    if (projectQueue.some((a) => a.timing === "C" && a.kind === "classical")) {
      placements.push(placementAfterClassicalQueue(opts.placement, projectQueue));
    }
    for (const placement of placements) {
      const isTargetVisible = fogVisibleGate(
        placement,
        opts.siegedRooks,
        opts.mines,
      );
      for (const shot of collectLegalKingChecks(placement, { isTargetVisible })) {
        pushCheck(checks, seenCheck, shot.to);
      }
    }
  }

  return { destinations, canisters, checks };
};
