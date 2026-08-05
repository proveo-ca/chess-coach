/**
 * Planning intent overlays — ghost destination pieces + canister badges from
 * the live SCFEN queue (not resolve / DualNav review).
 */

import type { PieceSymbol, Square } from "chess.js";
import { Chess } from "chess.js";

import { collectLegalKingChecks, placementToMap } from "~/starchess/board";
import { rookModeAfterB } from "~/starchess/rookSiegeMode";
import { getSideVision } from "~/starchess/vision";
import type {
  PieceColor,
  RookMode,
  ScAction,
  ScMine,
} from "~/starchess/types";

export type IntentDestGhost = {
  at: Square;
  color: PieceColor;
  /** Piece silhouette to render as a dashed / ghost intent (from mover or spawn unit). */
  piece: PieceSymbol;
  /**
   * Siege Tank ghost mode. Unsiege+move intent shows {@link InlineRook} tank;
   * omit for non-rooks.
   */
  rookMode?: RookMode;
};

export type IntentCanisterGhost = {
  at: Square;
  color: PieceColor;
};

/** Legal king-check — red dashed ring on the threatened king square. */
export type IntentCheckGhost = {
  at: Square;
};

export type IntentOverlays = {
  /** Ghost piece silhouettes on queued destinations. */
  destinations: IntentDestGhost[];
  /** Ghost vespene canister over units with a queued special. */
  canisters: IntentCanisterGhost[];
  /** Kings currently legally checked (implicit geometry on placement). */
  checks: IntentCheckGhost[];
};

export type IntentOverlayOpts = {
  /** Post-planning placement — resolves classical / warp mover piece types. */
  placement?: string;
  /** Current `S:` sieged squares (B rookSiege toggles apply for ghost mode). */
  siegedRooks?: readonly Square[];
  mines?: readonly ScMine[];
  /**
   * Local player color — only that side’s queue ghosts are shown.
   * Omit for observers / DualNav demos that should see both intentions.
   */
  viewer?: PieceColor;
};

/** Map planning `Q:` (+ optional `H:`) → board ghosts (intent squares, not resolved). */
export const intentOverlaysFromQueue = (
  actions: readonly ScAction[] | undefined,
  opts?: IntentOverlayOpts,
): IntentOverlays => {
  const destinations: IntentDestGhost[] = [];
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
      const actor = map?.get(a.from);
      const piece = actor?.type;
      if (!piece) continue;
      const key = `${a.color}:${a.to}`;
      if (!seenDest.has(key)) {
        seenDest.add(key);
        destinations.push({
          at: a.to,
          color: a.color,
          piece,
          ...(piece === "r"
            ? { rookMode: rookModeAfterB(a.from, opts?.siegedRooks, queue) }
            : {}),
        });
      }
      continue;
    }
    // B / F specials — canister on the unit; destination ghost when `to` relocates / spawns.
    const canKey = `${a.color}:${a.from}`;
    if (!seenCan.has(canKey)) {
      seenCan.add(canKey);
      canisters.push({ at: a.from, color: a.color });
    }
    if (!a.to || a.to === a.from) continue;
    const piece: PieceSymbol | undefined =
      a.kind === "spawn" && a.unit ? a.unit : map?.get(a.from)?.type;
    if (!piece) continue;
    const key = `${a.color}:${a.to}`;
    if (!seenDest.has(key)) {
      seenDest.add(key);
      destinations.push({
        at: a.to,
        color: a.color,
        piece,
        ...(piece === "r"
          ? {
              rookMode:
                a.kind === "spawn"
                  ? "tank"
                  : rookModeAfterB(a.from, opts?.siegedRooks, queue),
            }
          : {}),
      });
    }
  }

  // Fog-visible legal checks on the live board (implicit — resolve next End before B).
  if (opts?.placement) {
    const sieged = new Set(opts.siegedRooks ?? []);
    const rookModeFor = (sq: Square): RookMode =>
      sieged.has(sq) ? "siege" : "tank";
    const game = new Chess(`${opts.placement} w - - 0 1`);
    const vOpts = { rookModeFor, mines: opts.mines };
    const visionW = getSideVision(game, "w", vOpts);
    const visionB = getSideVision(game, "b", vOpts);
    for (const shot of collectLegalKingChecks(opts.placement, {
      isTargetVisible: (color, square) => {
        const v = color === "w" ? visionW : visionB;
        return v.litSquares.has(square) || v.revealedPieces.has(square);
      },
    })) {
      if (seenCheck.has(shot.to)) continue;
      seenCheck.add(shot.to);
      checks.push({ at: shot.to });
    }
  }

  return { destinations, canisters, checks };
};
