// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ConstructionAccountingError } from "../economic/accountingPrimitives";
import * as invoices from "../coordinator/constructionInvoices";
import { quoteConstructionBlock, type ConstructionBlockId } from "../coordinator/constructionInvoices";

const invocation = (arity: number): number => 32 + 8 * arity;
const record = (slots: number): number => 32 + 8 * slots;
const freeze = (slots: number): number => 64 + 16 * slots;
const publication = (slots: number): number => record(slots) + freeze(slots) + 32 + 32;
const scan = (characters: number): number => 48 + characters * (invocation(1) + 4 + 24);
const lanes = (count: number): number => 96 + 32 * count;
const joining = (count: number): number => 64 + 16 * count;
const float64Construction = 32 + scan(16) + publication(1);
const expected: Readonly<Record<ConstructionBlockId, number>> = {
  "float64-construct": float64Construction,
  "float64-encode": 64 + 40 + 32 + invocation(3) + 64 + record(1) + 32 + lanes(16)
    + 8 * (invocation(1) + 8 + 32) + invocation(1) + joining(16) + publication(1) + invocation(2),
  "float64-decode": 32 + 64 + 40 + 32 + 8 * (16 + 2 * (invocation(1) + 24) + invocation(2) + 8) + invocation(2) + 64,
  "ref-construct": 64 + scan(64) + publication(2),
  "ref-equal": 32 + 2 * 64 + 32 + (32 + 8 * 64),
  "opening-construct": 64 + 3 * publication(2) + 3 * publication(5),
};
const readSource = (file: string): string => readFileSync(new URL(`../${file}.ts`, import.meta.url), "utf8");

describe("closed construction invoices", () => {
  it("derives the disjoint primitive, initialization, publication and bounded-loop allowances", () => {
    expect([invocation(1), invocation(2), invocation(3)]).toEqual([40, 48, 56]);
    expect([record(1), freeze(1), publication(1), publication(2), publication(5)]).toEqual([40, 80, 184, 208, 280]);
    expect([scan(16), scan(64), lanes(16), joining(16)]).toEqual([1136, 4400, 608, 320]);
    expect(expected).toEqual({
      "float64-construct": 1352,
      "float64-encode": 2168,
      "float64-decode": 1880,
      "ref-construct": 4672,
      "ref-equal": 736,
      "opening-construct": 1528,
    });
    for (const block of Object.keys(expected) as ConstructionBlockId[]) {
      expect(quoteConstructionBlock(block)).toEqual({ block, units: expected[block] });
    }
  });

  it("returns the same fixed frozen quote with exactly two primitive fields", () => {
    for (const block of Object.keys(expected) as ConstructionBlockId[]) {
      const quote = quoteConstructionBlock(block);
      expect(quoteConstructionBlock(block)).toBe(quote);
      expect(Object.isFrozen(quote)).toBe(true);
      expect(Object.keys(quote).sort()).toEqual(["block", "units"]);
      expect(Number.isSafeInteger(quote.units)).toBe(true);
      expect(quote.units).toBeGreaterThan(0);
      expect(() => { (quote as { units: number }).units = 0; }).toThrow(TypeError);
      expect(quoteConstructionBlock(block).units).toBe(expected[block]);
    }
    expect(Object.keys(invoices)).toEqual(["quoteConstructionBlock"]);
  });

  it.each(["", "__proto__", "constructor", "toString", "float64", "float64-encode?", "ref-decode", "opening-encode", "parser-107", 0, -0, NaN, null, undefined, true, Symbol("float64-encode"), new String("float64-encode"), {}, [], () => "float64-encode"])(
    "rejects a noncatalog block without coercion: %s", value => {
      expect(() => quoteConstructionBlock(value)).toThrow(ConstructionAccountingError);
      expect(() => quoteConstructionBlock(value)).toThrow("INVOICE");
    },
  );

  it("rejects unknown, callable and revoked proxies without any trap", () => {
    const trap = vi.fn(() => { throw new Error("caller inspection"); });
    const traps = { get: trap, set: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap, apply: trap };
    const revoked = Proxy.revocable({}, traps);
    revoked.revoke();
    for (const value of [new Proxy({}, traps), new Proxy(() => "float64-encode", traps), revoked.proxy]) {
      expect(() => quoteConstructionBlock(value)).toThrow("INVOICE");
    }
    expect(trap).not.toHaveBeenCalled();
  });

  it("pins the audited scalar loop bounds and dense null-prototype digit initialization", () => {
    const kernel = readSource("economic/ownedKernel"), scalars = readSource("economic/ownedScalars");
    expect(kernel).toContain('lowerHex(hex, 16, "FLOAT64")');
    expect(kernel).toContain('lowerHex(sha256, 64, "REF")');
    expect(kernel).toContain("for (let i = 0; i < length; i++)");
    expect(kernel).toContain('typeof value !== "string" || value.length !== length');
    const encoder = kernel.slice(kernel.indexOf("export const constructOwnedNumber"), kernel.indexOf("const hNumber"));
    expect(encoder.match(/for \(let i = 0; i < 8; i\+\+\)/g)).toHaveLength(1);
    expect(scalars.match(/for \(let i = 0; i < 8; i\+\+\)/g)).toHaveLength(1);
    expect(scalars.match(/for \(let j = 0; j < 2; j\+\+\)/g)).toHaveLength(1);
    expect(encoder).toContain("const slots = { __proto__: null, length: 16 }");
    expect(encoder).toContain('dense(slots, () => "")');
    expect(encoder).not.toContain("constructFloat64Hex(");
    expect(encoder).toContain('publish({ hex: apply(joinDigits, digits, [""]) as string }, "float64")');
    expect(encoder + scalars).not.toMatch(/(?:new Array\(|Array\()16\)/);
    expect(encoder + scalars).not.toMatch(/\.(?:slice|map|filter|flatMap)\(/);
    const opening = kernel.slice(kernel.indexOf("export const constructCanonicalOpening"), kernel.indexOf("export const requireFloat64Hex"));
    expect(opening.match(/publish\(/g)).toHaveLength(6);
    expect(opening).toContain('["c2", "d2", "e2", "f2"]');
    expect(opening).toContain('["c7", "d7", "e7", "f7"]');
  });
});
