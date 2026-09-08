// SPEC: _spec/packages/starchess-core/deploy-reach.puml
import type { Square } from "chess.js";

import { attacksSquare, parseSquare, sq, type ScPiece } from "./placement";
import { hostileMineOn } from "./mine-contact";
import { SPECIAL_ENERGY_COST, UNIT_COST } from "../rules/constants";
import type { ScMine, StarChessColor, StarChessPiece } from "../model/types";

/** Units a Command Center can deploy, cheapest first. */
export const DEPLOYABLE_UNITS: readonly StarChessPiece[] = ["p", "n", "b", "r", "q"];

export type DeployReachQuery = {
  /** Board the deploy lands on; a recapture question passes the POST-move board. */
  map: Map<Square, ScPiece>;
  mines: readonly ScMine[] | undefined;
  /** Side doing the deploying. */
  color: StarChessColor;
  /** Command Center of `color`; deploys land on its ring. */
  cc: Square | null;
  /** Gas available for the `spawn` special. */
  gas: number;
  /** Banked minerals, compared per unit against `UNIT_COST`. */
  minerals: number;
};

const ringOf = (cc: Square): Square[] => {
  const { file, rank } = parseSquare(cc);
  const out: Square[] = [];
  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (df === 0 && dr === 0) continue;
      const at = sq(file + df, rank + dr);
      if (at) out.push(at);
    }
  }
  return out;
};

/** Squares a deploy may legally land on. */
export const deployTargets = (q: DeployReachQuery): Square[] => {
  if (!q.cc) return [];
  if (q.gas < SPECIAL_ENERGY_COST) return [];
  return ringOf(q.cc).filter((at) => {
    if (hostileMineOn(q.mines, q.color, at)) return false;
    const occupant = q.map.get(at);
    if (!occupant) return true;
    // Ally and enemy non-kings are crushable (deployed replaces occupant).
    // Kings are never crushable.
    return occupant.type !== "k";
  });
};

/** Units affordable from `minerals`. */
export const deployableUnits = (minerals: number): StarChessPiece[] =>
  DEPLOYABLE_UNITS.filter((u) => UNIT_COST[u] <= minerals);

/** A Marine may not be deployed onto the promotion ranks. */
const canLand = (unit: StarChessPiece, at: Square): boolean => {
  if (unit !== "p") return true;
  const rank = Number(at[1]);
  return rank !== 1 && rank !== 8;
};

/** Would any legal deploy by `color` attack `target`? */
export const deployCovers = (q: DeployReachQuery, target: Square): boolean => {
  const targets = deployTargets(q);
  if (targets.length === 0) return false;
  const units = deployableUnits(q.minerals);
  if (units.length === 0) return false;

  const probe = new Map(q.map);
  for (const at of targets) {
    if (at === target && units.some((unit) => canLand(unit, at))) return true;
    const occupant = probe.get(at);
    for (const unit of units) {
      if (!canLand(unit, at)) continue;
      probe.set(at, { type: unit, color: q.color });
      const hit = attacksSquare(probe, at, target);
      if (hit) return true;
    }
    if (occupant === undefined) probe.delete(at);
    else probe.set(at, occupant);
  }
  return false;
};
