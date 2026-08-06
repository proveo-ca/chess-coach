import { describe, expect, it } from "vitest";

import { placementToMap } from "~/starchess/board";
import { MAX_STORED_MATERIAL, incomeForTurn } from "~/starchess/constants";
import { KING_HUNT_LIVE_START_SCFEN } from "~/starchess/demos/kingHunt";
import { adjutant } from "~/starchess/demos/adjutant";
import { endScTurn } from "~/starchess/endScTurn";
import { addScMove } from "~/starchess/scActions";
import { hasExactKingPair, parseScFen } from "~/starchess/scfen";

const blackAction = (out: ReturnType<typeof adjutant>) => {
  return out.snapshot.queue?.actions.find((a) => a.color === "b");
};

const kingOf = (placement: string) =>
  [...placementToMap(placement).entries()].filter(([, p]) => p.type === "k");

const assertExactKings = (placement: string, label: string) => {
  expect(hasExactKingPair(placement), `${label} ${placement}`).toBe(true);
  expect(kingOf(placement).filter(([, p]) => p.color === "w")).toHaveLength(1);
  expect(kingOf(placement).filter(([, p]) => p.color === "b")).toHaveLength(1);
};

describe("adjutant — defensive commander", () => {
  it("flees the Nc5 threat on turn 0 instead of spawning", () => {
    const start = parseScFen(KING_HUNT_LIVE_START_SCFEN);
    const out = adjutant(start, { storedFor: () => 1 });
    const action = blackAction(out);
    expect(action).toBeDefined();
    expect(action?.timing).toBe("C");
    expect(action?.kind).toBe("classical");
    expect(action?.from).toBe("e4");
    // Several safe squares tie on score; the brain settles deterministically on
    // d4. What matters is that it leaves the knight's reach.
    expect(action?.to).toBe("d4");
    expect(["b3", "d3", "e6", "d7", "b7", "a4", "a6"]).not.toContain(action?.to);
    expect(out.spendMinerals).toBeUndefined();
  });

  it("is deterministic: the same snapshot yields the same action", () => {
    const start = parseScFen(KING_HUNT_LIVE_START_SCFEN);
    const a = adjutant(start, { storedFor: () => 1 });
    const b = adjutant(start, { storedFor: () => 1 });
    expect(a.snapshot.queue).toEqual(b.snapshot.queue);
    expect(a.spendMinerals).toEqual(b.spendMinerals);
  });

  it("ignores an invisible enemy king (no attack bonus through fog)", () => {
    // Queen a1 with a clear rank to Kh1, but h1 is outside black's vision, so
    // the hunt bonus must not fire — the brain develops toward the center.
    const snap = parseScFen("SCFEN|k7/8/8/8/8/8/8/q6K|1|33|P|G:11:11|Q:w:;b:");
    const out = adjutant(snap, { storedFor: () => 0 });
    const action = blackAction(out);
    expect(action?.kind).toBe("classical");
    assertExactKings(endScTurn(out.snapshot).next.placement, "fogged-king");
  });

  it("spawns a marine on the best center square when the king is safe", () => {
    // Black king d4 — outside Nc5's reach (b3/a4/a6/b7/d3/e4/e6/d7).
    const safe = parseScFen("SCFEN|8/8/8/2N5/3k4/8/7B/7K|1|33|P|G:11:11|Q:w:;b:");
    const out = adjutant(safe, { storedFor: () => 1 });
    const action = blackAction(out);
    const special = action?.timing === "B" ? action : undefined;
    expect(special?.kind).toBe("spawn");
    expect(special?.from).toBe("d4");
    expect(special?.to).toBe("e3");
    expect(special?.unit).toBe("p");
    expect(out.spendMinerals).toEqual({ color: "b", amount: 1 });
  });

  it("gas-doubles an existing marine ahead of spawning a new one", () => {
    const snap = parseScFen("SCFEN|8/8/8/2k5/2p5/8/7B/7K|1|33|P|G:11:11|Q:w:;b:");
    const out = adjutant(snap, { storedFor: () => 1 });
    const action = blackAction(out);
    expect(action?.timing).toBe("B");
    expect(action?.kind).toBe("pawnDouble");
    expect(action?.from).toBe("c4");
    // Gas step is +1 only (not classical start-rank double).
    expect(action?.to).toBe("c3");
  });

  it("promotes the marine to queen when it reaches the last rank", () => {
    const snap = parseScFen("SCFEN|8/8/8/2k5/8/8/2p4B/7K|1|33|P|G:11:11|Q:w:;b:");
    const out = adjutant(snap, { storedFor: () => 1 });
    const action = blackAction(out);
    const classical = action?.timing === "C" ? action : undefined;
    expect(classical?.kind).toBe("classical");
    expect(classical?.from).toBe("c2");
    expect(classical?.to).toBe("c1");
    expect(classical?.promotion).toBe("q");
  });

  it("does not spawn when stored minerals cannot cover the cost", () => {
    const safe = parseScFen("SCFEN|8/8/8/2N5/3k4/8/7B/7K|1|33|P|G:11:11|Q:w:;b:");
    const out = adjutant(safe, { storedFor: () => 0 });
    const action = blackAction(out);
    expect(action?.timing).toBe("C");
    expect(action?.kind).toBe("classical");
    expect(action?.from).toBe("d4");
    expect(out.spendMinerals).toBeUndefined();
  });

  it("no-ops when black already has a queued action", () => {
    const start = parseScFen(KING_HUNT_LIVE_START_SCFEN);
    const queued = addScMove(start, { color: "b", from: "e4", to: "d4" });
    const out = adjutant(queued, { storedFor: () => 1 });
    expect(out.snapshot).toBe(queued);
    expect(out.spendMinerals).toBeUndefined();
  });

  it("no-ops outside the planning phase", () => {
    const start = parseScFen(KING_HUNT_LIVE_START_SCFEN);
    const resolving = { ...start, phase: "A" as const };
    const out = adjutant(resolving, { storedFor: () => 1 });
    expect(out.snapshot).toBe(resolving);
  });

  it("flees for real instead of 'capturing' an adjacent enemy king", () => {
    // Kings may legally stand adjacent in SCFEN, but a classical move onto a
    // king square is dropped by the resolver. Pre-fix the checked black king
    // scored d2→d1 (KING_SAFETY + attack bonus) highest, never relocated, and
    // took a chip every turn. It must pick a real escape square instead.
    const snap = parseScFen("SCFEN|8/8/8/8/8/8/R2k4/3K4|1|33|P|G:11:11|Q:w:;b:");
    const out = adjutant(snap, { storedFor: () => 0 });
    const action = blackAction(out);
    expect(action?.kind).toBe("classical");
    expect(action?.from).toBe("d2");
    expect(action?.to).not.toBe("d1");
    const resolved = endScTurn(out.snapshot).next;
    // The King actually left the checked square.
    expect(resolved.placement).not.toContain("R2k4");
    assertExactKings(resolved.placement, "adjacent-king-flee");
  });

  it("blocks a check when the king has no safe square", () => {
    // Black king a8 checked by Rh8; a7/b7 covered by Rc7 and b8 sits on the
    // checked rank, so there is no safe king move. The rook must interpose.
    const snap = parseScFen("SCFEN|k6R/2R5/8/8/8/8/8/1r2K3|1|33|P|G:11:11|Q:w:;b:");
    const out = adjutant(snap, { storedFor: () => 0 });
    const action = blackAction(out);
    expect(action?.kind).toBe("classical");
    expect(action?.from).toBe("b1");
    expect(action?.to).toBe("b8");
    const resolved = endScTurn(out.snapshot).next;
    assertExactKings(resolved.placement, "block-check");
  });

  it("breaks off a king duel instead of trading HP face to face", () => {
    // Kd1 vs kd2: contact chips both kings every turn, so the defensive
    // commander must step out of the enemy king's ring rather than slug it out.
    const snap = parseScFen("SCFEN|8/8/8/8/8/8/3k4/3K4|1|33|P|G:11:11|Q:w:;b:");
    const out = adjutant(snap, { storedFor: () => 0 });
    const action = blackAction(out);
    expect(action?.from).toBe("d2");
    // c1/c2/e1/e2 all stay adjacent to Kd1; c3/d3/e3 break contact.
    expect(["c3", "d3", "e3"]).toContain(action?.to);
    const resolved = endScTurn(out.snapshot).next;
    assertExactKings(resolved.placement, "duel-breakoff");
    // Contact was still live at turn start, so this turn's chip lands on both.
    expect(resolved.kingLives).toEqual({ w: 2, b: 2 });
  });

  it("spends gas to unpack a sieged tank that is pinned under fire", () => {
    // Sieged black rook on d4 cannot relocate, and a white rook on d8 is firing
    // down the d-file. The only way to free it is to spend 1 gas toggling siege.
    const snap = parseScFen("SCFEN|3R4/8/7k/8/3r4/8/8/7K|1|33|P|G:11:11|Q:w:;b:|S:d4");
    const out = adjutant(snap, { storedFor: () => 0 });
    const action = blackAction(out);
    expect(action?.timing).toBe("B");
    expect(action?.kind).toBe("rookSiege");
    expect(action?.from).toBe("d4");
  });

  it("leaves a safe sieged tank packed instead of toggling it forever", () => {
    // Same tank, nothing attacking it: no unpack candidate, so the brain must
    // not burn gas flip-flopping the siege.
    const snap = parseScFen("SCFEN|8/8/7k/8/3r4/8/8/7K|1|33|P|G:11:11|Q:w:;b:|S:d4");
    const out = adjutant(snap, { storedFor: () => 0 });
    const action = blackAction(out);
    expect(action?.kind).not.toBe("rookSiege");
  });

  it("never spawns a marine onto an edge row (rank 1/8)", () => {
    // Black king on c2: pre-fix the best pawn spawn was c1/b1 (rank 1, +2100),
    // which crashes endScTurn ("pawns on the edge rows"). Edge rows are now
    // excluded, so the brain picks a rank-2/3 neighbor and the turn resolves.
    const snap = parseScFen("SCFEN|8/8/8/8/8/8/2k5/7K|1|33|P|G:11:11|Q:w:;b:");
    const out = adjutant(snap, { storedFor: () => 1 });
    const action = blackAction(out);
    const special = action?.timing === "B" ? action : undefined;
    expect(special?.kind).toBe("spawn");
    expect(special?.unit).toBe("p");
    expect(special?.to).toBe("d2");
    expect(Number(special?.to?.[1])).not.toBe(1);
    expect(Number(special?.to?.[1])).not.toBe(8);
    const resolved = endScTurn(out.snapshot).next;
    assertExactKings(resolved.placement, "spawn-edge");
  });

  it("hunts a visible white king by holding a real checking ray, not a dead capture", () => {
    // Queen e1 with a clear rank to Kh1. Queueing e1→h1 would be wasted: the
    // resolver drops king-square captures and the turn-start implicit check
    // chips HP from whatever ray the queen already holds. So the brain keeps a
    // checking ray from a square it can actually occupy (e4, on the diagonal)
    // and the white king still loses a life.
    const open = parseScFen("SCFEN|8/8/8/8/8/8/k7/4q2K|1|33|P|G:11:11|Q:w:;b:");
    const out = adjutant(open, { storedFor: () => 0 });
    const attack = blackAction(out);
    expect(attack?.timing).toBe("C");
    expect(attack?.kind).toBe("classical");
    expect(attack?.from).toBe("e1");
    expect(attack?.to).not.toBe("h1");
    expect(attack?.to).toBe("e4");
    const resolved = endScTurn(out.snapshot).next;
    expect(resolved.kingLives.w).toBe(2);
    assertExactKings(resolved.placement, "queen-hunt-open");

    // Blocked ray (white rook f1): the brain must not park on a dead attack and
    // must not pretend it has a check it cannot deliver.
    const blocked = parseScFen("SCFEN|8/8/8/8/8/8/k7/4qR1K|1|33|P|G:11:11|Q:w:;b:");
    const outBlocked = adjutant(blocked, { storedFor: () => 0 });
    const action = blackAction(outBlocked);
    expect(action?.timing).toBe("C");
    expect(action?.from).toBe("e1");
    expect(action?.to).not.toBe("h1");
    assertExactKings(endScTurn(outBlocked.snapshot).next.placement, "queen-hunt-blocked");
  });

  it("AFK live hunt: never drops a king and eventually promotes a marine", () => {
    const blackCount = (placement: string) =>
      [...placementToMap(placement).values()].filter((p) => p.color === "b").length;
    let stored = 1;
    let snap = parseScFen(KING_HUNT_LIVE_START_SCFEN);
    let mostBlackPieces = blackCount(snap.placement);
    let promoted = false;
    for (let i = 0; i < 8 && snap.phase === "P"; i += 1) {
      const out = adjutant(snap, { storedFor: () => stored });
      snap = out.snapshot;
      if (out.spendMinerals) stored -= out.spendMinerals.amount;
      const beforeTurn = snap.turn;
      snap = endScTurn(snap).next;
      if (snap.turn !== beforeTurn) {
        stored = Math.min(MAX_STORED_MATERIAL, stored + incomeForTurn(snap.turn));
      }
      assertExactKings(snap.placement, `t${i}`);
      for (const [, p] of placementToMap(snap.placement)) {
        if (p.type === "q" && p.color === "b") promoted = true;
      }
      mostBlackPieces = Math.max(mostBlackPieces, blackCount(snap.placement));
    }
    expect(promoted).toBe(true);
    expect(mostBlackPieces).toBeGreaterThan(1);
  });
});
