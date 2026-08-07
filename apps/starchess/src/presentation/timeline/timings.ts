/**
 * Presentation timings — injected scheduler advances these in tests.
 * Re-export from constants so FRAG_FLIGHT_MS / ATTACK_MS stay one source of truth.
 * Per-weapon kill→death meeting point: {@link impactMsFor} (default ≈ FRAG_FLIGHT_MS).
 */
export {
  ATTACK_MS,
  FRAG_FLIGHT_MS,
  DEATH_MS,
  MOVE_SQUARE_MS,
  STIM_MOVE_SQUARE_MS,
  DEPLOY_MS,
  GAS_DROP_MS,
  TURN_TIMEOUT_MS,
} from "~/presentation/constants";

export { IMPACT_FRAC, impactMsFor, fragFlightMsCss } from "~/presentation/animations/impactTiming";

import { MOVE_SQUARE_MS, STIM_MOVE_SQUARE_MS } from "~/presentation/constants";

export const moveDurationMs = (
  from: string,
  to: string,
  opts?: { stim?: boolean },
): number => {
  const df = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
  const dr = Math.abs(Number(from[1]) - Number(to[1]));
  const steps = Math.max(df, dr, 1);
  const squareMs = opts?.stim ? STIM_MOVE_SQUARE_MS : MOVE_SQUARE_MS;
  return steps * squareMs;
};
