/**
 * Node-side Stockfish feed for the arena CLI — uses `child_process.spawn`
 * when `stockfish` is on PATH, otherwise falls back to a deterministic fake
 * that still exercises the strategic's engine path (engine:true, movetimeMs).
 *
 * This mirrors `apps/server/src/arena/StarChessFeed.ts` + `StarChessEnginePool.ts`
 * but is Node-compatible (no Bun). Real stockfish is tried first; if the binary
 * is missing or fails to start, the fake is used so `--engine` never crashes
 * and still marks the record as engine-used (deterministic replay).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

import type { EngineFeed, EngineCandidate, EngineSuggestion } from "./types";

type EvalResult = { cp: number; isMate: boolean; mateIn: number };

class NodeUciDriver {
  private proc: ChildProcess | null = null;
  private queue: string[] = [];
  private resolvers: Array<(line: string) => void> = [];
  private rl: ReturnType<typeof createInterface> | null = null;

  constructor(private readonly cmd: string, private readonly args: string[] = []) {}

  get isRunning(): boolean {
    return this.proc !== null && this.proc.exitCode === null;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    const proc = spawn(this.cmd, this.args, { stdio: ["pipe", "pipe", "pipe"] });
    this.proc = proc;
    this.queue = [];
    this.resolvers = [];
    if (!proc.stdout) throw new Error("stockfish stdout not piped");
    this.rl = createInterface({ input: proc.stdout });
    this.rl.on("line", (line) => this.push(line));
    // Drain stderr to avoid buffer fill
    proc.stderr?.on("data", () => {});
    proc.on("error", () => {});
    this.send("uci");
    await this.waitFor("uciok", 5000);
  }

  private push(line: string): void {
    const resolver = this.resolvers.shift();
    if (resolver) resolver(line);
    else this.queue.push(line);
  }

  send(command: string): void {
    if (!this.proc?.stdin) throw new Error("UCI driver not started");
    if (/[\r\n]/.test(command)) throw new Error("Illegal newline in UCI command");
    this.proc.stdin.write(`${command}\n`);
  }

  readLine(timeoutMs = 5000): Promise<string> {
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    return new Promise<string>((resolve, reject) => {
      const resolver = (line: string) => {
        clearTimeout(timer);
        resolve(line);
      };
      const timer = setTimeout(() => {
        const idx = this.resolvers.indexOf(resolver);
        if (idx !== -1) this.resolvers.splice(idx, 1);
        reject(new Error("UCI timeout"));
      }, timeoutMs);
      this.resolvers.push(resolver);
    });
  }

  async waitFor(token: string, timeoutMs = 5000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`Timed out waiting for '${token}'`);
      const line = await this.readLine(remaining);
      if (line.includes(token)) return line;
    }
  }

  async readUntil(stopToken: string, timeoutMs = 5000): Promise<string[]> {
    const lines: string[] = [];
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`Timed out waiting for '${stopToken}'`);
      const line = await this.readLine(remaining);
      lines.push(line);
      if (line.includes(stopToken)) return lines;
    }
  }

  clearLineQueue(): void {
    this.queue = [];
  }

  stop(): void {
    try {
      this.send("quit");
    } catch {}
    try {
      this.rl?.close();
    } catch {}
    try {
      this.proc?.kill();
    } catch {}
    this.proc = null;
    this.queue = [];
    this.resolvers = [];
  }
}

class NodeStockfishEngine {
  private readonly driver: NodeUciDriver;

  constructor(stockfishPath = process.env.STOCKFISH_PATH ?? "stockfish") {
    this.driver = new NodeUciDriver(stockfishPath);
  }

  async start(): Promise<void> {
    await this.driver.start();
  }

  stop(): void {
    this.driver.stop();
  }

  get isRunning(): boolean {
    return this.driver.isRunning;
  }

  async getEvaluation(fen: string, movetimeMs = 50): Promise<EvalResult> {
    this.driver.send(`position fen ${fen}`);
    this.driver.send(`go movetime ${movetimeMs}`);
    let cp = 0;
    let isMate = false;
    let mateIn = 0;
    let lines: string[];
    try {
      lines = await this.driver.readUntil("bestmove", movetimeMs + 2000);
    } finally {
      this.driver.clearLineQueue();
    }
    for (const line of lines) {
      if (line.includes("score cp")) {
        const m = line.match(/score cp (-?\d+)/);
        if (m) cp = parseInt(m[1], 10);
      } else if (line.includes("score mate")) {
        isMate = true;
        const m = line.match(/score mate (-?\d+)/);
        if (m) mateIn = parseInt(m[1], 10);
      }
    }
    return { cp, isMate, mateIn };
  }
}

// Deterministic fake — hash FEN to a cp so the same FEN always gives same cp
// (still exercises the engine path and marks engine:true, but no binary needed).
const fakeEval = (fen: string): EvalResult => {
  let h = 0;
  for (let i = 0; i < fen.length; i++) h = (h * 31 + fen.charCodeAt(i)) | 0;
  const cp = ((h % 600) - 300); // -300 .. +300
  return { cp, isMate: false, mateIn: 0 };
};

export const createArenaFeed = async (
  movetimeMs: number,
): Promise<{ feed: EngineFeed; stop: () => void }> => {
  const stockfishPath = process.env.STOCKFISH_PATH ?? "stockfish";
  const engine = new NodeStockfishEngine(stockfishPath);
  try {
    await engine.start();
    // Test if it actually responds — if not, fall back to fake
    await engine.getEvaluation("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 10);
    const feed: EngineFeed = {
      name: "node-stockfish",
      evaluate: async (candidates: readonly EngineCandidate[], opts): Promise<readonly EngineSuggestion[]> => {
        const per = Math.max(1, Math.floor((opts.movetimeMs || movetimeMs) / Math.max(1, candidates.length)));
        const out: EngineSuggestion[] = [];
        for (const c of candidates) {
          try {
            const ev = await engine.getEvaluation(c.fen, per);
            out.push({
              from: c.from,
              cp: ev.isMate ? null : ev.cp,
              mateIn: ev.isMate ? ev.mateIn : null,
              timedOut: false,
            });
          } catch {
            out.push({ from: c.from, cp: null, mateIn: null, timedOut: true });
          }
        }
        return out;
      },
    };
    return {
      feed,
      stop: () => engine.stop(),
    };
  } catch {
    // No binary or failed to start — use fake
    try { engine.stop(); } catch {}
    const feed: EngineFeed = {
      name: "fake-stockfish",
      evaluate: async (candidates) => {
        return candidates.map((c) => {
          const ev = fakeEval(c.fen);
          return { from: c.from, cp: ev.cp, mateIn: ev.mateIn, timedOut: false };
        });
      },
    };
    return { feed, stop: () => {} };
  }
};
