import { findKing, placementToMap, type StarChessColor } from "@chess-coach/starchess-core";

import type { KingDamageCue, KingDamageState } from "~/presentation/types";
import { FRAG_FLIGHT_MS } from "~/presentation/constants";

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

/** Build fire cues from placement + lives, preserving seeds across syncs. */
export const kingDamageCuesFromBoard = (
  placement: string,
  lives: Record<StarChessColor, number>,
  prev: readonly KingDamageCue[] = [],
): KingDamageCue[] => {
  const map = placementToMap(placement);
  const cues: KingDamageCue[] = [];
  for (const color of ["w", "b"] as const) {
    const state = kingDamageStateForLives(lives[color]);
    if (state === "pristine") continue;
    const at = findKing(map, color);
    if (!at) continue;
    const existing = prev.find((c) => c.id === color);
    // First appearance or worse HP → bump impact so the hit boom plays.
    const hit = existing == null || existing.damage !== state;
    cues.push({
      id: color,
      at,
      damage: state,
      seed: existing?.seed ?? Math.floor(Math.random() * 0xffffffff),
      impactSeq: hit ? (existing?.impactSeq ?? 0) + 1 : existing?.impactSeq,
    });
  }
  return cues;
};
