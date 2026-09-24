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
import { marineSingleTarget } from "../../rules/specials/stimStep";
import type { ScSpecialKind, SpawnPiece } from "../../model/types";
import type { AdjutantCtx, Candidate, Move } from "../context";
import { isLastRank, isSafeSquare, rankOf } from "../context";
import { CHARON_COMBO, EQUAL_TRADE_ATTACK } from "../strategies/captures";
import { DEPLOY_ATTACK_SURVIVAL, BATTLESHIP_ESCAPE } from "../strategies/survival";
import { scoreMove } from "../strategies";

/** Classical candidates from the shared SC movegen (filter command center (CC)-square traps). */
export const sideMoves = (ctx: AdjutantCtx): Move[] =>
  scMovesFor(ctx.map, ctx.us, { siegedTanks: ctx.sieged })
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
export const marineGasStacks = (
  ctx: AdjutantCtx,
  moves: readonly Move[],
): Candidate[] => {
  const { map, us, gas, weights } = ctx;
  if (specialGasCost("stimStep") > gas) return [];
  const out: Candidate[] = [];

  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "p") continue;
    const mid = marineSingleTarget(from, us);
    if (!mid || map.has(mid) || isLastRank(rankOf(mid), us)) continue;
    const far = marineSingleTarget(mid, us);
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
    // enemy piece, boost to knock it out (e.g. stimStep to d4 then capture e5 tank)
    const marineAtFarAttacksHigher = (() => {
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
    if (marineAtFarAttacksHigher) {
      score += weights.trade * (1 + UNIT_COST[marineAtFarAttacksHigher.type] - UNIT_COST.p);
    }
    out.push({
      actions: [
        { timing: "B", kind: "stimStep", color: us, from, to: mid },
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
    if (!spawnAction || spawnAction.kind !== "deploy" || !spawnAction.to) continue;
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
      spawnAction.kind !== "deploy" ||
      !spawnAction.to ||
      !spawnAction.unit
    ) {
      continue;
    }
    const after: Map<Square, ScPiece> = new Map(map);
    after.set(spawnAction.to, { type: spawnAction.unit, color: us });
    const from = spawnAction.to;

    for (const m of scMovesFor(after, us, { siegedTanks: sieged })) {
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
 * True when `mid` lies strictly between `from` and `to` on their diagonal.
 * Own classical landing there would screen (or occupy) the Charon aim.
 */
const screensCharonAim = (from: Square, to: Square, mid: Square): boolean => {
  if (mid === from || mid === to) return mid === to;
  const a = parseSquare(from);
  const b = parseSquare(to);
  const m = parseSquare(mid);
  const df = Math.sign(b.file - a.file);
  const dr = Math.sign(b.rank - a.rank);
  if (df === 0 || dr === 0) return false;
  if (Math.abs(b.file - a.file) !== Math.abs(b.rank - a.rank)) return false;
  if (Math.abs(m.file - a.file) !== Math.abs(m.rank - a.rank)) return false;
  if (Math.sign(m.file - a.file) !== df || Math.sign(m.rank - a.rank) !== dr) {
    return false;
  }
  return Math.abs(m.file - a.file) < Math.abs(b.file - a.file);
};

/**
 * Classical partners paired per F guess — bounds C+F fan-out (guesses are
 * capped upstream; moves are not). The hunt should accompany sane development,
 * so partners come from the top of the scored move list.
 */
const CHARON_MAX_STACK_PARTNERS = 16;

/**
 * Second-phase Charon: F teleport-guess + classical in the same turn.
 * The mecha stays put (`C.from !== F.from` keeps `from` stable across the
 * classical, so queue-time validation and resolve agree). Drops pairs where
 * our own classical would move the mecha or occupy/screen the aim square
 * (landing on the firing mecha is never a legal classical anyway). Gas is
 * checked once (F Charon costs 2; the classical is free); scores add (the
 * guess discount is already inside the F single — no CHARON_COMBO on top).
 */
export const charonForwardStacks = (
  fGuesses: readonly Candidate[],
  moveCandidates: readonly Candidate[],
  ctx: AdjutantCtx,
): Candidate[] => {
  const { gas } = ctx;
  if (specialGasCost("charonMissiles") > gas) return [];
  const partners = [...moveCandidates]
    .filter((m) => {
      const c = m.actions[0];
      return !!c && c.timing === "C" && c.kind === "classical";
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, CHARON_MAX_STACK_PARTNERS);
  const out: Candidate[] = [];

  for (const guess of fGuesses) {
    const f = guess.actions[0];
    if (!f || f.timing !== "F" || f.kind !== "charonMissiles" || !f.to) continue;
    for (const move of partners) {
      const c = move.actions[0];
      if (!c || c.timing !== "C" || c.kind !== "classical") continue;
      if (c.from === f.from || c.to === f.from) continue;
      if (c.to === f.to || screensCharonAim(f.from, f.to, c.to)) continue;
      out.push({ actions: [c, f], score: guess.score + move.score });
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
    if (b.kind === "deploy" || b.kind === "stimStep") continue;
    if (specialGasCost(b.kind as ScSpecialKind) > gas) continue;

    for (const move of moveCandidates) {
      const c = move.actions[0];
      if (!c || c.timing !== "C" || c.kind !== "classical") continue;
      // Cannot relocate a tank in the same breath as packing.
      if (b.kind === "siegeMode" && c.from === b.from) continue;

      let score = special.score + move.score;
      if (b.kind === "charonMissiles") {
        // The Mecha stays put after Charon, so any second classical is fine.
        // The certainty premium already lives in the B single (CHARON_INSTA);
        // this combo prices the extra tempo only — effective stack order is
        // guarded by clearsCheck like every other stack, so no safety tier
        // is bypassed by the sum.
        score += CHARON_COMBO;
        if (c.to && map.get(c.to)?.color === enemy) score += weights.trade * 2;
      }
      if (b.kind === "spiderMine" && c.from === b.from) {
        // Plant then leave — deny the Hoverbike sitting on its own mine tile.
        score += weights.mapControl;
      }
      if (b.kind === "tacticalJump") {
        // A classical from the warped square is rewritten to the destination.
        const underFire = isSquareAttackedBy(map, b.from, enemy);
        if (underFire && b.to && isSafeSquare(map, b.to, enemy)) {
          score += BATTLESHIP_ESCAPE * 0.15;
        }
      }

      out.push({ actions: [b, c], score });
    }
  }
  return out;
};
