// SPEC: _spec/packages/starchess-training/r4-host-verification.puml
import { describe, expect, it, vi } from "vitest";
import { createPlanningLedger } from "../economic/ownedKernel";
import { PLANNING_WORK_CAP, quoteBlock } from "../economic/invoices";
import { charge } from "../economic/work";

const batchPrecharge = (count: number): number => 32768 + 418 * 1536 + count * (512 + 2 * 418 * 32) + 418 * 32;
const admittedIngress = () => {
  const pair = createPlanningLedger();
  pair.owner.admitOnce();
  pair.owner.beginR3Visit();
  pair.owner.beginR3Node();
  return pair;
};

describe("current planning schedule reservation witnesses", () => {
  it("rejects the fourteen-candidate scalar extent before covered effects with CARDINALITY", () => {
    const pair = admittedIngress(), before = pair.meter.used, effect = vi.fn();
    expect(batchPrecharge(14)).toBe(1069888);
    expect(() => { charge(pair.meter, batchPrecharge(14), "$.schedule.batch"); effect(); }).toThrow("CARDINALITY");
    expect(effect).not.toHaveBeenCalled();
    expect(pair.meter.used).toBe(before);
    expect(pair.meter.limit).toBe(PLANNING_WORK_CAP);
    expect(() => pair.owner.close()).toThrow("LIFECYCLE");
  });

  it("retains ingress debit when the thirteen-candidate reservation cannot fit the remaining cap", () => {
    const pair = admittedIngress(), before = pair.meter.used, effect = vi.fn();
    expect(before).toBe(7296);
    expect(batchPrecharge(13)).toBe(1042624);
    expect(before + quoteBlock("scalar", batchPrecharge(13), 0)).toBe(1050048);
    expect(() => { charge(pair.meter, batchPrecharge(13), "$.schedule.batch"); effect(); }).toThrow("WORK_CAP");
    expect(effect).not.toHaveBeenCalled();
    expect(pair.meter.used).toBe(before);
    expect(() => pair.owner.armFlatten()).toThrow("LIFECYCLE");
  });

  it("keeps the conditional 1025-flatten store lower bound separate from batch precharge", () => {
    const flattenCalls = 2 * 512 + 1;
    expect(flattenCalls).toBe(1025);
    expect(quoteBlock("float64-store", 418, 0)).toBe(13504);
    expect(flattenCalls * quoteBlock("float64-store", 418, 0)).toBe(13841600);
    expect(flattenCalls * quoteBlock("float64-store", 418, 0)).toBeGreaterThan(PLANNING_WORK_CAP);
  });
});
