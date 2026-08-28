import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { DeployAnimation } from "~/presentation/animations/components/DeployAnimation";
import type { DeployCue } from "~/types/cues";

afterEach(cleanup);

const slotFor = (cue: DeployCue) => {
  const { container } = render(() => (
    <DeployAnimation cues={[cue]} boardWidth={400} boardHeight={400} />
  ));
  return container.querySelector<HTMLElement>(
    `[data-deploy-piece='${cue.piece}']`,
  )!;
};

/**
 * The Hoverbike's air jet is `MECHANOID_THRUST.n === "air"`, and `.thrustAir`
 * was a fixed light blue — only the Ship's `"team"` thrust ever set a tint, so
 * black bikes landed on a blue flame.
 * // SPEC: _spec/apps/starchess/architecture/board-entities.puml
 */
describe("DeployAnimation · team tint", () => {
  it("tints the Hoverbike's air jet with the dropping player's swatch", () => {
    const black = slotFor({ id: "spawn-n", piece: "n", color: "b", at: "e2" });
    expect(black.style.getPropertyValue("--team-tint")).toBe("#a22");

    const white = slotFor({ id: "spawn-n", piece: "n", color: "w", at: "e2" });
    expect(white.style.getPropertyValue("--team-tint")).toBe("#3b7dd8");
  });

  it("tints every thrust kind, not just the Ship's", () => {
    // n = air, r = fuel, q = team — all three read the same var now.
    for (const piece of ["n", "r", "q"] as const) {
      const slot = slotFor({ id: `spawn-${piece}`, piece, color: "b", at: "e2" });
      expect(slot.style.getPropertyValue("--team-rgb")).toBe("170, 34, 34");
    }
  });
});
