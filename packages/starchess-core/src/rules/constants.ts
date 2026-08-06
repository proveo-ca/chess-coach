/** Caps, costs, timeout, income, king lives — StarChess v1 locked values. */

export const KING_MAX_LIVES = 3;
export const MAX_STORED_MATERIAL = 12;
export const MAX_DEPLOYED_MATERIAL = 50;

/**
 * Planning turn length — base clock for all StarChess timing.
 * Attack / impact / death windows are fractions of this (presentation layer).
 */
export const TURN_TIMEOUT_MS = 10_000;

export const UNIT_COST = {
  k: 1,
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
} as const;

/** Material income by turn index (starts at 1 after each resolved round). */
export const incomeForTurn = (turn: number): number => {
  if (turn <= 10) return 1;
  if (turn <= 20) return 2;
  return 3;
};

/**
 * Vespene energy capacity for the planning turn — same tiers as material income.
 * Energy does **not** accumulate; each turn refills to this cap.
 * Turn 0 (demo seeds) uses the turn-1 tier.
 */
export const energyForTurn = (turn: number): number =>
  incomeForTurn(Math.max(1, turn));

/** Gas burned when queueing / committing one special this turn. */
export const SPECIAL_ENERGY_COST = 1;

/** Charon Booster Missiles (bishopSnipe) gas cost. */
export const CHARON_GAS_COST = 2;
