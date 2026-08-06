import { describe, expect, it } from "vitest";

import { collectLegalKingChecks } from "~/starchess/board";
import { endScTurn } from "~/starchess/endScTurn";
import { intentOverlaysFromQueue } from "~/starchess/intentOverlays";
import { applyPendingKingShots } from "~/starchess/resolveTurn";
import { addScAction } from "~/starchess/scActions";
import { parseScFen } from "~/starchess/scfen";
import { scOutcome } from "~/starchess/scOutcome";

/** Kd1 vs kd2 — face to face, nothing else on the board. */
const DUEL = "8/8/8/8/8/8/3k4/3K4";
const duelSnap = (lives = "33") =>
  parseScFen(`SCFEN|${DUEL}|1|${lives}|P|G:11:11|Q:w:;b:`);

describe("king duel — adjacent kings fight face to face", () => {
  it("makes both kings legal checkers of each other", () => {
    const checks = collectLegalKingChecks(DUEL);
    expect(checks).toHaveLength(2);
    expect(checks.every((c) => c.piece === "k")).toBe(true);
    // White is ordered first, and each shot targets the enemy king square.
    expect(checks[0]).toMatchObject({ color: "w", from: "d1", to: "d2" });
    expect(checks[1]).toMatchObject({ color: "b", from: "d2", to: "d1" });
  });

  it("counts diagonal contact but not a gap of two", () => {
    expect(collectLegalKingChecks("8/8/8/8/8/8/2k5/3K4")).toHaveLength(2);
    expect(collectLegalKingChecks("8/8/8/8/8/3k4/8/3K4")).toHaveLength(0);
  });

  it("chips both kings in one pass without moving or capturing anything", () => {
    const r = applyPendingKingShots({
      placement: DUEL,
      kingLives: { w: 3, b: 3 },
      pending: collectLegalKingChecks(DUEL),
    });
    expect(r.kingLives).toEqual({ w: 2, b: 2 });
    expect(r.attacks).toHaveLength(2);
    expect(r.attacks.every((a) => a.kind === "kingShot" && a.piece === "k")).toBe(true);
    // Kings leap: never a blocker/collision, and the board is untouched.
    expect(r.attacks.some((a) => a.kind === "capture")).toBe(false);
    expect(r.placement).toBe(DUEL);
    expect(r.mines).toEqual([]);
  });

  it("drains equal HP to a simultaneous 0/0 draw", () => {
    let snap = duelSnap("33");
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      snap = endScTurn(snap).next;
      seen.push(`${snap.kingLives.w}${snap.kingLives.b}${snap.phase}`);
    }
    expect(seen).toEqual(["22P", "11P", "00O"]);
    expect(scOutcome(snap)).toEqual({ winner: null, draw: true });
    // "O" is absorbing — the position cannot be resolved any further.
    expect(() => endScTurn(snap)).toThrow();
  });

  it("kills the lower-HP king first when HP is unequal", () => {
    let snap = duelSnap("32");
    snap = endScTurn(snap).next;
    expect(snap.kingLives).toEqual({ w: 2, b: 1 });
    expect(snap.phase).toBe("P");
    snap = endScTurn(snap).next;
    expect(snap.kingLives).toEqual({ w: 1, b: 0 });
    expect(snap.phase).toBe("O");
    expect(scOutcome(snap)).toEqual({ winner: "w" });
  });

  it("still returns fire at 0 HP, so 1/1 contact is a draw not an initiative win", () => {
    const snap = endScTurn(duelSnap("11")).next;
    expect(snap.kingLives).toEqual({ w: 0, b: 0 });
    expect(scOutcome(snap)).toEqual({ winner: null, draw: true });
  });

  it("doubles the damage when a king deploys a unit onto the enemy king", () => {
    // Black spawns a marine on c2: adjacent to its own king (legal deploy ring)
    // and its capture diagonal covers d1, stacking a second checker.
    const queued = addScAction({
      snapshot: { ...duelSnap("33"), queue: { actions: [] } },
      action: { timing: "B", kind: "spawn", color: "b", from: "d2", to: "c2", unit: "p" },
    }).snapshot;

    // Turn 1: pendings were taken before the spawn, so it is still 1-for-1.
    const t1 = endScTurn(queued).next;
    expect(t1.kingLives).toEqual({ w: 2, b: 2 });

    // Turn 2: king + marine both check d1 => white takes 2, black takes 1.
    const t2 = endScTurn(t1).next;
    expect(t2.kingLives).toEqual({ w: 0, b: 1 });
    expect(t2.phase).toBe("O");
    expect(scOutcome(t2)).toEqual({ winner: "b" });
  });

  it("charges a parting shot: breaking contact still costs this turn's HP", () => {
    const queued = addScAction({
      snapshot: { ...duelSnap("33"), queue: { actions: [] } },
      action: { timing: "C", kind: "classical", color: "b", from: "d2", to: "d3" },
    }).snapshot;
    const next = endScTurn(queued).next;
    expect(next.kingLives).toEqual({ w: 2, b: 2 });
    // Contact is broken, so the following turn is quiet.
    expect(endScTurn(next).next.kingLives).toEqual({ w: 2, b: 2 });
  });

  it("rings both kings in the intent overlay when they are in contact", () => {
    const overlays = intentOverlaysFromQueue(undefined, { placement: DUEL });
    // Both sides are simultaneously in check — one ring each, deduped by square.
    expect(overlays.checks.map((c) => c.at).sort()).toEqual(["d1", "d2"]);
  });

  it("does not chip on the turn contact is established", () => {
    // Mirror of the parting shot: pendings are taken before the move phase, so
    // walking INTO contact costs nothing until the following turn.
    const apart = parseScFen(`SCFEN|8/8/8/8/8/3k4/8/3K4|1|33|P|G:11:11|Q:w:;b:`);
    const queued = addScAction({
      snapshot: { ...apart, queue: { actions: [] } },
      action: { timing: "C", kind: "classical", color: "b", from: "d3", to: "d2" },
    }).snapshot;
    const t1 = endScTurn(queued).next;
    expect(t1.kingLives).toEqual({ w: 3, b: 3 });
    // Contact now exists, so the next turn chips both.
    expect(endScTurn(t1).next.kingLives).toEqual({ w: 2, b: 2 });
  });

  it("leaves both kings on the board at 0/0 so the position stays well-formed", () => {
    let snap = duelSnap("11");
    snap = endScTurn(snap).next;
    expect(snap.kingLives).toEqual({ w: 0, b: 0 });
    // Dead kings are not removed — the exactly-one-king-per-side invariant holds.
    expect(snap.placement).toBe(DUEL);
  });

  it("bails out of the turn the moment the check phase kills a king", () => {
    // Face-to-face duel at 3/1: the check phase kills black outright (kings
    // always see each other), so white's queued classical move must NOT resolve.
    const queued = addScAction({
      snapshot: { ...duelSnap("31"), queue: { actions: [] } },
      action: { timing: "C", kind: "classical", color: "w", from: "d1", to: "c1" },
    }).snapshot;
    const r = endScTurn(queued);
    expect(r.next.kingLives).toEqual({ w: 2, b: 0 });
    expect(r.next.phase).toBe("O");
    // The white king never moved — the board is exactly as it was.
    expect(r.next.placement).toBe(DUEL);
    expect(r.resolved.moves).toEqual([]);
    expect(scOutcome(r.next)).toEqual({ winner: "w" });
  });

  it("bails out without resolving a queued special", () => {
    // 1/1 duel: both kings die in the check phase, so the queued spawn is void.
    const queued = addScAction({
      snapshot: { ...duelSnap("11"), queue: { actions: [] } },
      action: { timing: "B", kind: "spawn", color: "b", from: "d2", to: "c2", unit: "p" },
    }).snapshot;
    const r = endScTurn(queued);
    expect(r.next.kingLives).toEqual({ w: 0, b: 0 });
    expect(r.next.phase).toBe("O");
    // No marine on c2 — the special never resolved.
    expect(r.next.placement).toBe(DUEL);
    expect(scOutcome(r.next)).toEqual({ winner: null, draw: true });
  });

  it("refuses to parse a playable snapshot that still holds a dead king", () => {
    // A destroyed king ends the match, so 0 HP outside phase O is not a state
    // the engine can produce — authored input must not smuggle it back in.
    expect(() => parseScFen(`SCFEN|${DUEL}|1|00|P|G:11:11|Q:w:;b:`)).toThrow(/phase O/);
    expect(() => parseScFen(`SCFEN|${DUEL}|1|30|P|G:11:11|Q:w:;b:`)).toThrow(/phase O/);
    // Terminal snapshots still round-trip.
    expect(parseScFen(`SCFEN|${DUEL}|1|00|O|G:11:11|Q:w:;b:`).kingLives).toEqual({
      w: 0,
      b: 0,
    });
  });

  it("lets a fog-discovered check chip a king the attacker could not see", () => {
    // Ra1 has no vision of kd1 at turn start, so the check phase is fog-gated
    // out. Driving a1->h1 walks the ray into the king: a discovered check, which
    // is a plain check once fog is lifted, so the chip stands and the rook stops
    // on c1 (never occupying the king square).
    const p = "K7/8/8/8/8/8/8/R2k4";
    const snap = parseScFen(`SCFEN|${p}|1|33|P|G:11:11|Q:w:;b:`);
    expect(
      collectLegalKingChecks(p, { isTargetVisible: () => false }),
    ).toHaveLength(0);
    const queued = addScAction({
      snapshot: { ...snap, queue: { actions: [] } },
      action: { timing: "C", kind: "classical", color: "w", from: "a1", to: "h1" },
    }).snapshot;
    const r = endScTurn(queued);
    expect(r.next.kingLives).toEqual({ w: 3, b: 2 });
    expect(r.next.placement).toBe("K7/8/8/8/8/8/8/2Rk4");
    expect(r.next.phase).toBe("P");
  });

  it("bails out when a fog-discovered check is the killing blow", () => {
    // Same discovered check, but black is on 1 HP: the match ends on the spot and
    // the queued F special must not resolve behind the dead king.
    const p = "K7/8/8/8/8/8/8/R2k4";
    const snap = parseScFen(`SCFEN|${p}|1|31|P|G:11:11|Q:w:;b:`);
    const queued = addScAction({
      snapshot: { ...snap, queue: { actions: [] } },
      action: { timing: "C", kind: "classical", color: "w", from: "a1", to: "h1" },
    }).snapshot;
    const r = endScTurn(queued);
    expect(r.next.kingLives).toEqual({ w: 3, b: 0 });
    expect(r.next.phase).toBe("O");
    expect(scOutcome(r.next)).toEqual({ winner: "w" });
  });

  it("scOutcome reads HP as the source of truth", () => {
    expect(scOutcome({ kingLives: { w: 3, b: 3 } })).toBeNull();
    expect(scOutcome({ kingLives: { w: 3, b: 0 } })).toEqual({ winner: "w" });
    expect(scOutcome({ kingLives: { w: 0, b: 3 } })).toEqual({ winner: "b" });
    expect(scOutcome({ kingLives: { w: 0, b: 0 } })).toEqual({ winner: null, draw: true });
  });
});
