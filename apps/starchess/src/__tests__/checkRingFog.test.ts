/**
 * Check rings must never confirm a king the viewer cannot see yet.
 * Drives the live wiring (matchReducer queue → intent policy → overlays), not
 * just the pure projection: a fogged king stays unringed at intent time.
 */
import { describe, expect, it } from "vitest";

import { createInitialMatchState, matchReducer } from "~/app/matchReducer";
import {
  intentOverlayActions,
  intentOverlayViewer,
} from "~/app/intentOverlayPolicy";
import { intentOverlaysFromQueue } from "~/presentation/combat/intentOverlays";
import type { MatchState } from "~/types/match";

/** Same read LiveStarChessBoard does through useIntentOverlays (live phase). */
const liveOverlays = (s: MatchState) => {
  const snap = s.liveSnapshot;
  return intentOverlaysFromQueue(
    intentOverlayActions(s.phase, s.viewer, "both", snap.queue?.actions, null),
    {
      placement: snap.placement,
      siegedRooks: snap.siegedRooks,
      mines: snap.mines,
      viewer: intentOverlayViewer(s.phase, s.viewer, "both"),
    },
  );
};

describe("check rings under player fog", () => {
  // Knight fog lesson geometry, one hop later: Nf4 sees d2–h6, so Kh8 and its
  // pawn are dark. Nf4→g6 both lights *and* checks h8 once it resolves.
  const scfen = "SCFEN|7k/7p/8/8/5N2/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
  const queueKnightHop = () => {
    const loaded = matchReducer(createInitialMatchState(), {
      type: "LOAD_SCFEN",
      scfen,
    });
    return matchReducer(loaded, {
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "f4",
        to: "g6",
      },
    });
  };

  it("queuing Nf4→g6 ghosts the hop without ringing the hidden Kh8", () => {
    const out = liveOverlays(queueKnightHop());
    expect(out.destinations).toEqual([{ at: "g6", color: "w", piece: "n" }]);
    expect(out.checks).toEqual([]);
  });

  it("rings the king once the viewer actually sees it", () => {
    // Same board with the hop resolved — Ng6 lights h8, so the ring is earned.
    const seen = matchReducer(createInitialMatchState(), {
      type: "LOAD_SCFEN",
      scfen: "SCFEN|7k/7p/6N1/8/8/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
    });
    expect(liveOverlays(seen).checks).toEqual([{ at: "h8" }]);
  });
});
