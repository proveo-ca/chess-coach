import { cleanup, render } from "@solidjs/testing-library";
import type { Square } from "chess.js";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it } from "vitest";

import { CCDamageOverlay } from "~/presentation/animations/components/ccDamageOverlay";
import type { CCDamageCue } from "~/types/cues";

afterEach(cleanup);

const cue = (
  id: string,
  at: Square,
  damage: CCDamageCue["damage"],
): CCDamageCue => ({ id, at, damage, seed: 7, impactSeq: 1 });

const slotIds = (container: HTMLElement): (string | null)[] =>
  [...container.querySelectorAll("[data-cc-id]")].map((el) =>
    el.getAttribute("data-cc-id"),
  );

describe("CCDamageOverlay · cue removal", () => {
  it("drops a head id mid-life without throwing", () => {
    const [cues, setCues] = createSignal<CCDamageCue[]>([
      cue("w", "e1", "smallFire"),
      cue("b", "e8", "bigFire"),
    ]);
    const { container } = render(() => (
      <CCDamageOverlay cues={cues()} boardWidth={400} boardHeight={400} />
    ));
    expect(slotIds(container)).toEqual(["w", "b"]);
    expect(() => setCues([cue("b", "e8", "bigFire")])).not.toThrow();
    expect(slotIds(container)).toEqual(["b"]);
  });

  it("drops to empty without throwing", () => {
    const [cues, setCues] = createSignal<CCDamageCue[]>([
      cue("w", "e1", "smallFire"),
    ]);
    const { container } = render(() => (
      <CCDamageOverlay cues={cues()} boardWidth={400} boardHeight={400} />
    ));
    expect(slotIds(container)).toEqual(["w"]);
    expect(() => setCues([])).not.toThrow();
    expect(slotIds(container)).toEqual([]);
  });

  it("survives an async flush that removes an id between frames", async () => {
    const [cues, setCues] = createSignal<CCDamageCue[]>([
      cue("w", "e1", "smallFire"),
      cue("b", "e8", "bigFire"),
    ]);
    const { container } = render(() => (
      <CCDamageOverlay cues={cues()} boardWidth={400} boardHeight={400} />
    ));
    expect(slotIds(container)).toEqual(["w", "b"]);
    setCues([cue("w", "e1", "bigFire"), cue("b", "e8", "bigFire")]);
    await Promise.resolve();
    expect(() => setCues([cue("b", "e8", "bigFire")])).not.toThrow();
    await Promise.resolve();
    expect(slotIds(container)).toEqual(["b"]);
  });

  it("still applies damage updates for surviving ids", () => {
    const [cues, setCues] = createSignal<CCDamageCue[]>([
      cue("w", "e1", "smallFire"),
      cue("b", "e8", "smallFire"),
    ]);
    const { container } = render(() => (
      <CCDamageOverlay cues={cues()} boardWidth={400} boardHeight={400} />
    ));
    setCues([cue("w", "e1", "bigFire"), cue("b", "e8", "smallFire")]);
    const damages = [...container.querySelectorAll("[data-cc-id]")].map(
      (el) => el.getAttribute("data-cc-damage"),
    );
    expect(damages).toEqual(["bigFire", "smallFire"]);
  });
});
