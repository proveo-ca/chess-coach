import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";

import { placementToMap } from "~/starchess/board";
import {
  KING_HUNT_LIVE_START_SCFEN,
  queueKingHuntLiveOpponent,
} from "~/starchess/demos/kingHunt";
import { endScTurn } from "~/starchess/endScTurn";
import { classicFenFromSc, formatScFen, hasExactKingPair, parseScFen } from "~/starchess/scfen";

describe("king hunt live first-move king color", () => {
  it("SCFen placement keeps black king after first End (e4→d5 + HP)", () => {
    const start = parseScFen(KING_HUNT_LIVE_START_SCFEN);
    expect(placementToMap(start.placement).get("e4")).toEqual({ type: "k", color: "b" });
    expect(placementToMap(start.placement).get("h1")).toEqual({ type: "k", color: "w" });

    const queued = queueKingHuntLiveOpponent(start).snapshot;
    const { next, resolved } = endScTurn(queued);

    expect(hasExactKingPair(next.placement)).toBe(true);
    const map = placementToMap(next.placement);
    expect(map.get("d5")).toEqual({ type: "k", color: "b" });
    expect(map.get("h1")).toEqual({ type: "k", color: "w" });
    expect(map.get("e4")).toBeUndefined();

    // chess.js load of classic export must agree
    const fen = classicFenFromSc(next, "w");
    const g = new Chess(fen);
    expect(g.get("d5")).toEqual({ type: "k", color: "b" });
    expect(g.get("h1")).toEqual({ type: "k", color: "w" });

    // Round-trip SCFEN
    const raw = formatScFen({ ...next, queue: { actions: [] } });
    expect(raw).toMatch(/2Nk4|3k4|2k/); // black k still lowercase in placement
    expect(parseScFen(raw).placement).toBe(next.placement);

    // HP applied to black, not a color flip
    expect(next.kingLives.b).toBe(2);
    expect(resolved.attacks.some((a) => a.kind === "kingShot" && a.target === "b")).toBe(true);
  });
});
