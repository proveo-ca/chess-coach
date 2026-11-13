// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it, vi } from "vitest";
import { CONSTRUCTION_WORK_CAP } from "../economic/accountingPrimitives";
import {
  beginConstructionTicket, finishConstructionTicket, abortConstructionTicket, createConstructionAccount,
  requireConstructionAccount, CONSTRUCTION_BOOTSTRAP_UNITS, CONSTRUCTION_GATE_UNITS,
  CONSTRUCTION_CLEANUP_UNITS, CONSTRUCTION_ENVELOPE_UNITS,
} from "../coordinator/constructionAccounting";
import { quoteConstructionBlock } from "../coordinator/constructionInvoices";
import { requireRef } from "../economic/ownedKernel";

const entered = () => { const account = createConstructionAccount(); account.owner.enterOnce(); return account; };
const bootstrap = () => CONSTRUCTION_BOOTSTRAP_UNITS + CONSTRUCTION_GATE_UNITS + CONSTRUCTION_CLEANUP_UNITS;
const defineFixture = (target: object, key: PropertyKey, descriptor: PropertyDescriptor & { __proto__: null }): void => {
  Object.defineProperty(target, key, descriptor);
};

describe("private unbound construction accounting", () => {
  it("constructs exact nonextensible storage with permanently prepaid bootstrap", () => {
    const account = createConstructionAccount();
    expect(Object.keys(account.meter)).toEqual(["limit", "used"]);
    expect(Object.isExtensible(account.meter)).toBe(false);
    expect(Object.getOwnPropertyDescriptor(account.meter, "limit")).toEqual({ value: CONSTRUCTION_WORK_CAP, writable: false, configurable: false, enumerable: true });
    expect(Object.getOwnPropertyDescriptor(account.meter, "used")).toEqual({ value: bootstrap(), writable: true, configurable: false, enumerable: true });
    expect(Object.isFrozen(account)).toBe(true);
    expect(Object.isFrozen(account.owner)).toBe(true);
    expect(Object.isFrozen(account.debit)).toBe(true);
    expect(requireConstructionAccount(account)).toBe(account);
    expect(() => requireRef(account.meter)).toThrow("PROVENANCE");
    account.owner.enterOnce();
    expect(account.meter.used).toBe(bootstrap() + CONSTRUCTION_GATE_UNITS);
  });

  it("reserves one closed operation/envelope/following gate without double charging consumption", () => {
    const account = entered(), before = account.meter.used;
    const ticket = account.debit.reserve("ref-equal");
    const after = before + quoteConstructionBlock("ref-equal").units + CONSTRUCTION_ENVELOPE_UNITS + CONSTRUCTION_GATE_UNITS;
    expect(account.meter.used).toBe(after);
    expect(Object.isFrozen(ticket)).toBe(true);
    beginConstructionTicket(account, ticket, "ref-equal");
    expect(account.meter.used).toBe(after);
    finishConstructionTicket(account, ticket);
    expect(account.meter.used).toBe(after);
    account.owner.finish();
    expect(account.meter.used).toBe(after);
    expect(() => account.debit.reserve("ref-equal")).toThrow("LIFECYCLE");
  });

  it("latches duplicate, nested and concurrent entry even if callers catch the error", () => {
    for (const phase of ["active", "reserved", "executing"] as const) {
      const account = entered();
      const ticket = phase === "active" ? undefined : account.debit.reserve("ref-equal");
      if (phase === "executing") beginConstructionTicket(account, ticket, "ref-equal");
      expect(() => account.owner.enterOnce()).toThrow("LIFECYCLE");
      expect(() => account.debit.reserve("ref-equal")).toThrow("LIFECYCLE");
      expect(() => account.owner.finish()).toThrow("LIFECYCLE");
    }
  });

  it("rejects reservation before entry and after abort without renewal", () => {
    const premature = createConstructionAccount();
    expect(() => premature.debit.reserve("ref-equal")).toThrow("LIFECYCLE");
    expect(() => premature.owner.enterOnce()).toThrow("LIFECYCLE");
    const account = entered(), used = account.meter.used;
    account.owner.abort();
    expect(() => account.owner.enterOnce()).toThrow("LIFECYCLE");
    expect(() => account.debit.reserve("ref-equal")).toThrow("LIFECYCLE");
    expect(account.meter.used).toBe(used);
  });

  it("rejects foreign, cloned, wrong-block and reused tickets", () => {
    const original = entered(), foreign = entered();
    const ticket = original.debit.reserve("ref-equal");
    expect(() => beginConstructionTicket(foreign, ticket, "ref-equal")).toThrow("TICKET");
    beginConstructionTicket(original, ticket, "ref-equal");
    finishConstructionTicket(original, ticket);
    expect(() => beginConstructionTicket(original, ticket, "ref-equal")).toThrow("TICKET");
    for (const use of ["clone", "block"] as const) {
      const account = entered(), token = account.debit.reserve("ref-equal");
      expect(() => beginConstructionTicket(account, use === "clone" ? { ...token } : token, use === "clone" ? "ref-equal" : "ref-construct")).toThrow("TICKET");
      expect(() => account.debit.reserve("ref-equal")).toThrow("LIFECYCLE");
    }
  });

  it("invalidates outstanding tickets on abort or premature finish", () => {
    const account = entered(), token = account.debit.reserve("ref-equal"), used = account.meter.used;
    account.owner.abort();
    expect(() => beginConstructionTicket(account, token, "ref-equal")).toThrow("TICKET");
    expect(account.meter.used).toBe(used);
    const premature = entered();
    premature.debit.reserve("ref-equal");
    expect(() => premature.owner.finish()).toThrow("LIFECYCLE");
    expect(() => premature.debit.reserve("ref-equal")).toThrow("LIFECYCLE");
  });

  it("aborts executing blocks without refund or continuation", () => {
    const account = entered(), token = account.debit.reserve("ref-equal");
    beginConstructionTicket(account, token, "ref-equal");
    const used = account.meter.used;
    abortConstructionTicket(account, token);
    expect(account.meter.used).toBe(used);
    expect(() => finishConstructionTicket(account, token)).toThrow("TICKET");
    expect(() => account.debit.reserve("ref-equal")).toThrow("LIFECYCLE");
  });

  it("detects observed usage tampering at reservation and terminal closure", () => {
    for (const stage of ["reserve", "finish"] as const) {
      const account = entered();
      account.meter.used = 0;
      expect(() => stage === "reserve" ? account.debit.reserve("ref-equal") : account.owner.finish()).toThrow("TAMPER");
      account.meter.used = bootstrap() + CONSTRUCTION_GATE_UNITS;
      expect(() => account.debit.reserve("ref-equal")).toThrow("LIFECYCLE");
    }
  });

  it("never interprets inherited descriptor hooks or restores a swallowed reentry failure", () => {
    const prior = new Map(["enumerable", "get", "set"].map(key => [key, Object.getOwnPropertyDescriptor(Object.prototype, key)]));
    let reads = 0, writes = 0, used = bootstrap(), account: ReturnType<typeof createConstructionAccount> | undefined;
    defineFixture(Object.prototype, "enumerable", {
      __proto__: null, configurable: true,
      get() {
        reads++;
        if (reads === 2) {
          defineFixture(Object.prototype, "get", { __proto__: null, configurable: true, value: () => used });
          defineFixture(Object.prototype, "set", {
            __proto__: null, configurable: true,
            value: (value: number) => {
              used = value;
              writes++;
              if (writes === 1 && account) { try { account.owner.enterOnce(); } catch {} }
            },
          });
        }
        return true;
      },
    });
    let descriptor: PropertyDescriptor | undefined;
    try {
      account = createConstructionAccount();
      account.owner.enterOnce();
      descriptor = Object.getOwnPropertyDescriptor(account.meter, "used");
    } finally {
      for (const key of ["get", "set", "enumerable"]) {
        const saved = prior.get(key);
        if (saved) defineFixture(Object.prototype, key, { __proto__: null, ...saved });
        else delete (Object.prototype as unknown as Record<string, unknown>)[key];
      }
    }
    expect(reads).toBe(0);
    expect(writes).toBe(0);
    expect(descriptor).toEqual({ value: bootstrap() + CONSTRUCTION_GATE_UNITS, writable: true, configurable: false, enumerable: true });
    account!.owner.finish();
  });

  it("rejects observed writability changes before reservation and final closure", () => {
    for (const stage of ["reserve", "finish"] as const) {
      const account = entered(), used = account.meter.used;
      Object.freeze(account.meter);
      expect(() => stage === "reserve" ? account.debit.reserve("ref-equal") : account.owner.finish()).toThrow("TAMPER");
      expect(account.meter.used).toBe(used);
      expect(() => account.owner.enterOnce()).toThrow("TAMPER");
    }
  });

  it("keeps fixed limit and initial usage despite an inherited descriptor value", () => {
    const prior = Object.getOwnPropertyDescriptor(Object.prototype, "value");
    defineFixture(Object.prototype, "value", { __proto__: null, configurable: true, value: 0 });
    let limit = 0, initial = 0;
    try {
      const account = createConstructionAccount();
      limit = account.meter.limit;
      initial = account.meter.used;
      account.owner.enterOnce();
      account.owner.finish();
    } finally {
      if (prior) defineFixture(Object.prototype, "value", { __proto__: null, ...prior });
      else delete (Object.prototype as unknown as Record<string, unknown>)["value"];
    }
    expect(limit).toBe(CONSTRUCTION_WORK_CAP);
    expect(initial).toBe(bootstrap());
  });

  it("rejects proxy accounts/tickets before any property or reflection trap", () => {
    const trap = vi.fn(() => { throw new Error("caller inspection"); });
    const account = entered(), token = account.debit.reserve("ref-equal");
    const proxy = new Proxy(account, { get: trap, ownKeys: trap, getPrototypeOf: trap, getOwnPropertyDescriptor: trap });
    expect(() => requireConstructionAccount(proxy)).toThrow("PROVENANCE");
    expect(() => beginConstructionTicket(proxy, token, "ref-equal")).toThrow("PROVENANCE");
    const proxyToken = new Proxy(token, { get: trap, ownKeys: trap });
    expect(() => beginConstructionTicket(account, proxyToken, "ref-equal")).toThrow("TICKET");
    expect(trap).not.toHaveBeenCalled();
  });

  it("exhausts through real catalog reservations without a draining block or tampered starting usage", () => {
    const account = entered();
    const invoice = quoteConstructionBlock("ref-equal").units + CONSTRUCTION_ENVELOPE_UNITS + CONSTRUCTION_GATE_UNITS;
    let performed = 0;
    while (account.meter.used + invoice <= CONSTRUCTION_WORK_CAP) {
      const token = account.debit.reserve("ref-equal");
      beginConstructionTicket(account, token, "ref-equal");
      finishConstructionTicket(account, token);
      performed++;
    }
    const used = account.meter.used;
    expect(performed).toBe(Math.floor((CONSTRUCTION_WORK_CAP - bootstrap() - CONSTRUCTION_GATE_UNITS) / invoice));
    expect(() => account.debit.reserve("ref-equal")).toThrow("WORK_CAP");
    expect(account.meter.used).toBe(used);
    expect(() => account.debit.reserve("ref-equal")).toThrow("LIFECYCLE");
    const independent = entered();
    expect(independent.meter.used).toBe(bootstrap() + CONSTRUCTION_GATE_UNITS);
  });
});
