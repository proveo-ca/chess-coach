/**
 * Spider mines — every route a unit can reach a mined tile by.
 *
 * `minePathContact.test.ts` covers the classical pass (attack-clear / walk-over /
 * mid-slide chase). This file covers the rest: gas steps, Command Center
 * deploys, phase-3 fog approaches, the marine double step, and move-phase races.
 *
 * The contract is one line: **a hostile mine detonates the moment an enemy unit
 * arrives on it or crosses it, wherever that arrival comes from.** Allied mines
 * stay inert underfoot on every one of those routes, and kings stay immune.
 * // SPEC: _spec/packages/starchess-core/resolve.puml
 */
import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  parseScFen,
  placementToMap,
  type ScAction,
  type ScFenSnapshot,
} from "../src/index";

type Resolved = ReturnType<typeof endScTurn>;

const resolve = (scfen: string, actions: readonly ScAction[]): Resolved => {
  let snap: ScFenSnapshot = parseScFen(scfen);
  for (const action of actions) {
    snap = addScAction({ snapshot: snap, action }).snapshot;
  }
  return endScTurn(snap, { skipTurnStartChecks: true });
};

const classical = (color: "w" | "b", from: string, to: string): ScAction =>
  ({ timing: "C", kind: "classical", color, from, to }) as ScAction;

const gasStep = (
  timing: "B" | "F",
  color: "w" | "b",
  from: string,
  to: string,
): ScAction => ({ timing, kind: "pawnDouble", color, from, to }) as ScAction;

const pieceAt = (r: Resolved, at: string) =>
  placementToMap(r.next.placement).get(at as never);

const mineOn = (r: Resolved, at: string) =>
  (r.next.mines ?? []).find((m) => m.at === at);

/** Special-phase blast: the event carries the mine owner + the unit it took. */
const specialBlast = (r: Resolved, kind: string, to: string) =>
  r.events.find((e) => e.kind === kind && e.to === to && "mineColor" in e && e.mineColor);

/** No mine fired anywhere — resolve lists and the UI event stream alike. */
const assertNoMineEvent = (r: Resolved) => {
  const blasts = [
    ...r.resolved.attacks,
    ...r.resolved.mineTriggers,
    ...r.resolved.moveCollisions,
    ...r.resolved.pathRevealAttacks,
    ...r.resolved.pathRevealMineTriggers,
  ].filter((a) => a.kind === "mineBlast");
  expect(blasts).toEqual([]);
  expect(r.events.filter((e) => "mineColor" in e && e.mineColor)).toEqual([]);
};

describe("gas steps arm mines", () => {
  it("B gas step onto a hostile mine — marine and mine both die", () => {
    const r = resolve(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|21|33|P|G:33:33|Q:w:;b:|M:w:;b:e3",
      [gasStep("B", "w", "e2", "e3")],
    );
    expect(specialBlast(r, "pawnDouble", "e3")).toEqual(
      expect.objectContaining({
        mineColor: "b",
        victim: { type: "p", color: "w" },
      }),
    );
    expect(pieceAt(r, "e2")).toBeUndefined();
    expect(pieceAt(r, "e3")).toBeUndefined();
    expect(mineOn(r, "e3")).toBeUndefined();
  });

  it("F gas step (move-then-gas) onto a hostile mine — same death", () => {
    // C e2→e3 lands clean, then the gas step recomputes +1 onto the mined e4.
    const r = resolve(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|21|33|P|G:33:33|Q:w:;b:|M:w:;b:e4",
      [classical("w", "e2", "e3"), gasStep("F", "w", "e2", "e3")],
    );
    expect(specialBlast(r, "pawnDouble", "e4")).toEqual(
      expect.objectContaining({
        mineColor: "b",
        victim: { type: "p", color: "w" },
      }),
    );
    expect(pieceAt(r, "e3")).toBeUndefined();
    expect(pieceAt(r, "e4")).toBeUndefined();
    expect(mineOn(r, "e4")).toBeUndefined();
  });

  it("gas step onto a last-rank mine — no promotion behind the blast", () => {
    const r = resolve(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|21|33|P|G:33:33|Q:w:;b:|M:w:;b:e8",
      [{ ...gasStep("B", "w", "e7", "e8"), promotion: "q" } as ScAction],
    );
    expect(specialBlast(r, "pawnDouble", "e8")).toBeDefined();
    expect(r.resolved.promotions).toEqual([]);
    expect(pieceAt(r, "e8")).toBeUndefined();
    expect(mineOn(r, "e8")).toBeUndefined();
  });

  it("gas step onto an ALLIED mine — inert, marine walks on", () => {
    const r = resolve(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|21|33|P|G:33:33|Q:w:;b:|M:w:e3;b:",
      [gasStep("B", "w", "e2", "e3")],
    );
    assertNoMineEvent(r);
    expect(pieceAt(r, "e3")).toEqual({ type: "p", color: "w" });
    expect(mineOn(r, "e3")).toEqual({ color: "w", at: "e3" });
  });
});

describe("deploys arm mines", () => {
  it("Command Center deploy onto a hostile mine — unit and mine both die", () => {
    const r = resolve(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|21|33|P|G:33:33|Q:w:;b:|M:w:;b:d2",
      [{ timing: "B", kind: "spawn", color: "w", from: "e1", to: "d2", unit: "p" } as ScAction],
    );
    // `unit` names the deployed unit the mine took; `victim` stays reserved for
    // an occupant the drop crushed (none here).
    expect(specialBlast(r, "spawn", "d2")).toEqual(
      expect.objectContaining({ mineColor: "b", unit: "p" }),
    );
    expect(pieceAt(r, "d2")).toBeUndefined();
    expect(mineOn(r, "d2")).toBeUndefined();
  });

  it("deploy that crushes an enemy AND lands on a mine — both deaths reported", () => {
    const r = resolve(
      "SCFEN|4k3/8/8/8/8/8/4n3/4K3|21|33|P|G:33:33|Q:w:;b:|M:w:;b:e2",
      [{ timing: "B", kind: "spawn", color: "w", from: "e1", to: "e2", unit: "p" } as ScAction],
    );
    expect(specialBlast(r, "spawn", "e2")).toEqual(
      expect.objectContaining({
        mineColor: "b",
        unit: "p",
        victim: { type: "n", color: "b" },
      }),
    );
    expect(pieceAt(r, "e2")).toBeUndefined();
    expect(mineOn(r, "e2")).toBeUndefined();
  });

  it("deploy onto an ALLIED mine — inert, unit lands", () => {
    const r = resolve(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|21|33|P|G:33:33|Q:w:;b:|M:w:d2;b:",
      [{ timing: "B", kind: "spawn", color: "w", from: "e1", to: "d2", unit: "p" } as ScAction],
    );
    assertNoMineEvent(r);
    expect(pieceAt(r, "d2")).toEqual({ type: "p", color: "w" });
    expect(mineOn(r, "d2")).toEqual({ color: "w", at: "d2" });
  });
});

describe("Tactical Jump — a mined tile stays a legal landing", () => {
  it("jumping onto an ALLIED mine — hull lands, mine stays armed", () => {
    const r = resolve(
      "SCFEN|4k3/8/8/8/8/8/8/Q3K3|21|33|P|G:33:33|Q:w:;b:|M:w:d4;b:",
      [{ timing: "B", kind: "queenWarp", color: "w", from: "a1", to: "d4" } as ScAction],
    );
    assertNoMineEvent(r);
    expect(pieceAt(r, "d4")).toEqual({ type: "q", color: "w" });
    expect(mineOn(r, "d4")).toEqual({ color: "w", at: "d4" });
  });

  it("jumping onto a HOSTILE mine — teleport is no attack, both die", () => {
    const r = resolve(
      "SCFEN|4k3/8/8/8/8/8/8/Q3K3|21|33|P|G:33:33|Q:w:;b:|M:w:;b:d4",
      [{ timing: "B", kind: "queenWarp", color: "w", from: "a1", to: "d4" } as ScAction],
    );
    expect(specialBlast(r, "queenWarp", "d4")).toEqual(
      expect.objectContaining({
        mineColor: "b",
        victim: { type: "q", color: "w" },
      }),
    );
    expect(pieceAt(r, "d4")).toBeUndefined();
    expect(mineOn(r, "d4")).toBeUndefined();
  });
});

describe("phase-3 fog approaches arm mines", () => {
  it("approach crosses a mid-path mine — chase kills it on the landing tile", () => {
    // Tank a1→a8 discovers the marine on a6 mid-walk, shoots from a4 and
    // occupies a6 — crossing the mine on a3 on the way. The shot stands; the
    // mine chases the tank to a6 exactly like a phase-2 slide.
    const r = resolve(
      "SCFEN|4k3/8/p7/8/8/8/8/R3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:a3",
      [classical("w", "a1", "a8")],
    );
    expect(r.resolved.pathRevealAttacks).toEqual([
      expect.objectContaining({ kind: "capture", to: "a6", pathRevealFrom: "a1" }),
    ]);
    expect(r.resolved.pathRevealMineTriggers).toEqual([
      expect.objectContaining({
        kind: "mineBlast",
        piece: "r",
        color: "w",
        to: "a6",
        mineColor: "b",
        chaseFrom: "a3",
        victim: { piece: "r", color: "w" },
      }),
    ]);
    expect(pieceAt(r, "a1")).toBeUndefined();
    expect(pieceAt(r, "a6")).toBeUndefined();
    expect(mineOn(r, "a3")).toBeUndefined();
  });

  it("fog-discovery capture lands on a mined tile — capture stands, mine takes the attacker", () => {
    const r = resolve(
      "SCFEN|4k3/8/p7/8/8/8/8/R3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:a6",
      [classical("w", "a1", "a8")],
    );
    expect(r.resolved.pathRevealAttacks).toEqual([
      expect.objectContaining({ kind: "capture", to: "a6", victim: { piece: "p", color: "b" } }),
    ]);
    expect(r.resolved.pathRevealMineTriggers).toEqual([
      expect.objectContaining({
        kind: "mineBlast",
        to: "a6",
        mineColor: "b",
        victim: { piece: "r", color: "w" },
      }),
    ]);
    // Walk-over on the landing tile — no chase missile.
    expect(r.resolved.pathRevealMineTriggers[0]).not.toHaveProperty("chaseFrom");
    expect(pieceAt(r, "a6")).toBeUndefined();
    expect(mineOn(r, "a6")).toBeUndefined();
  });

  it("kingShot stop square is mined — HP chip stands, mine takes the tank", () => {
    const r = resolve(
      "SCFEN|8/8/k7/8/8/8/8/R3K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:a5",
      [classical("w", "a1", "a8")],
    );
    expect(r.next.kingLives).toEqual({ w: 3, b: 2 });
    expect(r.resolved.pathRevealMineTriggers).toEqual([
      expect.objectContaining({
        kind: "mineBlast",
        to: "a5",
        mineColor: "b",
        victim: { piece: "r", color: "w" },
      }),
    ]);
    expect(pieceAt(r, "a5")).toBeUndefined();
    expect(mineOn(r, "a5")).toBeUndefined();
  });

  it("approach over an ALLIED mine — inert, attacker occupies", () => {
    const r = resolve(
      "SCFEN|4k3/8/p7/8/8/8/8/R3K3|0|33|P|G:11:11|Q:w:;b:|M:w:a3;b:",
      [classical("w", "a1", "a8")],
    );
    assertNoMineEvent(r);
    expect(pieceAt(r, "a6")).toEqual({ type: "r", color: "w" });
    expect(mineOn(r, "a3")).toEqual({ color: "w", at: "a3" });
  });
});

describe("marine path contact — the front step walks its path", () => {
  it("classical double step crosses a mine — chase kills the marine", () => {
    const r = resolve(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:e3",
      [classical("w", "e2", "e4")],
    );
    expect(r.resolved.mineTriggers).toEqual([
      expect.objectContaining({
        kind: "mineBlast",
        piece: "p",
        color: "w",
        to: "e4",
        mineColor: "b",
        chaseFrom: "e3",
        victim: { piece: "p", color: "w" },
      }),
    ]);
    expect(pieceAt(r, "e4")).toBeUndefined();
    expect(mineOn(r, "e3")).toBeUndefined();
  });

  it("double step over an ALLIED mine — inert", () => {
    const r = resolve(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:e3;b:",
      [classical("w", "e2", "e4")],
    );
    assertNoMineEvent(r);
    expect(pieceAt(r, "e4")).toEqual({ type: "p", color: "w" });
    expect(mineOn(r, "e3")).toEqual({ color: "w", at: "e3" });
  });
});

describe("move-phase races — unchanged, the mine outlives the trade", () => {
  it("both movers die racing onto a mined tile — mine survives", () => {
    // White owns the mine (inert underfoot); the black marine steps onto it the
    // same turn and dies to the race instead. The mine is never contacted: the
    // black marine is removed before it lands.
    const r = resolve(
      "SCFEN|4k3/8/8/8/4p3/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:e3;b:",
      [classical("w", "e2", "e3"), classical("b", "e4", "e3")],
    );
    assertNoMineEvent(r);
    expect(pieceAt(r, "e3")).toBeUndefined();
    expect(r.resolved.moveCollisions).toHaveLength(2);
    expect(mineOn(r, "e3")).toEqual({ color: "w", at: "e3" });
  });

  it("first arrival spends the mine — the second mover inherits a clean tile", () => {
    const r = resolve(
      "SCFEN|4k3/8/8/8/4p3/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:e3",
      [classical("w", "e2", "e3"), classical("b", "e4", "e3")],
    );
    expect(r.resolved.mineTriggers).toEqual([
      expect.objectContaining({
        kind: "mineBlast",
        color: "w",
        to: "e3",
        mineColor: "b",
        victim: { piece: "p", color: "w" },
      }),
    ]);
    expect(pieceAt(r, "e3")).toEqual({ type: "p", color: "b" });
    expect(mineOn(r, "e3")).toBeUndefined();
  });
});
