/**
 * Captures — taking material, and the Charon strike that removes a BattleShip
 * without moving the Mecha.
 *
 * Trade policy: equal material is always worth taking; up-trades scale with the
 * gap; down-trades stay barely tempting so they only win when another concern
 * (survival, checks) is already paying for the move.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
 */

import type { Square } from "chess.js";

import { charonTargetQueenFromPlacement } from "../../rules/specials/bishopCharon";
import { UNIT_COST } from "../../rules/constants";
import { attacksSquare, type ScPiece } from "../../board/placement";
import { hostileMineOn } from "../../board/mine-contact";
import { neighbors } from "../context";
import type { AdjutantCtx, Candidate, MoveEval } from "../context";
import type { StrategicCtx } from "../strategic/context";
import { asCandidate, type Strategy } from "./types";

/** Equal-material capture when in range — always take the trade. */
export const EQUAL_TRADE_ATTACK = 2_400;
/** Congested / always: take an undefended enemy marine. */
export const HUNT_UNDEFENDED_PAWN = 950;
/** Congested: trade marine-for-marine to clear clutter. */
export const PAWN_TRADE = 750;
/** Charon (B) then a second unit still strikes in the same turn. */
export const CHARON_COMBO = 2_500;

/** Charon missiles at a unique diagonal enemy battleship (2 gas). */
const charonStrikes = (ctx: AdjutantCtx): Candidate[] => {
  const { map, snap, us, weights } = ctx;
  const out: Candidate[] = [];

  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "b") continue;
    const target = charonTargetQueenFromPlacement(snap.placement, from);
    if (!target) continue;
    out.push(
      asCandidate(
        { timing: "B", kind: "bishopSnipe", color: us, from, to: target },
        weights.trade * (1 + UNIT_COST.q - UNIT_COST.b) + CHARON_COMBO * 0.35,
      ),
    );
  }
  return out;
};

/**
 * Can the defender use gas to deploy a Marine/Hoverbike adjacent to their CC
 * that would recapture `target`? If so, `target` is gas-defended, not truly undefended.
 */
const canGasDeployDefend = (
  ctx: AdjutantCtx,
  target: Square,
): boolean => {
  const defender = ctx.enemy;
  const snap = ctx.snap;
  const map = ctx.map;
  const defenderGas = snap.gas?.[defender] ?? 0;
  if (defenderGas < 1) return false;
  let defenderCC: Square | null = null;
  for (const [sq, p] of map) if (p.type === "k" && p.color === defender) { defenderCC = sq; break; }
  if (!defenderCC) return false;
  for (const at of neighbors(defenderCC)) {
    if (map.has(at) || hostileMineOn(snap.mines, defender, at)) continue;
    const tmpP = new Map(map);
    tmpP.set(at, { type: "p", color: defender });
    if (attacksSquare(tmpP, at, target)) return true;
    const tmpN = new Map(map);
    tmpN.set(at, { type: "n", color: defender });
    if (attacksSquare(tmpN, at, target)) return true;
  }
  return false;
};

const hasCcIntel = (ctx: AdjutantCtx): ctx is StrategicCtx =>
  "ccIntel" in ctx;

const hasIntel = (ctx: AdjutantCtx): ctx is AdjutantCtx & { intel: { focus: Square } } =>
  "intel" in ctx;

const getCCFocus = (ctx: AdjutantCtx): Square | null => {
  if (hasCcIntel(ctx) && ctx.ccIntel?.focus) return ctx.ccIntel.focus;
  if (hasIntel(ctx) && ctx.intel?.focus) return ctx.intel.focus;
  return ctx.enemyKing;
};

const isStrategicCtx = (ctx: AdjutantCtx): ctx is StrategicCtx =>
  "kvs" in ctx && "winning" in ctx;

const attacksCCAfterMove = (ev: MoveEval, ctx: AdjutantCtx): boolean => {
  const after = ev.after();
  const cc = getCCFocus(ctx);
  if (!cc) return false;
  return attacksSquare(after, ev.move.to, cc);
};

const score = (ev: MoveEval, ctx: AdjutantCtx): number => {
  const { move, piece, isKingMove } = ev;
  if (isKingMove || !move.capture) return 0;

  const { tactical, material, weights } = ctx;
  const { trade } = weights;
  let s = 0;

  const victimValue = UNIT_COST[move.capture.type];
  const attackerValue = UNIT_COST[piece.type];

  const isGasDefended = canGasDeployDefend(ctx, move.to);
  const attacksCC = attacksCCAfterMove(ev, ctx);
  const ccFocus = getCCFocus(ctx);
  const isAdjacentToCC = ccFocus ? Math.max(Math.abs(move.to.charCodeAt(0) - ccFocus.charCodeAt(0)), Math.abs(Number(move.to[1]) - Number(ccFocus[1]))) === 1 : false;
  const isBestDefense = isAdjacentToCC; // any square adjacent to CC has best defense (CC attacks it, gas can reinforce)
  const isSacrificeForCC = (isGasDefended || isBestDefense) && attacksCC;
  const isWinningForCC = isStrategicCtx(ctx) ? ctx.winning : false;

  if (move.capture.type === "p") {
    const undefended = !tactical.enemyAttacks(move.to) && !isGasDefended && !isBestDefense;
    if (undefended) s += HUNT_UNDEFENDED_PAWN;
    else if (material.congested) s += HUNT_UNDEFENDED_PAWN * 0.35;
    if (material.congested && piece.type === "p") s += PAWN_TRADE;
    if (isSacrificeForCC && isWinningForCC) s += 1_800; // bottom-tier sacrifice, only worth when ahead to check/damage CC
    else if (isSacrificeForCC) s += 400; // small bonus even when not winning, but not as good as c2 check
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
