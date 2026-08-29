/**
 * Survival — keeping the Command Center (and the BattleShip) alive.
 *
 * Owns the absolute weights: nothing the other strategies can offer outranks
 * a King that stays off a chip-capable ray. Also owns the Tactical Jump escape
 * and the "walk out of fire" defence for ordinary units.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
 */

import type { Square } from "chess.js";

import { isSquareAttackedBy, parseSquare } from "../../board/placement";
import { hostileMineOn } from "../../board/mine-contact";
import type { AdjutantCtx, Candidate, MoveEval } from "../context";
import { FILES, centerScore, isSafeSquare, rankOf } from "../context";
import { asCandidate, type Strategy } from "./types";

/** Absolute — never posture-scaled. */
export const KING_SAFETY = 10_000;
export const QUEEN_ESCAPE = 8_000;
/**
 * Spawn a unit then capture the back-rank / checking threat with that same unit.
 * Above mere King flee — material win + survival (deploy + attack).
 */
export const DEPLOY_ATTACK_SURVIVAL = KING_SAFETY + 3_500;
/**
 * Step the King off its back rank when a file-rook (or similar) threatens check.
 * Below deploy+attack; above quiet development.
 */
export const BACKRANK_ESCAPE = 4_500;
/** Flee a threatened non-queen to a safe square (defend). */
export const DEFEND_UNIT = 1_800;
/** Visible enemy queen — prefer safe King moves / flee over hanging. */
export const QUEEN_THREAT_KING = 1_500;

/** Tactical Jump — prioritise escaping fire to a safe square. */
const queenWarps = (ctx: AdjutantCtx): Candidate[] => {
  const { map, snap, us, enemy, weights } = ctx;
  const out: Candidate[] = [];

  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "q") continue;
    const underFire = isSquareAttackedBy(map, from, enemy);
    for (let f = 0; f < 8; f += 1) {
      for (let r = 1; r <= 8; r += 1) {
        const to = `${FILES[f]}${r}` as Square;
        if (map.has(to)) continue;
        // Mined tiles stay legal landings, but the jump is no attack — a hostile
        // mine detonates on arrival and takes the BattleShip with it.
        if (hostileMineOn(snap.mines, us, to)) continue;
        let score = weights.center * centerScore(to);
        if (underFire) {
          score += isSafeSquare(map, to, enemy)
            ? QUEEN_ESCAPE
            : -QUEEN_ESCAPE * 0.5;
        } else if (isSafeSquare(map, to, enemy)) {
          score += weights.trade;
        }
        out.push(
          asCandidate({ timing: "B", kind: "queenWarp", color: us, from, to }, score),
        );
      }
    }
  }
  return out;
};

const score = (ev: MoveEval, ctx: AdjutantCtx): number => {
  const { move, piece, isKingMove } = ev;
  const { king, kingThreatened, tactical, us, weights, vision } = ctx;
  let s = 0;

  if (isKingMove) {
    // Evaluate the destination on the POST-move board: the King itself can be
    // the piece blocking the checking ray, so sliding along that ray looks safe
    // on the pre-move map but stays in check.
    const destSafe = ev.destSafe();
    if (kingThreatened) {
      s += KING_SAFETY * (destSafe ? 1 : -1);
    } else if (!destSafe) {
      // No intrinsic value in strolling an unthreatened King: an idle bonus here
      // would outrank every real action. Only punish walking into fire.
      s -= KING_SAFETY;
    }
    // Visible enemy queen — protect the King (flee to safety / avoid hang).
    if (vision.enemyQueenVisible) {
      s += destSafe
        ? QUEEN_THREAT_KING * (kingThreatened ? 2 : 1)
        : -QUEEN_THREAT_KING;
    }
    // Enemy can check next hop — prefer leaving the hot square / staying safe.
    if (tactical.enemyThreatensCheck && destSafe) s += QUEEN_THREAT_KING * 0.35;
    // Back-rank cheese: step to the rank in front (e.g. e8→e7) when threatened.
    if (destSafe && (kingThreatened || tactical.enemyThreatensCheck)) {
      const backRank = us === "b" ? 8 : 1;
      const frontRank = us === "b" ? 7 : 2;
      if (rankOf(move.from) === backRank && rankOf(move.to) === frontRank) {
        s += BACKRANK_ESCAPE;
      }
    }
    return s;
  }

  // Engagement — already in range of an enemy unit: attack vs defend.
  if (tactical.enemyAttacks(move.from)) {
    if (ev.destSafe()) {
      // Queen that can be saved — defend (classical flee; warp scored above).
      s += piece.type === "q" ? QUEEN_ESCAPE * 0.4 : DEFEND_UNIT;
    } else if (!move.capture) {
      // Walking from fire into fire — worse than hanging still.
      s -= DEFEND_UNIT * 0.5;
    }
  }

  // Cheap king-centred shelter: a square adjacent to the King keeps him protected.
  if (piece.type === "p") {
    const { file: kFile, rank: kRank } = parseSquare(king);
    const { file, rank } = parseSquare(move.to);
    if (Math.abs(file - kFile) <= 1 && Math.abs(rank - kRank) <= 1) {
      s += weights.trade;
    }
  }

  return s;
};

export const survival: Strategy = {
  id: "survival",
  generate: queenWarps,
  score,
};
