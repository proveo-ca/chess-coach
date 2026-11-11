/**
 * Gas cost registry — every special kind exposes its cost through one table.
 */
import { describe, expect, it } from "vitest";

import { SPECIAL_REGISTRY, specialGasCost } from "@chess-coach/starchess-core";

describe("special registry", () => {
  it("exposes gas costs for every special kind", () => {
    expect(specialGasCost("deploy")).toBe(SPECIAL_REGISTRY.deploy.gasCost);
    expect(specialGasCost("charonMissiles")).toBe(2);
    expect(specialGasCost("tacticalJump")).toBe(3);
    expect(specialGasCost("stimStep")).toBe(1);
  });
});
