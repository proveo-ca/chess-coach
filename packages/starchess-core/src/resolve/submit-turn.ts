// SPEC: _spec/packages/starchess-core/resolve.puml, _spec/packages/starchess-core/overview.puml, _spec/packages/starchess-core/submit-turn-activity.puml, _spec/packages/starchess-core/mine-contact.puml, _spec/packages/starchess-core/turn-queue-sequence.puml, _spec/apps/starchess/core/turn/turn-facade.puml, _spec/packages/starchess-core/gas-phase-vacancy.puml
import type { Square } from "chess.js";

import {
  collectLegalCCChecks,
  mapToPlacement,
  placementToMap,
  type ScPiece,
} from "../board/placement";
import { energyForTurn } from "../rules/constants";
import {
  assertMineCap,
  MAX_MINES_PER_SIDE,
  minesFor,
} from "../board/mines";
import { mineContact, withoutMine } from "../board/mine-contact";
import { charonStrikeTarget, placementAfterMechaCharon } from "../rules/specials/mechaCharon";
import { marineSingleTarget } from "../rules/specials/stimStep";
import { classicalRewriteCoordinatesAfterB, orderBHeadsFirst } from "../rules/planning-order";
import {
  applyPendingCCShots,
  resolveTurn,
  type ResolvePromotion,
  type ResolveTurnResult,
  type ResolveMove,
} from "./resolve-turn";
import { getSideVision } from "../board/vision";
import { queueGasSpent } from "../scfen/codec";
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

export { orderBHeadsFirst } from "../rules/planning-order";

export type ResolveEvent = {
  id: string;
  phase: "specialBefore" | "attack" | "move" | "specialAfter";
  color: StarChessColor;
  from?: Square;
  to?: Square;
  kind?: ScAction["kind"];
  victim?: { type: StarChessPiece; color: StarChessColor };
  /**
   * Jump collision: the occupant at the landing square (`victim`) and the
   * jumping ship both die. `victim` carries the occupant, `collider` the ship.
   */
  collider?: { type: StarChessPiece; color: StarChessColor };
  mineColor?: StarChessColor;
  /** Wake tile of a mine that chased the arriving unit to `to`. */
  chaseFrom?: Square;
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
    siegedTanks: readonly Square[];
  };
  afterPending: {
    placement: string;
    mines: ScMine[];
    ccLives: ScFenSnapshot["ccLives"];
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
  ccLives: ScFenSnapshot["ccLives"],
  mines: ScMine[],
): ResolveTurnResult["afterAttack"] => ({
  placement,
  ccLives: { ...ccLives },
  mines: [...mines],
});

const visionCheckGate = (
  placement: string,
  mines: readonly ScMine[],
  siegedTanks: readonly Square[] | undefined,
) => {
  const sieged = new Set(siegedTanks ?? []);
  const tankModeFor = (s: Square) => (sieged.has(s) ? "siege" : "tank");
  const visionOpts0 = { mines: [...mines], tankModeFor };
  const visionW0 = getSideVision(placement, "w", visionOpts0);
  const visionB0 = getSideVision(placement, "b", visionOpts0);
  return (color: PieceColor, square: Square) => {
    const v = color === "w" ? visionW0 : visionB0;
    return v.litSquares.has(square) || v.revealedPieces.has(square);
  };
};

export const refillTurnGas = (snap: ScFenSnapshot): ScFenSnapshot => {
  const spent = queueGasSpent(snap.queue?.actions);
  return {
    ...snap,
    gas: {
      w: Math.max(0, snap.gasIncome.w - spent.w),
      b: Math.max(0, snap.gasIncome.b - spent.b),
    },
  };
};

export const beginScTurn = (snapshot: ScFenSnapshot): BeginScTurnResult => {
  if (snapshot.phase !== "P") {
    throw new Error(`beginScTurn requires phase P (got ${snapshot.phase})`);
  }

  const minesIn = [...(snapshot.mines ?? [])];
  const isCheckVisible = visionCheckGate(
    snapshot.placement,
    minesIn,
    snapshot.siegedTanks,
  );
  const pendingApplied = applyPendingCCShots({
    placement: snapshot.placement,
    ccLives: snapshot.ccLives,
    pending: collectLegalCCChecks(snapshot.placement, {
      isTargetVisible: isCheckVisible,
    }),
    mines: minesIn,
  });

  const afterPending = {
    placement: pendingApplied.placement,
    mines: [...pendingApplied.mines],
    ccLives: { ...pendingApplied.ccLives },
  };
  const changed = pendingApplied.attacks.length > 0;
  const terminal =
    pendingApplied.ccLives.w === 0 || pendingApplied.ccLives.b === 0;
  const sieged = [...(snapshot.siegedTanks ?? [])].sort();
  const board = emptyBoard(
    afterPending.placement,
    afterPending.ccLives,
    afterPending.mines,
  );

  const next: ScFenSnapshot = {
    placement: afterPending.placement,
    turn: terminal ? snapshot.turn + 1 : snapshot.turn,
    ccLives: { ...afterPending.ccLives },
    phase: terminal ? "O" : "P",
    gas: { w: snapshot.gasIncome.w, b: snapshot.gasIncome.b },
    gasIncome: snapshot.gasIncome,
    queue: { actions: [] },
    ...(afterPending.mines.length ? { mines: afterPending.mines } : {}),
    ...(sieged.length ? { siegedTanks: sieged } : {}),
  };

  if (!changed) {
    const { specialsUsed: _cleared, ...rest } = snapshot;
    return {
      changed: false,
      attacks: [],
      afterPending: {
        placement: snapshot.placement,
        mines: minesIn,
        ccLives: { ...snapshot.ccLives },
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
      pendingCCShotsArmed: [],
    },
    next,
    ignoreAttacksOn: [],
    events,
    siegedThisTurn: [],
    afterB: {
      placement: afterPending.placement,
      mines: afterPending.mines,
      siegedTanks: sieged,
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
  chaseFrom?: Square;
};

/**
 * `squares` is the arriving unit's walk this turn in order — the last entry is
 * the tile it comes to rest on. A marine mid-Extra-Step passes its previous hop
 * so a mine woken there chases it here instead of stopping it short.
 */
const applyArrivalMine = (
  placement: string,
  mines: ScMine[],
  squares: readonly Square[],
  color: StarChessColor,
  arriving: ScPiece,
): ArrivalMine => {
  const hit = mineContact({
    mines,
    color,
    piece: arriving.type,
    squares,
    mode: "arrive",
  });
  if (hit.kind !== "detonated") return { placement, mines };
  const board = placementToMap(placement);
  board.delete(hit.at);
  return {
    placement: mapToPlacement(board),
    mines: withoutMine(mines, hit),
    victim: { type: arriving.type, color: arriving.color },
    mineColor: hit.mineColor,
    ...(hit.chaseFrom ? { chaseFrom: hit.chaseFrom } : {}),
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
  collider?: { type: StarChessPiece; color: StarChessColor };
  mineColor?: StarChessColor;
} => {
  const kind = action.kind as SpecialKind;
  switch (kind) {
    case "charonMissiles": {
      if (!action.to) return { placement, mines };
      // Fire-and-forget: paid gas resolves from the queued square even when
      // the Mecha is gone. Kill iff the aim is the first ship on its ray for
      // the action's side; anything else fizzles off-board. The event still
      // logs so the timeline plays the volley / fizzle.
      const board = placementToMap(placement);
      const kill = charonStrikeTarget(board, action.from, action.to, action.color);
      if (!kill) return { placement, mines };
      const victim = board.get(kill)!;
      return {
        placement: placementAfterMechaCharon(placement, kill),
        mines,
        victim: { type: victim.type, color: victim.color },
      };
    }
    case "tacticalJump": {
      if (!action.to) return { placement, mines };
      ignoreAttacksOn.push(action.from);
      const board = placementToMap(placement);
      const hull = board.get(action.from);
      if (!hull || hull.color !== action.color) return { placement, mines };
      const occupant = board.get(action.to);
      if (occupant && occupant.color === action.color) return { placement, mines };
      if (occupant && occupant.type !== "k") {
        // Jump collision: ship and occupant meet on the landing square —
        // both die, neither survives onto it.
        board.delete(action.from);
        board.delete(action.to);
        return {
          placement: mapToPlacement(board),
          mines,
          victim: { type: occupant.type, color: occupant.color },
          collider: { type: hull.type, color: hull.color },
        };
      }
      if (occupant) {
        // A Command Center takes the jumper: the ship dies on its square.
        board.delete(action.from);
        return {
          placement: mapToPlacement(board),
          mines,
          victim: { type: hull.type, color: hull.color },
        };
      }
      const landed = relocate(placement, action.from, action.to);
      return applyArrivalMine(landed, mines, [action.to], action.color, hull);
    }
    case "stimStep": {
      if (!action.to) return { placement, mines };
      const marine = placementToMap(placement).get(action.from);
      const stepped = relocate(placement, action.from, action.to);
      if (!marine) return { placement: stepped, mines };
      return applyArrivalMine(stepped, mines, [action.to], action.color, marine);
    }
    case "deploy": {
      if (!action.to || !action.unit) return { placement, mines };
      const occupant = placementToMap(placement).get(action.to);
      // Command Centers are never crushable (validation rejects them); defense in depth
      // so a bypassed queue can never delete a Command Center via deploy.
      if (occupant?.type === "k") {
        throw new Error(`spawn cannot crush Command Center on ${action.to}`);
      }
      const deployed = { type: action.unit, color: action.color };
      const landed = placeUnit(placement, action.to, deployed);
      // Deploy over ally or enemy non-ccs — victim shows death, deployed survives
      const crush = occupant
        ? { victim: { type: occupant.type, color: occupant.color } }
        : {};
      const blast = applyArrivalMine(landed, mines, [action.to], action.color, deployed);
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
    case "spiderMine": {
      const at = action.to ?? action.from;
      const next = [...mines, { color: action.color, at }];
      assertMineCap(next, action.color);
      return { placement, mines: next };
    }
    case "siegeMode":
      return { placement, mines };
    default:
      return { placement, mines };
  }
};

const toggleTankSiege = (
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

/** The queued Extra Step on this marine, if the queue holds one. */
const extraStepFor = (
  actions: readonly ScAction[],
  color: PieceColor,
  timing: "B" | "F",
  at: Square,
): Extract<ScAction, { timing: "B" | "F" }> | undefined =>
  actions.find(
    (a): a is Extract<ScAction, { timing: "B" | "F" }> =>
      a.timing === timing &&
      a.kind === "stimStep" &&
      a.color === color &&
      (timing === "B" ? a.to === at : a.from === at),
  );

/**
 * Tag a classical plan with the Extra Step legs that share its walk, so the
 * mine table sees one walk instead of two independent arrivals.
 *
 * Gas-then-move is read off the *rewrite*, never re-derived: a `B` gas step
 * whose `to` is the rewritten plan's `from` is the leg that put the marine
 * there (`rewriteClassicalAfterB` is the sole owner of that pairing).
 */
const withExtraStepLegs = (
  plan: ClassicalPlan | null,
  actions: readonly ScAction[],
): ClassicalPlan | null => {
  if (!plan) return plan;
  const before = extraStepFor(actions, plan.color, "B", plan.from);
  const after = extraStepFor(actions, plan.color, "F", plan.from);
  const to = after ? marineSingleTarget(plan.to, plan.color) : null;
  return {
    ...plan,
    ...(before ? { extraStepFrom: plan.from } : {}),
    ...(to ? { extraStepTo: to } : {}),
  };
};

const collectSpecialsUsed = (
  actions: readonly ScAction[],
  actionsAfterB: readonly ScAction[],
  finalPlacement: string,
  bMoves: readonly { from: Square; to: Square }[],
  fMoves: readonly { from: Square; to: Square }[],
  promotions: readonly { at: Square }[] = [],
  warped: readonly { from: Square; to: Square }[] = [],
  fWarped: readonly { from: Square; to: Square }[] = [],
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
  for (const m of warped) migrate(m.from, m.to);
  for (const a of actionsAfterB) {
    if (a.timing === "C") migrate(a.from, a.to);
  }
  for (const m of fMoves) migrate(m.from, m.to);
  for (const m of fWarped) migrate(m.from, m.to);
  for (const p of promotions) used.delete(p.at);
  const map = placementToMap(finalPlacement);
  return [...used].filter((sq) => map.has(sq)).sort();
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
    const coordinates = classicalRewriteCoordinatesAfterB(out, c);
    if (!coordinates) continue;
    const b = out.find(
      (a) => a.timing === "B" && a.color === c.color && a.from === c.from && a.to &&
        (a.kind === "stimStep" || a.kind === "tacticalJump"),
    );
    if (b?.kind === "stimStep" && occupied.has(coordinates.to)) continue;
    out[i] = { ...c, ...coordinates };
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
  const sieged = new Set(snapshot.siegedTanks ?? []);
  const bMoves: ResolveMove[] = [];
  const fMoves: ResolveMove[] = [];
  const warped: { from: Square; to: Square }[] = [];
  const fWarped: { from: Square; to: Square }[] = [];
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
    const siegedTanks = [...sieged].sort();
    const terminal = ccLives.w === 0 || ccLives.b === 0;
    return {
      resolved: args.resolved,
      next: {
        placement,
        turn: nextTurn,
        ccLives: { ...ccLives },
        phase: terminal ? "O" : "P",
        gas: { w: 0, b: 0 },
        gasIncome: { w: income, b: income },
        queue: { actions: [] },
        ...(mines.length ? { mines } : {}),
        ...(siegedTanks.length ? { siegedTanks } : {}),
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

  const tankModeFor = (sq: Square) => (sieged.has(sq) ? "siege" : "tank");
  const visionOpts0 = { mines, tankModeFor };
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
        ccLives: { ...snapshot.ccLives },
        attacks: [] as ReturnType<typeof applyPendingCCShots>["attacks"],
      }
    : applyPendingCCShots({
        placement,
        ccLives: snapshot.ccLives,
        pending: collectLegalCCChecks(placement, {
          isTargetVisible: isCheckVisible,
        }),
        mines,
      });
  placement = pendingApplied.placement;
  mines = pendingApplied.mines;
  let ccLives = pendingApplied.ccLives;
  const afterPending = {
    placement,
    mines: [...mines],
    ccLives: { ...ccLives },
  };
  for (const atk of pendingApplied.attacks) log.shot(atk);

  if (ccLives.w === 0 || ccLives.b === 0) {
    const terminalBoard = {
      placement,
      ccLives: { ...ccLives },
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
        pendingCCShotsArmed: [],
      },
      afterB: {
        placement,
        mines: [...mines],
        siegedTanks: [...sieged].sort(),
      },
    });
  }

  /**
   * `specialBefore` events are collected, not logged, because a gas step whose
   * marine keeps walking cannot know its own mine outcome until the classical
   * rewrite has spoken. Flushing the list afterwards keeps `ev-<n>` in queue
   * order while the held step gets to fill in its blast.
   */
  type BeforeEvent = { action: ScAction; extra: Partial<ResolveEvent> };
  const extrasBySeq = new Map<number, BeforeEvent>();
  /** Marines mid-Extra-Step: their mine waits for the classical leg to land. */
  const heldExtraSteps: {
    at: Square;
    action: Extract<ScAction, { timing: "B" | "F" }>;
    event: BeforeEvent;
  }[] = [];

  /** Last-rank gas step promotes only if the marine survived the arrival. */
  const applyGasPromotion = (
    a: Extract<ScAction, { timing: "B" | "F" }>,
    at: Square,
    survived: boolean,
  ) => {
    const lastRank = a.color === "w" ? 8 : 1;
    if (!survived || Number(at[1]) !== lastRank || !a.promotion) return;
    placement = placeUnit(placement, at, { type: a.promotion, color: a.color });
    gasPromotions.push({ color: a.color, from: a.from, at, unit: a.promotion });
  };

  for (const color of ["w", "b"] as const) {
    const group = byTiming(actions, "B").filter((a) => a.color === color);
    const ordered = orderBHeadsFirst(group);
    for (const a of ordered) {
      if (a.timing !== "B") continue;
      if (a.kind === "siegeMode") {
        if (toggleTankSiege(placement, sieged, a.color, a.from)) {
          siegedThisTurn.push(a.from);
          extrasBySeq.set(a.seq, { action: a, extra: {} });
        }
        continue;
      }
      const allyBlocked =
        (a.kind === "stimStep" || a.kind === "tacticalJump") &&
        !!a.to &&
        (() => {
          const dest = placementToMap(placement).get(a.to!);
          return !!dest && dest.color === a.color;
        })();
      const held =
        !allyBlocked &&
        a.kind === "stimStep" &&
        !!a.to &&
        actions.some(
          (c) => c.timing === "C" && c.color === a.color && c.from === a.from,
        );
      const applied = allyBlocked
        ? { placement, mines }
        : held
          ? { placement: relocate(placement, a.from, a.to!), mines }
          : applySpecial(placement, mines, a, ignoreAttacksOn);
      const event: BeforeEvent = { action: a, extra: {} };
      const relocated = applied.placement !== placement;
      const stepped =
        !allyBlocked &&
        a.kind === "stimStep" &&
        !!a.to &&
        relocated;
      placement = applied.placement;
      mines = applied.mines;
      if (!allyBlocked && a.kind === "tacticalJump" && !!a.to && relocated) {
        warped.push({ from: a.from, to: a.to });
      }
      if (stepped) {
        bMoves.push({ piece: "p", color: a.color, from: a.from, to: a.to! });
        if (held) {
          heldExtraSteps.push({ at: a.to!, action: a, event });
        } else {
          applyGasPromotion(a, a.to!, !applied.mineColor);
        }
      }
      event.extra = {
        ...(a.kind === "deploy" && a.unit ? { unit: a.unit } : {}),
        ...(applied.victim ? { victim: applied.victim } : {}),
        ...(applied.collider ? { collider: applied.collider } : {}),
        ...(applied.mineColor ? { mineColor: applied.mineColor } : {}),
      };
      extrasBySeq.set(a.seq, event);
    }
  }

  // The rewrite is the authority on whether a held gas step hands its walk on;
  // it only reads occupancy of the *continuation* tile, which no held blast can
  // change, so asking it before the blast lands is exact rather than a guess.
  const actionsAfterB = rewriteClassicalAfterB(actions, placement);
  for (const step of heldExtraSteps) {
    const { at, action } = step;
    const continues = actionsAfterB.some(
      (c) => c.timing === "C" && c.color === action.color && c.from === at,
    );
    if (continues) continue;
    const marine = placementToMap(placement).get(at);
    if (!marine) continue;
    const blast = applyArrivalMine(placement, mines, [at], action.color, marine);
    placement = blast.placement;
    mines = blast.mines;
    step.event.extra = {
      ...step.event.extra,
      ...(blast.victim ? { victim: blast.victim } : {}),
      ...(blast.mineColor ? { mineColor: blast.mineColor } : {}),
    };
    applyGasPromotion(action, at, !blast.mineColor);
  }
  for (const a of byTiming(actions, "B")) {
    const event = extrasBySeq.get(a.seq);
    if (event) log.special("specialBefore", event.action, event.extra);
  }

  const afterB = {
    placement,
    mines: [...mines],
    siegedTanks: [...sieged].sort() as Square[],
  };

  const visionOpts = { mines, tankModeFor };
  const visionW = getSideVision(placement, "w", visionOpts);
  const visionB = getSideVision(placement, "b", visionOpts);
  const isTargetVisible = (color: PieceColor, square: Square) => {
    const v = color === "w" ? visionW : visionB;
    return v.litSquares.has(square) || v.revealedPieces.has(square);
  };

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
  const white = withExtraStepLegs(classicalFor(actionsAfterB, "w"), actions);
  const black = withExtraStepLegs(classicalFor(actionsAfterB, "b"), actions);
  const classical = resolveTurn({
    placement,
    ccLives,
    white,
    black,
    ignoreAttacksOn,
    mines,
    isTargetVisible,
    pathVisionOpts: { mines, tankModeFor },
    siegedTanks: afterB.siegedTanks,
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
  ccLives = resolved.afterAll.ccLives;

  const boardAfterMove = placementToMap(placement);
  for (const sq of sieged) {
    if (boardAfterMove.get(sq)?.type !== "r") sieged.delete(sq);
  }

  if (ccLives.w === 0 || ccLives.b === 0) {
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
    // Move-then-gas only rewrites the origin when the unit's OWN classical
    // moved it (C.from === F.from). Otherwise the F special stays on its
    // arming square — borrowing another unit's post-move square would teleport
    // mines/steps/shots onto units that never armed them.
    const ownMove =
      rewrittenC && rewrittenC.from === a.from
        ? rewrittenC
        : origC && origC.from === a.from
          ? origC
          : null;
    const at = ownMove
      ? (candidates.find((s) => {
          const p = boardAfter.get(s);
          return !!p && p.color === a.color;
        }) ?? a.from)
      : a.from;
    const actor = boardAfter.get(at);
    // Fire-and-forget Charon resolves from the queued square even with no
    // live Mecha; every other F special needs its actor.
    if ((!actor || actor.color !== a.color) && a.kind !== "charonMissiles") continue;

    const rewritten: ScAction =
      a.kind === "spiderMine"
        ? { ...a, from: at, to: at }
        : { ...a, from: at };

    if (a.kind === "siegeMode") {
      if (!actor || actor.type !== "r") continue;
      if (toggleTankSiege(placement, sieged, a.color, at)) {
        siegedThisTurn.push(at);
        log.special("specialAfter", rewritten);
      }
      continue;
    }

    if (a.kind === "stimStep") {
      if (!actor || actor.type !== "p") continue;
      const to = marineSingleTarget(at, a.color);
      if (!to || boardAfter.has(to)) {
        // The Extra Step never lands, so `at` *is* the destination: a mine the
        // classical leg held back for this hop has to fire here instead.
        const held = applyArrivalMine(placement, mines, [at], a.color, actor);
        placement = held.placement;
        mines = held.mines;
        if (held.mineColor) {
          log.special("specialAfter", { ...rewritten, to: at }, {
            ...(held.victim ? { victim: held.victim } : {}),
            mineColor: held.mineColor,
          });
        }
        continue;
      }
      const stepped = applyArrivalMine(
        relocate(placement, at, to),
        mines,
        [at, to],
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
        ...(stepped.chaseFrom ? { chaseFrom: stepped.chaseFrom } : {}),
      });
      continue;
    }

    const applied = applySpecial(placement, mines, rewritten, ignoreAttacksOn);
    if (
      a.kind === "tacticalJump" &&
      rewritten.to &&
      applied.placement !== placement
    ) {
      fWarped.push({ from: rewritten.from, to: rewritten.to });
    }
    placement = applied.placement;
    mines = applied.mines;
    log.special("specialAfter", rewritten, {
      ...(a.kind === "deploy" && a.unit ? { unit: a.unit } : {}),
      ...(applied.victim ? { victim: applied.victim } : {}),
      ...(applied.collider ? { collider: applied.collider } : {}),
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
        `endScTurn: illegal Command Center count (w=${w} b=${b}) after resolve: ${placement}`,
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
      warped,
      fWarped,
    ),
  });
};
