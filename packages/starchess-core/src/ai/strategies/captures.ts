// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Captures — taking material, and the Charon strike that removes a BattleShip
 * without moving the Mecha.
 *
 * Trade policy: equal material is always worth taking; up-trades scale with the
 * gap; down-trades stay barely tempting so they only win when another concern
 * (survival, checks) is already paying for the move.
 */

import type { Square } from "chess.js";

import {
  charonDiagonalSquares,
  charonStrikeTarget,
  charonTargetShips,
} from "../../rules/specials/mechaCharon";
import { QUEEN_WARP_GAS_COST, UNIT_COST, incomeForTurn } from "../../rules/constants";
import { attacksSquare, isSquareAttackedBy } from "../../board/placement";
import { hostileMineOn } from "../../board/mine-contact";
import { deployCovers } from "../../board/deploy-reach";
import { chebyshev } from "../context";
import { FILES, centerScore, isSafeSquare } from "../context";
import type { AdjutantCtx, Candidate, MoveEval } from "../context";
import type { PieceColor, ScFenSnapshot } from "../../model/types";
import { asCandidate, type Strategy } from "./types";
import { QUEEN_WARP_CHECK_CC } from "./survival";

/** Equal-material capture when in range — always take the trade. */
export const EQUAL_TRADE_ATTACK = 2_400;
/** Congested / always: take an undefended enemy marine. */
export const HUNT_UNDEFENDED_PAWN = 950;
/** Congested: trade marine-for-marine to clear clutter. */
export const PAWN_TRADE = 750;
/** Charon (B) then a second unit still strikes in the same turn. */
export const CHARON_COMBO = 2_500;
/** Insta-target bonus: pre-jump B kill is near-guaranteed (top material tier). */
export const CHARON_INSTA = 3_200;
/** Teleport-guess bonus before the hit-rate discount (hotter: ~800 effective). */
export const CHARON_GUESS = 2_000;
/** Guess uncertainty discount — whiffs fizzle off-board by design. */
export const CHARON_GUESS_HIT_RATE = 0.4;
/** Predicted jump destinations pursued per (mecha, ship) pair. */
export const CHARON_MAX_GUESSES_PER_SHIP = 3;
/** Total F guess singles per planning turn (bounds C+F fan-out). */
export const CHARON_MAX_GUESSES_TOTAL = 12;
/** Give up a unit to keep the enemy Command Center under fire, while ahead. */
export const SAC_FOR_CC_WINNING = 1_800;
/** Same trade while not ahead — kept below a real check. */
export const SAC_FOR_CC = 400;

/**
 * Enemy can afford Tactical Jump this turn — gas cap, never the turn number.
 * Jump costs 3 (tier-3 income, turn 21+ when normalized); gas never accumulates.
 */
export const enemyCanJump = (snap: ScFenSnapshot, enemy: PieceColor): boolean =>
  (snap.gasIncome[enemy] ?? 0) >= QUEEN_WARP_GAS_COST;

/**
 * Where an enemy ship probably teleports: mirror of our own warp scoring from
 * the enemy's perspective — center control, safety from our fire, and attack
 * posture toward our Command Center. Omniscient by design (mechas see ships
 * board-wide; validation never required visibility). Sorted best-first,
 * lexicographic tie-break for determinism.
 */
export const predictEnemyWarpDestinations = (
  ctx: AdjutantCtx,
  ship: Square,
): Square[] => {
  const { map, snap, us, enemy, king, weights } = ctx;
  const holder = map.get(ship);
  if (!holder || holder.type !== "q" || holder.color !== enemy) return [];
  const underFire = isSquareAttackedBy(map, ship, us);
  const probe = new Map(map);
  probe.delete(ship);
  const scored: { to: Square; s: number }[] = [];
  for (let f = 0; f < 8; f += 1) {
    for (let r = 1; r <= 8; r += 1) {
      const to = `${FILES[f]}${r}` as Square;
      if (map.has(to)) continue;
      if (hostileMineOn(snap.mines, enemy, to)) continue;
      // Landing safety on the board WITHOUT the queen: isSafeSquare couples
      // emptiness with attack cover, so the queen must be off `to` first
      // (attack rays from `to` are unaffected — the queen sits on `to`).
      probe.delete(to);
      const safe = isSafeSquare(probe, to, us);
      let s = weights.center * centerScore(to);
      if (underFire) s += safe ? weights.trade * 2 : -weights.trade * 2;
      else if (safe) s += weights.trade;
      probe.set(to, { type: "q", color: enemy });
      const menacesKing =
        attacksSquare(probe, to, king) || chebyshev(to, king) === 1;
      probe.delete(to);
      if (menacesKing) s += QUEEN_WARP_CHECK_CC * 0.5;
      scored.push({ to, s });
    }
  }
  scored.sort((a, b) => b.s - a.s || (a.to < b.to ? -1 : a.to > b.to ? 1 : 0));
  return scored.map((e) => e.to);
};

/**
 * Two-mode Charon ship-hunt. Pre-jump (`!enemyCanJump`): B insta-targets at
 * killable first-ships — near-guaranteed since B resolves before either
 * classical and the enemy cannot afford the jump that would vacate the square.
 * Post-jump: F guesses at predicted teleport destinations, committed via C+F
 * stacks (the mecha stays put so `from` is stable across the classical).
 */
const charonStrikes = (ctx: AdjutantCtx): Candidate[] => {
  const { map, snap, us, enemy, weights } = ctx;
  const out: Candidate[] = [];
  const base = weights.trade * (1 + UNIT_COST.q - UNIT_COST.b);

  if (!enemyCanJump(snap, enemy)) {
    for (const [from, piece] of map) {
      if (piece.color !== us || piece.type !== "b") continue;
      for (const target of charonTargetShips(map, from)) {
        out.push(
          asCandidate(
            { timing: "B", kind: "bishopSnipe", color: us, from, to: target },
            base + CHARON_INSTA,
          ),
        );
      }
    }
    return out;
  }

  let total = 0;
  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "b") continue;
    const diagonals = new Set(charonDiagonalSquares(map, from));
    for (const [shipSq, shipPiece] of map) {
      if (shipPiece.color !== enemy || shipPiece.type !== "q") continue;
      // First 3 predictions that survive aim + kill filters (slice AFTER
      // filtering — a top-3 that sits off-ray must not discard a killable 4th).
      // Iteration is deterministic (placement order); the global cap below can
      // starve late pairs only in ship-dense endgames — accepted, documented.
      let perShip = 0;
      for (const dest of predictEnemyWarpDestinations(ctx, shipSq)) {
        if (perShip >= CHARON_MAX_GUESSES_PER_SHIP) break;
        if (total >= CHARON_MAX_GUESSES_TOTAL) return out;
        // Queue-time free aim + predicted-board kill check: the ship lands on
        // our diagonal with nothing screening it.
        if (!diagonals.has(dest)) continue;
        const probe = new Map(map);
        probe.delete(shipSq);
        probe.set(dest, { type: "q", color: enemy });
        if (charonStrikeTarget(probe, from, dest, us) !== dest) continue;
        perShip += 1;
        total += 1;
        out.push(
          asCandidate(
            { timing: "F", kind: "bishopSnipe", color: us, from, to: dest },
            base + CHARON_GUESS * CHARON_GUESS_HIT_RATE,
          ),
        );
      }
    }
  }
  return out;
};

const score = (ev: MoveEval, ctx: AdjutantCtx): number => {
  const { move, piece, isKingMove } = ev;
  if (isKingMove || !move.capture) return 0;

  const { tactical, material, weights, enemy, enemyKing, snap } = ctx;
  const { trade } = weights;
  let s = 0;

  const victimValue = UNIT_COST[move.capture.type];
  const attackerValue = UNIT_COST[piece.type];

  if (move.capture.type === "p") {
    const after = ev.after();
    const deployDefends = deployCovers(
      {
        map: after,
        mines: snap.mines,
        color: enemy,
        cc: enemyKing,
        gas: snap.gasIncome[enemy],
        minerals: ctx.storedFor(enemy) + incomeForTurn(snap.turn + 1),
      },
      move.to,
    );
    const nearCC = enemyKing != null && chebyshev(move.to, enemyKing) === 1;
    const keepsCCUnderFire =
      enemyKing != null && attacksSquare(after, move.to, enemyKing);
    const givesUnitForCC = (deployDefends || nearCC) && keepsCCUnderFire;

    const undefended = !tactical.enemyAttacks(move.to) && !deployDefends && !nearCC;
    if (undefended) s += HUNT_UNDEFENDED_PAWN;
    else if (material.congested) s += HUNT_UNDEFENDED_PAWN * 0.35;
    if (material.congested && piece.type === "p") s += PAWN_TRADE;
    if (givesUnitForCC) s += ctx.winning ? SAC_FOR_CC_WINNING : SAC_FOR_CC;
  }

  if (victimValue === attackerValue) {
    // Same material — always attack.
    s += EQUAL_TRADE_ATTACK;
  } else if (victimValue > attackerValue) {
    s += trade * (1 + (victimValue - attackerValue));
  } else {
    // Bad trade — only slightly tempting unless it also saves us.
    s += trade * 0.25;
  }

  // Prefer capturing onto a square we already protect.
  if (tactical.friendlyProtects(move.to)) s += trade * 0.35;

  return s;
};

export const captures: Strategy = {
  id: "captures",
  generate: charonStrikes,
  score,
};
