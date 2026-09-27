import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MatchStore } from "~/types/match";

const base = vi.hoisted(() => ({
  props: null as null | { hintAlertSquares?: readonly string[] },
  store: null as null | MatchStore,
}));

vi.mock("~/app/BaseScreen.tsx", async () => {
  const { useMatchStore } = await import("~/app/MatchStoreContext");
  return {
    BaseScreen: (props: { hintAlertSquares?: readonly string[] }) => {
      base.props = props;
      base.store = useMatchStore();
      return null;
    },
  };
});

import { LiveLessonHost } from "~/demos/LiveLessonHost";
import { emptyCCIntel, getSideVision, placementToMap } from "@chess-coach/starchess-core";
import { lessonBoard, nextCCSighting } from "~/tutorial/tutorialScript";

const ATTACK_4 = "live-play-attack-4";
const scfen = (placement: string) => `SCFEN|${placement}|12|33|P|G:21:22|Q:w:;b:`;
const CC_LIT = scfen("8/1k6/1R6/8/8/8/8/4K3");
const CC_FOGGED = scfen("8/1k6/8/8/8/8/8/4K3");
const E8_LIT_EMPTY = scfen("8/1k6/4R3/8/8/8/8/4K3");

const litForWhite = (s: string, sq: string) =>
  getSideVision(placementToMap(s.split("|")[1]), "w").litSquares.has(sq as never);

const rings = () => base.props?.hintAlertSquares ?? [];
const load = (s: string) => base.store!.dispatch({ type: "LOAD_SCFEN", scfen: s, stored: 3 });

const mount = () => {
  const [key, setKey] = createSignal(ATTACK_4);
  render(() => (
    <LiveLessonHost board={lessonBoard("live-play", ATTACK_4)} lessonKey={key()} tutorial />
  ));
  return setKey;
};

afterEach(() => {
  cleanup();
  base.props = null;
  base.store = null;
});

describe("LiveLessonHost CC sighting (alertLatch: cc)", () => {
  it("rings the enemy CC home square e8 before the CC has been seen", () => {
    mount();
    expect(rings()).toContain("e8");
    expect(rings()).not.toContain("b7");
  });

  it("moves the ring to the CC once lit, and keeps it there after the CC is fogged again", () => {
    expect(litForWhite(CC_LIT, "b7")).toBe(true);
    expect(litForWhite(CC_FOGGED, "b7")).toBe(false);
    mount();
    load(CC_LIT);
    expect(rings()).toContain("b7");
    expect(rings()).not.toContain("e8");
    load(CC_FOGGED);
    expect(rings()).toContain("b7");
    expect(rings()).not.toContain("e8");
  });

  it("keeps the ring on e8 when e8 is lit and empty but the CC is still unseen", () => {
    expect(litForWhite(E8_LIT_EMPTY, "e8")).toBe(true);
    expect(litForWhite(E8_LIT_EMPTY, "b7")).toBe(false);
    mount();
    load(E8_LIT_EMPTY);
    expect(rings()).toContain("e8");
    expect(rings()).not.toContain("b7");
  });

  it("a lesson key change resets the ring to the home square", () => {
    const setKey = mount();
    load(CC_LIT);
    expect(rings()).toContain("b7");
    setKey(`${ATTACK_4}#retry`);
    expect(rings()).toContain("e8");
    expect(rings()).not.toContain("b7");
  });

  it("a black viewer's unseen enemy CC starts on e1 (fold helpers; the host reloads as white)", () => {
    const home = emptyCCIntel("w").focus;
    expect(home).toBe("e1");
    expect(nextCCSighting(home, { ccAt: "e1", ccVisible: false })).toBe("e1");
    expect(nextCCSighting(home, { ccAt: "d2", ccVisible: true })).toBe("d2");
    expect(nextCCSighting("d2", { ccAt: "d3", ccVisible: false })).toBe("d2");
  });
});
