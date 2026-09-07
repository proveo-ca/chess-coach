/**
 * Deploy reach — the single "can this side deploy a unit that covers X" table.
 *
 * The answer gates material decisions (a square a deploy can recapture on is
 * not undefended), so a `false` has to be a proof, not a guess. Every rule the
 * Command Center deploy obeys gets a row here: the gas gate, the mineral gate,
 * hostile mines, crush landings, the Marine promotion-rank ban, and the slider
 * units the first implementation never simulated.
 * // SPEC: _spec/packages/starchess-core/deploy-reach.puml
 */
import { describe, expect, it } from "vitest";

import { deployCovers, deployTargets, deployableUnits } from "../board/deploy-reach";
import { placementToMap, type ScPiece } from "../board/placement";

import { UNIT_COST } from "../rules/constants";
import type { ScMine } from "../model/types";
import type { Square } from "../model/square";

/** Bare board: white CC on e1, black CC on e8. */
const bare = () => placementToMap("4k3/8/8/8/8/8/8/4K3");

const query = (over: Partial<Parameters<typeof deployCovers>[0]> = {}) => ({
  map: bare(),
  mines: undefined as readonly ScMine[] | undefined,
  color: "w" as const,
  cc: "e1" as Square,
  gas: 1,
  minerals: 9,
  ...over,
});

describe("deployTargets", () => {
  it("is the Command Center ring", () => {
    expect(new Set(deployTargets(query()))).toEqual(
      new Set(["d1", "f1", "d2", "e2", "f2"]),
    );
  });

  it("is empty without gas — a deploy is a special and costs one canister", () => {
    expect(deployTargets(query({ gas: 0 }))).toEqual([]);
  });

  it("is empty with no Command Center on the board", () => {
    expect(deployTargets(query({ cc: null }))).toEqual([]);
  });

  it("keeps enemy and ally occupants (the deploy replaces either) but drops kings", () => {
    // The authority is `rules/specials/adjacent.ts` + `rules/validation.ts`:
    // any non-king occupant crushes (deployed replaces occupant, victim recorded).
    const map = bare();
    map.set("d2", { type: "p", color: "b" } satisfies ScPiece);
    map.set("f2", { type: "p", color: "w" } satisfies ScPiece);
    expect(deployTargets(query({ map }))).toContain("d2");
    expect(deployTargets(query({ map }))).toContain("f2");
  });

  it("drops every King square — an enemy Command Center cannot be crushed", () => {
    // Face-to-face Command Centers are reachable, so the enemy ring can hold ours.
    const map = placementToMap("8/8/8/8/8/8/4k3/4K3");
    // Black CC on e2, white CC on e1: e1 is on black's ring but may not be taken.
    expect(deployTargets(query({ map, color: "b", cc: "e2" }))).not.toContain("e1");
  });

  it("drops tiles carrying a hostile Spider Mine", () => {
    const mines: readonly ScMine[] = [{ at: "d2", color: "b" }];
    expect(deployTargets(query({ mines }))).not.toContain("d2");
  });

  it("keeps tiles carrying our own mine — allied mines stay inert underfoot", () => {
    const mines: readonly ScMine[] = [{ at: "d2", color: "w" }];
    expect(deployTargets(query({ mines }))).toContain("d2");
  });
});

describe("deployableUnits", () => {
  it("is gated on banked minerals, not gas", () => {
    expect(deployableUnits(0)).toEqual([]);
    expect(deployableUnits(UNIT_COST.p)).toEqual(["p"]);
    expect(deployableUnits(UNIT_COST.n)).toEqual(["p", "n", "b"]);
    expect(deployableUnits(UNIT_COST.q)).toEqual(["p", "n", "b", "r", "q"]);
  });
});

describe("deployCovers", () => {
  it("sees a Marine recapture on the diagonal", () => {
    // A Marine dropped on d2/f2 covers e3.
    expect(deployCovers(query({ minerals: UNIT_COST.p }), "e3")).toBe(true);
  });

  it("is false when the bank cannot pay for any unit", () => {
    expect(deployCovers(query({ minerals: 0 }), "e3")).toBe(false);
  });

  it("is false without gas even with a full bank", () => {
    expect(deployCovers(query({ gas: 0, minerals: 9 }), "e3")).toBe(false);
  });

  it("never claims a Marine on the promotion rank", () => {
    // Black CC on e8. c7 is covered only from a d8 landing, and a Marine may not
    // be deployed onto rank 8 — so with a Marine-only bank c7 is unreachable,
    // while a bank that affords a Mecha reaches it on the d8→c7 diagonal.
    const base = { color: "b" as const, cc: "e8" as Square };
    expect(deployCovers(query({ ...base, minerals: UNIT_COST.p }), "c7")).toBe(false);
    expect(deployCovers(query({ ...base, minerals: UNIT_COST.b }), "c7")).toBe(true);
  });

  it("sees a slider recapture a Marine-only model would miss", () => {
    // h1 is reachable along rank 1 from f1 for a Tank, never for a Marine.
    expect(deployCovers(query({ minerals: UNIT_COST.p }), "h1")).toBe(false);
    expect(deployCovers(query({ minerals: UNIT_COST.r }), "h1")).toBe(true);
  });

  it("sees a crush deploy onto an occupied ring square", () => {
    // f1 is occupied by an enemy Marine; the deploy crushes it and then covers h1.
    const map = bare();
    map.set("f1", { type: "p", color: "b" } satisfies ScPiece);
    expect(deployCovers(query({ map, minerals: UNIT_COST.r }), "h1")).toBe(true);
  });

  it("counts a deploy that lands ON the target as a recapture", () => {
    // Crushing the occupant outright is the most direct recapture, and
    // `attacksSquare` is false for from === to, so it needs its own branch.
    const map = bare();
    map.set("d2", { type: "p", color: "b" } satisfies ScPiece);
    expect(deployCovers(query({ map, minerals: UNIT_COST.p }), "d2")).toBe(true);
  });

  it("respects blockers on the ray", () => {
    // a1 is reachable only as a rank-1 ray from a d1 drop (no ring square has a
    // Hoverbike hop or a Mecha diagonal onto it), so b1 blocks it outright.
    expect(deployCovers(query({ minerals: UNIT_COST.r }), "a1")).toBe(true);
    const map = bare();
    map.set("b1", { type: "p", color: "b" } satisfies ScPiece);
    expect(deployCovers(query({ map, minerals: UNIT_COST.r }), "a1")).toBe(false);
  });

  it("does not mutate the caller's map", () => {
    const map = bare();
    const before = new Map(map);
    deployCovers(query({ map, minerals: UNIT_COST.q }), "e5");
    expect(map).toEqual(before);
  });
});
