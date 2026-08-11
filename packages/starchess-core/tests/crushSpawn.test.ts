import { describe, expect, it } from "vitest";

import {
  ScValidateError,
  addScAction,
  assertActionDeep,
  endScTurn,
  parseScFen,
  spawnKingAnchor,
} from "../src/index.ts";

describe("crush spawn (deploy onto enemy)", () => {
  it("allyOccupied excludes enemy squares", () => {
    // White K e1, black k d1 adjacent, white rook a1.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/R2nK3|1|33|P|G:11:11|Q:w:;b:",
    );
    const { king, occupied, allyOccupied } = spawnKingAnchor(snap, "w", "B");
    expect(king).toBe("e1");
    expect(occupied.has("d1")).toBe(true); // any unit blocks the ring...
    expect(allyOccupied.has("d1")).toBe(false); // ...but enemy squares stay deployable
    expect(allyOccupied.has("a1")).toBe(true);
    expect(allyOccupied.has("e2")).toBe(false);
  });

  it("validation allows spawn onto an enemy square and rejects ally squares or enemy King", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/R2nK3|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(() =>
      assertActionDeep(snap, {
        timing: "B",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "d1", // enemy knight — legal crush
        unit: "p",
      }),
    ).not.toThrow();
    expect(() =>
      assertActionDeep(snap, {
        timing: "B",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "a1", // own rook — blocked
        unit: "p",
      }),
    ).toThrow(ScValidateError);

    // Adjacent enemy King must also be blocked
    const kingSnap = parseScFen(
      "SCFEN|8/8/8/8/8/8/4k3/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(() =>
      assertActionDeep(kingSnap, {
        timing: "B",
        kind: "spawn",
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
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "d1",
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    // Marine landed on d1; enemy knight gone.
    expect(result.afterB.placement).toBe("4k3/8/8/8/8/8/8/R2PK3");
    const spawn = result.events.find(
      (ev) => ev.kind === "spawn" && ev.phase === "specialBefore",
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
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "d2", // enemy knight d2, adjacent to king e1
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    expect(result.events.find((ev) => ev.kind === "spawn")).toMatchObject({
      phase: "specialAfter",
      victim: { type: "n", color: "b" },
    });
    expect(result.next.placement.split("/")[6]).toContain("P");
  });

  it("spawn onto an empty adjacent square carries no victim", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "e2",
        unit: "p",
      },
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const spawn = result.events.find(
      (ev) => ev.kind === "spawn" && ev.phase === "specialBefore",
    );
    expect(spawn!.victim).toBeUndefined();
  });
});
