// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { ConstructionAccountingError } from "../economic/accountingPrimitives";
import * as kernel from "../economic/ownedKernel";
import * as scalars from "../economic/ownedScalars";
import * as accounting from "../coordinator/constructionAccounting";
import * as accounted from "../coordinator/accountedConstruction";
import type { ConstructionBlockId } from "../coordinator/constructionInvoices";

const HASH = "a".repeat(64);
const CAP = 1048576;
const INITIAL = 2048 + 512 + 512 + 512;
const ENVELOPE_AND_GATE = 1024 + 512;
const openAccount = (): accounting.ConstructionAccount => {
  const account = accounting.createConstructionAccount();
  account.owner.enterOnce();
  return account;
};
const hostile = (target: object = {}) => {
  const trap = vi.fn(() => { throw new Error("caller inspection"); });
  return { value: new Proxy(target, { get: trap, set: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap }), trap };
};
const watchHelpers = () => [
  vi.spyOn(kernel, "constructFloat64Hex"), vi.spyOn(scalars, "encodeOwnedNumber"),
  vi.spyOn(scalars, "decodeOwnedNumber"), vi.spyOn(kernel, "constructRef"),
  vi.spyOn(scalars, "equalOwnedRefs"), vi.spyOn(kernel, "constructCanonicalOpening"),
];
type Operation = Readonly<{ block: ConstructionBlockId; units: number; invoke(account: unknown): unknown }>;
const realOperations = (): Operation[] => {
  const float = kernel.constructFloat64Hex("3fe0000000000000");
  const ref = kernel.constructRef(Number.MAX_SAFE_INTEGER, HASH);
  return [
    { block: "float64-construct", units: 1352, invoke: account => accounted.accountedConstructFloat64(account, "3fe0000000000000") },
    { block: "float64-encode", units: 2168, invoke: account => accounted.accountedEncodeNumber(account, .5) },
    { block: "float64-decode", units: 1880, invoke: account => accounted.accountedDecodeNumber(account, float) },
    { block: "ref-construct", units: 4672, invoke: account => accounted.accountedConstructRef(account, Number.MAX_SAFE_INTEGER, HASH) },
    { block: "ref-equal", units: 736, invoke: account => accounted.accountedEqualRefs(account, ref, ref) },
    { block: "opening-construct", units: 1528, invoke: account => accounted.accountedCanonicalOpening(account) },
  ];
};

describe("private accounted construction", () => {
  it.each([0, -0, .5, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE])("round-trips finite binary64 with permanent fixed invoices: %s", value => {
    const account = openAccount();
    expect(account.meter.used).toBe(INITIAL);
    const encoded = accounted.accountedEncodeNumber(account, value);
    expect(kernel.requireFloat64Hex(encoded)).toBe(encoded);
    expect(Object.isFrozen(encoded)).toBe(true);
    expect(Object.is(accounted.accountedDecodeNumber(account, encoded), value)).toBe(true);
    expect(account.meter.used).toBe(INITIAL + 2168 + 1880 + 2 * ENVELOPE_AND_GATE);
    account.owner.finish();
    expect(account.meter.used).toBe(INITIAL + 2168 + 1880 + 2 * ENVELOPE_AND_GATE);
  });

  it("constructs signed zero, maximum-safe references and the canonical detached opening", () => {
    const account = openAccount();
    const zero = accounted.accountedConstructFloat64(account, "8000000000000000");
    expect(Object.is(accounted.accountedDecodeNumber(account, zero), -0)).toBe(true);
    const first = accounted.accountedConstructRef(account, Number.MAX_SAFE_INTEGER, HASH);
    const same = accounted.accountedConstructRef(account, Number.MAX_SAFE_INTEGER, HASH);
    const differentLength = accounted.accountedConstructRef(account, 0, HASH);
    const differentHash = accounted.accountedConstructRef(account, Number.MAX_SAFE_INTEGER, "b".repeat(64));
    expect(kernel.requireRef(first)).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(accounted.accountedEqualRefs(account, first, same)).toBe(true);
    expect(accounted.accountedEqualRefs(account, first, differentLength)).toBe(false);
    expect(accounted.accountedEqualRefs(account, first, differentHash)).toBe(false);
    const opening = accounted.accountedCanonicalOpening(account);
    expect(kernel.requireOpening(opening)).toBe(opening);
    expect(opening).toEqual({
      version: "starchess-economic-opening-v1", turn: 0,
      bank: { w: 3, b: 3 }, cc: { w: "e1", b: "e8" },
      marines: { w: ["c2", "d2", "e2", "f2"], b: ["c7", "d7", "e7", "f7"] },
    });
    for (const value of [opening, opening.bank, opening.cc, opening.marines, opening.marines.w, opening.marines.b]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    const second = accounted.accountedCanonicalOpening(account);
    expect(second).not.toBe(opening);
    expect(second.marines.w).not.toBe(opening.marines.w);
    expect(account.meter.used).toBe(INITIAL + 1352 + 1880 + 4 * 4672 + 3 * 736 + 2 * 1528 + 11 * ENVELOPE_AND_GATE);
    account.owner.finish();
  });

  it("authenticates accounts before reading debit or executing any owned helper", () => {
    const operations = realOperations(), account = openAccount();
    const proxied = hostile(account), raw = hostile();
    const getter = vi.fn(() => { throw new Error("caller debit"); });
    const fake = Object.defineProperty({}, "debit", { get: getter });
    const observers = watchHelpers();
    try {
      for (const operation of operations) {
        for (const value of [null, undefined, {}, { ...account }, fake, proxied.value, raw.value]) {
          expect(() => operation.invoke(value)).toThrow("PROVENANCE");
        }
      }
      expect(getter).not.toHaveBeenCalled();
      expect(proxied.trap).not.toHaveBeenCalled();
      expect(raw.trap).not.toHaveBeenCalled();
      for (const observer of observers) expect(observer).not.toHaveBeenCalled();
      expect(account.meter.used).toBe(INITIAL);
    } finally { observers.forEach(observer => observer.mockRestore()); }
  });

  it("reserves and begins before the helper and finishes only after its return", () => {
    const account = openAccount(), events: string[] = [];
    const originalBegin = accounting.beginConstructionTicket, originalFinish = accounting.finishConstructionTicket;
    const originalHelper = kernel.constructFloat64Hex;
    const begin = vi.spyOn(accounting, "beginConstructionTicket").mockImplementation((...args) => {
      expect(account.meter.used).toBe(INITIAL + 1352 + ENVELOPE_AND_GATE);
      originalBegin(...args);
      events.push("begun");
    });
    const helper = vi.spyOn(kernel, "constructFloat64Hex").mockImplementation(hex => {
      events.push("helper-enter");
      const result = originalHelper(hex);
      events.push("helper-return");
      return result;
    });
    const finish = vi.spyOn(accounting, "finishConstructionTicket").mockImplementation((...args) => {
      events.push("finish");
      originalFinish(...args);
    });
    try {
      expect(accounted.accountedConstructFloat64(account, "3fe0000000000000").hex).toBe("3fe0000000000000");
      expect(events).toEqual(["begun", "helper-enter", "helper-return", "finish"]);
      account.owner.finish();
    } finally { begin.mockRestore(); helper.mockRestore(); finish.mockRestore(); }
  });

  it("preserves the source failure, aborts its ticket and never refunds a short input", () => {
    for (const hex of ["", "g000000000000000", "000000000000000g", "7ff0000000000000"]) {
      const account = openAccount(), events: string[] = [];
      const originalHelper = kernel.constructFloat64Hex, originalAbort = accounting.abortConstructionTicket;
      let sourceError: unknown;
      const helper = vi.spyOn(kernel, "constructFloat64Hex").mockImplementation(value => {
        events.push("helper");
        try { return originalHelper(value); }
        catch (error) { sourceError = error; throw error; }
      });
      const abort = vi.spyOn(accounting, "abortConstructionTicket").mockImplementation((...args) => {
        events.push("abort");
        originalAbort(...args);
      });
      try {
        let reported: unknown;
        try { accounted.accountedConstructFloat64(account, hex); }
        catch (error) { reported = error; }
        expect(sourceError).toBeInstanceOf(Error);
        expect(reported).toBe(sourceError);
        expect((reported as Error).message).toBe("FLOAT64");
        expect(events).toEqual(["helper", "abort"]);
        expect(account.meter.used).toBe(INITIAL + 1352 + ENVELOPE_AND_GATE);
        expect(() => accounted.accountedConstructFloat64(account, "0000000000000000")).toThrow("LIFECYCLE");
        expect(helper).toHaveBeenCalledTimes(1);
        expect(() => account.owner.finish()).toThrow("LIFECYCLE");
        expect(account.meter.used).toBe(INITIAL + 1352 + ENVELOPE_AND_GATE);
      } finally { helper.mockRestore(); abort.mockRestore(); }
    }
  });

  it("preserves a latched reentry exception when ticket cleanup also rejects", () => {
    const account = openAccount();
    let original: unknown, reported: unknown;
    const helper = vi.spyOn(scalars, "encodeOwnedNumber").mockImplementation(() => {
      try { account.owner.enterOnce(); }
      catch (error) { original = error; throw error; }
      throw new Error("missing reentry rejection");
    });
    try {
      try { accounted.accountedEncodeNumber(account, .5); } catch (error) { reported = error; }
      expect(original).toBeInstanceOf(ConstructionAccountingError);
      expect((original as ConstructionAccountingError).code).toBe("LIFECYCLE");
      expect(reported).toBe(original);
      expect(account.meter.used).toBe(INITIAL + 2168 + ENVELOPE_AND_GATE);
      expect(() => accounted.accountedEncodeNumber(account, .5)).toThrow("LIFECYCLE");
      expect(helper).toHaveBeenCalledTimes(1);
    } finally { helper.mockRestore(); }
  });

  it("charges full reference invoices for short, early-invalid and late-invalid hashes", () => {
    for (const hash of ["", "a".repeat(63), `g${"a".repeat(63)}`, `${"a".repeat(63)}g`]) {
      const account = openAccount();
      expect(() => accounted.accountedConstructRef(account, 0, hash)).toThrow("REF");
      expect(account.meter.used).toBe(INITIAL + 4672 + ENVELOPE_AND_GATE);
      expect(() => accounted.accountedCanonicalOpening(account)).toThrow("LIFECYCLE");
    }
    for (const byteLength of [0, Number.MAX_SAFE_INTEGER]) {
      const account = openAccount();
      accounted.accountedConstructRef(account, byteLength, HASH);
      expect(account.meter.used).toBe(INITIAL + 4672 + ENVELOPE_AND_GATE);
      account.owner.finish();
    }
  });

  it("rejects invalid numeric sources and closes their accounts without a refund", () => {
    for (const number of [NaN, Infinity, -Infinity, {}]) {
      const account = openAccount();
      expect(() => accounted.accountedEncodeNumber(account, number as number)).toThrow("FLOAT64");
      expect(account.meter.used).toBe(INITIAL + 2168 + ENVELOPE_AND_GATE);
      expect(() => accounted.accountedCanonicalOpening(account)).toThrow("LIFECYCLE");
    }
  });

  it("rejects raw, copied, wrong-role and proxy operands before their traps", () => {
    const float = kernel.constructFloat64Hex("3fe0000000000000"), ref = kernel.constructRef(0, HASH);
    const opening = kernel.constructCanonicalOpening(), proxiedFloat = hostile(float), raw = hostile();
    for (const value of [{ hex: float.hex }, Object.freeze({ hex: float.hex }), structuredClone(float), ref, opening, proxiedFloat.value, raw.value]) {
      const account = openAccount();
      expect(() => accounted.accountedDecodeNumber(account, value)).toThrow("PROVENANCE");
      expect(account.meter.used).toBe(INITIAL + 1880 + ENVELOPE_AND_GATE);
      expect(() => accounted.accountedCanonicalOpening(account)).toThrow("LIFECYCLE");
    }
    const proxiedRef = hostile(ref);
    for (const value of [{ ...ref }, Object.freeze({ ...ref }), float, opening, proxiedRef.value, raw.value]) {
      for (const operands of [[value, ref], [ref, value]]) {
        const account = openAccount();
        expect(() => accounted.accountedEqualRefs(account, operands[0], operands[1])).toThrow("PROVENANCE");
        expect(account.meter.used).toBe(INITIAL + 736 + ENVELOPE_AND_GATE);
      }
    }
    for (const invoke of [
      (account: unknown) => accounted.accountedConstructFloat64(account, raw.value as unknown as string),
      (account: unknown) => accounted.accountedEncodeNumber(account, raw.value as unknown as number),
      (account: unknown) => accounted.accountedConstructRef(account, raw.value as unknown as number, HASH),
      (account: unknown) => accounted.accountedConstructRef(account, 0, raw.value as unknown as string),
    ]) expect(() => invoke(openAccount())).toThrow();
    expect(proxiedFloat.trap).not.toHaveBeenCalled();
    expect(proxiedRef.trap).not.toHaveBeenCalled();
    expect(raw.trap).not.toHaveBeenCalled();
  });

  it("exhausts every real catalog block before invoking an unaffordable helper", () => {
    for (const operation of realOperations()) {
      const account = openAccount(), observers = watchHelpers();
      const invoice = operation.units + ENVELOPE_AND_GATE;
      const count = Math.floor((CAP - INITIAL) / invoice);
      try {
        for (let index = 0; index < count; index++) {
          operation.invoke(account);
          expect(account.meter.used).toBe(INITIAL + (index + 1) * invoice);
        }
        const before = observers.map(observer => observer.mock.calls.length);
        expect(before.some(calls => calls > 0)).toBe(true);
        expect(CAP - account.meter.used).toBeLessThan(invoice);
        expect(() => operation.invoke(account)).toThrow("WORK_CAP");
        expect(observers.map(observer => observer.mock.calls.length)).toEqual(before);
        expect(account.meter.used).toBe(INITIAL + count * invoice);
        expect(account.meter.used).toBeLessThanOrEqual(CAP);
        expect(() => operation.invoke(account)).toThrow("LIFECYCLE");
        expect(observers.map(observer => observer.mock.calls.length)).toEqual(before);
      } finally { observers.forEach(observer => observer.mockRestore()); }
    }
  });

  it("independently observes physical helper effects in one isolated canonical module graph", async () => {
    type LaneInitialization = { sourceLength: number; sourceNullPrototype: boolean; sourceOwnNames: string[]; ownSlots: number; emptySlots: number };
    type Effects = {
      allocations: number[]; views: object[]; lanes: LaneInitialization[]; digitArrays: unknown[];
      byteReads: number; byteWrites: number; binaryReads: number; binaryWrites: number;
      characterReads: number; joins: number; frozen: unknown[]; receipts: object[];
      roles: string[]; receiptLookups: number;
    };
    const empty = (): Effects => ({
      allocations: [], views: [], lanes: [], digitArrays: [], byteReads: 0, byteWrites: 0,
      binaryReads: 0, binaryWrites: 0, characterReads: 0, joins: 0, frozen: [], receipts: [], roles: [], receiptLookups: 0,
    });
    let effects = empty(), active = false, discovering = false;
    let receiptMap: WeakMap<object, unknown> | undefined;
    const nativeApply = Reflect.apply, nativeConstruct = Reflect.construct, nativeFreeze = Object.freeze;
    const nativeFrom = Array.from, nativeGet = WeakMap.prototype.get, nativeSet = WeakMap.prototype.set;
    const nativeGetByte = DataView.prototype.getUint8, nativePutByte = DataView.prototype.setUint8;
    const nativeGetNumber = DataView.prototype.getFloat64, nativePutNumber = DataView.prototype.setFloat64;
    const nativeCharacter = String.prototype.charCodeAt, nativeJoin = Array.prototype.join;
    const NativeArrayBuffer = ArrayBuffer, NativeDataView = DataView;
    const restores: Array<() => void> = [];
    const watch = <T extends { mockRestore(): void }>(observer: T): T => {
      restores.push(() => observer.mockRestore());
      return observer;
    };
    vi.stubGlobal("ArrayBuffer", new Proxy(NativeArrayBuffer, {
      construct(target, args) {
        if (active && typeof args[0] === "number") effects.allocations.push(args[0]);
        return nativeConstruct(target, args);
      },
    }));
    vi.stubGlobal("DataView", new Proxy(NativeDataView, {
      construct(target, args) {
        const view = nativeConstruct(target, args);
        if (active) effects.views.push(view);
        return view;
      },
    }));
    watch(vi.spyOn(Object, "freeze").mockImplementation(value => {
      if (active) effects.frozen.push(value);
      return nativeFreeze(value);
    }));
    watch(vi.spyOn(WeakMap.prototype, "get").mockImplementation(function (this: WeakMap<object, unknown>, key: object) {
      if (active && this === receiptMap) effects.receiptLookups++;
      return nativeApply(nativeGet, this, [key]);
    }));
    watch(vi.spyOn(WeakMap.prototype, "set").mockImplementation(function (this: WeakMap<object, unknown>, key: object, value: unknown) {
      if (discovering && value === "ref") receiptMap = this;
      if (active && this === receiptMap) {
        effects.receipts.push(key);
        effects.roles.push(value as string);
      }
      return nativeApply(nativeSet, this, [key, value]);
    }));
    watch(vi.spyOn(Array, "from").mockImplementation(function (this: unknown, ...args: unknown[]) {
      const result = nativeApply(nativeFrom, this, args) as unknown[];
      if (active) {
        const source = args[0] as { length: number };
        let ownSlots = 0, emptySlots = 0;
        for (let index = 0; index < result.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(result, String(index));
          if (descriptor && "value" in descriptor) {
            ownSlots++;
            if (descriptor.value === "") emptySlots++;
          }
        }
        effects.lanes.push({
          sourceLength: source.length, sourceNullPrototype: Object.getPrototypeOf(source) === null,
          sourceOwnNames: Object.getOwnPropertyNames(source), ownSlots, emptySlots,
        });
        effects.digitArrays.push(result);
      }
      return result;
    }));
    watch(vi.spyOn(DataView.prototype, "getUint8").mockImplementation(function (this: DataView, offset: number) {
      if (active && effects.views.includes(this)) effects.byteReads++;
      return nativeApply(nativeGetByte, this, [offset]);
    }));
    watch(vi.spyOn(DataView.prototype, "setUint8").mockImplementation(function (this: DataView, offset: number, value: number) {
      if (active && effects.views.includes(this)) effects.byteWrites++;
      return nativeApply(nativePutByte, this, [offset, value]);
    }));
    watch(vi.spyOn(DataView.prototype, "getFloat64").mockImplementation(function (this: DataView, offset: number, littleEndian?: boolean) {
      if (active && effects.views.includes(this)) effects.binaryReads++;
      return nativeApply(nativeGetNumber, this, [offset, littleEndian]);
    }));
    watch(vi.spyOn(DataView.prototype, "setFloat64").mockImplementation(function (this: DataView, offset: number, value: number, littleEndian?: boolean) {
      if (active && effects.views.includes(this)) effects.binaryWrites++;
      return nativeApply(nativePutNumber, this, [offset, value, littleEndian]);
    }));
    watch(vi.spyOn(String.prototype, "charCodeAt").mockImplementation(function (this: string, index: number) {
      if (active) effects.characterReads++;
      return nativeApply(nativeCharacter, this, [index]);
    }));
    watch(vi.spyOn(Array.prototype, "join").mockImplementation(function (this: unknown, separator?: string) {
      if (active && effects.digitArrays.includes(this)) effects.joins++;
      return nativeApply(nativeJoin, this, [separator]);
    }));
    try {
      vi.resetModules();
      const isolatedKernel = await import("../economic/ownedKernel");
      const isolatedAccounting = await import("../coordinator/constructionAccounting");
      const isolated = await import("../coordinator/accountedConstruction");
      discovering = true;
      isolatedKernel.constructRef(0, HASH);
      discovering = false;
      expect(receiptMap).toBeDefined();
      effects = empty();
      const account = isolatedAccounting.createConstructionAccount();
      account.owner.enterOnce();
      const measure = <T>(operation: () => T): { value: T; observed: Effects } => {
        effects = empty();
        active = true;
        try { return { value: operation(), observed: effects }; }
        finally { active = false; }
      };
      const summary = (observed: Effects) => ({
        allocationBytes: observed.allocations,
        metadataViews: observed.views.length,
        byteReads: observed.byteReads, byteWrites: observed.byteWrites,
        binaryReads: observed.binaryReads, binaryWrites: observed.binaryWrites,
        characterReads: observed.characterReads, joins: observed.joins,
        publications: observed.receipts.length,
        publicationFreezes: observed.receipts.reduce((count, value) => count + observed.frozen.filter(target => target === value).length, 0),
        receiptLookups: observed.receiptLookups,
      });
      const baseline = {
        allocationBytes: [], metadataViews: 0, byteReads: 0, byteWrites: 0, binaryReads: 0, binaryWrites: 0,
        characterReads: 0, joins: 0, publications: 0, publicationFreezes: 0, receiptLookups: 0,
      };
      const constructed = measure(() => isolated.accountedConstructFloat64(account, "8000000000000000"));
      expect(constructed.value.hex).toBe("8000000000000000");
      expect(summary(constructed.observed)).toEqual({ ...baseline, characterReads: 16, publications: 1, publicationFreezes: 1 });
      const encoded = measure(() => isolated.accountedEncodeNumber(account, .5));
      expect(encoded.value.hex).toBe("3fe0000000000000");
      expect(summary(encoded.observed)).toEqual({
        ...baseline, allocationBytes: [8], metadataViews: 1, byteReads: 8, binaryWrites: 1,
        characterReads: 0, joins: 1, publications: 1, publicationFreezes: 1,
      });
      expect(encoded.observed.lanes).toEqual([
        { sourceLength: 16, sourceNullPrototype: true, sourceOwnNames: ["length"], ownSlots: 16, emptySlots: 16 },
      ]);
      const decoded = measure(() => isolated.accountedDecodeNumber(account, encoded.value));
      expect(decoded.value).toBe(.5);
      expect(summary(decoded.observed)).toEqual({
        ...baseline, allocationBytes: [8], metadataViews: 1, byteWrites: 8, binaryReads: 1, characterReads: 16, receiptLookups: 1,
      });
      const ref = measure(() => isolated.accountedConstructRef(account, Number.MAX_SAFE_INTEGER, HASH));
      expect(ref.value.byteLength).toBe(Number.MAX_SAFE_INTEGER);
      expect(summary(ref.observed)).toEqual({ ...baseline, characterReads: 64, publications: 1, publicationFreezes: 1 });
      expect(ref.observed.roles).toEqual(["ref"]);
      const equal = measure(() => isolated.accountedEqualRefs(account, ref.value, ref.value));
      expect(equal.value).toBe(true);
      expect(summary(equal.observed)).toEqual({ ...baseline, receiptLookups: 2 });
      const opening = measure(() => isolated.accountedCanonicalOpening(account));
      expect(summary(opening.observed)).toEqual({ ...baseline, publications: 6, publicationFreezes: 6 });
      expect(opening.observed.roles).toEqual(["bank", "cc", "white-marines", "black-marines", "marines", "opening"]);
      expect(opening.observed.receipts.map(value => Object.getOwnPropertyNames(value).length)).toEqual([2, 2, 5, 5, 2, 5]);
      expect(new Set(opening.observed.receipts).size).toBe(6);
      expect(opening.value.marines.w).toEqual(["c2", "d2", "e2", "f2"]);
      expect(account.meter.used).toBe(INITIAL + 1352 + 2168 + 1880 + 4672 + 736 + 1528 + 6 * ENVELOPE_AND_GATE);
      account.owner.finish();

      const exhausted = isolatedAccounting.createConstructionAccount();
      exhausted.owner.enterOnce();
      const invoice = 2168 + ENVELOPE_AND_GATE;
      const count = Math.floor((CAP - INITIAL) / invoice);
      for (let index = 0; index < count; index++) isolated.accountedEncodeNumber(exhausted, .5);
      effects = empty();
      active = true;
      let rejection: unknown;
      try { isolated.accountedEncodeNumber(exhausted, .5); }
      catch (error) { rejection = error; }
      finally { active = false; }
      expect(rejection).toBeInstanceOf(Error);
      expect((rejection as Error).message).toBe("WORK_CAP");
      expect(summary(effects)).toEqual(baseline);
      expect(effects.frozen).toEqual([]);
      expect(effects.lanes).toEqual([]);
      expect(exhausted.meter.used).toBe(INITIAL + count * invoice);
    } finally {
      active = false;
      discovering = false;
      restores.reverse().forEach(restore => restore());
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it("keeps only the six fixed wrappers and canonical private source imports", () => {
    expect(Object.keys(accounted).sort()).toEqual([
      "accountedCanonicalOpening", "accountedConstructFloat64", "accountedConstructRef",
      "accountedDecodeNumber", "accountedEncodeNumber", "accountedEqualRefs",
    ]);
    const source = readFileSync(new URL("../coordinator/accountedConstruction.ts", import.meta.url), "utf8");
    const ast = ts.createSourceFile("accountedConstruction.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    const imports = ast.statements.filter(ts.isImportDeclaration).map(statement => {
      expect(ts.isStringLiteral(statement.moduleSpecifier)).toBe(true);
      return (statement.moduleSpecifier as ts.StringLiteral).text;
    });
    expect(imports.sort()).toEqual([
      "../economic/ownedKernel", "../economic/ownedScalars", "./constructionAccounting", "./constructionInvoices",
    ].sort());
    const inspect = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) expect(node.expression.kind).not.toBe(ts.SyntaxKind.ImportKeyword);
      ts.forEachChild(node, inspect);
    };
    inspect(ast);
    expect(source.split("\n")[0]).toBe("// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml");
    const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(manifest.exports).toEqual({ "./candidates": "./src/candidates.ts" });
  });

  it("typechecks the assigned construction source/tests and their canonical import closure", () => {
    const path = fileURLToPath(new URL("../../tsconfig.json", import.meta.url));
    const config = ts.readConfigFile(path, ts.sys.readFile);
    expect(config.error).toBeUndefined();
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(path));
    expect(parsed.errors).toEqual([]);
    const roots = [
      "../coordinator/constructionInvoices.ts", "../coordinator/accountedConstruction.ts",
      "./constructionInvoices.test.ts", "./accountedConstruction.test.ts",
    ].map(file => fileURLToPath(new URL(file, import.meta.url)));
    const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram(roots, parsed.options))
      .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
    expect(diagnostics.map(diagnostic => `${diagnostic.file?.fileName}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`)).toEqual([]);
  });
});
