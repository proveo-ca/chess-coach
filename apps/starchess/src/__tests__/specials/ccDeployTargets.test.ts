/**
 * Command Center deploy ring — UI wrapper over the engine block set.
 * Ally and enemy non-Command Centers are targets (replaced on resolve); Command Centers never are.
 * // SPEC: _spec/apps/starchess/core/board/board-queries.puml
 */
import { describe, expect, it } from "vitest";
import { parseScFen } from "@chess-coach/starchess-core";

import { ccDeployTargets } from "~/presentation/specials/deployTargets";

describe("ccDeployTargets", () => {
  it("offers empty, ally and enemy ring squares but never a Command Center", () => {
    // White K e1; white R d2 (ally); black n d1 (enemy); black k e8.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3R4/3nK3|1|33|P|G:11:11|Q:w:;b:",
    );
    const { commandCenter, targets } = ccDeployTargets(snap, "w");
    expect(commandCenter).toBe("e1");
    expect(targets).toContain("d2"); // ally non-Command Center — replaced on resolve
    expect(targets).toContain("d1"); // enemy non-Command Center — crushed on resolve
    expect(targets).toContain("e2"); // empty
    expect(targets).not.toContain("e1"); // own Command Center (center, not adjacent anyway)
  });

  it("never offers the adjacent enemy Command Center", () => {
    const snap = parseScFen(
      "SCFEN|8/8/8/8/8/8/4k3/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    const { targets } = ccDeployTargets(snap, "w");
    expect(targets).not.toContain("e2");
  });

  it("is empty with no Command Center on the board", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const { commandCenter, targets } = ccDeployTargets({ ...snap, placement: "8/8/8/8/8/8/8/8" }, "w");
    expect(commandCenter).toBeNull();
    expect(targets).toEqual([]);
  });
});
