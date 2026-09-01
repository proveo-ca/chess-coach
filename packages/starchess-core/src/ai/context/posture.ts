// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Posture resolution and the contextual weight table.
 *
 * Postures recompute every turn from hub control + fog intel:
 *  - expand — no hub yet → map control (siege / mines / diagonals)
 *  - seek   — hub held, enemy Command Center (CC) fogged → find the Command Center (CC) from hints
 *  - hunt   — hub held + enemy Command Center (CC) visible → attack Command Center (CC) is #1 (aggressive)
 *
 * These weights are the only dial the orchestrator turns: strategies read them
 * from the context and never hard-code a posture branch of their own.
 */

import type { Posture, StrategyWeights } from "./types";

export const WEIGHTS: Record<Posture, StrategyWeights> = {
  /** No hub yet — take the centre before anything else. */
  expand: {
    siegeHub: 1_200,
    mapControl: 800,
    diagonal: 400,
    promoteRank: 0,
    promotionBonus: 0,
    attackKing: 0,
    chaseKing: 0,
    seekFocus: 0,
    center: 50,
    trade: 100,
    attackedPenalty: 400,
  },
  /**
   * Hub held, Command Center (CC) fogged — find the Command Center (CC). Promote is secondary to scouting
   * toward deploy / marine-file cues (and siege vision that would reveal them).
   */
  seek: {
    siegeHub: 950,
    mapControl: 480,
    diagonal: 360,
    promoteRank: 60,
    promotionBonus: 420,
    attackKing: 0,
    chaseKing: 0,
    seekFocus: 700,
    center: 30,
    trade: 100,
    attackedPenalty: 400,
  },
  /** Hub held + Command Center (CC) visible — aggressive: attack Command Center (CC) outranks promote/control. */
  hunt: {
    siegeHub: 180,
    mapControl: 140,
    diagonal: 280,
    promoteRank: 100,
    promotionBonus: 700,
    attackKing: 3_500,
    chaseKing: 450,
    seekFocus: 0,
    center: 25,
    trade: 120,
    attackedPenalty: 400,
  },
};

export const resolvePosture = (
  hubHeld: boolean,
  enemyKingVisible: boolean,
): Posture => {
  if (!hubHeld) return "expand";
  if (enemyKingVisible) return "hunt";
  return "seek";
};
