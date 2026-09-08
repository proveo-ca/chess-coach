/** Caps, costs, timeout, income, king lives — StarChess v1 locked values. */

export const KING_MAX_LIVES = 3;
export const MAX_STORED_MATERIAL = 12;
export const MAX_DEPLOYED_MATERIAL = 50;
export const MAX_GAME_TURNS = 45;

/**
 * Planning turn length — base clock for animation fractions and for income
 * tier 1 (turns 1–10). Higher gas-income tiers stretch the live planning
 * clock via {@link turnTimeoutMsForTurn}; attack/death VFX stay on this base.
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

/**
 * Live planning deadline for a turn — +50% per gas-income tier from base:
 * income 1 → 10s, 2 → 15s, 3 → 22s (`floor(base × 1.5^(tier−1))` in whole seconds).
 * Presentation attack windows keep using {@link TURN_TIMEOUT_MS}.
 */
export const turnTimeoutMsForTurn = (turn: number): number => {
  const tier = energyForTurn(turn);
  let ms = TURN_TIMEOUT_MS;
  for (let i = 1; i < tier; i += 1) {
    ms = Math.floor((ms * 1.5) / 1000) * 1000;
  }
  return ms;
};

/** Gas burned when queueing / committing one special this turn. */
export const SPECIAL_ENERGY_COST = 1;

/** Charon Booster Missiles (bishopSnipe) gas cost. */
export const CHARON_GAS_COST = 2;

/** StarChess alias of {@link CHARON_GAS_COST} — prefer in new code. */
export const MECHA_CHARON_GAS_COST = CHARON_GAS_COST;

/** BattleShip Tactical Jump (queenWarp) gas cost — 3 canisters (tier-3 income). */
export const QUEEN_WARP_GAS_COST = 3;
