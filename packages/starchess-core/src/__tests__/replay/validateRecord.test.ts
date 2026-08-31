/**
 * validateArenaRecord — the single-owner guard every import channel
 * (server ?game= fetch, file upload, ?scfens=) runs before `historyFromRecord`,
 * which throws on malformed SCFEN. Accepts shape-complete records, rejects
 * structural/parse errors with a code-readable message.
 */
import { describe, expect, it } from "vitest";

import {
  validateArenaRecord,
  type ArenaGameRecord,
} from "../../index";

const START = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
const AFTER = "SCFEN|4k3/2pppp2/8/8/8/8/2PPP2/4K3|1|33|P|G:11:11|B:3:3|Q:w:;b:";

const validRecord = (): ArenaGameRecord => ({
  id: "arc-test-1",
  startedAt: "2026-01-01T00:00:00.000Z",
  endedAt: "2026-01-01T00:00:05.000Z",
  players: { w: "adjutant-naive", b: "adjutant-strategic" },
  mapSeed: START,
  outcome: { winner: "w", draw: false },
  turns: 1,
  scfens: [START, AFTER],
  resolves: [
    {
      resolved: {
        attacks: [],
        afterAttack: null as never,
        moves: [],
        afterMove: null as never,
        pathRevealAttacks: [],
        afterAll: null as never,
        mineTriggers: [],
        pathRevealMineTriggers: [],
        moveCollisions: [],
        promotions: [],
        pendingKingShotsArmed: [],
      },
      next: null as never,
      ignoreAttacksOn: [],
      events: [],
      siegedThisTurn: [],
      afterB: null as never,
      afterPending: null as never,
      bMoves: [],
      fMoves: [],
      queue: [],
    },
  ],
});

describe("validateArenaRecord", () => {
  it("accepts a shape-complete record", () => {
    const res = validateArenaRecord(validRecord());
    expect(res.ok).toBe(true);
  });

  it("accepts extra fields", () => {
    const res = validateArenaRecord({ ...validRecord(), note: "extra" });
    expect(res.ok).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(validateArenaRecord(null).ok).toBe(false);
    expect(validateArenaRecord("x").ok).toBe(false);
    expect(validateArenaRecord([]).ok).toBe(false);
  });

  it("rejects a parseable-but-shape-incomplete record listing a bad id", () => {
    const res = validateArenaRecord({ ...validRecord(), id: "" });
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("id") });
  });

  it("rejects a malformed players shape", () => {
    const res = validateArenaRecord({ ...validRecord(), players: { w: "naive" } });
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("players") });
  });

  it("rejects resolves.length mismatch", () => {
    const res = validateArenaRecord({ ...validRecord(), resolves: [] });
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("resolves.length") });
  });

  it("rejects an unparseable scfen (the throw-before-historyFromRecord guard)", () => {
    const res = validateArenaRecord({
      ...validRecord(),
      scfens: [START, "SCFEN|NOT|A|VALID|SCFEN"],
    });
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("parseable SCFEN") });
  });

  it("rejects an outcome with inconsistent draw flag", () => {
    const res = validateArenaRecord({
      ...validRecord(),
      outcome: { winner: "w", draw: true } as unknown as ArenaGameRecord["outcome"],
    });
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("outcome") });
  });

  it("accepts a win without explicit draw:false (back-compat, engine now writes draw:false)", () => {
    const res = validateArenaRecord({
      ...validRecord(),
      outcome: { winner: "w" } as unknown as ArenaGameRecord["outcome"],
    });
    expect(res.ok).toBe(true);
  });

  it("rejects a meta.engine that is not a boolean-used shape", () => {
    const res = validateArenaRecord({
      ...validRecord(),
      meta: { engine: { used: "yes" } },
    });
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("engine") });
  });
});
