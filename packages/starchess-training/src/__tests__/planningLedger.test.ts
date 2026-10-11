// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  abortA2, beginBlock, consumeWorkBlock, createPlanningLedger, enterA2, finishA2, finishBlock,
  requirePlanningMeter, reserveBlock, type A2Operation, type A2Ticket, type IngressTicket, type LedgerPair,
} from "../economic/ownedKernel";
import { ContractError, PLANNING_INITIAL_UNITS, PLANNING_GATE_UNITS, PLANNING_ENTRY_UNITS, quoteBlock } from "../economic/invoices";
import { createConstructionAccount } from "../coordinator/constructionAccounting";
import * as guards from "../economic/ownedGuards";
import { ownedGuardNames } from "./ownedSurface";

const CAP = 1048576;
const hostile = (target: object = {}) => {
  const trap = vi.fn(() => { throw new Error("caller effect"); });
  return { value: new Proxy(target, { get: trap, set: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap }), trap };
};
const admitted = (): LedgerPair => {
  const pair = createPlanningLedger();
  pair.owner.admitOnce();
  return pair;
};
const active = (): { pair: LedgerPair; ticket: A2Ticket } => {
  const pair = admitted();
  pair.owner.armInitialize();
  return { pair, ticket: enterA2(pair.meter, "initialize") };
};
const dispatch = (operation: A2Operation, pair: LedgerPair): A2Ticket => {
  switch (operation) {
    case "initialize": pair.owner.armInitialize(); break;
    case "advance": pair.owner.armAdvance(); break;
    case "readout": pair.owner.armReadout(); break;
    case "encode": pair.owner.armEncode(); break;
    case "flatten": pair.owner.armFlatten(); break;
  }
  return enterA2(pair.meter, operation);
};

describe("constructor-bound local accounting, not genuine permit authority", () => {
  it("constructs exact two-field null-prototype storage and prepays bootstrap/admission/closure", () => {
    const { meter, owner } = createPlanningLedger();
    expect(Reflect.ownKeys(meter)).toEqual(["limit", "used"]);
    expect(Object.getPrototypeOf(meter)).toBeNull();
    expect(Object.isExtensible(meter)).toBe(false);
    expect(Object.getOwnPropertyDescriptor(meter, "limit")).toEqual({ value: CAP, writable: false, configurable: false, enumerable: true });
    expect(Object.getOwnPropertyDescriptor(meter, "used")).toEqual({ value: 3072, writable: true, configurable: false, enumerable: true });
    expect(PLANNING_INITIAL_UNITS).toBe(3072);
    expect(Object.isFrozen(owner)).toBe(true);
    expect(Object.keys(owner)).toEqual([
      "admitOnce", "armInitialize", "armAdvance", "armReadout", "armEncode", "armFlatten", "beginR3Visit", "beginR3Node",
      "beginR3ByteReads", "beginBatchSnapshot", "beginBatchHash", "finishIngress", "close", "abort",
    ]);
    owner.abort();
    expect(meter.used).toBe(3072);
  });

  it("does not adopt private unbound construction storage", () => {
    const account = createConstructionAccount(), before = account.meter.used;
    expect(() => enterA2(account.meter, "initialize")).toThrow("PROVENANCE");
    expect(account.meter.used).toBe(before);
  });

  it("rejects literals, proxies, copied and cloned issued meters without inspection", () => {
    const pair = admitted(), proxy = hostile(pair.meter), raw = hostile();
    const getter = vi.fn(() => { throw new Error("used getter"); });
    const fake = Object.defineProperty({ limit: CAP }, "used", { get: getter });
    for (const value of [null, undefined, 0, {}, { limit: CAP, used: 0 }, fake, { ...pair.meter }, structuredClone(pair.meter), proxy.value, raw.value]) {
      expect(() => enterA2(value, "initialize")).toThrow("PROVENANCE");
    }
    expect(proxy.trap).not.toHaveBeenCalled();
    expect(raw.trap).not.toHaveBeenCalled();
    expect(getter).not.toHaveBeenCalled();
    pair.owner.close();
  });

  it("rejects actual unadmitted and admitted-but-unarmed storage", () => {
    for (const pair of [createPlanningLedger(), admitted()]) {
      const before = pair.meter.used;
      expect(() => enterA2(pair.meter, "initialize")).toThrow("LIFECYCLE");
      expect(() => pair.owner.admitOnce()).toThrow("LIFECYCLE");
      expect(pair.meter.used).toBe(before);
    }
  });

  it.each(["initialize", "advance", "readout", "encode", "flatten"] as const)("consumes only the corresponding %s arm once", operation => {
    const pair = admitted();
    const ticket = dispatch(operation, pair);
    expect(requirePlanningMeter(pair.meter)).toBe(pair.meter);
    finishA2(ticket);
    expect(() => enterA2(pair.meter, operation)).toThrow("LIFECYCLE");
    expect(() => pair.owner.armInitialize()).toThrow("LIFECYCLE");
  });

  it("latches wrong-operation and duplicate owner admission/arm failures", () => {
    const wrong = admitted();
    wrong.owner.armInitialize();
    expect(() => enterA2(wrong.meter, "readout")).toThrow("LIFECYCLE");
    expect(() => enterA2(wrong.meter, "initialize")).toThrow("LIFECYCLE");
    const duplicate = admitted();
    expect(() => duplicate.owner.admitOnce()).toThrow("LIFECYCLE");
    expect(() => duplicate.owner.armAdvance()).toThrow("LIFECYCLE");
    const twice = admitted();
    twice.owner.armFlatten();
    expect(() => twice.owner.armFlatten()).toThrow("LIFECYCLE");
    expect(() => enterA2(twice.meter, "flatten")).toThrow("LIFECYCLE");
  });

  it("rejects recursive entry and expires its original ticket", () => {
    const { pair, ticket } = active(), before = pair.meter.used;
    expect(() => enterA2(pair.meter, "initialize")).toThrow("LIFECYCLE");
    expect(() => finishA2(ticket)).toThrow("TICKET");
    expect(() => pair.owner.armInitialize()).toThrow("LIFECYCLE");
    expect(pair.meter.used).toBe(before);
  });

  it("allows only one paying ledger and rejects cross-ledger entry", () => {
    const first = admitted(), second = admitted();
    second.owner.armReadout();
    first.owner.armInitialize();
    const ticket = enterA2(first.meter, "initialize");
    expect(() => enterA2(second.meter, "readout")).toThrow("LIFECYCLE");
    finishA2(ticket);
    first.owner.close();
    expect(() => second.owner.armReadout()).toThrow("LIFECYCLE");
  });

  it("allows separate sequential operations but never reopens a closed or aborted scope", () => {
    const pair = admitted();
    for (const operation of ["initialize", "advance", "readout", "encode", "flatten"] as const) finishA2(dispatch(operation, pair));
    const before = pair.meter.used;
    pair.owner.close();
    expect(() => pair.owner.armEncode()).toThrow("LIFECYCLE");
    expect(() => pair.owner.admitOnce()).toThrow("LIFECYCLE");
    expect(pair.meter.used).toBe(before);
    const aborted = active();
    abortA2(aborted.ticket);
    expect(() => aborted.pair.owner.armReadout()).toThrow("LIFECYCLE");
  });

  it.each(["value", "writability"] as const)("latches issued used %s tampering before block work", kind => {
    const { pair, ticket } = active(), before = pair.meter.used;
    if (kind === "value") pair.meter.used = 0;
    else Object.defineProperty(pair.meter, "used", { writable: false });
    expect(() => reserveBlock(ticket, "scalar", 1, 0)).toThrow("TAMPER");
    expect(() => pair.owner.armInitialize()).toThrow("LIFECYCLE");
    expect(pair.meter.used).toBe(kind === "value" ? 0 : before);
  });

  it("reserves the bootstrap-inclusive exact cap and closes without further debit", () => {
    const { pair, ticket } = active();
    expect(pair.meter.used).toBe(3072 + PLANNING_GATE_UNITS + PLANNING_ENTRY_UNITS + PLANNING_GATE_UNITS);
    consumeWorkBlock(pair.meter, "scalar", CAP - pair.meter.used - 128);
    expect(pair.meter.used).toBe(CAP);
    finishA2(ticket);
    pair.owner.close();
    expect(pair.meter.used).toBe(CAP);
  });

  it("keeps earlier invoices when the next envelope cannot fit", () => {
    const { pair, ticket } = active();
    consumeWorkBlock(pair.meter, "scalar", CAP - pair.meter.used - 128);
    finishA2(ticket);
    expect(() => pair.owner.armAdvance()).toThrow("WORK_CAP");
    expect(pair.meter.used).toBe(CAP);
    expect(() => pair.owner.close()).toThrow("LIFECYCLE");
  });

  it("rejects foreign/cloned/proxy/expired tickets without argument getters", () => {
    const foreign = active();
    finishA2(foreign.ticket);
    foreign.pair.owner.close();
    const hostileBlock = hostile();
    for (const foreignTicket of [foreign.ticket, {}, structuredClone(foreign.ticket), hostile().value]) {
      const current = active();
      expect(() => reserveBlock(foreignTicket as A2Ticket, hostileBlock.value as never, hostileBlock.value as never, 0)).toThrow("TICKET");
      expect(() => finishA2(current.ticket)).toThrow("TICKET");
    }
    expect(hostileBlock.trap).not.toHaveBeenCalled();
  });

  it("consumes a scalar block once without double debit", () => {
    const { pair, ticket } = active(), before = pair.meter.used;
    const block = reserveBlock(ticket, "scalar", 20, 0);
    expect(pair.meter.used).toBe(before + 148);
    beginBlock(pair.meter, block, "scalar");
    consumeWorkBlock(pair.meter, "scalar", 20);
    expect(pair.meter.used).toBe(before + 148);
    finishBlock(pair.meter, block);
    expect(() => beginBlock(pair.meter, block, "scalar")).toThrow("TICKET");
    expect(() => finishA2(ticket)).toThrow("TICKET");
  });

  it("rejects repeated zero-length allocations and zero scalar lanes from the same ticket", () => {
    for (const lane of ["scalar", "float64-array"] as const) {
      const { pair, ticket } = active(), block = reserveBlock(ticket, lane, 0, 0);
      beginBlock(pair.meter, block, lane);
      consumeWorkBlock(pair.meter, lane, 0);
      expect(() => consumeWorkBlock(pair.meter, lane, 0)).toThrow("TICKET");
      expect(() => pair.owner.armReadout()).toThrow("LIFECYCLE");
    }
  });

  it("rejects overdrawing, wrong-lane and unfinished batch topology", () => {
    for (const misuse of ["overdraw", "wrong-lane", "unfinished"] as const) {
      const { pair, ticket } = active();
      const block = reserveBlock(ticket, "scalar", 1, 0);
      beginBlock(pair.meter, block, "scalar");
      expect(() => {
        if (misuse === "overdraw") consumeWorkBlock(pair.meter, "scalar", 2);
        else if (misuse === "wrong-lane") consumeWorkBlock(pair.meter, "float64-decode", 1);
        else finishA2(ticket);
      }).toThrow("TICKET");
      expect(() => pair.owner.armReadout()).toThrow("LIFECYCLE");
    }
  });

  it("uses closed nested ingress tickets without double-debiting prepaid lanes", () => {
    const pair = admitted(), before = pair.meter.used;
    const visit = pair.owner.beginR3Visit();
    const visitCharge = pair.meter.used;
    const node = pair.owner.beginR3Node();
    const bytes = pair.owner.beginR3ByteReads(3), reserved = pair.meter.used;
    for (let index = 0; index < 3; index++) consumeWorkBlock(pair.meter, "r3-byte-read", 1);
    expect(pair.meter.used).toBe(reserved);
    pair.owner.finishIngress(bytes);
    pair.owner.finishIngress(node);
    pair.owner.finishIngress(visit);
    expect(visitCharge - before).toBe(quoteBlock("r3-visit", 1, 0) + 1536);
    expect(pair.meter.used).toBe(before + quoteBlock("r3-visit", 1, 0) + quoteBlock("r3-node", 1, 0) + quoteBlock("r3-byte-read", 3, 0) + 3 * 1536);
    pair.owner.close();
  });

  it("rejects wrong ingress order, expired readers and repeated zero-extent ticket creation", () => {
    const pair = admitted(), visit = pair.owner.beginR3Visit();
    pair.owner.beginR3Node();
    expect(() => pair.owner.finishIngress(visit)).toThrow("TICKET");
    expect(() => pair.owner.armReadout()).toThrow("LIFECYCLE");
    const empty = admitted(), ingress = empty.owner.beginBatchSnapshot(0);
    consumeWorkBlock(empty.meter, "batch-snapshot", 0);
    expect(() => consumeWorkBlock(empty.meter, "batch-snapshot", 0)).toThrow("TICKET");
    expect(() => empty.owner.finishIngress(ingress)).toThrow("LIFECYCLE");
    const expired = admitted(), done = expired.owner.beginBatchHash(1);
    expired.owner.finishIngress(done);
    expect(() => reserveBlock(done, "batch-hash", 1, 0)).toThrow("TICKET");
  });

  it("keeps own native Error name and exposes no owner through read guards", () => {
    let error: unknown;
    try { enterA2({}, "initialize"); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ContractError);
    expect(Object.getOwnPropertyDescriptor(error, "name")?.value).toBe("ContractError");
    expect(Object.keys(guards).sort()).toEqual(ownedGuardNames);
    for (const file of ["work", "float64", "ownedGuards"]) {
      const source = readFileSync(new URL(`../economic/${file}.ts`, import.meta.url), "utf8");
      expect(source).not.toMatch(/\b(createPlanningLedger|LedgerOwner|LedgerPair|coordinator)\b/);
    }
  });
});
