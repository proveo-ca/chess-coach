// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it, vi } from "vitest";
import { parseScFen, type ScActionInput } from "@chess-coach/starchess-core";
import * as publicWire from "../intent-codec-v1";
import { ACTION_KINDS, decodeCandidate, encodeCandidate, MAX_QUEUE_ACTIONS, requestedSpend, validateActions } from "../intent-codec-v1";
import { observe } from "../challenge/observation";
import { decodeCandidate as legacyDecode, encodeCandidate as legacyEncode, requestedSpend as legacySpend } from "../challengeContract/candidateCodec";
import { ContractError } from "../challengeContract/validation";
import { validateObservationV1 } from "../observations";

const fixture = (side: "w" | "b" = "w") => observe(parseScFen(
  "SCFEN|4k3/3p4/8/8/8/8/3P4/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:",
), { w: 3, b: 3 }, side);
const action = (kind: ScActionInput["kind"], color: "w" | "b", timing: "B" | "C" | "F"): ScActionInput => ({
  kind, color, timing, from: color === "w" ? "d2" : "d7",
  ...(["classical", "deploy", "stimStep", "charonMissiles", "tacticalJump"].includes(kind) ? { to: color === "w" ? "d3" : "d6" } : {}),
  ...(kind === "deploy" ? { unit: "p" } : {}),
} as ScActionInput);

describe("public pure V1 candidate wire", () => {
  it("exports only the wire API", () => {
    expect(Object.keys(publicWire).sort()).toEqual([
      "ACTION_KINDS", "CANDIDATE_CODEC_VERSION", "MAX_QUEUE_ACTIONS", "decodeCandidate", "encodeCandidate", "requestedSpend", "validateActions",
    ]);
  });

  it.each(["w", "b"] as const)("preserves all %s action kinds, timings, legacy keys, and spend", (color) => {
    for (const kind of ACTION_KINDS) for (const timing of kind === "classical" ? ["C"] as const : ["B", "F"] as const) {
      const actions = [action(kind, color, timing)];
      const encoded = encodeCandidate(validateObservationV1(fixture(color)), actions);
      expect(encoded).toEqual(legacyEncode(fixture(color), actions));
      expect(JSON.stringify(encoded)).toBe(JSON.stringify(legacyEncode(fixture(color), actions)));
      expect(requestedSpend(actions)).toEqual(legacySpend(actions));
      expect(validateActions(actions, color)).toEqual(actions);
      expect(decodeCandidate(encoded, color)).toEqual(legacyDecode(encoded, color));
      expect(decodeCandidate(JSON.stringify(encoded), color)).toEqual(encoded);
    }
  });

  it.each(["p", "n", "b", "r", "q"] as const)("preserves deployment and promotion %s", (unit) => {
    for (const color of ["w", "b"] as const) {
      const actions: ScActionInput[] = [
        { ...action("deploy", color, "B"), unit },
        { ...action("stimStep", color, "F"), promotion: unit },
        { ...action("classical", color, "C"), promotion: unit },
      ];
      const encoded = encodeCandidate(fixture(color), actions);
      expect(decodeCandidate(encoded, color).actions).toEqual(actions);
      expect(encoded).toEqual(legacyEncode(fixture(color), actions));
    }
  });

  it("preserves pass, the exact representation bound, ordered keys, and detached frozen output", () => {
    expect(encodeCandidate(fixture(), [])).toMatchObject({ key: "[]", ownSpend: { minerals: 0, gas: 0 } });
    const actions = Array.from({ length: MAX_QUEUE_ACTIONS }, () => action("tacticalJump", "w", "F"));
    const encoded = encodeCandidate(fixture(), actions);
    expect(encoded.actions).toHaveLength(65);
    expect(encoded.ownSpend).toEqual({ minerals: 0, gas: 195 });
    expect(decodeCandidate(encoded, "w")).toEqual(encoded);
    expect(() => encodeCandidate(fixture(), [...actions, actions[0]!])).toThrow(ContractError);
    expect(Object.isFrozen(encoded)).toBe(true);
    expect(Object.isFrozen(encoded.actions)).toBe(true);
    expect(Object.isFrozen(encoded.actions[0])).toBe(true);
    expect(Object.isFrozen(encoded.ownSpend)).toBe(true);
    actions[0]!.from = "a1";
    expect(encoded.actions[0]!.from).toBe("d2");
    const ordered = [action("deploy", "w", "B"), action("classical", "w", "C")];
    expect(encodeCandidate(fixture(), ordered).key).not.toBe(encodeCandidate(fixture(), [...ordered].reverse()).key);
  });

  it("encodes an authorized observation with no own CC", () => {
    const input = structuredClone(fixture());
    input.own.pieces = input.own.pieces.filter((entry) => entry.piece.type !== "k");
    const at = input.cells.findIndex((cell) => cell.square === "e1");
    input.cells[at] = { square: "e1", visibility: "lit", piece: null };
    expect(encodeCandidate(validateObservationV1(input), []).key).toBe("[]");
  });

  it.each(["root", "action", "spend"] as const)("guards %s candidate accessors before legacy decoding", (boundary) => {
    const encoded = structuredClone(encodeCandidate(fixture(), [action("deploy", "w", "B")]));
    const target = boundary === "root" ? encoded : boundary === "action" ? encoded.actions[0]! : encoded.ownSpend;
    const key = boundary === "root" ? "version" : boundary === "action" ? "from" : "minerals";
    const value = Reflect.get(target, key);
    const getter = vi.fn(() => value);
    Object.defineProperty(target, key, { enumerable: true, get: getter });
    expect(() => decodeCandidate(encoded, "w")).toThrow(ContractError);
    expect(getter).not.toHaveBeenCalled();
    expect(legacyDecode(encoded, "w").actions).toEqual([action("deploy", "w", "B")]);
    expect(getter).toHaveBeenCalled();
  });

  it("guards action accessors before encoding, validating, or reading spend side", () => {
    const input = action("deploy", "w", "B");
    const getter = vi.fn(() => "w");
    Object.defineProperty(input, "color", { enumerable: true, get: getter });
    expect(() => validateActions([input], "w")).toThrow(ContractError);
    expect(() => requestedSpend([input])).toThrow(ContractError);
    expect(() => encodeCandidate(fixture(), [input])).toThrow(ContractError);
    expect(getter).not.toHaveBeenCalled();
  });

  it.each(["prototype", "symbol", "nonenumerable", "sparse", "derivedKey", "derivedSpend", "wrongSide", "private"] as const)("rejects %s wire input", (change) => {
    const encoded = structuredClone(encodeCandidate(fixture(), [action("deploy", "w", "B")]));
    if (change === "prototype") Object.setPrototypeOf(encoded.actions[0]!, { private: true });
    if (change === "symbol") Object.assign(encoded.ownSpend, { [Symbol("private")]: true });
    if (change === "nonenumerable") Object.defineProperty(encoded, "private", { value: true });
    if (change === "sparse") Reflect.deleteProperty(encoded.actions, "0");
    if (change === "derivedKey") encoded.key = "forged";
    if (change === "derivedSpend") encoded.ownSpend.gas = 0;
    if (change === "private") Object.assign(encoded.actions[0]!, { seq: 0 });
    expect(() => decodeCandidate(encoded, change === "wrongSide" ? "b" : "w")).toThrow(ContractError);
  });
});
