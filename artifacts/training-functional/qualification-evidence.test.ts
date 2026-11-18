// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml, _spec/policy-runtime.puml
import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { LearningReply, LearningRequest } from "../../packages/contracts/src/learning-channel";
import { learningRequestShape } from "../../packages/contracts/src/learning-channel";
import { decodeScoreResponse, MAX_INFERENCE_BYTES, scoreRequestShape } from "../../packages/contracts/src/inference";
import { FEATURES, FEATURE_VERSION } from "../../packages/policy/src/index";
import { gameRecordShape, initializeGame, openGame, settleGame } from "../../packages/contracts/src/game-session";
import type { GamePlans, GameTransition } from "../../packages/contracts/src/game-session";
import type { PlanPermit } from "../../packages/contracts/src/episode";
import { opponentJournalShape } from "../../packages/contracts/src/match";
import type { OpponentJournal } from "../../packages/contracts/src/match";
import { nativeSnapshotShape } from "../../packages/contracts/src/resolution";
import type { RngState } from "../../packages/contracts/src/training-state";
import type { NativeObservation } from "../../packages/runtime/src/fixed-attempt";
import { LearnerPair } from "../../packages/runtime/src/learner-pair";
import { NativeLearner } from "../../packages/runtime/src/native-learner";
import type { OwnedTransport } from "../../packages/runtime/src/native-session";
import { PolicySession, PolicyWorker } from "../../packages/runtime/src/policy-session";
import { PrivateState } from "../../packages/runtime/src/private-state";
import { StrategicDriver } from "../../packages/runtime/src/strategic";
import type { StrategicApi } from "../../packages/runtime/src/strategic";
import { TrainingStore } from "../../packages/runtime/src/training-store";
import type { AttemptSetup } from "../../packages/runtime/src/training-coordinator";
import { cleanExit, SyntheticTransport } from "../../packages/runtime/tests/fixture";
import { bindings, syntheticRecord } from "../../packages/runtime/tests/training-fixture";
import { observeCanonical } from "./qualification";
import { observeR4 } from "./r4-observation";
import type { QualificationEvidenceInput } from "./qualification-evidence";

const spawn = spyOn(Bun, "spawn").mockImplementation(() => { throw new Error("FORBIDDEN_PROCESS_SPAWN"); });
const spawnSync = spyOn(Bun, "spawnSync").mockImplementation(() => { throw new Error("FORBIDDEN_PROCESS_SPAWN_SYNC"); });
const network = spyOn(globalThis, "fetch").mockImplementation(Object.assign(() => { throw new Error("FORBIDDEN_NETWORK"); }, { preconnect() {} }));
const { addQualificationNativeUsage, checkQualificationEvidence, decodeQualificationLearningRequest, readQualificationReadback } = await import("./qualification-evidence");
const scratch = resolve(import.meta.dir, "scratch");
mkdirSync(scratch, { recursive: true });
const workspace = mkdtempSync(join(scratch, "qualification-evidence-"));
const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const ref = (value: Uint8Array) => ({ byteLength: value.byteLength, sha256: sha(value) });
const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
const profiles: Record<string, string | number>[] = [];
function profileCheck(name: string, input: QualificationEvidenceInput) {
  const started = performance.now(), result = checkQualificationEvidence(input);
  const measured = { name, elapsedMs: performance.now() - started, status: result.status };
  profiles.push(measured); console.log("QUALIFICATION_EVIDENCE_SOURCE_5_MEASURE " + JSON.stringify(measured)); return result;
}

class InjectedLearningPort implements OwnedTransport {
  private samples = 0;
  private baseline = 0;
  constructor(private readonly attemptId: string, private readonly channel: "a" | "b", private readonly events: NativeObservation[], private readonly hold: boolean) {}
  async exchange(json: string) {
    this.events.push({ kind: "request", attemptId: this.attemptId, channel: this.channel, json });
    const request = JSON.parse(json) as LearningRequest, command = request.command;
    let result: LearningReply["result"];
    if (command.kind === "begin") { this.baseline = command.baseline; result = { kind: "begun" }; }
    else if (command.kind === "score") {
      const logits = Array(command.request.rows).fill(this.hold ? -1000 : 0); if (this.hold) logits[0] = 1000;
      result = { kind: "scored", response: { version: command.request.version, featureVersion: command.request.featureVersion,
        requestId: command.request.requestId, modelId: command.request.modelId, logits } };
    } else if (command.kind === "acknowledge") result = { kind: "acknowledged", journalDigest: command.journalDigest, sampledDecisions: ++this.samples };
    else if (command.kind === "finish") {
      const selected = syntheticRecord(`SYNTHETIC-NOT-A-NATIVE-MODEL:${this.attemptId}:${this.channel}`);
      result = this.samples ? { kind: "proposed", record: Array.from(selected.record), config: selected.config, sampledDecisions: this.samples,
        parameterSha256: sha(`SYNTHETIC-PARAMETERS:${this.attemptId}`), objective: command.returnValue - this.baseline,
        nonzeroPolicyGradient: command.returnValue !== this.baseline } : { kind: "diagnostic" };
    } else result = { kind: "closed" };
    const reply: LearningReply = { version: request.version, sessionId: request.sessionId, ordinal: request.ordinal, modelId: request.modelId, result };
    const raw = { json: JSON.stringify(reply), receivedNs: 19n };
    this.events.push({ kind: "reply", attemptId: this.attemptId, channel: this.channel, ...raw }); return raw;
  }
  async finish() { const receipt = cleanExit(); this.events.push({ kind: "finish", attemptId: this.attemptId, channel: this.channel, receipt }); return receipt; }
  async terminate(): Promise<void> { throw new Error("UNEXPECTED_SYNTHETIC_TERMINATE"); }
}

function injectedStrategicApi(): StrategicApi {
  const memory = () => ({ perSide: { w: {}, b: {} } });
  return { strategicScript: () => ({ play: (snapshot: unknown, context: unknown) => {
    (context as { rng: () => number }).rng(); return { snapshot: structuredClone(snapshot), spendMinerals: 0 };
  } }), seedKvsForOpening: memory, seedCcIntelForOpening: memory, seedRunnerMemory: memory, seedAttackerMemory: memory,
    updateKvsForSnap: value => value, updateCcIntelForSnap: value => value, updateRunnersForSnap: value => value,
    updateAttackersForSnap: value => value, witnessFromEndTurn: memory };
}

async function fixture(name: string, hold = false, corpusWindows = 0, settleWindows = 0) {
  const root = join(workspace, name), events: NativeObservation[] = [], clock = () => 19n, state = new PrivateState(root), store = new TrainingStore(state.databasePath(), bindings());
  const initialRecord = syntheticRecord("SYNTHETIC-INITIAL-NOT-A-NATIVE-MODEL");
  const scorer = { async score(json: string) {
    const request = JSON.parse(json), logits = Array(request.rows).fill(hold ? -1000 : 0); if (hold) logits[0] = 1000;
    return { json: JSON.stringify({ version: request.version, featureVersion: request.featureVersion, requestId: request.requestId, modelId: request.modelId, logits }), receivedNs: clock() };
  } };
  const setup: AttemptSetup = ({ descriptor, timing }) => {
    const learner = (channel: "a" | "b") => new NativeLearner(`${descriptor.attemptId}:learner:${channel}`, descriptor.modelId,
      new InjectedLearningPort(descriptor.attemptId, channel, events, hold), clock, timing.workDeadlineNs, timing.cleanupDeadlineNs);
    const a = learner("a"), b = learner("b");
    return { transport: { async exchange() { throw new Error("SYNTHETIC_PACKET_HAS_NO_MATCH_PROCESS"); }, async cutoff() { throw new Error("NO_CUTOFF"); },
      async finish() { return cleanExit(); }, async terminate() { throw new Error("NO_TERMINATE"); } }, learners: new LearnerPair(a, b), verifier: a, corpus: null, strategic: null };
  };
  const coordinator = {
    initializeMaster(master: number, selected: ReturnType<typeof syntheticRecord>) {
      const result = store.initializeMaster(master, selected), id = `initial-master-${master}`; state.attempt(id);
      state.write(id, "initial-native-record", selected.record); state.write(id, "initial-model-config", encode(selected.config)); return result;
    },
    snapshot(master: number) { return store.snapshot(master); },
    close() { store.close(); },
    async runAttempt(master: number, id: string, timing: Parameters<AttemptSetup>[0]["timing"], createOwned: AttemptSetup) {
      const descriptor = store.start(master, id), rng: RngState = structuredClone(store.snapshot(master).rng), selected = store.inferenceRecord(master), directory = state.attempt(id);
      const started = { descriptor, rng: structuredClone(rng) }; state.write(id, "started-descriptor", encode(started));
      const dependencies = await createOwned({ descriptor, rng: structuredClone(rng), model: selected, directory, timing });
      const audit: unknown[] = [], append = (kind: string, value: unknown) => { audit.push({ ordinal: audit.length, kind, value }); };
      append("started", started); await dependencies.learners.begin(descriptor.frozenBaseline);
      const initial = initializeGame(); let game = initial, windows = 0, plies = 0;
      const strategic = descriptor.schedule.kind === "live" ? new StrategicDriver(id, descriptor.schedule.candidateSide === "w" ? "b" : "w",
        initial.snapshot, rng.opponent, injectedStrategicApi(), clock, timing.workDeadlineNs) : null;
      const history = [initial.batches[descriptor.schedule.candidateSide]], plans: GamePlans = { w: [], b: [] };
      const advance = (transition: GameTransition) => {
        game = transition.session; strategic?.advance(transition); append("native", transition); history.push(game.batches[descriptor.schedule.candidateSide]);
        if (transition.native.kind === "settled" || transition.native.value.result.asResolve) plies++;
      };
      append("initial", initial); advance(openGame(game));
      const candidateIds: string[] = [], opponentIds: string[] = [];
      const sample = descriptor.schedule.kind === "live" || corpusWindows > 0;
      if (sample) {
        const settlements = descriptor.schedule.kind === "live" ? settleWindows : 0;
        for (let planningOrdinal = 0; planningOrdinal <= settlements; planningOrdinal++) {
          plans.w = []; plans.b = [];
          const side = descriptor.schedule.candidateSide, permit: PlanPermit = { version: "chess-coach.plan-permit.v1", attemptId: id, permitId: `${id}:plan:${planningOrdinal}:${side}`,
            planningOrdinal, turn: game.snapshot.turn, side, role: "candidate", issuedNs: "19", deadlineNs: "10000000019" };
          append("permit", permit);
          const context = { permit, modelId: descriptor.modelId, observationJson: JSON.stringify(game.recipients[side].observation), sampling: rng["policy-sampling"],
            mode: "sample" as const, workDeadlineNs: timing.workDeadlineNs, clockNs: clock };
          const worker = new PolicyWorker(context, scorer), owner = new PolicySession(context, dependencies.verifier);
          const accepted = await owner.acknowledge({ json: await worker.plan(JSON.stringify(permit)), receivedNs: 19n });
          await dependencies.learners.accumulate(accepted); append("decision-acked", accepted.journal);
          rng["policy-sampling"] = accepted.journal.samplingAfter; candidateIds.push(permit.permitId); plans[side] = accepted.journal.actions;
          if (descriptor.schedule.kind === "live") {
            const other = side === "w" ? "b" : "w", otherPermit: PlanPermit = { ...permit, side: other, role: "strategic", permitId: `${id}:plan:${planningOrdinal}:${other}` };
            if (!strategic) throw new Error("EXPECTED_STRATEGIC_DRIVER");
            append("permit", otherPermit); const journal = opponentJournalShape.parse(JSON.parse(await strategic.plan(JSON.stringify(otherPermit))));
            append("decision-acked", journal); strategic.acceptAck(sha(JSON.stringify(journal)));
            rng.opponent = strategic.sampling(); opponentIds.push(otherPermit.permitId); plans[other] = journal.actions;
          }
          if (planningOrdinal < settlements) { advance(settleGame(game, plans)); windows++; advance(openGame(game)); }
        }
      }
      const stop = sample ? { reason: "candidate-native-rejection" as const, returnValue: -1 as const, side: descriptor.schedule.candidateSide,
        actionOrdinal: 0, code: "SC_SPECIAL" as const } : { reason: "trace-exhaustion" as const, returnValue: -1 as const };
      if (sample) append("native-rejection", { stop, plans, boundaryOrdinal: game.history.length });
      append("complete", { version: "chess-coach.match.v1", attemptId: id, ordinal: (sample ? descriptor.schedule.kind === "live" ? 5 : 4 : 2) + windows * 4, kind: "complete", stop, boundaryOrdinal: game.history.length,
        planningWindows: windows, recordedPlies: plies, candidateIds, opponentIds, recordedCount: descriptor.schedule.kind === "corpus" && sample ? 1 : 0, recordedDigest: sha("[]"), rng });
      append("match-exit", cleanExit()); const proposal = await dependencies.learners.propose(-1); await dependencies.learners.close();
      append("learners-closed", { kind: proposal.kind, ...(proposal.kind === "proposed" ? { parameterSha256: proposal.parameterSha256, objective: proposal.objective } : {}) });
      const journalRef = state.appendJournal(id, audit.map(value => JSON.stringify(value)).join("\n") + "\n"), historyRef = state.write(id, "authorized-history", encode(history));
      const model = proposal.kind === "proposed" ? { config: proposal.config, record: Uint8Array.from(proposal.record) } : null;
      const proposalRef = model ? state.write(id, "native-proposal", model.record) : null; if (model) state.write(id, "proposal-config", encode(model.config));
      return store.complete(master, id, { reason: stop.reason, returnValue: -1, sampledDecisions: candidateIds.length, nonzeroPolicyGradient: proposal.kind === "proposed" && proposal.nonzeroPolicyGradient,
        rngAfter: rng, journalRef, historyRef, proposalRef }, model);
    },
  };
  const r4 = await observeR4({ coordinator, initialRecord, createOwned: setup, clockNs: clock });
  expect(r4.status).toBe("PASS");
  const canonical = await observeCanonical({ sessionId: "synthetic-session", clockNs: clock, createPort: role => new SyntheticTransport(role, "native-proof", clock) });
  const readback = readQualificationReadback(root);
  return { root, input: { canonical, r4, native: events, readback } satisfies QualificationEvidenceInput };
}

let base: Awaited<ReturnType<typeof fixture>>;
beforeAll(async () => { base = await fixture("zero-logits"); }, 120000);
afterAll(() => {
  try { expect(spawn).not.toHaveBeenCalled(); expect(spawnSync).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled(); }
  finally {
    spawn.mockRestore(); spawnSync.mockRestore(); network.mockRestore();
    console.log("QUALIFICATION_EVIDENCE_SOURCE_5_PROFILE " + JSON.stringify({ scope: "SYNTHETIC_SOURCE_ONLY", cache: "NONE", profiles }));
  }
});

function fail(input: QualificationEvidenceInput, code?: string) {
  const result = checkQualificationEvidence(input);
  expect(result.status).toBe("FAIL_RETAINED_FUNCTIONAL_EVIDENCE"); expect(result.qualified).toBe(false);
  expect(result.scope).toBe("INPUTS_UNATTESTED_FUNCTIONAL_EVIDENCE_ONLY"); expect(result.proof).toBeNull();
  expect(result.failures.length).toBeGreaterThan(0); expect(result.failures.join().length).toBeLessThan(1024);
  if (code) expect(result.failures.join()).toContain(code);
}
const clone = () => structuredClone(base.input);
type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };
function raw<Kind extends "request" | "reply">(input: QualificationEvidenceInput, kind: Kind, command: string, channel: "a" | "b" = "a") {
  return input.native.find(event => event.kind === kind && event.channel === channel && event.attemptId.endsWith("0001") &&
    (kind === "request" ? JSON.parse(event.json).command.kind : JSON.parse(event.json).result.kind) === command) as Mutable<Extract<NativeObservation, { kind: Kind }>>;
}
function mutateFrame(input: QualificationEvidenceInput, kind: "request" | "reply", command: string, change: (value: any) => void, channel: "a" | "b" = "a") {
  const event = raw(input, kind, command, channel), value = JSON.parse(event.json); change(value); event.json = JSON.stringify(value);
}
function mutateJournal(input: QualificationEvidenceInput, kind: string, change: (value: any) => void, attempt = 1) {
  const artifacts = input.readback.attempts[attempt]!.artifacts;
  const lines = Buffer.from(artifacts.journal).toString().trimEnd().split("\n").map(line => JSON.parse(line));
  const event = lines.find(line => line.event.kind === kind); change(event);
  artifacts.journal = Buffer.from(lines.map(line => JSON.stringify(line)).join("\n") + "\n");
}

test("import exposes only explicit readback and a pure checker without process or network acquisition", () => {
  expect(typeof readQualificationReadback).toBe("function"); expect(typeof checkQualificationEvidence).toBe("function");
  expect(spawn).not.toHaveBeenCalled(); expect(spawnSync).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled();
});
test("SYNTHETIC zero-logit packet passes retained functional checks without qualification or native attestation", () => {
  const result = profileCheck("positive-zero-logits", base.input);
  expect(result.failures).toEqual([]); expect(result.status).toBe("PASS_RETAINED_FUNCTIONAL_EVIDENCE");
  expect(result).toMatchObject({ scope: "INPUTS_UNATTESTED_FUNCTIONAL_EVIDENCE_ONLY", qualified: false,
    proof: { canonical: { executionLabel: "MOCK", exchanges: 14, boundaries: 3, naturalFinishes: 2 }, native: { ports: 4, naturalFinishes: 4 }, nonzeroPGUpdates: 1 } });
  expect(base.input.r4).toMatchObject({ scope: "COMPOSITION_ONLY_INPUTS_UNQUALIFIED", qualified: false });
  expect(base.input.canonical.receipt).toMatchObject({ trainingReady: false, hostProofQualified: false, independentReferenceQualified: false });
  expect(raw(base.input, "reply", "scored").json).toContain('"logits":[0');
  expect(result.proof!.attempts[0]!.samples).toBe(0); expect(result.proof!.attempts[1]!.samples).toBeGreaterThan(0);
  let usage = { events: 0, rawJsonBytes: 0, serializedBytes: 0 };
  for (const event of base.input.native) usage = addQualificationNativeUsage(usage, event);
  expect(result.proof!.native).toMatchObject(usage);
  expect("trainingReady" in result).toBe(false);
});
test("paired records may serialize differently when parameter digest and proposal semantics match", () => {
  const a = JSON.parse(raw(base.input, "reply", "proposed", "a").json).result;
  const b = JSON.parse(raw(base.input, "reply", "proposed", "b").json).result;
  expect(a.config.recordSha256).not.toBe(b.config.recordSha256); expect(a.parameterSha256).toBe(b.parameterSha256);
  expect(checkQualificationEvidence(base.input).status).toBe("PASS_RETAINED_FUNCTIONAL_EVIDENCE");
});
test("paired raw negative-zero objectives remain exact while retained JSON normalizes negative zero", () => {
  const input = clone();
  for (const channel of ["a", "b"] as const) {
    const event = raw(input, "reply", "proposed", channel); event.json = event.json.replace('"objective":-1', '"objective":-0');
  }
  mutateJournal(input, "learners-closed", line => { line.event.value.objective = 0; });
  const first = input.readback.attempts[0]!, second = input.readback.attempts[1]!;
  second.completion.journalRef = { byteLength: first.artifacts.journal.byteLength + second.artifacts.journal.byteLength,
    sha256: createHash("sha256").update(first.artifacts.journal).update(second.artifacts.journal).digest("hex"), lastRecordOrdinal: second.completion.journalRef.lastRecordOrdinal };
  for (const value of [input.r4.attempts[1]!.returned!, input.r4.attempts[1]!.snapshot!]) {
    value.state.journalRef = structuredClone(second.completion.journalRef); value.serializedStateRef = ref(encode(value.state));
  }
  input.readback.master.state.journalRef = structuredClone(second.completion.journalRef);
  expect(checkQualificationEvidence(input).failures).toEqual([]);
  const b = raw(input, "reply", "proposed", "b"); b.json = b.json.replace('"objective":-0', '"objective":0'); fail(input, "PAIRED_PROPOSAL");
}, 30000);
test("SYNTHETIC hold case retains both cumulative journal segments", async () => {
  const env = await fixture("hold", true), result = checkQualificationEvidence(env.input);
  expect(result.failures).toEqual([]); expect(result.status).toBe("PASS_RETAINED_FUNCTIONAL_EVIDENCE");
  expect(result.proof!.attempts[1]!.samples).toBe(1); expect(result.proof!.native.events).toBeLessThanOrEqual(800);
  expect(result.proof!.attempts[1]!.journalRef.byteLength).toBe(env.input.readback.attempts.reduce((sum, value) => sum + value.artifacts.journal.byteLength, 0));
}, 120000);
test("model handoff selects the first updated proposal and baseline-equal second update remains legitimate", async () => {
  const env = await fixture("both-propose", true, 1), result = profileCheck("model-handoff", env.input);
  expect(result.failures).toEqual([]); expect(result.status).toBe("PASS_RETAINED_FUNCTIONAL_EVIDENCE");
  expect(result.proof!.attempts.map(value => value.nonzeroPolicyGradient)).toEqual([true, false]);
  expect(env.input.readback.attempts[1]!.descriptor.modelId).toBe(env.input.readback.attempts[0]!.artifacts.proposal!.config.recordSha256);
}, 120000);
test("profiles a late final-state rejection without caching validation or verdicts", () => {
  const input = clone(); input.readback.master.state.counters.nonzeroPGUpdates = 0;
  const result = profileCheck("late-negative-final-state", input);
  expect(result.status).toBe("FAIL_RETAINED_FUNCTIONAL_EVIDENCE"); expect(result.failures).toEqual(["final:FINAL_STATE"]);
});

describe("successful settlement evidence", () => {
  let packet: QualificationEvidenceInput;
  beforeAll(async () => { packet = (await fixture("successful-settlement", true, 0, 1)).input; }, 120000);
  type RetainedEvent = { recordOrdinal: number; attemptId: string; event: { ordinal: number; kind: string; value: unknown } };
  const entries = (input: QualificationEvidenceInput): RetainedEvent[] => Buffer.from(input.readback.attempts[1]!.artifacts.journal)
    .toString().trimEnd().split("\n").map(line => JSON.parse(line) as RetainedEvent);
  const transitions = (input: QualificationEvidenceInput) => entries(input).filter(entry => entry.event.kind === "native").map(entry => entry.event.value as GameTransition);
  const settled = (input: QualificationEvidenceInput) => transitions(input).find(value => value.native.kind === "settled")!;
  const editTransition = (input: QualificationEvidenceInput, change: (value: GameTransition) => void, kind: "settled" | "post-open" = "settled") => {
    const lines = entries(input), selected = lines.find(entry => entry.event.kind === "native" &&
      (kind === "settled" ? (entry.event.value as GameTransition).native.kind === "settled" : (entry.event.value as GameTransition).record.ordinal === 3));
    if (!selected) throw new Error("EXPECTED_SETTLEMENT_TRANSITION");
    change(selected.event.value as GameTransition);
    input.readback.attempts[1]!.artifacts.journal = Buffer.from(lines.map(line => JSON.stringify(line)).join("\n") + "\n");
  };
  const postOpponent = (input: QualificationEvidenceInput) => entries(input).find(entry => entry.event.kind === "decision-acked" &&
    (entry.event.value as OpponentJournal).version === "chess-coach.opponent.v1" && (entry.event.value as OpponentJournal).planningOrdinal === 1)!.event.value as OpponentJournal;
  const editOpponent = (input: QualificationEvidenceInput, change: (journal: OpponentJournal) => void) => {
    const lines = entries(input), selected = lines.find(entry => entry.event.kind === "decision-acked" &&
      (entry.event.value as OpponentJournal).version === "chess-coach.opponent.v1" && (entry.event.value as OpponentJournal).planningOrdinal === 1);
    if (!selected) throw new Error("EXPECTED_POST_SETTLEMENT_OPPONENT");
    change(selected.event.value as OpponentJournal);
    input.readback.attempts[1]!.artifacts.journal = Buffer.from(lines.map(line => JSON.stringify(line)).join("\n") + "\n");
  };

  test("actual successful live settlement preserves retained raw record order", () => {
    const transition = settled(packet), normalized = gameRecordShape.parse(transition.record);
    const rawJson = JSON.stringify(transition.record), normalizedJson = JSON.stringify(normalized), keys = Object.keys(transition.record.snapshot);
    expect(keys.at(-1)).toBe("stored"); expect(keys.indexOf("stored")).toBeGreaterThan(keys.indexOf("queue"));
    expect(Object.keys(normalized.snapshot).indexOf("stored")).toBeLessThan(Object.keys(normalized.snapshot).indexOf("queue"));
    expect(isDeepStrictEqual(normalized, transition.record)).toBe(true); expect(rawJson).not.toBe(normalizedJson);
    expect(transition.session.history.at(-1)).toBe(sha(rawJson)); expect(transition.session.history.at(-1)).not.toBe(sha(normalizedJson));
    expect(transition.record.operation).toEqual({ kind: "settle", plans: { w: [], b: [] } });
    expect(transitions(packet).map(value => value.native.kind)).toEqual(["opened", "settled", "opened"]);
    const complete = entries(packet).find(entry => entry.event.kind === "complete")!.event.value;
    expect(complete).toMatchObject({ ordinal: 9, boundaryOrdinal: 3, planningWindows: 1, recordedPlies: 1, recordedCount: 0 });
    expect(packet.readback.attempts[1]!.completion.sampledDecisions).toBe(2);
    expect(JSON.parse(Buffer.from(packet.readback.attempts[1]!.artifacts.history).toString()).length).toBe(4);
    const result = profileCheck("successful-live-settlement", packet);
    console.log("QUALIFICATION_EVIDENCE_SOURCE_5_SETTLEMENT " + JSON.stringify({ rawSnapshotKeys: keys, normalizedSnapshotKeys: Object.keys(normalized.snapshot),
      rawSha256: sha(rawJson), normalizedSha256: sha(normalizedJson), retainedSha256: transition.session.history.at(-1), failures: result.failures }));
    expect(result.failures).toEqual([]); expect(result.status).toBe("PASS_RETAINED_FUNCTIONAL_EVIDENCE");
    expect(result.qualified).toBe(false); expect(result.proof!.native.naturalFinishes).toBe(4);
    expect(result.proof!.attempts[1]!.journalRef).toEqual(packet.readback.attempts[1]!.completion.journalRef);
    expect(result.proof!.attempts[1]!.journalRef.sha256).toBe(createHash("sha256").update(packet.readback.attempts[0]!.artifacts.journal).update(packet.readback.attempts[1]!.artifacts.journal).digest("hex"));
    expect(result.proof!.attempts[1]!.journalRef.byteLength).toBe(packet.readback.attempts.reduce((sum, row) => sum + row.artifacts.journal.byteLength, 0));
    expect(result.proof!.attempts[1]!.historyRef).toEqual(ref(packet.readback.attempts[1]!.artifacts.history));
    expect(packet.r4.attempts[1]!.returned!.state.rng["policy-sampling"].drawCount).toBe(2);
    expect(packet.r4.attempts[1]!.returned!.state.rng.opponent.drawCount).toBe(2);
  });
  test("actual StrategicDriver post-settlement digest matches its normalized snapshot", () => {
    const reopened = transitions(packet).find(value => value.record.ordinal === 3)!.session, journal = postOpponent(packet);
    const normalized = nativeSnapshotShape.parse(reopened.snapshot), rawDigest = sha(JSON.stringify(reopened.snapshot)), normalizedDigest = sha(JSON.stringify(normalized));
    expect(Object.keys(reopened.snapshot).at(-1)).toBe("stored");
    expect(Object.keys(normalized).indexOf("stored")).toBeLessThan(Object.keys(normalized).indexOf("queue"));
    expect(journal.snapshotDigest).toBe(normalizedDigest); expect(journal.snapshotDigest).not.toBe(rawDigest);
    expect(journal.opponentBefore.drawCount).toBe(1); expect(journal.opponentAfter.drawCount).toBe(2);
    expect(journal.actions).toEqual([]); expect(journal.reportedMinSpend).toBe(0);
    const result = profileCheck("actual-strategic-post-settlement", packet);
    console.log("QUALIFICATION_EVIDENCE_SOURCE_5_OPPONENT " + JSON.stringify({ rawDigest, normalizedDigest, actualStrategicJournalDigest: journal.snapshotDigest, failures: result.failures }));
    expect(result.failures).toEqual([]); expect(result.status).toBe("PASS_RETAINED_FUNCTIONAL_EVIDENCE"); expect(result.qualified).toBe(false);
  });
  test("rejects a raw-order opponent digest instead of accepting both producer conventions", () => {
    const input = structuredClone(packet), snapshot = transitions(input).find(value => value.record.ordinal === 3)!.session.snapshot;
    editOpponent(input, journal => { journal.snapshotDigest = sha(JSON.stringify(snapshot)); }); fail(input, "OPPONENT_CONTEXT");
  });
  test("rejects an unrelated post-settlement opponent snapshot digest", () => {
    const input = structuredClone(packet); editOpponent(input, journal => { journal.snapshotDigest = "f".repeat(64); }); fail(input, "OPPONENT_CONTEXT");
  });
  test("keeps the exact post-settlement opponent RNG prefix guard", () => {
    const input = structuredClone(packet); editOpponent(input, journal => { journal.opponentBefore = structuredClone(journal.opponentAfter); }); fail(input, "OPPONENT_PREFIX");
  });
  test("keeps the post-settlement opponent RNG root guard", () => {
    const input = structuredClone(packet); editOpponent(input, journal => {
      journal.opponentAfter.root = (journal.opponentAfter.root + 1) >>> 0; journal.opponentAfter.state = (journal.opponentAfter.state + 1) >>> 0;
    }); fail(input, "OPPONENT_CONTEXT");
  });
  test("keeps the post-settlement opponent spend guard", () => {
    const input = structuredClone(packet); editOpponent(input, journal => { journal.reportedMinSpend = 1; }); fail(input, "OPPONENT_SPEND");
  });
  test("rejects a tampered raw settlement record without rewriting its retained digest", () => {
    const input = structuredClone(packet);
    editTransition(input, value => { value.record.bank.w = value.record.bank.w === 12 ? 11 : value.record.bank.w + 1; });
    fail(input, "JOURNAL_NATIVE_PREFIX");
  });
  test("rejects a reordered stored key even when parsed settlement semantics remain equal", () => {
    const input = structuredClone(packet);
    editTransition(input, value => {
      const original = JSON.stringify(value.record), parsed = gameRecordShape.parse(value.record), retainedDigest = value.session.history.at(-1);
      value.record.snapshot = parsed.snapshot;
      expect(gameRecordShape.parse(value.record)).toEqual(parsed); expect(JSON.stringify(value.record)).not.toBe(original);
      expect(value.session.history.at(-1)).toBe(retainedDigest); expect(sha(JSON.stringify(value.record))).not.toBe(retainedDigest);
    });
    fail(input, "JOURNAL_NATIVE_PREFIX");
  });
  test("rejects a stale parent prefix in a successful settlement", () => {
    const input = structuredClone(packet); editTransition(input, value => { value.session.history[0] = "f".repeat(64); });
    fail(input, "JOURNAL_NATIVE_PREFIX");
  });
  test("keeps strict schema validation for the original retained settlement record", () => {
    const input = structuredClone(packet); editTransition(input, value => { Object.assign(value.record, { extra: true }); });
    fail(input, "SCHEMA");
  });
  test("rejects coherent post-settlement bank tampering after rebinding its raw record digest", () => {
    const input = structuredClone(packet);
    editTransition(input, value => {
      const amount = value.session.bank.w - 1;
      value.session.bank.w = amount; value.session.snapshot.stored!.w = amount; value.record.bank.w = amount; value.record.snapshot.stored!.w = amount;
      for (const recipient of [value.session.recipients.w, value.session.batches.w, value.record.batches.w]) {
        recipient.observation = { ...recipient.observation, own: { ...recipient.observation.own, minerals: amount } };
      }
      value.session.history[value.session.history.length - 1] = sha(JSON.stringify(value.record));
    });
    fail(input, "JOURNAL_SETTLE_BANK");
  });
  test("rejects post-settlement reopening with a rewritten parent history", () => {
    const input = structuredClone(packet); editTransition(input, value => { value.session.history[1] = "e".repeat(64); }, "post-open");
    fail(input, "JOURNAL_NATIVE_PREFIX");
  });
});

function smallScore() {
  return { version: "chess-coach.inference.v1", featureVersion: FEATURE_VERSION, requestId: "small:request", modelId: "a".repeat(64), rows: 1,
    values: Array.from({ length: FEATURES }, (_, index): unknown => index === 0 ? -0 : index === 1 ? -1_000_000 : index === 2 ? 1_000_000 : 0) };
}
function learningEnvelope(command: unknown): Record<string, unknown> {
  return { version: "chess-coach.learning-channel.v1", sessionId: "parity:learner:a", ordinal: 0, modelId: "a".repeat(64), command };
}
function wireJson(value: unknown): string {
  return JSON.stringify(value, (_, item: unknown) => typeof item === "number" && Object.is(item, -0) ? "QUALIFICATION_NEGATIVE_ZERO_SENTINEL" : item)
    .replaceAll('"QUALIFICATION_NEGATIVE_ZERO_SENTINEL"', "-0");
}
function referenceLearning(value: unknown) {
  try { return learningRequestShape.safeParse(value); } catch { return { success: false as const }; }
}
function referenceScore(value: unknown) {
  try { return scoreRequestShape.safeParse(value); } catch { return { success: false as const }; }
}
function parity(value: unknown, accepted?: boolean) {
  const reference = referenceLearning(value), text = wireJson(value), wireReference = referenceLearning(JSON.parse(text));
  expect(wireReference.success).toBe(reference.success);
  if (accepted !== undefined) expect(reference.success).toBe(accepted);
  if (!reference.success) { expect(() => decodeQualificationLearningRequest(text)).toThrow(); return null; }
  const actual = decodeQualificationLearningRequest(text);
  expect(actual).toEqual(reference.data); expect(JSON.stringify(actual)).toBe(JSON.stringify(reference.data));
  expect(Object.keys(actual)).toEqual(Object.keys(reference.data)); expect(Object.keys(actual.command)).toEqual(Object.keys(reference.data.command));
  expect(Object.isFrozen(actual)).toBe(Object.isFrozen(reference.data)); expect(Object.isFrozen(actual.command)).toBe(Object.isFrozen(reference.data.command));
  if ((actual.command.kind === "score" || actual.command.kind === "acknowledge") &&
    (reference.data.command.kind === "score" || reference.data.command.kind === "acknowledge")) {
    const request = actual.command.request, original = reference.data.command.request;
    expect(request).toEqual(scoreRequestShape.parse(original)); expect(Object.keys(request)).toEqual(Object.keys(original));
    expect(Object.isFrozen(request)).toBe(true); expect(Object.isFrozen(request.values)).toBe(true);
    expect(Object.is(request.values[0], -0)).toBe(Object.is(original.values[0], -0));
  }
  return actual;
}

for (const [name, command] of [
  ["begin minus one", { kind: "begin", baseline: -1 }], ["begin zero", { kind: "begin", baseline: 0 }],
  ["begin negative zero", { kind: "begin", baseline: -0 }], ["begin one", { kind: "begin", baseline: 1 }],
  ["score", { kind: "score", request: smallScore() }],
  ["acknowledge zero", { kind: "acknowledge", request: smallScore(), selected: 0, journalDigest: "b".repeat(64) }],
  ["acknowledge negative zero", { kind: "acknowledge", request: smallScore(), selected: -0, journalDigest: "b".repeat(64) }],
  ["acknowledge 511 independent of rows", { kind: "acknowledge", request: smallScore(), selected: 511, journalDigest: "b".repeat(64) }],
  ["finish minus one", { kind: "finish", returnValue: -1 }], ["finish zero", { kind: "finish", returnValue: 0 }],
  ["finish negative zero", { kind: "finish", returnValue: -0 }], ["finish one", { kind: "finish", returnValue: 1 }], ["close", { kind: "close" }],
] as const) test(`fast request parser matches contract for ${name}`, () => { parity(learningEnvelope(command), true); });

for (const [field, values] of [
  ["version", [null, "other", 1, undefined]],
  ["sessionId", [null, "", "x".repeat(65), "space space", "é", 1, undefined]],
  ["ordinal", [-1, 256, 0.5, NaN, Infinity, -Infinity, "0", null, undefined]],
  ["modelId", [null, "a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64), 0, undefined]],
  ["command", [null, [], "close", 0, undefined, {}, { kind: "unknown" }]],
] as const) for (const [index, value] of values.entries()) test(`fast request parser rejects header ${field} case ${index} like the contract`, () => {
  parity({ ...learningEnvelope({ kind: "close" }), [field]: value }, false);
});
for (const field of ["version", "sessionId", "ordinal", "modelId", "command"]) test(`fast request parser rejects missing top-level ${field}`, () => {
  const input = learningEnvelope({ kind: "close" }); delete input[field]; parity(input, false);
});
test("fast request parser rejects extra top-level and command keys for every command", () => {
  parity({ ...learningEnvelope({ kind: "close" }), extra: 1 }, false);
  for (const command of [{ kind: "begin", baseline: 0 }, { kind: "score", request: smallScore() },
    { kind: "acknowledge", request: smallScore(), selected: 0, journalDigest: "b".repeat(64) }, { kind: "finish", returnValue: 0 }, { kind: "close" }]) {
    parity(learningEnvelope({ ...command, extra: 1 }), false);
  }
});
for (const baseline of [-1.001, 1.001, NaN, Infinity, -Infinity, undefined, null, "0", false]) test(`fast request parser rejects invalid baseline ${String(baseline)}`, () => {
  parity(learningEnvelope({ kind: "begin", baseline }), false);
});
for (const selected of [-1, 512, 0.5, NaN, Infinity, undefined, null, "0", false]) test(`fast request parser rejects invalid selected ${String(selected)}`, () => {
  parity(learningEnvelope({ kind: "acknowledge", request: smallScore(), selected, journalDigest: "b".repeat(64) }), false);
});
for (const returnValue of [-2, 2, 0.5, NaN, Infinity, undefined, null, "0", false]) test(`fast request parser rejects invalid finish return ${String(returnValue)}`, () => {
  parity(learningEnvelope({ kind: "finish", returnValue }), false);
});
for (const journalDigest of [undefined, null, "b".repeat(63), "b".repeat(65), "B".repeat(64), "g".repeat(64), 1]) test(`fast request parser rejects digest ${String(journalDigest)}`, () => {
  parity(learningEnvelope({ kind: "acknowledge", request: smallScore(), selected: 0, journalDigest }), false);
});
for (const kind of ["score", "acknowledge"] as const) test(`fast request parser rejects missing ${kind} command fields`, () => {
  const fields = kind === "score" ? ["kind", "request"] : ["kind", "request", "selected", "journalDigest"];
  const initial: Record<string, unknown> = kind === "score" ? { kind, request: smallScore() } : { kind, request: smallScore(), selected: 0, journalDigest: "b".repeat(64) };
  for (const field of fields) { const command = { ...initial }; delete command[field]; parity(learningEnvelope(command), false); }
});
test("fast request parser preserves regex and integer boundary semantics", () => {
  for (const sessionId of ["s", "x".repeat(64), "a._:-AZ09", "a\n"]) parity({ ...learningEnvelope({ kind: "close" }), sessionId });
  for (const ordinal of [-0, 0, 255]) {
    const actual = parity({ ...learningEnvelope({ kind: "close" }), ordinal }, true)!; expect(Object.is(actual.ordinal, ordinal)).toBe(true);
  }
  const actual = parity(learningEnvelope({ kind: "begin", baseline: -0 }), true)!;
  expect(actual.command.kind === "begin" && Object.is(actual.command.baseline, -0)).toBe(true);
});

function scoreParity(request: unknown, accepted: boolean) {
  expect(referenceScore(request).success).toBe(accepted);
  return parity(learningEnvelope({ kind: "score", request }), accepted);
}
for (const [field, values] of [
  ["version", [undefined, null, "other", 1]], ["featureVersion", [undefined, null, "other", 1]],
  ["requestId", [undefined, null, "", "x".repeat(65), "a b", "é", 1]],
  ["modelId", [undefined, null, "a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64), 1]],
  ["rows", [undefined, null, "1", 0, -1, 513, 1.5, NaN, Infinity]],
  ["values", [undefined, null, 0, "values", {}, new Float64Array(FEATURES)]],
] as const) for (const [index, value] of values.entries()) test(`fast score parser matches strict ${field} rejection ${index}`, () => {
  scoreParity({ ...smallScore(), [field]: value }, false);
});
for (const field of ["version", "featureVersion", "requestId", "modelId", "rows", "values"]) test(`fast score parser rejects missing ${field}`, () => {
  const request: Record<string, unknown> = smallScore(); delete request[field]; scoreParity(request, false);
});
test("fast score parser rejects extra score keys and wrong feature dimensions", () => {
  scoreParity({ ...smallScore(), extra: 1 }, false);
  for (const length of [0, FEATURES - 1, FEATURES + 1]) scoreParity({ ...smallScore(), values: Array(length).fill(0) }, false);
  for (const rows of [2, 512]) scoreParity({ ...smallScore(), rows }, false);
});
for (const value of [NaN, Infinity, -Infinity, undefined, null, "0", true, -1_000_000.001, 1_000_000.001]) test(`fast score parser inspects the last coordinate ${String(value)}`, () => {
  const request = smallScore(); request.values[FEATURES - 1] = value; scoreParity(request, false);
});
test("fast score parser rejects sparse arrays and preserves all finite numeric boundary coordinates", () => {
  const sparse = smallScore(); delete sparse.values[FEATURES - 1]; scoreParity(sparse, false);
  scoreParity({ ...smallScore(), values: Array(FEATURES) }, false);
  const request = smallScore(), actual = scoreParity(request, true)!;
  if (actual.command.kind !== "score") throw new Error("EXPECTED_SCORE");
  expect(Object.is(actual.command.request.values[0], -0)).toBe(true);
  expect(actual.command.request.values[1]).toBe(-1_000_000); expect(actual.command.request.values[2]).toBe(1_000_000);
  request.values[0] = 123; expect(Object.is(actual.command.request.values[0], -0)).toBe(true);
  expect(Reflect.set(actual.command.request.values, "0", 4)).toBe(false);
});
test("fast request parser canonicalizes reordered fields exactly like unchanged Zod objects", () => {
  const request = Object.fromEntries(Object.entries(smallScore()).reverse());
  const command = Object.fromEntries(Object.entries({ kind: "acknowledge", request, selected: 0, journalDigest: "b".repeat(64) }).reverse());
  const input = Object.fromEntries(Object.entries(learningEnvelope(command)).reverse()), actual = parity(input, true)!;
  expect(ref(encode(actual))).toEqual(ref(encode(learningRequestShape.parse(input))));
});
test("fast request decoder preserves the separate eight-MiB UTF-8 frame limit", () => {
  const text = wireJson(learningEnvelope({ kind: "close" })), exact = text + " ".repeat(MAX_INFERENCE_BYTES - Buffer.byteLength(text));
  expect(decodeQualificationLearningRequest(exact).command.kind).toBe("close");
  expect(() => decodeQualificationLearningRequest(exact + " ")).toThrow("NATIVE_FRAME_BOUND");
  expect(() => decodeQualificationLearningRequest('"' + "é".repeat(MAX_INFERENCE_BYTES / 2) + '"')).toThrow("NATIVE_FRAME_BOUND");
  for (const value of ["{", "null", "[]", "true", "0", '"request"']) expect(() => decodeQualificationLearningRequest(value)).toThrow();
});
test("profiles parser-only validation on one retained 512-row synthetic frame", () => {
  const frame = raw(base.input, "request", "score").json;
  let started = performance.now(); const parsed: LearningRequest = JSON.parse(frame), jsonParseMs = performance.now() - started;
  if (parsed.command.kind !== "score") throw new Error("EXPECTED_SCORE");
  started = performance.now(); const reference = learningRequestShape.parse(parsed), schemaParseMs = performance.now() - started;
  started = performance.now(); const actual = decodeQualificationLearningRequest(frame), frozenExportDecodeMs = performance.now() - started;
  const response = JSON.parse(raw(base.input, "reply", "scored").json).result.response;
  started = performance.now(); decodeScoreResponse(JSON.stringify(response), parsed.command.request); const legacyResponseDecodeMs = performance.now() - started;
  expect(actual).toEqual(reference); expect(parsed.command.request.rows).toBe(512); expect(parsed.command.request.values.length).toBe(512 * FEATURES);
  const measured = { name: "512-row-request", frameBytes: Buffer.byteLength(frame), rows: parsed.command.request.rows, values: parsed.command.request.values.length,
    jsonParseMs, schemaParseMs, frozenExportDecodeMs, legacyResponseDecodeMs };
  profiles.push(measured); console.log("QUALIFICATION_EVIDENCE_SOURCE_5_MEASURE " + JSON.stringify(measured));
  const mismatched = { ...parsed, command: { kind: "score", request: { ...parsed.command.request, values: parsed.command.request.values.slice(0, -1) } } };
  expect(learningRequestShape.safeParse(mismatched).success).toBe(false); expect(() => decodeQualificationLearningRequest(JSON.stringify(mismatched))).toThrow("SCORE_REQUEST_DIMENSION");
}, 30000);

for (const [name, change] of [
  ["initial model bytes", (input: QualificationEvidenceInput) => { input.readback.initial.record[0]! ^= 1; }],
  ["strict config schema", (input: QualificationEvidenceInput) => { Object.assign(input.readback.initial.config, { extra: true }); }],
  ["master pending", (input: QualificationEvidenceInput) => { input.readback.master.pending = "live"; }],
  ["master status", (input: QualificationEvidenceInput) => { input.readback.master.status = "complete"; }],
  ["aborted", (input: QualificationEvidenceInput) => { input.readback.control.aborted = 1; }],
  ["failure", (input: QualificationEvidenceInput) => { input.readback.control.failure = "{}"; }],
  ["checkpoint", (input: QualificationEvidenceInput) => { input.readback.checkpoints = 1; }],
  ["control binding", (input: QualificationEvidenceInput) => { input.readback.control.bindings.source.sha256 = "f".repeat(64); }],
  ["duplicate row", (input: QualificationEvidenceInput) => { input.readback.attempts[1] = input.readback.attempts[0]!; }],
  ["missing row", (input: QualificationEvidenceInput) => { input.readback.attempts.pop(); }],
  ["attempt master", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.master = 102; }],
  ["attempt ordinal", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.ordinal = 0; }],
  ["attempt incomplete", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.status = "STARTED"; }],
  ["descriptor schedule", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.descriptor.schedule = { kind: "corpus", corpusIndex: 0, candidateSide: "b" }; }],
  ["descriptor model", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.descriptor.modelId = "f".repeat(64); }],
  ["R4 RNG", (input: QualificationEvidenceInput) => { input.r4.attempts[1]!.rng!["policy-sampling"].state ^= 1; }],
  ["R4 serialized ref", (input: QualificationEvidenceInput) => { input.r4.attempts[1]!.snapshot!.serializedStateRef.sha256 = "f".repeat(64); }],
  ["R4 deadline", (input: QualificationEvidenceInput) => { input.r4.attempts[1]!.workDeadlineNs = "400000000000"; }],
  ["R4 qualified flag", (input: QualificationEvidenceInput) => { Object.assign(input.r4, { qualified: true }); }],
  ["R4 missing close", (input: QualificationEvidenceInput) => { input.r4.close.status = "FAIL"; }],
  ["counter drift", (input: QualificationEvidenceInput) => { input.readback.master.state.counters.nonzeroPGUpdates = 0; }],
  ["snapshot binding", (input: QualificationEvidenceInput) => { input.r4.attempts[1]!.snapshot!.state.bindings.tests.sha256 = "f".repeat(64); }],
  ["returned counter", (input: QualificationEvidenceInput) => { input.r4.attempts[1]!.returned!.state.counters.baselineSum = 0; }],
  ["history bytes", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.artifacts.history = encode([]); }],
  ["history ref", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.completion.historyRef.sha256 = "f".repeat(64); }],
  ["proposal ref", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.completion.proposalRef!.sha256 = "f".repeat(64); }],
  ["last segment instead of cumulative", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.completion.journalRef.sha256 = sha(input.readback.attempts[1]!.artifacts.journal); }],
  ["cumulative byte count", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.completion.journalRef.byteLength--; }],
  ["cumulative record ordinal", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.completion.journalRef.lastRecordOrdinal--; }],
  ["unbound selected record", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.artifacts.proposal = syntheticRecord("other"); }],
  ["missing proposal", (input: QualificationEvidenceInput) => { input.readback.attempts[1]!.artifacts.proposal = null; }],
  ["extra diagnostic proposal", (input: QualificationEvidenceInput) => { input.readback.attempts[0]!.artifacts.proposal = syntheticRecord("extra"); }],
  ["final model bytes", (input: QualificationEvidenceInput) => { input.readback.master.record[0]! ^= 1; }],
] as const) test(`rejects retained ${name}`, () => { const input = clone(); change(input); fail(input); });

for (const [name, change] of [
  ["canonical ready flag", (input: QualificationEvidenceInput) => { Object.assign(input.canonical.receipt, { trainingReady: true }); }],
  ["canonical missing peer", (input: QualificationEvidenceInput) => { input.canonical.receipt.lifecycle.pop(); }],
  ["canonical partial close", (input: QualificationEvidenceInput) => { input.canonical.receipt.lifecycle[0]!.finish!.stdoutEof = false; }],
  ["canonical missing exchange", (input: QualificationEvidenceInput) => { input.canonical.receipt.exchanges.pop(); }],
  ["canonical role", (input: QualificationEvidenceInput) => { input.canonical.receipt.exchanges[0]!.role = "reference"; }],
  ["canonical boundary", (input: QualificationEvidenceInput) => { input.canonical.receipt.boundaries[0]!.digest = "f".repeat(64); }],
  ["canonical forced close", (input: QualificationEvidenceInput) => { input.canonical.receipt.lifecycle[1]!.finish!.forced = true; }],
  ["canonical summary", (input: QualificationEvidenceInput) => { input.canonical.observed.exchangeCount = 13; }],
] as const) test(`rejects ${name}`, () => { const input = clone(); change(input); fail(input, "canonical"); });

for (const [kind, command, name, change, channel] of [
  ["request", "begin", "baseline", (value: any) => { value.command.baseline = 1; }, "a"],
  ["request", "begin", "session", (value: any) => { value.sessionId = "wrong:learner:a"; }, "a"],
  ["request", "begin", "ordinal", (value: any) => { value.ordinal = 1; }, "a"],
  ["request", "score", "model", (value: any) => { value.command.request.modelId = "f".repeat(64); }, "a"],
  ["request", "score", "features", (value: any) => { value.command.request.values[0] += 0.5; }, "a"],
  ["request", "acknowledge", "selected", (value: any) => { value.command.selected = (value.command.selected + 1) % value.command.request.rows; }, "b"],
  ["request", "acknowledge", "ack features", (value: any) => { value.command.request.values[0] += 0.5; }, "b"],
  ["request", "finish", "return", (value: any) => { value.command.returnValue = 1; }, "a"],
  ["reply", "acknowledged", "ack digest", (value: any) => { value.result.journalDigest = "f".repeat(64); }, "b"],
  ["reply", "acknowledged", "ack prefix", (value: any) => { value.result.sampledDecisions++; }, "b"],
  ["reply", "scored", "score request id", (value: any) => { value.result.response.requestId = "wrong"; }, "a"],
  ["reply", "scored", "score count", (value: any) => { value.result.response.logits.pop(); }, "a"],
  ["reply", "proposed", "parameter digest", (value: any) => { value.result.parameterSha256 = "f".repeat(64); }, "b"],
  ["reply", "proposed", "objective", (value: any) => { value.result.objective += 1; }, "b"],
  ["reply", "proposed", "gradient flag", (value: any) => { value.result.nonzeroPolicyGradient = false; }, "b"],
  ["reply", "proposed", "proposal count", (value: any) => { value.result.sampledDecisions++; }, "b"],
  ["reply", "proposed", "own config hash", (value: any) => { value.result.record[0] ^= 1; }, "b"],
] as const) test(`rejects native ${name}`, () => { const input = clone(); mutateFrame(input, kind, command, change, channel); fail(input); });

test("rejects nonfinite logits encoded as an overflowing JSON number", () => {
  const input = clone(), event = raw(input, "reply", "scored"); event.json = event.json.replace('"logits":[0', '"logits":[1e999'); fail(input);
});
for (const field of ["stdinClosed", "stdoutEof", "stderrEof", "reaped", "exitCode", "forced"] as const) test(`requires separate clean native finish ${field}`, () => {
  const input = clone(), finish = input.native.find(event => event.kind === "finish") as Extract<NativeObservation, { kind: "finish" }>;
  Object.assign(finish.receipt, { [field]: field === "forced" ? true : field === "exitCode" ? 1 : false }); fail(input);
});
test("rejects missing finish, duplicate finish, reply without request, pending overwrite and missing channel", () => {
  for (const mode of ["missing", "duplicate", "reply-first", "overwrite", "channel"] as const) {
    const input = clone(), events = [...input.native];
    if (mode === "missing") events.splice(events.findIndex(value => value.kind === "finish"), 1);
    if (mode === "duplicate") events.push(events.find(value => value.kind === "finish")!);
    if (mode === "reply-first") events.unshift(events.find(value => value.kind === "reply")!);
    if (mode === "overwrite") events.unshift(events[0]!);
    input.native = mode === "channel" ? events.filter(value => value.channel !== "b") : events; fail(input);
  }
});
test("rejects late and regressing per-channel receipt times", () => {
  for (const receivedNs of [-1n, 297_000_000_019n]) { const input = clone(), event = raw(input, "reply", "scored"); event.receivedNs = receivedNs; fail(input); }
});
test("enforces finite event and frame bounds without allocating a large fixture", () => {
  const input = clone(); input.native = Array(801).fill(input.native[0]); fail(input, "NATIVE_EVENT_BOUND");
  const small = clone(), event = raw(small, "request", "begin"); Object.assign(event, { json: { length: 9 * 1024 * 1024 } }); fail(small, "NATIVE_FRAME_BOUND");
});
test("accounts for full serialized native event bytes using operator bigint encoding and newline framing", () => {
  const events: NativeObservation[] = [
    { kind: "request", attemptId: "r4-m101-a0000", channel: "a", json: '{"escaped":"quote\\\"\\n漢字"}' },
    { kind: "reply", attemptId: "r4-m101-a0000", channel: "a", json: '{"kind":"begun"}', receivedNs: 1234567890123456789n },
    { kind: "finish", attemptId: "r4-m101-a0000", channel: "a", receipt: cleanExit() },
  ];
  const original = structuredClone(events);
  let usage = { events: 0, rawJsonBytes: 0, serializedBytes: 0 }, rawJsonBytes = 0, serializedBytes = 0;
  for (const event of events) {
    usage = addQualificationNativeUsage(usage, event);
    if (event.kind !== "finish") rawJsonBytes += Buffer.byteLength(event.json);
    serializedBytes += Buffer.byteLength(JSON.stringify(event, (_, value: unknown) => typeof value === "bigint" ? String(value) : value instanceof Error ? { name: value.name, message: value.message } : value) + "\n");
  }
  expect(usage).toEqual({ events: 3, rawJsonBytes, serializedBytes }); expect(serializedBytes).toBeGreaterThan(rawJsonBytes);
  expect(events).toEqual(original);
});
test("admits exactly one GiB of serialized native trace bytes with only a small boundary event", () => {
  const event: NativeObservation = { kind: "reply", attemptId: "r4-m101-a0000", channel: "a", json: "{}", receivedNs: 19n };
  const size = addQualificationNativeUsage({ events: 0, rawJsonBytes: 0, serializedBytes: 0 }, event).serializedBytes;
  const before = { events: 799, rawJsonBytes: 0, serializedBytes: 1024 * 1024 * 1024 - size };
  expect(addQualificationNativeUsage(before, event)).toEqual({ events: 800, rawJsonBytes: 2, serializedBytes: 1024 * 1024 * 1024 });
  expect(before.serializedBytes).toBe(1024 * 1024 * 1024 - size);
  expect(() => addQualificationNativeUsage({ ...before, serializedBytes: before.serializedBytes + 1 }, event)).toThrow("NATIVE_TOTAL_BOUND");
  expect(() => addQualificationNativeUsage({ ...before, events: 800 }, event)).toThrow("NATIVE_EVENT_BOUND");
});
test("counts finish-receipt framing against the same serialized trace cap", () => {
  const event: NativeObservation = { kind: "finish", attemptId: "r4-m101-a0000", channel: "b", receipt: cleanExit() };
  const size = addQualificationNativeUsage({ events: 0, rawJsonBytes: 0, serializedBytes: 0 }, event).serializedBytes;
  const usage = { events: 7, rawJsonBytes: 17, serializedBytes: 1024 * 1024 * 1024 - size };
  expect(addQualificationNativeUsage(usage, event)).toEqual({ events: 8, rawJsonBytes: 17, serializedBytes: 1024 * 1024 * 1024 });
  expect(() => addQualificationNativeUsage({ ...usage, serializedBytes: usage.serializedBytes + 1 }, event)).toThrow("NATIVE_TOTAL_BOUND");
});
test("accepts 64 sampled native protocol steps but rejects their missing retained decision linkage", async () => {
  const input = clone(), id = "r4-m101-a0001", descriptor = input.readback.attempts[1]!.descriptor, events: NativeObservation[] = [];
  const learner = (channel: "a" | "b") => new NativeLearner(`${id}:learner:${channel}`, descriptor.modelId, new InjectedLearningPort(id, channel, events, false), () => 19n, 297_000_000_019n, 300_000_000_019n);
  const a = learner("a"), b = learner("b"), pair = new LearnerPair(a, b);
  const rows = Buffer.from(input.readback.attempts[1]!.artifacts.journal).toString().trimEnd().split("\n").map(line => JSON.parse(line));
  const journal = rows.find(row => row.event.kind === "decision-acked").event.value;
  journal.selectedIndex = 0; journal.selectedKey = "[]"; journal.actions = [];
  const values = new Float64Array(2271), request = { version: "chess-coach.inference.v1", featureVersion: "chess-coach.features.v1",
    requestId: journal.permitId, modelId: descriptor.modelId, rows: 1, values: Array.from(values) };
  await pair.begin(descriptor.frozenBaseline);
  for (let index = 0; index < 64; index++) {
    await a.score(JSON.stringify(request));
    await pair.accumulate({ journal, digest: sha(JSON.stringify(journal)), features: { featureVersion: "chess-coach.features.v1", rows: 1, values } });
  }
  await pair.propose(-1); await pair.close();
  input.native = [...input.native.filter(event => event.attemptId !== id), ...events]; input.readback.attempts[1]!.completion.sampledDecisions = 64;
  const result = checkQualificationEvidence(input);
  expect(result.failures).toEqual([`${id}:DECISION_FEATURE_MATRIX`]); expect(result.status).toBe("FAIL_RETAINED_FUNCTIONAL_EVIDENCE");
  expect(events.length).toBeLessThan(800);
}, 30000);
for (const [kind, name, change] of [
  ["started", "descriptor", (line: any) => { line.event.value.descriptor.modelId = "f".repeat(64); }],
  ["initial", "side", (line: any) => { line.event.value.batches.w.side = "b"; }],
  ["initial", "bank", (line: any) => { line.event.value.bank.w = 2; }],
  ["native", "recipient minerals", (line: any) => { line.event.value.session.batches.w.observation.own.minerals = 0; }],
  ["native", "parent history", (line: any) => { line.event.value.session.history[0] = "f".repeat(64); }],
  ["permit", "permit window", (line: any) => { line.event.value.deadlineNs = "20"; }],
  ["permit", "permit side", (line: any) => { line.event.value.side = "b"; }],
  ["decision-acked", "decision history", (line: any) => { line.event.value.historyDigest = "f".repeat(64); }],
  ["decision-acked", "candidate digest", (line: any) => { line.event.value.orderedCandidateDigest = "f".repeat(64); }],
  ["decision-acked", "requested spend", (line: any) => { line.event.value.requestedSpend.minerals = 12; }],
  ["decision-acked", "sample RNG", (line: any) => { line.event.value.samplingBefore.drawCount++; }],
  ["complete", "complete count", (line: any) => { line.event.value.planningWindows++; }],
  ["complete", "match reply ordinal", (line: any) => { line.event.value.ordinal++; }],
  ["match-exit", "match forced exit", (line: any) => { line.event.value.forced = true; }],
  ["learners-closed", "retained pair summary", (line: any) => { line.event.value.parameterSha256 = "f".repeat(64); }],
  ["initial", "record ordinal", (line: any) => { line.recordOrdinal++; }],
  ["initial", "event ordinal", (line: any) => { line.event.ordinal++; }],
  ["initial", "attempt binding", (line: any) => { line.attemptId = "other"; }],
] as const) test(`rejects journal ${name}`, () => { const input = clone(); mutateJournal(input, kind, change); fail(input); });

test("malformed input returns bounded FAIL rather than partial PASS or an exception", () => {
  for (const value of [null, {}, { canonical: base.input.canonical }, { ...base.input, readback: null }]) fail(value as QualificationEvidenceInput);
});
test("readback opens a settled database readonly and leaves every selected byte unchanged", () => {
  const path = join(base.root, "private.sqlite"), before = readFileSync(path), stat = lstatSync(path), value = readQualificationReadback(base.root);
  expect(value.master.state).toEqual(base.input.readback.master.state); expect(ref(readFileSync(path))).toEqual(ref(before));
  expect(lstatSync(path).mtimeMs).toBe(stat.mtimeMs); expect(value.attempts).toHaveLength(2); expect(value.checkpoints).toBe(0);
});
test("readback rejects relative, nonnormalized, nonexistent, and symlink roots", () => {
  const symlink = join(workspace, "root-link"); symlinkSync(base.root, symlink);
  for (const root of ["relative", `${base.root}/../zero-logits`, join(workspace, "absent"), symlink, `${base.root}\0`]) expect(() => readQualificationReadback(root)).toThrow();
});
function databaseFixture(name: string, mutate: (db: Database, root: string) => void) {
  const root = join(workspace, name); mkdirSync(root); writeFileSync(join(root, "private.sqlite"), readFileSync(join(base.root, "private.sqlite")));
  const initial = join(root, "packet-00", "attempt-initial-master-101"); mkdirSync(initial, { recursive: true });
  writeFileSync(join(initial, "000000-initial-native-record.bin"), base.input.readback.initial.record);
  writeFileSync(join(initial, "000001-initial-model-config.bin"), encode(base.input.readback.initial.config));
  const db = new Database(join(root, "private.sqlite"), { create: false, strict: true });
  try { mutate(db, root); } finally { db.close(); }
  return root;
}
test("readback rejects oversized sparse databases before SQLite acquisition", () => {
  const root = join(workspace, "oversized"); mkdirSync(root); const path = join(root, "private.sqlite"); writeFileSync(path, "x"); truncateSync(path, 64 * 1024 * 1024 + 1);
  expect(() => readQualificationReadback(root)).toThrow("READBACK_DATABASE_BOUND");
});
for (const [name, sql] of [
  ["extra-control", "INSERT INTO control VALUES (2,'{}',0,NULL)"],
  ["extra-attempt", "INSERT INTO attempts SELECT 'extra',master,2,descriptor,status,completion FROM attempts LIMIT 1"],
  ["missing-attempt", "DELETE FROM attempts WHERE ordinal=1"],
  ["bad-completion", "UPDATE attempts SET completion='{}' WHERE ordinal=0"],
] as const) test(`readback rejects ${name} and closes after parse failure`, () => {
  const root = databaseFixture(name, db => {
    if (name === "extra-control") { db.run("PRAGMA ignore_check_constraints=ON"); }
    db.run(sql);
  });
  expect(() => readQualificationReadback(root)).toThrow();
  const db = new Database(join(root, "private.sqlite"), { create: false, strict: true });
  try { db.run("BEGIN EXCLUSIVE"); db.run("ROLLBACK"); } finally { db.close(); }
});
test("readback rejects symlink database and artifact directories without traversal", () => {
  const root = join(workspace, "database-link"); mkdirSync(root); symlinkSync(join(base.root, "private.sqlite"), join(root, "private.sqlite"));
  expect(() => readQualificationReadback(root)).toThrow();
  const packet = join(workspace, "packet-link"); mkdirSync(packet); writeFileSync(join(packet, "private.sqlite"), readFileSync(join(base.root, "private.sqlite")));
  symlinkSync(join(base.root, "packet-00"), join(packet, "packet-00")); expect(() => readQualificationReadback(packet)).toThrow("READBACK_DIRECTORY");
});
test("readback rejects symlink and oversized retained model files", () => {
  const linked = join(workspace, "artifact-link"); mkdirSync(linked); writeFileSync(join(linked, "private.sqlite"), readFileSync(join(base.root, "private.sqlite")));
  const directory = join(linked, "packet-00", "attempt-initial-master-101"); mkdirSync(directory, { recursive: true });
  symlinkSync(join(base.root, "packet-00", "attempt-initial-master-101", "000000-initial-native-record.bin"), join(directory, "000000-initial-native-record.bin"));
  expect(() => readQualificationReadback(linked)).toThrow();
  const oversized = databaseFixture("artifact-oversized", (_db, root) => { truncateSync(join(root, "packet-00", "attempt-initial-master-101", "000000-initial-native-record.bin"), 1024 * 1024 + 1); });
  expect(() => readQualificationReadback(oversized)).toThrow("READBACK_FILE_BOUND");
});
