import { describe, expect, it } from "vitest";

import { placementToMap } from "@chess-coach/starchess-core";

import {
  attackersOfSquare,
  coveredEnemyShips,
} from "~/tutorial/lessonTactics";

describe("attackersOfSquare", () => {
  it("finds the centralized Hoverbike covering e1", () => {
    const map = placementToMap("8/8/8/8/4k3/5P2/2N3P1/4q1BK");
    expect(attackersOfSquare(map, "e1", "w")).toEqual([
      { from: "c2", kind: "n" },
    ]);
  });

  it("respects ray clearance for sliding pieces", () => {
    const open = placementToMap("8/8/8/8/4k3/5P2/4R3/4q1BK");
    expect(attackersOfSquare(open, "e1", "w")).toEqual([
      { from: "e2", kind: "r" },
    ]);
    const blocked = placementToMap("8/8/8/8/4k3/4R3/4P3/4q1BK");
    expect(attackersOfSquare(blocked, "e1", "w")).toEqual([]);
  });

  it("never credits white Marines with back-rank attacks", () => {
    const map = placementToMap("8/8/8/8/4k3/5P2/4P3/4q1BK");
    expect(attackersOfSquare(map, "e1", "w")).toEqual([]);
  });

  it("skips enemy-colored pieces", () => {
    const map = placementToMap("8/8/8/8/4k3/5P2/2n4/4q1BK");
    expect(attackersOfSquare(map, "e1", "w")).toEqual([]);
  });
});

describe("coveredEnemyShips", () => {
  const scfen = (placement: string): string =>
    `SCFEN|${placement}|1|33|P|G:11:11|Q:w:;b:`;

  it("reports coverers only for enemy-occupied watch squares", () => {
    expect(
      coveredEnemyShips(scfen("8/8/8/8/4k3/5P2/2N3P1/4q1BK"), "w"),
    ).toEqual({ e1: [{ from: "c2", kind: "n" }] });
    expect(coveredEnemyShips(scfen("8/8/8/8/4k3/5P2/6P1/4N1BK"), "w")).toEqual(
      {},
    );
  });

  it("ignores viewer-owned battleships and off-watch squares", () => {
    expect(coveredEnemyShips(scfen("8/8/8/8/4k3/5P2/6P1/4Q1BK"), "w")).toEqual(
      {},
    );
    expect(coveredEnemyShips(scfen("3q4/8/8/8/4k3/5P2/6P1/4N1BK"), "w")).toEqual(
      {},
    );
  });

  it("returns empty for missing or malformed input", () => {
    expect(coveredEnemyShips(undefined, "w")).toEqual({});
    expect(coveredEnemyShips("SCFEN|nope|1|33", "w")).toEqual({});
  });
});
