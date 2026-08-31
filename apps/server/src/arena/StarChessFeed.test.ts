// SPEC: _spec/apps/server/starchess-arena-feed.puml
import { expect, test } from "bun:test";

import { StarChessEnginePool, type EngineLike } from "../arena/StarChessEnginePool.ts";
import { StarChessFeed } from "../arena/StarChessFeed.ts";

type EvalSpec = { cp: number; isMate?: boolean; mateIn?: number };
type EvalMap = Map<string, EvalSpec>;

class FakeEngine implements EngineLike {
  running = false;
  inFlight = 0;
  peakConcurrency = 0;
  constructor(
    private readonly evals: EvalMap,
    public readonly log: string[] = [],
    private readonly throwOnEval = false,
    private readonly delayMs = 0,
  ) {}
  async start(): Promise<void> {
    this.running = true;
  }
  stop(): void {
    this.running = false;
  }
  get isRunning(): boolean {
    return this.running;
  }
  async getEvaluation(fen: string): Promise<any> {
    if (this.throwOnEval) throw new Error("stockfish died");
    this.inFlight += 1;
    this.peakConcurrency = Math.max(this.peakConcurrency, this.inFlight);
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    try {
      this.log.push(fen);
      const spec = this.evals.get(fen) ?? { cp: 0 };
      return {
        bestMove: "e7e5",
        cp: spec.cp,
        isMate: spec.isMate ?? false,
        mateIn: spec.mateIn ?? 0,
      };
    } finally {
      this.inFlight -= 1;
    }
  }
}

/** Fixed pool of fake engines with a controllable per-instance eval map. */
function makePool(evalMaps: EvalMap[], opts: { throwOnEval?: boolean; delayMs?: number } = {}): {
  pool: StarChessEnginePool;
  engines: FakeEngine[];
} {
  const engines: FakeEngine[] = [];
  class P extends StarChessEnginePool {
    constructor() {
      super(evalMaps.length);
    }
    override spawn(): EngineLike {
      const e = new FakeEngine(
        evalMaps[engines.length] ?? new Map(),
        [],
        opts.throwOnEval ?? false,
        opts.delayMs ?? 0,
      );
      engines.push(e);
      return e;
    }
  }
  return { pool: new P(), engines };
}

test("pool size defaults to STARCHESS_ARENA_ENGINES env when set", () => {
  const prev = process.env.STARCHESS_ARENA_ENGINES;
  process.env.STARCHESS_ARENA_ENGINES = "4";
  try {
    const { pool } = makePool([]);
    expect(pool.size).toBe(4);
  } finally {
    if (prev === undefined) delete process.env.STARCHESS_ARENA_ENGINES;
    else process.env.STARCHESS_ARENA_ENGINES = prev;
  }
});

test("pool size is clamped above MAX_ARENA_ENGINES", () => {
  const prev = process.env.STARCHESS_ARENA_ENGINES;
  process.env.STARCHESS_ARENA_ENGINES = "1000";
  try {
    const { pool } = makePool([]);
    expect(pool.size).toBe(16);
  } finally {
    if (prev === undefined) delete process.env.STARCHESS_ARENA_ENGINES;
    else process.env.STARCHESS_ARENA_ENGINES = prev;
  }
});

test("feed scores each candidate, mapping cp and mate to suggestions", async () => {
  const { pool, engines } = makePool([
    new Map([["f0", { cp: 120 }]]),
    new Map([["f1", { cp: -40 }]]),
  ]);
  await pool.start();
  const feed = new StarChessFeed(pool);

  const out = await feed.evaluate(
    [
      { fen: "f0", from: "0" },
      { fen: "f1", from: "1" },
    ],
    { movetimeMs: 200 },
  );

  const byFrom = new Map(out.map((s) => [s.from, s]));
  expect(byFrom.get("0")).toEqual({ from: "0", cp: 120, mateIn: null, timedOut: false });
  expect(byFrom.get("1")).toEqual({ from: "1", cp: -40, mateIn: null, timedOut: false });
  expect(engines[0]!.log).toEqual(["f0"]);
  expect(engines[1]!.log).toEqual(["f1"]);
});

test("feed surfaces mate as mateIn (cp null) and down to the suggestion", async () => {
  const { pool } = makePool([new Map([["f0", { cp: 0, isMate: true, mateIn: 3 }]])]);
  await pool.start();
  const feed = new StarChessFeed(pool);

  const out = await feed.evaluate([{ fen: "f0", from: "a" }], { movetimeMs: 50 });
  expect(out[0]).toEqual({ from: "a", cp: null, mateIn: 3, timedOut: false });
});

test("a throwing engine degrades to a timed-out suggestion (advisory by contract)", async () => {
  const { pool } = makePool([new Map([["f0", { cp: 0 }]])], { throwOnEval: true });
  await pool.start();
  const feed = new StarChessFeed(pool);

  const out = await feed.evaluate([{ fen: "f0", from: "0" }], { movetimeMs: 50 });
  expect(out[0]).toEqual({ from: "0", cp: null, mateIn: null, timedOut: true });
});

test("a single engine never serves two candidates concurrently (serialization) [BLOCKER guard]", async () => {
  // One engine, 4 candidates: round-robin wraps so all 4 land on engine[0].
  // The per-engine lock must force them one-at-a-time (no UCI interleave).
  const { pool, engines } = makePool([new Map()], { delayMs: 5 });
  await pool.start();
  expect(pool.size).toBe(1);

  const feed = new StarChessFeed(pool);
  await feed.evaluate(
    [
      { fen: "a", from: "0" },
      { fen: "b", from: "1" },
      { fen: "c", from: "2" },
      { fen: "d", from: "3" },
    ],
    { movetimeMs: 200 },
  );

  const engine = engines[0]!;
  expect(engine.peakConcurrency).toBe(1);
  expect(engine.log.sort()).toEqual(["a", "b", "c", "d"]);
});
