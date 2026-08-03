import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { QueenJumpAnimation } from "~/broodwar/animations/QueenJumpAnimation";
import type { MoveCue, QueenJumpTrail } from "~/types/broodwar";

afterEach(cleanup);

describe("QueenJumpAnimation", () => {
  it("renders the 200ms stretched jump, 50ms appear, green thrusters, and 1000ms twin trails", () => {
    const cue: MoveCue = { id: "jump-test", piece: "q", color: "w", from: "a1", to: "c3" };
    const trail: QueenJumpTrail = { id: "jump-test-trail", color: "w", from: "a1", to: "c3" };
    const { container } = render(() => (
      <QueenJumpAnimation cues={[cue]} trails={[trail]} boardWidth={480} boardHeight={480} />
    ));

    const layer = container.querySelector("[data-broodwar-jump-layer]");
    expect(layer?.getAttribute("style")).toContain("--jump-ms: 200ms");
    expect(layer?.getAttribute("style")).toContain("--jump-appear-ms: 50ms");
    expect(layer?.getAttribute("style")).toContain("--jump-trail-ms: 1000ms");

    const hull = container.querySelector('[data-jump-piece="q"]');
    expect(hull).toBeTruthy();
    expect(hull?.getAttribute("data-jump-deg")).toBe("-45");
    expect(hull?.querySelectorAll('[data-part="jump-thruster"]')).toHaveLength(2);
    expect(container.querySelector('[class*="jumpAppear"]')).toBeTruthy();
    expect(container.querySelectorAll("[data-jump-trail]")).toHaveLength(2);
  });
});
