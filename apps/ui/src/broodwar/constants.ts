/** Caps, costs, timeout, income, king lives — Brood War v1 locked values. */

export const KING_MAX_LIVES = 3;
export const MAX_STORED_MATERIAL = 12;
export const MAX_DEPLOYED_MATERIAL = 50;

/**
 * Planning turn length — base clock for all Brood War timing.
 * Attack / impact / death windows are fractions of this.
 */
export const TURN_TIMEOUT_MS = 10_000;

/**
 * Attack VFX phase (CSS `--attack-ms`) — 1/10 of a turn.
 * Idle-front between looping demo attacks uses the same duration.
 */
export const ATTACK_MS = TURN_TIMEOUT_MS / 10;

/**
 * Attack impact / frag land / king hit-boom (CSS `--frag-flight-ms`) —
 * 1/4 of an attack (= 1/40 of a turn). Kill-death delay aligns here.
 */
export const FRAG_FLIGHT_MS = ATTACK_MS / 4;

/**
 * Death / rubble collapse (CSS `--death-ms`) — 1/2 of an attack
 * (= 1/20 of a turn).
 */
export const DEATH_MS = ATTACK_MS / 2;

/**
 * Quiet-move travel time per board square.
 * Total move duration = squares × this (Chebyshev for slides; L-length for knights).
 */
export const MOVE_SQUARE_MS = 250;

/** Siege Tank pack ↔ unpack (CSS `--siege-toggle-ms`). */
export const SIEGE_TOGGLE_MS = 480;

/** Single-square travel (king flee cover, 1-step default). */
export const MOVE_MS = MOVE_SQUARE_MS;

/** Command Center deploy — total drop + landing. */
export const DEPLOY_MS = 500;

/** Free-fall from above the board into the square. */
export const DEPLOY_DROP_MS = 200;

/** Landing phase (humanoid crouch / mechanoid thrust brake). */
export const DEPLOY_LAND_MS = 300;

/** @deprecated Prefer {@link DEPLOY_LAND_MS} — mechanoid thrust spans the landing window. */
export const DEPLOY_THRUST_MS = DEPLOY_LAND_MS;

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
 */
export const energyForTurn = (turn: number): number => incomeForTurn(turn);

/** Gas burned when queueing / committing one special this turn. */
export const SPECIAL_ENERGY_COST = 1;
