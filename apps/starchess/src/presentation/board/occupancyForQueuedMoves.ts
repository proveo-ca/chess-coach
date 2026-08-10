// SPEC: _spec/packages/starchess-core/sc-moves.puml, _spec/apps/starchess/starchess-mode.puml
/**
 * Planning occupancy after viewer B intents — spawn / gas / warp / siege toggle.
 * Board input uses this so classical can be queued from post-B squares.
 */
import type { Square } from "chess.js";
import {
  isRookSiegedAfterB,
  type ScAction,
  type ScFenSnapshot,
  type ScPiece,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { occupancyForViewerMoves } from "~/presentation/board/occupancyForViewerMoves";

/** Apply one side's B specials onto a mutable occupancy map. */
export const applyViewerBOccupancy = (
  map: Map<Square, ScPiece>,
  actions: readonly ScAction[] | undefined,
  viewer: StarChessColor,
): Map<Square, ScPiece> => {
  const out = new Map(map);
  const bs = (actions ?? [])
    .filter((a) => a.timing === "B" && a.color === viewer)
    .slice()
    .sort((a, b) => a.seq - b.seq);

  for (const a of bs) {
    if (a.kind === "spawn" && a.to && a.unit) {
      out.set(a.to, { type: a.unit, color: a.color });
      continue;
    }
    if (
      (a.kind === "pawnDouble" || a.kind === "queenWarp") &&
      a.to &&
      a.from
    ) {
      const piece = out.get(a.from);
      if (!piece || piece.color !== a.color) continue;
      out.delete(a.from);
      out.set(a.to, piece);
      continue;
    }
    // rookSiege / bishopSnipe / knightMine — occupancy unchanged
  }
  return out;
};

/** Sieged squares after viewer B `rookSiege` toggles (for scMovesFrom). */
export const siegedRooksAfterViewerB = (
  snap: Pick<ScFenSnapshot, "siegedRooks" | "queue">,
  viewer: StarChessColor,
  baseSieged?: ReadonlySet<Square> | readonly Square[],
): Square[] => {
  const base = baseSieged
    ? baseSieged instanceof Set
      ? [...baseSieged]
      : [...baseSieged]
    : [...(snap.siegedRooks ?? [])];
  const actions = snap.queue?.actions ?? [];
  // Collect rook squares that might toggle (current sieged + B rookSiege froms).
  const candidates = new Set<Square>(base);
  for (const a of actions) {
    if (a.timing === "B" && a.kind === "rookSiege" && a.color === viewer) {
      candidates.add(a.from);
    }
  }
  const out: Square[] = [];
  for (const sq of candidates) {
    if (isRookSiegedAfterB(sq, base, actions)) out.push(sq);
  }
  return out;
};

/**
 * Fog-filtered occupancy with viewer B intents applied (spawn / gas / warp).
 * Use for classical legal dests and selecting about-to-exist units.
 */
export const occupancyForQueuedMoves = (
  raw: ReadonlyMap<Square, ScPiece>,
  viewer: StarChessColor,
  fog: boolean,
  snap: Pick<ScFenSnapshot, "siegedRooks" | "queue">,
  baseSieged?: ReadonlySet<Square> | readonly Square[],
): {
  map: Map<Square, ScPiece>;
  siegedRooks: Square[];
} => {
  const siegedRooks = siegedRooksAfterViewerB(snap, viewer, baseSieged);
  const rookModeFor = (sq: Square) =>
    siegedRooks.includes(sq) ? ("siege" as const) : ("tank" as const);

  // Project B first so fog visibility uses post-B positions for own units.
  const projected = applyViewerBOccupancy(
    new Map(raw),
    snap.queue?.actions,
    viewer,
  );
  const map = occupancyForViewerMoves(projected, viewer, fog, { rookModeFor });
  return { map, siegedRooks };
};

/**
 * Resolve the piece the viewer is selecting — planning map or B virtual unit.
 * After gas/warp, both landing (`B.to`) and origin (`B.from`) stay selectable:
 * origin uses rewrite-style classical from pre-B square (engine stack).
 */
export const pieceAtQueuedSquare = (
  raw: ReadonlyMap<Square, ScPiece>,
  square: Square,
  viewer: StarChessColor,
  actions: readonly ScAction[] | undefined,
): ScPiece | null => {
  const projected = applyViewerBOccupancy(new Map(raw), actions, viewer);
  const at = projected.get(square);
  if (at) return at;
  // Origin of a B relocate — piece already moved to `to` in projection.
  const reloc = (actions ?? []).find(
    (a) =>
      a.timing === "B" &&
      a.color === viewer &&
      a.from === square &&
      a.to &&
      (a.kind === "pawnDouble" || a.kind === "queenWarp"),
  );
  if (reloc?.to) return projected.get(reloc.to) ?? raw.get(square) ?? null;
  return null;
};

/** True when square is B.from of a viewer gas/warp (rewrite classical from origin). */
export const isViewerBRelocateOrigin = (
  square: Square,
  viewer: StarChessColor,
  actions: readonly ScAction[] | undefined,
): boolean =>
  (actions ?? []).some(
    (a) =>
      a.timing === "B" &&
      a.color === viewer &&
      a.from === square &&
      a.to &&
      (a.kind === "pawnDouble" || a.kind === "queenWarp"),
  );
