// SPEC: _spec/representation.puml
import { describe, expect, test } from "bun:test";
import { FEATURES, FEATURE_VERSION, STATE_FEATURES, encodeFeatures, relativeSquare } from "../src";
import { fixture } from "../../contracts/tests/fixture";
import type { ObservationInput } from "../../contracts/tests/fixture";
import type { Square } from "@chess-coach/game-core";
import layout from "../../../schemas/feature-layout.json";

const candidate = (actions: unknown[] = []) => JSON.stringify({ version: "chess-coach.candidate.v1", actions });
const move = (color = "w", from = "d2", to = "d4") => ({ kind: "classical", timing: "C", color, from, to });
const at = (channel: string, square: Square) => layout.boardChannels.indexOf(channel) * 64 + relativeSquare(square, "w");

describe("new recipient-local feature contract", () => {
  test.each([
    move(),
    { kind: "deploy", timing: "B", color: "w", from: "e1", to: "f2", unit: "p" },
    { kind: "stimStep", timing: "F", color: "w", from: "d2", to: "d3" },
    { kind: "spiderMine", timing: "B", color: "w", from: "c3" },
    { kind: "charonMissiles", timing: "F", color: "w", from: "c1", to: "h6" },
    { kind: "siegeMode", timing: "B", color: "w", from: "a1" },
    { kind: "tacticalJump", timing: "F", color: "w", from: "d1", to: "d5" },
  ])("encodes categorical fields for $kind", action => {
    const values = encodeFeatures(JSON.stringify(fixture()), [candidate([action])]).values;
    expect(values[STATE_FEATURES + 1 + layout.actionKinds.indexOf(action.kind)]).toBe(1);
    expect(values[STATE_FEATURES + 8 + layout.timings.indexOf(action.timing)]).toBe(1);
    expect(Array.from(values.slice(STATE_FEATURES + 1, STATE_FEATURES + 8)).reduce((sum, value) => sum + value, 0)).toBe(1);
  });
  test("derives its dimensions from actual state and action layouts", () => {
    expect(layout.boardChannels).toHaveLength(26);
    expect(layout.scalars).toHaveLength(15);
    expect(26 * 64 + 15).toBe(STATE_FEATURES);
    expect(1 + 7 + 3 + 64 + 64 + 5 + 4).toBe(layout.actionSlotDimension);
    expect(STATE_FEATURES + 4 * layout.actionSlotDimension).toBe(FEATURES);
    expect(FEATURES).toBe(2271);
    expect(Object.isFrozen(layout.boardChannels)).toBe(true);
  });

  test("encodes visible, dark-revealed and own economic facts without hidden occupancy", () => {
    const result = encodeFeatures(JSON.stringify(fixture(true)), [candidate(), candidate([move()])]);
    expect(result.featureVersion).toBe(FEATURE_VERSION);
    expect(result.rows).toBe(2);
    expect(result.values).toHaveLength(2 * FEATURES);
    expect(result.values[at("own.p", "d2")]).toBe(1);
    expect(result.values[at("enemy.q", "h8")]).toBe(1);
    expect(result.values[at("visibility.revealed", "h8")]).toBe(1);
    expect(result.values[at("visibility.lit", "h8")]).toBe(0);
    expect(result.values[at("visibility.everLit", "h8")]).toBe(0);
    expect(result.values[at("enemy.k", "e8")]).toBe(0);
    expect(result.values[at("mine.own", "a4")]).toBe(1);
    expect(result.values[at("economic.ownPaidBasis", "f2")]).toBe(1 / 9);
    expect(result.values[at("economic.ownReplacement", "f2")]).toBe(1 / 9);
    expect(Array.from(result.values).every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
    expect(result.values.slice(0, STATE_FEATURES)).toEqual(result.values.slice(FEATURES, FEATURES + STATE_FEATURES));
    expect(Array.from(result.values.slice(STATE_FEATURES, FEATURES)).every(value => value === 0)).toBe(true);
  });

  test("distinguishes remembered enemies from current observation and records age", () => {
    const input = fixture();
    input.turn = 10;
    input.cells[63] = { square: "h8", visibility: "unknown" };
    input.memory[0]!.observedTurn = 0;
    const result = encodeFeatures(JSON.stringify(input), [candidate()]);
    expect(result.values[at("enemy.q", "h8")]).toBe(0);
    expect(result.values[at("memory.q", "h8")]).toBe(1);
    expect(result.values[at("memory.age", "h8")]).toBe(10 / 45);
  });

  test("encodes ordered action presence, kind, timing, coordinates and spawn choices", () => {
    const actions = [
      { kind: "deploy", timing: "B", color: "w", from: "e1", to: "f2", unit: "n" },
      { ...move(), promotion: "q" },
      { kind: "spiderMine", timing: "F", color: "w", from: "c3" },
    ];
    const values = encodeFeatures(JSON.stringify(fixture()), [candidate(actions)]).values;
    expect(values[STATE_FEATURES]).toBe(1);
    expect(values[STATE_FEATURES + 1 + 1]).toBe(1);
    expect(values[STATE_FEATURES + 8]).toBe(1);
    expect(values[STATE_FEATURES + 11 + relativeSquare("e1", "w")]).toBe(1);
    expect(values[STATE_FEATURES + 75 + relativeSquare("f2", "w")]).toBe(1);
    expect(values[STATE_FEATURES + 139 + 1]).toBe(1);
    expect(values[STATE_FEATURES + layout.actionSlotDimension + 144 + 3]).toBe(1);
    expect(Array.from(values.slice(STATE_FEATURES + 3 * layout.actionSlotDimension)).every(value => value === 0)).toBe(true);
  });

  test("normalizes color-relative views and candidates identically", () => {
    const white = fixture();
    const black: ObservationInput = structuredClone(white);
    const flip = (square: Square): Square => `${square[0]}${9 - Number(square[1])}` as Square;
    const piece = (value: { type: "p" | "n" | "b" | "r" | "q" | "k"; color: "w" | "b" }) => ({ type: value.type, color: value.color === "w" ? "b" as const : "w" as const });
    black.side = "b";
    black.economy.side = "b";
    black.cells = black.cells.map(cell => cell.visibility === "unknown" ? { ...cell, square: flip(cell.square) } : { ...cell, square: flip(cell.square), piece: cell.piece ? piece(cell.piece) : null } as typeof cell).sort((a, b) => a.square.localeCompare(b.square));
    black.own.pieces = black.own.pieces.map(entry => ({ square: flip(entry.square), piece: piece(entry.piece) })).sort((a, b) => a.square.localeCompare(b.square));
    black.own.mines = black.own.mines.map(flip).sort();
    black.ownUnitLineage = black.ownUnitLineage.map(entry => ({ ...entry, square: flip(entry.square), id: `b:unit:opening:${flip(entry.square)}` })).sort((a, b) => a.square.localeCompare(b.square));
    black.ownMineLineage = black.ownMineLineage.map(entry => ({ square: flip(entry.square), mineId: `b:mine:opening:${flip(entry.square)}` }));
    black.memory = black.memory.map(entry => ({ ...entry, square: flip(entry.square), piece: piece(entry.piece) })).sort((a, b) => a.square.localeCompare(b.square));
    black.everLit = black.everLit.map(flip).sort();
    expect(encodeFeatures(JSON.stringify(white), [candidate([move()])]).values).toEqual(
      encodeFeatures(JSON.stringify(black), [candidate([move("b", "d7", "d5")])]).values,
    );
  });

  test("bounds rows, rejects malformed candidates and returns caller-owned buffers", () => {
    const json = JSON.stringify(fixture());
    expect(() => encodeFeatures(json, [])).toThrow();
    expect(() => encodeFeatures(json, Array(513).fill(candidate()))).toThrow();
    expect(() => encodeFeatures(json, [candidate([move("b")])])).toThrow();
    expect(() => encodeFeatures(json, [candidate([move(), move()])])).toThrow();
    expect(() => encodeFeatures(json, [candidate(Array(5).fill(move()))])).toThrow();
    expect(() => encodeFeatures(json, [candidate([{ ...move(), hiddenState: {} }])])).toThrow();
    expect(() => encodeFeatures(json, [candidate([{ ...move(), promotion: "p" }])])).toThrow();
    expect(() => encodeFeatures(json, [candidate([{ kind: "siegeMode", timing: "B", color: "w", from: "a1", to: "a2" }])])).toThrow();
    const first = encodeFeatures(json, [candidate()]);
    const second = encodeFeatures(json, [candidate()]);
    first.values[0] = 99;
    expect(second.values[0]).not.toBe(99);
    expect(encodeFeatures(json, Array(512).fill(candidate())).values).toHaveLength(512 * FEATURES);
  });
});
