import { endScTurn, parseScFen } from "@chess-coach/starchess-core";
import { describe, expect, it } from "vitest";

import {
  TURN_ANALYSIS_BUDGET_MS,
  bubbleMotion,
  careerLevel,
  finalizeAnalysis,
  foldTurn,
  originOf,
  pieceId,
  seedAnalysis,
} from "~/achievements/analysis";

const play = (state: ReturnType<typeof seedAnalysis>, scfen: string) => {
  const snap = parseScFen(scfen);
  const result = endScTurn(snap);
  const bubbles = foldTurn(state, {
    turn: result.next.turn,
    placement: result.next.placement,
    beforePlacement: snap.placement,
    siegedRooks: result.next.siegedRooks,
    kingLives: result.next.kingLives,
    mines: result.next.mines,
    events: result.events,
    attacks: result.resolved.attacks,
    moves: result.resolved.moves,
    mineTriggers: result.resolved.mineTriggers,
    promotions: result.resolved.promotions,
  });
  return { result, bubbles };
};

const levelOf = (state: ReturnType<typeof seedAnalysis>, shortId: string) => state.announced[shortId] ?? 0;

describe("piece id", () => {
  it("keeps turn-type-origin across a later capture", () => {
    const state = seedAnalysis(
      parseScFen("SCFEN|4k3/8/8/3q4/3Q4/8/8/4K3|1|33|P|G:11:11|Q:w:C=d4d5;b:"),
      "w",
    );
    expect(state.at.get("d4")).toBe(pieceId(1, "q", "d4"));
    const { bubbles } = play(
      state,
      "SCFEN|4k3/8/8/3q4/3Q4/8/8/4K3|1|33|P|G:11:11|Q:w:C=d4d5;b:",
    );
    expect(state.material.get("1-q-d4")).toBe(0);
    expect(originOf("1-q-d4")).toBe("d4");
    expect(state.at.get("d5")).toBe("1-q-d4");
    expect(bubbles.some((bubble) => bubble.shortId === "stonks")).toBe(false);
  });
});

describe("foldTurn on one settled ply", () => {
  it("awards Medal of Honor when a marine intercepts and dies", () => {
    const scfen =
      "SCFEN|7k/8/8/8/1b6/8/2PR4/3K4|11|33|P|G:12:22|S:d2|Q:w:B=pawnDouble:c2:c3;b:C=b4d2";
    const state = seedAnalysis(parseScFen(scfen), "w");
    const { bubbles } = play(state, scfen);
    expect(state.intercepts).toBe(1);
    expect(bubbles.some((bubble) => bubble.shortId === "medal" && bubble.origin === "c2")).toBe(
      true,
    );
  });

  it("counts a pawn that takes a queen as Stonks level 2 and not level 3", () => {
    const scfen = "SCFEN|4k3/8/8/3q4/2P5/8/8/4K3|1|33|P|G:11:11|Q:w:C=c4d5;b:";
    const state = seedAnalysis(parseScFen(scfen), "w");
    const { bubbles } = play(state, scfen);
    expect(state.material.get("1-p-c4")).toBe(8);
    expect(levelOf(state, "stonks")).toBe(2);
    expect(bubbles.find((bubble) => bubble.shortId === "stonks")?.origin).toBe("c4");
  });

  it("promotes two marines to GO GO GO level 2", () => {
    const first = "SCFEN|k7/3PP3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:C=d7d8q;b:";
    const state = seedAnalysis(parseScFen(first), "w");
    const opened = play(state, first);
    const second = `SCFEN|${opened.result.next.placement}|${opened.result.next.turn}|33|P|G:11:11|Q:w:C=e7e8q;b:`;
    play(state, second);
    expect(state.promotions).toBeGreaterThanOrEqual(2);
    expect(levelOf(state, "gogo")).toBeGreaterThanOrEqual(2);
  });

  it("holds full vision for four turns", () => {
    let scfen = "SCFEN|4k3/8/8/8/4R3/8/8/4K3|1|33|P|G:11:11|S:e4|Q:w:;b:";
    const state = seedAnalysis(parseScFen(scfen), "w");
    for (let i = 0; i < 4; i += 1) {
      const played = play(state, scfen);
      scfen = `SCFEN|${played.result.next.placement}|${played.result.next.turn}|33|P|G:${played.result.next.gas.w}${played.result.next.gas.b}:${played.result.next.gasIncome.w}${played.result.next.gasIncome.b}|S:${(played.result.next.siegedRooks ?? []).join("")}|Q:w:;b:`;
    }
    expect(levelOf(state, "vision")).toBeGreaterThanOrEqual(2);
  });

  it("detonates two friendly mines", () => {
    const first = "SCFEN|4k3/8/4p3/8/4p3/8/8/4K3|1|33|P|G:11:11|M:w:e5,d4|Q:w:;b:C=e6e5";
    const state = seedAnalysis(parseScFen(first), "w");
    play(state, first);
    const second = "SCFEN|4k3/8/8/3p4/8/8/8/4K3|2|33|P|G:11:11|M:w:d4|Q:w:;b:C=d5d4";
    play(state, second);
    expect(state.mines).toBeGreaterThanOrEqual(2);
    expect(levelOf(state, "mines")).toBeGreaterThanOrEqual(2);
  });

  it("snipes two battleships", () => {
    const first =
      "SCFEN|4k3/8/8/8/q7/8/8/3BK3|21|33|P|G:13:33|Q:w:B=bishopSnipe:d1:a4;b:";
    const state = seedAnalysis(parseScFen(first), "w");
    play(state, first);
    const second =
      "SCFEN|4k3/8/8/7q/8/8/8/3BK3|22|33|P|G:13:33|Q:w:B=bishopSnipe:d1:h5;b:";
    play(state, second);
    expect(state.mechaKills).toBeGreaterThanOrEqual(2);
    expect(levelOf(state, "mecha")).toBeGreaterThanOrEqual(2);
  });

  it("finalizes a short flawless strategic win at level 2", () => {
    const scfen = "SCFEN|4k3/4Q3/8/8/8/8/8/4K3|5|31|P|G:11:11|Q:w:C=e7e8;b:";
    const snap = parseScFen(scfen);
    const state = seedAnalysis(snap, "w");
    const { result } = play(state, scfen);
    expect(result.next.kingLives.b).toBe(0);
    const bubbles = finalizeAnalysis(state, "win", "strategic");
    expect(bubbles.some((bubble) => bubble.shortId === "flawless" && bubble.level >= 2)).toBe(true);
    expect(bubbles.some((bubble) => bubble.shortId === "cheese" && bubble.level >= 2)).toBe(true);
  });
});

describe("career levels", () => {
  it("maps one strategic win to level 2 and 100 wins to the hundred badge", () => {
    expect(careerLevel({ strategic: 1 }, 1)).toBe(2);
    expect(careerLevel({ strategic: 1 }, 100)).toBe(0);
    expect(careerLevel({ strategic: 100 }, 100)).toBe(2);
    expect(careerLevel({ naive: 100 }, 100)).toBe(1);
  });
});

describe("bubble motion", () => {
  it("rises 2 squares in 1s and is gone at 3s", () => {
    expect(bubbleMotion(0)).toEqual({ squares: 0, opacity: 1 });
    expect(bubbleMotion(1000)).toEqual({ squares: 2, opacity: 1 });
    expect(bubbleMotion(2000).squares).toBe(2);
    expect(bubbleMotion(2000).opacity).toBeCloseTo(Math.exp(-2), 5);
    expect(bubbleMotion(3000)).toEqual({ squares: 2, opacity: 0 });
  });
});

describe("turn analysis budget", () => {
  it("folds 45 settled plies in under 50ms", () => {
    const scfen = "SCFEN|4k3/8/8/3q4/3Q4/8/8/4K3|1|33|P|G:11:11|Q:w:C=d4d5;b:";
    const opening = parseScFen(scfen);
    const state = seedAnalysis(opening, "w");
    const ply = endScTurn(opening);
    const started = performance.now();
    for (let turn = 0; turn < 45; turn += 1) {
      foldTurn(state, {
        turn: ply.next.turn + turn,
        placement: ply.next.placement,
        siegedRooks: ply.next.siegedRooks,
        kingLives: ply.next.kingLives,
        mines: ply.next.mines,
        events: ply.events,
        attacks: [],
        moves: [],
        promotions: ply.resolved.promotions,
      });
    }
    expect(performance.now() - started).toBeLessThan(TURN_ANALYSIS_BUDGET_MS);
  });
});
