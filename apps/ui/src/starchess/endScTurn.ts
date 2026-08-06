/**
 * End / timeout path — resolve one planning SCFEN snap into the next.
 * Order: pending king-checks → B specials (incl. intent siege) → classical
 * attack → classical move (+ mine triggers) → F specials.
 * // SPEC: _spec/apps/ui/starchess/turn-queue-sequence.puml, _spec/apps/ui/starchess/resolve.puml
 */

import type { Square } from "chess.js";
import { Chess } from "chess.js";

import {
  collectLegalKingChecks,
  mapToPlacement,
  parseSquare,
  placementToMap,
  sq,
  type ScPiece,
} from "~/starchess/board";
import { energyForTurn } from "~/starchess/constants";
import {
  assertMineCap,
  MAX_MINES_PER_SIDE,
  minesFor,
} from "~/starchess/mines";
import { placementAfterCharon } from "~/starchess/specials/bishopCharon";
import { pawnSingleTarget } from "~/starchess/specials/pawnDouble";
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
} from "~/starchess/types";

export type EndScTurnResult = {
  resolved: ResolveTurnResult;
  next: ScFenSnapshot;
  ignoreAttacksOn: readonly Square[];
  events: ResolveEvent[];
  /** Surviving `rookSiege` toggles this resolve (entered or left siege). */
  siegedThisTurn: readonly Square[];
  /**
   * Board after pending checks + B specials, before classical resolve
   * (spawn / warp / mine drops / siege for deploy VFX).
   */
  afterB: {
    placement: string;
    mines: ScMine[];
    /** Siege flags after B toggles — used for attack vision + combat VFX. */
    siegedRooks: readonly Square[];
  };
  /** Board after pending king-checks only (pre-special attack VFX). */
  afterPending: {
    placement: string;
    mines: ScMine[];
    kingLives: ScFenSnapshot["kingLives"];
  };
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
      // Toggle applied via {@link toggleRookSiege} — placement unchanged.
      return { placement, mines };
    default:
      return { placement, mines };
  }
};

/**
 * Toggle siege mode for a living rook on `at`.
 * Returns false if the actor is missing / not a rook.
 */
const toggleRookSiege = (
  placement: string,
  sieged: Set<Square>,
  color: PieceColor,
  at: Square,
): boolean => {
  const actor = placementToMap(placement).get(at);
  if (!actor || actor.color !== color || actor.type !== "r") return false;
  if (sieged.has(at)) sieged.delete(at);
  else sieged.add(at);
  return true;
};

const classicalFor = (
  actions: readonly ScAction[],
  color: PieceColor,
): ClassicalPlan | null => {
  const c = actions.find((a) => a.timing === "C" && a.color === color);
  if (!c || c.timing !== "C") return null;
  return {
    color,
    from: c.from,
    to: c.to,
    ...(c.promotion ? { promotion: c.promotion } : {}),
  };
};

/** Shift a square by a file/rank delta; null if off-board. */
const shiftSquare = (s: Square, df: number, dr: number): Square | null => {
  const { file, rank } = parseSquare(s);
  return sq(file + df, rank + dr);
};

/**
 * After B relocates (pawnDouble / queenWarp), rewrite same-side classical
 * only when C matches the same step as B (UI stacks gas + same forward intent):
 * B e2→e3 + C e2→e3 ⇒ C e3→e4. Captures / longer doubles are left alone
 * (pre-B C would fizzle if the piece left `from`).
 */
const rewriteClassicalAfterB = (actions: readonly ScAction[]): ScAction[] => {
  const out = actions.map((a) => ({ ...a }));
  for (let i = 0; i < out.length; i += 1) {
    const c = out[i]!;
    if (c.timing !== "C") continue;
    const b = out.find(
      (a) =>
        a.timing === "B" &&
        a.color === c.color &&
        a.from === c.from &&
        a.to === c.to &&
        a.to &&
        (a.kind === "pawnDouble" || a.kind === "queenWarp"),
    );
    if (!b || !b.to) continue;
    const fromP = parseSquare(b.from);
    const toP = parseSquare(b.to);
    const df = toP.file - fromP.file;
    const dr = toP.rank - fromP.rank;
    const newFrom = b.to;
    const newTo = shiftSquare(c.to, df, dr);
    if (!newTo) continue;
    out[i] = { ...c, from: newFrom, to: newTo };
  }
  return out;
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
  const siegedThisTurn: Square[] = [];
  const sieged = new Set(snapshot.siegedRooks ?? []);

  // Vision for turn-start checks (pre-B siege flags) and classical fog.
  const rookModeFor = (sq: Square) => (sieged.has(sq) ? "siege" : "tank");
  const visionGame0 = new Chess(`${placement} w - - 0 1`);
  const visionOpts0 = { mines, rookModeFor };
  const visionW0 = getSideVision(visionGame0, "w", visionOpts0);
  const visionB0 = getSideVision(visionGame0, "b", visionOpts0);
  const isCheckVisible = (color: PieceColor, square: Square) => {
    const v = color === "w" ? visionW0 : visionB0;
    return v.litSquares.has(square) || v.revealedPieces.has(square);
  };

  // 1) Fog-visible legal king-checks resolve at turn start — before any special.
  const pendingApplied = applyPendingKingShots({
    placement,
    kingLives: snapshot.kingLives,
    pending: collectLegalKingChecks(placement, {
      isTargetVisible: isCheckVisible,
    }),
    mines,
  });
  placement = pendingApplied.placement;
  mines = pendingApplied.mines;
  let kingLives = pendingApplied.kingLives;
  const afterPending = {
    placement,
    mines: [...mines],
    kingLives: { ...kingLives },
  };
  for (const atk of pendingApplied.attacks) {
    events.push({
      id: `ev-${eventSeq++}`,
      phase: "attack",
      color: atk.color,
      from: atk.from,
      to: atk.to,
    });
  }

  // A King destroyed in the check phase ends the match immediately: the turn
  // bails out here, so no B special, classical move or F action resolves behind
  // a dead King. Both shots of a face-to-face duel are already applied above
  // (the pass is simultaneous), so mutual destruction still reads 0/0 = draw.
  if (kingLives.w === 0 || kingLives.b === 0) {
    const terminalBoard = {
      placement,
      kingLives: { ...kingLives },
      mines: [...mines],
    };
    return {
      resolved: {
        attacks: [...pendingApplied.attacks],
        afterAttack: terminalBoard,
        moves: [],
        afterMove: terminalBoard,
        pathRevealAttacks: [],
        afterAll: terminalBoard,
        mineTriggers: [],
        moveCollisions: [],
        pendingKingShotsArmed: [],
      },
      next: {
        placement,
        turn: snapshot.turn + 1,
        kingLives: { ...kingLives },
        phase: "O",
        gas: { ...snapshot.gas },
        gasIncome: snapshot.gasIncome,
        queue: { actions: [] },
        ...(mines.length ? { mines } : {}),
        ...(sieged.size ? { siegedRooks: [...sieged].sort() } : {}),
      },
      ignoreAttacksOn,
      events,
      siegedThisTurn,
      afterB: {
        placement,
        mines: [...mines],
        siegedRooks: [...sieged].sort(),
      },
      afterPending,
    };
  }

  // 2) B specials (spawn / mine / warp / siege / …).
  for (const a of byTiming(actions, "B")) {
    if (a.timing !== "B") continue;
    if (a.kind === "rookSiege") {
      if (toggleRookSiege(placement, sieged, a.color, a.from)) {
        siegedThisTurn.push(a.from);
        events.push(eventFor("specialBefore", a, `ev-${eventSeq++}`));
      }
      continue;
    }
    const applied = applySpecial(placement, mines, a, ignoreAttacksOn);
    placement = applied.placement;
    mines = applied.mines;
    events.push(eventFor("specialBefore", a, `ev-${eventSeq++}`));
  }

  const afterB = {
    placement,
    mines: [...mines],
    siegedRooks: [...sieged].sort() as Square[],
  };

  // Post-B vision (siege toggles / mines) for classical attack fog.
  const visionGame = new Chess(`${placement} w - - 0 1`);
  const visionOpts = { mines, rookModeFor };
  const visionW = getSideVision(visionGame, "w", visionOpts);
  const visionB = getSideVision(visionGame, "b", visionOpts);
  const isTargetVisible = (color: PieceColor, square: Square) => {
    const v = color === "w" ? visionW : visionB;
    return v.litSquares.has(square) || v.revealedPieces.has(square);
  };

  // 3) Classical attack → move (+ mine triggers).
  // Rewrite C that shares from with a B relocate so UI pre-B intents still land.
  const actionsAfterB = rewriteClassicalAfterB(actions);
  const white = classicalFor(actionsAfterB, "w");
  const black = classicalFor(actionsAfterB, "b");
  const classical = resolveTurn({
    placement,
    kingLives,
    white,
    black,
    ignoreAttacksOn,
    mines,
    isTargetVisible,
    pathVisionOpts: { mines, rookModeFor },
    siegedRooks: afterB.siegedRooks,
  });

  const resolved: ResolveTurnResult = {
    ...classical,
    attacks: [...pendingApplied.attacks, ...classical.attacks],
  };

  for (const atk of classical.attacks) {
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
  for (const atk of resolved.pathRevealAttacks) {
    events.push({
      id: `ev-${eventSeq++}`,
      phase: "attack",
      color: atk.color,
      from: atk.from,
      to: atk.to,
    });
  }

  placement = resolved.afterAll.placement;
  mines = resolved.afterAll.mines;
  kingLives = resolved.afterAll.kingLives;

  // Drop siege flags for squares that no longer hold a rook after combat.
  const boardAfterMove = placementToMap(placement);
  for (const sq of sieged) {
    if (boardAfterMove.get(sq)?.type !== "r") sieged.delete(sq);
  }

  // A King destroyed during the classical pass — including by a fog-discovered
  // check, where a slider walks its ray onto a king it could not see at turn
  // start — ends the match immediately, exactly like a check-phase kill. The
  // classical pass itself is simultaneous and resolves as one unit, so the bail
  // out happens on its far side: no F special resolves behind a dead King.
  if (kingLives.w === 0 || kingLives.b === 0) {
    return {
      resolved,
      next: {
        placement,
        turn: snapshot.turn + 1,
        kingLives: { ...kingLives },
        phase: "O",
        gas: { ...snapshot.gas },
        gasIncome: snapshot.gasIncome,
        queue: { actions: [] },
        ...(mines.length ? { mines } : {}),
        ...(sieged.size ? { siegedRooks: [...sieged].sort() } : {}),
      },
      ignoreAttacksOn,
      events,
      siegedThisTurn,
      afterB,
      afterPending,
    };
  }

  // 4) F specials (post-move siege follow / late drops).
  // Actor square: prefer where our unit still stands (handles fire-in-place C,
  // quiet relocate, and gas ride after rewritten C).
  for (const a of byTiming(actions, "F")) {
    if (a.timing !== "F") continue;
    const origC = classicalFor(actions, a.color);
    const rewrittenC = classicalFor(actionsAfterB, a.color);
    const boardAfter = placementToMap(placement);
    const candidates: Square[] = [a.from];
    if (rewrittenC) candidates.push(rewrittenC.to, rewrittenC.from);
    if (origC) candidates.push(origC.to, origC.from);
    const at =
      candidates.find((s) => {
        const p = boardAfter.get(s);
        return !!p && p.color === a.color;
      }) ?? a.from;
    const actor = boardAfter.get(at);
    if (!actor || actor.color !== a.color) continue;

    if (a.kind === "rookSiege") {
      if (actor.type !== "r") continue;
      if (toggleRookSiege(placement, sieged, a.color, at)) {
        siegedThisTurn.push(at);
        events.push(eventFor("specialAfter", a, `ev-${eventSeq++}`));
      }
      continue;
    }

    if (a.kind === "pawnDouble") {
      if (actor.type !== "p") continue;
      // Recompute +1 from the post-C square; fizzle if blocked / off-board.
      const to = pawnSingleTarget(at, a.color);
      if (!to || boardAfter.has(to)) continue;
      placement = relocate(placement, at, to);
      events.push(eventFor("specialAfter", { ...a, from: at, to }, `ev-${eventSeq++}`));
      continue;
    }

    const applied = applySpecial(
      placement,
      mines,
      { ...a, from: at },
      ignoreAttacksOn,
    );
    placement = applied.placement;
    mines = applied.mines;
    events.push(eventFor("specialAfter", a, `ev-${eventSeq++}`));
  }

  for (const color of ["w", "b"] as const) {
    if (minesFor(mines, color).length > MAX_MINES_PER_SIDE) {
      throw new Error(`endScTurn: ${color} mine cap exceeded`);
    }
  }

  {
    let w = 0;
    let b = 0;
    for (const ch of placement) {
      if (ch === "K") w += 1;
      else if (ch === "k") b += 1;
    }
    if (w !== 1 || b !== 1) {
      throw new Error(
        `endScTurn: illegal king count (w=${w} b=${b}) after resolve: ${placement}`,
      );
    }
  }

  const nextTurn = snapshot.turn + 1;
  const income = energyForTurn(Math.max(1, nextTurn));
  const gasIncome = { w: income, b: income };
  const siegedRooks = [...sieged].sort();
  // Planning check rings come from live geometry — do not persist deferred H:.
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
  };

  return {
    resolved,
    next,
    events,
    ignoreAttacksOn,
    siegedThisTurn,
    afterB,
    afterPending,
  };
};
