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
import { tierForOpponent } from "~/achievements/types";

const [bubbles, setBubbles] = createSignal<AchievementBubble[]>([]);

let live: { matchId: string; state: AnalysisState; cursor: number; finalized: boolean } | null =
  null;

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
  };
  setBubbles([]);
};

export const achievementCursor = (): number => live?.cursor ?? 0;

export const liveAnalysis = (): AnalysisState | null => live?.state ?? null;

export const noteSettledPlies = (fresh: readonly FoldPly[]): void => {
  if (!live || fresh.length === 0) return;
  for (const ply of fresh) {
    pushAchievementBubbles(foldTurn(live.state, ply));
  }
  live.cursor += fresh.length;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.achievementAnnounced = JSON.stringify(
      live.state.announced,
    );
  }
};

const CAREER_KEY = "starchess_achievement_career";

type CareerFile = { wins: Record<string, number>; beat: number; beat100: number };

const emptyCareer = (): CareerFile => ({ wins: {}, beat: 0, beat100: 0 });

const loadCareer = (): CareerFile => {
  try {
    if (typeof localStorage === "undefined") return emptyCareer();
    const raw = localStorage.getItem(CAREER_KEY);
    if (!raw) return emptyCareer();
    const parsed = JSON.parse(raw) as Partial<CareerFile>;
    return {
      wins: parsed.wins ?? {},
      beat: parsed.beat ?? 0,
      beat100: parsed.beat100 ?? 0,
    };
  } catch {
    return emptyCareer();
  }
};

const saveCareer = (career: CareerFile): void => {
  try {
    localStorage?.setItem(CAREER_KEY, JSON.stringify(career));
  } catch {
    /* quota */
  }
};

export const finalizeAchievementLive = (
  result: "win" | "loss" | "draw",
  opponent: string | undefined,
): AchievementBubble[] => {
  if (!live || live.finalized) return [];
  live.finalized = true;
  const bubbles = finalizeAnalysis(live.state, result, opponent);
  if (result === "win") {
    const career = loadCareer();
    const tier = tierForOpponent(opponent);
    if (tier) career.wins[tier] = (career.wins[tier] ?? 0) + 1;
    const beat = careerLevel(career.wins, 1);
    const hundred = careerLevel(career.wins, 100);
    const enemy = live.state.player === "w" ? "b" : "w";
    const origin =
      bubbles[0]?.origin ??
      [...placementKing(live.state.lastPlacement, enemy)];
    const spot = typeof origin === "string" ? origin : origin[0];
    if (beat > career.beat && spot) {
      career.beat = beat;
      const bubble = mintBubble(live.state, "beat", beat, spot);
      if (bubble) bubbles.push(bubble);
    }
    if (hundred > career.beat100 && spot) {
      career.beat100 = hundred;
      const bubble = mintBubble(live.state, "beat100", hundred, spot);
      if (bubble) bubbles.push(bubble);
    }
    saveCareer(career);
  }
  pushAchievementBubbles(bubbles);
  return bubbles;
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
