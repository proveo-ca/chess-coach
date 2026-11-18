// SPEC: _spec/runtime-protocol.puml
import { afterAll, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createCanonicalProof } from "./canonical";
import { NativeJob } from "../../../../packages/runtime/src/job";
import { SyntheticTransport } from "../../../../packages/runtime/tests/fixture";
import type { OwnedTransport } from "../../../../packages/runtime/src/native-session";
import type { NativeReply } from "../../../../packages/contracts/src/native-protocol";
import fixture from "../../../../packages/runtime/tests/fixtures/native-reference-proof.json";
import plan from "./plan.json";
import entrypoints from "../../../../tooling/reference-entrypoints.json";

const start = JSON.stringify({ version: "chess-coach.job.v1", sessionId: "synthetic-session", operation: "native-proof" });
const evidence: { name: string; proof: ReturnType<typeof createCanonicalProof> }[] = [];
const rejectedFactories: { value: string; clockCalls: number; spawnCalls: number }[] = [];
function setup(name: string, initial = 0n) {
  let now = initial, clockCalls = 0;
  const clock = () => { clockCalls++; return now; };
  const main = new SyntheticTransport("main", "native-proof", clock), reference = new SyntheticTransport("reference", "native-proof", clock);
  const created: string[] = [];
  const proof = createCanonicalProof({ sessionId: "synthetic-session", clockNs: clock, createPort: role => {
    created.push(role); return role === "main" ? main : reference;
  } });
  evidence.push({ name, proof });
  return { main, reference, created, proof, clock, calls: () => clockCalls, setTime: (value: bigint) => { now = value; } };
}
afterAll(async () => {
  const directory = process.env.CANONICAL_R4_LOCAL_EVIDENCE;
  if (directory === undefined) return;
  if (!/^\/home\/gu1lty\/Projects\/proveo\/chess-coach\/_work\/gpu-owner-recovery\/runs\/host-canonical-r4-source-1\/verification-[1-9][0-9]?\/e2e$/.test(directory)) throw new Error("LOCAL_EVIDENCE_CONTEXT");
  await writeFile(`${directory}/canonical-mock.json`, JSON.stringify({ execution: "MOCK", peerImplementation: "CURRENT_DRIVER_USED_FOR_BOTH_MOCK_PORTS",
    actualHostExecuted: false, trainingReady: false,
    expectedPerPort: { operations: ["init", "commit", "open", "commit", "settle", "commit", "close"], ordinals: [0, 1, 2, 3, 4, 5, 6],
      cursors: [-1, -1, 0, 0, 1, 1, 2], replyCursors: [-1, 0, 0, 1, 1, 2, 2], finishCalls: 1 },
    staticFixtureExpectation: fixture, rejectedFactories, runs: evidence.map(item => ({ name: item.name, ...item.proof.receipt() })) },
  (_key, value: unknown) => typeof value === "bigint" ? String(value) : value, 2) + "\n", { flag: "wx", mode: 0o600 });
});

test("MOCK plan fixes the selected pin, six entries, four paths and unselected delivery", () => {
  expect(plan.reference).toBe(entrypoints.reference);
  expect(plan.bunVersion).toBe("1.4.0");
  expect(plan.referenceEntries).toEqual(entrypoints.entries);
  expect(plan.referenceEntries).toHaveLength(6);
  expect(plan.referenceProofImports).toHaveLength(4);
  expect(plan.referenceInputDelivery).toBe("REFERENCE_INPUT_DELIVERY_UNSELECTED");
  expect(Object.values(plan.qualifications)).toEqual([false, false, false, false, false, false]);
  expect(plan.hostExecutionApproved || plan.referenceBuildApproved || plan.referenceStageApproved || plan.referenceCaptureApproved || plan.referenceAcquisitionApproved || plan.trainingExecuted || plan.trainingReady).toBe(false);
});

test("MOCK boot preserves NativeJob v1 and the constructor's first clock origin without creating ports", () => {
  const env = setup("boot", 37n);
  expect(env.calls()).toBe(1);
  expect(env.created).toEqual([]);
  expect(JSON.parse(env.proof.boot())).toEqual({ version: "chess-coach.job.v1", sessionId: "synthetic-session", kind: "boot" });
  expect(env.main.requests).toEqual([]);
  expect(env.calls()).toBe(1);
  expect(env.proof.receipt()).toMatchObject({ execution: "MOCK", originNs: "37", workDeadlineNs: "10000000037", cleanupDeadlineNs: "300000000037", success: false });
});

for (const value of [null, false, 0, "", {}]) {
  test(`MOCK constructor rejects supplied non-function factory ${JSON.stringify(value)} before clock or process creation`, () => {
    let clockCalls = 0;
    const spawn = spyOn(Bun, "spawn").mockImplementation(() => { throw new Error("FORBIDDEN_PROCESS_SPAWN"); });
    try {
      expect(() => createCanonicalProof({ sessionId: "synthetic-session", clockNs: () => { clockCalls++; return 0n; },
        createPort: value as unknown as NonNullable<Parameters<typeof createCanonicalProof>[0]["createPort"]> })).toThrow("PORT_FACTORY");
      expect(clockCalls).toBe(0);
      expect(spawn).not.toHaveBeenCalled();
      rejectedFactories.push({ value: JSON.stringify(value), clockCalls, spawnCalls: spawn.mock.calls.length });
    } finally { spawn.mockRestore(); }
  });
}

test("MOCK exact BOTH protocol commits three actual fixture boundaries and two independent finish results", async () => {
  const env = setup("success");
  env.proof.boot();
  const replyJson = await env.proof.run(start), reply = JSON.parse(replyJson), result = env.proof.receipt();
  expect(result.execution).toBe("MOCK");
  expect(result.hostProofQualified || result.independentReferenceQualified || result.trainingReady || result.trainingExecuted).toBe(false);
  expect(result.success).toBe(true);
  expect(result.phase).toBe("complete");
  expect(env.created).toEqual(["main", "reference"]);
  expect(result.boundaries.map(item => item.boundary.kind)).toEqual(["initial", "opened", "settled"]);
  expect(reply).toEqual({ version: "chess-coach.job.v1", sessionId: "synthetic-session", kind: "native-proof-complete", boundaries: result.boundaries.map(item => item.digest) });
  expect(result.reply?.json).toBe(replyJson);
  expect(result.exchanges).toHaveLength(14);
  for (const role of ["main", "reference"] as const) {
    const operations = result.exchanges.filter(item => item.role === role);
    expect(operations.map(item => item.operation)).toEqual(["init", "commit", "open", "commit", "settle", "commit", "close"]);
    expect(operations.map(item => item.ordinal)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(operations.map(item => item.cursor)).toEqual([-1, -1, 0, 0, 1, 1, 2]);
    expect(operations.map(item => item.stagedCursor)).toEqual([null, 0, null, 1, null, 2, null]);
    expect(operations.map(item => item.reply?.cursor)).toEqual([-1, 0, 0, 1, 1, 2, 2]);
    expect(operations.map(item => item.reply?.stagedCursor)).toEqual([0, null, 1, null, 2, null, null]);
    expect(operations.map(item => item.reply?.kind)).toEqual(["staged", "committed", "staged", "committed", "staged", "committed", "closed"]);
    expect(operations.map(item => item.reply?.role)).toEqual(Array(7).fill(role));
    for (const [index, boundary] of result.boundaries.entries()) {
      expect(operations[index * 2]?.reply?.digest).toBe(boundary.digest);
      expect(operations[index * 2 + 1]?.requestDigest).toBe(boundary.digest);
      expect(operations[index * 2 + 1]?.reply?.digest).toBe(boundary.digest);
    }
    const transport = env[role];
    expect(transport.requests[4]).toMatchObject({ operation: "settle", plans: { w: [], b: [] } });
    expect(transport.finished).toBe(1);
    expect(transport.terminated).toBe(0);
    expect(result.lifecycle.find(item => item.role === role)?.finish).toEqual(transport.receipt);
    for (const [index, request] of transport.requests.entries()) {
      const json = JSON.stringify(request);
      expect(operations[index]?.request).toEqual({ bytes: Buffer.byteLength(json), sha256: createHash("sha256").update(json).digest("hex") });
      expect(operations[index]?.reply?.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(operations[index]?.reply?.bytes).toBeGreaterThan(0);
    }
  }
  expect(result.lifecycle[0]?.finish).not.toBe(result.lifecycle[1]?.finish);
  expect(result.boundaries.map(item => ({ stage: String(item.boundary.kind), bytes: item.bytes, sha256: item.sha256 }))).toEqual(fixture.stages);
  expect(fixture.scope).toBe("BOUNDED_IN_PROCESS_STATIC_RULE_FIXTURE_ONLY");
  expect(fixture.coldF9Proof).toBe(false);
  const detached = env.proof.receipt();
  detached.boundaries[0]!.boundary.bank.w++;
  expect(env.proof.receipt().boundaries[0]!.boundary.bank.w).toBe(3);
});

for (const field of ["stdinClosed", "stdoutEof", "stderrEof", "reaped", "exitCode", "forced"] as const) {
  test(`MOCK rejects reference finish ${field} and withholds completion`, async () => {
    const env = setup(`bad-finish:${field}`);
    if (field === "exitCode") env.reference.receipt.exitCode = 7;
    else if (field === "forced") env.reference.receipt.forced = true;
    else env.reference.receipt[field] = false;
    await expect(env.proof.run(start)).rejects.toThrow("CLEAN_CLOSE");
    const receipt = env.proof.receipt();
    expect(receipt.success).toBe(false);
    expect(receipt.reply).toBeNull();
    expect(receipt.lifecycle.map(item => item.finish)).toEqual([env.main.receipt, env.reference.receipt]);
    expect(env.main.terminated).toBe(1);
    expect(env.reference.terminated).toBe(1);
  });
}

test("MOCK one rejected finish preserves the other actual receipt without fabricating EOF", async () => {
  const env = setup("one-failed-finish");
  env.reference.finish = async () => { throw new Error("mock finish rejected"); };
  await expect(env.proof.run(start)).rejects.toThrow("mock finish rejected");
  const receipt = env.proof.receipt();
  expect(receipt.lifecycle[0]?.finish).toEqual(env.main.receipt);
  expect(receipt.lifecycle[1]?.finish).toBeNull();
  expect(receipt.lifecycle[1]?.finishError).toContain("mock finish rejected");
  expect(receipt.reply).toBeNull();
  expect(receipt.success).toBe(false);
});

for (const kind of ["role", "reference-boundary", "commit", "init-scope", "digest", "ordinal", "session"] as const) {
  test(`MOCK rejects ${kind} corruption before completion`, async () => {
    const env = setup(`corrupt:${kind}`);
    const alter = (reply: NativeReply): NativeReply => {
      if (kind === "role") reply.role = "main";
      if (kind === "reference-boundary" && reply.kind === "staged") reply.boundary.snapshot.gas.w = 2;
      if (kind === "commit" && reply.kind === "committed") reply.cursor++;
      if (kind === "digest" && reply.kind === "committed") reply.digest = "0".repeat(64);
      if (kind === "init-scope" && reply.kind === "staged") reply.boundary.snapshot.placement = "4k3/2pppp2/8/8/8/8/2PPPP2/3K4";
      if (kind === "ordinal") reply.ordinal++;
      if (kind === "session") reply.sessionId = "other";
      return reply;
    };
    env.reference.alter = alter;
    if (kind === "init-scope") env.main.alter = alter;
    await expect(env.proof.run(start)).rejects.toThrow(kind === "init-scope" ? "CANONICAL_OPENING" : undefined);
    expect(env.proof.receipt().reply).toBeNull();
    expect(env.proof.receipt().success).toBe(false);
    expect(env.proof.receipt().failures.length).toBeGreaterThan(0);
    expect(env.main.terminated).toBe(1);
    expect(env.reference.terminated).toBe(1);
    expect(env.main.finished + env.reference.finished).toBe(0);
  });
}

test("MOCK swapped port roles fail the existing session binding", async () => {
  const env = setup("swap-fixture");
  const proof = createCanonicalProof({ sessionId: "synthetic-session", clockNs: env.clock,
    createPort: role => role === "main" ? env.reference : env.main });
  evidence.push({ name: "swapped", proof });
  await expect(proof.run(start)).rejects.toThrow("REPLY_BINDING");
  expect(proof.receipt().success).toBe(false);
  expect(env.main.terminated).toBe(1);
  expect(env.reference.terminated).toBe(1);
});

test("MOCK same underlying port fails before wrappers can defeat identity rejection", async () => {
  const env = setup("same-fixture");
  const proof = createCanonicalProof({ sessionId: "synthetic-session", clockNs: env.clock, createPort: () => env.main });
  evidence.push({ name: "same-underlying", proof });
  await expect(proof.run(start)).rejects.toThrow("SAME_UNDERLYING_PORT");
  expect(env.main.requests).toHaveLength(0);
  expect(env.main.terminated).toBe(1);
  expect(env.reference.terminated).toBe(0);
  expect(proof.receipt().lifecycle).toHaveLength(1);
});

test("MOCK second factory startup consumes the original ten seconds instead of resetting it", async () => {
  const env = setup("startup-fixture", 100n);
  const created: string[] = [];
  const proof = createCanonicalProof({ sessionId: "synthetic-session", clockNs: env.clock, createPort: role => {
    created.push(role);
    if (role === "reference") env.setTime(10_000_000_100n);
    return role === "main" ? env.main : env.reference;
  } });
  evidence.push({ name: "startup-expired", proof });
  await expect(proof.run(start)).rejects.toThrow("ORIGINAL_WORK_DEADLINE");
  expect(created).toEqual(["main", "reference"]);
  expect(proof.receipt().workDeadlineNs).toBe("10000000100");
  expect(proof.receipt().cleanupDeadlineNs).toBe("300000000100");
  expect(proof.receipt().lifecycle.map(item => item.role)).toEqual(["main", "reference"]);
  expect(proof.receipt().exchanges).toEqual([]);
  expect(proof.receipt()).toMatchObject({ execution: "MOCK", success: false, reply: null, cleanup: "COMPLETE" });
  expect(env.main.requests).toHaveLength(0);
  expect(env.reference.requests).toHaveLength(0);
  expect(env.main.terminated).toBe(1);
  expect(env.reference.terminated).toBe(1);
});

for (const overrun of [0n, 1n]) {
  test(`MOCK first factory returning ${overrun}ns past the original deadline stays owned without launching reference`, async () => {
    const env = setup(`late-first-fixture:${overrun}`, 101n);
    const created: string[] = [];
    const proof = createCanonicalProof({ sessionId: "synthetic-session", clockNs: env.clock, createPort: role => {
      created.push(role);
      env.setTime(10_000_000_101n + overrun);
      return role === "main" ? env.main : env.reference;
    } });
    evidence.push({ name: `late-first-factory:${overrun}`, proof });
    await expect(proof.run(start)).rejects.toThrow("ORIGINAL_WORK_DEADLINE");
    expect(created).toEqual(["main"]);
    expect(proof.receipt().lifecycle.map(item => item.role)).toEqual(["main"]);
    expect(proof.receipt().exchanges).toEqual([]);
    expect(proof.receipt()).toMatchObject({ execution: "MOCK", workDeadlineNs: "10000000101", cleanupDeadlineNs: "300000000101",
      success: false, reply: null, cleanup: "COMPLETE" });
    expect(env.main.requests).toHaveLength(0);
    expect(env.reference.requests).toHaveLength(0);
    expect(env.main.terminated).toBe(1);
    expect(env.reference.terminated).toBe(0);
    expect(env.main.finished + env.reference.finished).toBe(0);
    await expect(proof.run(start)).rejects.toThrow("NO_RETRY");
    expect(created).toEqual(["main"]);
    expect(env.main.terminated).toBe(1);
  });
}

test("MOCK deadline reached before the first acquisition prevents every factory call", async () => {
  let clockCalls = 0, factoryCalls = 0;
  const proof = createCanonicalProof({ sessionId: "synthetic-session", clockNs: () => ++clockCalls < 4 ? 103n : 10_000_000_103n,
    createPort: () => { factoryCalls++; throw new Error("mock factory must not be called"); } });
  evidence.push({ name: "late-before-first-acquisition", proof });
  await expect(proof.run(start)).rejects.toThrow("ORIGINAL_WORK_DEADLINE");
  expect(factoryCalls).toBe(0);
  expect(proof.receipt()).toMatchObject({ execution: "MOCK", workDeadlineNs: "10000000103", cleanupDeadlineNs: "300000000103",
    success: false, reply: null, cleanup: "COMPLETE" });
  expect(proof.receipt().lifecycle).toEqual([]);
  expect(proof.receipt().exchanges).toEqual([]);
});

test("MOCK deadline reached between acquisitions prevents the reference factory and stops only owned main", async () => {
  const env = setup("late-between-acquisitions-fixture", 107n);
  const created: string[] = [];
  let mainReturned = false, afterMainChecks = 0;
  const proof = createCanonicalProof({ sessionId: "synthetic-session", clockNs: () => mainReturned && ++afterMainChecks > 1 ? 10_000_000_107n : 107n,
    createPort: role => {
      created.push(role);
      mainReturned = true;
      return role === "main" ? env.main : env.reference;
    } });
  evidence.push({ name: "late-before-second-acquisition", proof });
  await expect(proof.run(start)).rejects.toThrow("ORIGINAL_WORK_DEADLINE");
  expect(created).toEqual(["main"]);
  expect(proof.receipt()).toMatchObject({ execution: "MOCK", workDeadlineNs: "10000000107", cleanupDeadlineNs: "300000000107",
    success: false, reply: null, cleanup: "COMPLETE" });
  expect(proof.receipt().lifecycle.map(item => item.role)).toEqual(["main"]);
  expect(proof.receipt().exchanges).toEqual([]);
  expect(env.main.requests).toHaveLength(0);
  expect(env.reference.requests).toHaveLength(0);
  expect(env.main.terminated).toBe(1);
  expect(env.reference.terminated).toBe(0);
});

test("MOCK boot wait cannot renew the original deadline or create a late port", async () => {
  const env = setup("boot-expired", 17n);
  env.proof.boot(); env.setTime(10_000_000_017n);
  await expect(env.proof.run(start)).rejects.toThrow("DEADLINE");
  expect(env.created).toEqual([]);
  expect(env.proof.receipt().cleanupDeadlineNs).toBe("300000000017");
});

test("MOCK clean exit at the ten-second boundary still cannot publish success", async () => {
  const env = setup("late-close", 19n);
  env.reference.finish = async () => { env.setTime(10_000_000_019n); return env.reference.receipt; };
  await expect(env.proof.run(start)).rejects.toThrow("DEADLINE");
  expect(env.proof.receipt().lifecycle.every(item => item.finish?.reaped)).toBe(true);
  expect(env.proof.receipt().reply).toBeNull();
});

test("MOCK partial factory failure stops only the first owned port and never retries", async () => {
  const env = setup("partial-fixture");
  let creations = 0;
  const proof = createCanonicalProof({ sessionId: "synthetic-session", clockNs: env.clock, createPort: role => {
    creations++; if (role === "reference") throw new Error("mock second factory failure"); return env.main;
  } });
  evidence.push({ name: "partial-factory", proof });
  await expect(proof.run(start)).rejects.toThrow("second factory failure");
  expect(proof.receipt()).toMatchObject({ success: false, cleanup: "COMPLETE", reply: null });
  expect(proof.receipt().lifecycle).toHaveLength(1);
  expect(env.main.terminated).toBe(1);
  expect(env.reference.terminated).toBe(0);
  await expect(proof.run(start)).rejects.toThrow("NO_RETRY");
  expect(creations).toBe(2);
  expect(env.main.terminated).toBe(1);
});

test("MOCK failed cleanup uses origin plus 300 seconds and does not grant a fresh 300", async () => {
  const env = setup("cleanup-fixture", 23n);
  env.main.terminate = async () => { env.setTime(300_000_000_023n); };
  const proof = createCanonicalProof({ sessionId: "synthetic-session", clockNs: env.clock, createPort: role => {
    if (role === "reference") { env.setTime(299_000_000_023n); throw new Error("mock startup failure"); }
    return env.main;
  } });
  evidence.push({ name: "original-cleanup-deadline", proof });
  await expect(proof.run(start)).rejects.toThrow("ORIGINAL_CLEANUP_DEADLINE");
  expect(proof.receipt()).toMatchObject({ cleanupDeadlineNs: "300000000023", cleanup: "FAILED", success: false, reply: null });
  expect(proof.receipt().failures.map(item => item.message).join("\n")).toContain("mock startup failure");
});

test("MOCK task cleanup bounds a non-resolving owned termination to the remaining original budget", async () => {
  const env = setup("cleanup-hang-fixture");
  const port: OwnedTransport = { exchange: json => env.main.exchange(json), finish: () => env.main.finish(), terminate: () => new Promise<void>(() => {}) };
  const proof = createCanonicalProof({ sessionId: "synthetic-session", clockNs: env.clock, createPort: role => {
    if (role === "reference") { env.setTime(299_999_000_000n); throw new Error("mock failure near cleanup deadline"); }
    return port;
  } });
  evidence.push({ name: "bounded-hanging-cleanup", proof });
  await expect(proof.run(start)).rejects.toThrow("ORIGINAL_CLEANUP_DEADLINE");
  expect(proof.receipt().cleanup).toBe("FAILED");
  expect(proof.receipt().success).toBe(false);
}, 1000);

test("MOCK rejected owned termination cannot mask itself as successful cleanup", async () => {
  const env = setup("cleanup-error");
  env.reference.alter = reply => ({ ...reply, ordinal: reply.ordinal + 1 });
  env.main.terminate = async () => { throw new Error("mock terminate rejected"); };
  await expect(env.proof.run(start)).rejects.toThrow();
  expect(env.proof.receipt().cleanup).toBe("FAILED");
  expect(env.proof.receipt().lifecycle[0]?.terminateError).toContain("mock terminate rejected");
  expect(env.proof.receipt().success).toBe(false);
});

test("MOCK actual NativeJob v1 consumes one start and rejects replay without a second session", async () => {
  const env = setup("native-job-replay");
  let created = 0, stopped = 0;
  const job = new NativeJob("synthetic-session", env.clock, () => {
    created++;
    return { initialize: async () => { throw new Error("mock initial failure"); }, open: async () => { throw new Error("unreachable"); },
      settle: async () => { throw new Error("unreachable"); }, close: async () => {} };
  }, async () => { stopped++; });
  expect(JSON.parse(job.boot()).kind).toBe("boot");
  await expect(job.run(start)).rejects.toThrow("mock initial failure");
  await expect(job.run(start)).rejects.toThrow("NO_RETRY");
  expect(created).toBe(1);
  expect(stopped).toBe(2);
});

test("MOCK successful composed job also refuses a second start and revokes its receipt", async () => {
  const env = setup("success-replay");
  await env.proof.run(start);
  await expect(env.proof.run(start)).rejects.toThrow("NO_RETRY");
  expect(env.created).toEqual(["main", "reference"]);
  expect(env.main.requests).toHaveLength(7);
  expect(env.proof.receipt()).toMatchObject({ success: false, reply: null });
});

test("MOCK wrong operation or extra authority never creates a port", async () => {
  for (const extra of [{ operation: "policy" }, { executable: "/other/bun" }, { trainingReady: true }]) {
    const env = setup(`rejected-start:${JSON.stringify(extra)}`);
    await expect(env.proof.run(JSON.stringify({ ...JSON.parse(start), ...extra }))).rejects.toThrow();
    expect(env.created).toEqual([]);
    expect(env.proof.receipt().reply).toBeNull();
  }
});
