// SPEC: _spec/apps/starchess/core/adjutant/strategic/promotion-defense.puml, _spec/apps/starchess/core/adjutant/strategic/cc-retaliation.puml
/**
 * What a settled resolve legitimately told us — the evidence channel the board
 * alone cannot carry.
 *
 * A unit that only *slides through* one of our lit squares is gone by the time
 * the next snapshot exists, so no comparison of settled boards can ever see it.
 * The resolve payload does record it (`resolved.moves` carries every mover's
 * true `from → to`), but that payload is emitted with **no viewer and no fog**:
 * handing it to a script raw would make the strategic Adjutant omniscient,
 * which is the one thing `cc-focus.puml` forbids. So everything here passes
 * through a gate first, and the gate is the whole point of the module.
 *
 * Three things a side may legitimately learn from a turn it did not watch:
 *
 *  1. **A mover crossed a square we were lighting.** Our vision is read from
 *     the board as the turn began — where our units actually stood while they
 *     were looking — and only path squares inside it count.
 *  2. **A unit that attacked revealed itself.** Firing gives away the shooter's
 *     square; the same credit the UI's own cue gate grants through
 *     `isMoverVisibleToSide`'s `revealedFrom`.
 *  3. **Our Command Center was shot.** We always know we were hit, whatever the
 *     fog says — so the unit that hit it has named itself.
 *
 * Pure and host-agnostic: a host hands in a {@link ResolveWitness} built by the
 * single adapter below, never a raw engine payload.
 */

import type { Square } from "chess.js";

import type { ScPiece } from "../../board/placement";
import { rayBetween } from "../../board/mines";
import { getSideVision, isMoverVisibleToSide } from "../../board/vision";
import type { ResolveAttack, ResolveMove } from "../../resolve/resolve-turn";
import type { EndScTurnResult } from "../../resolve/submit-turn";
import type { PieceColor, ScMine } from "../../model/types";
import { enemyOf, rankOf, RUNNER_RANKS_PER_TURN, stepsToPromotion } from "../context";

/**
 * One settled resolve, reduced to what a fold needs: the board our vision is
 * read from (the position we were watching *from* when the turn began) and the
 * events that happened after it.
 */
export type ResolveWitness = {
  placement: string;
  mines?: readonly ScMine[];
  siegedTanks?: readonly Square[];
  moves?: readonly ResolveMove[];
  attacks?: readonly ResolveAttack[];
};

/**
 * A settled turn: vision is read from the post-B board, which is where our
 * units stood while the classical phase played out in front of them.
 *
 * Every mover is carried, not just the classical ones — a marine that advances
 * by gas step alone (`bMoves` / `fMoves`) crosses our light exactly the same
 * way, and dropping those would blind the channel to half of the two-ranks-a-
 * turn advance it exists to catch. Likewise every attack that names a square:
 * ordinary shots, path-reveal shots, the collisions two units walked into, and
 * mine blasts — the last of which is how we learn our own mine did the work.
 */
export const witnessFromEndTurn = (esr: EndScTurnResult): ResolveWitness => ({
  placement: esr.afterB.placement,
  mines: esr.afterB.mines,
  siegedTanks: esr.afterB.siegedTanks,
  moves: [...esr.bMoves, ...esr.resolved.moves, ...esr.fMoves],
  attacks: [
    ...esr.resolved.attacks,
    ...esr.resolved.pathRevealAttacks,
    ...esr.resolved.moveCollisions,
    ...esr.resolved.mineTriggers,
    ...esr.resolved.pathRevealMineTriggers,
  ],
});

/**
 * A turn-open chip ply reports through the same shape (`beginScTurn` builds a
 * whole `EndScTurnResult` for it, with `afterB` holding the post-chip board),
 * so both kinds of settled ply use the adapter above and there is exactly one.
 */

/** The side's fog for this witness, read the way the planner reads it. */
const witnessVision = (witness: ResolveWitness, side: PieceColor) => {
  const sieged: ReadonlySet<Square> = new Set(witness.siegedTanks ?? []);
  return getSideVision(witness.placement, side, {
    ...(witness.mines ? { mines: witness.mines } : {}),
    tankModeFor: (s: Square) => (sieged.has(s) ? "siege" : "tank"),
  });
};

/**
 * Where a shot actually came from. A slider that discovers its target mid-ray
 * fires from the discovery square and comes to rest on `stopAt`
 * (`resolve/resolve-turn.ts` path-reveal), so `from` is a square it merely
 * passed through — useless for retaliation and misleading as a sighting.
 */
const shotOrigin = (a: ResolveAttack): Square =>
  a.kind === "ccShot" ? (a.stopAt ?? a.from) : a.from;

/** Squares an enemy attack gave away this turn: firing reveals the shooter. */
const revealedByFiring = (
  witness: ResolveWitness,
  side: PieceColor,
): Set<Square> => {
  const enemy = enemyOf(side);
  const out = new Set<Square>();
  for (const a of witness.attacks ?? []) {
    if (a.color !== enemy) continue;
    out.add(shotOrigin(a));
  }
  return out;
};

/**
 * Squares where *we* killed an enemy marine this ply — our own shot, or our own
 * mine doing it for us. Ours either way, so it needs no fog gate, and it is the
 * evidence that keeps a marine we just destroyed from being remembered as a
 * runner still on the loose.
 */
export const ourMarineKills = (
  witness: ResolveWitness,
  side: PieceColor,
): Set<Square> => {
  const out = new Set<Square>();
  for (const a of witness.attacks ?? []) {
    const victim =
      a.kind === "capture" ? a.victim : a.kind === "mineBlast" ? (a.victim ?? null) : null;
    if (!victim || victim.piece !== "p" || victim.color === side) continue;
    const ours = a.color === side || (a.kind === "mineBlast" && a.mineColor === side);
    if (ours) out.add(a.to);
  }
  return out;
};

/**
 * One enemy marine we watched during a turn: the furthest square we actually
 * saw it on, and how much further it can still have travelled unseen.
 */
export type RunnerCrossing = {
  at: Square;
  /**
   * Ranks it may have advanced past `at` — never the full turn's worth, because
   * reaching `at` already cost it part of the turn. This is what keeps the
   * memory from placing a marine a rank ahead of anywhere it could be.
   */
  residual: number;
};

/**
 * Every enemy marine we watched cross our light this turn.
 *
 * A crossing is a *sighting at a moment*, not a position: the move is already
 * over, and the marine finished it at or beyond the square we saw. How far
 * beyond is bounded, and the bound is the point:
 *
 *   - we watched it leave — then it travelled `dist(origin, at)` of its two
 *     ranks to reach `at`, and only the remainder is unaccounted for;
 *   - we did *not* watch it leave — then `at` is a square it passed through
 *     rather than started on, so it has already spent at least one rank.
 *
 * Both readings use only what we saw. Nothing here consults where the move
 * actually ended: that is the payload's knowledge, not ours.
 */
export const runnerCrossings = (
  witness: ResolveWitness,
  side: PieceColor,
): RunnerCrossing[] => {
  const enemy = enemyOf(side);
  const { litSquares, revealedPieces } = witnessVision(witness, side);
  const lit = (at: Square) => litSquares.has(at) || revealedPieces.has(at);
  const revealedFrom = revealedByFiring(witness, side);
  const progress = (at: Square) => stepsToPromotion(rankOf(at), enemy);
  const out: RunnerCrossing[] = [];

  for (const move of witness.moves ?? []) {
    if (move.color !== enemy || move.piece !== "p") continue;

    const path = [move.from, ...rayBetween(move.from, move.to), move.to];
    const watched = path.filter((at) => lit(at));
    // The origin also counts when the shot it fired gave the square away —
    // the rules' own reveal, and the reason `isMoverVisibleToSide` exists.
    const sawItLeave = isMoverVisibleToSide(
      witness.placement,
      side,
      { from: move.from, color: move.color },
      revealedFrom,
    );
    if (watched.length === 0 && !sawItLeave) continue;

    const seen = watched.length > 0 ? watched : [move.from];
    const at = seen.reduce((best, s) => (progress(s) < progress(best) ? s : best));
    const travelled = sawItLeave
      ? progress(move.from) - progress(at)
      : // Unseen origin ⇒ `at` is not where it started, so a rank is spent.
        1;
    out.push({
      at,
      residual: Math.max(0, RUNNER_RANKS_PER_TURN - travelled),
    });
  }

  return out;
};

/** A unit that fired on our Command Center, named by the shot itself. */
export type CCAttacker = {
  /** The square it fired from — where it stood when it gave itself away. */
  at: Square;
  piece: ScPiece["type"];
  /** Turn of the shot; the memory ages from here. */
  turn: number;
};

/**
 * Every enemy unit that hit our Command Center in this resolve.
 *
 * No fog gate is needed and none is honest here: a Command Center that takes a
 * hit knows it took one, and the shot names the square it came from. This is
 * the one channel that reports through complete darkness.
 */
export const ccAttackers = (
  witness: ResolveWitness,
  side: PieceColor,
  turn: number,
): CCAttacker[] => {
  const enemy = enemyOf(side);
  const out: CCAttacker[] = [];
  for (const a of witness.attacks ?? []) {
    if (a.color !== enemy) continue;
    if (a.kind !== "ccShot" || a.target !== side) continue;
    // Where it *rests*, not where it fired from mid-slide: a mark on a square
    // the shooter never stands on is a debt nothing can collect.
    out.push({ at: shotOrigin(a), piece: a.piece, turn });
  }
  return out;
};
