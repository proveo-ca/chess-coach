import { describe, expect, it, vi } from "vitest";
import { initializeProvenance, type ScActionInput, type ScFenSnapshot } from "@chess-coach/starchess-core";
import {
  decodeObservation, decodeObservationV1, encodeObservation, encodeObservationV1, validateObservation, validateObservationV1,
  type AuthorizedObservationV1, type AuthorizedSnapshotV2, type Square,
} from "../observations";
import { decodeCandidate, encodeCandidate } from "../intent-codec-v1";
import { validateObservation as validateLegacy, encodeObservation as encodeLegacy, decodeObservation as decodeLegacy } from "../challengeContract/observationCodec";
import { encodeCandidate as encodeLegacyCandidate } from "../challengeContract/candidateWire";
import { initializeR3Session } from "../challenge/r3Session";

const squares = Array.from({ length: 64 }, (_, i) => `${"abcdefgh"[Math.floor(i / 8)]}${i % 8 + 1}` as Square);
const zeroCC = (side: "w" | "b" = "w", ccLives = 3): AuthorizedObservationV1 => {
  const square = side === "w" ? "d2" : "d7";
  return {
    version: "challenge-observation-v1", side, turn: 21,
    own: { minerals: 1, gas: 1, gasIncome: 1, ccLives,
      pieces: [{ square, piece: { type: "p", color: side } }], mines: [], siegedTanks: [] },
    cells: squares.map(at => ({ square: at, visibility: "lit", piece: at === square ? { type: "p", color: side } : null })),
    memory: [],
  };
};
const serialized = (observation: AuthorizedObservationV1) => JSON.stringify({ codecVersion: "challenge-observation-codec-v1", observation });
const v2Fixture = (): AuthorizedSnapshotV2 => {
  const input = zeroCC();
  input.own.pieces.push({ square: "e1", piece: { type: "k", color: "w" } });
  input.cells[squares.indexOf("e1")] = { square: "e1", visibility: "lit", piece: { type: "k", color: "w" } };
  return {
    ...input, version: "challenge-observation-v2",
    ownUnitLineage: input.own.pieces.map(x => ({ id: `w:unit:opening:${x.square}`, square: x.square, type: x.piece.type, paidBasis: 0, replacementValue: x.piece.type === "k" ? 0 : 1 })),
    ownMineLineage: [],
    economicState: {
      version: "challenge-economic-ledger-v1", side: "w", ownPaidDebits: 0, ownPaidSurviving: 0, ownPaidDestroyed: 0,
      ownPaidWasted: 0, ownReplacementDestroyed: 0,
      enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" },
      receipts: [], retiredOwnIds: [],
    },
  };
};

describe("MAIN public V1 structural compatibility with strict REC boundaries", () => {
  it.each(["w", "b"] as const)("roundtrips independent zero-CC %s observations and encodes classical, deploy and pass", side => {
    for (const lives of [0, 3]) {
      const input = zeroCC(side, lives);
      const validated = validateObservationV1(input);
      const encoded = encodeObservationV1(input);
      expect(validated).toEqual(input);
      expect(validated.own.pieces[0]!.piece).not.toBe(input.own.pieces[0]!.piece);
      expect(Object.isFrozen(validated.own.pieces[0]!.piece)).toBe(true);
      expect(decodeObservationV1(encoded)).toEqual(input);
      expect(decodeObservationV1(serialized(input))).toEqual(input);
      expect(encodeObservationV1(decodeObservationV1(encoded))).toBe(encoded);
      const from = side === "w" ? "d2" : "d7";
      const to = side === "w" ? "d3" : "d6";
      const queues: ScActionInput[][] = [[], [{ kind: "classical", timing: "C", color: side, from, to }],
        [{ kind: "deploy", timing: "B", color: side, from, to, unit: "p" }]];
      for (const actions of queues) {
        const candidate = encodeCandidate(input, actions);
        expect(candidate).toEqual({ version: "challenge-candidate-codec-v1", key: actions.length === 0 ? "[]" :
          `[{"color":"${side}","from":"${from}","kind":"${actions[0]!.kind}","timing":"${actions[0]!.timing}","to":"${to}"${actions[0]!.kind === "deploy" ? ',"unit":"p"' : ""}}]`,
          actions, ownSpend: actions[0]?.kind === "deploy" ? { minerals: 1, gas: 1 } : { minerals: 0, gas: 0 } });
        expect(decodeCandidate(JSON.stringify(candidate), side)).toEqual(candidate);
        expect(() => encodeLegacyCandidate(input, actions)).toThrow("CONSISTENCY");
      }
      expect(() => validateLegacy(input)).toThrow("CONSISTENCY");
      expect(() => encodeLegacy(input)).toThrow("CONSISTENCY");
      expect(() => decodeLegacy(encoded)).toThrow("CONSISTENCY");
    }
  });

  it("preserves the independent empty-inventory zero-CC byte format", () => {
    const input = zeroCC("w", 0);
    input.own.pieces = [];
    input.cells = squares.map(square => ({ square, visibility: "unknown" }));
    const cells = squares.map(square => `{"square":"${square}","visibility":"unknown"}`).join(",");
    const golden = '{"codecVersion":"challenge-observation-codec-v1","observation":{"cells":[' + cells +
      '],"memory":[],"own":{"ccLives":0,"gas":1,"gasIncome":1,"minerals":1,"mines":[],"pieces":[],"siegedTanks":[]},"side":"w","turn":21,"version":"challenge-observation-v1"}}';
    expect(encodeObservationV1(input)).toBe(golden);
    expect(decodeObservationV1(golden)).toEqual(input);
    expect(encodeCandidate(input, []).key).toBe("[]");
    expect(() => validateLegacy(input)).toThrow("CONSISTENCY");
  });

  it.each(["multiple CCs", "cell/inventory mismatch"])("rejects %s through every public V1 observation and candidate entrypoint", kind => {
    const input = zeroCC();
    if (kind === "multiple CCs") {
      for (const square of ["e1", "f1"] as const) {
        input.own.pieces.push({ square, piece: { type: "k", color: "w" } });
        input.cells[squares.indexOf(square)] = { square, visibility: "lit", piece: { type: "k", color: "w" } };
      }
    } else input.own.pieces = [];
    for (const run of [() => validateObservationV1(input), () => encodeObservationV1(input),
      () => decodeObservationV1(serialized(input)), () => encodeCandidate(input, [])]) expect(run).toThrow("CONSISTENCY");
  });

  it("keeps zero-CC descriptor snapshots detached, null-prototype compatible and prototype-safe", () => {
    const input = zeroCC();
    const get = vi.fn(() => { throw Error("caller property read"); });
    Object.setPrototypeOf(input.own, null);
    input.own = new Proxy(input.own, { get });
    const proxy = new Proxy(input, { get });
    expect(validateObservationV1(proxy)).toEqual(zeroCC());
    expect(decodeObservationV1(encodeObservationV1(proxy))).toEqual(zeroCC());
    expect(encodeCandidate(proxy, []).key).toBe("[]");
    expect(get).not.toHaveBeenCalled();
    for (const at of ["root", "own"] as const) {
      const decorated = zeroCC();
      Object.defineProperty(at === "root" ? decorated : decorated.own, "__proto__", { value: { polluted: true }, enumerable: true });
      expect(() => validateObservationV1(decorated)).toThrow("SCHEMA");
      expect(() => encodeObservationV1(decorated)).toThrow("SCHEMA");
      expect(() => decodeObservationV1(serialized(decorated))).toThrow("SCHEMA");
      expect(() => encodeCandidate(decorated, [])).toThrow("SCHEMA");
    }
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });

  it("preserves V2 exact-one CC validation and codec rejection", () => {
    const valid = v2Fixture();
    expect(decodeObservation(encodeObservation(valid))).toEqual(validateObservation(valid));
    const invalid: AuthorizedSnapshotV2 = { ...valid, own: { ...valid.own, pieces: valid.own.pieces.filter(x => x.piece.type !== "k") },
      cells: valid.cells.map(x => x.square === "e1" ? { square: "e1", visibility: "lit", piece: null } : x),
      ownUnitLineage: valid.ownUnitLineage.filter(x => x.type !== "k") };
    expect(() => validateObservation(invalid)).toThrow("CONSISTENCY");
    expect(() => encodeObservation(invalid)).toThrow("CONSISTENCY");
    expect(() => decodeObservation(new TextEncoder().encode(JSON.stringify({ codecVersion: "challenge-observation-codec-v2", observation: invalid })))).toThrow("CONSISTENCY");
  });

  it.each(["w", "b"] as const)("preserves native provenance and R3 bound-session rejection of missing %s CC", side => {
    const valid: ScFenSnapshot = { placement: "4k3/8/8/8/8/8/3P4/4K3", turn: 21, phase: "P",
      ccLives: { w: 3, b: 3 }, gas: { w: 1, b: 1 }, gasIncome: { w: 1, b: 1 }, queue: { actions: [] }, mines: [] };
    expect(() => initializeProvenance(valid)).not.toThrow();
    expect(() => initializeR3Session({}, valid, { w: 1, b: 1 })).not.toThrow();
    const invalid = { ...valid, placement: side === "w" ? "4k3/8/8/8/8/8/3P4/8" : "8/8/8/8/8/8/3P4/4K3" };
    expect(() => initializeProvenance(invalid)).toThrow("CONSISTENCY");
    expect(() => initializeR3Session({}, invalid, { w: 1, b: 1 })).toThrow("CONSISTENCY");
  });
});
