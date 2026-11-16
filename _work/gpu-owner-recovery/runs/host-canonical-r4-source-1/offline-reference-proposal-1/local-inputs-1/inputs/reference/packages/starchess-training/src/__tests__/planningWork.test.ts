// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { beginBlock, consumeWorkBlock, createPlanningLedger, enterA2, finishA2, finishBlock, reserveBlock } from "../economic/ownedKernel";
import { quoteBlock } from "../economic/invoices";
import * as scalars from "../economic/ownedScalars";
import { decodeFloat64, encodeFloat64, validateFloat64 } from "../economic/float64";
import { allocateFloat64, blockMeters, charge, classifyEconomicFailure, closeCore, ContractError, fail, positiveProduct, validateMeter } from "../economic/work";

const open = () => {
  const pair = createPlanningLedger();
  pair.owner.admitOnce();
  pair.owner.armReadout();
  return { ...pair, ticket: enterA2(pair.meter, "readout") };
};
const hostile = () => {
  const trap = vi.fn(() => { throw new Error("argument inspection"); });
  return { value: new Proxy({}, { get: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap }), trap };
};

describe("entered planning work and owned Float64", () => {
  it("rejects unavailable storage and undefined-meter bypass before Float64 arguments", () => {
    const input = hostile(), meter = hostile();
    for (const unowned of [undefined, null, {}, { limit: 1048576, used: 0 }, meter.value]) {
      expect(() => decodeFloat64(input.value, unowned as never)).toThrow("PROVENANCE");
      expect(() => encodeFloat64(input.value as never, unowned as never)).toThrow("PROVENANCE");
      expect(() => charge(unowned as never, input.value as never, "$")).toThrow("PROVENANCE");
    }
    expect(input.trap).not.toHaveBeenCalled();
    expect(meter.trap).not.toHaveBeenCalled();
    const unadmitted = createPlanningLedger();
    expect(() => decodeFloat64(input.value, unadmitted.meter)).toThrow("LIFECYCLE");
    expect(input.trap).not.toHaveBeenCalled();
  });

  it.each([0, -0, .5, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE])("roundtrips owned finite H: %s", value => {
    const { meter, owner, ticket } = open(), before = meter.used;
    const h = encodeFloat64(value, meter);
    expect(Object.isFrozen(h)).toBe(true);
    expect(Object.is(decodeFloat64(h, meter), value)).toBe(true);
    expect(meter.used).toBe(before + quoteBlock("float64-encode", 1, 0) + quoteBlock("float64-decode", 1, 0));
    finishA2(ticket);
    owner.close();
  });

  it("pays one batch reservation without per-H envelope debit", () => {
    const { meter, owner, ticket } = open(), before = meter.used;
    const block = reserveBlock(ticket, "float64-decode", 3, 0);
    beginBlock(meter, block, "float64-decode");
    expect(blockMeters(meter, block)).toBe(meter);
    expect(Reflect.ownKeys(blockMeters(meter, block))).toEqual(["limit", "used"]);
    const value = scalars.encodeOwnedNumber(.5);
    for (let index = 0; index < 3; index++) expect(decodeFloat64(value, meter)).toBe(.5);
    expect(meter.used).toBe(before + quoteBlock("float64-decode", 3, 0));
    finishBlock(meter, block);
    finishA2(ticket);
    owner.close();
  });

  it("rejects cloned block tickets and mismatched meters before any ticket getters", () => {
    const { meter, ticket, owner } = open(), block = reserveBlock(ticket, "float64-decode", 1, 0);
    beginBlock(meter, block, "float64-decode");
    const input = hostile();
    expect(() => blockMeters(input.value, block)).toThrow("PROVENANCE");
    expect(input.trap).not.toHaveBeenCalled();
    expect(() => blockMeters(meter, input.value as never)).toThrow("TICKET");
    expect(input.trap).not.toHaveBeenCalled();
    expect(() => owner.armInitialize()).toThrow("LIFECYCLE");
  });

  it("rejects raw H/proxy/clones after paying but before their getters", () => {
    const h = scalars.encodeOwnedNumber(.5), input = hostile();
    for (const value of [{ hex: h.hex }, Object.freeze({ hex: h.hex }), structuredClone(h), input.value]) {
      const { meter, owner } = open(), before = meter.used;
      expect(() => decodeFloat64(value, meter)).toThrow("PROVENANCE");
      expect(meter.used).toBe(before + quoteBlock("float64-decode", 1, 0));
      expect(() => owner.armEncode()).toThrow("LIFECYCLE");
    }
    expect(input.trap).not.toHaveBeenCalled();
  });

  it("validates using an owned receipt without reconstructing or aliasing numeric storage", () => {
    const { meter, owner, ticket } = open(), h = scalars.encodeOwnedNumber(.5), before = meter.used;
    expect(validateFloat64(h, meter, "$", 0, 1)).toBe(h);
    expect(meter.used).toBe(before + quoteBlock("float64-validate", 1, 0));
    finishA2(ticket);
    owner.close();
  });

  it("retains full invoices and latches numeric failures", () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      const { meter, owner } = open(), before = meter.used;
      expect(() => encodeFloat64(value, meter)).toThrow("NONFINITE");
      expect(meter.used).toBe(before + quoteBlock("float64-encode", 1, 0));
      expect(() => owner.armReadout()).toThrow("LIFECYCLE");
    }
    const invalid = open();
    expect(() => positiveProduct(Number.MIN_VALUE, .5, invalid.meter, "$.product")).toThrow("NUMERIC");
    expect(() => charge(invalid.meter, 1, "$")).toThrow("LIFECYCLE");
  });

  it("retains a helper's original reentry error when cleanup also rejects", () => {
    const { meter, owner, ticket } = open(), before = meter.used;
    let original: unknown, reported: unknown;
    const effect = vi.spyOn(scalars, "encodeOwnedNumber").mockImplementation(() => {
      try { owner.armEncode(); } catch (error) { original = error; throw error; }
      throw new Error("missing reentry failure");
    });
    try {
      try { encodeFloat64(.5, meter); } catch (error) { reported = error; }
      expect(reported).toBe(original);
      expect((reported as ContractError).code).toBe("LIFECYCLE");
      expect(meter.used).toBe(before + quoteBlock("float64-encode", 1, 0));
      expect(() => closeCore(meter, ticket, reported)).toThrow(reported as Error);
      expect(effect).toHaveBeenCalledTimes(1);
    } finally { effect.mockRestore(); }
  });

  it("fails reservation before real Float64 helper effects and preserves prior charges", () => {
    const { meter, ticket } = open();
    consumeWorkBlock(meter, "scalar", 1048576 - meter.used - 128);
    const encode = vi.spyOn(scalars, "encodeOwnedNumber"), decode = vi.spyOn(scalars, "decodeOwnedNumber");
    const before = meter.used;
    try {
      expect(() => encodeFloat64(.5, meter)).toThrow("WORK_CAP");
      expect(encode).not.toHaveBeenCalled();
      expect(decode).not.toHaveBeenCalled();
      expect(meter.used).toBe(before);
      expect(() => finishA2(ticket)).toThrow("TICKET");
    } finally { encode.mockRestore(); decode.mockRestore(); }
  });

  it("fails before proportional vector allocation", () => {
    const { meter } = open();
    consumeWorkBlock(meter, "scalar", 1048576 - meter.used - 128);
    const Native = Float64Array, effects = vi.fn();
    vi.stubGlobal("Float64Array", new Proxy(Native, { construct(target, args) { effects(); return Reflect.construct(target, args); } }));
    try {
      expect(() => allocateFloat64(418, meter, "$.vector")).toThrow("WORK_CAP");
      expect(effects).not.toHaveBeenCalled();
      expect(meter.used).toBe(1048576);
    } finally { vi.unstubAllGlobals(); }
  });

  it("does not waive a full paid Float64 batch that exceeds the work cap", () => {
    const { meter, ticket } = open(), before = meter.used;
    expect(() => reserveBlock(ticket, "float64-decode", 7501, 0)).toThrow("WORK_CAP");
    expect(meter.used).toBe(before);
  });

  it("preserves originating diagnostics when cleanup encounters latched failure", () => {
    const { meter, ticket } = open();
    let original: unknown, reported: unknown;
    try { fail("$.origin", "NUMERIC"); } catch (error) { original = error; }
    try { closeCore(meter, ticket, original); } catch (error) { reported = error; }
    expect(reported).toBe(original);
    expect(reported).toBeInstanceOf(ContractError);
    expect((reported as ContractError).path).toBe("$.origin");
    expect(Object.getOwnPropertyDescriptor(reported, "name")?.value).toBe("ContractError");
    expect(classifyEconomicFailure(reported)).toBe("infrastructure");
    const foreign = Object.defineProperty(new Error("not economic"), "name", { get() { throw new Error("name effect"); } });
    expect(classifyEconomicFailure(foreign)).toBeNull();
  });

  it("classifies the original owned ingress failure through its own native Error name", () => {
    const { meter, ticket } = open();
    let original: unknown;
    try { decodeFloat64({ hex: "3fe0000000000000" }, meter); } catch (error) { original = error; }
    expect(classifyEconomicFailure(original)).toBe("infrastructure");
    expect(Object.getOwnPropertyDescriptor(original, "name")?.value).toBe("OwnedIngressError");
    expect(() => closeCore(meter, ticket, original)).toThrow(original as Error);
  });

  it("charges new R4 scalar work separately inside prepaid ingress", () => {
    const { meter, owner } = createPlanningLedger();
    owner.admitOnce();
    const ingress = owner.beginR3Node(), before = meter.used;
    charge(meter, 20, "$.reconstruction");
    expect(meter.used).toBe(before + 148);
    consumeWorkBlock(meter, "r3-node", 1);
    expect(meter.used).toBe(before + 148);
    owner.finishIngress(ingress);
    owner.close();
  });

  it("requires an active transaction even for meter validation and zero charge", () => {
    const { meter, ticket, owner } = open();
    expect(validateMeter(meter)).toBe(meter);
    charge(meter, 0, "$");
    finishA2(ticket);
    expect(() => validateMeter(meter)).toThrow("LIFECYCLE");
    expect(() => owner.armReadout()).toThrow("LIFECYCLE");
  });

  it("typechecks only the planning source/tests and their canonical closure", () => {
    const configPath = fileURLToPath(new URL("../../tsconfig.json", import.meta.url));
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
    const roots = [
      "../economic/ownedKernel.ts", "../economic/ownedGuards.ts", "../economic/invoices.ts", "../economic/work.ts", "../economic/float64.ts",
      "./planningLedger.test.ts", "./planningWork.test.ts",
    ].map(path => fileURLToPath(new URL(path, import.meta.url)));
    const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram(roots, parsed.options))
      .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
    expect(diagnostics.map(diagnostic => `${diagnostic.file?.fileName}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`)).toEqual([]);
  });
});
