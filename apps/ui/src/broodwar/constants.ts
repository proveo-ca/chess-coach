/** Caps, costs, timeout, income, king lives — Brood War v1 locked values. */

export const KING_MAX_LIVES = 3;
export const MAX_STORED_MATERIAL = 12;
export const MAX_DEPLOYED_MATERIAL = 50;
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
