/**
 * End / timeout path — resolve one planning SCFEN snap into the next.
 * Order: B specials → classical attack → classical move → F specials.
 */

import type { Square } from "chess.js";

import {
  mapToPlacement,
  placementToMap,
  type ScPiece,
} from "~/starchess/board";
import { energyForTurn } from "~/starchess/constants";
import { placementAfterCharon } from "~/starchess/specials/bishopCharon";
import {
  resolveTurn,
  type ResolveTurnResult,
} from "~/starchess/resolveTurn";
import type { ResolveEvent, SpecialKind } from "~/starchess/types";
import type {
  ClassicalPlan,
  PieceColor,
  ScAction,
  ScFenSnapshot,
} from "~/types/starchess";

export type EndScTurnResult = {
  resolved: ResolveTurnResult;
  next: ScFenSnapshot;
  events: ResolveEvent[];
  /** Queen origins that Tactical-Jumped this resolve (attack immunity). */
  ignoreAttacksOn: readonly Square[];
};

/** Within a timing rank: white wire order, then black (SCFEN §2.1). */
const byTiming = (actions: readonly ScAction[], timing: "B" | "C" | "F") =>
  actions
    .filter((a) => a.timing === timing)
    .slice()
    .sort((a, b) => {
      if (a.color !== b.color) return a.color === "w" ? -1 : 1;
      return a.seq - b.seq;
    });


const relocate = (placement: string, from: Square, to: Square): string => {
  const map = placementToMap(placement);
  const piece = map.get(from);
  if (!piece) return placement;
  map.delete(from);
  map.set(to, piece);
  return mapToPlacement(map);
};

const placeUnit = (
  placement: string,
  at: Square,
  piece: ScPiece,
): string => {
  const map = placementToMap(placement);
  map.set(at, piece);
  return mapToPlacement(map);
};

const applySpecial = (
  placement: string,
  action: Extract<ScAction, { timing: "B" | "F" }>,
  ignoreAttacksOn: Square[],
): string => {
  const kind = action.kind as SpecialKind;
  switch (kind) {
    case "bishopSnipe": {
      if (!action.to) return placement;
      return placementAfterCharon(placement, action.to);
    }
    case "queenWarp": {
      if (!action.to) return placement;
      ignoreAttacksOn.push(action.from);
      return relocate(placement, action.from, action.to);
    }
    case "pawnDouble": {
      if (!action.to) return placement;
      return relocate(placement, action.from, action.to);
    }
    case "spawn": {
      if (!action.to || !action.unit) return placement;
      return placeUnit(placement, action.to, {
        type: action.unit,
        color: action.color,
      });
    }
    case "knightMine":
    case "rookSiege":
      // Overlay / store-side; placement unchanged in SCFEN resolve.
      return placement;
    default:
      return placement;
  }
};

const classicalFor = (
  actions: readonly ScAction[],
  color: PieceColor,
): ClassicalPlan | null => {
  const c = actions.find((a) => a.timing === "C" && a.color === color);
  if (!c || c.timing !== "C") return null;
  return { color, from: c.from, to: c.to };
};

const eventFor = (
  phase: ResolveEvent["phase"],
  action: ScAction,
  id: string,
): ResolveEvent => ({
  id,
  phase,
  color: action.color,
  from: action.from,
  to: action.timing === "C" || action.to ? (action as { to?: Square }).to : undefined,
});

/**
 * Resolve a `phase=P` planning snapshot. Returns the next planning snap
 * (`turn+1`, empty queue, gas refilled from next-turn income).
 */
export const endScTurn = (snapshot: ScFenSnapshot): EndScTurnResult => {
  if (snapshot.phase !== "P") {
    throw new Error(`endScTurn requires phase P (got ${snapshot.phase})`);
  }

  const actions = snapshot.queue?.actions ?? [];
  const events: ResolveEvent[] = [];
  const ignoreAttacksOn: Square[] = [];
  let placement = snapshot.placement;
  let eventSeq = 0;

  for (const a of byTiming(actions, "B")) {
    if (a.timing !== "B") continue;
    placement = applySpecial(placement, a, ignoreAttacksOn);
    events.push(eventFor("specialBefore", a, `ev-${eventSeq++}`));
  }

  const white = classicalFor(actions, "w");
  const black = classicalFor(actions, "b");
  const resolved = resolveTurn({
    placement,
    kingLives: snapshot.kingLives,
    white,
    black,
    ignoreAttacksOn,
  });

  for (const atk of resolved.attacks) {
    events.push({
      id: `ev-${eventSeq++}`,
      phase: "attack",
      color: atk.color,
      from: atk.from,
      to: atk.to,
    });
  }
  for (const mv of resolved.moves) {
    events.push({
      id: `ev-${eventSeq++}`,
      phase: "move",
      color: mv.color,
      from: mv.from,
      to: mv.to,
    });
  }

  placement = resolved.afterMove.placement;
  const kingLives = resolved.afterMove.kingLives;

  for (const a of byTiming(actions, "F")) {
    if (a.timing !== "F") continue;
    placement = applySpecial(placement, a, ignoreAttacksOn);
    events.push(eventFor("specialAfter", a, `ev-${eventSeq++}`));
  }

  const nextTurn = snapshot.turn + 1;
  const income = energyForTurn(Math.max(1, nextTurn));
  const gasIncome = { w: income, b: income };
  const next: ScFenSnapshot = {
    placement,
    turn: nextTurn,
    kingLives: { ...kingLives },
    phase: kingLives.w === 0 || kingLives.b === 0 ? "O" : "P",
    gas: { ...gasIncome },
    gasIncome,
    queue: { actions: [] },
  };

  return { resolved, next, events, ignoreAttacksOn };
};
