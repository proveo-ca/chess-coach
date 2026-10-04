// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it, vi } from "vitest";
import { parseScFen, type PieceColor } from "@chess-coach/starchess-core";
import { observe } from "../challenge/observation";
import { canonical as legacyCanonical, deepFreeze as legacyFreeze } from "../challenge/config";
import { canonical, deepFreeze } from "../authorized/v1/canonical";
import { SQUARES } from "../authorized/v1/squares";
import { SQUARES as legacySquares } from "../challenge/observation";
import { decodeObservation, encodeObservation, validateObservation } from "../challengeContract/observationCodec";
import { ContractError } from "../challengeContract/validation";
import { decodeObservationV1, encodeObservationV1, validateObservationV1, type AuthorizedObservationV1 } from "../observations";

const fixture = (side: PieceColor = "w") => structuredClone(observe(parseScFen(
  "SCFEN|4k2q/8/8/8/8/8/BRN1P3/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:",
), { w: 3, b: 3 }, side));
const boundaries = (input: AuthorizedObservationV1): object[] => [
  input, input.own, input.cells, input.cells[0]!, input.cells.find((cell) => cell.visibility === "revealed")!,
  input.own.pieces, input.own.pieces[0]!, input.own.pieces[0]!.piece,
  input.own.mines, input.own.siegedTanks, input.memory, input.memory[0]!, input.memory[0]!.piece,
];
const assertFrozenPlainDetached = (output: unknown, input: unknown): void => {
  if (!output || typeof output !== "object") return;
  expect(output).not.toBe(input);
  expect(Object.isFrozen(output)).toBe(true);
  expect(Object.getPrototypeOf(output)).toBe(Array.isArray(output) ? Array.prototype : Object.prototype);
  for (const key of Object.keys(output)) {
    assertFrozenPlainDetached((output as Record<string, unknown>)[key], (input as Record<string, unknown>)[key]);
  }
};

describe("public authorized observation V1 bridge", () => {
  it("preserves legacy utility identity and APIs", () => {
    expect(legacyCanonical({ b: 2, a: 1 })).toBe(canonical({ b: 2, a: 1 }));
    expect(legacyFreeze({ nested: { value: 1 } })).toEqual(deepFreeze({ nested: { value: 1 } }));
    expect(legacySquares).toEqual(SQUARES);
  });

  it.each(["w", "b"] as const)("preserves %s observation bytes with detached frozen plain output", (side) => {
    const input = fixture(side);
    const output = validateObservationV1(input);
    const encoded = encodeObservationV1(input);
    expect(output).toEqual(validateObservation(input));
    expect(encoded).toBe(encodeObservation(input));
    expect(decodeObservationV1(encoded)).toEqual(decodeObservation(encoded));
    expect(encodeObservationV1(decodeObservationV1(encoded))).toBe(encoded);
    assertFrozenPlainDetached(output, input);
    assertFrozenPlainDetached(decodeObservationV1(encoded), input);
    input.own.minerals = 0;
    expect(output.own.minerals).toBe(3);
  });

  it("pins exact legacy envelope bytes independently of canonical serialization", () => {
    const input: AuthorizedObservationV1 = {
      version: "challenge-observation-v1", side: "w", turn: 0,
      own: { minerals: 0, gas: 0, gasIncome: 1, ccLives: 3,
        pieces: [{ square: "e1", piece: { type: "k", color: "w" } }], mines: [], siegedTanks: [] },
      cells: SQUARES.map((square) => square === "e1"
        ? { square, visibility: "lit", piece: { type: "k", color: "w" } }
        : { square, visibility: "unknown" }), memory: [],
    };
    const cells = SQUARES.map((square) => square === "e1"
      ? '{"piece":{"color":"w","type":"k"},"square":"e1","visibility":"lit"}'
      : `{"square":"${square}","visibility":"unknown"}`).join(",");
    const golden = '{"codecVersion":"challenge-observation-codec-v1","observation":{"cells":[' + cells +
      '],"memory":[],"own":{"ccLives":3,"gas":0,"gasIncome":1,"minerals":0,"mines":[],"pieces":[{"piece":{"color":"w","type":"k"},"square":"e1"}],"siegedTanks":[]},"side":"w","turn":0,"version":"challenge-observation-v1"}}';
    expect(encodeObservationV1(input)).toBe(golden);
    expect(encodeObservation(input)).toBe(golden);
    expect(decodeObservationV1(golden)).toEqual(input);
  });

  it.each(["getter", "setter", "symbol", "hidden", "prototype", "private"] as const)("rejects %s at every DTO boundary without invoking getters", (kind) => {
    const count = boundaries(fixture()).length;
    for (let index = 0; index < count; index++) {
      const input = fixture();
      const target = boundaries(input)[index]!;
      const getter = vi.fn(() => "private");
      if (kind === "getter") Object.defineProperty(target, "private", { enumerable: true, get: getter });
      if (kind === "setter") Object.defineProperty(target, "private", { enumerable: true, set: getter });
      if (kind === "symbol") Object.defineProperty(target, Symbol("private"), { get: getter });
      if (kind === "hidden") Object.defineProperty(target, "private", { get: getter });
      if (kind === "prototype") Object.setPrototypeOf(target, { private: "private" });
      if (kind === "private") Object.assign(target, { private: "private" });
      expect(() => validateObservationV1(input), `${kind}:${index}`).toThrow(ContractError);
      expect(() => encodeObservationV1(input), `${kind}:${index}`).toThrow(ContractError);
      expect(getter).not.toHaveBeenCalled();
    }
  });

  it("rejects getters for required fields before accessing any field", () => {
    const input = fixture();
    const getter = vi.fn(() => "w");
    Object.defineProperty(input, "side", { enumerable: true, get: getter });
    expect(() => validateObservationV1(input)).toThrow(ContractError);
    expect(getter).not.toHaveBeenCalled();
    expect(validateObservation(input).side).toBe("w");
    expect(getter).toHaveBeenCalledOnce();
  });

  it("keeps legacy hidden metadata acceptance private", () => {
    const input = fixture();
    Object.defineProperty(input.own.pieces[0]!.piece, "enemyBank", { value: 12 });
    expect(validateObservation(input)).toEqual(fixture());
    expect(() => validateObservationV1(input)).toThrow(ContractError);
  });

  it("accepts null-prototype records and normalizes them into ordinary plain records", () => {
    const input = fixture();
    for (const target of boundaries(input)) if (!Array.isArray(target)) Object.setPrototypeOf(target, null);
    assertFrozenPlainDetached(validateObservationV1(input), input);
  });

  it("validates the descriptor snapshot without reading the caller's object properties", () => {
    const input = fixture();
    const get = vi.fn(() => { throw new Error("unexpected property read"); });
    input.own = new Proxy(input.own, { get });
    expect(validateObservationV1(new Proxy(input, { get }))).toEqual(fixture());
    expect(get).not.toHaveBeenCalled();
  });

  it.each(["cells", "memory", "pieces", "mines", "siegedTanks"] as const)("rejects sparse %s arrays", (field) => {
    const input = fixture();
    const target = field === "cells" || field === "memory" ? input[field] : input.own[field];
    target.length = Math.max(1, target.length);
    delete target[0];
    expect(() => validateObservationV1(input)).toThrow(ContractError);
  });

  it("rejects array index accessors without executing them", () => {
    const input = fixture();
    const getter = vi.fn(() => input.cells[1]);
    Object.defineProperty(input.cells, "0", { enumerable: true, get: getter });
    expect(() => validateObservationV1(input)).toThrow(ContractError);
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects cyclic DTO values before legacy validation", () => {
    const input = fixture();
    Object.assign(input.cells[0]!, { private: input });
    expect(() => validateObservationV1(input)).toThrow(ContractError);
  });

  it("accepts a shared own-piece/cell snapshot without retaining caller references", () => {
    const input = fixture();
    const own = input.own.pieces[0]!;
    const cell = input.cells.find((entry) => entry.square === own.square)!;
    expect(cell.visibility).toBe("lit");
    if (cell.visibility !== "unknown") cell.piece = own.piece;
    const expected = encodeObservation(input);
    const output = validateObservationV1(input);
    expect(encodeObservationV1(input)).toBe(expected);
    expect(output).toEqual(validateObservation(input));
    own.piece.type = "q";
    expect(encodeObservationV1(output)).toBe(expected);
  });

  it("keeps the 64-cell schema cap and bounded raw inspection errors stable", () => {
    for (const length of [65, 8192, 0xffffffff]) {
      const input = fixture();
      input.cells = length === 65 ? [...input.cells, input.cells[0]!] : new Array(length);
      for (const run of [() => validateObservationV1(input), () => encodeObservationV1(input)]) {
        expect(run).toThrow(ContractError);
        expect(run).toThrow(length === 65 ? "ARRAY" : "SIZE");
      }
    }
  });

  it("enforces own/cells and memory consistency through every bridge operation", () => {
    const input = fixture();
    input.own.pieces.pop();
    expect(() => validateObservationV1(input)).toThrow("CONSISTENCY");
    expect(() => encodeObservationV1(input)).toThrow("CONSISTENCY");
    const envelope = JSON.parse(encodeObservation(fixture()));
    envelope.observation = input;
    expect(() => decodeObservationV1(JSON.stringify(envelope))).toThrow("CONSISTENCY");
    const stale = fixture();
    stale.memory[0]!.observedTurn--;
    expect(() => validateObservationV1(stale)).toThrow("CONSISTENCY");
  });

  it.each(["null", "[]", "{}", "{", '"observation"'])("rejects malformed serialized input %s", (json) => {
    expect(() => decodeObservationV1(json)).toThrow(ContractError);
  });

  it("rejects version drift and private serialized fields", () => {
    const envelope = JSON.parse(encodeObservation(fixture()));
    envelope.codecVersion = "v2";
    expect(() => decodeObservationV1(JSON.stringify(envelope))).toThrow("VERSION");
    envelope.codecVersion = "challenge-observation-codec-v1";
    envelope.observation.own.enemyBank = 12;
    expect(() => decodeObservationV1(JSON.stringify(envelope))).toThrow(ContractError);
  });
});
