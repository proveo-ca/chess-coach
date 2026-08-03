import type { KingDamageState } from "~/starchess/types";
import { FRAG_FLIGHT_MS } from "~/starchess/constants";

/**
 * Hit flash before fire overlay appears — same window as attack impact
 * (`FRAG_FLIGHT_MS` = `ATTACK_MS / 4` = `TURN_TIMEOUT_MS / 40`).
 */
export const HIT_BOOM_MS = FRAG_FLIGHT_MS;

/** Map remaining king lives (0–3) to the visual damage state. */
export const kingDamageStateForLives = (lives: number): KingDamageState => {
  if (lives >= 3) return "pristine";
  if (lives === 2) return "smallFire";
  if (lives === 1) return "bigFire";
  return "destroyed";
};
