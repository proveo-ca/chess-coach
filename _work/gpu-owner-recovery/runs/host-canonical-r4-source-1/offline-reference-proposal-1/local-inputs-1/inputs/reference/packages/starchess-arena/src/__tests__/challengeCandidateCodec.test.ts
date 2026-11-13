// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { describe, expect, it } from "vitest";
import { parseScFen, type PieceColor, type ScActionInput, type SpawnPiece } from "@chess-coach/starchess-core";
import { baselinePolicy, baselineProposals } from "../challenge/baseline";
import { observe } from "../challenge/observation";
import { ACTION_KINDS, compareRankedCandidates, decodeCandidate, encodeBaselineCandidates, encodeCandidate, MAX_QUEUE_ACTIONS, requestedSpend } from "../challengeContract/candidateCodec";
import { ContractError } from "../challengeContract/validation";
import { validateObservation } from "../challengeContract/observationCodec";
import { encodeFeatures } from "../challengeContract/features";

const observation = (side: PieceColor = "w", placement = "4k3/3p4/8/8/8/8/3P4/4K3") => observe(
  parseScFen(`SCFEN|${placement}|21|33|P|G:33:33|B:3:3|Q:w:;b:`), { w: 3, b: 3 }, side,
);
const action = (kind: ScActionInput["kind"], timing: "B" | "C" | "F", color: PieceColor): ScActionInput => ({
  kind, timing, color, from: color === "w" ? "d2" : "d7",
  ...(["classical", "deploy", "stimStep", "charonMissiles", "tacticalJump"].includes(kind) ? { to: color === "w" ? "d3" : "d6" } : {}),
  ...(kind === "deploy" ? { unit: "p" } : {}),
} as ScActionInput);

describe("Phase 2 all-kind candidate codec", () => {
  it("rejects sparse arrays and extra array properties before encoding costs or features", () => {
    const authorized = observation();
    const sparse = new Array<ScActionInput>(1);
    expect(() => encodeCandidate(authorized, sparse)).toThrow("ARRAY");
    expect(() => requestedSpend(sparse)).toThrow("ARRAY");
    const encoded = { ...encodeCandidate(authorized, []), actions: sparse };
    expect(() => decodeCandidate(encoded, "w")).toThrow("ARRAY");
    expect(() => encodeFeatures(authorized, encoded)).toThrow("ARRAY");
    const extra = Object.assign([], { privateMetadata: "forbidden" });
    expect(() => encodeCandidate(authorized, extra)).toThrow("ARRAY");
    for (const field of ["cells", "memory"] as const) {
      const changed = structuredClone(authorized);
      delete changed[field][0];
      if (field === "memory") changed.memory.length = 1;
      expect(() => validateObservation(changed)).toThrow("ARRAY");
    }
    const changed = structuredClone(authorized);
    changed.own.mines = new Array(1);
    expect(() => validateObservation(changed)).toThrow("ARRAY");
  });
  for (const color of ["w", "b"] as const) {
    for (const kind of ACTION_KINDS) {
      it.each(kind === "classical" ? ["C"] as const : ["B", "F"] as const)(`${color} ${kind} timing %s preserves exact intent and absent fields`, (timing) => {
        const input = [action(kind, timing, color)];
        const encoded = encodeCandidate(observation(color), input);
        expect(encoded.actions).toEqual(input);
        expect(decodeCandidate(JSON.stringify(encoded), color)).toEqual(encoded);
        expect(encoded.key).toBe(decodeCandidate(encoded, color).key);
        for (const field of ["to", "unit", "promotion", "seq"] as const) {
          expect(Object.hasOwn(encoded.actions[0]!, field)).toBe(Object.hasOwn(input[0]!, field));
        }
        expect(Object.isFrozen(encoded.actions[0])).toBe(true);
        expect(Object.isFrozen(encoded.ownSpend)).toBe(true);
      });
    }
  }

  it.each(["p", "n", "b", "r", "q"] as SpawnPiece[])("preserves deployment and classical/stim promotion type %s in both seats", (unit) => {
    for (const color of ["w", "b"] as const) {
      for (const timing of ["B", "F"] as const) {
        const deploy = { ...action("deploy", timing, color), unit };
        expect(decodeCandidate(encodeCandidate(observation(color), [deploy]), color).actions).toEqual([deploy]);
        const stim = { ...action("stimStep", timing, color), promotion: unit };
        expect(decodeCandidate(encodeCandidate(observation(color), [stim]), color).actions).toEqual([stim]);
      }
      const classical = { ...action("classical", "C", color), promotion: unit };
      expect(decodeCandidate(encodeCandidate(observation(color), [classical]), color).actions).toEqual([classical]);
    }
  });

  it("preserves multi-action array order, optional destinations, and canonical detached frozen semantics", () => {
    const input: ScActionInput[] = [action("deploy", "B", "w"), { ...action("classical", "C", "w"), promotion: "r" }, action("siegeMode", "F", "w"), { ...action("spiderMine", "B", "w"), to: "c3" }];
    const encoded = encodeCandidate(observation(), input);
    const decoded = decodeCandidate(JSON.stringify(encoded), "w");
    expect(decoded.actions).toEqual(input);
    expect(decoded.actions).not.toBe(input);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.actions)).toBe(true);
    expect(encodeCandidate(observation(), decoded.actions)).toEqual(encoded);
    expect(encodeCandidate(observation(), [...input].reverse()).key).not.toBe(encoded.key);
    const reorderedFields = input.map(({ kind, ...rest }) => ({ ...rest, kind } as ScActionInput));
    expect(encodeCandidate(observation(), reorderedFields).key).toBe(encoded.key);
    input[0]!.from = "a1";
    expect(decoded.actions[0]!.from).toBe("d2");
  });

  it.each([
    ["unknown kind", { kind: "teleport" }], ["wrong side", { color: "b" }],
    ["bad from", { from: "a0" }], ["bad to", { to: "i1" }],
    ["seq", { seq: 0 }], ["private metadata", { score: 100 }],
    ["classical B", { timing: "B" }], ["classical unit", { unit: "p" }],
    ["promotion CC", { promotion: "k" }], ["null promotion", { promotion: null }],
    ["undefined promotion", { promotion: undefined }], ["undefined to", { to: undefined }],
  ] as const)("rejects action shape %s", (_label, fields) => {
    const candidate = { ...action("classical", "C", "w"), ...fields } as ScActionInput;
    expect(() => encodeCandidate(observation(), [candidate])).toThrow(ContractError);
  });

  it("rejects missing required fields, kind-specific fields, and invalid action containers", () => {
    for (const kind of ACTION_KINDS) {
      const valid = action(kind, kind === "classical" ? "C" : "B", "w");
      for (const field of ["kind", "timing", "color", "from", ...(["classical", "deploy", "stimStep", "charonMissiles", "tacticalJump"].includes(kind) ? ["to"] : []), ...(kind === "deploy" ? ["unit"] : [])]) {
        const invalid = { ...valid };
        Reflect.deleteProperty(invalid, field);
        expect(() => encodeCandidate(observation(), [invalid]), `${kind}.${field}`).toThrow(ContractError);
      }
      if (kind !== "classical") expect(() => encodeCandidate(observation(), [{ ...valid, timing: "C" } as ScActionInput])).toThrow(ContractError);
      if (kind !== "deploy") expect(() => encodeCandidate(observation(), [{ ...valid, unit: "p" } as ScActionInput])).toThrow(ContractError);
      if (kind !== "classical" && kind !== "stimStep") expect(() => encodeCandidate(observation(), [{ ...valid, promotion: "r" }])).toThrow(ContractError);
    }
    for (const invalid of [null, {}, [null], new Array(MAX_QUEUE_ACTIONS + 1).fill(action("siegeMode", "B", "w"))]) {
      expect(() => encodeCandidate(observation(), invalid as ScActionInput[])).toThrow(ContractError);
    }
  });

  it("pins requested spend to current core costs 0/1/2/3 and deployment minerals", () => {
    expect(requestedSpend([action("classical", "C", "w")])).toEqual({ minerals: 0, gas: 0 });
    for (const kind of ["deploy", "stimStep", "spiderMine", "siegeMode"] as const) expect(requestedSpend([action(kind, "B", "w")]).gas).toBe(1);
    expect(requestedSpend([action("charonMissiles", "F", "w")]).gas).toBe(2);
    expect(requestedSpend([action("tacticalJump", "B", "w")]).gas).toBe(3);
    for (const [unit, minerals] of [["p", 1], ["n", 3], ["b", 3], ["r", 5], ["q", 9]] as const) {
      const encoded = encodeCandidate(observation(), [{ ...action("deploy", "F", "w"), unit } as ScActionInput]);
      expect(encoded.ownSpend).toEqual({ minerals, gas: 1 });
    }
    expect(encodeCandidate(observation(), ACTION_KINDS.map((kind) => action(kind, kind === "classical" ? "C" : "B", "w"))).ownSpend).toEqual({ minerals: 1, gas: 9 });
  });

  it("rejects wrong envelope/version, recomputed key/spend mismatches, and nonfinite spend", () => {
    const valid = encodeCandidate(observation(), [action("deploy", "B", "w")]);
    for (const invalid of [null, [], {}, { ...valid, version: "v2" }, { ...valid, source: "private" }, { ...valid, key: "forged" }, { ...valid, ownSpend: { minerals: 0, gas: 1 } }, { ...valid, ownSpend: { minerals: 1, gas: 0 } }, { ...valid, ownSpend: { ...valid.ownSpend, enemyGas: 3 } }]) {
      expect(() => decodeCandidate(invalid, "w")).toThrow(ContractError);
    }
    for (const field of ["minerals", "gas"] as const) for (const number of [NaN, Infinity, -Infinity, -1, 1.5]) {
      expect(() => decodeCandidate({ ...valid, ownSpend: { ...valid.ownSpend, [field]: number } }, "w")).toThrow(ContractError);
    }
    expect(() => decodeCandidate(valid, "b")).toThrow(ContractError);
    expect(() => decodeCandidate("{", "w")).toThrow(ContractError);
    expect(() => decodeCandidate({ ...valid, actions: [{ ...valid.actions[0], to: "e3" }] }, "w")).toThrow(ContractError);
    for (const field of ["version", "key", "actions", "ownSpend"]) {
      const invalid = structuredClone(valid);
      Reflect.deleteProperty(invalid, field);
      expect(() => decodeCandidate(invalid, "w"), field).toThrow(ContractError);
    }
    for (const unit of ["k", "marine", null, undefined]) expect(() => encodeCandidate(observation(), [{ ...action("deploy", "B", "w"), unit } as ScActionInput])).toThrow(ContractError);
  });

  it("accepts explicit pass and the exact 65-action representation bound independently of affordability", () => {
    const pass = encodeCandidate(observation(), []);
    expect(pass).toMatchObject({ key: "[]", actions: [], ownSpend: { minerals: 0, gas: 0 } });
    expect(decodeCandidate(JSON.stringify(pass), "w")).toEqual(pass);
    const actions = Array.from({ length: MAX_QUEUE_ACTIONS }, () => action("tacticalJump", "F", "w"));
    const candidate = encodeCandidate(observation(), actions);
    expect(candidate.actions).toHaveLength(65);
    expect(candidate.ownSpend).toEqual({ minerals: 0, gas: 195 });
    expect(decodeCandidate(JSON.stringify(candidate), "w")).toEqual(candidate);
  });

  it.each(["w", "b"] as const)("preserves every baseline %s proposal's membership, actions, key, score, order, and choice", (color) => {
    for (const placement of ["4k3/3p4/8/8/8/8/3P4/4K3", "7k/P7/8/8/8/8/7p/K7", "4k3/8/8/8/8/3p4/3P4/4K3"]) {
      const obs = observation(color, placement);
      const baseline = baselineProposals(obs);
      const encoded = encodeBaselineCandidates(obs);
      expect(encoded.map(({ candidate, baselineScore }) => ({ actions: candidate.actions, key: candidate.key, score: baselineScore }))).toEqual(baseline);
      expect(encoded.every((p) => p.enumerationVersion === "baseline-v1" && p.comparatorVersion === "score-desc-key-asc-v1")).toBe(true);
      expect(encoded.map((p) => p.candidate.actions[0]?.kind ?? "pass").every((kind) => ["classical", "deploy", "pass"].includes(kind))).toBe(true);
      expect(encoded[0]!.candidate.actions).toEqual(baselinePolicy.choose(obs, () => 0));
      expect(Object.isFrozen(encoded)).toBe(true);
      expect([...baseline].sort(compareRankedCandidates)).toEqual(baseline);
    }
  });

  it("pins descending score and ascending canonical-key ties independent of input order", () => {
    const ranked = [{ key: "z", score: 10 }, { key: "a", score: 10 }, { key: "b", score: 11 }, { key: "c", score: -1 }];
    expect(ranked.sort(compareRankedCandidates).map((p) => p.key)).toEqual(["b", "a", "z", "c"]);
    expect(compareRankedCandidates({ key: "a", score: 1 }, { key: "a", score: 1 })).toBe(0);
  });

  it.each([NaN, Infinity, -Infinity])("rejects nonfinite ranking score %s in either comparator operand", (score) => {
    expect(() => compareRankedCandidates({ key: "a", score }, { key: "b", score: 0 })).toThrow(ContractError);
    expect(() => compareRankedCandidates({ key: "a", score: 0 }, { key: "b", score })).toThrow(ContractError);
  });
});
