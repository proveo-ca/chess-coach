// SPEC: _spec/observations.puml
import { describe, expect, test } from "bun:test";
import { MAX_OBSERVATION_BYTES, decodeObservation, encodeObservation, observationJsonSchema } from "../src";
import { fixture } from "./fixture";
import type { ObservationInput } from "./fixture";

describe("standard recipient observation contract", () => {
  test.each([false, true])("round-trips JSON with paid deployment = %s", paid => {
    const input = fixture(paid);
    const decoded = decodeObservation(JSON.stringify(input));
    expect(decoded).toEqual(input);
    expect(decodeObservation(encodeObservation(decoded))).toEqual(decoded);
    expect(decoded).not.toBe(input);
    expect(decoded.own.pieces).not.toBe(input.own.pieces);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.cells)).toBe(true);
    expect(Object.isFrozen(decoded.own)).toBe(true);
    expect(Object.isFrozen(decoded.own.pieces[0]!.piece)).toBe(true);
    input.own.minerals = 0;
    expect(decoded.own.minerals).not.toBe(0);
  });

  test("accepts standard whitespace and key ordering rather than canonical bytes", () => {
    const input = fixture();
    const reversed = Object.fromEntries(Object.entries(input).reverse());
    expect(decodeObservation(JSON.stringify(reversed, null, 2))).toEqual(input);
  });

  test("exports standard shape schema separately from semantic invariants", () => {
    expect(observationJsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(observationJsonSchema.additionalProperties).toBe(false);
    expect(observationJsonSchema.properties?.version).toEqual({ type: "string", const: "chess-coach.observation.v1" });
  });

  test.each([
    "{", "null", "[]", "{}", "{\"version\":\"challenge-observation-v2\"}",
  ])("rejects invalid JSON or shape %s", json => {
    expect(() => decodeObservation(json)).toThrow();
  });

  test("rejects extra hidden state instead of stripping it", () => {
    expect(() => decodeObservation(JSON.stringify({ ...fixture(), opponentQueue: [] }))).toThrow();
    const input = fixture();
    expect(() => decodeObservation(JSON.stringify({ ...input, own: { ...input.own, opponentMinerals: 7 } }))).toThrow();
    const cells = [...input.cells];
    cells[63] = { square: "h8", visibility: "unknown", piece: { color: "b", type: "q" } } as never;
    expect(() => decodeObservation(JSON.stringify({ ...input, cells }))).toThrow();
  });

  test("rejects size limits before parsing", () => {
    expect(() => decodeObservation(" ".repeat(MAX_OBSERVATION_BYTES + 1))).toThrow(RangeError);
    expect(() => decodeObservation("é".repeat(MAX_OBSERVATION_BYTES / 2 + 1))).toThrow(RangeError);
  });

  const invalid: [string, (snapshot: ObservationInput) => void][] = [
    ["missing light history", snapshot => { snapshot.everLit = []; }],
    ["reordered light history", snapshot => { snapshot.everLit.reverse(); }],
    ["wrong side", snapshot => { snapshot.side = "b"; }],
    ["gas beyond income", snapshot => { snapshot.own.gas = 2; }],
    ["missing cell", snapshot => { snapshot.cells.pop(); }],
    ["reordered cells", snapshot => { snapshot.cells.reverse(); }],
    ["own color mismatch", snapshot => { snapshot.own.pieces[0]!.piece.color = "b"; }],
    ["missing own piece", snapshot => { snapshot.own.pieces.pop(); }],
    ["missing CC", snapshot => { snapshot.own.pieces = snapshot.own.pieces.filter(entry => entry.piece.type !== "k"); }],
    ["hidden own piece", snapshot => { snapshot.cells[32] = { square: "e1", visibility: "unknown" }; }],
    ["non-BattleShip reveal", snapshot => { snapshot.cells[63] = { square: "h8", visibility: "revealed", piece: { type: "p", color: "b" } }; }],
    ["missing current enemy memory", snapshot => { snapshot.memory = []; }],
    ["future sighting", snapshot => { snapshot.memory[0]!.observedTurn = 2; }],
    ["own sighting", snapshot => { snapshot.memory[0]!.piece.color = "w"; }],
    ["stale visible sighting", snapshot => { snapshot.memory[0]!.observedTurn = 0; }],
    ["memory on visible empty cell", snapshot => { snapshot.memory.unshift({ square: "a4", piece: { type: "p", color: "b" }, observedTurn: 0 }); }],
    ["wrong ledger side", snapshot => { snapshot.economy.side = "b"; }],
    ["opening paid basis", snapshot => { snapshot.ownUnitLineage[0]!.paidBasis = 1; }],
    ["wrong replacement cost", snapshot => { snapshot.ownUnitLineage[0]!.replacementValue = 9; }],
    ["wrong lineage side", snapshot => { snapshot.ownUnitLineage[0]!.id = "b:unit:opening:c1"; }],
    ["duplicate live identity", snapshot => { snapshot.ownUnitLineage[1]!.id = snapshot.ownUnitLineage[0]!.id; }],
    ["missing lineage", snapshot => { snapshot.ownUnitLineage.pop(); }],
    ["live retired identity", snapshot => { snapshot.economy.retiredOwnIds = [snapshot.ownUnitLineage[0]!.id]; }],
    ["unwitnessed paid enemy claim", snapshot => { snapshot.economy.enemyLoss.paidLowerBound = 1 as never; }],
    ["invalid enemy replacement bound", snapshot => { snapshot.economy.enemyLoss.confirmedUnitCount = 1; }],
    ["unlit own mine", snapshot => { snapshot.own.mines = ["a8"]; }],
    ["wrong mine opening identity", snapshot => { snapshot.ownMineLineage[0]!.mineId = "w:mine:opening:b4"; }],
    ["mine counter overflow", snapshot => { snapshot.ownMineLineage[0]!.mineId = "w:mine:created:193"; }],
    ["missing mine lineage", snapshot => { snapshot.ownMineLineage = []; }],
    ["sieged non-Tank", snapshot => { snapshot.own.siegedTanks = ["c1"]; }],
    ["wrong paid total", snapshot => { snapshot.economy.ownPaidDebits = 2; }],
    ["wrong paid surviving", snapshot => { snapshot.economy.ownPaidSurviving = 2; }],
    ["receipt cost mismatch", snapshot => { snapshot.economy.receipts[0]!.minerals = 3; }],
    ["receipt reference mismatch", snapshot => { snapshot.economy.receipts[0]!.actionRef.acceptedActionOrdinal = 1; }],
    ["creation identity gap", snapshot => { snapshot.economy.receipts[0]!.disposition = { kind: "materialized", lineageId: "w:unit:created:2" }; }],
    ["duplicate deployment turn", snapshot => { snapshot.economy.receipts.push({ ...snapshot.economy.receipts[0]!, receiptId: "w:receipt:1:1", actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 1 } }); }],
    ["orphaned created lineage", snapshot => { snapshot.economy.receipts = []; }],
    ["unaccounted waste", snapshot => { snapshot.economy.receipts[0]!.disposition = { kind: "unmaterialized" }; }],
    ["retired unknown created identity", snapshot => { snapshot.economy.retiredOwnIds = ["w:unit:created:2"]; }],
  ];
  test.each(invalid)("rejects %s", (_name, mutate) => {
    const input = fixture(true);
    mutate(input);
    expect(() => decodeObservation(JSON.stringify(input))).toThrow();
  });

  test("preserves paid basis through transformation without repricing receipts", () => {
    const input = fixture(true);
    const piece = input.own.pieces.find(entry => entry.square === "f2")!;
    piece.piece.type = "q";
    const cell = input.cells.find(entry => entry.square === "f2")!;
    if (cell.visibility !== "lit" || !cell.piece) throw Error("bad fixture");
    cell.piece.type = "q";
    const lineage = input.ownUnitLineage.find(entry => entry.square === "f2")!;
    lineage.type = "q";
    lineage.replacementValue = 9;
    expect(decodeObservation(JSON.stringify(input)).economy.ownPaidSurviving).toBe(1);
  });

  test.each(["destroyed", "wasted"] as const)("conserves %s paid deployments", disposition => {
    const input = fixture(true);
    input.own.pieces = input.own.pieces.filter(entry => entry.square !== "f2");
    input.ownUnitLineage = input.ownUnitLineage.filter(entry => entry.square !== "f2");
    input.cells[41] = { square: "f2", visibility: "lit", piece: null };
    input.economy.ownPaidSurviving = 0;
    if (disposition === "destroyed") {
      input.economy.ownPaidDestroyed = 1;
      input.economy.ownReplacementDestroyed = 1;
      input.economy.retiredOwnIds = ["w:unit:created:1"];
    } else {
      input.economy.ownPaidWasted = 1;
      input.economy.receipts[0]!.disposition = { kind: "unmaterialized" };
    }
    expect(decodeObservation(JSON.stringify(input))).toEqual(input);
  });
});
