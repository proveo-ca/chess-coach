/**
 * Auto-deploy: when a unit appears on the board without relocating from
 * another square, fire a DeployCue and hide the square until DEPLOY_MS ends.
 */

import type { Color, PieceSymbol, Square } from "chess.js";
import { createEffect, createSignal, onCleanup } from "solid-js";

import { deployKindFor, makeDeployCue, type DeployPiece } from "~/starchess/animations/deployAnim";
import { DEPLOY_MS } from "~/starchess/constants";
import type { DeployCue } from "~/starchess/types";

type PieceAt = { type: PieceSymbol; color: Color };

const packKey = (p: PieceAt) => `${p.color}${p.type}`;

/** Snapshot of occupied squares from a chess.js-like board getter. */
export const pieceMapFromBoard = (
  get: (sq: Square) => PieceAt | null | undefined,
): Map<Square, PieceAt> => {
  const out = new Map<Square, PieceAt>();
  for (let rf = 0; rf < 8; rf++) {
    for (let ff = 0; ff < 8; ff++) {
      const sq = `${"abcdefgh"[ff]}${rf + 1}` as Square;
      const p = get(sq);
      if (p) out.set(sq, { type: p.type, color: p.color });
    }
  }
  return out;
};

/**
 * Diff two occupancy maps → deploy cues for pieces that appeared without a
 * matching departure (spawn / put), not quiet relocates or captures-out.
 */
export const deployCuesForBoardDiff = (
  prev: Map<Square, PieceAt>,
  next: Map<Square, PieceAt>,
): DeployCue[] => {
  const disappeared: { sq: Square; piece: PieceAt }[] = [];
  for (const [sq, piece] of prev) {
    const n = next.get(sq);
    if (!n || packKey(n) !== packKey(piece)) disappeared.push({ sq, piece });
  }

  const cues: DeployCue[] = [];
  for (const [sq, piece] of next) {
    const p = prev.get(sq);
    if (p && packKey(p) === packKey(piece)) continue; // unchanged
    if (!deployKindFor(piece.type)) continue; // kings / unknown

    // Relocate: same type+color left some other square this tick.
    const fromIdx = disappeared.findIndex(
      (d) => packKey(d.piece) === packKey(piece),
    );
    if (fromIdx >= 0) {
      disappeared.splice(fromIdx, 1);
      continue;
    }

    cues.push(makeDeployCue(piece.type as DeployPiece, piece.color, sq));
  }
  return cues;
};

/**
 * Watches board occupancy and returns merged auto-deploy cues.
 * Call from StarChessBoard only (StarChess surfaces).
 */
export function useAutoDeploy(opts: {
  /** Current occupancy; pass a getter that tracks the live game. */
  pieces: () => Map<Square, PieceAt>;
  /** When false, clear cues and re-baseline without animating. */
  enabled?: () => boolean;
}) {
  const [autoCues, setAutoCues] = createSignal<DeployCue[]>([]);
  let prev: Map<Square, PieceAt> | null = null;
  const timers = new Map<string, number>();

  const clearTimers = () => {
    for (const id of timers.values()) window.clearTimeout(id);
    timers.clear();
  };

  onCleanup(() => {
    clearTimers();
  });

  createEffect(() => {
    const enabled = opts.enabled?.() ?? true;
    const next = opts.pieces();
    if (!enabled) {
      clearTimers();
      setAutoCues([]);
      prev = next;
      return;
    }

    if (!prev) {
      prev = next;
      return;
    }

    const fresh = deployCuesForBoardDiff(prev, next);
    prev = next;
    if (fresh.length === 0) return;

    setAutoCues((cur) => [...cur, ...fresh]);
    for (const cue of fresh) {
      const existing = timers.get(cue.id);
      if (existing) window.clearTimeout(existing);
      timers.set(
        cue.id,
        window.setTimeout(() => {
          timers.delete(cue.id);
          setAutoCues((cur) => cur.filter((c) => c.id !== cue.id));
        }, DEPLOY_MS),
      );
    }
  });

  return { autoDeployCues: autoCues };
}
