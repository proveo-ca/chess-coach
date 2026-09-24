/**
 * Pure intent / review-vision policy (no Solid).
 */
import { describe, expect, it } from "vitest";

import {
  boardVisionFor,
  intentOverlayActions,
  intentOverlayViewer,
  playerFogOccultsMoves,
} from "~/app/intentOverlayPolicy";
import type { ScAction } from "@chess-coach/starchess-core";

const sampleQueue: ScAction[] = [
  { timing: "C", kind: "classical", color: "w", from: "e2", to: "e4", seq: 0 },
  { timing: "B", kind: "stimStep", color: "b", from: "e7", to: "e5", seq: 1 },
];

describe("intentOverlayPolicy", () => {
  it("live play scopes overlays to the match viewer", () => {
    expect(intentOverlayViewer("planning", "w", "both")).toBe("w");
    expect(intentOverlayViewer("planning", "b", "w")).toBe("b");
    const actions = intentOverlayActions(
      "planning",
      "w",
      "both",
      sampleQueue,
      null,
    );
    expect(actions?.map((a) => a.color)).toEqual(["w"]);
  });

  it("review BOTH is omniscient (no viewer filter)", () => {
    expect(intentOverlayViewer("gameOver", "w", "both")).toBeUndefined();
    const actions = intentOverlayActions(
      "gameOver",
      "w",
      "both",
      undefined,
      sampleQueue,
    );
    expect(actions).toEqual(sampleQueue);
  });

  it("review VISION w|b scopes like live", () => {
    expect(intentOverlayViewer("gameOver", "w", "b")).toBe("b");
    const actions = intentOverlayActions(
      "gameOver",
      "w",
      "b",
      undefined,
      sampleQueue,
    );
    expect(actions?.map((a) => a.color)).toEqual(["b"]);
  });

  it("boardVisionFor maps filter to fog / mode", () => {
    expect(boardVisionFor("planning", "both")).toEqual({
      fog: true,
      visionMode: "player",
    });
    expect(boardVisionFor("gameOver", "both")).toEqual({
      fog: false,
      visionMode: "observer",
    });
    expect(boardVisionFor("gameOver", "w")).toEqual({
      fog: true,
      visionMode: "player",
    });
  });

  it("playerFogOccultsMoves follows live player fog (app-wide input policy)", () => {
    expect(
      playerFogOccultsMoves({ fog: true, visionMode: "player" }),
    ).toBe(true);
    expect(
      playerFogOccultsMoves({ fog: false, visionMode: "observer" }),
    ).toBe(false);
    expect(
      playerFogOccultsMoves({ fog: false, visionMode: "player" }),
    ).toBe(false);
  });
});
