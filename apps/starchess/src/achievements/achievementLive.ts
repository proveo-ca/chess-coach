// SPEC: _spec/_plans/starchess-achievements.puml
/**
 * Live tally for the match on screen. Folds one settled ply at a time.
 * Bubbles are pushed here; the board only paints them.
 */
import { createSignal } from "solid-js";
import type { ScFenSnapshot, StarChessColor } from "@chess-coach/starchess-core";

import {
  finalizeAnalysis,
  foldTurn,
  mintBubble,
  careerLevel,
  seedAnalysis,
  type AchievementBubble,
  type AnalysisState,
  type FoldPly,
} from "~/achievements/analysis";
import { achievementsFor } from "~/achievements/catalog";
import { tierForOpponent } from "~/achievements/types";
import { matchHistory } from "~/store/matchHistoryStore";
import type { StarChessGameRecord } from "~/types/review";

const [bubbles, setBubbles] = createSignal<AchievementBubble[]>([]);

let live: {
  matchId: string;
  state: AnalysisState;
  cursor: number;
  finalized: boolean;
  /** Levels announced mid-game. Granted with the match, win or lose. */
  earned: AchievementBubble[];
} | null = null;

export const achievementBubbles = bubbles;

export const pushAchievementBubbles = (next: readonly AchievementBubble[]): void => {
  if (next.length === 0) return;
  setBubbles((prev) => [...prev, ...next]);
};

export const dismissAchievementBubble = (id: string): void => {
  setBubbles((prev) => prev.filter((bubble) => bubble.id !== id));
};

export const resetAchievementLive = (): void => {
  live = null;
  setBubbles([]);
};

export const ensureAchievementLive = (
  matchId: string,
  player: StarChessColor,
  opening: ScFenSnapshot,
): void => {
  if (live?.matchId === matchId) return;
  live = {
    matchId,
    state: seedAnalysis(opening, player),
    cursor: 0,
    finalized: false,
    earned: [],
  };
  setBubbles([]);
};

export const achievementCursor = (): number => live?.cursor ?? 0;

export const liveAnalysis = (): AnalysisState | null => live?.state ?? null;

export const noteSettledPlies = (fresh: readonly FoldPly[]): void => {
  if (!live || fresh.length === 0) return;
  for (const ply of fresh) {
    const minted = foldTurn(live.state, ply);
    live.earned.push(...minted);
    pushAchievementBubbles(minted);
  }
  live.cursor += fresh.length;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.achievementAnnounced = JSON.stringify(
      live.state.announced,
    );
  }
};

const CAREER_KEY = "starchess_achievement_career";

/** Wins the `beat50` family asks for — read from the catalog, not restated. */
const CAREER_GOAL = achievementsFor("beat50")[0]!.threshold;

type CareerFile = {
  /** Legacy per-tier counters, from before wins were kept by id. Read-only floor. */
  wins: Record<string, number>;
  /**
   * Won match ids per tier. Outlives match history, which keeps only the last
   * 150 games — so a win still counts after its replay is evicted.
   */
  winIds: Record<string, string[]>;
  beat: number;
  beat50: number;
};

const emptyCareer = (): CareerFile => ({ wins: {}, winIds: {}, beat: 0, beat50: 0 });

const loadCareer = (): CareerFile => {
  try {
    if (typeof localStorage === "undefined") return emptyCareer();
    const raw = localStorage.getItem(CAREER_KEY);
    if (!raw) return emptyCareer();
    // `beat100` is the field's name from when the family asked for 100 wins.
    const parsed = JSON.parse(raw) as Partial<CareerFile> & { beat100?: number };
    return {
      wins: parsed.wins ?? {},
      winIds: parsed.winIds ?? {},
      beat: parsed.beat ?? 0,
      beat50: parsed.beat50 ?? parsed.beat100 ?? 0,
    };
  } catch {
    return emptyCareer();
  }
};

type HistoryGame = Pick<StarChessGameRecord, "id" | "result" | "opponent">;

/**
 * Career wins per Adjutant tier across every game ever recorded: the union of
 * the ids kept here and the wins in match history (games from before this
 * ledger existed count too). Arena imports carry no `opponent`, so they never
 * count. A legacy counter is a floor, never added on top — its wins are
 * already in one of the two id sources.
 */
export const careerWins = (
  career: Pick<CareerFile, "wins" | "winIds">,
  history: readonly HistoryGame[],
): Record<string, number> => {
  const ids: Record<string, Set<string>> = {};
  const add = (tier: string, id: string) => (ids[tier] ??= new Set()).add(id);
  for (const [tier, list] of Object.entries(career.winIds)) {
    for (const id of list) add(tier, id);
  }
  for (const game of history) {
    const tier = tierForOpponent(game.opponent);
    if (tier && game.result === "win") add(tier, game.id);
  }
  const out: Record<string, number> = {};
  for (const tier of new Set([...Object.keys(ids), ...Object.keys(career.wins)])) {
    out[tier] = Math.max(career.wins[tier] ?? 0, ids[tier]?.size ?? 0);
  }
  return out;
};

/** Human Training levels, recomputed from the whole game history. */
export const careerAchievementLevels = (
  history: readonly HistoryGame[] = matchHistory(),
): { beat: number; beat50: number } => {
  const career = loadCareer();
  const wins = careerWins(career, history);
  return {
    beat: Math.max(career.beat, careerLevel(wins, 1)),
    beat50: Math.max(career.beat50, careerLevel(wins, CAREER_GOAL)),
  };
};

const saveCareer = (career: CareerFile): void => {
  try {
    localStorage?.setItem(CAREER_KEY, JSON.stringify(career));
  } catch {
    /* quota */
  }
};

/** The highest level each badge reached, in the order it was first earned. */
const bestPerBadge = (bubbles: readonly AchievementBubble[]): AchievementBubble[] => {
  const best = new Map<string, AchievementBubble>();
  for (const bubble of bubbles) {
    const prev = best.get(bubble.shortId);
    if (!prev || bubble.level > prev.level) best.set(bubble.shortId, bubble);
  }
  return [...best.values()];
};

/**
 * Close the match's tally. Board bubbles are only the win-gated levels minted
 * here; the return value is everything this match earned — mid-game levels
 * included — which is what the host grants and lists.
 */
export const finalizeAchievementLive = (
  result: "win" | "loss" | "draw",
  opponent: string | undefined,
  history: readonly HistoryGame[] = matchHistory(),
): AchievementBubble[] => {
  if (!live || live.finalized) return [];
  live.finalized = true;
  const bubbles = finalizeAnalysis(live.state, result, opponent);
  if (result === "win") {
    const career = loadCareer();
    const tier = tierForOpponent(opponent);
    if (tier) {
      const list = (career.winIds[tier] ??= []);
      if (!list.includes(live.matchId)) list.push(live.matchId);
    }
    const wins = careerWins(career, history);
    const beat = careerLevel(wins, 1);
    const fifty = careerLevel(wins, CAREER_GOAL);
    const enemy = live.state.player === "w" ? "b" : "w";
    const spot = bubbles[0]?.origin ?? placementKing(live.state.lastPlacement, enemy)[0];
    if (beat > career.beat && spot) {
      career.beat = beat;
      const bubble = mintBubble(live.state, "beat", beat, spot);
      if (bubble) bubbles.push(bubble);
    }
    if (fifty > career.beat50 && spot) {
      career.beat50 = fifty;
      const bubble = mintBubble(live.state, "beat50", fifty, spot);
      if (bubble) bubbles.push(bubble);
    }
    saveCareer(career);
  }
  pushAchievementBubbles(bubbles);
  return bestPerBadge([...live.earned, ...bubbles]);
};

const placementKing = (placement: string, color: "w" | "b"): string[] => {
  const rank = placement.split("/");
  const out: string[] = [];
  const files = "abcdefgh";
  rank.forEach((row, index) => {
    let file = 0;
    for (const char of row) {
      if (char >= "1" && char <= "8") {
        file += Number(char);
        continue;
      }
      const type = char.toLowerCase();
      const side = char === type ? "b" : "w";
      if (type === "k" && side === color) {
        out.push(`${files[file]}${8 - index}`);
      }
      file += 1;
    }
  });
  return out;
};
