/** Presentation timings — injected scheduler advances these in tests. */
export const ATTACK_MS = 1000;
/** King HP chip / hit boom — aligns with attack frag (`ATTACK_MS / 4`). */
export const FRAG_FLIGHT_MS = ATTACK_MS / 4;
export const DEATH_MS = 500;
export const MOVE_SQUARE_MS = 200;
export const DEPLOY_MS = 500;
export const TURN_TIMEOUT_MS = 10_000;

export const moveDurationMs = (from: string, to: string): number => {
  const df = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
  const dr = Math.abs(Number(from[1]) - Number(to[1]));
  const steps = Math.max(df, dr, 1);
  return steps * MOVE_SQUARE_MS;
};
