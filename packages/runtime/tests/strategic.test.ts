// SPEC: _spec/checkpoint-runtime.puml
import { expect, test } from "bun:test";
import { initializeGame, openGame, settleGame } from "../../contracts/src/game-session";
import type { PlanPermit } from "../../contracts/src/episode";
import { StrategicDriver } from "../src/strategic";
import type { StrategicApi } from "../src/strategic";
import { deriveStream } from "../src/rng";

function setup() {
  let now = 0n, plans = 0, folds = 0;
  let altered: ((result: unknown) => void) | null = null;
  const memory = () => ({ perSide: { w: {}, b: {} } });
  const api: StrategicApi = { strategicScript: opts => {
    expect(opts).toEqual({ feed: null });
    return { play: (snapshot: unknown, context: unknown) => {
      plans++;
      const ctx = context as { movetimeMs: number; rng: () => number };
      expect(ctx.movetimeMs).toBe(0); ctx.rng();
      const result = { snapshot: structuredClone(snapshot), spendMinerals: 0 };
      altered?.(result);
      return result;
    } };
  }, seedKvsForOpening: memory, seedCcIntelForOpening: memory, seedRunnerMemory: memory, seedAttackerMemory: memory,
    updateKvsForSnap: value => { folds++; return value; }, updateCcIntelForSnap: value => value, updateRunnersForSnap: value => value,
    updateAttackersForSnap: value => value, witnessFromEndTurn: () => ({}) };
  const initial = initializeGame(), opened = openGame(initial), rng = deriveStream(101, "opponent");
  const worker = new StrategicDriver("synthetic", "w", initial.snapshot, rng, api, () => now, 100_000_000_000n);
  const owner = new StrategicDriver("synthetic", "w", initial.snapshot, rng, api, () => now, 100_000_000_000n);
  const permit: PlanPermit = { version: "chess-coach.plan-permit.v1", attemptId: "synthetic", permitId: "synthetic:plan:0:w", planningOrdinal: 0,
    turn: 0, side: "w", role: "strategic", issuedNs: "0", deadlineNs: "10000000000" };
  return { worker, owner, permit, initial, opened, plans: () => plans, folds: () => folds, time: (value: bigint) => { now = value; }, alter: (fn: typeof altered) => { altered = fn; } };
}

test("strategic planning waits for permit and exact replay ACK commits only the tentative opponent stream", async () => {
  const env = setup();
  expect(env.plans()).toBe(0);
  env.worker.advance(env.opened); env.owner.advance(env.opened);
  expect(env.plans()).toBe(0);
  const before = env.worker.sampling(), json = await env.worker.plan(JSON.stringify(env.permit));
  expect(env.worker.sampling()).toEqual(before);
  const accepted = await env.owner.verify({ json, receivedNs: 0n }, env.permit);
  env.worker.acceptAck(accepted.digest);
  expect(env.worker.sampling().drawCount).toBe(1);
  expect(env.owner.sampling()).toEqual(env.worker.sampling());
  expect(env.plans()).toBe(2);
  const settled = settleGame(env.opened.session, { w: accepted.journal.actions, b: [] });
  env.worker.advance(settled); env.owner.advance(settled);
  expect(env.folds()).toBe(2);
  expect(env.opened.session.snapshot.queue?.actions).toEqual([]);
});

test("wrong permit, missing open, first-side mutation and late receipts cannot become opponent ACKs", async () => {
  const unopened = setup();
  await expect(unopened.worker.plan(JSON.stringify(unopened.permit))).rejects.toThrow("PHASE");
  expect(unopened.plans()).toBe(0);
  for (const kind of ["role", "side", "ordinal", "late", "mutation", "spend"] as const) {
    const env = setup(); env.worker.advance(env.opened); env.owner.advance(env.opened);
    if (kind === "mutation" || kind === "spend") env.alter(result => {
      const value = result as { snapshot: { placement: string }; spendMinerals: number };
      if (kind === "mutation") value.snapshot.placement = "4k3/8/8/8/8/8/8/4K3";
      else value.spendMinerals = 1;
    });
    const permit = { ...env.permit, ...(kind === "role" ? { role: "candidate" } : kind === "side" ? { side: "b" } : kind === "ordinal" ? { planningOrdinal: 1 } : {}) };
    if (kind === "late") {
      const json = await env.worker.plan(JSON.stringify(permit));
      env.time(10_000_000_000n);
      await expect(env.owner.verify({ json, receivedNs: 10_000_000_000n }, env.permit)).rejects.toThrow("RECEIPT");
    } else await expect(env.worker.plan(JSON.stringify(permit))).rejects.toThrow();
    expect(env.worker.sampling().drawCount).toBe(0);
  }
});

test("tampered actions/RNG/spend fail replay and repeated ACK cannot roll back known state", async () => {
  const env = setup(); env.worker.advance(env.opened); env.owner.advance(env.opened);
  const json = await env.worker.plan(JSON.stringify(env.permit)), bad = JSON.parse(json);
  bad.reportedMinSpend = 1;
  await expect(env.owner.verify({ json: JSON.stringify(bad), receivedNs: 0n }, env.permit)).rejects.toThrow("REPLAY_MISMATCH");
  expect(env.owner.sampling().drawCount).toBe(0);
  const good = setup(); good.worker.advance(good.opened); good.owner.advance(good.opened);
  const accepted = await good.owner.verify({ json: await good.worker.plan(JSON.stringify(good.permit)), receivedNs: 0n }, good.permit);
  good.worker.acceptAck(accepted.digest);
  expect(() => good.worker.acceptAck(accepted.digest)).toThrow("ACK");
  expect(good.worker.sampling().drawCount).toBe(1);
});
