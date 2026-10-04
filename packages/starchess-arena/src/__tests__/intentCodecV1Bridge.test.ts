// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it, vi } from "vitest";
import { parseScFen, type PieceColor, type ScActionInput } from "@chess-coach/starchess-core";
import { observe } from "../challenge/observation";
import * as legacy from "../challengeContract/candidateCodec";
import * as wire from "../challengeContract/candidateWire";
import * as bridge from "../intent-codec-v1";
import { ContractError } from "../challengeContract/validation";

const observation = (side: PieceColor = "w") => observe(parseScFen(
  "SCFEN|4k3/3p4/8/8/8/8/3P4/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:",
), { w: 3, b: 3 }, side);
const action = (kind: ScActionInput["kind"], timing: "B" | "C" | "F", color: PieceColor): ScActionInput => ({
  kind, timing, color, from: color === "w" ? "d2" : "d7",
  ...(["classical", "deploy", "stimStep", "charonMissiles", "tacticalJump"].includes(kind) ? { to: color === "w" ? "d3" : "d6" } : {}),
  ...(kind === "deploy" ? { unit: "p" } : {}),
} as ScActionInput);
const candidate = () => structuredClone(wire.encodeCandidate(observation(), [action("deploy", "B", "w")]));
const boundaries = (input: wire.EncodedCandidate): object[] => [input, input.actions, input.actions[0]!, input.ownSpend];

describe("public intent codec V1 bridge and pure wire", () => {
  it("preserves every legacy wire export by identity", () => {
    for (const key of Object.keys(wire) as (keyof typeof wire)[]) expect(legacy[key], key).toBe(wire[key]);
    expect(bridge.encodeCandidate).toBe(wire.encodeCandidate);
    expect(bridge.requestedSpend).toBe(wire.requestedSpend);
    expect(bridge.validateActions).toBe(wire.validateActions);
    expect(bridge.ACTION_KINDS).toBe(wire.ACTION_KINDS);
    expect(bridge.MAX_QUEUE_ACTIONS).toBe(65);
    expect(Object.keys(bridge).sort()).toEqual(["ACTION_KINDS", "MAX_QUEUE_ACTIONS", "decodeCandidate", "encodeCandidate", "requestedSpend", "validateActions"].sort());
  });

  it("pins exact candidate key, optional fields, spend, and serialized bytes", () => {
    const input: ScActionInput[] = [action("deploy", "B", "w"), { ...action("classical", "C", "w"), promotion: "r" },
      action("siegeMode", "F", "w"), { ...action("spiderMine", "B", "w"), to: "c3" }];
    const key = '[{"color":"w","from":"d2","kind":"deploy","timing":"B","to":"d3","unit":"p"},{"color":"w","from":"d2","kind":"classical","promotion":"r","timing":"C","to":"d3"},{"color":"w","from":"d2","kind":"siegeMode","timing":"F"},{"color":"w","from":"d2","kind":"spiderMine","timing":"B","to":"c3"}]';
    const encoded = bridge.encodeCandidate(observation(), input);
    const golden = JSON.stringify({ version: "challenge-candidate-codec-v1", key, actions: input, ownSpend: { minerals: 1, gas: 3 } });
    expect(encoded.key).toBe(key);
    expect(JSON.stringify(encoded)).toBe(golden);
    expect(bridge.decodeCandidate(golden, "w")).toEqual(encoded);
    expect(wire.decodeCandidate(golden, "w")).toEqual(encoded);
    expect(bridge.decodeCandidate(encoded, "w").actions).not.toBe(encoded.actions);
    expect(Object.isFrozen(bridge.decodeCandidate(encoded, "w").actions[0])).toBe(true);
  });

  for (const color of ["w", "b"] as const) for (const kind of bridge.ACTION_KINDS) {
    it.each(kind === "classical" ? ["C"] as const : ["B", "F"] as const)(`${color} ${kind} %s preserves legacy wire semantics`, (timing) => {
      const input = [action(kind, timing, color)];
      const encoded = bridge.encodeCandidate(observation(color), input);
      expect(encoded).toEqual(legacy.encodeCandidate(observation(color), input));
      expect(bridge.decodeCandidate(encoded, color)).toEqual(encoded);
      expect(bridge.decodeCandidate(JSON.stringify(encoded), color)).toEqual(encoded);
    });
  }

  it("preserves pass and exactly 65 actions without imposing affordability", () => {
    for (const actions of [[], Array.from({ length: 65 }, () => action("tacticalJump", "F", "w"))]) {
      const encoded = bridge.encodeCandidate(observation(), actions);
      expect(bridge.decodeCandidate(encoded, "w")).toEqual(encoded);
      expect(encoded.ownSpend).toEqual({ minerals: 0, gas: actions.length * 3 });
    }
    expect(() => bridge.encodeCandidate(observation(), Array.from({ length: 66 }, () => action("siegeMode", "B", "w")))).toThrow("ARRAY");
  });

  it.each(["getter", "setter", "symbol", "hidden", "prototype", "private"] as const)("rejects %s at every candidate boundary without invoking getters", (kind) => {
    for (let index = 0; index < 4; index++) {
      const input = candidate();
      const target = boundaries(input)[index]!;
      const getter = vi.fn(() => "private");
      if (kind === "getter") Object.defineProperty(target, "private", { enumerable: true, get: getter });
      if (kind === "setter") Object.defineProperty(target, "private", { enumerable: true, set: getter });
      if (kind === "symbol") Object.defineProperty(target, Symbol("private"), { value: "private" });
      if (kind === "hidden") Object.defineProperty(target, "private", { value: "private" });
      if (kind === "prototype") Object.setPrototypeOf(target, { private: "private" });
      if (kind === "private") Object.assign(target, { private: "private" });
      expect(() => bridge.decodeCandidate(input, "w"), `${kind}:${index}`).toThrow(ContractError);
      expect(getter).not.toHaveBeenCalled();
    }
  });

  it("rejects required-field accessors before the legacy decoder reads them", () => {
    const input = candidate();
    const getter = vi.fn(() => "challenge-candidate-codec-v1");
    Object.defineProperty(input, "version", { enumerable: true, get: getter });
    expect(() => bridge.decodeCandidate(input, "w")).toThrow(ContractError);
    expect(getter).not.toHaveBeenCalled();
    expect(legacy.decodeCandidate(input, "w").version).toBe("challenge-candidate-codec-v1");
    expect(getter).toHaveBeenCalledOnce();
  });

  it("preserves legacy hidden/symbol metadata acceptance without exposing it publicly", () => {
    for (const key of ["private", Symbol("private")]) {
      const input = candidate();
      Object.defineProperty(input.actions[0]!, key, { value: "private" });
      expect(legacy.decodeCandidate(input, "w")).toEqual(candidate());
      expect(() => bridge.decodeCandidate(input, "w")).toThrow(ContractError);
    }
  });

  it("decodes the descriptor snapshot without reading the caller's object properties", () => {
    const input = candidate();
    const get = vi.fn(() => { throw new Error("unexpected property read"); });
    input.actions[0] = new Proxy(input.actions[0]!, { get });
    expect(bridge.decodeCandidate(new Proxy(input, { get }), "w")).toEqual(candidate());
    expect(get).not.toHaveBeenCalled();
  });

  it("rejects sparse arrays, index getters, wrong sides, key/spend drift and invalid JSON", () => {
    const input = candidate();
    delete input.actions[0];
    expect(() => bridge.decodeCandidate(input, "w")).toThrow("ARRAY");
    const accessor = candidate();
    const getter = vi.fn(() => action("deploy", "B", "w"));
    Object.defineProperty(accessor.actions, "0", { enumerable: true, get: getter });
    expect(() => bridge.decodeCandidate(accessor, "w")).toThrow(ContractError);
    expect(getter).not.toHaveBeenCalled();
    expect(() => bridge.decodeCandidate(candidate(), "b")).toThrow(ContractError);
    expect(() => bridge.decodeCandidate({ ...candidate(), key: "forged" }, "w")).toThrow("DERIVED");
    expect(() => bridge.decodeCandidate({ ...candidate(), ownSpend: { minerals: 0, gas: 0 } }, "w")).toThrow("DERIVED");
    expect(() => bridge.decodeCandidate("{", "w")).toThrow("JSON");
    const extra = { ...candidate(), source: "private" };
    expect(() => bridge.decodeCandidate(JSON.stringify(extra), "w")).toThrow(ContractError);
  });

  it("preserves the rank comparator including canonical-key ties and nonfinite rejection", () => {
    const input = [{ key: "z", score: 1 }, { key: "a", score: 1 }, { key: "b", score: 2 }];
    expect(input.sort(wire.compareRankedCandidates).map((entry) => entry.key)).toEqual(["b", "a", "z"]);
    for (const score of [NaN, Infinity, -Infinity]) expect(() => wire.compareRankedCandidates({ key: "a", score }, { key: "b", score: 0 })).toThrow(ContractError);
  });
});
