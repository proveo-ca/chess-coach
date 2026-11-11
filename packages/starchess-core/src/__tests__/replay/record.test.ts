/**
 * historyFromRecord — shared settled-ply decode (single-owner core; consumed
 * by BOTH the app's DualNav replay and the arena's record round-trip).
 */
import { describe, expect, it } from "vitest";

import {
  addScMove,
  endScTurn,
  formatScFen,
  historyFromRecord,
  normalizeSnapGas,
  parseScFen,
  type ArenaGameRecord,
} from "../../index";

const START = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";

/** Drive two settled plies the way the arena records them. */
const makeScfensAndResolves = () => {
  let snap = parseScFen(START);
  const scfens = [formatScFen(normalizeSnapGas(snap))];
  const resolves = [];

  snap = addScMove(snap, { color: "w", from: "e2", to: "e4" });
  snap = addScMove(snap, { color: "b", from: "d7", to: "d6" });
  const r1 = endScTurn(snap, { skipTurnStartChecks: true });
  resolves.push(r1);
  scfens.push(formatScFen(normalizeSnapGas(r1.next)));

  snap = r1.next;
  snap = addScMove(snap, { color: "w", from: "e4", to: "e5" });
  snap = addScMove(snap, { color: "b", from: "d6", to: "d5" });
  const r2 = endScTurn(snap, { skipTurnStartChecks: true });
  resolves.push(r2);
  scfens.push(formatScFen(normalizeSnapGas(r2.next)));

  return { scfens, resolves };
};

describe("historyFromRecord", () => {
  it("decodes scfens with repairGas and echoes resolves in order", () => {
    const record = makeScfensAndResolves();
    const history = historyFromRecord(record);

    expect(history.settledSnapshots.length).toBe(record.scfens.length);
    expect(history.settledResolves.length).toBe(record.resolves.length);
    expect(history.settledSnapshots[0]?.turn).toBe(0);
    // Step-1 placement: white Marine advanced e2→e4 (rank 4 = `4P3`).
    expect(history.settledSnapshots[1]?.placement.split("/")[4]).toBe("4P3");
    expect(history.settledSnapshots[1]?.placement).not.toBe(
      history.settledSnapshots[0]?.placement,
    );
  });

  it("decodes a full ArenaGameRecord (extra fields allowed)", () => {
    const record: ArenaGameRecord = {
      id: "sc-test-1",
      startedAt: "2026-08-29T00:00:00.000Z",
      endedAt: "2026-08-29T00:01:00.000Z",
      players: { w: "adjutant-naive", b: "adjutant-naive" },
      mapSeed: START,
      outcome: { winner: null, draw: false },
      turns: 2,
      scfens: makeScfensAndResolves().scfens,
      resolves: makeScfensAndResolves().resolves,
      meta: { engine: null },
    };

    const history = historyFromRecord(record);
    expect(history.settledSnapshots).toHaveLength(3);
    expect(history.settledResolves).toHaveLength(2);
  });

  it("does not mutate the record's resolve list", () => {
    const record = makeScfensAndResolves();
    const before = record.resolves.length;
    historyFromRecord(record);
    expect(record.resolves.length).toBe(before);
  });
});