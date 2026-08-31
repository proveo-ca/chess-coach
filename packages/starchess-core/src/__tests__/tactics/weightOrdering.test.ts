/**
 * Weight ordering — the relative-rank invariants the scoring ensemble relies on.
 *
 * The scoring strategies each return a number and the orchestrator sums them, so
 * what actually decides a move is the *ordering* of the tiers, not their
 * absolute size. That ordering used to be asserted in prose next to the
 * constants ("must outrank mapControl (e2 5104 vs c2 102)"), where nothing
 * checked it and a retune could silently invert it. It is asserted here instead.
 * // SPEC: _spec/apps/starchess/core/adjutant/weight-ladder.puml
 */
import { describe, expect, it } from "vitest";

import {
  CHARON_COMBO,
  EQUAL_TRADE_ATTACK,
  HUNT_UNDEFENDED_PAWN,
  PAWN_TRADE,
  SAC_FOR_CC,
  SAC_FOR_CC_WINNING,
} from "../../ai/strategies/captures";
import { PAWN_CHECK_CC, SNEAK_KNIGHT_CHECK } from "../../ai/strategies/checks";
import {
  BACKRANK_ESCAPE,
  DEFEND_UNIT,
  DEPLOY_ATTACK_SURVIVAL,
  KING_SAFETY,
  QUEEN_ESCAPE,
  QUEEN_THREAT_KING,
  QUEEN_WARP_CHECK_CC,
} from "../../ai/strategies/survival";
import { NEAR_PROMOTE_RUSH } from "../../ai/strategies/mapControl";
import {
  ATTACK_KING_GUESS,
  CHASE_KING_GUESS,
  PAWN_CHECK_CC_GUESS,
  PAWN_CHECK_CC_SEEN,
  SNEAK_KNIGHT_CHECK_GUESS,
  SNEAK_KNIGHT_CHECK_SEEN,
} from "../../ai/strategic/strategies/checks";

describe("survival dominates", () => {
  it("nothing a tactical concern offers outranks keeping the Command Center alive", () => {
    for (const w of [
      EQUAL_TRADE_ATTACK,
      CHARON_COMBO,
      HUNT_UNDEFENDED_PAWN,
      PAWN_TRADE,
      SAC_FOR_CC,
      SAC_FOR_CC_WINNING,
      PAWN_CHECK_CC,
      SNEAK_KNIGHT_CHECK,
      QUEEN_WARP_CHECK_CC,
      NEAR_PROMOTE_RUSH,
      ATTACK_KING_GUESS,
      CHASE_KING_GUESS,
    ]) {
      expect(w).toBeLessThan(KING_SAFETY);
    }
  });

  it("deploy+attack outranks a bare Command Center flee", () => {
    expect(DEPLOY_ATTACK_SURVIVAL).toBeGreaterThan(KING_SAFETY);
    expect(BACKRANK_ESCAPE).toBeLessThan(DEPLOY_ATTACK_SURVIVAL);
  });

  it("saving the BattleShip outranks saving an ordinary unit", () => {
    expect(QUEEN_ESCAPE).toBeGreaterThan(DEFEND_UNIT);
    expect(QUEEN_THREAT_KING).toBeLessThan(QUEEN_ESCAPE);
  });
});

describe("Command Center pressure outranks map control", () => {
  /**
   * The invariant the deleted comment asserted: a Marine check on the CC has to
   * beat the best quiet mapControl square, or the Adjutant prefers e2 to c2+check.
   *
   * Asserted on the EFFECTIVE weight, not the bare constant. In
   * `strategic/strategies/checks.ts` a check stacks its per-piece block on top of
   * the `attackWeight` block — both test `attacksSquare(after, move.to,
   * targetKing)` — so no piece-check constant is ever scored alone. A ladder
   * built from bare constants would be false assurance.
   */
  const effectiveGuessedPawnCheck = PAWN_CHECK_CC_GUESS + ATTACK_KING_GUESS;

  it("a Marine check on the guessed CC outranks the promotion rush", () => {
    expect(effectiveGuessedPawnCheck).toBeGreaterThan(NEAR_PROMOTE_RUSH);
  });

  it("even the un-stacked constant clears the rush, so the ordering survives de-stacking", () => {
    // Guards the follow-up question of whether the two blocks should be made
    // mutually exclusive: the invariant must hold either way.
    expect(PAWN_CHECK_CC_GUESS).toBeGreaterThanOrEqual(NEAR_PROMOTE_RUSH);
  });

  it("a sneak check outranks an equal-material trade", () => {
    expect(SNEAK_KNIGHT_CHECK_GUESS).toBeGreaterThan(EQUAL_TRADE_ATTACK);
    expect(SNEAK_KNIGHT_CHECK_SEEN).toBeGreaterThan(EQUAL_TRADE_ATTACK);
  });

  it("the strategic sneak check is the stronger of the two builds", () => {
    // The naive weight is deliberately lower — the strategic Adjutant is the
    // one that is supposed to drive at the Command Center.
    expect(SNEAK_KNIGHT_CHECK_SEEN).toBeGreaterThan(SNEAK_KNIGHT_CHECK);
  });
});

describe("giving up material for Command Center pressure is bottom-tier", () => {
  it("ranks below an equal trade either way", () => {
    expect(SAC_FOR_CC_WINNING).toBeLessThan(EQUAL_TRADE_ATTACK);
    expect(SAC_FOR_CC).toBeLessThan(SAC_FOR_CC_WINNING);
  });

  it("is worth more while ahead than while level", () => {
    expect(SAC_FOR_CC_WINNING).toBeGreaterThan(SAC_FOR_CC);
  });

  it("never outranks simply taking a free Marine while level", () => {
    expect(SAC_FOR_CC).toBeLessThan(HUNT_UNDEFENDED_PAWN);
  });
});

describe("a fogged guess is never scored above a seen Command Center", () => {
  it("holds for every guess/seen pair", () => {
    expect(SNEAK_KNIGHT_CHECK_GUESS).toBeLessThanOrEqual(SNEAK_KNIGHT_CHECK_SEEN);
    expect(PAWN_CHECK_CC_GUESS).toBeLessThanOrEqual(PAWN_CHECK_CC_SEEN);
  });
});
