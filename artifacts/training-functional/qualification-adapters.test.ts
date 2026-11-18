// SPEC: _spec/runtime-protocol.puml
import { afterAll, describe, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import * as childProcess from "node:child_process";
import type { AbortSignal, AdapterChild, AdapterIO } from "./qualification-policy-score.ts";

const bunSpawn = spyOn(Bun, "spawn").mockImplementation(() => { throw new Error("FORBIDDEN_REAL_SPAWN"); });
const nodeSpawn = spyOn(childProcess, "spawn").mockImplementation(() => { throw new Error("FORBIDDEN_REAL_SPAWN"); });
const adapters = [await import("./qualification-policy-score.ts"), await import("./qualification-policy-channel.ts")];
afterAll(() => {
  try { expect(bunSpawn).not.toHaveBeenCalled(); expect(nodeSpawn).not.toHaveBeenCalled(); }
  finally { bunSpawn.mockRestore(); nodeSpawn.mockRestore(); }
});

function mockIO(args: string[]) {
  let now = 11, resolve!: (code: number) => void, reject!: (error: unknown) => void;
  const exited = new Promise<number>((yes, no) => { resolve = yes; reject = no; });
  const kills: string[] = [], scheduled: number[] = [], removed: string[] = [];
  const handlers = new Map<AbortSignal, () => void>(), timers = new Set<{ due: number; callback: () => void }>();
  const spawns: { command: string[]; options: Parameters<AdapterIO["spawn"]>[1] }[] = [];
  const child: AdapterChild & { signalCode: string | null } = { exited, signalCode: null, kill: signal => { kills.push(signal); } };
  const io: AdapterIO = {
    args,
    spawn(command, options) { spawns.push({ command, options }); return child; },
    nowMs: () => now,
    schedule(ms, callback) {
      scheduled.push(ms); const timer = { due: now + ms, callback }; timers.add(timer);
      return () => { timers.delete(timer); };
    },
    onSignal(signal, callback) { handlers.set(signal, callback); return () => { removed.push(signal); handlers.delete(signal); }; },
  };
  return { io, child, kills, spawns, scheduled, handlers, timers, removed,
    exit(code: number, signal: string | null = null) { child.signalCode = signal; resolve(code); },
    reject,
    signal(signal: AbortSignal) { handlers.get(signal)?.(); },
    advance(ms: number) {
      now += ms;
      for (const timer of [...timers]) if (timer.due <= now) { timers.delete(timer); timer.callback(); }
    },
  };
}

test("adapter imports remain inert and source uses only builtins behind the main guard", () => {
  expect(bunSpawn).not.toHaveBeenCalled(); expect(nodeSpawn).not.toHaveBeenCalled();
  for (const name of ["score", "channel"]) {
    const source = readFileSync(new URL(`./qualification-policy-${name}.ts`, import.meta.url), "utf8");
    expect(source.split("\n").slice(0, 2)).toEqual(["#!/usr/local/bin/bun", "// SPEC: _spec/runtime-protocol.puml"]);
    expect([...source.matchAll(/\bfrom\s+"([^"]+)"/g)].map(match => match[1])).toEqual(["node:os"]);
    expect(source).not.toMatch(/\b(?:process|Bun)\.env\b|\beval\s*\(|\bshell\s*:/);
    const guard = source.indexOf("if (import.meta.main)");
    expect(guard).toBeGreaterThan(0);
    expect(source.slice(0, guard)).not.toMatch(/Bun\.(?:argv|spawn)|process\.(?:on|off|exit)\s*\(/);
    expect(source.slice(guard)).toContain("args: Bun.argv.slice(2)");
    expect(source.slice(guard)).toContain("process.exit(code)");
  }
});

for (const adapter of adapters) describe(`MOCK ${adapter.NATIVE_EXECUTABLE}`, () => {
  const args = () => ["relative config.json", "record;$literal.bpk", ...(adapter.ARGUMENT_COUNT === 3 ? ["attempt:learner:a"] : [])];
  const clean = (env: ReturnType<typeof mockIO>) => {
    expect(env.handlers.size).toBe(0); expect(env.timers.size).toBe(0); expect(env.removed).toEqual(["SIGTERM", "SIGINT"]);
  };

  test("passes exact arguments, fixed environment and inherited descriptors without a normal work timer", async () => {
    const original = args(), env = mockIO(original), running = adapter.runAdapter(env.io);
    expect(env.spawns).toHaveLength(1);
    expect(env.spawns[0]!.command).toEqual([adapter.NATIVE_EXECUTABLE, ...original]);
    expect(env.spawns[0]!.options).toEqual({ env: {
      PATH: "/usr/local/cuda/bin:/usr/local/bin:/usr/bin:/bin", HOME: "/scratch/home", XDG_DATA_HOME: "/opt/tracel-data", TMPDIR: "/tmp",
      LD_LIBRARY_PATH: "/usr/local/cuda/lib64:/usr/lib/x86_64-linux-gnu:/usr/local/nvidia/lib64:/usr/local/nvidia/lib",
      CUDA_PATH: "/usr/local/cuda", RAYON_NUM_THREADS: "2", CUDA_CACHE_PATH: "/scratch/home/cuda-cache",
    }, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    expect(Object.isFrozen(adapter.FIXED_ENV)).toBe(true);
    expect(env.spawns[0]!.options.env).toBe(adapter.FIXED_ENV);
    env.advance(60_000); expect(env.kills).toEqual([]); expect(env.scheduled).toEqual([]);
    env.exit(0); expect(await running).toBe(0); expect(original).toEqual(args()); clean(env);
  });

  test("does not parse, buffer or add a newline to inherited score JSON", async () => {
    const env = mockIO(args()), inherited = { input: Buffer.from('{"request":"mock"}'), output: Buffer.alloc(0) };
    const response = Buffer.from('{"logits":[0.25,-0.5]}');
    env.io.spawn = (command, options) => {
      env.spawns.push({ command, options });
      expect(options.stdin).toBe("inherit"); expect(options.stdout).toBe("inherit");
      inherited.output = response; return env.child;
    };
    const running = adapter.runAdapter(env.io); env.exit(0);
    expect(await running).toBe(0); expect(inherited.output).toBe(response);
    expect(inherited.output.toString()).toBe('{"logits":[0.25,-0.5]}');
    expect(inherited.input.toString()).toBe('{"request":"mock"}'); clean(env);
  });

  test("rejects wrong argument counts and NUL before acquisition without adding path/session rules", async () => {
    for (const invalid of [[], [...args(), "extra"], args().map((arg, index) => index ? arg : "bad\0arg")]) {
      const env = mockIO(invalid); expect(await adapter.runAdapter(env.io)).toBe(2);
      expect(env.spawns).toEqual([]); expect(env.handlers.size).toBe(0); expect(env.scheduled).toEqual([]);
    }
    const env = mockIO(args().map(() => "")), running = adapter.runAdapter(env.io);
    env.exit(2); expect(await running).toBe(2); expect(env.spawns[0]!.command.slice(1)).toEqual([...env.io.args]); clean(env);
  });

  test("preserves numeric exit codes and maps signals or uncertain native status to nonzero", async () => {
    for (const [code, signal, expected] of [[0, null, 0], [2, null, 2], [37, null, 37], [255, null, 255],
      [0, "SIGINT", 130], [0, "SIGTERM", 143], [0, "SIGKILL", 137], [0, "UNKNOWN", 1], [-1, null, 1], [NaN, null, 1]] as const) {
      const env = mockIO(args()), running = adapter.runAdapter(env.io); env.exit(code, signal);
      expect(await running).toBe(expected); expect(env.kills).toEqual([]); clean(env);
    }
  });

  test("spawn and exited rejection never report zero and remove registrations", async () => {
    const spawnError = mockIO(args()); spawnError.io.spawn = () => { throw new Error("MOCK_SPAWN_FAILURE"); };
    expect(await adapter.runAdapter(spawnError.io)).toBe(1); clean(spawnError);
    const env = mockIO(args()), running = adapter.runAdapter(env.io); env.reject(new Error("MOCK_EXIT_FAILURE"));
    expect(await running).toBe(1); clean(env);
  });

  test("latches each abort even when the native child later exits zero", async () => {
    for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]] as const) {
      const env = mockIO(args()), running = adapter.runAdapter(env.io);
      env.signal(signal); env.signal(signal); env.exit(0);
      expect(await running).toBe(code); expect(env.kills).toEqual([signal]); expect(env.scheduled).toEqual([1000]); clean(env);
    }
  });

  test("forwards once per signal with one original grace cutoff and returns despite uncertain SIGKILL settlement", async () => {
    const env = mockIO(args()), running = adapter.runAdapter(env.io);
    env.signal("SIGTERM"); env.advance(750); env.signal("SIGINT"); env.signal("SIGTERM");
    expect(env.kills).toEqual(["SIGTERM", "SIGINT"]); expect(env.scheduled).toEqual([adapter.ABORT_GRACE_MS]);
    env.advance(249); expect(env.kills).toEqual(["SIGTERM", "SIGINT"]);
    env.advance(1); expect(await running).toBe(143); expect(env.kills).toEqual(["SIGTERM", "SIGINT", "SIGKILL"]); clean(env);
    env.exit(0); env.advance(10_000); expect(env.kills).toEqual(["SIGTERM", "SIGINT", "SIGKILL"]);
  });

  test("a failed signal delivery still has bounded nonzero settlement", async () => {
    const env = mockIO(args()); env.child.kill = signal => { env.kills.push(signal); throw new Error("MOCK_KILL_UNCERTAIN"); };
    const running = adapter.runAdapter(env.io); env.signal("SIGINT"); env.advance(1000);
    expect(await running).toBe(130); expect(env.kills).toEqual(["SIGINT", "SIGKILL"]); clean(env);
  });

  test("an abort during signal registration prevents spawn and cleans its timer", async () => {
    const env = mockIO(args()), register = env.io.onSignal;
    env.io.onSignal = (signal, callback) => { const remove = register(signal, callback); if (signal === "SIGINT") callback(); return remove; };
    expect(await adapter.runAdapter(env.io)).toBe(130); expect(env.spawns).toEqual([]); expect(env.kills).toEqual([]); clean(env);
  });
});
