/**
 * `summarize` — the arena scoreboard over recorded runs.
 *
 * "How can we know one script is better than the other?" from pure math over
 * records: win/loss/draw per script, turns-to-close, and terminal material
 * margin. Material margin uses the terminal board only — captures are already
 * reflected in the board (captured units are absent), so adding `kvs.captured`
 * again would double-count. Engine agreement (terminal engine `cp` for the
 * winner) arrives with Phase 2 and is recorded, not yet aggregated.
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml
 */

import { deployedMaterialFromPlacement, parseScFen } from "@chess-coach/starchess-core";

import type { ArenaGameRecord, ArenaRecordStatus } from "../record/record";

/** Terminal board-material diff (white − black) on the final settled snap. */
export const materialMarginAtTerminal = (
  record: Pick<ArenaGameRecord, "scfens">,
): { w: number; b: number } => {
  const terminal = record.scfens.at(-1);
  const placement = terminal ? parseScFen(terminal).placement : "";
  return {
    w: deployedMaterialFromPlacement(placement, "w"),
    b: deployedMaterialFromPlacement(placement, "b"),
  };
};

export type ScriptRow = {
  script: string;
  wins: number;
  losses: number;
  draws: number;
  /** Average settled turns across the script's runs. */
  meanTurns: number;
  /** Mean board-material margin (this script's color − opponent's). */
  meanMaterialMargin: number;
};

export type ScriptScoreboard = {
  total: number;
  byStatus: Record<ArenaRecordStatus, number>;
  rows: ScriptRow[];
};

/** Aggregate runs into a per-script scoreboard (pure, unit-testable). */
export const summarize = (runs: readonly ArenaGameRecord[]): ScriptScoreboard => {
  const rows = new Map<string, ScriptRow>();
  const byStatus: Record<ArenaRecordStatus, number> = {
    finished: 0,
    aborted: 0,
    stall: 0,
  };

  const touch = (script: string): ScriptRow => {
    let row = rows.get(script);
    if (!row) {
      row = { script, wins: 0, losses: 0, draws: 0, meanTurns: 0, meanMaterialMargin: 0 };
      rows.set(script, row);
    }
    return row;
  };

  const turnsSums = new Map<string, number>();
  const marginSums = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const run of runs) {
    const status = run.meta?.status ?? "finished";
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    const { w, b } = run.players;
    const wRow = touch(w);
    const bRow = touch(b);
    const margin = materialMarginAtTerminal(run);
    const wMargin = margin.w - margin.b;
    const bMargin = margin.b - margin.w;

    for (const [side, marginFor] of [
      [w, wMargin],
      [b, bMargin],
    ] as const) {
      turnsSums.set(side, (turnsSums.get(side) ?? 0) + run.turns);
      marginSums.set(side, (marginSums.get(side) ?? 0) + marginFor);
      counts.set(side, (counts.get(side) ?? 0) + 1);
    }

    if (status !== "finished") {
      wRow.draws += 1;
      bRow.draws += 1;
      continue;
    }
    if (run.outcome.winner === "w") {
      wRow.wins += 1;
      bRow.losses += 1;
    } else if (run.outcome.winner === "b") {
      bRow.wins += 1;
      wRow.losses += 1;
    } else {
      wRow.draws += 1;
      bRow.draws += 1;
    }
  }

  for (const row of rows.values()) {
    const n = counts.get(row.script) ?? 0;
    row.meanTurns = n ? (turnsSums.get(row.script) ?? 0) / n : 0;
    row.meanMaterialMargin = n ? (marginSums.get(row.script) ?? 0) / n : 0;
  }

  return {
    total: runs.length,
    byStatus,
    rows: [...rows.values()].sort((a, b) => b.wins - a.wins || b.losses - a.losses),
  };
};