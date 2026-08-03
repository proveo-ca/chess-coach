import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { AttackAnimation } from "~/starchess/animations/AttackAnimation";
import { BISHOP_CHARON } from "~/starchess/animations/bishopCharon";
import { CHARON_IMPACT_MS } from "~/starchess/specials/bishopCharon";
import type { AttackCue } from "~/types/starchess";

afterEach(cleanup);

describe("bishopCharon attack cue", () => {
  it("renders the Charon kind, twin missiles, and the 250ms cue window", () => {
    const cue: AttackCue = {
      id: "charon-test",
      piece: "b",
      color: "w",
      from: "d4",
      to: "h8",
      anim: BISHOP_CHARON,
    };
    const { container } = render(() => (
      <AttackAnimation cues={[cue]} boardWidth={480} boardHeight={480} />
    ));

    const origin = container.querySelector('[data-attack-anim="bishopCharon"]');
    expect(origin).toBeTruthy();
    expect(origin?.querySelector('svg[data-charon-armed="true"]')).toBeTruthy();
    expect(origin?.querySelectorAll('[data-part="charon-launcher-caps"]')).toHaveLength(0);
    expect(
      Array.from(origin?.querySelectorAll('[data-part="charon-launcher"]') ?? []).map((el) =>
        el.getAttribute("transform"),
      ),
    ).toEqual([expect.stringContaining("rotate(-45"), expect.stringContaining("rotate(-45")]);
    expect(container.querySelectorAll("[data-charon-missile]")).toHaveLength(2);
    const volley = container.querySelector('[class*="charonVolley"]');
    expect(volley?.getAttribute("style")).toContain(`--attack-ms: ${CHARON_IMPACT_MS}ms`);
    expect(volley?.getAttribute("style")).toContain("--charon-span");
  });
});
