// SPEC: _spec/apps/starchess/architecture/board-entities.puml
import {
  findKing,
  placementToMap,
  type StarChessColor,
  type StarChessPiece,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

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

const livesForDamage = (damage: KingDamageState): number => {
  if (damage === "pristine") return 3;
  if (damage === "smallFire") return 2;
  if (damage === "bigFire") return 1;
  return 0;
};

/**
 * Build fire cues from placement + lives, preserving seeds across syncs.
 * Bumps `impactSeq` only when HP drops vs the previous cue (not on remount /
 * first paint of an already-damaged SCFEN).
 * Keeps pristine entries so 3→2 can detect a real chip.
 */
export const kingDamageCuesFromBoard = (
  placement: string,
  lives: Record<StarChessColor, number>,
  prev: readonly KingDamageCue[] = [],
): KingDamageCue[] => {
  const map = placementToMap(placement);
  const cues: KingDamageCue[] = [];
  for (const color of ["w", "b"] as const) {
    const state = kingDamageStateForLives(lives[color]);
    const at = findKing(map, color);
    if (!at) continue;
    const existing = prev.find((c) => c.id === color);
    const hit =
      existing != null && lives[color] < livesForDamage(existing.damage);
    cues.push({
      id: color,
      at,
      damage: state,
      seed: existing?.seed ?? Math.floor(Math.random() * 0xffffffff),
      impactSeq: hit
        ? (existing.impactSeq ?? 0) + 1
        : (existing?.impactSeq ?? 0),
    });
  }
  return cues;
};

/** Side colour a cue belongs to — `id` is typed loose for slot identity. */
export const kingDamageColor = (cue: KingDamageCue): StarChessColor =>
  cue.id === "b" ? "b" : "w";

export type KingDamageVisibility = {
  /** Squares whose attack hull owns the frame — fire would double-draw. */
  attackFrom: ReadonlySet<string>;
  /** Squares / sides mid-death crumple — rubble owns those. */
  dyingAt: ReadonlySet<string>;
  dyingColors: ReadonlySet<string>;
  /**
   * Sides whose king is travelling as a move hull. That hull carries `damage` +
   * `seed`, so it owns the fire for the length of the slide — the same handoff
   * `attackFrom` makes for a shooting king. Without it both layers draw a CC:
   * the mover slides pristine at z 30 while this layer burns on the origin
   * square at z 35, which is the flames-over-a-full-HP-king artefact.
   */
  movingColors: ReadonlySet<string>;
  /**
   * Fog gate. Fire paints *over* the board, so without this an unseen burning
   * Command Center announces its own square through the veil — the one cue
   * layer that used to skip the check every other layer makes. No-fog /
   * observer callers pass a predicate that is always true.
   */
  isVisible: (at: Square, color: StarChessColor) => boolean;
};

/** Cues that may actually paint this frame. Pristine kings are a no-op. */
export const visibleKingDamageCues = (
  cues: readonly KingDamageCue[],
  v: KingDamageVisibility,
): KingDamageCue[] =>
  cues.filter(
    (c) =>
      c.damage !== "pristine" &&
      !v.movingColors.has(c.id) &&
      !v.attackFrom.has(c.at) &&
      !v.dyingAt.has(c.at) &&
      !v.dyingColors.has(c.id) &&
      v.isVisible(c.at, kingDamageColor(c)),
  );

/** Any cue whose hull may be a Command Center that has to burn while it plays. */
export type KingFireHull = {
  piece: StarChessPiece;
  color: StarChessColor;
  damage?: KingDamageState;
  seed?: number;
};

/**
 * Hand a king's HP fire to the hull that is about to animate it.
 *
 * The persistent damage layer steps aside for a king that shoots (`attackFrom`)
 * or walks (`movingColors`) so two hulls never draw the same CC — which means
 * the animating hull owes the fire for the length of its cue, or the king reads
 * as full HP while it shoots / walks. `seed` travels with `damage` so the flames
 * do not jump when the slot takes the hull back.
 *
 * Returns the input array untouched when no cue needs fire: cue arrays are
 * structurally shared down the VFX path, and a fresh array every recompute is
 * churn for the common case of two healthy kings.
 */
export const withKingFire = <T extends KingFireHull>(
  cues: readonly T[],
  fire: readonly KingDamageCue[],
): readonly T[] => {
  let changed = false;
  const out = cues.map((c) => {
    if (c.piece !== "k") return c;
    const hp = fire.find((f) => f.id === c.color);
    if (!hp || hp.damage === "pristine") return c;
    changed = true;
    return { ...c, damage: hp.damage, seed: hp.seed } as T;
  });
  return changed ? out : cues;
};
