/**
 * Caps / costs / timeout / income — rules live in `@chess-coach/starchess-core`.
 * Animation durations stay here (presentation).
 */

export {
  KING_MAX_LIVES,
  MAX_STORED_MATERIAL,
  MAX_DEPLOYED_MATERIAL,
  TURN_TIMEOUT_MS,
  UNIT_COST,
  incomeForTurn,
  energyForTurn,
  turnTimeoutMsForTurn,
  SPECIAL_ENERGY_COST,
} from "@chess-coach/starchess-core";

import { TURN_TIMEOUT_MS } from "@chess-coach/starchess-core";

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
 * Spider Mine chase missile after the victim lands:
 * lift in place → self-launch along the trail. Total = {@link MINE_MISSILE_MS}.
 */
export const MINE_MISSILE_LIFT_MS = 200;
export const MINE_MISSILE_LAUNCH_MS = 50;
export const MINE_MISSILE_MS = MINE_MISSILE_LIFT_MS + MINE_MISSILE_LAUNCH_MS;

/** Green trail fade after the mine missile (shorter than Tactical Jump twin trails). */
export const MINE_TRAIL_MS = 700;

/** Mine added to the board — legs burrow independently within this window. */
export const MINE_DEPLOY_MS = 250;

/** Chase wake — legs leave the ground independently within this window. */
export const MINE_EMERGE_MS = 50;

/**
 * Death / rubble collapse (CSS `--death-ms`) — 1/2 of an attack
 * (= 1/20 of a turn).
 */
export const DEATH_MS = ATTACK_MS / 2;

/**
 * Quiet-move travel time per board square.
 * Total move duration = squares × this (Chebyshev for slides; L-length for knights).
 * 200ms = prior 250ms × 1.25 speed.
 */
export const MOVE_SQUARE_MS = 200;

/**
 * Pawn / marine gas-step (stim) — half the classical per-square travel
 * ({@link MOVE_SQUARE_MS} / 2 = 100ms) with a matching 2× hop gait.
 */
export const STIM_MOVE_SQUARE_MS = MOVE_SQUARE_MS / 2;

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

/**
 * Deploy-crush death delay — a Command Center drop onto an enemy square
 * collapses the occupant ~100ms after the deploy begins (mid free-fall).
 * Crush window total = max({@link DEPLOY_MS}, CRUSH_DEATH_MS + {@link DEATH_MS}).
 */
export const CRUSH_DEATH_MS = 100;

/**
 * Gas special resolve — canister falls from the top of the square into the unit
 * while the green special-used aura eases in.
 */
export const GAS_DROP_MS = 260;
