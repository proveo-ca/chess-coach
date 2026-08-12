// SPEC: _spec/apps/starchess/architecture/board-entities.puml
/**
 * Auto-deploy: when a unit appears on the board without relocating from
 * another square, fire a DeployCue and hide the square until DEPLOY_MS ends.
 * Mirrors apps/ui `useAutoDeploy` — Command Center / put drops without a
 * matching leave still animate even if the timeline projector misses them.
 */
import type { Square } from "chess.js";
import { createEffect, createSignal, onCleanup } from "solid-js";
import type { StarChessPiece } from "@chess-coach/starchess-core";

import {
  DEPLOY_MS,
  deployKindFor,
  makeDeployCue,
  type DeployPiece,
} from "~/presentation/animations/deployAnim";
import type { DeployCue, PieceColor } from "~/presentation/types";

type PieceAt = { type: StarChessPiece; color: PieceColor };

const packKey = (p: PieceAt) => `${p.color}${p.type}`;

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
    if (p && packKey(p) === packKey(piece)) continue;
    if (!deployKindFor(piece.type)) continue;

    const fromIdx = disappeared.findIndex((d) => packKey(d.piece) === packKey(piece));
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
 * Call from LiveStarChessBoard (StarChess surfaces).
 */
export function useAutoDeploy(opts: {
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

    // Cancel in-flight deploys when the unit leaves / is captured mid-anim.
    setAutoCues((cur) => {
      const kept = cur.filter((c) => {
        const p = next.get(c.at as Square);
        return !!p && p.type === c.piece && p.color === c.color;
      });
      for (const c of cur) {
        if (kept.some((k) => k.id === c.id)) continue;
        const t = timers.get(c.id);
        if (t) {
          window.clearTimeout(t);
          timers.delete(c.id);
        }
      }
      if (fresh.length === 0) return kept;
      return [...kept, ...fresh];
    });

    if (fresh.length === 0) return;

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
