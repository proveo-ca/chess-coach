// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { describe, expect, it } from "vitest";
import { MAX_GAME_TURNS, MAX_MINES_PER_SIDE, MAX_STORED_MATERIAL, parseScFen, type PieceColor } from "@chess-coach/starchess-core";
import { observe } from "../challenge/observation";
import type { AuthorizedObservation } from "../challenge/types";
import { decodeObservation, encodeObservation, validateObservation } from "../challengeContract/observationCodec";
import { ContractError, MAX_CODEC_BYTES } from "../challengeContract/validation";

const fixture = (side: PieceColor = "w") => observe(parseScFen(
  "SCFEN|4k2q/8/8/8/8/8/BRN1P3/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:",
), { w: 3, b: 3 }, side);
const mutable = () => structuredClone(fixture());
const frozenTree = (value: unknown): void => {
  if (value && typeof value === "object") {
    expect(Object.isFrozen(value)).toBe(true);
    Object.values(value).forEach(frozenTree);
  }
};

describe("Phase 2 authorized observation codec", () => {
  it.each(["w", "b"] as const)("round-trips real %s vision canonically into detached frozen values", (side) => {
    const input = structuredClone(fixture(side));
    const encoded = encodeObservation(input);
    const decoded = decodeObservation(encoded);
    expect(decoded).toEqual(input);
    expect(decoded).not.toBe(input);
    expect(decoded.own.pieces[0]).not.toBe(input.own.pieces[0]);
    frozenTree(decoded);
    input.own.minerals = 0;
    expect(decoded.own.minerals).toBe(3);
    expect(encodeObservation(decoded)).toBe(encoded);
    const envelope = JSON.parse(encoded);
    expect(encodeObservation(decodeObservation(JSON.stringify({ observation: envelope.observation, codecVersion: envelope.codecVersion })))).toBe(encoded);
  });

  it.each([
    ["wrong observation version", (o: AuthorizedObservation) => Object.assign(o, { version: "challenge-observation-v2" })],
    ["wrong side", (o: AuthorizedObservation) => Object.assign(o, { side: "red" })],
    ["missing own", (o: AuthorizedObservation) => Reflect.deleteProperty(o, "own")],
    ["wrong root fields", (o: AuthorizedObservation) => Object.assign(o, { placement: "8/8/8/8/8/8/8/8" })],
    ["63 cells", (o: AuthorizedObservation) => o.cells.pop()],
    ["65 cells", (o: AuthorizedObservation) => o.cells.push(o.cells[0]!)],
    ["duplicate cell", (o: AuthorizedObservation) => { o.cells[1] = o.cells[0]!; }],
    ["noncanonical cell order", (o: AuthorizedObservation) => o.cells.reverse()],
    ["invalid square", (o: AuthorizedObservation) => Object.assign(o.cells[0]!, { square: "a9" })],
    ["unknown is not null", (o: AuthorizedObservation) => Object.assign(o.cells.find((c) => c.visibility === "unknown")!, { piece: null })],
    ["lit requires piece or null", (o: AuthorizedObservation) => Reflect.deleteProperty(o.cells.find((c) => c.visibility === "lit")!, "piece")],
    ["piece metadata", (o: AuthorizedObservation) => Object.assign(o.own.pieces[0]!.piece, { hiddenMode: "siege" })],
    ["own agreement", (o: AuthorizedObservation) => o.own.pieces.pop()],
    ["own canonical order", (o: AuthorizedObservation) => o.own.pieces.reverse()],
    ["own duplicate", (o: AuthorizedObservation) => o.own.pieces.splice(1, 0, o.own.pieces[0]!)],
    ["own wrong color", (o: AuthorizedObservation) => { o.own.pieces[0]!.piece.color = "b"; }],
    ["no CC", (o: AuthorizedObservation) => { o.own.pieces.find((p) => p.piece.type === "k")!.piece.type = "p"; Object.assign(o.cells.find((c) => c.square === "e1")!, { piece: { type: "p", color: "w" } }); }],
    ["two CCs", (o: AuthorizedObservation) => { o.own.pieces[0]!.piece.type = "k"; const c = o.cells.find((c) => c.square === o.own.pieces[0]!.square)!; if (c.visibility !== "unknown") c.piece = { type: "k", color: "w" }; }],
    ["mine on unknown", (o: AuthorizedObservation) => { o.own.mines = ["h7"]; }],
    ["mine on revealed", (o: AuthorizedObservation) => { o.own.mines = ["h8"]; }],
    ["mine duplicate", (o: AuthorizedObservation) => { o.own.mines = ["e1", "e1"]; }],
    ["mine order", (o: AuthorizedObservation) => { o.own.mines = ["e1", "a2"]; }],
    ["four mines", (o: AuthorizedObservation) => { o.own.mines = ["a1", "a2", "b1", "b2"]; }],
    ["siege non-tank", (o: AuthorizedObservation) => { o.own.siegedTanks = ["e1"]; }],
    ["siege duplicate", (o: AuthorizedObservation) => { o.own.siegedTanks = ["b2", "b2"]; }],
    ["memory own piece", (o: AuthorizedObservation) => { o.memory = [{ square: "h7", piece: { type: "p", color: "w" }, observedTurn: 0 }]; }],
    ["memory future", (o: AuthorizedObservation) => { o.memory = [{ square: "h7", piece: { type: "p", color: "b" }, observedTurn: 22 }]; }],
    ["memory negative", (o: AuthorizedObservation) => { o.memory = [{ square: "h7", piece: { type: "p", color: "b" }, observedTurn: -1 }]; }],
    ["memory duplicate", (o: AuthorizedObservation) => o.memory.push(o.memory[0]!)],
    ["memory noncanonical", (o: AuthorizedObservation) => o.memory.push({ square: "h7", piece: { type: "r", color: "b" }, observedTurn: 0 })],
    ["memory on visible empty", (o: AuthorizedObservation) => { o.memory.unshift({ square: "a1", piece: { type: "p", color: "b" }, observedTurn: 0 }); }],
    ["visible enemy missing memory", (o: AuthorizedObservation) => { o.memory = []; }],
    ["visible enemy stale memory", (o: AuthorizedObservation) => { o.memory[0]!.observedTurn--; }],
    ["visible enemy memory mismatch", (o: AuthorizedObservation) => { o.memory[0]!.piece.type = "p"; }],
    ["revealed null", (o: AuthorizedObservation) => Object.assign(o.cells.find((c) => c.visibility === "revealed")!, { piece: null })],
    ["revealed non-Battleship", (o: AuthorizedObservation) => Object.assign(o.cells.find((c) => c.visibility === "revealed")!, { piece: { type: "r", color: "b" } })],
    ["revealed own Battleship", (o: AuthorizedObservation) => Object.assign(o.cells.find((c) => c.visibility === "revealed")!, { piece: { type: "q", color: "w" } })],
  ] as const)("rejects %s", (_label, change) => {
    const input = mutable();
    change(input);
    expect(() => validateObservation(input)).toThrow(ContractError);
    expect(() => encodeObservation(input)).toThrow(ContractError);
  });

  it.each(["queue", "bank", "source", "gameId", "historicalResult", "futureTrace", "enemyMines", "baselineScore"])("rejects private %s metadata at every object boundary", (key) => {
    for (const target of ["root", "own", "cell", "memory", "ownPiece"] as const) {
      const input = mutable();
      const record = target === "root" ? input : target === "own" ? input.own : target === "cell" ? input.cells[0]! : target === "memory" ? input.memory[0]! : input.own.pieces[0]!;
      Object.assign(record, { [key]: "private" });
      expect(() => validateObservation(input), target).toThrow(ContractError);
    }
  });

  it.each([
    ["turn", -1], ["turn", MAX_GAME_TURNS + 1], ["turn", 1.5],
    ["minerals", -1], ["minerals", MAX_STORED_MATERIAL + 1], ["minerals", NaN],
    ["gas", -1], ["gas", 4], ["gas", Infinity],
    ["gasIncome", 0], ["gasIncome", 4], ["ccLives", -1], ["ccLives", 4],
  ] as const)("rejects %s=%s", (key, value) => {
    const input = mutable();
    if (key === "turn") input.turn = value;
    else input.own[key] = value;
    expect(() => validateObservation(input)).toThrow(ContractError);
  });

  it("accepts exact resource endpoints, three lit mines, own tank modes, and canonical stale enemy memory", () => {
    expect(MAX_MINES_PER_SIDE).toBe(3);
    const input = mutable();
    input.own.mines = ["a1", "a2", "b2"];
    input.own.siegedTanks = ["b2"];
    input.memory.unshift({ square: "h7", piece: { type: "r", color: "b" }, observedTurn: 0 });
    expect(decodeObservation(encodeObservation(input))).toEqual(input);
    for (const gasIncome of [1, 2, 3]) {
      for (const gas of [0, gasIncome]) {
        const endpoint = structuredClone(input);
        endpoint.own = { ...endpoint.own, gasIncome, gas, minerals: gas === 0 ? 0 : 12, ccLives: gas === 0 ? 0 : 3 };
        expect(validateObservation(endpoint).own).toEqual(endpoint.own);
      }
      input.own.gasIncome = gasIncome;
      input.own.gas = gasIncome + 1;
      expect(() => validateObservation(input)).toThrow(ContractError);
    }
  });

  it("keeps unknown absent, lit empty null, and a Battleship ping distinct", () => {
    const decoded = decodeObservation(encodeObservation(fixture()));
    expect(decoded.cells.find((c) => c.square === "h7")).toEqual({ square: "h7", visibility: "unknown" });
    expect(decoded.cells.find((c) => c.square === "d1")).toEqual({ square: "d1", visibility: "lit", piece: null });
    expect(decoded.cells.find((c) => c.square === "h8")).toEqual({ square: "h8", visibility: "revealed", piece: { type: "q", color: "b" } });
  });

  it.each(["null", "[]", "{}", "{", " ".repeat(MAX_CODEC_BYTES + 1)])("rejects invalid JSON/root/size input #%#", (json) => {
    expect(() => decodeObservation(json)).toThrow(ContractError);
  });

  it("enforces the envelope version and exact allowlist", () => {
    const envelope = JSON.parse(encodeObservation(fixture()));
    for (const invalid of [{ ...envelope, codecVersion: "v2" }, { ...envelope, source: "private" }, { observation: envelope.observation }, { codecVersion: envelope.codecVersion, cells: [] }]) {
      expect(() => decodeObservation(JSON.stringify(invalid))).toThrow(ContractError);
    }
  });

  it("accepts boundary turns and rejects missing or wrongly shaped required fields", () => {
    for (const turn of [0, MAX_GAME_TURNS]) {
      const input = mutable();
      input.turn = turn;
      input.memory.forEach((entry) => { entry.observedTurn = turn; });
      expect(validateObservation(input).turn).toBe(turn);
    }
    for (const field of ["version", "side", "turn", "own", "cells", "memory"]) {
      const input = mutable();
      Reflect.deleteProperty(input, field);
      expect(() => validateObservation(input), field).toThrow(ContractError);
    }
    for (const field of ["minerals", "gas", "gasIncome", "ccLives", "pieces", "mines", "siegedTanks"]) {
      const input = mutable();
      Reflect.deleteProperty(input.own, field);
      expect(() => validateObservation(input), field).toThrow(ContractError);
    }
    for (const invalid of [null, [], { ...mutable(), cells: {} }, { ...mutable(), memory: {} }, { ...mutable(), own: [] }]) expect(() => validateObservation(invalid)).toThrow(ContractError);
  });

  it("requires canonical distinct own tank modes and rejects unknown piece/visibility encodings", () => {
    const snap = parseScFen("SCFEN|4k3/8/8/8/8/8/RR6/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:");
    snap.siegedTanks = ["a2", "b2"];
    const input = structuredClone(observe(snap, { w: 3, b: 3 }, "w"));
    expect(validateObservation(input).own.siegedTanks).toEqual(["a2", "b2"]);
    input.own.siegedTanks.reverse();
    expect(() => validateObservation(input)).toThrow(ContractError);
    for (const bad of [{ type: "tank", color: "w" }, { type: "r", color: "red" }, { color: "w" }, null]) {
      const invalid = mutable();
      Object.assign(invalid.own.pieces[0]!, { piece: bad });
      expect(() => validateObservation(invalid)).toThrow(ContractError);
    }
    const invalid = mutable();
    Object.assign(invalid.cells[0]!, { visibility: "fog" });
    expect(() => validateObservation(invalid)).toThrow(ContractError);
  });
});
