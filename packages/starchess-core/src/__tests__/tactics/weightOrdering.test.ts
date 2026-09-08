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
  CHARON_GUESS,
  CHARON_GUESS_HIT_RATE,
  CHARON_INSTA,
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
  RUNNER_STOP_CRITICAL,
  RUNNER_STOP_SERIOUS,
  RUNNER_STOP_WATCH,
} from "../../ai/strategic/strategies/runners";
import {
  AVENGE_CC_SHOT,
  AVENGE_THRIFT,
} from "../../ai/strategic/strategies/attackers";
import {
  ALLY_SHIELD_PAWN,
  ALLY_SHIELD_SHIP,
  ALLY_UPGRADE,
} from "../../ai/strategic/strategies/economy";
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
      CHARON_INSTA,
      CHARON_GUESS,
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
      RUNNER_STOP_CRITICAL,
      RUNNER_STOP_SERIOUS,
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

  it("insta-target tops the Charon ladder, hotter guesses stay mid-tier", () => {
    // Effective terms: every Charon single carries base = trade*7, so pin the
    // ordering with an explicit trade floor rather than bare constants — a
    // trade retune must not silently invert the hunt tiers.
    const TRADE_FLOOR = 100;
    const base = TRADE_FLOOR * (1 + 9 - 3);
    expect(base + CHARON_INSTA).toBeGreaterThan(base + CHARON_COMBO);
    expect(base + CHARON_GUESS * CHARON_GUESS_HIT_RATE).toBeLessThan(QUEEN_ESCAPE);
    expect(base + CHARON_GUESS * CHARON_GUESS_HIT_RATE).toBeGreaterThan(SAC_FOR_CC);
    expect(CHARON_INSTA).toBeLessThan(BACKRANK_ESCAPE);
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

describe("the Command Center's own debts", () => {
  /**
   * Firing on a Command Center names the shooter, and the standing instruction
   * is to take it. The weight sits directly under `KING_SAFETY` — keeping the
   * CC out of fire still outranks avenging it, a live checker is still
   * survival's business through `DEPLOY_ATTACK_SURVIVAL`, and everything below
   * loses to the debt.
   */
  it("retaliation ranks under the Command Center's own safety", () => {
    expect(AVENGE_CC_SHOT).toBeLessThan(KING_SAFETY);
    expect(AVENGE_CC_SHOT).toBeLessThan(DEPLOY_ATTACK_SURVIVAL);
  });

  it("...and over every other concern the turn can offer", () => {
    for (const w of [
      RUNNER_STOP_CRITICAL,
      PAWN_CHECK_CC_SEEN,
      SNEAK_KNIGHT_CHECK_SEEN,
      ATTACK_KING_GUESS,
      EQUAL_TRADE_ATTACK,
      QUEEN_ESCAPE,
    ]) {
      expect(AVENGE_CC_SHOT).toBeGreaterThan(w);
    }
  });

  it("thrift picks the cheapest answer without ever refusing the job", () => {
    // Even spending a BattleShip, the debt still outranks the tier below it.
    expect(AVENGE_CC_SHOT - AVENGE_THRIFT * 9).toBeGreaterThan(RUNNER_STOP_CRITICAL);
  });
});

describe("an enemy runner sits between the check tier and the guess", () => {
  /**
   * The ordering the promotion-defense module is built on. A marine covers two
   * ranks a turn, so "one turn out" is the last turn on which any answer
   * exists — it therefore outranks a check we could repeat next turn, while
   * "two turns out" only has to beat speculation (`ATTACK_KING_GUESS` aims at a
   * *guessed* square) and ordinary material.
   */
  it("the last-chance tier outranks a check on the Command Center", () => {
    expect(RUNNER_STOP_CRITICAL).toBeGreaterThan(PAWN_CHECK_CC_SEEN);
    expect(RUNNER_STOP_CRITICAL).toBeGreaterThan(SNEAK_KNIGHT_CHECK_SEEN);
  });

  it("but never outranks saving the BattleShip, let alone the Command Center", () => {
    expect(RUNNER_STOP_CRITICAL).toBeLessThan(QUEEN_ESCAPE);
  });

  it("a runner two turns out beats aiming at a guessed Command Center", () => {
    expect(RUNNER_STOP_SERIOUS).toBeGreaterThan(ATTACK_KING_GUESS);
    expect(RUNNER_STOP_SERIOUS).toBeGreaterThan(EQUAL_TRADE_ATTACK);
  });

  it("...and still loses to a real check on it", () => {
    expect(RUNNER_STOP_SERIOUS).toBeLessThan(PAWN_CHECK_CC_GUESS);
    expect(RUNNER_STOP_SERIOUS).toBeLessThan(SNEAK_KNIGHT_CHECK_GUESS);
  });

  it("a runner still far off is a tie-break, not a plan", () => {
    expect(RUNNER_STOP_WATCH).toBeLessThan(HUNT_UNDEFENDED_PAWN);
    expect(RUNNER_STOP_WATCH).toBeLessThan(RUNNER_STOP_SERIOUS);
  });
});

describe("ally-crush dials never outbid a real runner tier or retaliation", () => {
  /**
   * Deploying over our own ring units is priced below every tier that answers
   * a seen threat: the dials only ever *nudge* an already-runner-relevant or
   * shielding drop past an empty square, and their sum stays under
   * RUNNER_STOP_SERIOUS. The runner answer itself pays nothing on ally-held
   * squares (the standing body already blockades), so nothing lifts an
   * ally-crush into the runner tiers — crushes top out at the dials below.
   */
  it("each dial sits below the serious runner tier", () => {
    for (const w of [ALLY_UPGRADE, ALLY_SHIELD_PAWN, ALLY_SHIELD_SHIP]) {
      expect(w).toBeLessThan(RUNNER_STOP_SERIOUS);
    }
  });

  it("...below retaliation, and combined still below the serious tier", () => {
    expect(ALLY_SHIELD_SHIP).toBeLessThan(AVENGE_CC_SHOT);
    expect(ALLY_SHIELD_SHIP + ALLY_UPGRADE).toBeLessThan(RUNNER_STOP_SERIOUS);
  });

  it("...and the ally dials alone never reach the last-chance tier", () => {
    expect(ALLY_SHIELD_SHIP + ALLY_UPGRADE).toBeLessThan(RUNNER_STOP_CRITICAL);
  });
});

describe("a fogged guess is never scored above a seen Command Center", () => {
  it("holds for every guess/seen pair", () => {
    expect(SNEAK_KNIGHT_CHECK_GUESS).toBeLessThanOrEqual(SNEAK_KNIGHT_CHECK_SEEN);
    expect(PAWN_CHECK_CC_GUESS).toBeLessThanOrEqual(PAWN_CHECK_CC_SEEN);
  });
});
