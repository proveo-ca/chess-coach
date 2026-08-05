import { describe, expect, it } from "vitest";

import { placementToMap } from "~/starchess/board";
import {
  KING_HUNT_LIVE_START_SCFEN,
  queueKingHuntLiveOpponent,
} from "~/starchess/demos/kingHunt";
import { endScTurn } from "~/starchess/endScTurn";
import { addScMove } from "~/starchess/scActions";
import { hasExactKingPair, parseScFen, formatScFen } from "~/starchess/scfen";

const kingsOf = (placement: string) =>
  [...placementToMap(placement).entries()].filter(([, p]) => p.type === "k");

const assertExactKings = (placement: string, label: string) => {
  expect(hasExactKingPair(placement), `${label} ${placement}`).toBe(true);
  expect(kingsOf(placement).filter(([, p]) => p.color === "w")).toHaveLength(1);
  expect(kingsOf(placement).filter(([, p]) => p.color === "b")).toHaveLength(1);
};

describe("king integrity — never capture/convert a king", () => {
  it("keeps both kings when white king and black rook arrive on the same empty square", () => {
    // White king d4→c4; black rook a4→c4 (same rank).
    const start = parseScFen(
      "SCFEN|5k2/8/8/8/r2K4/8/8/8|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(placementToMap(start.placement).get("a4")?.type).toBe("r");
    expect(placementToMap(start.placement).get("d4")?.type).toBe("k");
    let planned = addScMove(start, { color: "w", from: "d4", to: "c4" });
    planned = addScMove(planned, { color: "b", from: "a4", to: "c4" });
    const next = endScTurn(planned).next;
    assertExactKings(next.placement, "clash");
    // King arrived first; rook must not replace it (bounce to b4).
    expect(placementToMap(next.placement).get("c4")).toEqual({ type: "k", color: "w" });
    expect(placementToMap(next.placement).get("b4")).toEqual({ type: "r", color: "b" });
  });

  it("keeps black king when a slider truncates onto the king after the king relocated first", () => {
    // Black d5×Nc5 (occupy); white rook c8→c1 (quiet past c5). Move-phase must
    // stop before the king — never delete/replace it.
    const start = parseScFen(
      "SCFEN|K1R5/8/8/2Nk4/8/8/8/8|1|33|P|G:11:11|Q:w:;b:",
    );
    let planned = addScMove(start, { color: "b", from: "d5", to: "c5" });
    planned = addScMove(planned, { color: "w", from: "c8", to: "c1" });
    const next = endScTurn(planned).next;
    assertExactKings(next.placement, "path-truncate");
    expect(placementToMap(next.placement).get("c5")).toEqual({ type: "k", color: "b" });
  });

  it("AFK live hunt never drops a king", () => {
    let snap = parseScFen(KING_HUNT_LIVE_START_SCFEN);
    for (let i = 0; i < 8; i++) {
      snap = endScTurn(queueKingHuntLiveOpponent(snap).snapshot).next;
      assertExactKings(snap.placement, `t${i}`);
      parseScFen(formatScFen({ ...snap, queue: { actions: [] } }));
    }
  });

  it("rejects zero kings, duplicate kings, and missing side on parse", () => {
    expect(() =>
      parseScFen("SCFEN|8/8/8/8/8/8/8/8|0|33|P|G:11:11|Q:w:;b:"),
    ).toThrow(/exactly 1 king per player/);
    expect(() =>
      parseScFen("SCFEN|K6K/8/8/8/4k3/8/8/8|0|33|P|G:11:11|Q:w:;b:"),
    ).toThrow(/exactly 1 king per player/);
    expect(() =>
      parseScFen("SCFEN|k6k/8/8/8/4K3/8/8/8|0|33|P|G:11:11|Q:w:;b:"),
    ).toThrow(/exactly 1 king per player/);
    expect(() =>
      parseScFen("SCFEN|4k3/8/8/8/8/8/8/8|0|33|P|G:11:11|Q:w:;b:"),
    ).toThrow(/exactly 1 king per player/);
  });
});
