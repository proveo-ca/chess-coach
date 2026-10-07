import { describe, expect, it } from "vitest";
import { parseScFen } from "@chess-coach/starchess-core";
import { observe } from "../challenge/observation";
import { decodeObservation, encodeObservation, validateObservation, decodeObservationV1, encodeObservationV1, validateObservationV1 } from "../observations";
import { validateBoundaryBatch } from "../events";
import { encodeObservation as legacyEncode, decodeObservation as legacyDecode, validateObservation as legacyValidate } from "../authorized/v1/observationCodec";
import { ContractError } from "../challengeContract/validation";
import type { AuthorizedSnapshotV2, ObservedCell, Square } from "../observations";

const fixture = (): AuthorizedSnapshotV2 => {
  const cells: ObservedCell[] = Array.from({ length: 64 }, (_, i) => ({ square: `${"abcdefgh"[Math.floor(i / 8)]}${i % 8 + 1}` as Square, visibility: "unknown" }));
  const pieces = [
    { square: "a2" as const, piece: { type: "p" as const, color: "w" as const } },
    { square: "b2" as const, piece: { type: "r" as const, color: "w" as const } },
    { square: "e1" as const, piece: { type: "k" as const, color: "w" as const } },
  ];
  pieces.forEach(x => { cells[cells.findIndex(c => c.square === x.square)] = { ...x, visibility: "lit" }; });
  cells[0] = { square: "a1", visibility: "lit", piece: null };
  cells[63] = { square: "h8", visibility: "revealed", piece: { type: "q", color: "b" } };
  return {
    version: "challenge-observation-v2", side: "w", turn: 21,
    own: { minerals: 12, gas: 3, gasIncome: 3, ccLives: 3, pieces, mines: ["a1"], siegedTanks: ["b2"] }, cells,
    memory: [{ square: "h7", piece: { type: "p", color: "b" }, observedTurn: 0 }, { square: "h8", piece: { type: "q", color: "b" }, observedTurn: 21 }],
    ownUnitLineage: pieces.map(x => ({ id: `w:unit:opening:${x.square}`, square: x.square, type: x.piece.type, paidBasis: 0, replacementValue: x.piece.type === "k" ? 0 : x.piece.type === "r" ? 5 : 1 })),
    ownMineLineage: [{ mineId: "w:mine:created:1", square: "a1" }, { mineId: "w:mine:created:2", square: "a1" }, { mineId: "w:mine:opening:a1", square: "a1" }],
    economicState: { version: "challenge-economic-ledger-v1", side: "w", ownPaidDebits: 0, ownPaidSurviving: 0, ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0,
      enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" }, receipts: [], retiredOwnIds: [] },
  };
};
type Mutable<T> = T extends readonly (infer E)[] ? Mutable<E>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const mutable = (): Mutable<AuthorizedSnapshotV2> => structuredClone(fixture()) as Mutable<AuthorizedSnapshotV2>;
const frozenTree = (value: unknown): void => {
  if (value && typeof value === "object") { expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(frozenTree); }
};
describe("authorized V2 observation contracts", () => {
  it("round-trips canonical byte envelopes with detached immutable trees and fresh caller bytes", () => {
    const input = mutable(), encoded = encodeObservation(input), decoded = decodeObservation(encoded);
    expect(decoded).toEqual(input); expect(decoded).not.toBe(input); frozenTree(decoded);
    expect(encodeObservation(decoded)).toEqual(encoded); expect(encodeObservation(decoded)).not.toBe(encoded);
    input.own.minerals = 0; input.ownMineLineage.pop();
    expect(decoded.own.minerals).toBe(12); expect(decoded.ownMineLineage).toHaveLength(3);
    encoded.fill(0); expect(encodeObservation(decoded)[0]).toBe(123);
    expect(decoded.ownUnitLineage.find(x => x.type === "k")?.replacementValue).toBe(0);
  });
  it("preserves occurrence quantity separately from sorted unique mine locations", () => {
    const snapshot = validateObservation(fixture());
    expect(snapshot.ownMineLineage.map(x => x.square)).toEqual(["a1", "a1", "a1"]);
    expect(snapshot.own.mines).toEqual(["a1"]);
  });
  it.each([
    ["extra root", (x: Mutable<AuthorizedSnapshotV2>) => Object.assign(x, { source: "private" })],
    ["extra lineage", (x: Mutable<AuthorizedSnapshotV2>) => Object.assign(x.ownUnitLineage[0]!, { mode: "tank" })],
    ["extra piece", (x: Mutable<AuthorizedSnapshotV2>) => Object.assign(x.own.pieces[0]!.piece, { entityId: "secret" })],
    ["CC replacement", (x: Mutable<AuthorizedSnapshotV2>) => { x.ownUnitLineage[2]!.replacementValue = 1; }],
    ["paid endowed", (x: Mutable<AuthorizedSnapshotV2>) => { x.ownUnitLineage[0]!.paidBasis = 1; }],
    ["missing live lineage", (x: Mutable<AuthorizedSnapshotV2>) => x.ownUnitLineage.pop()],
    ["duplicate identity", (x: Mutable<AuthorizedSnapshotV2>) => { x.ownUnitLineage[1]!.id = x.ownUnitLineage[0]!.id; }],
    ["foreign identity", (x: Mutable<AuthorizedSnapshotV2>) => { x.ownUnitLineage[0]!.id = "b:unit:opening:a2"; }],
    ["mine ID order", (x: Mutable<AuthorizedSnapshotV2>) => x.ownMineLineage.reverse()],
    ["duplicate mine ID", (x: Mutable<AuthorizedSnapshotV2>) => { x.ownMineLineage[1]!.mineId = x.ownMineLineage[0]!.mineId; }],
    ["four occurrences", (x: Mutable<AuthorizedSnapshotV2>) => x.ownMineLineage.push({ mineId: "w:mine:created:3", square: "a1" })],
    ["location duplication", (x: Mutable<AuthorizedSnapshotV2>) => x.own.mines.push("a1")],
    ["location mismatch", (x: Mutable<AuthorizedSnapshotV2>) => { x.own.mines = []; }],
    ["unknown has piece", (x: Mutable<AuthorizedSnapshotV2>) => Object.assign(x.cells[2]!, { piece: null })],
    ["revealed wrong type", (x: Mutable<AuthorizedSnapshotV2>) => Object.assign(x.cells[63]!, { piece: { type: "r", color: "b" } })],
    ["stale visible memory", (x: Mutable<AuthorizedSnapshotV2>) => { x.memory[1]!.observedTurn = 20; }],
    ["invalid ordinal", (x: Mutable<AuthorizedSnapshotV2>) => { x.turn = 46; }],
    ["nonfinite", (x: Mutable<AuthorizedSnapshotV2>) => { x.own.minerals = Infinity; }],
    ["negative zero", (x: Mutable<AuthorizedSnapshotV2>) => { x.ownUnitLineage[0]!.paidBasis = -0; }],
    ["extra enemy loss", (x: Mutable<AuthorizedSnapshotV2>) => Object.assign(x.economicState.enemyLoss, { enemyId: "secret" })],
    ["unresolved receipt", (x: Mutable<AuthorizedSnapshotV2>) => x.economicState.receipts.push({ receiptId: "w:receipt:0:0", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, unit: "p", requestedSquare: "a1", minerals: 1, disposition: { kind: "unresolved" } } as never)],
  ] as const)("rejects %s", (_name, mutate) => {
    const value = mutable(); mutate(value);
    expect(() => validateObservation(value)).toThrow(ContractError);
    expect(() => encodeObservation(value)).toThrow(ContractError);
  });
  it("rejects descriptor hazards without executing accessors", () => {
    let calls = 0;
    for (const target of ["root", "piece", "array", "tag"] as const) {
      const x = mutable();
      const value = target === "root" ? x : target === "piece" ? x.own.pieces[0]!.piece : target === "array" ? x.ownMineLineage : x.cells[0]!;
      const key = target === "root" ? "own" : target === "piece" ? "type" : target === "array" ? "0" : "visibility";
      Object.defineProperty(value, key, { enumerable: true, get: () => { calls++; throw new Error("getter ran"); } });
      expect(() => validateObservation(x)).toThrow(ContractError);
    }
    expect(calls).toBe(0);
    const hazards = [
      Object.assign(Object.create(fixture()), {}),
      Object.assign(new Date(), fixture()),
      (() => { const x = mutable(); Object.setPrototypeOf(x.own, { secret: true }); return x; })(),
      (() => { const x = mutable(); delete x.cells[2]; return x; })(),
      (() => { const x = mutable(); Object.assign(x.cells, { hidden: 1 }); return x; })(),
      (() => { const x = mutable(); Object.defineProperty(x.memory, "extra", { value: 1 }); return x; })(),
      (() => { const x = mutable(); Object.assign(x.own.pieces[0]!, { piece: x }); return x; })(),
      (() => { const x = mutable(); Object.assign(x, { [Symbol("secret")]: 1 }); return x; })(),
    ];
    hazards.forEach(x => expect(() => validateObservation(x)).toThrow(ContractError));
  });
  it("rejects noncanonical physical bytes, invalid UTF-8, duplicate keys and preparse overflow", () => {
    const text = new TextDecoder().decode(encodeObservation(fixture())), envelope = JSON.parse(text);
    const invalid = [" " + text, text + "\n", JSON.stringify({ observation: envelope.observation, codecVersion: envelope.codecVersion }),
      text.replace('"turn":21', '"turn":2.1e1'), text.replace('"turn":21', '"turn":0,"turn":21'), text.replace('"a1"', '"\\u00611"')];
    invalid.forEach(x => expect(() => decodeObservation(new TextEncoder().encode(x))).toThrow(ContractError));
    expect(() => decodeObservation(new Uint8Array([0xff]))).toThrow("JSON: $");
    expect(() => decodeObservation(new Uint8Array(1_048_577))).toThrow("SIZE: $");
    expect(() => decodeObservation(new TextEncoder().encode("\ufeff" + text))).toThrow(ContractError);
  });
  it("accepts allowed bounded V2 batches beyond the legacy 8192-node budget", () => {
    const snapshot = fixture();
    const changes = snapshot.cells.map(x => ({ square: x.square, visibility: "unknown" as const }));
    const events = Array.from({ length: 180 }, (_, i) => ({ kind: "vision-witness", seq: i + 1, turn: 21, changes }));
    const batch = { version: "challenge-boundary-batch-v1", side: "w", ordinal: 2, phase: "settled", turn: 21, planningOrdinal: 1, seqBefore: 0, seqThrough: 181,
      events: [...events, { kind: "own-income", seq: 181, actualCreditedMinerals: 0 }], snapshot };
    const result = validateBoundaryBatch(batch);
    expect(result.events).toHaveLength(181); frozenTree(result);
    expect(() => validateBoundaryBatch({ ...batch, events: Array.from({ length: 2049 }, (_, i) => ({ kind: "own-income", seq: i + 1, actualCreditedMinerals: 0 })), seqThrough: 2049 })).toThrow(ContractError);
    expect(() => validateBoundaryBatch({ ...batch, events: [...Array.from({ length: 2047 }, (_, i) => ({ ...events[0], seq: i + 1 })), { kind: "own-income", seq: 2048, actualCreditedMinerals: 0 }], seqThrough: 2048 })).toThrow("SIZE: $");
  });
  it.each(["w", "b"] as const)("preserves full actual V1 public behavior for %s", side => {
    for (const turn of [0, 10, 21, 45]) {
      const gas = turn <= 10 ? 1 : turn <= 20 ? 2 : 3;
      const observation = observe(parseScFen(`SCFEN|4k2q/8/8/8/8/8/BRN1P3/4K3|${turn}|33|P|G:${gas}${gas}:${gas}${gas}|B:3:3|Q:w:;b:`), { w: 3, b: 3 }, side);
      expect(validateObservationV1(observation)).toEqual(legacyValidate(observation));
      expect(encodeObservationV1(observation)).toBe(legacyEncode(observation));
      const noncanonical = JSON.stringify(JSON.parse(legacyEncode(observation)), null, 2);
      expect(decodeObservationV1(noncanonical)).toEqual(legacyDecode(noncanonical));
      for (const bad of [{ ...observation, turn: -1 }, { ...observation, cells: [] }, { ...observation, memory: [null] }, { ...observation, source: "private" }]) {
        const error = (fn: () => unknown) => { try { fn(); } catch (e) { return { name: (e as Error).name, message: (e as Error).message }; } };
        expect(error(() => validateObservationV1(bad))).toEqual(error(() => legacyValidate(bad)));
      }
    }
  });
});
