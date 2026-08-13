/**
 * Turn open / End paths.
 *
 * **Turn open** (`beginScTurn`): fog-visible legal king-checks apply **before**
 * players choose intent. A unit that breaks contact later in the same turn still
 * paid that shot (parting shot at open).
 *
 * **End** (`endScTurn`): by default still runs checks → B → C → F for atomic
 * replay / tests. Live play that already ran `beginScTurn` passes
 * `{ skipTurnStartChecks: true }` so End starts at B.
 * // SPEC: _spec/packages/starchess-core/turn-queue-sequence.puml, _spec/packages/starchess-core/resolve.puml, _spec/apps/starchess/core/turn/turn-facade.puml
 */

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
  mineAt,
  minesFor,
} from "../board/mines";
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

/** Semantic resolve cue (presentation may extend with anim). */
export type ResolveEvent = {
  id: string;
  phase: "specialBefore" | "attack" | "move" | "specialAfter";
  color: StarChessColor;
  from?: Square;
  to?: Square;
  /** Present for specialBefore / specialAfter — drives Charon / Jump VFX. */
  kind?: ScAction["kind"];
  /**
   * Present for `spawn` events whose target held an enemy at application time
   * — the deploy crushed the occupant (presentation draws the death at the drop).
   * Also the unit a mine took on a `queenWarp` / `pawnDouble` arrival: the hull
   * is the victim of its own jump / step (see {@link ResolveEvent.mineColor}).
   * A mined `spawn` keeps the crush here and reports its dead unit as
   * {@link ResolveEvent.unit} — one tile, two deaths.
   */
  victim?: { type: StarChessPiece; color: StarChessColor };
  /**
   * Owner of a spider mine detonated by this special — any arrival that is not
   * an attack: `queenWarp`, a `pawnDouble` gas step, or a `spawn` deploy. The
   * mine and the arriving unit both die; allied mines stay armed and inert.
   */
  mineColor?: StarChessColor;
  /**
   * Deployed unit type — present on every `spawn` event. With `mineColor` set
   * it is also the unit the mine destroyed on the drop.
   */
  unit?: StarChessPiece;
};

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
  /** Gas-step pawn slides applied during B (animate before classical). */
  bMoves: ResolveMove[];
  /** Gas-step pawn slides applied during F (animate after classical). */
  fMoves: ResolveMove[];
  /**
   * Planning queue that produced this End — DualNav intent ghosts read this
   * (settled snaps clear `Q:`). Empty for turn-open check-only plies.
   */
  queue: readonly ScAction[];
};

export type EndScTurnOptions = {
  /**
   * When true, skip turn-start king-checks (already applied via {@link beginScTurn}).
   * Live planning that resolved checks before intent must set this.
   */
  skipTurnStartChecks?: boolean;
};

export type BeginScTurnResult = {
  /** True when at least one check attack or collision fired. */
  changed: boolean;
  attacks: ResolveTurnResult["attacks"];
  afterPending: EndScTurnResult["afterPending"];
  /** Planning snap after checks (phase O when a king hit 0 HP). */
  next: ScFenSnapshot;
  /**
   * Synthetic End result for combat / timeline players (checks only; empty B/C/F).
   * Present when `changed` (including lethal terminal).
   */
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

/**
 * Refill remaining vespene from this turn's income tier.
 * Called at turn open (`beginScTurn`) — not at `endScTurn` (which leaves gas at 0).
 */
export const refillTurnGas = (snap: ScFenSnapshot): ScFenSnapshot => ({
  ...snap,
  gas: { w: snap.gasIncome.w, b: snap.gasIncome.b },
});

/**
 * Resolve fog-visible legal king-checks at turn open — before players queue intent.
 * Does not advance `turn` unless a king dies (phase O, turn+1). Queue is cleared.
 * Always refills `gas` from `gasIncome` (vespene arrives with the check / turn-open).
 */
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
    // Prior-turn U: ends at turn-open checks — do not carry into the new window.
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

/**
 * A special that **arrives** on a tile — gas step, deploy, Tactical Jump. None
 * of them attack the square, so a hostile spider mine detonates on contact:
 * mine and arriving unit both die (mines are never occupancy, so the tile was
 * always a legal landing). Allied mines stay armed and inert underfoot.
 * // SPEC: _spec/packages/starchess-core/resolve.puml
 */
const applyArrivalMine = (
  placement: string,
  mines: ScMine[],
  at: Square,
  color: StarChessColor,
  arriving: ScPiece,
): ArrivalMine => {
  const m = mineAt(mines, at);
  if (!m || m.color === color) return { placement, mines };
  const board = placementToMap(placement);
  board.delete(at);
  return {
    placement: mapToPlacement(board),
    mines: mines.filter((x) => x.at !== at),
    victim: { type: arriving.type, color: arriving.color },
    mineColor: m.color,
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
      // Actor may have died at turn open — a jump with no hull fizzles, and must
      // not disturb the landing tile (or detonate a mine sitting on it).
      const hull = placementToMap(placement).get(action.from);
      if (!hull || hull.color !== action.color) return { placement, mines };
      // Mines are never occupancy, so a mined tile is always a legal landing —
      // an allied mine keeps the hull safe, a hostile one takes it with the mine.
      const landed = relocate(placement, action.from, action.to);
      return applyArrivalMine(landed, mines, action.to, action.color, hull);
    }
    case "pawnDouble": {
      if (!action.to) return { placement, mines };
      const marine = placementToMap(placement).get(action.from);
      const stepped = relocate(placement, action.from, action.to);
      // A gas step walks onto the tile — it never attacks it, so a hostile mine
      // takes the marine exactly like a classical front step (allied mines stay
      // inert). Death here also cancels the promotion the caller would deploy.
      if (!marine) return { placement: stepped, mines };
      return applyArrivalMine(stepped, mines, action.to, action.color, marine);
    }
    case "spawn": {
      if (!action.to || !action.unit) return { placement, mines };
      // Capture the occupant before the overwrite — an enemy there is crushed.
      const occupant = placementToMap(placement).get(action.to);
      const deployed = { type: action.unit, color: action.color };
      const landed = placeUnit(placement, action.to, deployed);
      const crush =
        occupant && occupant.color !== action.color
          ? { victim: { type: occupant.type, color: occupant.color } }
          : {};
      // The drop arrives on the tile like any other landing: a hostile mine
      // detonates and takes the deployed unit with it. `victim` stays the
      // crushed occupant — the unit the mine took is `action.unit`, carried on
      // the event, so a crush + mine on one tile still reports both deaths.
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

/**
 * Squares that spent gas this resolve — stamped as `U:` on the next planning
 * snap so enemies keep the green aura (and fog pierce) until the following End.
 * Glow follows relocating units (gas-step / warp / rewritten classical).
 */
const collectSpecialsUsed = (
  actions: readonly ScAction[],
  actionsAfterB: readonly ScAction[],
  finalPlacement: string,
  bMoves: readonly { from: Square; to: Square }[],
  fMoves: readonly { from: Square; to: Square }[],
  /** Promotion landings — gas stamp must not follow onto the deployed unit. */
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
  // Pawn spent gas then promoted — the deploy is a new unit, not a U: carrier.
  for (const p of promotions) used.delete(p.at);
  const map = placementToMap(finalPlacement);
  return [...used].filter((sq) => map.has(sq)).sort();
};

/** Shift a square by a file/rank delta; null if off-board. */
const shiftSquare = (s: Square, df: number, dr: number): Square | null => {
  const { file, rank } = parseSquare(s);
  return sq(file + df, rank + dr);
};

/**
 * After B relocates (pawnDouble / queenWarp), rewrite same-side classical
 * so pre-B intents still land after the piece leaves `from`:
 * B e2→e3 + C e2→e3 ⇒ C e3→e4. Order-independent with move-then-gas, which
 * resolves F from the post-C square.
 *
 * A pawnDouble B also carries a start-rank classical double the same way:
 * B e2→e3 + C e2→e4 ⇒ C e3→e5. Gas-then-move then matches move-then-gas
 * (double + gas both advance 3 squares from the start rank) instead of
 * fizzling the longer intent. When the final square is occupied the rewrite
 * is skipped — the pre-B C fizzles once B leaves `from`, so gas-then-move is
 * blocked at the gas step, mirroring move-then-gas's post-C gas fizzle
 * (a gas step never captures through a blocked landing square).
 * Captures / off-vector C are left alone (pre-B C would fizzle).
 *
 * Pure — exported so planning projections (intent ghosts) can paint the square
 * the stack actually lands on instead of the pre-rewrite `to`. Presentation
 * must never re-derive this vector by hand: the guards above (same-file,
 * forward, start rank, blocked landing) are the contract.
 */
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

    // pawnDouble: rewrite same-file forward C (single step, or the start-rank
    // classical double). queenWarp: only the C matching the exact warp step.
    if (b.kind === "pawnDouble") {
      const sameFile = c.from[0] === c.to[0];
      const ranks = Math.abs(Number(c.to[1]) - Number(c.from[1]));
      const forward =
        (Number(c.to[1]) - Number(c.from[1])) * (b.color === "w" ? 1 : -1) > 0;
      // The classical double only exists from the double-step band — never
      // rewrite a 2-rank C from elsewhere (that was never a legal double).
      const onStartRank = canPawnDoubleStep(c.from, b.color);
      // Blocked final square: gas-then-move must fizzle like move-then-gas's
      // post-C gas step (occupied = blocked, never a capture).
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

  // Vision for turn-start checks (pre-B siege flags) and classical fog.
  const rookModeFor = (sq: Square) => (sieged.has(sq) ? "siege" : "tank");
  const visionOpts0 = { mines, rookModeFor };
  const visionW0 = getSideVision(placement, "w", visionOpts0);
  const visionB0 = getSideVision(placement, "b", visionOpts0);
  const isCheckVisible = (color: PieceColor, square: Square) => {
    const v = color === "w" ? visionW0 : visionB0;
    return v.litSquares.has(square) || v.revealedPieces.has(square);
  };

  // 1) Fog-visible legal king-checks — skipped when already applied at turn open.
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
    const nextTurn = snapshot.turn + 1;
    const income = energyForTurn(Math.max(1, nextTurn));
    return {
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
      next: {
        placement,
        turn: nextTurn,
        kingLives: { ...kingLives },
        phase: "O",
        gas: { w: 0, b: 0 },
        gasIncome: { w: income, b: income },
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
      bMoves: [],
      fMoves: [],
      queue: [],
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
    if (a.kind === "pawnDouble" && a.to && applied.placement !== placement) {
      bMoves.push({
        piece: "p",
        color: a.color,
        from: a.from,
        to: a.to,
      });
      const lastRank = a.color === "w" ? 8 : 1;
      // A marine that stepped onto a hostile mine died on arrival — nothing
      // left to promote (same rule as the classical front step).
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
    const bEv = eventFor("specialBefore", a, `ev-${eventSeq++}`);
    events.push({
      ...bEv,
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

  // Post-B vision (siege toggles / mines) for classical attack fog.
  const visionOpts = { mines, rookModeFor };
  const visionW = getSideVision(placement, "w", visionOpts);
  const visionB = getSideVision(placement, "b", visionOpts);
  const isTargetVisible = (color: PieceColor, square: Square) => {
    const v = color === "w" ? visionW : visionB;
    return v.litSquares.has(square) || v.revealedPieces.has(square);
  };

  // 3) Classical attack → move (+ mine triggers).
  // Rewrite C that shares from with a B relocate so UI pre-B intents still land.
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
    const nextTurn = snapshot.turn + 1;
    const income = energyForTurn(Math.max(1, nextTurn));
    return {
      resolved,
      next: {
        placement,
        turn: nextTurn,
        kingLives: { ...kingLives },
        phase: "O",
        gas: { w: 0, b: 0 },
        gasIncome: { w: income, b: income },
        queue: { actions: [] },
        ...(mines.length ? { mines } : {}),
        ...(sieged.size ? { siegedRooks: [...sieged].sort() } : {}),
      },
      ignoreAttacksOn,
      events,
      siegedThisTurn,
      afterB,
      afterPending,
      bMoves,
      fMoves: [],
      queue: [...actions],
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

    // Rewrite actor square to where the unit stands after C (move-then-gas).
    // knightMine also rewrites `to` — applySpecial prefers action.to for the drop.
    const rewritten: ScAction =
      a.kind === "knightMine"
        ? { ...a, from: at, to: at }
        : { ...a, from: at };

    if (a.kind === "rookSiege") {
      if (actor.type !== "r") continue;
      if (toggleRookSiege(placement, sieged, a.color, at)) {
        siegedThisTurn.push(at);
        events.push(eventFor("specialAfter", rewritten, `ev-${eventSeq++}`));
      }
      continue;
    }

    if (a.kind === "pawnDouble") {
      if (actor.type !== "p") continue;
      // Recompute +1 from the post-C square; fizzle if blocked / off-board.
      const to = pawnSingleTarget(at, a.color);
      if (!to || boardAfter.has(to)) continue;
      // Same walk-on contact as the B gas step: a hostile mine on the landing
      // tile kills the marine (and cancels the promotion behind it).
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
      events.push({
        ...eventFor("specialAfter", { ...rewritten, to }, `ev-${eventSeq++}`),
        ...(stepped.victim ? { victim: stepped.victim } : {}),
        ...(stepped.mineColor ? { mineColor: stepped.mineColor } : {}),
      });
      continue;
    }

    const applied = applySpecial(placement, mines, rewritten, ignoreAttacksOn);
    placement = applied.placement;
    mines = applied.mines;
    const fEv = eventFor("specialAfter", rewritten, `ev-${eventSeq++}`);
    events.push({
      ...fEv,
      ...(a.kind === "spawn" && a.unit ? { unit: a.unit } : {}),
      ...(applied.victim ? { victim: applied.victim } : {}),
      ...(applied.mineColor ? { mineColor: applied.mineColor } : {}),
    });
  }

  // F gas-promotes append after classical promotions were frozen.
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

  const nextTurn = snapshot.turn + 1;
  const income = energyForTurn(Math.max(1, nextTurn));
  const gasIncome = { w: income, b: income };
  const siegedRooks = [...sieged].sort();
  const specialsUsed = collectSpecialsUsed(
    actions,
    actionsAfterB,
    placement,
    bMoves,
    fMoves,
    resolved.promotions,
  );
  // Planning check rings come from live geometry — do not persist deferred H:.
  // U: stamps this resolve's gas spends for the following planning window until
  // the next turn-open checks (`beginScTurn`) clear them.
  const next: ScFenSnapshot = {
    placement,
    turn: nextTurn,
    kingLives: { ...kingLives },
    phase: kingLives.w === 0 || kingLives.b === 0 ? "O" : "P",
    gas: { w: 0, b: 0 },
    gasIncome,
    queue: { actions: [] },
    ...(mines.length ? { mines } : {}),
    ...(siegedRooks.length ? { siegedRooks } : {}),
    ...(specialsUsed.length ? { specialsUsed } : {}),
  };

  return {
    resolved,
    next,
    events,
    ignoreAttacksOn,
    siegedThisTurn,
    afterB,
    afterPending,
    bMoves,
    fMoves,
    queue: [...actions],
  };
};
