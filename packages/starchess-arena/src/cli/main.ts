/**
 * Arena CLI — run headless pairings and write JSONL records.
 *
 *   node …/main.ts --pairing naive:naive --seeds 2 --out ./arena-runs
 *
 * Deterministic engine-off output (no stockfish in Phase 1): identical seeds
 * ⇒ identical `scfens`+`resolves` payloads; `--engine` is accepted for phases
 * ahead and reports that the feed is not provisioned yet.
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml
 */

import fs from "node:fs";
import type { EngineFeed } from "../feed/types";
import path from "node:path";

import { MAX_GAME_TURNS } from "@chess-coach/starchess-core";

import { runMatch } from "../run/runMatch";
import { naiveScript } from "../players/naive";
import { strategicScript } from "../players/strategic";
import { recordFromRun } from "../record/record";
import { summarize } from "../compare/compare";
import { seedForIndex } from "../seeds";
import type { ScriptPlayer } from "../players/types";
import { createArenaFeed } from "../feed/nodeStockfishFeed";

type CliOptions = {
  pairing: "naive:naive" | "naive:strategic" | "strategic:strategic";
  seeds: number;
  engine: boolean;
  movetimeMs: number;
  out: string;
};

const usage = `usage: arena [options]
  --pairing <naive:naive|naive:strategic|strategic:strategic>  (default naive:strategic)
  --seeds <N>        runs until N seeds cycled (default 1)
  --engine           use stockfish for strategic (Node stockfish if on PATH, else fake; horizon 5)
  --movetimeMs <n>   engine budget ms per turn (default 50, recorded)
  --out <dir>        where JSONL records are written (default ./arena-runs)`;

const parseIntStrict = (raw: string, flag: string): number => {
  if (!/^\d+$/.test(raw)) throw new Error(`${flag} must be a non-negative integer (got ${JSON.stringify(raw)})`);
  return Number.parseInt(raw, 10);
};

const parseArgs = (argv: string[]): CliOptions => {
  const opts: CliOptions = {
    pairing: "naive:strategic",
    seeds: 1,
    engine: false,
    movetimeMs: 0,
    out: "./arena-runs",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    const read = (key: string): string => {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`missing value for ${key}`);
      i += 1;
      return v;
    };
    switch (a) {
      case "--pairing": {
        const v = read(a);
        if (!["naive:naive", "naive:strategic", "strategic:strategic"].includes(v)) {
          throw new Error(`unknown pairing: ${v}`);
        }
        opts.pairing = v as CliOptions["pairing"];
        break;
      }
      case "--seeds":
        opts.seeds = parseIntStrict(read(a), "--seeds");
        break;
      case "--engine":
        opts.engine = true;
        break;
      case "--movetimeMs":
        opts.movetimeMs = parseIntStrict(read(a), "--movetimeMs");
        break;
      case "--out":
        opts.out = read(a);
        break;
      case "--help":
      case "-h":
        throw new Error(usage);
      default:
        throw new Error(`unknown option: ${a}`);
    }
  }
  if (opts.seeds < 1) throw new Error("--seeds must be ≥ 1");
  return opts;
};

const buildPairing = (
  pairing: CliOptions["pairing"],
  feed: EngineFeed | null,
): { w: ScriptPlayer; b: ScriptPlayer } => {
  const w =
    pairing === "naive:naive" || pairing === "naive:strategic"
      ? naiveScript()
      : strategicScript({ feed });
  const b =
    pairing === "strategic:strategic" || pairing === "naive:strategic"
      ? strategicScript({ feed })
      : naiveScript();
  return { w, b };
};

export const main = async (argv: string[]): Promise<number> => {
  let opts: CliOptions;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 2;
  }

  let feed: EngineFeed | null = null;
  let stopFeed: (() => void) | null = null;
  if (opts.engine) {
    const movetime = opts.movetimeMs > 0 ? opts.movetimeMs : 50;
    const created = await createArenaFeed(movetime);
    feed = created.feed;
    stopFeed = created.stop;
    process.stderr.write(`engine: ${feed.name} (movetimeMs=${movetime})\n`);
  }

  fs.mkdirSync(opts.out, { recursive: true });
  const players = buildPairing(opts.pairing, feed);
  const records = [];

  for (let i = 0; i < opts.seeds; i += 1) {
    const run = await runMatch({
      players,
      opening: seedForIndex(i),
      feed,
      movetimeMs: opts.engine ? (opts.movetimeMs > 0 ? opts.movetimeMs : 50) : 0,
      maxTurns: MAX_GAME_TURNS,
    });
    const record = recordFromRun(run);
    records.push(record);
    const line = `${JSON.stringify(record)}\n`;
    const file = path.join(opts.out, `${record.id}.jsonl`);
    fs.appendFileSync(file, line, "utf8");
    process.stdout.write(`#${i + 1} ${record.players.w} vs ${record.players.b}` +
      ` → winner=${record.outcome.winner ?? (record.outcome.draw ? "draw" : "–")}` +
      ` turns=${record.turns} status=${record.meta?.status} (${file})\n`);
  }

  const board = summarize(records);
  process.stdout.write("\nscoreboard:\n");
  for (const row of board.rows) {
    process.stdout.write(
      `  ${row.script}: ${row.wins}W/${row.losses}L/${row.draws}D` +
        ` meanTurns=${row.meanTurns.toFixed(1)} meanMargin=${row.meanMaterialMargin.toFixed(2)}\n`,
    );
  }
  if (stopFeed) stopFeed();
  return 0;
};

// Run directly (node --run / tsx), not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (e) => {
      process.stderr.write(`${(e as Error).stack ?? String(e)}\n`);
      process.exitCode = 1;
    },
  );
}