import { describe, expect, it } from "vitest";

import { placementToMap } from "@chess-coach/starchess-core";

import {
  attackersOfSquare,
  availableTrajectories,
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

describe("availableTrajectories", () => {
  const wire = (placement: string, bank: string): string =>
    `SCFEN|${placement}|1|33|P|G:11:11|${bank}|Q:w:;b:`;

  it("opens the g2 Mecha drop once d5, vacancy, and minerals align", () => {
    expect(
      availableTrajectories(wire("8/8/8/3k4/8/5P2/2N4P/4N1BK", "B:3:3"), "w"),
    ).toEqual([{ key: "deploy-b-g2-d5", from: "g2", to: "d5" }]);
  });

  it("stays shut without deploy money, with g2 held, or with no CC", () => {
    expect(
      availableTrajectories(wire("8/8/8/3k4/8/5P2/2N4P/4N1BK", "B:2:3"), "w"),
    ).toEqual([]);
    expect(
      availableTrajectories(wire("8/8/8/3k4/8/5P2/2N3P1/4N1BK", "B:3:3"), "w"),
    ).toEqual([]);
    expect(
      availableTrajectories(wire("8/8/8/8/4k3/5P2/2N4P/4N1BK", "B:3:3"), "w"),
    ).toEqual([]);
  });

  it("mirrors sides for a black viewer", () => {
    expect(
      availableTrajectories(wire("8/8/8/3K4/8/5p2/2n4p/4n1bk", "B:3:3"), "b"),
    ).toEqual([{ key: "deploy-b-g2-d5", from: "g2", to: "d5" }]);
  });

  it("returns empty for missing, bankless, or malformed wires", () => {
    expect(availableTrajectories(undefined, "w")).toEqual([]);
    expect(
      availableTrajectories("SCFEN|8/8/8/3k4/8/5P2/2N4P/4N1BK|1|33|P|G:11:11|Q:w:;b:", "w"),
    ).toEqual([]);
    expect(availableTrajectories("SCFEN|nope|1|33", "w")).toEqual([]);
  });
});
