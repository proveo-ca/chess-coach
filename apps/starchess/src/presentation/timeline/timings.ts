/**
 * Presentation timings — injected scheduler advances these in tests.
 * Re-export from constants so FRAG_FLIGHT_MS / ATTACK_MS stay one source of truth
 * (kill→death meeting point = FRAG_FLIGHT_MS = ATTACK_MS / 4 = 250ms).
 */
export {
  ATTACK_MS,
  FRAG_FLIGHT_MS,
  DEATH_MS,
  MOVE_SQUARE_MS,
  DEPLOY_MS,
  GAS_DROP_MS,
  TURN_TIMEOUT_MS,
} from "~/presentation/constants";

import { MOVE_SQUARE_MS } from "~/presentation/constants";

export const moveDurationMs = (from: string, to: string): number => {
  const df = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
  const dr = Math.abs(Number(from[1]) - Number(to[1]));
  const steps = Math.max(df, dr, 1);
  return steps * MOVE_SQUARE_MS;
};
