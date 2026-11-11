// SPEC: _spec/runtime-protocol.puml, _spec/supervision.puml
import { expect, test } from "bun:test";
import { NativeJob } from "../src/job";
import { syntheticSession } from "./fixture";
import type { NativeProofSession } from "../src/job";

const start = JSON.stringify({ version: "chess-coach.job.v1", sessionId: "synthetic-session", operation: "native-proof" });
test("native job boot barrier does no game work and releases one fixed synthetic proof only", async () => {
  const env = syntheticSession();
  let created = 0;
  const job = new NativeJob("synthetic-session", () => 0n, () => { created++; return env.session; }, async () => {});
  expect(JSON.parse(job.boot()).kind).toBe("boot");
  expect(created).toBe(0);
  expect(env.main.requests).toEqual([]);
  const reply = JSON.parse(await job.run(start));
  expect(reply.kind).toBe("native-proof-complete");
  expect(reply.boundaries).toHaveLength(3);
  expect(env.main.finished).toBe(1);
  expect(env.reference.finished).toBe(1);
  expect(created).toBe(1);
  await expect(job.run(start)).rejects.toThrow("NO_RETRY");
  expect(created).toBe(1);
});

test("job rejects worker-selected operations, paths and sessions before creating any process", async () => {
  for (const extra of [{ operation: "policy" }, { executable: "/other/bun" }, { modelId: "a".repeat(64) }, { sessionId: "other" }, { trainingReady: true }]) {
    let created = 0, stopped = 0;
    const job = new NativeJob("synthetic-session", () => 0n, () => { created++; throw new Error("must not create"); }, async () => { stopped++; });
    await expect(job.run(JSON.stringify({ ...JSON.parse(start), ...extra }))).rejects.toThrow();
    expect(created).toBe(0);
    expect(stopped).toBe(1);
    await expect(job.run(start)).rejects.toThrow("NO_RETRY");
  }
});

test("boot wait consumes the local guard and cannot reset on a start command", async () => {
  let now = 1n, created = 0;
  const job = new NativeJob("synthetic-session", () => now, () => { created++; throw new Error("must not create"); }, async () => {});
  job.boot(); now += 10_000_000_000n;
  await expect(job.run(start)).rejects.toThrow("DEADLINE");
  expect(created).toBe(0);
});

test("incomplete close or cleanup cannot publish a native-proof completion", async () => {
  const env = syntheticSession();
  let stopped = 0;
  const session: NativeProofSession = { initialize: () => env.session.initialize(), open: () => env.session.open(), settle: plans => env.session.settle(plans), close: async () => { throw new Error("synthetic close failure"); } };
  const job = new NativeJob("synthetic-session", () => 0n, () => session, async () => { stopped++; });
  await expect(job.run(start)).rejects.toThrow("close failure");
  expect(stopped).toBe(1);
});
