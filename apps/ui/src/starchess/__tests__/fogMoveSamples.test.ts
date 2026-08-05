import { describe, expect, it } from "vitest";

import { endScTurn } from "~/starchess/endScTurn";
import { intentOverlaysFromQueue } from "~/starchess/intentOverlays";
import {
  FOG_MOVE_KING_PLY_SC,
  FOG_MOVE_KING_START_SCFEN,
  FOG_MOVE_KING_STEPS,
  queueFogMoveKingStep,
} from "~/starchess/demos/fogMoveSamples";
import { parseScFen } from "~/starchess/scfen";

describe("fog move samples (intent → resolve)", () => {
  it("king queues intent without changing placement", () => {
    const before = parseScFen(FOG_MOVE_KING_START_SCFEN);
    const queued = queueFogMoveKingStep(before, FOG_MOVE_KING_STEPS[0]!);
    expect(queued.placement).toBe(before.placement);
    expect(
      intentOverlaysFromQueue(queued.queue?.actions, { placement: queued.placement }).destinations,
    ).toEqual([{ at: "e5", color: "w", piece: "k" }]);
    const { next, resolved } = endScTurn(queued);
    expect(resolved.moves.some((m) => m.from === "d4" && m.to === "e5")).toBe(true);
    expect(next.placement).toContain("K"); // king still on board
    expect(FOG_MOVE_KING_PLY_SC[1]?.placement).toBe(next.placement);
  });
});
