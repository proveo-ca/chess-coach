/**
 * `StarChessEnginePool` — the node-side pool of classical Stockfish sub-procs
 * that back `StarChessFeed`.
 *
 * The feed scores many candidate projections per planning window; a single
 * subprocess would serialize them. The pool fans a batch out across `size`
 * engines (default from `STARCHESS_ARENA_ENGINES`, clamped to a documented
 * maximum). Each engine is started lazily on first use and `clearLineQueue()`d
 * by `UciDriver` after every eval, so a straggler `bestmove` from one query is
 * never misattributed to another.
 *
 * **Serialization invariant:** a native Stockfish subprocess can only carry
 * one UCI command sequence (`position` + `go` + `bestmove`) at a time — two
 * interleaved `getEvaluation` calls on the same subprocess corrupt the driver's
 * line queue and hand each caller the other's `bestmove`. The pool therefore
 * gives every engine an internal FIFO lock: `score()` round-robins which engine
 * handles a candidate but *awaits* that engine's lock, so concurrent candidates
 * that land on the same engine run one after another instead of overlapping.
 * Different engines still run in parallel. Callers never touch engines directly.
 *
 * Engines are soft-typed (`EngineLike`) so tests inject fakes — no native
 * stockfish on the CI/e2e host.
 *
 * // SPEC: _spec/apps/server/starchess-arena-feed.puml
 */

import { StockfishEngine, type EvalResult } from "../StockfishEngine.ts";

export interface EngineLike {
  start(): Promise<void>;
  stop(): void;
  getEvaluation(fen: string, opts?: { depth?: number; movetimeMs?: number }): Promise<EvalResult>;
  isRunning: boolean;
}

/** Suggested ceiling for spawned native subprocesses (env is clamped to this). */
export const MAX_ARENA_ENGINES = 16;

/** Number of parallel classical engines for the arena feed (env-tunable, clamped). */
export const poolSizeFromEnv = (): number => {
  const raw = Number(process.env.STARCHESS_ARENA_ENGINES ?? "2");
  if (!Number.isFinite(raw)) return 2;
  return Math.min(MAX_ARENA_ENGINES, Math.max(1, Math.floor(raw)));
};

/** A per-engine FIFO lock: queues async work so one subprocess runs one at a time. */
class EngineSlot {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export class StarChessEnginePool {
  private readonly engines: EngineLike[] = [];
  private readonly slots: EngineSlot[] = [];
  private cursor = 0;

  constructor(
    size = poolSizeFromEnv(),
    private readonly stockfishPath = "stockfish",
    private readonly defaultTimeoutMs = 15_000,
  ) {
    const clamped = Math.min(MAX_ARENA_ENGINES, Math.max(1, Math.floor(size)));
    for (let i = 0; i < clamped; i += 1) {
      this.engines.push(this.spawn());
      this.slots.push(new EngineSlot());
    }
  }

  /** Hook for tests — subclass to return a fake engine. */
  protected spawn(): EngineLike {
    return new StockfishEngine(this.stockfishPath, this.defaultTimeoutMs);
  }

  get size(): number {
    return this.engines.length;
  }

  /**
   * Score one position on a pool engine. Round-robins which engine handles the
   * query, then serializes through that engine's FIFO lock so two concurrent
   * `score()` calls that land on the same subprocess never overlap.
   */
  score(fen: string, opts?: { depth?: number; movetimeMs?: number }): Promise<EvalResult> {
    const i = this.cursor % this.engines.length;
    this.cursor += 1;
    const engine = this.engines[i]!;
    const slot = this.slots[i]!;
    return slot.run(async () => {
      if (!engine.isRunning) await engine.start();
      return engine.getEvaluation(fen, opts);
    });
  }

  async start(): Promise<void> {
    for (const engine of this.engines) {
      if (!engine.isRunning) await engine.start();
    }
  }

  stop(): void {
    for (const engine of this.engines) engine.stop();
  }
}
