/**
 * Arena record builder — turns a `runMatch` result into the shared record
 * schema owned by core (`single owner` — no parallel arena shape).
 *
 * `meta.finalBank` carries the arena's mineral ledger for the scoreboard (the
 * recorded SCFENs themselves never stamp the bank — replay parity with human
 * games). `id` / `startedAt` / `endedAt` come from the schema owner and are
 * excluded from determinism equality (reruns compare `scfens`+`resolves`).
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml
 */

import {
  recordFromRun as recordFromSummary,
  type ArenaGameRecord,
  type ArenaRecordStatus,
} from "@chess-coach/starchess-core";

import type { ArenaRun } from "../run/runMatch";

export type { ArenaGameRecord, ArenaRecordStatus };

/** Adapt a driver run to the core schema owner's summary. */
export const recordFromRun = (
  run: ArenaRun,
  opts: { startedAt?: string } = {},
): ArenaGameRecord => {
  const status = run.meta.status;
  return recordFromSummary({
    startedAt: opts.startedAt,
    players: {
      w: run.players.w ?? "scratch",
      b: run.players.b ?? "scratch",
    },
    mapSeed: run.startScfen,
    ...(run.map !== undefined ? { map: run.map } : {}),
    ...(run.variant !== undefined ? { variant: run.variant } : {}),
    // Aborted/non-terminal runs have no Command Center outcome — the shared schema needs
    // a draw signal, so a "no one won" is recorded as a draw.
    outcome: run.outcome ?? { winner: null, draw: true },
    turns: run.turns,
    scfens: [run.startScfen, ...run.plies.map((p) => p.scfen)],
    resolves: run.plies.map((p) => p.resolve),
    meta: {
      engine: run.meta.engine,
      finalBank: run.meta.finalBank,
      status,
    },
  });
};