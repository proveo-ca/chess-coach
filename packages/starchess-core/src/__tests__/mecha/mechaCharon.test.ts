// SPEC: _spec/specials/mecha-charon.puml
import { describe, expect, it } from "vitest";

import {
  addScAction,
  charonDiagonalSquaresFromPlacement,
  charonRayEdge,
  charonTargetShipsFromPlacement,
  endScTurn,
  parseScFen,
  placementToMap,
} from "../../index";

describe("mecha Charon free-aim diagonals", () => {
  it("offers every on-board diagonal square (13 from d4)", () => {
    const squares = charonDiagonalSquaresFromPlacement(
      "k6q/8/8/8/3B4/8/8/4K3",
      "d4",
    );
    expect(squares).toHaveLength(13);
    expect(squares).toEqual(expect.arrayContaining(["h8", "a1", "g1", "a7"]));
  });

  it("returns [] for a non-mecha origin", () => {
    expect(
      charonDiagonalSquaresFromPlacement("k6q/8/8/8/3B4/8/8/4K3", "h8"),
    ).toEqual([]);
  });
});

describe("mecha Charon ship-collision targets", () => {
  it("flies through non-ships to the first enemy ship", () => {
    // White mecha d4; white marine e5 sits on the d4→h8 ray; black ship h8.
    const targets = charonTargetShipsFromPlacement(
      "k6q/8/8/4P3/3B4/8/8/4K3",
      "d4",
    );
    expect(targets).toEqual(["h8"]);
  });

  it("is screened by an allied ship (blocks, never targetable)", () => {
    // White ship f6 screens black ship h8 on the same ray.
    const targets = charonTargetShipsFromPlacement(
      "k6q/8/5Q2/8/3B4/8/8/4K3",
      "d4",
    );
    expect(targets).toEqual([]);
  });

  it("only the first enemy ship per ray is targetable", () => {
    // Black ships f6 + h8 on one ray: f6 only.
    const targets = charonTargetShipsFromPlacement(
      "k6q/8/5q2/8/3B4/8/8/4K3",
      "d4",
    );
    expect(targets).toEqual(["f6"]);
  });

  it("returns one target per ray, sorted (highlight-all pick)", () => {
    // Black ships h8 (NE ray) and a1 (SW ray).
    const targets = charonTargetShipsFromPlacement(
      "k6q/8/8/8/3B4/8/8/q5K1",
      "d4",
    );
    expect(targets).toEqual(["a1", "h8"]);
  });

  it("returns [] for a non-mecha origin", () => {
    expect(
      charonTargetShipsFromPlacement("k6q/8/8/8/3B4/8/8/4K3", "h8"),
    ).toEqual([]);
  });
});

describe("mecha Charon validation (free aim)", () => {
  const snap = (queue = "Q:w:;b:") =>
    parseScFen(`SCFEN|k6q/8/5q2/8/3B4/8/8/4K3|11|33|P|G:22:22|${queue}`);

  it("accepts the first ship on a ray", () => {
    const out = addScAction({
      snapshot: snap(),
      action: { timing: "B", kind: "charonMissiles", color: "w", from: "d4", to: "f6" },
    });
    expect(out.snapshot.queue?.actions).toMatchObject([
      { kind: "charonMissiles", from: "d4", to: "f6" },
    ]);
  });

  it("accepts the screened ship square — it fizzles at resolve, no kill", () => {
    let s = addScAction({
      snapshot: snap(),
      action: { timing: "B", kind: "charonMissiles", color: "w", from: "d4", to: "h8" },
    }).snapshot;
    const r = endScTurn(s, { skipTurnStartChecks: true });
    const map = placementToMap(r.next.placement);
    expect(map.get("f6")).toMatchObject({ type: "q", color: "b" });
    expect(map.get("h8")).toMatchObject({ type: "q", color: "b" });
  });

  it("accepts a non-ship diagonal — it fizzles at resolve", () => {
    let s = parseScFen(
      "SCFEN|k6q/8/8/4P3/3B4/8/8/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    s = addScAction({
      snapshot: s,
      action: { timing: "B", kind: "charonMissiles", color: "w", from: "d4", to: "e5" },
    }).snapshot;
    const r = endScTurn(s, { skipTurnStartChecks: true });
    expect(placementToMap(r.next.placement).get("e5")).toMatchObject({
      type: "p",
      color: "w",
    });
  });

  it("rejects an off-diagonal aim", () => {
    expect(() =>
      addScAction({
        snapshot: snap(),
        action: { timing: "B", kind: "charonMissiles", color: "w", from: "d4", to: "d5" },
      }),
    ).toThrow(/Mecha diagonal/);
  });

  it("validates F aim from the post-move square after a mecha classical", () => {
    // Mecha b2→c3; b4 is diagonal from c3 but orthogonal from b2.
    let s = parseScFen("SCFEN|k7/8/8/8/8/8/1B6/4K3|11|33|P|G:22:22|Q:w:;b:");
    s = addScAction({
      snapshot: s,
      action: { timing: "C", kind: "classical", color: "w", from: "b2", to: "c3" },
    }).snapshot;
    s = addScAction({
      snapshot: s,
      action: { timing: "F", kind: "charonMissiles", color: "w", from: "b2", to: "b4" },
    }).snapshot;
    const r = endScTurn(s, { skipTurnStartChecks: true });
    expect(placementToMap(r.next.placement).get("c3")).toMatchObject({
      type: "b",
      color: "w",
    });
  });
});

describe("mecha Charon resolve + fizzle ray", () => {
  it("removes the ship and leaves the Mecha in place", () => {
    let s = parseScFen(
      "SCFEN|k6q/8/8/8/3B4/8/8/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    s = addScAction({
      snapshot: s,
      action: { timing: "B", kind: "charonMissiles", color: "w", from: "d4", to: "h8" },
    }).snapshot;
    const r = endScTurn(s, { skipTurnStartChecks: true });
    const map = placementToMap(r.next.placement);
    expect(map.get("h8")).toBeUndefined();
    expect(map.get("d4")).toMatchObject({ type: "b", color: "w" });
  });

  it("fizzles to a no-op when the ship leaves before an F strike", () => {
    // White F Charon queued on h8; black classical slides the ship to g8.
    // Queue-time placement still shows the ship, so validation passes; at
    // resolve the ray is empty and the missiles fly through.
    let s = parseScFen(
      "SCFEN|k6q/8/8/8/3B4/4P3/8/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    s = addScAction({
      snapshot: s,
      action: { timing: "C", kind: "classical", color: "w", from: "e3", to: "e4" },
    }).snapshot;
    s = addScAction({
      snapshot: s,
      action: { timing: "F", kind: "charonMissiles", color: "w", from: "d4", to: "h8" },
    }).snapshot;
    s = addScAction({
      snapshot: s,
      action: { timing: "C", kind: "classical", color: "b", from: "h8", to: "g8" },
    }).snapshot;
    const r = endScTurn(s, { skipTurnStartChecks: true });
    const map = placementToMap(r.next.placement);
    expect(map.get("g8")).toMatchObject({ type: "q", color: "b" });
    expect(
      r.events.some((e) => e.kind === "charonMissiles" && e.phase === "specialAfter"),
    ).toBe(true);
  });

  it("fire-and-forget: kills even when the Mecha died in crossfire", () => {
    // Black Tank takes the white mecha d4 in C; the paid white F strike from
    // d4 still kills the ship on h8.
    let s = parseScFen(
      "SCFEN|k6q/8/8/8/r2B4/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    s = addScAction({
      snapshot: s,
      action: { timing: "C", kind: "classical", color: "w", from: "e2", to: "e3" },
    }).snapshot;
    s = addScAction({
      snapshot: s,
      action: { timing: "F", kind: "charonMissiles", color: "w", from: "d4", to: "h8" },
    }).snapshot;
    s = addScAction({
      snapshot: s,
      action: { timing: "C", kind: "classical", color: "b", from: "a4", to: "d4" },
    }).snapshot;
    const r = endScTurn(s, { skipTurnStartChecks: true });
    const map = placementToMap(r.next.placement);
    expect(map.get("d4")).toMatchObject({ type: "r", color: "b" });
    expect(map.get("h8")).toBeUndefined();
    expect(
      r.events.some((e) => e.kind === "charonMissiles" && e.phase === "specialAfter"),
    ).toBe(true);
  });

  it("charonRayEdge extends a diagonal to the board edge", () => {
    expect(charonRayEdge("d4", "f6")).toBe("h8");
    expect(charonRayEdge("d4", "h8")).toBe("h8");
    expect(charonRayEdge("d4", "b2")).toBe("a1");
    // Orthogonal F-drift extends orthogonally to the edge.
    expect(charonRayEdge("d4", "d6")).toBe("d8");
    // Non-ray aims fall back to `to`.
    expect(charonRayEdge("d4", "e6")).toBe("e6");
  });
});
