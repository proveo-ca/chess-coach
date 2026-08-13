import { describe, expect, it } from "vitest";

import {
  TURN_TIMEOUT_MS,
  energyForTurn,
  turnTimeoutMsForTurn,
} from "../../rules/constants";

describe("turnTimeoutMsForTurn", () => {
  it("scales +50% per gas-income tier: 10s → 15s → 22s", () => {
    expect(energyForTurn(1)).toBe(1);
    expect(energyForTurn(10)).toBe(1);
    expect(energyForTurn(11)).toBe(2);
    expect(energyForTurn(21)).toBe(3);

    expect(turnTimeoutMsForTurn(0)).toBe(TURN_TIMEOUT_MS);
    expect(turnTimeoutMsForTurn(10)).toBe(10_000);
    expect(turnTimeoutMsForTurn(11)).toBe(15_000);
    expect(turnTimeoutMsForTurn(21)).toBe(22_000);
  });
});
