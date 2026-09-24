/**
 * Sieged Siege Tank fires like a regular piece attacks: any cross square is a
 * legal fire mission, empty ground takes a victimless shelling (HE still
 * plays), and the first piece in the way intercepts (collision rules).
 */
import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  parseScFen,
  placementToMap,
} from "../../index";

const shellingsOf = (r: ReturnType<typeof endScTurn>) =>
  r.resolved.attacks.filter((a) => a.kind === "shelling");

const attacksOf = (r: ReturnType<typeof endScTurn>) => r.resolved.attacks;

describe("sieged Tank shelling", () => {
  it("explodes on vacated ground: d2 slips via B gas, HE still resolves at d2", () => {
    // Fog-lesson rook-siege beat 1: tank intent on d2 while the marine stands
    // there; B stimStep slips it to d1 (promoting) pre-attack.
    let snap = parseScFen("SCFEN|7k/8/8/8/3R4/8/3p4/K7|0|33|P|G:11:11|Q:w:;b:|S:d4");
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "d4", to: "d2" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "stimStep",
        color: "b",
        from: "d2",
        to: "d1",
        promotion: "q",
      },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });

    const shells = shellingsOf(r);
    expect(shells).toHaveLength(1);
    expect(shells[0]).toMatchObject({ from: "d4", to: "d2", piece: "r", color: "w" });
    const map = placementToMap(r.next.placement);
    expect(map.get("d2")).toBeUndefined();
    expect(map.get("d1")).toEqual({ type: "q", color: "b" });
    expect(map.get("d4")).toEqual({ type: "r", color: "w" });
    expect(r.next.siegedTanks ?? []).toContain("d4");
  });

  it("intercepts at the first piece: d7 intent collides with the d6 marine", () => {
    // Fog-lesson rook-siege beat 2: B gas steps the d7 marine to d6; the tank
    // intent on d7 dies on the interceptor, never reaching d7.
    let snap = parseScFen("SCFEN|7k/3p4/8/8/3R4/8/8/K7|0|33|P|G:11:11|Q:w:;b:|S:d4");
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "d4", to: "d7" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "stimStep", color: "b", from: "d7", to: "d6" },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });

    expect(shellingsOf(r)).toHaveLength(0);
    const hit = attacksOf(r).find(
      (a) => a.kind === "capture" && a.from === "d4" && a.to === "d6",
    );
    expect(hit).toMatchObject({
      victim: { piece: "p", color: "b" },
    });
    expect(attacksOf(r).some((a) => a.to === "d7")).toBe(false);
    const map = placementToMap(r.next.placement);
    expect(map.get("d6")).toBeUndefined();
    expect(map.get("d7")).toBeUndefined();
    expect(map.get("d4")).toEqual({ type: "r", color: "w" });
  });

  it("queues fire on empty cross squares (no victim needed at queue time)", () => {
    let snap = parseScFen("SCFEN|7k/8/8/8/3R4/8/8/K7|0|33|P|G:11:11|Q:w:;b:|S:d4");
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "d4", to: "d5" },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });

    const shells = shellingsOf(r);
    expect(shells).toHaveLength(1);
    expect(shells[0]).toMatchObject({ from: "d4", to: "d5" });
    const map = placementToMap(r.next.placement);
    expect(map.get("d4")).toEqual({ type: "r", color: "w" });
    expect(map.get("d5")).toBeUndefined();
  });

  it("holds fire through allies (no friendly shelling)", () => {
    let snap = parseScFen("SCFEN|7k/8/8/3P4/3R4/8/8/K7|0|33|P|G:11:11|Q:w:;b:|S:d4");
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "d4", to: "d7" },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });

    expect(attacksOf(r).filter((a) => a.color === "w")).toHaveLength(0);
    const map = placementToMap(r.next.placement);
    expect(map.get("d5")).toEqual({ type: "p", color: "w" });
    expect(map.get("d4")).toEqual({ type: "r", color: "w" });
  });

  it("holds fire through Command Centers (no Command Center deletion by shell)", () => {
    const before = parseScFen("SCFEN|8/8/3k4/8/3R4/8/8/K7|0|33|P|G:11:11|Q:w:;b:|S:d4");
    let snap = addScAction({
      snapshot: before,
      action: { timing: "C", kind: "classical", color: "w", from: "d4", to: "d7" },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });

    expect(attacksOf(r).filter((a) => a.color === "w")).toHaveLength(0);
    const map = placementToMap(r.next.placement);
    expect(map.get("d6")).toEqual({ type: "k", color: "b" });
    expect(r.next.ccLives).toEqual(before.ccLives);
  });

  it("holds fire through allies (own Command Center on the ray)", () => {
    let snap = parseScFen("SCFEN|8/8/8/3K4/3R4/8/8/6k1|0|33|P|G:11:11|Q:w:;b:|S:d4");
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "d4", to: "d7" },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });

    expect(attacksOf(r).filter((a) => a.color === "w")).toHaveLength(0);
    const map = placementToMap(r.next.placement);
    expect(map.get("d5")).toEqual({ type: "k", color: "w" });
    expect(map.get("d4")).toEqual({ type: "r", color: "w" });
  });

  it("mined empty dest through a blocker collides upstream, mine stays armed", () => {
    const snap = parseScFen(
      "SCFEN|7k/8/3p4/8/3R4/8/8/K7|0|33|P|G:11:11|Q:w:C=d4d7;b:|S:d4|M:w:;b:d7",
    );
    const r = endScTurn(snap, { skipTurnStartChecks: true });

    const hit = attacksOf(r).find(
      (a) => a.kind === "capture" && a.from === "d4" && a.to === "d6",
    );
    expect(hit).toMatchObject({ victim: { piece: "p", color: "b" } });
    expect(r.resolved.attacks.some((a) => a.kind === "mineBlast")).toBe(false);
    expect(r.afterB.mines.some((m) => m.at === "d7")).toBe(true);
    const map = placementToMap(r.next.placement);
    expect(map.get("d6")).toBeUndefined();
  });
});
