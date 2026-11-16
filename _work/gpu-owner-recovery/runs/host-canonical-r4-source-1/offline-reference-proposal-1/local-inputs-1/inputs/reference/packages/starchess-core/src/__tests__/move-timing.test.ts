import { describe, expect, it } from "vitest";

import { moverContact, timedMover, travelTicks } from "../board/move-timing";

describe("move-timing", () => {
  it("a Hoverbike flies a square per tick, everything else walks two", () => {
    expect(travelTicks("g7", "h5", "n")).toBe(3);
    expect(travelTicks("h1", "h8", "r")).toBe(14);
    expect(travelTicks("e2", "e3", "p")).toBe(2);
  });

  it("a slider holds every square of its ray; a leaper only its landing", () => {
    expect(timedMover("h1", "h4", "r").steps).toEqual([
      { at: "h2", enter: 2 },
      { at: "h3", enter: 4 },
      { at: "h4", enter: 6 },
    ]);
    expect(timedMover("g7", "h5", "n").steps).toEqual([{ at: "h5", enter: 3 }]);
  });

  it("names who held the square first", () => {
    const bike = timedMover("g7", "h5", "n");
    const tank = timedMover("h1", "h8", "r");
    expect(moverContact(bike, tank)).toEqual({ at: "h5", tick: 8, first: "a" });
    expect(moverContact(tank, bike)).toEqual({ at: "h5", tick: 8, first: "b" });
  });

  it("a mover a mine takes on landing holds nothing afterwards", () => {
    const marine = timedMover("e2", "e3", "p", { diesOnLanding: true });
    const mecha = timedMover("c5", "e3", "b");
    expect(moverContact(marine, mecha)).toBeNull();
  });

  it("head-on sliders meet mid-edge", () => {
    const up = timedMover("e1", "e5", "r");
    const down = timedMover("e8", "e4", "r");
    expect(moverContact(up, down)).toEqual({ at: "e4", tick: 8, first: "both" });
  });
});
