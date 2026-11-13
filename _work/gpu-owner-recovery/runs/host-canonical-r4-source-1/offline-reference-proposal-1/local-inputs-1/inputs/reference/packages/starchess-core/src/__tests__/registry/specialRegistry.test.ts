/**
 * Gas cost registry — every special kind exposes its cost through one table.
 */
import { describe, expect, it } from "vitest";

import { SPECIAL_REGISTRY, specialGasCost, UNIT_COST, type ScSpecialKind } from "@chess-coach/starchess-core";

describe("special registry", () => {
  it("exposes gas costs for every special kind", () => {
    expect(specialGasCost("deploy")).toBe(SPECIAL_REGISTRY.deploy.gasCost);
    expect(specialGasCost("charonMissiles")).toBe(2);
    expect(specialGasCost("tacticalJump")).toBe(3);
    expect(specialGasCost("stimStep")).toBe(1);
  });

  it("rejects mutation of every publicly exported native unit cost", () => {
    const expected = { k: 1, p: 1, n: 3, b: 3, r: 5, q: 9 };
    expect(Object.isFrozen(UNIT_COST)).toBe(true);
    for (const unit of Object.keys(expected) as (keyof typeof UNIT_COST)[]) {
      expect(Reflect.set(UNIT_COST, unit, 0)).toBe(false);
      expect(Reflect.deleteProperty(UNIT_COST, unit)).toBe(false);
      expect(Reflect.defineProperty(UNIT_COST, unit, { value: 0 })).toBe(false);
    }
    expect(UNIT_COST).toEqual(expected);
  });

  it("rejects replacement and nested mutation of every publicly exported special entry", () => {
    const expected = {
      deploy: { gasCost: 1, actorHint: "k" },
      stimStep: { gasCost: 1, actorHint: "p" },
      spiderMine: { gasCost: 1, actorHint: "n" },
      charonMissiles: { gasCost: 2, actorHint: "b" },
      siegeMode: { gasCost: 1, actorHint: "r" },
      tacticalJump: { gasCost: 3, actorHint: "q" },
    };
    expect(Object.isFrozen(SPECIAL_REGISTRY)).toBe(true);
    for (const kind of Object.keys(expected) as ScSpecialKind[]) {
      const entry = SPECIAL_REGISTRY[kind];
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Reflect.set(SPECIAL_REGISTRY, kind, { gasCost: 0 })).toBe(false);
      expect(Reflect.deleteProperty(SPECIAL_REGISTRY, kind)).toBe(false);
      expect(Reflect.defineProperty(SPECIAL_REGISTRY, kind, { value: { gasCost: 0 } })).toBe(false);
      expect(Reflect.set(entry, "gasCost", 0)).toBe(false);
      expect(Reflect.deleteProperty(entry, "gasCost")).toBe(false);
      expect(Reflect.defineProperty(entry, "gasCost", { value: 0 })).toBe(false);
      expect(Reflect.set(entry, "actorHint", "q")).toBe(false);
      expect(Reflect.deleteProperty(entry, "actorHint")).toBe(false);
      expect(SPECIAL_REGISTRY[kind]).toBe(entry);
      expect(specialGasCost(kind)).toBe(expected[kind].gasCost);
    }
    expect(SPECIAL_REGISTRY).toEqual(expected);
  });
});
