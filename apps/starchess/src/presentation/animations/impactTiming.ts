import type { AttackAnimKind } from "~/types/cues";
import { ATTACK_MS, FRAG_FLIGHT_MS } from "~/presentation/constants";

/**
 * Fraction of {@link ATTACK_MS} when impact / death meeting point occurs.
 *
 * Exception: `mechaCharon` — Charon’s cue window is {@link FRAG_FLIGHT_MS}
 * (not ATTACK_MS). Fraction is of that short window; contact is at the end
 * (`charonImpact` keyframes ~80–100%, missiles arrive at 100%).
 */
export const IMPACT_FRAC: Record<AttackAnimKind, number> = {
  marineRifle: 0.25,
  hoverbikeFrag: 0.25,
  mechaGatlings: 0.25,
  mechaCharon: 1.0,
  tankBattery: 0.22, // HE peaks near 22% per CSS review
  battleShipLaser: 0.19, // laser arrives ~19%
  ccDualCannon: 0.25,
};

/** Kill→death / frag-land delay for an attack anim kind. */
export const impactMsFor = (anim: AttackAnimKind): number => {
  if (anim === "mechaCharon") {
    return Math.round(FRAG_FLIGHT_MS * IMPACT_FRAC.mechaCharon);
  }
  return Math.round(ATTACK_MS * IMPACT_FRAC[anim]);
};

/** CSS custom-property snippet for per-cue `--frag-flight-ms`. */
export const fragFlightMsCss = (anim: AttackAnimKind): string =>
  `${impactMsFor(anim)}ms`;
