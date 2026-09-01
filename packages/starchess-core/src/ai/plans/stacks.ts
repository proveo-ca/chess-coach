// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Plan composition — same-turn B+C packages.
 *
 * Composition is deliberately not a strategy: every stack pairs a plan one
 * concern proposed with a move another concern scored, so it belongs to the
 * orchestration layer that can see both.
 */

import type { Square } from "chess.js";

import { isSquareAttackedBy, parseSquare, type ScPiece } from "../../board/placement";
import { scMovesFor, type ScMove } from "../../board/moves";
import { UNIT_COST } from "../../rules/constants";
import { specialGasCost } from "../../scfen";
import { pawnSingleTarget } from "../../rules/specials/pawnDouble";
import type { ScSpecialKind, SpawnPiece } from "../../model/types";
import type { AdjutantCtx, Candidate, Move } from "../context";
import { isLastRank, isSafeSquare, rankOf } from "../context";
import { CHARON_COMBO, EQUAL_TRADE_ATTACK } from "../strategies/captures";
import { DEPLOY_ATTACK_SURVIVAL, QUEEN_ESCAPE } from "../strategies/survival";
import { scoreMove } from "../strategies";

/** Classical candidates from the shared SC movegen (filter command center (CC)-square traps). */
export const sideMoves = (ctx: AdjutantCtx): Move[] =>
  scMovesFor(ctx.map, ctx.us, { siegedRooks: ctx.sieged })
    .filter((m: ScMove) => !m.dropsAtResolve)
    .map((m) => ({
      from: m.from,
      to: m.to,
      capture: m.capture,
      firesInPlace: m.firesInPlace,
      ...(m.promotion ? { promotion: m.promotion } : {}),
    }));

/**
 * Gas canister + same-forward classical on a marine (UI stack form).
 * `endScTurn.rewriteClassicalAfterB` expands B from→mid + C from→mid into
 * C mid→far, so the marine resolves two steps ahead. Skip when a free classical
 * double to `far` already exists.
 */
export const pawnGasStacks = (
  ctx: AdjutantCtx,
  moves: readonly Move[],
): Candidate[] => {
  const { map, us, gas, weights } = ctx;
  if (specialGasCost("pawnDouble") > gas) return [];
  const out: Candidate[] = [];

  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "p") continue;
    const mid = pawnSingleTarget(from, us);
    if (!mid || map.has(mid) || isLastRank(rankOf(mid), us)) continue;
    const far = pawnSingleTarget(mid, us);
    if (!far || map.has(far)) continue;
    if (moves.some((m) => m.from === from && m.to === far)) continue;

    const promotion: SpawnPiece | undefined = isLastRank(rankOf(far), us)
      ? "q"
      : undefined;
    const synthetic: Move = {
      from,
      to: far,
      capture: null,
      ...(promotion ? { promotion } : {}),
    };
    let score = scoreMove(synthetic, ctx) + weights.trade;
    // Marine gas + attack: if the doubly-stepped marine at `far` attacks a higher-value
    // enemy piece, boost to knock it out (e.g. pawnDouble to d4 then capture e5 tank)
    const pawnAtFarAttacksHigher = (() => {
      const dir = us === "w" ? 1 : -1;
      const { file, rank } = parseSquare(far);
      const attackRanks = [rank + dir];
      const attackFiles = [file - 1, file + 1];
      for (const af of attackFiles) {
        for (const ar of attackRanks) {
          const sq = `${String.fromCharCode(96 + af)}${ar}` as Square;
          const victim = map.get(sq);
          if (victim && victim.color === ctx.enemy && UNIT_COST[victim.type] > UNIT_COST.p) {
            return victim;
          }
        }
      }
      return null;
    })();
    if (pawnAtFarAttacksHigher) {
      score += weights.trade * (1 + UNIT_COST[pawnAtFarAttacksHigher.type] - UNIT_COST.p);
    }
    out.push({
      actions: [
        { timing: "B", kind: "pawnDouble", color: us, from, to: mid },
        {
          timing: "C",
          kind: "classical",
          color: us,
          from,
          to: mid,
          ...(promotion ? { promotion } : {}),
        },
      ],
      // Two-step stack beats a lone gas step; near-promote rush (≤2 steps)
      // lands via scoreMove on the far square. Extra trade tie-break.
      score,
    });
  }
  return out;
};

/**
 * Command Center spawn (B) + any classical (C) in the same turn.
 * Planning validates each action on the pre-B board, so a classical `to` that
 * equals the spawn square must be dropped — after B that tile is occupied by
 * our own unit and the Command Center (CC) (or other mover) would bounce / no-op.
 */
export const spawnStacks = (
  specials: readonly Candidate[],
  moveCandidates: readonly Candidate[],
): Candidate[] => {
  const out: Candidate[] = [];
  for (const spawn of specials) {
    const spawnAction = spawn.actions[0];
    if (!spawnAction || spawnAction.kind !== "spawn" || !spawnAction.to) continue;
    for (const move of moveCandidates) {
      const moveAction = move.actions[0];
      if (!moveAction || moveAction.timing !== "C" || moveAction.kind !== "classical") {
        continue;
      }
      if (moveAction.to === spawnAction.to) continue;
      out.push({
        actions: [spawnAction, moveAction],
        score: spawn.score + move.score,
        ...(spawn.spendMinerals != null
          ? { spendMinerals: spawn.spendMinerals }
          : {}),
      });
    }
  }
  return out;
};

/**
 * Spawn (B) then classical (C) **from the newly deployed unit**.
 * Validation accepts C.from === spawn.to once B is queued — this is the
 * deploy+attack survival line (e.g. drop a tank that takes the back-rank checker).
 */
export const spawnCaptureStacks = (
  specials: readonly Candidate[],
  ctx: AdjutantCtx,
): Candidate[] => {
  const { map, us, enemy, sieged, tactical, weights } = ctx;
  const { trade } = weights;
  const out: Candidate[] = [];

  for (const spawn of specials) {
    const spawnAction = spawn.actions[0];
    if (
      !spawnAction ||
      spawnAction.kind !== "spawn" ||
      !spawnAction.to ||
      !spawnAction.unit
    ) {
      continue;
    }
    const after: Map<Square, ScPiece> = new Map(map);
    after.set(spawnAction.to, { type: spawnAction.unit, color: us });
    const from = spawnAction.to;

    for (const m of scMovesFor(after, us, { siegedRooks: sieged })) {
      if (m.dropsAtResolve || m.from !== from) continue;
      // Deploy+attack is about capturing the threat / winning material.
      if (!m.capture || m.capture.color !== enemy) continue;

      let score = spawn.score + trade * (1 + UNIT_COST[m.capture.type]);
      // Deploy+attack survival — only when taking a unit that is checking us now
      // (not a distant one-ply threat; that is Command Center (CC) back-rank escape's job).
      const takesChecker = tactical.checkers.has(m.to);
      const equalOrBetter =
        UNIT_COST[m.capture.type] >= UNIT_COST[spawnAction.unit];
      if (takesChecker) {
        score += DEPLOY_ATTACK_SURVIVAL;
        if (spawnAction.unit === "r" && m.capture.type === "r") {
          score += EQUAL_TRADE_ATTACK;
        } else if (equalOrBetter) {
          score += EQUAL_TRADE_ATTACK * 0.5;
        }
      } else if (equalOrBetter) {
        score += EQUAL_TRADE_ATTACK;
      }

      out.push({
        actions: [
          spawnAction,
          {
            timing: "C",
            kind: "classical",
            color: us,
            from,
            to: m.to,
            ...(m.promotion ? { promotion: m.promotion } : {}),
          },
        ],
        score,
        ...(spawn.spendMinerals != null
          ? { spendMinerals: spawn.spendMinerals }
          : {}),
      });
    }
  }
  return out;
};

/**
 * Same-turn gas special (B) + classical (C).
 * Charon burns 2 gas then a second unit still strikes; Hoverbike mines then hops;
 * threatened BattleShip warps then another unit develops.
 */
export const specialClassicalStacks = (
  specials: readonly Candidate[],
  moveCandidates: readonly Candidate[],
  ctx: AdjutantCtx,
): Candidate[] => {
  const { map, enemy, gas, weights } = ctx;
  const out: Candidate[] = [];

  for (const special of specials) {
    const b = special.actions[0];
    if (!b || b.timing !== "B") continue;
    if (b.kind === "spawn" || b.kind === "pawnDouble") continue;
    if (specialGasCost(b.kind as ScSpecialKind) > gas) continue;

    for (const move of moveCandidates) {
      const c = move.actions[0];
      if (!c || c.timing !== "C" || c.kind !== "classical") continue;
      // Cannot relocate a tank in the same breath as packing.
      if (b.kind === "rookSiege" && c.from === b.from) continue;

      let score = special.score + move.score;
      if (b.kind === "bishopSnipe") {
        // The Mecha stays put after Charon, so any second classical is fine.
        score += CHARON_COMBO;
        if (c.to && map.get(c.to)?.color === enemy) score += weights.trade * 2;
      }
      if (b.kind === "knightMine" && c.from === b.from) {
        // Plant then leave — deny the Hoverbike sitting on its own mine tile.
        score += weights.mapControl;
      }
      if (b.kind === "queenWarp") {
        // A classical from the warped square is rewritten to the destination.
        const underFire = isSquareAttackedBy(map, b.from, enemy);
        if (underFire && b.to && isSafeSquare(map, b.to, enemy)) {
          score += QUEEN_ESCAPE * 0.15;
        }
      }

      out.push({ actions: [b, c], score });
    }
  }
  return out;
};
