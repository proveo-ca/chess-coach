// SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml, _spec/apps/starchess/core/adjutant/cc-focus.puml
/**
 * Survival — strategic version. Only the Tactical Jump differs from naive: it
 * aims at the fogged Command Center guess rather than the true square.
 */

import type { Square } from "chess.js";

import { attacksSquare, isSquareAttackedBy } from "../../../board/placement";
import { hostileMineOn } from "../../../board/mine-contact";
import { FILES, centerScore, chebyshev, isSafeSquare } from "../../context";
import type { Candidate } from "../../context";
import {
  BATTLESHIP_ESCAPE,
  TACTICAL_JUMP_CHECK_CC,
  survival as naiveSurvival,
} from "../../strategies/survival";
import type { StrategicCtx } from "../context";
import { asCandidate } from "./types";
import type { StrategicStrategy } from "./types";

const tacticalJumps = (ctx: StrategicCtx): Candidate[] => {
  const { map, snap, us, enemy, enemyCC, weights, vision, ccIntel } = ctx;
  const out: Candidate[] = [];

  const isGuess = !vision.enemyCCVisible;
  const targetCC: Square | null = isGuess ? ccIntel.focus : enemyCC;
  const guessUsable = !isGuess || ccIntel.strength > 0;

  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "q") continue;
    const underFire = isSquareAttackedBy(map, from, enemy);
    const probe = new Map(map);
    probe.delete(from);
    for (let f = 0; f < 8; f += 1) {
      for (let r = 1; r <= 8; r += 1) {
        const to = `${FILES[f]}${r}` as Square;
        if (map.has(to)) continue;
        if (hostileMineOn(snap.mines, us, to)) continue;
        let score = weights.center * centerScore(to);
        if (underFire) {
          score += isSafeSquare(map, to, enemy) ? BATTLESHIP_ESCAPE : -BATTLESHIP_ESCAPE * 0.5;
        } else if (isSafeSquare(map, to, enemy)) {
          score += weights.trade;
        }
        if (targetCC && guessUsable) {
          probe.set(to, { type: "q", color: us });
          const checks = attacksSquare(probe, to, targetCC);
          probe.delete(to);
          if (checks || chebyshev(to, targetCC) === 1) score += TACTICAL_JUMP_CHECK_CC;
        }
        out.push(
          asCandidate({ timing: "B", kind: "tacticalJump", color: us, from, to }, score),
        );
      }
    }
  }
  return out;
};

export const survival: StrategicStrategy = {
  id: "survival",
  generate: tacticalJumps,
  score: naiveSurvival.score,
};
