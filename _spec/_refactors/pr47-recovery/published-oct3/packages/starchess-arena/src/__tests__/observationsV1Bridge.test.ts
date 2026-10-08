// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it, vi } from "vitest";
import { parseScFen } from "@chess-coach/starchess-core";
import * as publicObservations from "../observations";
import { decodeObservationV1, encodeObservationV1, validateObservationV1, type AuthorizedObservationV1 } from "../observations";
import { SQUARES } from "../authorized/v1/squares";
import { observe } from "../challenge/observation";
import { decodeObservation, encodeObservation, validateObservation } from "../challengeContract/observationCodec";
import { ContractError } from "../challengeContract/validation";

const fixture = () => structuredClone(observe(parseScFen(
  "SCFEN|4k2q/8/8/8/8/8/BRN1P3/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:",
), { w: 3, b: 3 }, "w"));
const frozenTree = (value: unknown): void => {
  if (value && typeof value === "object") {
    expect(Object.isFrozen(value)).toBe(true);
    Object.values(value).forEach(frozenTree);
  }
};

describe("public authorized observation V1 bridge", () => {
  it("exports exactly the three V1 runtime entrypoints", () => {
    expect(Object.keys(publicObservations).sort()).toEqual(["decodeObservationV1", "encodeObservationV1", "validateObservationV1"]);
  });

  it.each(["w", "b"] as const)("preserves legacy %s observation bytes and detached frozen DTOs", (side) => {
    const input = structuredClone(observe(parseScFen(
      "SCFEN|4k2q/8/8/8/8/8/BRN1P3/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:",
    ), { w: 3, b: 3 }, side));
    const bytes = encodeObservation(input);
    expect(encodeObservationV1(input)).toBe(bytes);
    const decoded = decodeObservationV1(bytes);
    expect(decoded).toEqual(decodeObservation(bytes));
    expect(decoded).not.toBe(input);
    expect(decoded.own.pieces[0]!.piece).not.toBe(input.own.pieces[0]!.piece);
    frozenTree(decoded);
    input.own.minerals = 0;
    expect(decoded.own.minerals).toBe(3);
  });

  it("accepts consistent absent-own-CC observations only at the public bridge", () => {
    const input: AuthorizedObservationV1 = {
      version: "challenge-observation-v1", side: "w", turn: 0,
      own: { minerals: 0, gas: 0, gasIncome: 1, ccLives: 0, pieces: [], mines: [], siegedTanks: [] },
      cells: SQUARES.map((square) => ({ square, visibility: "unknown" })), memory: [],
    };
    expect(decodeObservationV1(encodeObservationV1(input))).toEqual(input);
    expect(() => validateObservation(input)).toThrow("CONSISTENCY");
  });

  it("retains unknown-cell sighting memory without current-piece identity", () => {
    const input = fixture();
    input.memory.unshift({ square: "h7", piece: { type: "r", color: "b" }, observedTurn: 0 });
    const decoded = decodeObservationV1(encodeObservationV1(input));
    expect(decoded.cells.find((cell) => cell.square === "h7")).toEqual({ square: "h7", visibility: "unknown" });
    expect(decoded.memory).toEqual(input.memory);
    expect(Object.hasOwn(decoded.cells.find((cell) => cell.square === "h7")!, "piece")).toBe(false);
  });

  it.each(["root", "own", "cell", "ownPiece", "piece", "memory", "sightingPiece"] as const)("rejects unsafe structure at %s before executing getters", (boundary) => {
    const target = (input: AuthorizedObservationV1): object => boundary === "root" ? input : boundary === "own" ? input.own :
      boundary === "cell" ? input.cells[0]! : boundary === "ownPiece" ? input.own.pieces[0]! :
      boundary === "piece" ? input.own.pieces[0]!.piece : boundary === "memory" ? input.memory[0]! : input.memory[0]!.piece;
    for (const change of ["getter", "prototype", "symbol", "nonenumerable", "private"] as const) {
      const input = fixture();
      const record = target(input);
      const getter = vi.fn(() => "private");
      if (change === "getter") Object.defineProperty(record, "private", { enumerable: true, get: getter });
      if (change === "prototype") Object.setPrototypeOf(record, { inherited: "private" });
      if (change === "symbol") Object.assign(record, { [Symbol("private")]: "private" });
      if (change === "nonenumerable") Object.defineProperty(record, "private", { value: "private" });
      if (change === "private") Object.assign(record, { private: "private" });
      expect(() => validateObservationV1(input), change).toThrow(ContractError);
      expect(() => encodeObservationV1(input), change).toThrow(ContractError);
      expect(getter).not.toHaveBeenCalled();
    }
  });

  it("rejects required accessors publicly while preserving legacy getter acceptance", () => {
    const input = fixture();
    const getter = vi.fn(() => 21);
    Object.defineProperty(input, "turn", { enumerable: true, get: getter });
    expect(() => validateObservationV1(input)).toThrow(ContractError);
    expect(getter).not.toHaveBeenCalled();
    expect(validateObservation(input).turn).toBe(21);
    expect(getter).toHaveBeenCalled();
  });

  it.each(["cells", "memory", "pieces", "mines", "siegedTanks"] as const)("rejects sparse and decorated %s arrays", (field) => {
    for (const change of ["sparse", "getter", "prototype", "symbol"] as const) {
      const input = fixture();
      const values = field === "cells" || field === "memory" ? input[field] : input.own[field];
      const getter = vi.fn();
      if (change === "sparse") { values.length = Math.max(1, values.length); Reflect.deleteProperty(values, "0"); }
      if (change === "getter") Object.defineProperty(values, "0", { enumerable: true, get: getter });
      if (change === "prototype") Object.setPrototypeOf(values, Object.create(Array.prototype));
      if (change === "symbol") Object.assign(values, { [Symbol("private")]: true });
      expect(() => validateObservationV1(input), change).toThrow(ContractError);
      expect(getter).not.toHaveBeenCalled();
    }
  });

  it.each([
    ["own/cell mismatch", (input: AuthorizedObservationV1) => input.own.pieces.pop()],
    ["unknown own piece", (input: AuthorizedObservationV1) => { input.cells[SQUARES.indexOf(input.own.pieces[0]!.square)] = { square: input.own.pieces[0]!.square, visibility: "unknown" }; }],
    ["non-tank mode", (input: AuthorizedObservationV1) => { input.own.siegedTanks = ["e1"]; }],
    ["duplicate mines", (input: AuthorizedObservationV1) => { input.own.mines = ["a1", "a1"]; }],
    ["mine cap", (input: AuthorizedObservationV1) => { input.own.mines = ["a1", "a2", "b1", "b2"]; }],
    ["unknown mine", (input: AuthorizedObservationV1) => { input.own.mines = ["h7"]; }],
    ["memory identity", (input: AuthorizedObservationV1) => { Object.assign(input.memory[0]!, { identity: "hidden" }); }],
  ] as const)("enforces %s", (_label, change) => {
    const input = fixture();
    change(input);
    expect(() => validateObservationV1(input)).toThrow(ContractError);
  });

  it("accepts lit own tanks, three mines, and null-prototype DTO records", () => {
    const input = fixture();
    input.own.mines = ["a1", "a2", "b2"];
    input.own.siegedTanks = ["b2"];
    Object.setPrototypeOf(input.own, null);
    expect(validateObservationV1(input)).toEqual(input);
  });

  it("rejects cyclic input and incompatible envelope versions", () => {
    const input = fixture();
    Object.assign(input.own, { private: input });
    expect(() => validateObservationV1(input)).toThrow(ContractError);
    const envelope = JSON.parse(encodeObservationV1(fixture()));
    expect(() => decodeObservationV1(JSON.stringify({ ...envelope, codecVersion: "v2" }))).toThrow("VERSION");
    expect(() => decodeObservationV1(JSON.stringify({ ...envelope, source: "private" }))).toThrow(ContractError);
    expect(() => decodeObservationV1("{")).toThrow("JSON");
  });
});
