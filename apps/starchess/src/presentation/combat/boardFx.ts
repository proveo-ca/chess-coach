/**
 * Pure combat hide-set — squares whose board piece must hide while an overlay owns them.
 */
import type { Square } from "chess.js";

import type {
  AttackCue,
  DeathCue,
  DeployCue,
  KingDamageCue,
  MoveCue,
} from "~/presentation/types";

/** Stable empty set when no combat FX are active. */
export const EMPTY_FX_HIDDEN: ReadonlySet<Square> = new Set();

export type CombatFxInput = {
  attacks?: readonly AttackCue[];
  deaths?: readonly DeathCue[];
  moves?: readonly MoveCue[];
  kingDamage?: readonly KingDamageCue[];
  deploys?: readonly DeployCue[];
  fleeCover?: ReadonlySet<Square>;
};

export const hasCombatFxInput = (fx: CombatFxInput): boolean =>
  (fx.attacks?.length ?? 0) > 0 ||
  (fx.deaths?.length ?? 0) > 0 ||
  (fx.moves?.length ?? 0) > 0 ||
  (fx.kingDamage?.length ?? 0) > 0 ||
  (fx.deploys?.length ?? 0) > 0 ||
  (fx.fleeCover?.size ?? 0) > 0;

/**
 * Squares whose board piece must hide while an overlay owns the piece
 * (attack from, death at, move from+to — same contract as UI `buildFxHiddenSquares`).
 */
export const buildFxHiddenSquares = (fx: CombatFxInput): ReadonlySet<Square> => {
  if (!hasCombatFxInput(fx)) return EMPTY_FX_HIDDEN;

  const hide = new Set<Square>();
  for (const c of fx.attacks ?? []) hide.add(c.from);
  for (const c of fx.deaths ?? []) hide.add(c.at);
  for (const c of fx.moves ?? []) {
    hide.add(c.from);
    hide.add(c.to);
  }
  for (const c of fx.deploys ?? []) hide.add(c.at);
  for (const c of fx.kingDamage ?? []) hide.add(c.at);
  if (fx.fleeCover) for (const sq of fx.fleeCover) hide.add(sq);
  return hide;
};
