import { describe, expect, it } from "vitest";
import { mapToPlacement, parseScFen, placementToMap, type PieceColor } from "@chess-coach/starchess-core";
import { baselinePolicy, baselineProposals } from "../challenge/baseline";
import { CHALLENGE_CONFIG } from "../challenge/config";
import { observe } from "../challenge/observation";

const opening = "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";

describe("authorized observation and baseline proposals", () => {
  it.each(["w", "b"] as PieceColor[])("keeps hidden state and metadata out of %s proposals and ranking", (side) => {
    const snap = parseScFen(opening);
    const map = placementToMap(snap.placement);
    const enemy = side === "w" ? "b" : "w";
    const dark = side === "w" ? "a8" : "a1";
    map.set(dark, { type: "r", color: enemy });
    const changed = { ...snap, placement: mapToPlacement(map), mines: [{ at: dark, color: enemy }],
      gas: { ...snap.gas, [enemy]: 0 }, stored: { w: 11, b: 12 },
      queue: { actions: [{ kind: "classical", timing: "C", color: enemy, from: side === "w" ? "e8" : "e1", to: dark, seq: 2 }] },
    } as typeof snap;
    const obs = observe(snap, { w: 3, b: 3 }, side);
    const obs2 = observe(changed, { w: side === "w" ? 3 : 12, b: side === "b" ? 3 : 12 }, side);
    expect(obs2).toEqual(obs);
    expect(baselineProposals(obs2)).toEqual(baselineProposals(obs));
    expect(baselinePolicy.choose(obs2, () => 0)).toEqual(baselinePolicy.choose(obs, () => 0));
    expect(JSON.stringify(obs)).not.toMatch(/source|historical|queue|bank|gameId|placement/);
    expect(obs.cells.find((cell) => cell.square === dark)).toEqual({ square: dark, visibility: "unknown" });
  });

  it("retains authorized sightings and clears them only with current visible evidence", () => {
    const snap = parseScFen(opening);
    const map = placementToMap(snap.placement);
    map.set("e2", { type: "p", color: "b" });
    const first = observe({ ...snap, placement: mapToPlacement(map) }, { w: 3, b: 3 }, "w");
    expect(first.memory).toEqual([{ square: "e2", piece: { type: "p", color: "b" }, observedTurn: 0 }]);
    map.delete("e1");
    map.delete("e2");
    map.set("a1", { type: "k", color: "w" });
    const dark = observe({ ...snap, turn: 1, placement: mapToPlacement(map) }, { w: 3, b: 3 }, "w", first.memory);
    expect(dark.memory).toEqual(first.memory);
    const cleared = observe({ ...snap, turn: 2 }, { w: 3, b: 3 }, "w", dark.memory);
    expect(cleared.memory).toEqual([]);
  });

  it("reports Battleship pings as revealed pieces without inventing empty lit squares", () => {
    const snap = parseScFen("SCFEN|4k2q/8/8/8/8/8/B7/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:");
    const obs = observe(snap, { w: 3, b: 3 }, "w");
    expect(obs.cells.find((cell) => cell.square === "h8")).toEqual({ square: "h8", visibility: "revealed", piece: { type: "q", color: "b" } });
    expect(obs.cells.find((cell) => cell.square === "h7")?.visibility).toBe("unknown");
  });

  it("pins fixed baseline/configuration and proposes deployments, moves, and explicit pass", () => {
    const obs = observe(parseScFen(opening), { w: 3, b: 3 }, "w");
    const proposals = baselineProposals(obs);
    expect(proposals.some((p) => p.actions[0]?.kind === "classical")).toBe(true);
    expect(proposals.some((p) => p.actions[0]?.kind === "deploy")).toBe(true);
    expect(proposals.at(-1)?.actions).toEqual([]);
    expect(new Set(proposals.map((p) => p.key)).size).toBe(proposals.length);
    expect(proposals.every((p) => Number.isFinite(p.score))).toBe(true);
    expect(Object.isFrozen(obs.own.pieces)).toBe(true);
    expect(CHALLENGE_CONFIG).toMatchObject({ startupMs: 10000, planMs: 10000, matchMs: 300000, maxWindows: 64, maxRecordedPlies: 128, maxProposals: 4096 });
  });
});
