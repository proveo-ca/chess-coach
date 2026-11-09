// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodeGpuAttemptProposal, decodeGpuJobReply } from "../../contracts/src/gpu-job";
import { nextAttempt } from "../src/curriculum";
import { FIXED_ATTEMPT_LAYOUT, FixedAttemptFactory } from "../src/fixed-attempt";
import { runGpuJobLoop } from "../src/gpu-job";
import { MatchSession } from "../src/match-session";
import { matchFixture, syntheticCorpus } from "./match-fixture";
import { registerGpuOwnerFixture } from "./fixtures/gpu-owner/register";
import type { GpuOwnerFixture } from "./fixtures/gpu-owner/register";
import { gpuOwnerTestRoot, inputStream } from "./fixtures/gpu-owner/support";

const jsonFile = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
function gone(pid: unknown): void {
  expect(typeof pid).toBe("number");
  let code: unknown;
  try { process.kill(pid as number, 0); } catch (error) { code = (error as NodeJS.ErrnoException).code; }
  expect(code).toBe("ESRCH");
}
function cleanChildren(f: GpuOwnerFixture): void {
  const root = f.layout.factory.cwd;
  for (const name of ["learner-a", "learner-b", "match"]) {
    const receipt = jsonFile(join(root, `${name}.receipt.json`));
    expect(receipt.stdinEof).toBe(true); gone(receipt.pid);
  }
  for (const suffix of ["a", "b"]) {
    const receipt = jsonFile(join(root, `learner-${suffix}.receipt.json`));
    expect(receipt.events).toEqual(["begin", "finish", "close"]);
    expect(receipt.configPath).toBe(join(f.layout.factory.scratchRoot, `attempt-${f.attemptId}`, "config.json"));
    expect(receipt.recordPath).toBe(join(f.layout.factory.scratchRoot, `attempt-${f.attemptId}`, "model.bpk"));
  }
  expect(jsonFile(join(root, "match.receipt.json"))).toMatchObject({ scores: 0, scorerClosed: 1, scorerStopped: 0 });
  expect(readdirSync(f.layout.factory.scratchRoot)).toEqual([]);
}

describe("GPU owner real fixed attempt connection", () => {
  test("fixture driver calls the real loop, commits SQLite once, closes/reaps three children and releases scratch", async () => {
    const f = registerGpuOwnerFixture(gpuOwnerTestRoot("gpu-driver"));
    const child = Bun.spawn(["/usr/local/bin/bun", "--no-env-file", "--no-install", f.driverPath, f.sessionId],
      { cwd: f.layout.factory.cwd, stdin: "pipe", stdout: "pipe", stderr: "pipe", env: { PATH: "/usr/local/bin:/usr/bin:/bin", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0" } });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      timer = setTimeout(() => child.kill("SIGKILL"), 15000);
      child.stdin.write(f.startJson + "\n"); await child.stdin.end();
      const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      writeFileSync(join(f.layout.factory.cwd, "driver.stdout"), stdout, { flag: "wx", mode: 0o600 });
      writeFileSync(join(f.layout.factory.cwd, "driver.stderr"), stderr, { flag: "wx", mode: 0o600 });
      expect(stderr).toBe(""); expect(exitCode).toBe(0); expect(stdout.endsWith("\n")).toBe(true);
      const replies = stdout.trimEnd().split("\n").map(decodeGpuJobReply);
      expect(replies.map(reply => reply.kind)).toEqual(["boot", "startup", "attempt-proposal"]);
      const proposal = replies[2]!;
      if (proposal.kind !== "attempt-proposal") throw new Error("proposal required");
      expect(proposal.descriptorSha256).toBe(f.expectedDescriptorSha256);
      const accepted = decodeGpuAttemptProposal(proposal.proposalJson, proposal.proposalSha256, f.expectedDescriptorSha256);
      expect(accepted.state.counters).toEqual({ started: 1, verifiedCompleted: 1, eligibleCompleted: 0, updates: 0, nonzeroPGUpdates: 0, baselineCount: 0, baselineSum: 0 });
      expect(accepted.initialModelId).toBe(f.initialModelId); expect(accepted.state.modelId).toBe(f.initialModelId);
      const db = new Database(join(f.layout.stateRoot, "private.sqlite"), { readonly: true });
      try {
        expect(db.query("SELECT id,ordinal,status FROM attempts").all()).toEqual([{ id: f.attemptId, ordinal: 0, status: "COMPLETED" }]);
        expect(db.query("SELECT master,pending,status FROM masters").all()).toEqual([{ master: 101, pending: null, status: "active" }]);
        expect(db.query("SELECT aborted FROM control").get()).toEqual({ aborted: 0 });
      } finally { db.close(); }
      cleanChildren(f);
      const attemptPath = join(f.layout.stateRoot, "packet-00", `attempt-${f.attemptId}`);
      const journal = readFileSync(join(attemptPath, readdirSync(attemptPath).find(name => name.endsWith("verified-journal.bin"))!), "utf8");
      const events = journal.trimEnd().split("\n").map(line => JSON.parse(line).event);
      expect(events.find(event => event.kind === "match-exit").value).toEqual({ stdinClosed: true, stdoutEof: true, stderrEof: true, reaped: true, exitCode: 0, forced: false });
      expect(events.find(event => event.kind === "learners-closed").value.kind).toBe("diagnostic");
    } finally { if (timer !== undefined) clearTimeout(timer); if (child.exitCode === null) { child.kill("SIGKILL"); await child.exited; } }
  }, 20000);

  test("copies trusted factory layout and preserves historical two-argument defaults", async () => {
    expect(FIXED_ATTEMPT_LAYOUT).toEqual({ scratchRoot: "/tmp/episode-model", cwd: "/app", bunExecutable: "/usr/local/bin/bun",
      learnerExecutable: "/usr/local/bin/policy-channel", matchEntrypoint: "/app/packages/runtime/src/match-worker-main.ts" });
    const f = registerGpuOwnerFixture(gpuOwnerTestRoot("gpu-layout")), layout = { ...f.layout.factory }, corpus = syntheticCorpus(0);
    const factory = new FixedAttemptFactory(corpus, null, layout);
    layout.learnerExecutable = "/not-the-selected-learner"; layout.matchEntrypoint = "/not-the-selected-match";
    const timing = { clockNs: () => 0n, originNs: 0n, startupDeadlineNs: 10_000_000_000n, workDeadlineNs: 297_000_000_000n, cleanupDeadlineNs: 300_000_000_000n };
    const { consumed } = nextAttempt(f.initialState, f.attemptId), model = { config: JSON.parse(f.inputJson).modelConfig, record: readFileSync(f.layout.initialRecordPath) };
    const dependencies = await factory.create({ descriptor: f.descriptor, rng: consumed.rng, model, directory: f.layout.factory.cwd, timing });
    let called = 0;
    try {
      const session = new MatchSession({ ...dependencies, ...timing, descriptor: f.descriptor, rng: consumed.rng, onStarted: async () => {
        called++;
        for (const suffix of ["a", "b"]) expect(JSON.parse(readFileSync(join(f.layout.factory.cwd, `learner-${suffix}.events.json`), "utf8"))).toEqual(["begin"]);
        expect(existsSync(join(f.layout.factory.cwd, "match.receipt.json"))).toBe(false);
      } });
      const result = await session.run(); expect(result.sampledDecisions).toBe(0); expect(called).toBe(1);
    } finally { dependencies.releaseInputs?.(); }
    cleanChildren(f);
  });

  test("late startup emission aborts all owned children and releases real factory scratch", async () => {
    const f = registerGpuOwnerFixture(gpuOwnerTestRoot("gpu-late-startup")), writes: string[] = [];
    let now = 0n;
    await expect(runGpuJobLoop({ sessionId: f.sessionId, layout: f.layout, input: inputStream(f.startJson + "\n"), clockNs: () => now,
      loadCorpus: async () => syntheticCorpus(0), loadStrategic: async () => null, write: async json => {
        writes.push(json);
        if (decodeGpuJobReply(json).kind === "startup") now = 10_000_000_000n;
      } })).rejects.toThrow();
    expect(writes.map(json => decodeGpuJobReply(json).kind)).toEqual(["boot", "startup"]);
    expect(readdirSync(f.layout.factory.scratchRoot)).toEqual([]);
    for (const name of ["learner-a", "learner-b", "match"]) gone(jsonFile(join(f.layout.factory.cwd, `${name}.started.json`)).pid);
    const db = new Database(join(f.layout.stateRoot, "private.sqlite"), { readonly: true });
    try { expect(db.query("SELECT aborted FROM control").get()).toEqual({ aborted: 1 }); expect(db.query("SELECT status FROM attempts").get()).not.toEqual({ status: "COMPLETED" }); }
    finally { db.close(); }
  });

  test("callback errors and late callback completion stay before first accept and use existing cleanup", async () => {
    for (const mode of ["error", "late"] as const) {
      const f = matchFixture({ windows: 0 }); let calls = 0;
      const session = new MatchSession({ descriptor: f.descriptor, rng: f.rng, corpus: f.corpus, strategic: null, learners: f.learners,
        transport: f.transport, verifier: f.verifier, clockNs: () => mode === "late" && calls > 0 ? 10_000_000_000n : 0n,
        originNs: 0n, startupDeadlineNs: 10_000_000_000n, workDeadlineNs: 297_000_000_000n, cleanupDeadlineNs: 300_000_000_000n,
        onStarted: async () => { calls++; if (mode === "error") throw new Error("startup callback failed"); } });
      await expect(session.run()).rejects.toThrow(); expect(calls).toBe(1);
      expect(f.transport.requests.map(request => request.operation)).toEqual(["start"]);
      expect(f.learners.begun).toBe(1); expect(f.learners.aborted).toBe(1); expect(f.transport.stopped).toBe(1);
    }
  });
});
