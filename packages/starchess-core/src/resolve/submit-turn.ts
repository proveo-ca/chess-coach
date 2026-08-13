// SPEC: _spec/packages/starchess-core/resolve.puml, _spec/packages/starchess-core/overview.puml, _spec/packages/starchess-core/submit-turn-activity.puml, _spec/packages/starchess-core/mine-contact.puml, _spec/packages/starchess-core/turn-queue-sequence.puml, _spec/apps/starchess/core/turn/turn-facade.puml
import type { Square } from "chess.js";

import {
  collectLegalKingChecks,
  mapToPlacement,
  parseSquare,
  placementToMap,
  sq,
  type ScPiece,
} from "../board/placement";
import { energyForTurn } from "../rules/constants";
import {
  assertMineCap,
  MAX_MINES_PER_SIDE,
  minesFor,
} from "../board/mines";
import { mineContact, withoutMine } from "../board/mine-contact";
import { placementAfterCharon } from "../rules/specials/bishopCharon";
import {
  canPawnDoubleStep,
  pawnSingleTarget,
} from "../rules/specials/pawnDouble";
import {
  applyPendingKingShots,
  resolveTurn,
  type ResolvePromotion,
  type ResolveTurnResult,
  type ResolveMove,
} from "./resolve-turn";
import { getSideVision } from "../board/vision";
import type {
  ClassicalPlan,
  PieceColor,
  ScAction,
  ScFenSnapshot,
  ScMine,
  SpecialKind,
  StarChessColor,
  StarChessPiece,
} from "../model/types";

export type ResolveEvent = {
  id: string;
  phase: "specialBefore" | "attack" | "move" | "specialAfter";
  color: StarChessColor;
  from?: Square;
  to?: Square;
  kind?: ScAction["kind"];
  victim?: { type: StarChessPiece; color: StarChessColor };
  mineColor?: StarChessColor;
  unit?: StarChessPiece;
};

export type EndScTurnResult = {
  resolved: ResolveTurnResult;
  next: ScFenSnapshot;
  ignoreAttacksOn: readonly Square[];
  events: ResolveEvent[];
  siegedThisTurn: readonly Square[];
  afterB: {
    placement: string;
    mines: ScMine[];
    siegedRooks: readonly Square[];
  };
  afterPending: {
    placement: string;
    mines: ScMine[];
    kingLives: ScFenSnapshot["kingLives"];
  };
  bMoves: ResolveMove[];
  fMoves: ResolveMove[];
  queue: readonly ScAction[];
};

export type EndScTurnOptions = {
  skipTurnStartChecks?: boolean;
};

export type BeginScTurnResult = {
  changed: boolean;
  attacks: ResolveTurnResult["attacks"];
  afterPending: EndScTurnResult["afterPending"];
  next: ScFenSnapshot;
  asResolve: EndScTurnResult | null;
};

const emptyBoard = (
  placement: string,
  kingLives: ScFenSnapshot["kingLives"],
  mines: ScMine[],
): ResolveTurnResult["afterAttack"] => ({
  placement,
  kingLives: { ...kingLives },
  mines: [...mines],
});

const visionCheckGate = (
  placement: string,
  mines: readonly ScMine[],
  siegedRooks: readonly Square[] | undefined,
) => {
  const sieged = new Set(siegedRooks ?? []);
  const rookModeFor = (s: Square) => (sieged.has(s) ? "siege" : "tank");
  const visionOpts0 = { mines: [...mines], rookModeFor };
  const visionW0 = getSideVision(placement, "w", visionOpts0);
  const visionB0 = getSideVision(placement, "b", visionOpts0);
  return (color: PieceColor, square: Square) => {
    const v = color === "w" ? visionW0 : visionB0;
    return v.litSquares.has(square) || v.revealedPieces.has(square);
  };
};

export const refillTurnGas = (snap: ScFenSnapshot): ScFenSnapshot => ({
  ...snap,
  gas: { w: snap.gasIncome.w, b: snap.gasIncome.b },
});

export const beginScTurn = (snapshot: ScFenSnapshot): BeginScTurnResult => {
  if (snapshot.phase !== "P") {
    throw new Error(`beginScTurn requires phase P (got ${snapshot.phase})`);
  }

  const minesIn = [...(snapshot.mines ?? [])];
  const isCheckVisible = visionCheckGate(
    snapshot.placement,
    minesIn,
    snapshot.siegedRooks,
  );
  const pendingApplied = applyPendingKingShots({
    placement: snapshot.placement,
    kingLives: snapshot.kingLives,
    pending: collectLegalKingChecks(snapshot.placement, {
      isTargetVisible: isCheckVisible,
    }),
    mines: minesIn,
  });

  const afterPending = {
    placement: pendingApplied.placement,
    mines: [...pendingApplied.mines],
    kingLives: { ...pendingApplied.kingLives },
  };
  const changed = pendingApplied.attacks.length > 0;
  const terminal =
    pendingApplied.kingLives.w === 0 || pendingApplied.kingLives.b === 0;
  const sieged = [...(snapshot.siegedRooks ?? [])].sort();
  const board = emptyBoard(
    afterPending.placement,
    afterPending.kingLives,
    afterPending.mines,
  );

  const next: ScFenSnapshot = {
    placement: afterPending.placement,
    turn: terminal ? snapshot.turn + 1 : snapshot.turn,
    kingLives: { ...afterPending.kingLives },
    phase: terminal ? "O" : "P",
    gas: { w: snapshot.gasIncome.w, b: snapshot.gasIncome.b },
    gasIncome: snapshot.gasIncome,
    queue: { actions: [] },
    ...(afterPending.mines.length ? { mines: afterPending.mines } : {}),
    ...(sieged.length ? { siegedRooks: sieged } : {}),
  };

  if (!changed) {
    const { specialsUsed: _cleared, ...rest } = snapshot;
    return {
      changed: false,
      attacks: [],
      afterPending: {
        placement: snapshot.placement,
        mines: minesIn,
        kingLives: { ...snapshot.kingLives },
      },
      next: refillTurnGas({
        ...rest,
        queue: snapshot.queue ?? { actions: [] },
      }),
      asResolve: null,
    };
  }

  const events: ResolveEvent[] = pendingApplied.attacks.map((atk, i) => ({
    id: `ev-begin-${i}`,
    phase: "attack" as const,
    color: atk.color,
    from: atk.from,
    to: atk.to,
  }));

  const asResolve: EndScTurnResult = {
    resolved: {
      attacks: [...pendingApplied.attacks],
      afterAttack: board,
      moves: [],
      afterMove: board,
      pathRevealAttacks: [],
      afterAll: board,
      mineTriggers: [],
      pathRevealMineTriggers: [],
      moveCollisions: [],
      promotions: [],
      pendingKingShotsArmed: [],
    },
    next,
    ignoreAttacksOn: [],
    events,
    siegedThisTurn: [],
    afterB: {
      placement: afterPending.placement,
      mines: afterPending.mines,
      siegedRooks: sieged,
    },
    afterPending,
    bMoves: [],
    fMoves: [],
    queue: [],
  };

  return {
    changed: true,
    attacks: [...pendingApplied.attacks],
    afterPending,
    next,
    asResolve,
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

type ArrivalMine = {
  placement: string;
  mines: ScMine[];
  victim?: { type: StarChessPiece; color: StarChessColor };
  mineColor?: StarChessColor;
};

const applyArrivalMine = (
  placement: string,
  mines: ScMine[],
  at: Square,
  color: StarChessColor,
  arriving: ScPiece,
): ArrivalMine => {
  const hit = mineContact({
    mines,
    color,
    piece: arriving.type,
    squares: [at],
    mode: "arrive",
  });
  if (hit.kind !== "detonated") return { placement, mines };
  const board = placementToMap(placement);
  board.delete(at);
  return {
    placement: mapToPlacement(board),
    mines: withoutMine(mines, hit),
    victim: { type: arriving.type, color: arriving.color },
    mineColor: hit.mineColor,
  };
};

const applySpecial = (
  placement: string,
  mines: ScMine[],
  action: Extract<ScAction, { timing: "B" | "F" }>,
  ignoreAttacksOn: Square[],
): {
  placement: string;
  mines: ScMine[];
  victim?: { type: StarChessPiece; color: StarChessColor };
  mineColor?: StarChessColor;
} => {
  const kind = action.kind as SpecialKind;
  switch (kind) {
    case "bishopSnipe": {
      if (!action.to) return { placement, mines };
      return { placement: placementAfterCharon(placement, action.to), mines };
    }
    case "queenWarp": {
      if (!action.to) return { placement, mines };
      ignoreAttacksOn.push(action.from);
      const hull = placementToMap(placement).get(action.from);
      if (!hull || hull.color !== action.color) return { placement, mines };
      const landed = relocate(placement, action.from, action.to);
      return applyArrivalMine(landed, mines, action.to, action.color, hull);
    }
    case "pawnDouble": {
      if (!action.to) return { placement, mines };
      const marine = placementToMap(placement).get(action.from);
      const stepped = relocate(placement, action.from, action.to);
      if (!marine) return { placement: stepped, mines };
      return applyArrivalMine(stepped, mines, action.to, action.color, marine);
    }
    case "spawn": {
      if (!action.to || !action.unit) return { placement, mines };
      const occupant = placementToMap(placement).get(action.to);
      const deployed = { type: action.unit, color: action.color };
      const landed = placeUnit(placement, action.to, deployed);
      const crush =
        occupant && occupant.color !== action.color
          ? { victim: { type: occupant.type, color: occupant.color } }
          : {};
      const blast = applyArrivalMine(landed, mines, action.to, action.color, deployed);
      if (blast.mineColor) {
        return {
          placement: blast.placement,
          mines: blast.mines,
          mineColor: blast.mineColor,
          ...crush,
        };
      }
      return { placement: landed, mines, ...crush };
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

const collectSpecialsUsed = (
  actions: readonly ScAction[],
  actionsAfterB: readonly ScAction[],
  finalPlacement: string,
  bMoves: readonly { from: Square; to: Square }[],
  fMoves: readonly { from: Square; to: Square }[],
  promotions: readonly { at: Square }[] = [],
): Square[] => {
  const used = new Set<Square>();
  for (const a of actions) {
    if (a.timing === "B" || a.timing === "F") used.add(a.from);
  }
  const migrate = (from: Square, to: Square) => {
    if (from === to || !used.has(from)) return;
    used.delete(from);
    used.add(to);
  };
  for (const m of bMoves) migrate(m.from, m.to);
  for (const a of actions) {
    if (a.timing === "B" && a.kind === "queenWarp" && a.to) migrate(a.from, a.to);
  }
  for (const a of actionsAfterB) {
    if (a.timing === "C") migrate(a.from, a.to);
  }
  for (const m of fMoves) migrate(m.from, m.to);
  for (const p of promotions) used.delete(p.at);
  const map = placementToMap(finalPlacement);
  return [...used].filter((sq) => map.has(sq)).sort();
};

const shiftSquare = (s: Square, df: number, dr: number): Square | null => {
  const { file, rank } = parseSquare(s);
  return sq(file + df, rank + dr);
};

export const rewriteClassicalAfterB = (
  actions: readonly ScAction[],
  placement: string,
): ScAction[] => {
  const occupied = placementToMap(placement);
  const out = actions.map((a) => ({ ...a }));
  for (let i = 0; i < out.length; i += 1) {
    const c = out[i]!;
    if (c.timing !== "C") continue;
    const b = out.find(
      (a) =>
        a.timing === "B" &&
        a.color === c.color &&
        a.from === c.from &&
        a.to &&
        (a.kind === "pawnDouble" || a.kind === "queenWarp"),
    );
    if (!b || !b.to) continue;

    const fromP = parseSquare(b.from);
    const toP = parseSquare(b.to);
    const df = toP.file - fromP.file;
    const dr = toP.rank - fromP.rank;
    const newTo = shiftSquare(c.to, df, dr);
    if (!newTo) continue;

    if (b.kind === "pawnDouble") {
      const sameFile = c.from[0] === c.to[0];
      const ranks = Math.abs(Number(c.to[1]) - Number(c.from[1]));
      const forward =
        (Number(c.to[1]) - Number(c.from[1])) * (b.color === "w" ? 1 : -1) > 0;
      const onStartRank = canPawnDoubleStep(c.from, b.color);
      if (
        c.kind !== "classical" ||
        !sameFile ||
        !forward ||
        (ranks !== 1 && (ranks !== 2 || !onStartRank)) ||
        occupied.has(newTo)
      ) {
        continue;
      }
    } else if (b.to !== c.to) {
      continue;
    }

    out[i] = { ...c, from: b.to, to: newTo };
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
  kind: action.kind,
});

export const endScTurn = (
  snapshot: ScFenSnapshot,
  opts?: EndScTurnOptions,
): EndScTurnResult => {
  if (snapshot.phase !== "P") {
    throw new Error(`endScTurn requires phase P (got ${snapshot.phase})`);
  }

  const skipChecks = opts?.skipTurnStartChecks === true;
  const actions = snapshot.queue?.actions ?? [];
  const events: ResolveEvent[] = [];
  const ignoreAttacksOn: Square[] = [];
  let placement = snapshot.placement;
  let mines: ScMine[] = [...(snapshot.mines ?? [])];
  let eventSeq = 0;
  const siegedThisTurn: Square[] = [];
  const sieged = new Set(snapshot.siegedRooks ?? []);
  const bMoves: ResolveMove[] = [];
  const fMoves: ResolveMove[] = [];
  const gasPromotions: ResolvePromotion[] = [];

  const log = {
    shot: (a: { color: PieceColor; from: Square; to: Square }) =>
      events.push({
        id: `ev-${eventSeq++}`,
        phase: "attack",
        color: a.color,
        from: a.from,
        to: a.to,
      }),
    step: (m: { color: PieceColor; from: Square; to: Square }) =>
      events.push({
        id: `ev-${eventSeq++}`,
        phase: "move",
        color: m.color,
        from: m.from,
        to: m.to,
      }),
    special: (
      phase: ResolveEvent["phase"],
      action: ScAction,
      extra: Partial<ResolveEvent> = {},
    ) =>
      events.push({
        ...eventFor(phase, action, `ev-${eventSeq++}`),
        ...extra,
      }),
  };

  const finish = (args: {
    resolved: ResolveTurnResult;
    afterB: EndScTurnResult["afterB"];
    bMoves?: ResolveMove[];
    fMoves?: ResolveMove[];
    queue?: readonly ScAction[];
    specialsUsed?: readonly Square[];
  }): EndScTurnResult => {
    const nextTurn = snapshot.turn + 1;
    const income = energyForTurn(Math.max(1, nextTurn));
    const siegedRooks = [...sieged].sort();
    const terminal = kingLives.w === 0 || kingLives.b === 0;
    return {
      resolved: args.resolved,
      next: {
        placement,
        turn: nextTurn,
        kingLives: { ...kingLives },
        phase: terminal ? "O" : "P",
        gas: { w: 0, b: 0 },
        gasIncome: { w: income, b: income },
        queue: { actions: [] },
        ...(mines.length ? { mines } : {}),
        ...(siegedRooks.length ? { siegedRooks } : {}),
        ...(args.specialsUsed?.length
          ? { specialsUsed: [...args.specialsUsed] }
          : {}),
      },
      ignoreAttacksOn,
      events,
      siegedThisTurn,
      afterB: args.afterB,
      afterPending,
      bMoves: args.bMoves ?? [],
      fMoves: args.fMoves ?? [],
      queue: args.queue ?? [],
    };
  };

  const rookModeFor = (sq: Square) => (sieged.has(sq) ? "siege" : "tank");
  const visionOpts0 = { mines, rookModeFor };
  const visionW0 = getSideVision(placement, "w", visionOpts0);
  const visionB0 = getSideVision(placement, "b", visionOpts0);
  const isCheckVisible = (color: PieceColor, square: Square) => {
    const v = color === "w" ? visionW0 : visionB0;
    return v.litSquares.has(square) || v.revealedPieces.has(square);
  };

  const pendingApplied = skipChecks
    ? {
        placement,
        mines,
        kingLives: { ...snapshot.kingLives },
        attacks: [] as ReturnType<typeof applyPendingKingShots>["attacks"],
      }
    : applyPendingKingShots({
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
  for (const atk of pendingApplied.attacks) log.shot(atk);

  if (kingLives.w === 0 || kingLives.b === 0) {
    const terminalBoard = {
      placement,
      kingLives: { ...kingLives },
      mines: [...mines],
    };
    return finish({
      resolved: {
        attacks: [...pendingApplied.attacks],
        afterAttack: terminalBoard,
        moves: [],
        afterMove: terminalBoard,
        pathRevealAttacks: [],
        afterAll: terminalBoard,
        mineTriggers: [],
        pathRevealMineTriggers: [],
        moveCollisions: [],
        promotions: [],
        pendingKingShotsArmed: [],
      },
      afterB: {
        placement,
        mines: [...mines],
        siegedRooks: [...sieged].sort(),
      },
    });
  }

  for (const a of byTiming(actions, "B")) {
    if (a.timing !== "B") continue;
    if (a.kind === "rookSiege") {
      if (toggleRookSiege(placement, sieged, a.color, a.from)) {
        siegedThisTurn.push(a.from);
        log.special("specialBefore", a);
      }
      continue;
    }
    const applied = applySpecial(placement, mines, a, ignoreAttacksOn);
    if (a.kind === "pawnDouble" && a.to && applied.placement !== placement) {
      bMoves.push({
        piece: "p",
        color: a.color,
        from: a.from,
        to: a.to,
      });
      const lastRank = a.color === "w" ? 8 : 1;
      if (Number(a.to[1]) === lastRank && a.promotion && !applied.mineColor) {
        applied.placement = placeUnit(applied.placement, a.to, {
          type: a.promotion,
          color: a.color,
        });
        gasPromotions.push({
          color: a.color,
          from: a.from,
          at: a.to,
          unit: a.promotion,
        });
      }
    }
    placement = applied.placement;
    mines = applied.mines;
    log.special("specialBefore", a, {
      ...(a.kind === "spawn" && a.unit ? { unit: a.unit } : {}),
      ...(applied.victim ? { victim: applied.victim } : {}),
      ...(applied.mineColor ? { mineColor: applied.mineColor } : {}),
    });
  }

  const afterB = {
    placement,
    mines: [...mines],
    siegedRooks: [...sieged].sort() as Square[],
  };

  const visionOpts = { mines, rookModeFor };
  const visionW = getSideVision(placement, "w", visionOpts);
  const visionB = getSideVision(placement, "b", visionOpts);
  const isTargetVisible = (color: PieceColor, square: Square) => {
    const v = color === "w" ? visionW : visionB;
    return v.litSquares.has(square) || v.revealedPieces.has(square);
  };

  const actionsAfterB = rewriteClassicalAfterB(actions, placement);
  {
    const boardAfterB = placementToMap(placement);
    for (const a of actionsAfterB) {
      if (a.timing !== "C") continue;
      const piece = boardAfterB.get(a.from);
      if (!piece || piece.type !== "p" || piece.color !== a.color) continue;
      const lastRank = a.color === "w" ? 8 : 1;
      if (Number(a.to[1]) === lastRank && !a.promotion) {
        throw new Error(
          `endScTurn: classical last-rank ${a.from}→${a.to} needs promotion`,
        );
      }
    }
  }
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

  let resolved: ResolveTurnResult = {
    ...classical,
    attacks: [...pendingApplied.attacks, ...classical.attacks],
    promotions: [...gasPromotions, ...classical.promotions],
  };

  for (const atk of classical.attacks) log.shot(atk);
  for (const mv of resolved.moves) log.step(mv);
  for (const blast of resolved.mineTriggers) log.step(blast);
  for (const hit of resolved.moveCollisions) log.step(hit);
  for (const atk of resolved.pathRevealAttacks) log.shot(atk);

  placement = resolved.afterAll.placement;
  mines = resolved.afterAll.mines;
  kingLives = resolved.afterAll.kingLives;

  const boardAfterMove = placementToMap(placement);
  for (const sq of sieged) {
    if (boardAfterMove.get(sq)?.type !== "r") sieged.delete(sq);
  }

  if (kingLives.w === 0 || kingLives.b === 0) {
    return finish({ resolved, afterB, bMoves, queue: [...actions] });
  }

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

    const rewritten: ScAction =
      a.kind === "knightMine"
        ? { ...a, from: at, to: at }
        : { ...a, from: at };

    if (a.kind === "rookSiege") {
      if (actor.type !== "r") continue;
      if (toggleRookSiege(placement, sieged, a.color, at)) {
        siegedThisTurn.push(at);
        log.special("specialAfter", rewritten);
      }
      continue;
    }

    if (a.kind === "pawnDouble") {
      if (actor.type !== "p") continue;
      const to = pawnSingleTarget(at, a.color);
      if (!to || boardAfter.has(to)) continue;
      const stepped = applyArrivalMine(
        relocate(placement, at, to),
        mines,
        to,
        a.color,
        actor,
      );
      placement = stepped.placement;
      mines = stepped.mines;
      fMoves.push({ piece: "p", color: a.color, from: at, to });
      const lastRank = a.color === "w" ? 8 : 1;
      if (Number(to[1]) === lastRank && a.promotion && !stepped.mineColor) {
        placement = placeUnit(placement, to, {
          type: a.promotion,
          color: a.color,
        });
        gasPromotions.push({
          color: a.color,
          from: a.from,
          at: to,
          unit: a.promotion,
        });
      }
      log.special("specialAfter", { ...rewritten, to }, {
        ...(stepped.victim ? { victim: stepped.victim } : {}),
        ...(stepped.mineColor ? { mineColor: stepped.mineColor } : {}),
      });
      continue;
    }

    const applied = applySpecial(placement, mines, rewritten, ignoreAttacksOn);
    placement = applied.placement;
    mines = applied.mines;
    log.special("specialAfter", rewritten, {
      ...(a.kind === "spawn" && a.unit ? { unit: a.unit } : {}),
      ...(applied.victim ? { victim: applied.victim } : {}),
      ...(applied.mineColor ? { mineColor: applied.mineColor } : {}),
    });
  }

  resolved = {
    ...resolved,
    promotions: [...gasPromotions, ...classical.promotions],
  };

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

  return finish({
    resolved,
    afterB,
    bMoves,
    fMoves,
    queue: [...actions],
    specialsUsed: collectSpecialsUsed(
      actions,
      actionsAfterB,
      placement,
      bMoves,
      fMoves,
      resolved.promotions,
    ),
  });
};
