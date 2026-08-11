/**
 * Deploy intent + fog: vision stays resolved-only; attack/move circles above fog.
 */
import { describe, expect, it } from "vitest";
import {
  getSideVision,
  parseScFen,
  placementToMap,
  scMovesFrom,
} from "@chess-coach/starchess-core";

import { fogForViewer } from "~/app/selectors";
import {
  createInitialMatchState,
  matchReducer,
} from "~/app/matchReducer";
import { intentOverlaysFromQueue } from "~/presentation/combat/intentOverlays";
import {
  occupancyForQueuedMoves,
  pieceAtQueuedSquare,
} from "~/presentation/board/occupancyForQueuedMoves";
import {
  legalDestsWithFogPawnAttacks,
  pawnFogAttackDests,
} from "~/presentation/board/pawnFogAttackDests";

const litKey = (v: { litSquares: ReadonlySet<string> }) =>
  [...v.litSquares].sort().join(",");

describe("deploy intent must not grant vision", () => {
  it("getSideVision ignores queued spawn + classical attack/move", () => {
    // Deploy marine d1 then C d1→d2 — vision is placement-only (queue ignored).
    const bare = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:01:11|B:3:3|Q:w:;b:",
    );
    const queued = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:01:11|B:3:3|Q:w:B=spawn:e1:d1:p,C=d1d2;b:",
    );
    const v0 = getSideVision(bare.placement, "w");
    const v1 = getSideVision(queued.placement, "w");
    expect(litKey(v1)).toBe(litKey(v0));
    expect(queued.placement).toBe(bare.placement);
  });

  it("fogForViewer is unchanged when spawn + C sit on the queue", () => {
    let base = createInitialMatchState();
    base = matchReducer(base, {
      type: "LOAD_SCFEN",
      scfen: "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|B:3:3|Q:w:;b:",
    });
    let withQueue = createInitialMatchState();
    withQueue = matchReducer(withQueue, {
      type: "LOAD_SCFEN",
      scfen:
        "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|B:3:3|Q:w:B=spawn:e1:d1:p,C=d1c2;b:",
    });
    expect(litKey(fogForViewer(withQueue))).toBe(litKey(fogForViewer(base)));
  });

  it("occupancyForQueuedMoves fog filter does not use spawn vision", () => {
    // King a1 lights a1–b2 only. Black pawn c2 is outside king vision.
    // Queued knight spawn on b1 would light c2 — must not for fog filter.
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/2p5/K7|1|33|P|G:01:11|B:3:3|Q:w:B=spawn:a1:b1:n;b:",
    );
    const raw = placementToMap(snap.placement);
    expect(raw.get("c2")?.type).toBe("p");
    expect(getSideVision(raw, "w").litSquares.has("c2")).toBe(false);
    const { map } = occupancyForQueuedMoves(raw, "w", true, snap);
    expect(map.get("b1")).toEqual({ type: "n", color: "w" });
    expect(map.has("c2")).toBe(false);
  });
});

describe("intent circles above fog / pawn diagonals", () => {
  it("rings capture dest even when target square is off resolved vision", () => {
    // Bd2→c3 capture black pawn; board vision may fog c3 for other units.
    const actions = [
      {
        timing: "C" as const,
        kind: "classical" as const,
        color: "w" as const,
        from: "d2" as const,
        to: "c3" as const,
        seq: 0,
      },
    ];
    const out = intentOverlaysFromQueue(actions, {
      placement: "4k3/8/8/8/8/2p5/3B4/4K3",
      viewer: "w",
    });
    expect(out.checks).toEqual([{ at: "c3" }]);
    expect(out.destinations.some((d) => d.at === "c3")).toBe(true);
  });

  it("spawn + classical: move ghost and attack ring both present", () => {
    const actions = [
      {
        timing: "B" as const,
        kind: "spawn" as const,
        color: "w" as const,
        from: "e1" as const,
        to: "d1" as const,
        unit: "p" as const,
        seq: 0,
      },
      {
        timing: "C" as const,
        kind: "classical" as const,
        color: "w" as const,
        from: "d1" as const,
        to: "c2" as const,
        seq: 1,
      },
    ];
    // c2 empty — pawn diagonal fog attack intent still gets a red ring.
    const out = intentOverlaysFromQueue(actions, {
      placement: "4k3/8/8/8/8/8/8/4K3",
      viewer: "w",
    });
    expect(out.destinations).toEqual(
      expect.arrayContaining([
        { at: "d1", color: "w", piece: "p" },
        { at: "c2", color: "w", piece: "p" },
      ]),
    );
    expect(out.checks).toEqual([{ at: "c2" }]);
    expect(out.canisters).toEqual([{ at: "d1", color: "w" }]);
  });

  it("pawnFogAttackDests offers diagonals without enemy", () => {
    const map = placementToMap("4k3/8/8/8/8/8/4P3/4K3");
    expect(pawnFogAttackDests("e2", "w", map).sort()).toEqual(["d3", "f3"]);
  });

  it("legalDestsWithFogPawnAttacks merges empty diagonals under fog only", () => {
    const map = placementToMap("4k3/8/8/8/8/8/4P3/4K3");
    const classical = scMovesFrom(map, "e2", "w").map((m) => m.to);
    expect(classical.sort()).toEqual(["e3", "e4"]);
    const fogOn = legalDestsWithFogPawnAttacks(
      classical,
      "e2",
      { type: "p", color: "w" },
      map,
      true,
    );
    expect(fogOn.sort()).toEqual(["d3", "e3", "e4", "f3"]);
    const fogOff = legalDestsWithFogPawnAttacks(
      classical,
      "e2",
      { type: "p", color: "w" },
      map,
      false,
    );
    expect(fogOff.sort()).toEqual(["e3", "e4"]);
  });

  it("select about-to-deploy pawn still offers forward dests after vision split", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:01:11|B:3:3|Q:w:B=spawn:e1:d1:p;b:",
    );
    const raw = placementToMap(snap.placement);
    const { map, siegedRooks } = occupancyForQueuedMoves(raw, "w", true, snap);
    const piece = pieceAtQueuedSquare(raw, "d1", "w", snap.queue?.actions);
    expect(piece).toEqual({ type: "p", color: "w" });
    const classical = scMovesFrom(map, "d1", "w", { siegedRooks }).map((m) => m.to);
    const dests = legalDestsWithFogPawnAttacks(
      classical,
      "d1",
      piece!,
      map,
      true,
    );
    expect(dests).toContain("d2");
    expect(dests).toContain("c2");
    expect(dests).toContain("e2");
  });
});
