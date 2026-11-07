// SPEC: _spec/candidate-generation.puml
import { describe, expect, test } from "bun:test";
import { decodeCandidate, decodeObservation } from "@chess-coach/contracts";
import { MAX_MINES_PER_SIDE, UNIT_COST, appendTimeSpecialAnchor, knownAppendFailure, nativeClassicalChecks, specialGasCost } from "@chess-coach/game-core";
import type { ScAction, Square } from "@chess-coach/game-core";
import { ENUMERATION_VERSION, MAX_CANDIDATES, MAX_CANDIDATE_ACTIONS, MAX_CANDIDATE_EXTENSIONS, enumerateCandidates, relativeSquare } from "../src";
import { candidateFixture, mirroredCandidateFixture } from "./candidate-fixture";

describe("new bounded candidate selection", () => {
  test("is deterministic, bounded, deduplicated, detached and readonly", () => {
    const input = candidateFixture();
    const json = JSON.stringify(input);
    const result = enumerateCandidates(json);
    expect(result).toEqual(enumerateCandidates(JSON.stringify(Object.fromEntries(Object.entries(input).reverse()))));
    expect(result.version).toBe(ENUMERATION_VERSION);
    expect(result.candidates[0]?.actions).toEqual([]);
    expect(result.candidates.length).toBeGreaterThan(1);
    expect(result.candidates.length).toBeLessThanOrEqual(MAX_CANDIDATES);
    expect(result.attemptedExtensions).toBeLessThanOrEqual(MAX_CANDIDATE_EXTENSIONS);
    expect(result.attemptedExtensions).toBe(result.rejectedExtensions + result.duplicateExtensions + result.candidates.length - 1);
    expect(new Set(result.candidates.map(candidate => JSON.stringify(candidate.actions))).size).toBe(result.candidates.length);
    expect(Math.max(...result.candidates.map(candidate => candidate.actions.length))).toBeLessThanOrEqual(MAX_CANDIDATE_ACTIONS);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.candidates)).toBe(true);
    expect(Object.isFrozen(result.candidates[1]!.actions[0])).toBe(true);
    input.own.minerals = 0;
    expect(JSON.stringify(result)).not.toBe(JSON.stringify(enumerateCandidates(JSON.stringify(input))));
  });

  test("covers all seven families and lengths one through four in the rich fixture", () => {
    const result = enumerateCandidates(JSON.stringify(candidateFixture()));
    expect(new Set(result.candidates.flatMap(candidate => candidate.actions.map(action => action.kind)))).toEqual(new Set([
      "classical", "deploy", "stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump",
    ]));
    expect(new Set(result.candidates.map(candidate => candidate.actions.length))).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(result.stopReason).toBe("capacity");
    expect(result.candidates).toHaveLength(MAX_CANDIDATES);
  });

  test("every retained prefix respects recipient admission, resources, mines and own dependencies", () => {
    const input = candidateFixture();
    const observation = decodeObservation(JSON.stringify(input));
    const knowledge = {
      side: observation.side,
      knownPieces: new Map(observation.cells.flatMap(cell => cell.visibility !== "unknown" && cell.piece ? [[cell.square, cell.piece] as const] : [])),
      unknownSquares: new Set(observation.cells.filter(cell => cell.visibility === "unknown").map(cell => cell.square)),
      ownMines: new Set(observation.own.mines), ownSiegedTanks: new Set(observation.own.siegedTanks),
    };
    const context = { ownUnits: new Map(observation.own.pieces.map(entry => [entry.square, entry.piece])), ownSieged: knowledge.ownSiegedTanks };
    for (const candidate of enumerateCandidates(JSON.stringify(input)).candidates) {
      expect(decodeCandidate(JSON.stringify(candidate), observation.side)).toEqual(candidate);
      let gas = 0, minerals = 0;
      candidate.actions.forEach((action, index) => {
        expect(knownAppendFailure(knowledge, candidate.actions.slice(0, index), action)).toBeNull();
        if (action.kind !== "classical") gas += specialGasCost(action.kind);
        if (action.kind === "deploy") minerals += UNIT_COST[action.unit];
      });
      expect(gas).toBeLessThanOrEqual(observation.own.gas);
      expect(minerals).toBeLessThanOrEqual(observation.own.minerals);
      const mines = candidate.actions.filter(action => action.kind === "spiderMine").map(action => appendTimeSpecialAnchor(candidate.actions, observation.side, action.from, action.timing));
      expect(mines.length + observation.own.mines.length).toBeLessThanOrEqual(MAX_MINES_PER_SIDE);
      expect(new Set(mines).size).toBe(mines.length);
      const sequenced: ScAction[] = candidate.actions.map((action, seq) => ({ ...action, seq }));
      for (const action of sequenced) {
        if (action.timing !== "C") continue;
        const checks = nativeClassicalChecks(context, sequenced, action);
        expect(checks.insertion.diagnostic).toBeUndefined();
        expect(checks.resulting.diagnostic).toBeUndefined();
      }
    }
  });

  test("does not spend unavailable gas or deployment minerals", () => {
    const input = candidateFixture();
    input.own.gas = 0;
    input.own.minerals = 0;
    const result = enumerateCandidates(JSON.stringify(input));
    expect(result.candidates.every(candidate => candidate.actions.every(action => action.kind === "classical"))).toBe(true);
    expect(result.candidates[0]?.actions).toEqual([]);
    expect(result.attemptedExtensions).toBeLessThanOrEqual(MAX_CANDIDATE_EXTENSIONS);
    expect(result.stopReason).toBe("attempts");
    expect(result.attemptedExtensions).toBe(MAX_CANDIDATE_EXTENSIONS);
  });

  test("returns only pass on a genuinely exhausted recipient domain", () => {
    const input = candidateFixture("5PPK/6PP/8/8/8/8/8/k7");
    input.own.gas = 0;
    input.own.minerals = 0;
    const result = enumerateCandidates(JSON.stringify(input));
    expect(result.candidates).toHaveLength(1);
    expect(result.stopReason).toBe("exhausted");
  });

  test("ignores stale sightings as occupancy and never accepts extra simulator fields", () => {
    const input = candidateFixture();
    const baseline = enumerateCandidates(JSON.stringify(input));
    expect(input.cells.find(cell => cell.square === "a8")?.visibility).toBe("unknown");
    input.memory.unshift({ square: "a8", piece: { type: "p", color: "b" }, observedTurn: 0 });
    expect(enumerateCandidates(JSON.stringify(input))).toEqual(baseline);
    expect(() => enumerateCandidates(JSON.stringify({ ...input, simulator: {} }))).toThrow();
  });

  test("enumerates mirrored recipients in identical relative discovery order", () => {
    const white = enumerateCandidates(JSON.stringify(candidateFixture()));
    const black = enumerateCandidates(JSON.stringify(mirroredCandidateFixture(candidateFixture())));
    const normalize = (batch: typeof white, side: "w" | "b") => batch.candidates.map(candidate => candidate.actions.map(action => ({
      kind: action.kind, timing: action.timing, from: relativeSquare(action.from, side),
      to: "to" in action ? relativeSquare(action.to, side) : null,
      unit: action.kind === "deploy" ? action.unit : null,
      promotion: "promotion" in action ? action.promotion ?? null : null,
    })));
    expect(normalize(white, "w")).toEqual(normalize(black, "b"));
    expect(white.attemptedExtensions).toBe(black.attemptedExtensions);
  });

  test("caps mine compositions against existing own lineage-backed mines", () => {
    const input = candidateFixture();
    input.own.mines = ["a2", "b2", "c2"];
    input.ownMineLineage = input.own.mines.map(square => ({ mineId: `w:mine:opening:${square}`, square }));
    expect(input.own.mines.every(at => input.cells.find(cell => cell.square === at)?.visibility === "lit")).toBe(true);
    const result = enumerateCandidates(JSON.stringify(input));
    expect(result.candidates.every(candidate => candidate.actions.every(action => action.kind !== "spiderMine"))).toBe(true);
  });

  test("retains genuine unknown-target intents rather than asking the host validator", () => {
    const input = candidateFixture("4k3/8/8/8/8/8/8/3QK3");
    const result = enumerateCandidates(JSON.stringify(input));
    const unknown = new Set<Square>(input.cells.filter(cell => cell.visibility === "unknown").map(cell => cell.square));
    expect(result.candidates.some(candidate => candidate.actions.some(action => action.kind === "tacticalJump" && unknown.has(action.to)))).toBe(true);
  });

  test.each([[45, 3], [21, 0], [45, 0]])("returns terminal pass without searching at turn %i with own HP %i", (turn, hp) => {
    const input = candidateFixture();
    input.turn = turn;
    input.memory = input.memory.map(entry => ({ ...entry, observedTurn: turn }));
    input.own.ccLives = hp;
    const result = enumerateCandidates(JSON.stringify(input));
    expect(result.candidates).toHaveLength(1);
    expect(result.attemptedExtensions).toBe(0);
    expect(result.stopReason).toBe("terminal");
  });
});
