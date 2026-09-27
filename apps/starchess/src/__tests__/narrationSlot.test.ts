import { createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";

import { createNarrationSlot } from "~/tutorial/narrationSlot";
import type { TutorialNarrationState } from "~/types/tutorial";

const host = (provide: ReturnType<typeof createNarrationSlot>["provide"], initial: TutorialNarrationState) =>
  createRoot((dispose) => {
    const [n, setN] = createSignal(initial);
    provide(n);
    return { setN, dispose };
  });

describe("createNarrationSlot", () => {
  it("reads the mounted host's narration and falls silent when it unmounts", () => {
    createRoot((disposeScreen) => {
      const slot = createNarrationSlot();
      expect(slot.narration()).toEqual({});
      const a = host(slot.provide, { scfen: "A" });
      expect(slot.narration().scfen).toBe("A");
      a.setN({ scfen: "A2" });
      expect(slot.narration().scfen).toBe("A2");
      a.dispose();
      expect(slot.narration()).toEqual({});
      disposeScreen();
    });
  });

  it("a replaced host's late cleanup does not silence the new host", () => {
    createRoot((disposeScreen) => {
      const slot = createNarrationSlot();
      const a = host(slot.provide, { scfen: "A" });
      const b = host(slot.provide, { scfen: "B" });
      a.dispose();
      expect(slot.narration().scfen).toBe("B");
      b.dispose();
      disposeScreen();
    });
  });

  it("an identical republish is not a change", () => {
    createRoot((disposeScreen) => {
      const slot = createNarrationSlot();
      const a = host(slot.provide, { scfen: "A", queue: [] });
      const first = slot.narration();
      a.setN({ scfen: "A", queue: [] });
      expect(slot.narration()).toBe(first);
      a.dispose();
      disposeScreen();
    });
  });
});
