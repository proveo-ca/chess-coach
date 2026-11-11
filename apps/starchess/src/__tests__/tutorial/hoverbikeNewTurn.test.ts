import { describe, expect, it } from "vitest";
import { resolveTutorialLine } from "~/tutorial/tutorialScript";

const NEW_TURN = "New turn, new mine.\nMove your Hoverbike";
/** Hoverbike seed shape: SCFEN|<placement>|<turn>|... */
const scfen = (turn: number, tail = "|33|P|G:11:11|Q:w:;b:") =>
  `SCFEN|4k3/8/8/8/3N4/8/8/4K3|${turn}${tail}`;

const line = (s: string) =>
  resolveTutorialLine({ stageId: "specials", storyId: "hoverbike", scfen: s }).comment;

describe("hoverbike · new-turn prompt", () => {
  it("is silent on turn 1", () => {
    expect(line(scfen(1))).not.toBe(NEW_TURN);
  });

  it("fires on turn 2", () => {
    expect(line(scfen(2))).toBe(NEW_TURN);
  });

  it.each([3, 4, 12])("does not repeat on turn %i", (t) => {
    expect(line(scfen(t))).not.toBe(NEW_TURN);
  });

  it("still yields to the queued-intent beat on turn 2", () => {
    expect(line(scfen(2, "|33|P|G:11:11|Q:w:C=d4d6;b:"))).not.toBe(NEW_TURN);
  });
});
