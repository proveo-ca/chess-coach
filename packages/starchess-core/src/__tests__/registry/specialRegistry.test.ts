/**
 * Gas cost registry — every special kind exposes its cost through one table.
 */
import { describe, expect, it } from "vitest";

import { SPECIAL_REGISTRY, specialGasCost } from "@chess-coach/starchess-core";

describe("special registry", () => {
  it("exposes gas costs for every special kind", () => {
    expect(specialGasCost("spawn")).toBe(SPECIAL_REGISTRY.spawn.gasCost);
    expect(specialGasCost("bishopSnipe")).toBe(2);
    expect(specialGasCost("queenWarp")).toBe(3);
    expect(specialGasCost("pawnDouble")).toBe(1);
  });
});
