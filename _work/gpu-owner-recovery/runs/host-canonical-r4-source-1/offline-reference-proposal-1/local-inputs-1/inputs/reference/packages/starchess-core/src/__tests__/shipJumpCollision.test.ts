import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  parseScFen,
  placementToMap,
  type ScFenSnapshot,
} from "../index";

const snapOf = (placement: string): ScFenSnapshot =>
  parseScFen(`SCFEN|${placement}|21|33|P|G:33:33|B:8:8|Q:w:;b:`);

describe("ship jump collision", () => {
  it("B black jump onto white B-deployed square collides both dead", () => {
    let snap = snapOf("q2k4/8/8/8/8/8/8/4K3");
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "deploy", color: "w", from: "e1", to: "e2", unit: "p" } as never,
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "tacticalJump", color: "b", from: "a8", to: "e2" } as never,
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const map = placementToMap(result.next.placement);
    expect(map.has("a8" as never)).toBe(false);
    expect(map.has("e2" as never)).toBe(false);
    const ev = result.events.find(
      (e) => e.kind === "tacticalJump" && e.phase === "specialBefore",
    );
    expect(ev?.victim).toMatchObject({ type: "p", color: "w" });
    expect(ev?.collider).toMatchObject({ type: "q", color: "b" });
  });

  it("F white jump onto black B-deployed marine collides both dead", () => {
    let snap = snapOf("3k4/8/8/8/8/8/8/Q3K3");
    snap = addScAction({
      snapshot: snap,
      action: { timing: "F", kind: "tacticalJump", color: "w", from: "a1", to: "d7" } as never,
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "deploy", color: "b", from: "d8", to: "d7", unit: "p" } as never,
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const map = placementToMap(result.next.placement);
    expect(map.has("a1" as never)).toBe(false);
    expect(map.has("d7" as never)).toBe(false);
    const ev = result.events.find(
      (e) => e.kind === "tacticalJump" && e.phase === "specialAfter",
    );
    expect(ev?.victim).toMatchObject({ type: "p", color: "b" });
    expect(ev?.collider).toMatchObject({ type: "q", color: "w" });
  });

  it("B jump onto empty square still lands", () => {
    let snap = snapOf("7k/8/8/8/8/8/8/Q3K3");
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "tacticalJump", color: "w", from: "a1", to: "e5" } as never,
    }).snapshot;
    const result = endScTurn(snap, { skipTurnStartChecks: true });
    const map = placementToMap(result.next.placement);
    expect(map.get("e5" as never)).toMatchObject({ type: "q", color: "w" });
    expect(map.has("a1" as never)).toBe(false);
  });
});
