// SPEC: _spec/_plans/starchess-achievements.puml
/**
 * Per-turn achievement tally. Call {@link foldTurn} once for each settled ply.
 * Game end only reads this state — it does not walk the match again.
 *
 * A piece's id is `turn-type-origin`: the turn it entered, its birth type,
 * and that birth square. Moves keep the id; a later capture still credits it.
 */
import {
  UNIT_COST,
  getSideVision,
  placementToMap,
  type EndScTurnResult,
  type StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import { achievementsFor } from "~/achievements/catalog";
import {
  LEVEL_FOR_ADJUTANT,
  tierForOpponent,
} from "~/achievements/types";
import type { AchievementBubble } from "~/types/achievements";

export type { AchievementBubble };

/** One settled ply must fold inside this budget. */
export const TURN_ANALYSIS_BUDGET_MS = 50;

export const BUBBLE_RISE_MS = 1000;
export const BUBBLE_LIFE_MS = 3000;
export const BUBBLE_RISE_SQUARES = 2;
/** Per second of fade after {@link BUBBLE_RISE_MS}. e^{-2} at 1s of fade. */
const FADE_RATE = 2;

export const pieceId = (turn: number, type: string, origin: string): string =>
  `${turn}-${type}-${origin}`;

export const originOf = (id: string): string => id.split("-")[2] ?? "";

/**
 * Rise for the first second, then exponential fade. Gone at 3s.
 * Opacity is 1 until 1s, then e^{-2 * seconds after 1s}, and 0 at 3s.
 */
export const bubbleMotion = (
  elapsedMs: number,
): { squares: number; opacity: number } => {
  if (elapsedMs >= BUBBLE_LIFE_MS) {
    return { squares: BUBBLE_RISE_SQUARES, opacity: 0 };
  }
  const squares =
    BUBBLE_RISE_SQUARES * Math.min(1, Math.max(0, elapsedMs) / BUBBLE_RISE_MS);
  if (elapsedMs <= BUBBLE_RISE_MS) return { squares, opacity: 1 };
  const fadeSec = (elapsedMs - BUBBLE_RISE_MS) / 1000;
  return { squares: BUBBLE_RISE_SQUARES, opacity: Math.exp(-FADE_RATE * fadeSec) };
};

export type MeasuredEvent = {
  /** Resolve wave: gas specials run `specialBefore` or `specialAfter` the classical leg. */
  phase?: string;
  color?: string;
  from?: string;
  to?: string;
  kind?: string;
  unit?: string;
  victim?: { type?: string; color?: string };
  mineColor?: string;
};

export type AnalysisState = {
  player: StarChessColor;
  at: Map<string, string>;
  material: Map<string, number>;
  intercepts: number;
  promotions: number;
  mines: number;
  mechaKills: number;
  ccCaptures: number;
  jumpStreak: number;
  bestJump: number;
  lastJumpTurn: number | null;
  visionStreak: number;
  bestVision: number;
  lastVisionTurn: number | null;
  startLives: number;
  damaged: boolean;
  turn: number;
  lastPlacement: string;
  announced: Record<string, number>;
  seq: number;
};

export type FoldAttack = {
  kind?: string;
  color?: string;
  from?: string;
  to?: string;
  victim?: { piece?: string; color?: string };
  mineColor?: string;
  /** Path reveal: the square the slider left. `from` is where it spotted the target. */
  pathRevealFrom?: string;
  /** The shooter ends on `to` (it moved in). */
  occupies?: boolean;
};

export type FoldMove = { color?: string; from?: string; to?: string };

export type FoldPly = {
  turn: number;
  placement: string;
  siegedTanks?: readonly string[];
  ccLives?: { w?: number; b?: number };
  mines?: readonly { at: string; color: string }[];
  events?: readonly MeasuredEvent[];
  /** Board before this ply. Intercepts read the friend standing behind the marine. */
  beforePlacement?: string;
  attacks?: readonly FoldAttack[];
  moves?: readonly FoldMove[];
  mineTriggers?: readonly FoldAttack[];
  promotions?: readonly { color?: string; from?: string; at?: string }[];
};

/**
 * The one mapping from a settled resolve to the ply {@link foldTurn} reads.
 * `before` is the board the resolve started from.
 */
export const foldPlyFromResolve = (esr: EndScTurnResult, before?: string): FoldPly => ({
  turn: esr.next.turn,
  placement: esr.next.placement,
  beforePlacement: before,
  siegedTanks: esr.next.siegedTanks,
  ccLives: esr.next.ccLives,
  mines: esr.next.mines,
  events: esr.events,
  // Every list a capture can land in: a slider that runs into a fogged unit
  // (path reveal) and two units meeting on one square (collision) are captures
  // too, and the engine does not repeat them in `attacks`.
  attacks: [
    ...(esr.resolved?.attacks ?? []),
    ...(esr.resolved?.pathRevealAttacks ?? []),
    ...(esr.resolved?.moveCollisions ?? []),
  ],
  moves: esr.resolved?.moves,
  mineTriggers: [
    ...(esr.resolved?.mineTriggers ?? []),
    ...(esr.resolved?.pathRevealMineTriggers ?? []),
  ],
  promotions: esr.resolved?.promotions,
});

const valueOf = (type: string | undefined): number => {
  if (type === "k" || type === "p" || type === "n" || type === "b" || type === "r" || type === "q") {
    return UNIT_COST[type];
  }
  return 0;
};

const near = (commandCenter: string, sq: string): boolean => {
  if (sq.length < 2 || commandCenter.length < 2) return false;
  return (
    Math.abs(commandCenter.charCodeAt(0) - sq.charCodeAt(0)) <= 1 &&
    Math.abs(Number(commandCenter[1]) - Number(sq[1])) <= 1
  );
};

export const seedAnalysis = (
  opening: { turn: number; placement: string; ccLives?: { w?: number; b?: number } },
  player: StarChessColor,
): AnalysisState => {
  const at = new Map<string, string>();
  for (const [square, piece] of placementToMap(opening.placement)) {
    // The Command Center is an instance like any other: a capture it makes
    // opens at its own cost (UNIT_COST.k), not as a free unknown.
    if (piece.color !== player) continue;
    at.set(square, pieceId(opening.turn, piece.type, square));
  }
  return {
    player,
    at,
    material: new Map(),
    intercepts: 0,
    promotions: 0,
    mines: 0,
    mechaKills: 0,
    ccCaptures: 0,
    jumpStreak: 0,
    bestJump: 0,
    lastJumpTurn: null,
    visionStreak: 0,
    bestVision: 0,
    lastVisionTurn: null,
    startLives: opening.ccLives?.[player] ?? 3,
    damaged: false,
    turn: opening.turn,
    lastPlacement: opening.placement,
    announced: {},
    seq: 1,
  };
};

const levelReached = (shortId: string, score: number): number => {
  let level = 0;
  for (const row of achievementsFor(shortId)) {
    const ok = row.goal === "atLeast" ? score >= row.threshold : score <= row.threshold;
    if (ok && row.level > level) level = row.level;
  }
  return level;
};

const announce = (
  state: AnalysisState,
  shortId: string,
  score: number,
  origin: string | undefined,
  bubbles: AchievementBubble[],
): void => {
  if (!origin) return;
  const level = levelReached(shortId, score);
  const prev = state.announced[shortId] ?? 0;
  if (level <= prev) return;
  state.announced[shortId] = level;
  const row = achievementsFor(shortId).find((item) => item.level === level);
  if (!row) return;
  bubbles.push({
    id: `${state.player}-${shortId}-${level}-${state.seq++}`,
    shortId,
    level: row.level,
    origin,
    icon: row.icon,
    side: state.player,
  });
};

const idAt = (state: AnalysisState, square: string, turn: number): string => {
  const existing = state.at.get(square);
  if (existing) return existing;
  const id = pieceId(turn, "x", square);
  state.at.set(square, id);
  return id;
};

const ccSquare = (placement: string, color: StarChessColor): string | null => {
  for (const [square, piece] of placementToMap(placement)) {
    if (piece.type === "k" && piece.color === color) return square;
  }
  return null;
};

const bumpStreak = (
  full: boolean,
  turn: number,
  last: number | null,
  streak: number,
): { streak: number; last: number } => {
  if (!full) return { streak: 0, last: turn };
  if (last === turn) return { streak, last: turn };
  if (last != null && turn === last + 1) return { streak: streak + 1, last: turn };
  return { streak: 1, last: turn };
};

/** What `color` sees on the board a ply settled into. */
const plyVision = (ply: FoldPly, color: StarChessColor) => {
  const sieged = new Set(ply.siegedTanks ?? []);
  return getSideVision(ply.placement, color, {
    tankModeFor: (square: Square) => (sieged.has(square) ? "siege" : "tank"),
    mines: (ply.mines ?? []).map((mine) => ({
      at: mine.at as Square,
      color: mine.color as StarChessColor,
    })),
  });
};

/**
 * Whether `viewer` can see `square` after this ply. An opponent's bubble on a
 * fogged square would give away the unit that earned it, so it never shows.
 */
export const plySeenBy = (ply: FoldPly, viewer: StarChessColor, square: string): boolean => {
  const vision = plyVision(ply, viewer);
  return vision.litSquares.has(square as Square) || vision.revealedPieces.has(square as Square);
};

/** A bubble's anchor: the achieving unit, else the square the event happened on. */
type Spot = { id?: string; at?: string };

/**
 * The square a unit stands on now. An id stays on the square its unit last
 * reached, so a unit that died mid-ply is found where it fell; one another
 * unit has since displaced falls back to the event square.
 */
const spotSquare = (state: AnalysisState, spot: Spot | undefined): string | undefined => {
  if (!spot) return undefined;
  if (spot.id) {
    for (const [square, id] of state.at) if (id === spot.id) return square;
  }
  return spot.at;
};

/**
 * The square a capturing unit stood on before this ply. A path reveal names it
 * outright; a collision reports the meeting square as `from`, so the shooter's
 * own move gives the origin back.
 */
const shooterSquare = (atk: FoldAttack, moves: readonly FoldMove[] | undefined): string => {
  if (atk.pathRevealFrom) return atk.pathRevealFrom;
  if (atk.from === atk.to) {
    const move = moves?.find((mv) => mv.color === atk.color && mv.to === atk.to);
    if (move?.from) return move.from;
  }
  return atk.from!;
};

/**
 * Fold one settled ply into `state`. Only this ply's events are read.
 * Returns bubbles for levels this ply newly reached, each rising from the
 * achieving unit's square once the ply has settled.
 */
export const foldTurn = (state: AnalysisState, ply: FoldPly): AchievementBubble[] => {
  const bubbles: AchievementBubble[] = [];
  const player = state.player;
  // Where each badge's bubble rises: the achieving unit (by id, resolved to
  // its square once the ply has settled) or, failing that, the event square.
  let stonksOrigin: Spot | undefined;
  let medalOrigin: Spot | undefined;
  let promoOrigin: Spot | undefined;
  let mineOrigin: Spot | undefined;
  let mechaOrigin: Spot | undefined;
  let lightOrigin: Spot | undefined;
  let jumpOrigin: Spot | undefined;
  const commandCenter = ccSquare(ply.placement, player);
  // Squares a friendly unit gas-stepped onto this ply — an interception only
  // counts a Marine gas moved into the shot, never one that was just standing there.
  const gasSteppedTo = new Set<string>();

  const credit = (from: string, victimType: string | undefined, to: string | undefined) => {
    const piece = idAt(state, from, ply.turn);
    const opened = state.material.has(piece)
      ? state.material.get(piece)!
      : -valueOf(piece.split("-")[1]);
    const total = opened + valueOf(victimType);
    state.material.set(piece, total);
    stonksOrigin = { id: piece, at: to };
    if (to && commandCenter && near(commandCenter, to)) {
      state.ccCaptures += 1;
      lightOrigin = { id: piece, at: to };
    }
    return piece;
  };

  /**
   * One gas special, applied where it happens in the resolve: a `specialBefore`
   * runs on the board the classical leg starts from, a `specialAfter` on the
   * board it left. Captures are credited before the unit relocates, so the
   * instance that fired is the one that scores.
   */
  const special = (ev: MeasuredEvent) => {
    // An enemy special (a gas step) onto our mine. Classical trips arrive in
    // `mineTriggers` instead — never both.
    if (ev.color !== player && ev.mineColor === player && ev.victim?.color !== player) {
      state.mines += 1;
      mineOrigin = { at: ev.to ?? ev.from };
    }
    if (ev.color !== player || !ev.from) return;
    const enemyVictim = ev.victim?.color != null && ev.victim.color !== player;
    if (ev.kind === "deploy" && ev.unit && ev.to) {
      state.at.set(ev.to, pieceId(ply.turn, ev.unit, ev.to));
      // A deploy that lands on an enemy crushes it — the new unit's capture.
      if (enemyVictim) credit(ev.to, ev.victim?.type, ev.to);
      return;
    }
    const piece = idAt(state, ev.from, ply.turn);
    if (enemyVictim && (ev.kind === "charonMissiles" || ev.kind === "stimStep")) {
      credit(ev.from, ev.victim?.type, ev.to);
      if (ev.kind === "charonMissiles" && ev.victim?.type === "q") {
        state.mechaKills += 1;
        mechaOrigin = { id: piece, at: ev.from };
      }
    }
    if (ev.kind === "tacticalJump") jumpOrigin = { id: piece, at: ev.to };
    if (ev.kind === "stimStep" && ev.to) gasSteppedTo.add(ev.to);
    if ((ev.kind === "stimStep" || ev.kind === "tacticalJump") && ev.to && ev.to !== ev.from) {
      state.at.delete(ev.from);
      state.at.set(ev.to, piece);
    }
  };
  const specials = (phase: string) => {
    for (const ev of ply.events ?? []) if (ev.phase === phase) special(ev);
  };

  specials("specialBefore");

  for (const atk of [...(ply.attacks ?? []), ...(ply.mineTriggers ?? [])]) {
    if (atk.kind === "mineBlast" && atk.mineColor === player && atk.victim) {
      state.mines += 1;
      mineOrigin = { at: atk.to ?? atk.from };
    }
    if (atk.kind !== "capture" || !atk.from || !atk.to) continue;
    if (atk.victim?.piece === "p" && atk.victim.color === player && atk.color !== player) {
      if (gasSteppedTo.has(atk.to)) {
        state.intercepts += 1;
        // The Marine died where its gas step carried it.
        medalOrigin = { at: atk.to };
      }
      continue;
    }
    if (atk.color !== player) continue;
    if (atk.victim?.color === player) continue;
    credit(shooterSquare(atk, ply.moves), atk.victim?.piece, atk.to);
    // A path-reveal slider is in no move list: carry its id to where it stopped.
    if (atk.pathRevealFrom && atk.pathRevealFrom !== atk.from) {
      const piece = state.at.get(atk.pathRevealFrom);
      if (piece) {
        state.at.delete(atk.pathRevealFrom);
        state.at.set(atk.occupies ? atk.to : atk.from, piece);
      }
    }
  }

  for (const mv of ply.moves ?? []) {
    if (mv.color !== player || !mv.from || !mv.to || mv.from === mv.to) continue;
    const piece = idAt(state, mv.from, ply.turn);
    state.at.delete(mv.from);
    state.at.set(mv.to, piece);
  }

  specials("specialAfter");

  for (const promo of ply.promotions ?? []) {
    if (promo.color !== player) continue;
    state.promotions += 1;
    const square = promo.at ?? promo.from;
    promoOrigin = { id: square ? state.at.get(square) : undefined, at: square };
  }

  if (jumpOrigin) {
    const next = bumpStreak(true, ply.turn, state.lastJumpTurn, state.jumpStreak);
    state.jumpStreak = next.streak;
    state.lastJumpTurn = next.last;
    if (next.streak > state.bestJump) state.bestJump = next.streak;
  }

  const vision = plyVision(ply, player);
  const visionNext = bumpStreak(
    vision.litSquares.size >= 64,
    ply.turn,
    state.lastVisionTurn,
    state.visionStreak,
  );
  state.visionStreak = visionNext.streak;
  state.lastVisionTurn = visionNext.last;
  if (visionNext.streak > state.bestVision) state.bestVision = visionNext.streak;

  const lives = ply.ccLives?.[player];
  if (lives != null && lives < state.startLives) state.damaged = true;
  state.turn = ply.turn;
  state.lastPlacement = ply.placement;

  let bestMaterial = 0;
  for (const value of state.material.values()) {
    if (value > bestMaterial) bestMaterial = value;
  }

  const here = (spot: Spot | undefined) => spotSquare(state, spot);
  announce(state, "stonks", bestMaterial, here(stonksOrigin), bubbles);
  announce(state, "medal", state.intercepts, here(medalOrigin), bubbles);
  announce(state, "gogo", state.promotions, here(promoOrigin), bubbles);
  announce(state, "mines", state.mines, here(mineOrigin), bubbles);
  announce(state, "mecha", state.mechaKills, here(mechaOrigin), bubbles);
  announce(state, "light", state.ccCaptures, here(lightOrigin), bubbles);
  announce(state, "juke", state.bestJump, here(jumpOrigin), bubbles);
  announce(state, "vision", state.bestVision, commandCenter ?? undefined, bubbles);
  return bubbles;
};

/** Win-gated levels. Reads the tally already folded; does not replay plies. */
export const finalizeAnalysis = (
  state: AnalysisState,
  result: "win" | "loss" | "draw",
  opponent: string | undefined,
): AchievementBubble[] => {
  if (result !== "win") return [];
  const bubbles: AchievementBubble[] = [];
  const enemy: StarChessColor = state.player === "w" ? "b" : "w";
  const origin = ccSquare(state.lastPlacement, enemy) ?? ccSquare(state.lastPlacement, state.player) ?? undefined;
  announce(state, "cheese", state.turn, origin, bubbles);
  if (!state.damaged) {
    const tier = tierForOpponent(opponent);
    if (tier && origin) {
      const level = LEVEL_FOR_ADJUTANT[tier];
      const prev = state.announced.flawless ?? 0;
      if (level > prev) {
        state.announced.flawless = level;
        const row = achievementsFor("flawless").find((item) => item.level === level);
        if (row) {
          bubbles.push({
            id: `${state.player}-flawless-${level}-${state.seq++}`,
            shortId: "flawless",
            level,
            origin,
            icon: row.icon,
            side: state.player,
          });
        }
      }
    }
  }
  return bubbles;
};

const CAREER_TIERS = ["naive", "strategic", "ml", "rlhf", "rlcd"] as const;

export const careerLevel = (wins: Record<string, number>, need: number): number => {
  let level = 0;
  for (const tier of CAREER_TIERS) {
    const index = CAREER_TIERS.indexOf(tier);
    const total = CAREER_TIERS.slice(index).reduce((sum, key) => sum + (wins[key] ?? 0), 0);
    if (total >= need) level = LEVEL_FOR_ADJUTANT[tier];
  }
  return level;
};

export const mintBubble = (
  state: AnalysisState,
  shortId: string,
  level: number,
  origin: string | undefined,
): AchievementBubble | null => {
  if (!origin || level < 1 || level > 5) return null;
  const row = achievementsFor(shortId).find((item) => item.level === level);
  if (!row) return null;
  return {
    id: `${state.player}-${shortId}-${level}-${state.seq++}`,
    shortId,
    level: row.level,
    origin,
    icon: row.icon,
    side: state.player,
  };
};

/** Every badge a whole match raised, per settled ply, for both sides. */
export type GameAchievements = {
  /** `perPly[i]` rises when settled resolve `i` finishes playing. */
  perPly: AchievementBubble[][];
  /** Win-gated levels, raised on the final board. */
  final: AchievementBubble[];
};

/**
 * Replay a finished match's tally for both colours — the Review screen's
 * source. Pure: the same record always yields the same bubbles. `opponent`
 * names the Adjutant tier each side beat, when it was one (live games: the
 * human's side), so Flawless can level.
 */
export const foldGame = (
  opening: { turn: number; placement: string; ccLives?: { w?: number; b?: number } },
  plies: readonly FoldPly[],
  end?: { winner: StarChessColor | null; opponent?: Partial<Record<StarChessColor, string>> },
): GameAchievements => {
  const sides = (["w", "b"] as const).map((color) => seedAnalysis(opening, color));
  const perPly = plies.map((ply) => sides.flatMap((state) => foldTurn(state, ply)));
  const final = end
    ? sides.flatMap((state) =>
        finalizeAnalysis(
          state,
          end.winner == null ? "draw" : end.winner === state.player ? "win" : "loss",
          end.opponent?.[state.player],
        ),
      )
    : [];
  return { perPly, final };
};
