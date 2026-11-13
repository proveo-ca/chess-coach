// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as k from "../economic/ownedKernel";
import { fixtureBoundary, openingHistory } from "./economicA2.test";

const active = () => {
  const pair = k.createPlanningLedger(); pair.owner.admitOnce(); pair.owner.armEncode();
  return { ...pair, ticket: k.enterA2(pair.meter, "encode") };
};

describe("owned canonical prototype isolation", () => {
  it("ignores inherited actionRef on an owned income event during boundary construction", () => {
    const snapshot = fixtureBoundary(openingHistory(1), 2, "settled", 2).snapshot;
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, "actionRef");
    let reads = 0, failure: unknown;
    try {
      const field = { __proto__: null, configurable: true, get() { reads++; throw new Error("inherited actionRef"); } };
      Object.defineProperty(Object.prototype, "actionRef", field);
      const pair = active(), events = k.beginEvents2048(pair.meter);
      k.appendEvents2048(pair.meter, events, k.makeOwnIncomeEvent(pair.meter, 3, 0));
      k.makeBoundaryBatch(pair.meter, "w", 2, "settled", 1, 1, 2, 3, k.finishEvents2048(pair.meter, events), snapshot);
      k.finishA2(pair.ticket); pair.owner.close();
    } catch (error) { failure = error; }
    finally {
      if (previous) Object.defineProperty(Object.prototype, "actionRef", previous); else Reflect.deleteProperty(Object.prototype, "actionRef");
    }
    expect(failure).toBeUndefined(); expect(reads).toBe(0);
  });
  it("ignores inherited promotion and destination getters during construction and emission", () => {
    const pair = active(), descriptors = ["promotion", "to"].map(key => Object.getOwnPropertyDescriptor(Object.prototype, key));
    let reads = 0, bytes: Uint8Array | undefined, failure: unknown, actions: readonly unknown[] = [];
    try {
      for (const key of ["promotion", "to"]) {
        const field = { __proto__: null, configurable: true, get() { reads++; throw new Error(`inherited ${key}`); } };
        Object.defineProperty(Object.prototype, key, field);
      }
      const cursor = k.beginActions65(pair.meter);
      k.appendActions65(pair.meter, cursor, k.makeClassicalAction(pair.meter, "w", "a2", "a3"));
      k.appendActions65(pair.meter, cursor, k.makeSpiderMineAction(pair.meter, "B", "w", "b2"));
      k.appendActions65(pair.meter, cursor, k.makeSiegeModeAction(pair.meter, "F", "w", "c2"));
      const owned = k.finishActions65(pair.meter, cursor); actions = owned;
      bytes = k.encodeOwnedCandidate(pair.meter, k.makeCandidate(pair.meter, "w", owned));
      for (const action of owned) { void action.promotion; void action.to; }
      k.finishA2(pair.ticket); pair.owner.close();
    } catch (error) { failure = error; }
    finally {
      for (const [index, key] of ["promotion", "to"].entries()) {
        const descriptor = descriptors[index];
        if (descriptor) Object.defineProperty(Object.prototype, key, descriptor); else Reflect.deleteProperty(Object.prototype, key);
      }
      if (failure) { try { pair.owner.abort(); } catch { } }
    }
    expect(failure).toBeUndefined(); expect(reads).toBe(0);
    expect(actions.map(action => Object.getPrototypeOf(action))).toEqual([null, null, null]);
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    expect(parsed.actions).toEqual([
      { kind: "classical", timing: "C", color: "w", from: "a2", to: "a3" },
      { kind: "spiderMine", timing: "B", color: "w", from: "b2" },
      { kind: "siegeMode", timing: "F", color: "w", from: "c2" },
    ]);
  });

  it.each(["startup", "actions"])("ignores inherited record-key table entry %s", role => {
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, role), pair = active();
    let reads = 0, failure: unknown;
    try {
      const field = { __proto__: null, configurable: true, get() { reads++; throw new Error("inherited role"); } };
      Object.defineProperty(Object.prototype, role, field);
      if (role === "startup") k.createStartupArtifactContext();
      else k.finishActions65(pair.meter, k.beginActions65(pair.meter));
      k.finishA2(pair.ticket); pair.owner.close();
    } catch (error) { failure = error; }
    finally {
      if (previous) Object.defineProperty(Object.prototype, role, previous); else Reflect.deleteProperty(Object.prototype, role);
      if (failure) { try { pair.owner.abort(); } catch { } }
    }
    expect(failure).toBeUndefined(); expect(reads).toBe(0);
  });

  it("materializes planning string tokens without repeated concatenation", () => {
    const source = readFileSync(new URL("../economic/ownedR4Schema.ts", import.meta.url), "utf8");
    const text = source.slice(source.indexOf("const text ="), source.indexOf("const number ="));
    expect(text).not.toMatch(/\bvalue\s*\+=/);
    expect(text).toContain("joinCharacters");
    const kernel = readFileSync(new URL("../economic/ownedKernel.ts", import.meta.url), "utf8");
    const emission = kernel.slice(kernel.indexOf("type ByteEmitter"), kernel.indexOf("export const encodeOwnedBoundaryBatch"));
    expect(emission).not.toMatch(/\b(?:result|value|text)\s*\+=/);
    expect(emission).toContain("emitCanonical"); expect(emission).toContain("new FixedUint8Array(wireLength(value))");
  });
});
