/**
 * End / timeout path — resolve one planning SCFEN snap into the next.
 * Order: B specials → pending king-checks → classical attack → classical move
 * (+ mine triggers) → F specials.
 */

import type { Square } from "chess.js";

import {
  mapToPlacement,
  placementToMap,
  type ScPiece,
} from "~/starchess/board";
import { energyForTurn } from "~/starchess/constants";
import {
  assertMineCap,
  MAX_MINES_PER_SIDE,
  minesFor,
} from "~/starchess/mines";
import { placementAfterCharon } from "~/starchess/specials/bishopCharon";
import {
  applyPendingKingShots,
  resolveTurn,
  type ResolveTurnResult,
} from "~/starchess/resolveTurn";
import { getSideVision } from "~/starchess/vision";
import type { ResolveEvent, SpecialKind } from "~/starchess/types";
import type {
  ClassicalPlan,
  PieceColor,
  ScAction,
  ScFenSnapshot,
  ScMine,
} from "~/types/starchess";
import { Chess } from "chess.js";

export type EndScTurnResult = {
  resolved: ResolveTurnResult;
  next: ScFenSnapshot;
  ignoreAttacksOn: readonly Square[];
  events: ResolveEvent[];
  /** Surviving `rookSiege` toggles this resolve (entered or left siege). */
  siegedThisTurn: readonly Square[];
  /** Placement + mines after B specials, before classical resolve (spawn / warp land). */
  afterB: { placement: string; mines: ScMine[] };
};

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

const placeUnit = (placement: string, at: Square, piece: ScPiece): string => {
  const map = placementToMap(placement);
  map.set(at, piece);
  return mapToPlacement(map);
};

const applySpecial = (
  placement: string,
  mines: ScMine[],
  action: Extract<ScAction, { timing: "B" | "F" }>,
  ignoreAttacksOn: Square[],
): { placement: string; mines: ScMine[] } => {
  const kind = action.kind as SpecialKind;
  switch (kind) {
    case "bishopSnipe": {
      if (!action.to) return { placement, mines };
      return { placement: placementAfterCharon(placement, action.to), mines };
    }
    case "queenWarp": {
      if (!action.to) return { placement, mines };
      ignoreAttacksOn.push(action.from);
      return { placement: relocate(placement, action.from, action.to), mines };
    }
    case "pawnDouble": {
      if (!action.to) return { placement, mines };
      return { placement: relocate(placement, action.from, action.to), mines };
    }
    case "spawn": {
      if (!action.to || !action.unit) return { placement, mines };
      return {
        placement: placeUnit(placement, action.to, {
          type: action.unit,
          color: action.color,
        }),
        mines,
      };
    }
    case "knightMine": {
      const at = action.to ?? action.from;
      const next = [...mines, { color: action.color, at }];
      assertMineCap(next, action.color);
      return { placement, mines: next };
    }
    case "rookSiege":
      return { placement, mines };
    default:
      return { placement, mines };
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

export const endScTurn = (snapshot: ScFenSnapshot): EndScTurnResult => {
  if (snapshot.phase !== "P") {
    throw new Error(`endScTurn requires phase P (got ${snapshot.phase})`);
  }

  const actions = snapshot.queue?.actions ?? [];
  const events: ResolveEvent[] = [];
  const ignoreAttacksOn: Square[] = [];
  let placement = snapshot.placement;
  let mines: ScMine[] = [...(snapshot.mines ?? [])];
  let eventSeq = 0;

  for (const a of byTiming(actions, "B")) {
    if (a.timing !== "B") continue;
    const applied = applySpecial(placement, mines, a, ignoreAttacksOn);
    placement = applied.placement;
    mines = applied.mines;
    events.push(eventFor("specialBefore", a, `ev-${eventSeq++}`));
  }

  const afterB = { placement, mines: [...mines] };

  const pendingApplied = applyPendingKingShots({
    placement,
    kingLives: snapshot.kingLives,
    pending: snapshot.pendingKingShots ?? [],
    mines,
  });
  placement = pendingApplied.placement;
  mines = pendingApplied.mines;
  let kingLives = pendingApplied.kingLives;

  const visionGame = new Chess(`${placement} w - - 0 1`);
  const visionOpts = { mines };
  const visionW = getSideVision(visionGame, "w", visionOpts);
  const visionB = getSideVision(visionGame, "b", visionOpts);
  const isTargetVisible = (color: PieceColor, square: Square) => {
    const v = color === "w" ? visionW : visionB;
    return v.litSquares.has(square) || v.revealedPieces.has(square);
  };

  const white = classicalFor(actions, "w");
  const black = classicalFor(actions, "b");
  const classical = resolveTurn({
    placement,
    kingLives,
    white,
    black,
    ignoreAttacksOn,
    mines,
    isTargetVisible,
    pathVisionOpts: { mines },
  });

  const resolved: ResolveTurnResult = {
    ...classical,
    attacks: [...pendingApplied.attacks, ...classical.attacks],
  };

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
  for (const blast of resolved.mineTriggers) {
    events.push({
      id: `ev-${eventSeq++}`,
      phase: "move",
      color: blast.color,
      from: blast.from,
      to: blast.to,
    });
  }
  for (const hit of resolved.moveCollisions) {
    events.push({
      id: `ev-${eventSeq++}`,
      phase: "move",
      color: hit.color,
      from: hit.from,
      to: hit.to,
    });
  }

  placement = resolved.afterMove.placement;
  mines = resolved.afterMove.mines;
  kingLives = resolved.afterMove.kingLives;
  const siegedThisTurn: Square[] = [];
  // Carry siege mode; drop squares that no longer hold a rook after combat.
  const boardAfterMove = placementToMap(placement);
  const sieged = new Set(
    (snapshot.siegedRooks ?? []).filter((sq) => boardAfterMove.get(sq)?.type === "r"),
  );

  for (const a of byTiming(actions, "F")) {
    if (a.timing !== "F") continue;
    // Actor may have relocated via classical C; skip if gone (death / chase boom).
    const classicalPlan = classicalFor(actions, a.color);
    const at =
      classicalPlan && classicalPlan.from === a.from ? classicalPlan.to : a.from;
    const boardAfter = placementToMap(placement);
    const actor = boardAfter.get(at);
    if (!actor || actor.color !== a.color) continue;

    if (a.kind === "rookSiege") {
      if (actor.type !== "r") continue;
      if (sieged.has(at)) sieged.delete(at);
      else sieged.add(at);
      siegedThisTurn.push(at);
      events.push(eventFor("specialAfter", a, `ev-${eventSeq++}`));
      continue;
    }

    const applied = applySpecial(placement, mines, a, ignoreAttacksOn);
    placement = applied.placement;
    mines = applied.mines;
    events.push(eventFor("specialAfter", a, `ev-${eventSeq++}`));
  }

  // Enforce cap after F drops too.
  for (const color of ["w", "b"] as const) {
    if (minesFor(mines, color).length > MAX_MINES_PER_SIDE) {
      throw new Error(`endScTurn: ${color} mine cap exceeded`);
    }
  }

  const nextTurn = snapshot.turn + 1;
  const income = energyForTurn(Math.max(1, nextTurn));
  const gasIncome = { w: income, b: income };
  const siegedRooks = [...sieged].sort();
  const pendingKingShots = resolved.pendingKingShotsArmed;
  const next: ScFenSnapshot = {
    placement,
    turn: nextTurn,
    kingLives: { ...kingLives },
    phase: kingLives.w === 0 || kingLives.b === 0 ? "O" : "P",
    gas: { ...gasIncome },
    gasIncome,
    queue: { actions: [] },
    ...(mines.length ? { mines } : {}),
    ...(siegedRooks.length ? { siegedRooks } : {}),
    ...(pendingKingShots.length ? { pendingKingShots } : {}),
  };

  return { resolved, next, events, ignoreAttacksOn, siegedThisTurn, afterB };
};
