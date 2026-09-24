/**
 * Every capture list the engine can put a badge event in, played for real:
 * SCFEN → `endScTurn` → `foldPlyFromResolve` (the mapping SingleScreen uses)
 * → `foldTurn`. Each case is a path the tally used to drop on the floor.
 */
import { UNIT_COST, endScTurn, parseScFen } from "@chess-coach/starchess-core";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ensureAchievementLive,
  finalizeAchievementLive,
  noteSettledPlies,
  resetAchievementLive,
} from "~/achievements/achievementLive";
import { foldPlyFromResolve, foldTurn, seedAnalysis } from "~/achievements/analysis";

type State = ReturnType<typeof seedAnalysis>;

const play = (state: State, scfen: string) => {
  const snap = parseScFen(scfen);
  const result = endScTurn(snap);
  const bubbles = foldTurn(state, foldPlyFromResolve(result, snap.placement));
  return { result, bubbles };
};

const levelOf = (state: State, shortId: string) => state.announced[shortId] ?? 0;

describe("badge events the engine reports outside `attacks`", () => {
  it("credits a path-reveal capture to the slider that left, and follows it", () => {
    // Ra1→a8 runs into a fogged pawn on a5: the capture lives only in
    // `pathRevealAttacks`, `from` is where it spotted the pawn, and the rook
    // is in no move list.
    const first = "SCFEN|4k3/8/8/p7/8/8/8/R3K3|1|33|P|G:11:11|Q:w:C=a1a8;b:";
    const state = seedAnalysis(parseScFen(first), "w");
    const { result } = play(state, first);
    expect(result.resolved.attacks).toEqual([]);
    expect(result.resolved.pathRevealAttacks).toHaveLength(1);
    expect(state.material.get("1-r-a1")).toBe(UNIT_COST.p - UNIT_COST.r);
    expect(state.at.get("a5")).toBe("1-r-a1");

    // The same rook takes a BattleShip next turn: one piece, one running total.
    const second = `SCFEN|4k3/8/8/R7/q7/8/8/4K3|2|33|P|G:11:11|Q:w:C=a5a4;b:`;
    play(state, second);
    expect(state.material.get("1-r-a1")).toBe(UNIT_COST.p + UNIT_COST.q - UNIT_COST.r);
  });

  it("credits a collision capture to the mover, not to the meeting square", () => {
    // Nf3 and nf5 both land on e5 and trade. White's capture reports
    // `from: e5`; its own move says it came from f3.
    const scfen = "SCFEN|4k3/8/8/5n2/8/5N2/8/4K3|1|33|P|G:11:11|Q:w:C=f3e5;b:C=f5e5";
    const state = seedAnalysis(parseScFen(scfen), "w");
    const { result } = play(state, scfen);
    expect(result.resolved.moveCollisions.length).toBeGreaterThan(0);
    expect(state.material.get("1-n-f3")).toBe(0);
    expect([...state.material.keys()].some((id) => id.includes("-x-"))).toBe(false);
  });

  it("counts an enemy gas step onto our mine for Is that it?", () => {
    // A special-phase trip is only an event, coloured by the enemy mover.
    const scfen =
      "SCFEN|4k3/8/4p3/8/8/8/8/4K3|1|33|P|G:10:11|M:w:e5|Q:w:;b:B=pawnDouble:e6:e5";
    const state = seedAnalysis(parseScFen(scfen), "w");
    const { result } = play(state, scfen);
    expect(result.resolved.mineTriggers).toEqual([]);
    expect(state.mines).toBe(1);
    expect(levelOf(state, "mines")).toBe(1);
  });

  it("credits a deploy that crushes an enemy, for Stonks and Let there be Light", () => {
    const scfen =
      "SCFEN|4k3/8/8/8/8/8/3q4/4K3|1|33|P|G:01:11|B:3:3|Q:w:B=spawn:e1:d2:p;b:";
    const state = seedAnalysis(parseScFen(scfen), "w");
    play(state, scfen);
    // A deploy's id is stamped with the turn it entered (the post-resolve turn).
    const marine = state.at.get("d2")!;
    expect(marine).toMatch(/-p-d2$/);
    expect(state.material.get(marine)).toBe(UNIT_COST.q - UNIT_COST.p);
    expect(levelOf(state, "stonks")).toBe(2);
    expect(state.ccCaptures).toBe(1);
  });

  it("counts a Marine promoted by a gas step for GO GO GO", () => {
    const scfen = "SCFEN|k7/3P4/8/8/8/8/8/4K3|1|33|P|G:01:11|Q:w:B=pawnDouble:d7:d8:q;b:";
    const state = seedAnalysis(parseScFen(scfen), "w");
    play(state, scfen);
    expect(state.promotions).toBe(1);
    expect(levelOf(state, "gogo")).toBe(1);
  });

  it("counts a capture beside our Command Center for Let there be Light", () => {
    const scfen = "SCFEN|4k3/8/8/8/8/8/3p4/3RK3|1|33|P|G:11:11|Q:w:C=d1d2;b:";
    const state = seedAnalysis(parseScFen(scfen), "w");
    play(state, scfen);
    expect(state.ccCaptures).toBe(1);
  });

  it("streaks BattleShip jumps on consecutive turns for Make it happen", () => {
    const first = "SCFEN|4k3/8/8/8/8/8/8/Q3K3|21|33|P|G:03:33|Q:w:B=queenWarp:a1:a4;b:";
    const state = seedAnalysis(parseScFen(first), "w");
    const opened = play(state, first);
    const second = `SCFEN|${opened.result.next.placement}|${opened.result.next.turn}|33|P|G:03:33|Q:w:B=queenWarp:a4:h4;b:`;
    play(state, second);
    expect(state.bestJump).toBe(2);
    expect(levelOf(state, "juke")).toBe(1);
  });
});

describe("a live match, start to finish", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAchievementLive();
  });

  it("returns mid-game and end-of-game badges together on a win", () => {
    // Turn 1: pawn takes a BattleShip (Stonks 2) while the Ship on e7 chips
    // the Command Center. Turn 2: the last check lands — a lethal check ends
    // the resolve, so the capture cannot share its turn. The dead Command
    // Center stays on the board, so the Human Training bubble has a square.
    const opening = "SCFEN|4k3/4Q3/8/8/8/3q4/2P5/4K3|1|32|P|G:11:11|Q:w:C=c2d3;b:";
    const snap = parseScFen(opening);
    ensureAchievementLive("full-match", "w", snap);
    const first = endScTurn(snap);
    const next = parseScFen(
      `SCFEN|${first.next.placement}|${first.next.turn}|3${first.next.kingLives.b}|P|G:11:11|Q:w:;b:`,
    );
    const second = endScTurn(next);
    noteSettledPlies([
      foldPlyFromResolve(first, snap.placement),
      foldPlyFromResolve(second, next.placement),
    ]);
    expect(second.next.kingLives.b).toBe(0);
    expect(second.next.placement).toContain("k");

    const earned = finalizeAchievementLive("win", "naive", []);
    const badges = Object.fromEntries(earned.map((b) => [b.shortId, b.level]));
    expect(badges).toMatchObject({ stonks: 2, beat: 1, flawless: 1, cheese: 5 });
  });
});
