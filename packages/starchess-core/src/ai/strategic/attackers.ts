// SPEC: _spec/apps/starchess/core/adjutant/strategic/cc-retaliation.puml
/**
 * Who shot the Command Center — the one thing fog can never hide.
 *
 * A Command Center that takes a hit knows it took one, and in StarChess the
 * shot names its own origin square (`ccShot.from`). So an attacker that fires
 * out of complete darkness has told us exactly where it is: firing is the price
 * of hiding. This memory holds that square until the debt is settled.
 *
 * Deliberately *not* a posterior. A runner is remembered as a spread of
 * possible squares because it moves every turn (`runners.ts`); a shooter is
 * remembered as a **fact with an expiry**, because the only useful question is
 * "is it still standing where it fired, and can we take it". Once the square is
 * lit and holds no enemy, or the memory ages out, the record is gone.
 *
 * Folded once per settled ply by `tracking.ts` and threaded by the host, like
 * every other cross-ply value.
 */

import type { Square } from "chess.js";

import { placementToMap } from "../../board/placement";
import { getSideVision } from "../../board/vision";
import type { PieceColor, ScFenSnapshot } from "../../model/types";
import { enemyOf } from "../context";
import { ccAttackers, type CCAttacker, type ResolveWitness } from "./witness";

export type { CCAttacker };

/** One side's record of who has fired on its Command Center lately. */
export type AttackerMemory = {
  attackers: readonly CCAttacker[];
  /** Turn of the last fold — one propagation per ply, as everywhere else. */
  turn: number;
};

/**
 * How long a shooter stays wanted. Long enough to bring an answer from across
 * the board, short enough that a square it has certainly left stops pulling
 * units toward it.
 */
export const ATTACKER_MEMORY_TURNS = 3;

export const emptyAttackerMemory = (): AttackerMemory => ({
  attackers: [],
  turn: -1,
});

/**
 * Fold one settled ply: add whoever hit our Command Center, drop whoever we can
 * now see is no longer there, and age out the rest.
 *
 * The pruning is fog-honest in the same shape as everything else: a lit square
 * with no enemy on it is proof the shooter left, while a dark square proves
 * nothing and the record survives on its clock alone.
 */
export const foldAttackerMemory = (
  prior: AttackerMemory,
  snap: ScFenSnapshot,
  side: PieceColor,
  witness?: ResolveWitness | null,
): AttackerMemory => {
  const enemy = enemyOf(side);
  const map = placementToMap(snap.placement);
  const sieged: ReadonlySet<Square> = new Set(snap.siegedTanks ?? []);
  const { litSquares, revealedPieces } = getSideVision(snap.placement, side, {
    mines: snap.mines,
    tankModeFor: (s) => (sieged.has(s) ? "siege" : "tank"),
  });
  const visible = (at: Square) => litSquares.has(at) || revealedPieces.has(at);
  /**
   * Still the unit that fired — not merely *an* enemy. A shooter that warps out
   * and leaves a marine on the square has paid its debt and passed on nothing:
   * billing whoever stands there next would spend 9_000 to take a 1-value unit.
   */
  const stillThere = (a: CCAttacker) => {
    const piece = map.get(a.at);
    return !!piece && piece.color === enemy && piece.type === a.piece;
  };

  const fresh: CCAttacker[] = [];
  for (const shot of witness ? ccAttackers(witness, side, snap.turn) : []) {
    if (!fresh.some((f) => f.at === shot.at)) fresh.push(shot);
  }
  const kept = prior.attackers.filter(
    (a) =>
      snap.turn - a.turn < ATTACKER_MEMORY_TURNS &&
      // Seen to be someone else, or gone → the debt is void. Unseen → it stands.
      (!visible(a.at) || stillThere(a)) &&
      !fresh.some((f) => f.at === a.at),
  );

  return { attackers: [...fresh, ...kept], turn: snap.turn };
};

/** The wanted square this move would take, if any. */
export const wantedAt = (
  attackers: readonly CCAttacker[],
  at: Square,
): CCAttacker | null => attackers.find((a) => a.at === at) ?? null;
