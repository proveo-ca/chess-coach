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
};

export type FoldMove = { color?: string; from?: string; to?: string };

export type FoldPly = {
  turn: number;
  placement: string;
  siegedRooks?: readonly string[];
  kingLives?: { w?: number; b?: number };
  mines?: readonly { at: string; color: string }[];
  events?: readonly MeasuredEvent[];
  /** Board before this ply. Intercepts read the friend standing behind the marine. */
  beforePlacement?: string;
  attacks?: readonly FoldAttack[];
  moves?: readonly FoldMove[];
  mineTriggers?: readonly FoldAttack[];
  promotions?: readonly { color?: string; from?: string; at?: string }[];
};

const valueOf = (type: string | undefined): number => {
  if (type === "k" || type === "p" || type === "n" || type === "b" || type === "r" || type === "q") {
    return UNIT_COST[type];
  }
  return 0;
};

const near = (king: string, sq: string): boolean => {
  if (sq.length < 2 || king.length < 2) return false;
  return (
    Math.abs(king.charCodeAt(0) - sq.charCodeAt(0)) <= 1 &&
    Math.abs(Number(king[1]) - Number(sq[1])) <= 1
  );
};

export const seedAnalysis = (
  opening: { turn: number; placement: string; kingLives?: { w?: number; b?: number } },
  player: StarChessColor,
): AnalysisState => {
  const at = new Map<string, string>();
  for (const [square, piece] of placementToMap(opening.placement)) {
    if (piece.color !== player || piece.type === "k") continue;
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
    startLives: opening.kingLives?.[player] ?? 3,
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
    id: `${shortId}-${level}-${state.seq++}`,
    shortId,
    level: row.level,
    origin,
    icon: row.icon,
  });
};

const idAt = (state: AnalysisState, square: string, turn: number): string => {
  const existing = state.at.get(square);
  if (existing) return existing;
  const id = pieceId(turn, "x", square);
  state.at.set(square, id);
  return id;
};

const kingSquare = (placement: string, color: StarChessColor): string | null => {
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

const FILES = "abcdefgh";

const protectsFriend = (
  placement: string,
  from: string,
  to: string,
  friend: StarChessColor,
): boolean => {
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return false;
  const df = FILES.indexOf(to[0]!) - FILES.indexOf(from[0]!);
  const dr = Number(to[1]) - Number(from[1]);
  if (df === 0 && dr === 0) return false;
  const ortho = df === 0 || dr === 0;
  const diag = Math.abs(df) === Math.abs(dr);
  if (!ortho && !diag) return false;
  const stepF = Math.sign(df);
  const stepR = Math.sign(dr);
  const map = placementToMap(placement);
  let file = FILES.indexOf(to[0]!) + stepF;
  let rank = Number(to[1]) + stepR;
  while (file >= 0 && file < 8 && rank >= 1 && rank <= 8) {
    const piece = map.get(`${FILES[file]}${rank}` as Square);
    if (piece) return piece.color === friend && piece.type !== "p";
    file += stepF;
    rank += stepR;
  }
  return false;
};

/**
 * Fold one settled ply into `state`. Only this ply's events are read.
 * Returns bubbles for levels this ply newly reached, each rooted at a birth square.
 */
export const foldTurn = (state: AnalysisState, ply: FoldPly): AchievementBubble[] => {
  const bubbles: AchievementBubble[] = [];
  const player = state.player;
  let stonksOrigin: string | undefined;
  let medalOrigin: string | undefined;
  let promoOrigin: string | undefined;
  let mineOrigin: string | undefined;
  let mechaOrigin: string | undefined;
  let lightOrigin: string | undefined;
  let jumpOrigin: string | undefined;
  const king = kingSquare(ply.placement, player);

  for (const ev of ply.events ?? []) {
    if (ev.color !== player || !ev.from) continue;
    const piece = idAt(state, ev.from, ply.turn);
    if (ev.kind === "spawn" && ev.unit && ev.to) {
      state.at.set(ev.to, pieceId(ply.turn, ev.unit, ev.to));
      continue;
    }
    if (ev.kind === "queenWarp") jumpOrigin = originOf(piece);
    if ((ev.kind === "pawnDouble" || ev.kind === "queenWarp") && ev.to && ev.to !== ev.from) {
      state.at.delete(ev.from);
      state.at.set(ev.to, piece);
    }
  }

  const credit = (from: string, victimType: string | undefined, to: string | undefined) => {
    const piece = idAt(state, from, ply.turn);
    const opened = state.material.has(piece)
      ? state.material.get(piece)!
      : -valueOf(piece.split("-")[1]);
    const total = opened + valueOf(victimType);
    state.material.set(piece, total);
    stonksOrigin = originOf(piece);
    if (to && king && near(king, to)) {
      state.ccCaptures += 1;
      lightOrigin = originOf(piece);
    }
    return piece;
  };

  for (const atk of [...(ply.attacks ?? []), ...(ply.mineTriggers ?? [])]) {
    if (atk.kind === "mineBlast" && atk.mineColor === player) {
      state.mines += 1;
      mineOrigin = atk.to ?? atk.from;
    }
    if (atk.kind !== "capture" || !atk.from || !atk.to) continue;
    if (atk.victim?.piece === "p" && atk.victim.color === player && atk.color !== player) {
      const behind = protectsFriend(ply.beforePlacement ?? ply.placement, atk.from, atk.to, player);
      if (behind) {
        state.intercepts += 1;
        const id = state.at.get(atk.to);
        medalOrigin = id ? originOf(id) : atk.to;
      }
      continue;
    }
    if (atk.color !== player) continue;
    if (atk.victim?.color === player) continue;
    credit(atk.from, atk.victim?.piece, atk.to);
  }

  for (const ev of ply.events ?? []) {
    if (ev.color !== player) continue;
    if (ev.kind === "spawn" && ev.unit && ev.to) {
      state.at.set(ev.to, pieceId(ply.turn, ev.unit, ev.to));
      continue;
    }
    const from = ev.from;
    if (!from) continue;
    const piece = idAt(state, from, ply.turn);
    const enemyVictim = ev.victim?.color != null && ev.victim.color !== player;
    if (enemyVictim && ev.kind === "bishopSnipe") {
      credit(from, ev.victim?.type, ev.to);
      if (ev.victim?.type === "q") {
        state.mechaKills += 1;
        mechaOrigin = originOf(piece);
      }
    }
    if (ev.kind === "pawnDouble" && enemyVictim) credit(from, ev.victim?.type, ev.to);
  }

  for (const mv of ply.moves ?? []) {
    if (mv.color !== player || !mv.from || !mv.to || mv.from === mv.to) continue;
    const piece = idAt(state, mv.from, ply.turn);
    state.at.delete(mv.from);
    state.at.set(mv.to, piece);
  }

  for (const promo of ply.promotions ?? []) {
    if (promo.color !== player) continue;
    state.promotions += 1;
    const square = promo.at ?? promo.from;
    const id = square ? state.at.get(square) : undefined;
    promoOrigin = id ? originOf(id) : square;
  }

  if (jumpOrigin) {
    const next = bumpStreak(true, ply.turn, state.lastJumpTurn, state.jumpStreak);
    state.jumpStreak = next.streak;
    state.lastJumpTurn = next.last;
    if (next.streak > state.bestJump) state.bestJump = next.streak;
  }

  const sieged = new Set(ply.siegedRooks ?? []);
  const vision = getSideVision(ply.placement, player, {
    rookModeFor: (square: Square) => (sieged.has(square) ? "siege" : "tank"),
    mines: (ply.mines ?? []).map((mine) => ({
      at: mine.at as Square,
      color: mine.color as StarChessColor,
    })),
  });
  const visionNext = bumpStreak(
    vision.litSquares.size >= 64,
    ply.turn,
    state.lastVisionTurn,
    state.visionStreak,
  );
  state.visionStreak = visionNext.streak;
  state.lastVisionTurn = visionNext.last;
  if (visionNext.streak > state.bestVision) state.bestVision = visionNext.streak;

  const lives = ply.kingLives?.[player];
  if (lives != null && lives < state.startLives) state.damaged = true;
  state.turn = ply.turn;
  state.lastPlacement = ply.placement;

  let bestMaterial = 0;
  for (const value of state.material.values()) {
    if (value > bestMaterial) bestMaterial = value;
  }

  announce(state, "stonks", bestMaterial, stonksOrigin, bubbles);
  announce(state, "medal", state.intercepts, medalOrigin, bubbles);
  announce(state, "gogo", state.promotions, promoOrigin, bubbles);
  announce(state, "mines", state.mines, mineOrigin, bubbles);
  announce(state, "mecha", state.mechaKills, mechaOrigin, bubbles);
  announce(state, "light", state.ccCaptures, lightOrigin, bubbles);
  announce(state, "juke", state.bestJump, jumpOrigin, bubbles);
  announce(state, "vision", state.bestVision, king ?? undefined, bubbles);
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
  const origin = kingSquare(state.lastPlacement, enemy) ?? kingSquare(state.lastPlacement, state.player) ?? undefined;
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
            id: `flawless-${level}-${state.seq++}`,
            shortId: "flawless",
            level,
            origin,
            icon: row.icon,
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
    id: `${shortId}-${level}-${state.seq++}`,
    shortId,
    level: row.level,
    origin,
    icon: row.icon,
  };
};
