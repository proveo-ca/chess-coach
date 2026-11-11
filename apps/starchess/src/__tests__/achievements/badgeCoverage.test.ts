/**
 * Every capture list the engine can put a badge event in, played for real:
 * SCFEN → `endScTurn` → `foldPlyFromResolve` (the mapping SingleScreen uses)
 * → `foldTurn`. Each case is a path the tally used to drop on the floor.
 */
import { UNIT_COST, endScTurn, parseScFen, placementToMap } from "@chess-coach/starchess-core";
import { beforeEach, describe, expect, it } from "vitest";

import {
  achievementBubbles,
  ensureAchievementLive,
  finalizeAchievementLive,
  noteSettledPlies,
  resetAchievementLive,
} from "~/achievements/achievementLive";
import { foldGame, foldPlyFromResolve, foldTurn, seedAnalysis } from "~/achievements/analysis";

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
    // Ra1→a8 runs into a fogged Marine on a5: the capture lives only in
    // `pathRevealAttacks`, `from` is where it spotted the Marine, and the Tank
    // is in no move list.
    const first = "SCFEN|4k3/8/8/p7/8/8/8/R3K3|1|33|P|G:11:11|Q:w:C=a1a8;b:";
    const state = seedAnalysis(parseScFen(first), "w");
    const { result } = play(state, first);
    expect(result.resolved.attacks).toEqual([]);
    expect(result.resolved.pathRevealAttacks).toHaveLength(1);
    expect(state.material.get("1-r-a1")).toBe(UNIT_COST.p - UNIT_COST.r);
    expect(state.at.get("a5")).toBe("1-r-a1");

    // The same Tank takes a BattleShip next turn: one piece, one running total.
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
      "SCFEN|4k3/8/4p3/8/8/8/8/4K3|1|33|P|G:10:11|M:w:e5|Q:w:;b:B=stimStep:e6:e5";
    const state = seedAnalysis(parseScFen(scfen), "w");
    const { result } = play(state, scfen);
    expect(result.resolved.mineTriggers).toEqual([]);
    expect(state.mines).toBe(1);
    expect(levelOf(state, "mines")).toBe(1);
  });

  it("credits a deploy that crushes an enemy for Stonks, not Let there be Light", () => {
    const scfen =
      "SCFEN|4k3/8/8/8/8/8/3q4/4K3|1|33|P|G:01:11|B:3:3|Q:w:B=deploy:e1:d2:p;b:";
    const state = seedAnalysis(parseScFen(scfen), "w");
    play(state, scfen);
    // A deploy's id is stamped with the turn it entered (the post-resolve turn).
    const marine = state.at.get("d2")!;
    expect(marine).toMatch(/-p-d2$/);
    expect(state.material.get(marine)).toBe(UNIT_COST.q - UNIT_COST.p);
    expect(levelOf(state, "stonks")).toBe(2);
    // The BattleShip stood beside the Command Center: Light is already over.
    expect(state.ccBreached).toBe(true);
    expect(state.ccCaptures).toBe(0);
  });

  it("counts a Marine promoted by a gas step for GO GO GO", () => {
    const scfen = "SCFEN|k7/3P4/8/8/8/8/8/4K3|1|33|P|G:01:11|Q:w:B=stimStep:d7:d8:q;b:";
    const state = seedAnalysis(parseScFen(scfen), "w");
    play(state, scfen);
    expect(state.promotions).toBe(1);
    expect(levelOf(state, "gogo")).toBe(1);
  });


  it("streaks BattleShip jumps on consecutive turns for Make it happen", () => {
    const first = "SCFEN|4k3/8/8/8/8/8/8/Q3K3|21|33|P|G:03:33|Q:w:B=tacticalJump:a1:a4;b:";
    const state = seedAnalysis(parseScFen(first), "w");
    const opened = play(state, first);
    const second = `SCFEN|${opened.result.next.placement}|${opened.result.next.turn}|33|P|G:03:33|Q:w:B=tacticalJump:a4:h4;b:`;
    play(state, second);
    expect(state.bestJump).toBe(2);
    expect(levelOf(state, "juke")).toBe(1);
  });
});

/** Next turn's SCFEN from a resolve, with a fresh queue. */
const nextTurn = (
  result: ReturnType<typeof endScTurn>,
  queue: string,
  gas = "G:11:11",
): string =>
  `SCFEN|${result.next.placement}|${result.next.turn}|33|P|${gas}|Q:w:${queue};b:`;

describe("Stonks scores one literal unit, not a unit type", () => {
  it("keeps two Marines' captures apart", () => {
    // Each Marine takes a Hoverbike: +2 apiece. Summed by type that would be
    // +4 and reach level 1; per instance neither Marine clears 3.
    const first = "SCFEN|4k3/8/8/8/8/1n3n2/P3P3/4K3|1|33|P|G:11:11|Q:w:C=a2b3;b:";
    const state = seedAnalysis(parseScFen(first), "w");
    const opened = play(state, first);
    play(state, nextTurn(opened.result, "C=e2f3"));
    expect(state.material.get("1-p-a2")).toBe(UNIT_COST.n - UNIT_COST.p);
    expect(state.material.get("1-p-e2")).toBe(UNIT_COST.n - UNIT_COST.p);
    expect(levelOf(state, "stonks")).toBe(0);
  });

  it("follows a Marine through move-then-gas, so its next capture is its own", () => {
    // C e2→e3, then the gas step fires after the move: e3→e4.
    const first = "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:01:11|Q:w:C=e2e3,F=stimStep:e3:e4;b:";
    const state = seedAnalysis(parseScFen(first), "w");
    const opened = play(state, first);
    expect(opened.result.next.placement).toBe("4k3/8/8/8/4P3/8/8/4K3");
    expect(state.at.get("e4")).toBe("1-p-e2");
    const board = opened.result.next.placement.replace("8/8/8/4P3", "8/8/3q4/4P3");
    play(state, `SCFEN|${board}|${opened.result.next.turn}|33|P|G:11:11|Q:w:C=e4d5;b:`);
    expect(state.material.get("1-p-e2")).toBe(UNIT_COST.q - UNIT_COST.p);
  });

  it("follows a Marine through gas-then-move", () => {
    const first = "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:01:11|Q:w:B=stimStep:e2:e3,C=e3e4;b:";
    const state = seedAnalysis(parseScFen(first), "w");
    play(state, first);
    expect(state.at.get("e4")).toBe("1-p-e2");
    expect(state.at.has("e3")).toBe(false);
  });

  it("opens a Command Center capture at the Command Center's own cost", () => {
    const scfen = "SCFEN|4k3/8/8/8/8/8/3n4/4K3|1|33|P|G:11:11|Q:w:C=e1d2;b:";
    const state = seedAnalysis(parseScFen(scfen), "w");
    play(state, scfen);
    expect(state.material.get("1-k-e1")).toBe(UNIT_COST.n - UNIT_COST.k);
  });

  it("keeps a promoted Marine's birth id and birth cost", () => {
    const first = "SCFEN|k7/3P4/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:C=d7d8q;b:";
    const state = seedAnalysis(parseScFen(first), "w");
    const opened = play(state, first);
    const board = opened.result.next.placement.replace("/8/8/8/8/8/8/", "/8/8/8/8/8/3q4/");
    play(state, `SCFEN|${board}|${opened.result.next.turn}|33|P|G:11:11|Q:w:C=d8d2;b:`);
    // The BattleShip it became is still the Marine that cost 1.
    expect(state.material.get("1-p-d7")).toBe(UNIT_COST.q - UNIT_COST.p);
  });
});

describe("a live match, start to finish", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAchievementLive();
  });

  it("returns mid-game and end-of-game badges together on a win", () => {
    // Turn 1: Marine takes a BattleShip (Stonks 2) while the Ship on e7 chips
    // the Command Center. Turn 2: the last check lands — a lethal check ends
    // the resolve, so the capture cannot share its turn. The dead Command
    // Center stays on the board, so the Human Training bubble has a square.
    const opening = "SCFEN|4k3/4Q3/8/8/8/3q4/2P5/4K3|1|32|P|G:11:11|Q:w:C=c2d3;b:";
    const snap = parseScFen(opening);
    ensureAchievementLive("full-match", "w", snap);
    const first = endScTurn(snap);
    const next = parseScFen(
      `SCFEN|${first.next.placement}|${first.next.turn}|3${first.next.ccLives.b}|P|G:11:11|Q:w:;b:`,
    );
    const second = endScTurn(next);
    noteSettledPlies([
      foldPlyFromResolve(first, snap.placement),
      foldPlyFromResolve(second, next.placement),
    ]);
    expect(second.next.ccLives.b).toBe(0);
    expect(second.next.placement).toContain("k");

    const earned = finalizeAchievementLive("win", "naive", []);
    const badges = Object.fromEntries(earned.map((b) => [b.shortId, b.level]));
    expect(badges).toMatchObject({ stonks: 2, beat: 1, flawless: 1, cheese: 5 });
  });
});

describe("where a bubble rises, and whose it is", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAchievementLive();
  });

  it("rises from the achieving unit's square after the ply, not where it was born", () => {
    // e4 Marine takes d5's BattleShip, then gas-steps on to d6 in the same ply.
    const scfen =
      "SCFEN|4k3/8/8/3q4/4P3/8/8/4K3|1|33|P|G:01:11|Q:w:C=e4d5,F=stimStep:d5:d6;b:";
    const state = seedAnalysis(parseScFen(scfen), "w");
    const { result, bubbles } = play(state, scfen);
    expect(result.next.placement).toBe("4k3/8/3P4/8/8/8/8/4K3");
    expect(bubbles.find((bubble) => bubble.shortId === "stonks")).toMatchObject({
      origin: "d6",
      side: "w",
    });
  });

  it("shows the Adjutant's bubble only on a square the player can see", () => {
    // Black's b4 Marine takes the BattleShip on a3 (+8, Stonks 2). With only a
    // Command Center on h1 the player cannot see a3 once the Ship is gone.
    const fogged = "SCFEN|4k3/8/8/8/1p6/Q7/8/7K|1|33|P|G:11:11|Q:w:;b:C=b4a3";
    const snap = parseScFen(fogged);
    ensureAchievementLive("rival-fog", "w", snap);
    const took = endScTurn(snap);
    expect(took.next.placement).toBe("4k3/8/8/8/8/p7/8/7K");
    noteSettledPlies([foldPlyFromResolve(took, snap.placement)]);
    expect(achievementBubbles()).toEqual([]);

    // A Tank on a1 watches the a-file: the same capture now shows, as Black's.
    resetAchievementLive();
    const seen = parseScFen("SCFEN|4k3/8/8/8/1p6/Q7/8/R6K|1|33|P|G:11:11|Q:w:;b:C=b4a3");
    ensureAchievementLive("rival-seen", "w", seen);
    noteSettledPlies([foldPlyFromResolve(endScTurn(seen), seen.placement)]);
    expect(achievementBubbles()).toEqual([
      expect.objectContaining({ shortId: "stonks", level: 2, origin: "a3", side: "b" }),
    ]);
    // Shown, never granted.
    expect(finalizeAchievementLive("draw", "naive", [])).toEqual([]);
  });

  it("replays a whole match for both sides, with ids that never collide", () => {
    const first = "SCFEN|4k3/8/8/3q4/2P5/8/8/4K3|1|33|P|G:11:11|Q:w:C=c4d5;b:";
    const snap = parseScFen(first);
    const r1 = endScTurn(snap);
    const second = parseScFen(
      `SCFEN|${r1.next.placement.replace("8/8/8/4K3", "8/1p6/Q7/4K3")}|${r1.next.turn}|33|P|G:11:11|Q:w:;b:C=b3a2`,
    );
    const r2 = endScTurn(second);
    const game = foldGame(snap, [
      foldPlyFromResolve(r1, snap.placement),
      foldPlyFromResolve(r2, second.placement),
    ]);
    expect(game.perPly[0]).toEqual([expect.objectContaining({ shortId: "stonks", side: "w" })]);
    expect(game.perPly[1]).toEqual([expect.objectContaining({ shortId: "stonks", side: "b" })]);
    const ids = game.perPly.flat().map((bubble) => bubble.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(game.final).toEqual([]);
  });
});

describe("Let there be Light counts the 7x7 until an enemy reaches the 3x3", () => {
  it("counts a capture three squares from the Command Center", () => {
    const scfen = "SCFEN|4k3/8/8/8/7p/8/8/4K2R|1|33|P|G:11:11|Q:w:C=h1h4;b:";
    const state = seedAnalysis(parseScFen(scfen), "w");
    play(state, scfen);
    expect(state.ccCaptures).toBe(1);
  });

  it("does not count a capture four squares out", () => {
    const scfen = "SCFEN|4k3/8/8/7p/8/8/8/4K2R|1|33|P|G:11:11|Q:w:C=h1h5;b:";
    const state = seedAnalysis(parseScFen(scfen), "w");
    play(state, scfen);
    expect(state.ccCaptures).toBe(0);
  });

  it("stops counting once an enemy steps beside the Command Center", () => {
    const first = "SCFEN|4k3/8/8/8/2n2p1p/8/8/4K2R|1|33|P|G:11:11|Q:w:C=h1h4;b:";
    const state = seedAnalysis(parseScFen(first), "w");
    const opened = play(state, first);
    expect(state.ccCaptures).toBe(1);

    // The Hoverbike lands on d2, beside e1.
    const stepIn = `SCFEN|${opened.result.next.placement}|${opened.result.next.turn}|33|P|G:11:11|Q:w:;b:C=c4d2`;
    const stepped = play(state, stepIn);
    expect(placementToMap(stepped.result.next.placement).get("d2")).toMatchObject({ type: "n", color: "b" });
    expect(state.ccBreached).toBe(true);

    // It steps back out, and a capture inside the 7x7 still no longer counts.
    const after = `SCFEN|${stepped.result.next.placement}|${stepped.result.next.turn}|33|P|G:11:11|Q:w:C=h4f4;b:C=d2b3`;
    const { result, bubbles } = play(state, after);
    expect(placementToMap(result.next.placement).get("f4")).toMatchObject({ color: "w" });
    expect(placementToMap(result.next.placement).get("d2")).toBeUndefined();
    expect(state.ccCaptures).toBe(1);
    expect(bubbles.some((bubble) => bubble.shortId === "light")).toBe(false);
  });
});
