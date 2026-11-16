// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it, vi } from "vitest";
import * as k from "../economic/ownedKernel";
import { quoteBlock } from "../economic/invoices";

const active = () => {
  const pair = k.createPlanningLedger(); pair.owner.admitOnce(); pair.owner.armAdvance();
  return { ...pair, ticket: k.enterA2(pair.meter, "advance") };
};

describe("transaction-local economic support", () => {
  it("reserves dense construction, each access and sealing without copying the result", () => {
    const { meter, ticket, owner } = active(), before = meter.used;
    const draft = k.beginEvaluationSupport7501(meter);
    expect(Reflect.ownKeys(draft)).toEqual([]);
    expect(k.readEvaluationSupport(meter, draft, 0)).toBe(false);
    expect(k.readEvaluationSupport(meter, draft, 7500)).toBe(false);
    k.putEvaluationSupport(meter, draft, 577 * 4 + 3, true);
    k.putEvaluationSupport(meter, draft, 0, true);
    k.putEvaluationSupport(meter, draft, 0, false);
    const support = k.finishEvaluationSupport7501(meter, draft);
    expect(support).toHaveLength(7501);
    expect(Reflect.ownKeys(support)).toHaveLength(7502);
    expect(Object.isFrozen(support)).toBe(true);
    expect(k.requirePublicSupport(support)).toBe(support);
    expect(support.filter(Boolean)).toEqual([true]);
    expect(support[577 * 4 + 3]).toBe(true);
    expect(meter.used - before).toBe(quoteBlock("support-initialize", 7501, 0) + 2 * quoteBlock("support-read", 1, 0) +
      3 * quoteBlock("support-write", 1, 0) + quoteBlock("support-seal", 7501, 0));
    expect(k.publicSupportCanBirth(meter, support)).toBe(true);
    k.finishA2(ticket); owner.close();
  });

  it("retains exact bank-zero metadata after overwrite and across later admitted entries", () => {
    const { meter, ticket, owner } = active(), draft = k.beginEvaluationSupport7501(meter);
    k.putEvaluationSupport(meter, draft, 7499, true);
    k.putEvaluationSupport(meter, draft, 7499, false);
    k.putEvaluationSupport(meter, draft, 576, true);
    const support = k.finishEvaluationSupport7501(meter, draft);
    expect(k.publicSupportCanBirth(meter, support)).toBe(false);
    k.finishA2(ticket); owner.armReadout();
    const next = k.enterA2(meter, "readout"), before = meter.used;
    expect(k.publicSupportCanBirth(meter, support)).toBe(false);
    expect(meter.used).toBe(before + quoteBlock("scalar", 128, 0));
    k.finishA2(next); owner.close();
  });

  it.each([-1, 7501, -0, .5, NaN, Infinity])("rejects index %s before writing and keeps the reserved invoice", index => {
    const { meter, owner } = active(), draft = k.beginEvaluationSupport7501(meter), before = meter.used;
    expect(() => k.putEvaluationSupport(meter, draft, index, true)).toThrow("NUMBER");
    expect(meter.used).toBe(before + quoteBlock("support-write", 1, 0));
    expect(() => owner.armReadout()).toThrow("LIFECYCLE");
  });

  it("rejects nonboolean values without coercion or publication", () => {
    const { meter, owner } = active(), draft = k.beginEvaluationSupport7501(meter), trap = vi.fn();
    const value = new Proxy({}, { get: trap, getPrototypeOf: trap, ownKeys: trap });
    expect(() => k.putEvaluationSupport(meter, draft, 0, value as never)).toThrow("SCHEMA");
    expect(trap).not.toHaveBeenCalled();
    expect(() => owner.armReadout()).toThrow("LIFECYCLE");
  });

  it("requires nonempty support and retains the failed seal reservation", () => {
    const { meter, owner } = active(), draft = k.beginEvaluationSupport7501(meter), before = meter.used;
    expect(() => k.finishEvaluationSupport7501(meter, draft)).toThrow("CONSISTENCY");
    expect(meter.used).toBe(before + quoteBlock("support-seal", 7501, 0));
    expect(() => owner.armReadout()).toThrow("LIFECYCLE");
  });

  it("rejects foreign, copied and proxy drafts before draft properties", () => {
    const first = active(), foreign = k.beginEvaluationSupport7501(first.meter); first.owner.abort();
    const trap = vi.fn(), proxy = new Proxy({}, { get: trap, getOwnPropertyDescriptor: trap, ownKeys: trap, getPrototypeOf: trap });
    for (const draft of [foreign, structuredClone(foreign), {}, proxy]) {
      const { meter, owner } = active();
      expect(() => k.readEvaluationSupport(meter, draft as k.EvaluationSupportDraft, 0)).toThrow("TICKET");
      expect(() => owner.armReadout()).toThrow("LIFECYCLE");
    }
    expect(trap).not.toHaveBeenCalled();
  });

  it("rejects unfinished draft closure, duplicate admission and expired drafts", () => {
    const unfinished = active(); k.beginEvaluationSupport7501(unfinished.meter);
    expect(() => k.finishA2(unfinished.ticket)).toThrow("TICKET");
    expect(() => unfinished.owner.armAdvance()).toThrow("LIFECYCLE");
    const duplicate = active(); k.beginEvaluationSupport7501(duplicate.meter);
    expect(() => k.beginEvaluationSupport7501(duplicate.meter)).toThrow("TICKET");
    const completed = active(), draft = k.beginEvaluationSupport7501(completed.meter);
    k.putEvaluationSupport(completed.meter, draft, 0, true); k.finishEvaluationSupport7501(completed.meter, draft);
    k.finishA2(completed.ticket); completed.owner.armAdvance(); k.enterA2(completed.meter, "advance");
    expect(() => k.putEvaluationSupport(completed.meter, draft, 0, false)).toThrow("TICKET");
  });

  it("expires ordinary owned cursors at the originating entry boundary", () => {
    const { meter, ticket, owner } = active(), cursor = k.beginSquareSet64(meter);
    k.appendSquareSet64(meter, cursor, "a1"); k.finishA2(ticket);
    owner.armReadout(); k.enterA2(meter, "readout");
    expect(() => k.finishSquareSet64(meter, cursor)).toThrow("TICKET");
    expect(() => owner.armAdvance()).toThrow("LIFECYCLE");
  });

  it("rejects a raw support graph before inspecting its hidden values", () => {
    const { meter } = active(), trap = vi.fn(), raw = new Proxy([], { get: trap, getOwnPropertyDescriptor: trap, ownKeys: trap });
    expect(() => k.publicSupportCanBirth(meter, raw)).toThrow("PROVENANCE");
    expect(trap).not.toHaveBeenCalled();
  });

  it("fails initialization before proportional Array.from effects after real Float64 work", async () => {
    const native = Array.from, allocation = vi.spyOn(Array, "from");
    vi.resetModules();
    try {
      const isolated = await import("../economic/ownedKernel"), float = await import("../economic/float64");
      allocation.mockImplementation(function (this: unknown, ...args: unknown[]) { return Reflect.apply(native, this, args); });
      const pair = isolated.createPlanningLedger(); pair.owner.admitOnce(); pair.owner.armAdvance(); isolated.enterA2(pair.meter, "advance");
      for (let i = 0; i < 440; i++) float.encodeFloat64(i, pair.meter);
      allocation.mockClear();
      const before = pair.meter.used;
      expect(1048576 - before).toBeLessThan(quoteBlock("support-initialize", 7501, 0));
      expect(() => isolated.beginEvaluationSupport7501(pair.meter)).toThrow("WORK_CAP");
      expect(allocation).not.toHaveBeenCalled();
      expect(pair.meter.used).toBe(before);
      expect(() => pair.owner.armReadout()).toThrow("LIFECYCLE");
    } finally { allocation.mockRestore(); vi.resetModules(); }
  });
});
