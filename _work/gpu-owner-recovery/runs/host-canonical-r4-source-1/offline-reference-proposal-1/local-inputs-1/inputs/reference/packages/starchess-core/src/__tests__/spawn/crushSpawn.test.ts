import { describe, expect, it } from "vitest";

import {
  ScValidateError,
  addScAction,
  assertActionDeep,
  endScTurn,
  parseScFen,
  spawnCCAnchor,
} from "../../index.ts";

describe("crush spawn (deploy onto enemy)", () => {
  it("allyOccupied blocks only Command Centers (ally and enemy non-Command Centers crushable)", () => {
    // White K e1, black n d1 adjacent, white R d2 adjacent.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3R4/3nK3|1|33|P|G:11:11|Q:w:;b:",
    );
    const { commandCenter, occupied, allyOccupied } = spawnCCAnchor(snap, "w", "B");
    expect(commandCenter).toBe("e1");
    expect(occupied.has("d1")).toBe(true); // any unit blocks the raw ring...
    expect(allyOccupied.has("d1")).toBe(false); // ...but enemy non-Command Center stays deployable
    expect(allyOccupied.has("d2")).toBe(false); // ally non-Command Center is now deployable (replaced)
    expect(allyOccupied.has("e1")).toBe(true); // own Command Center blocks
    expect(allyOccupied.has("e2")).toBe(false);
  });

  it("validation allows spawn onto an enemy or ally square and rejects any Command Center", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/R2nK3|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(() =>
      assertActionDeep(snap, {
        timing: "B",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "d1", // enemy Hoverbike — legal crush
        unit: "p",
      }),
    ).not.toThrow();
    const allySnap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3R4/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(() =>
      assertActionDeep(allySnap, {
        timing: "B",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "d2", // own Tank — legal ally crush (replaced)
        unit: "p",
      }),
    ).not.toThrow();

    // Adjacent enemy Command Center must also be blocked
    const ccSnap = parseScFen(
      "SCFEN|8/8/8/8/8/8/4k3/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(() =>
      assertActionDeep(ccSnap, {
        timing: "B",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "e2",
        unit: "p",
      }),
    ).toThrow(ScValidateError);
  });

  it("endScTurn crushes the enemy and records the victim on the spawn event", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/R2nK3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "d1",
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    // Marine landed on d1; enemy Hoverbike gone.
    expect(result.afterB.placement).toBe("4k3/8/8/8/8/8/8/R2PK3");
    const spawn = result.events.find(
      (ev) => ev.kind === "deploy" && ev.phase === "specialBefore",
    );
    expect(spawn).toBeDefined();
    expect(spawn!.victim).toEqual({ type: "n", color: "b" });
    // The crush never reached the resolve phase (no black pieces left to act).
    expect(result.next.placement).toContain("P");
  });

  it("F spawn crushes an enemy occupant after classical resolves", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3n4/4K3|1|33|P|G:11:11|B:3:3|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "F",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "d2", // enemy Hoverbike d2, adjacent to Command Center e1
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.events.find((ev) => ev.kind === "deploy")).toMatchObject({
      phase: "specialAfter",
      victim: { type: "n", color: "b" },
    });
    expect(result.next.placement.split("/")[6]).toContain("P");
  });

  it("endScTurn replaces an ally occupant and records the ally victim", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3R4/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "d2", // own Tank — replaced by deployed marine
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.afterB.placement).toBe("4k3/8/8/8/8/8/3P4/4K3");
    const spawn = result.events.find(
      (ev) => ev.kind === "deploy" && ev.phase === "specialBefore",
    );
    expect(spawn).toBeDefined();
    expect(spawn!.victim).toEqual({ type: "r", color: "w" });
  });

  it("F spawn replaces an ally occupant after classical resolves", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3R4/4K3|1|33|P|G:11:11|B:3:3|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "F",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "d2", // own Tank d2, adjacent to Command Center e1
        unit: "n",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.events.find((ev) => ev.kind === "deploy")).toMatchObject({
      phase: "specialAfter",
      victim: { type: "r", color: "w" },
      unit: "n",
    });
    expect(result.next.placement.split("/")[6]).toContain("N");
  });

  it("mined ally deploy records both crush victim and mine blast", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3R4/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = { ...snap, mines: [{ at: "d2", color: "b" }] };
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "d2",
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const spawn = result.events.find(
      (ev) => ev.kind === "deploy" && ev.phase === "specialBefore",
    );
    expect(spawn).toMatchObject({
      victim: { type: "r", color: "w" },
      mineColor: "b",
    });
  });

  it("spawn onto an empty adjacent square carries no victim", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "e2",
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const spawn = result.events.find(
      (ev) => ev.kind === "deploy" && ev.phase === "specialBefore",
    );
    expect(spawn!.victim).toBeUndefined();
  });
});
