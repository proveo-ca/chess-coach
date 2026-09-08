/**
 * Determinism guarantees — engine-off runs are payload-identical: equal
 * `scfens` + `resolves`; only `id`/timestamps may differ (excluded from the
 * equality per the plan).
 */
import { describe, expect, it } from "vitest";

import {
  historyFromRecord,
  refillTurnGas,
  scOutcome,
  type ArenaGameRecord,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import { recordFromRun } from "../record/record";
import { naiveScript } from "../players/naive";
import { strategicScript } from "../players/strategic";
import type { ScriptPlayer, SideContext } from "../players/types";
import { runMatch } from "../run/runMatch";
import { STAR_STARTING_SCFEN } from "../seeds";

const naivePair = { w: naiveScript(), b: naiveScript() };
const mixedPair = { w: naiveScript(), b: strategicScript() };

const payloadOf = (record: ArenaGameRecord) => ({
  scfens: record.scfens,
  resolves: record.resolves,
  outcome: record.outcome,
  turns: record.turns,
  resultKeys: record.resolves.map((r) => r.events.length),
});

describe("runMatch determinism", () => {
  it("naive-vs-naive reruns are payload-identical", async () => {
    const a = recordFromRun(await runMatch({ players: naivePair, opening: STAR_STARTING_SCFEN }));
    const b = recordFromRun(await runMatch({ players: naivePair, opening: STAR_STARTING_SCFEN }));
    expect(payloadOf(b)).toEqual(payloadOf(a));
  });

  it("mixed (strategic vs naive) reruns are payload-identical", async () => {
    const a = recordFromRun(await runMatch({ players: mixedPair, opening: STAR_STARTING_SCFEN }));
    const b = recordFromRun(await runMatch({ players: mixedPair, opening: STAR_STARTING_SCFEN }));
    expect(payloadOf(b)).toEqual(payloadOf(a));
  });

  it("rejects both-null players", async () => {
    await expect(
      runMatch({ players: { w: null, b: null }, opening: STAR_STARTING_SCFEN }),
    ).rejects.toThrow(/at least one side/);
  });

  it("refills gas for every side each turn (economy engages, not just classics)", async () => {
    // Regression: the runner must advance to the turn-open, gas-refilled snap
    // (app parity: `begun?.next ?? refillTurnGas(cur)`) so scripts plan with a
    // real gas budget — otherwise gas stays 0 after turn 0 and the game is
    // classical-only (economy dials never engage).
    const seenGasAtTurn: Array<{ turn: number; gas: { w: number; b: number } }> = [];
    const recorder: ScriptPlayer = {
      name: "gas-recorder",
      play(snap: ScFenSnapshot, ctx: SideContext) {
        seenGasAtTurn.push({ turn: snap.turn, gas: { ...snap.gas } });
        return {
          snapshot: refillTurnGas(snap),
        };
      },
    };

    await runMatch({
      players: { w: recorder, b: recorder },
      opening: STAR_STARTING_SCFEN,
      maxTurns: 5,
    });

    expect(seenGasAtTurn.length).toBeGreaterThan(1);
    for (const entry of seenGasAtTurn) {
      // Beyond turn 0 the snap must have been gas-refilled before planning.
      expect(entry.gas.w).toBeGreaterThan(0);
      expect(entry.gas.b).toBeGreaterThan(0);
    }
  });
});

describe("record round-trip", () => {
  it("historyFromRecord reproduces the recorded outcome", async () => {
    const run = await runMatch({ players: naivePair, opening: STAR_STARTING_SCFEN });
    const record = recordFromRun(run);

    expect(record.scfens.length).toBe(record.resolves.length + 1);
    const history = historyFromRecord(record);
    const terminal = history.settledSnapshots.at(-1)!;

    if (record.meta?.status === "finished") {
      expect(scOutcome(terminal)).toEqual(record.outcome);
    } else {
      // Stall/abort: the recorded tail is not king-terminal, so the decoded
      // terminal snap has no outcome — the record reports the draw instead.
      expect(scOutcome(terminal)).toBeNull();
      expect(record.outcome).toEqual({ winner: null, draw: true });
    }
  });

  it("meta carries the engine mode and terminal bank", async () => {
    const run = await runMatch({ players: mixedPair, opening: STAR_STARTING_SCFEN });
    const record = recordFromRun(run);
    // No feed attached ⇒ engine never used.
    expect(record.meta?.engine).toBeNull();
    expect(record.meta?.finalBank).toBeDefined();
  });
});