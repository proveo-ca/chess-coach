// SPEC: _spec/policy-runtime.puml
import type {} from "bun";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { decodeObservation, decodeScoreResponse, encodeScoreRequest } from "@chess-coach/contracts";
import type { Candidate, ScoreRequest } from "@chess-coach/contracts";
import { specialGasCost, UNIT_COST } from "@chess-coach/game-core";
import { encodeFeatures, enumerateCandidates, ENUMERATION_VERSION, FEATURE_VERSION } from "@chess-coach/policy";
import { decodeDecisionJournal, decisionJournalShape, planPermitShape, streamStateShape } from "../../contracts/src/episode";
import type { DecisionJournal, PlanPermit, StreamState } from "../../contracts/src/episode";
import { drawStream } from "./rng";

export interface FrozenScorePort { score(requestJson: string): Promise<{ json: string; receivedNs: bigint }> }
export type PolicyContext = { permit: PlanPermit; modelId: string; observationJson: string; sampling: StreamState;
  mode: "sample" | "argmax"; workDeadlineNs: bigint; clockNs: () => bigint };
export type AckedDecision = { journal: DecisionJournal; digest: string; features: ReturnType<typeof encodeFeatures> };
const sha = (value: string): string => createHash("sha256").update(value).digest("hex");
const key = (candidate: Candidate): string => JSON.stringify(candidate.actions);
function fail(code: string): never { throw new Error(`Policy session: ${code}`); }

export function distribution(logits: readonly number[]): { probabilities: number[]; logProbabilities: number[] } {
  if (!logits.length || logits.length > 512 || logits.some(value => !Number.isFinite(value))) fail("NONFINITE_LOGITS");
  const maximum = Math.max(...logits), shifted = logits.map(value => value - maximum);
  if (shifted.some(value => !Number.isFinite(value))) fail("DISTRIBUTION");
  const exponentials = shifted.map(value => Math.exp(value)), sum = exponentials.reduce((total, value) => total + value, 0), logSum = Math.log(sum);
  const probabilities = exponentials.map(value => value / sum), logProbabilities = shifted.map(value => value - logSum);
  if (!Number.isFinite(sum) || sum <= 0 || probabilities.some(value => !Number.isFinite(value) || value < 0 || value > 1) ||
    logProbabilities.some(value => !Number.isFinite(value)) || Math.abs(probabilities.reduce((a, b) => a + b, 0) - 1) > 1e-12) fail("DISTRIBUTION");
  return { probabilities, logProbabilities };
}
export function selectedIndex(logits: readonly number[], keys: readonly string[], mode: "sample" | "argmax", uniform: number | null): number {
  const { probabilities } = distribution(logits);
  if (keys.length !== logits.length || new Set(keys).size !== keys.length) fail("CANDIDATE_KEYS");
  if (mode === "argmax") {
    if (uniform !== null) fail("EVALUATION_DRAW");
    let best = 0;
    for (let index = 1; index < logits.length; index++) if (logits[index]! > logits[best]! || logits[index] === logits[best] && keys[index]! < keys[best]!) best = index;
    return best;
  }
  if (uniform === null || !Number.isFinite(uniform) || uniform < 0 || uniform >= 1) fail("UNIFORM");
  let cumulative = 0, last = -1;
  for (const [index, probability] of probabilities.entries()) {
    cumulative += probability;
    if (probability > 0) last = index;
    if (cumulative > uniform) return index;
  }
  if (last >= 0 && Math.abs(cumulative - 1) <= 1e-12) return last;
  return fail("DISTRIBUTION");
}

function context(input: PolicyContext): PolicyContext {
  const permit = planPermitShape.parse(input.permit), sampling = streamStateShape.parse(input.sampling);
  if (!/^[a-f0-9]{64}$/.test(input.modelId) || sampling.status !== "active" || permit.role !== "candidate" || permit.permitId !== `${permit.attemptId}:plan:${permit.planningOrdinal}:${permit.side}` ||
    !["sample", "argmax"].includes(input.mode) || BigInt(permit.deadlineNs) - BigInt(permit.issuedNs) !== 10_000_000_000n ||
    BigInt(permit.deadlineNs) > input.workDeadlineNs || input.workDeadlineNs - BigInt(permit.issuedNs) > 300_000_000_000n) fail("CONTEXT");
  return { ...input, permit, sampling };
}
function checkTime(input: PolicyContext, deadline: bigint): void {
  const now = input.clockNs();
  if (now < BigInt(input.permit.issuedNs) || now >= deadline) fail("DEADLINE");
}
async function bounded<T>(input: PolicyContext, deadline: bigint, action: () => Promise<T>): Promise<T> {
  checkTime(input, deadline);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Policy session: DEADLINE")), Number((deadline - input.clockNs() + 999999n) / 1000000n)); });
    const value = await Promise.race([action(), timeout]);
    checkTime(input, deadline);
    return value;
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
async function reconstruct(input: PolicyContext, scorer: FrozenScorePort, verification: boolean): Promise<Omit<AckedDecision, "digest">> {
  const deadline = verification ? input.workDeadlineNs : BigInt(input.permit.deadlineNs);
  checkTime(input, deadline);
  const observation = decodeObservation(input.observationJson);
  if (observation.side !== input.permit.side || observation.turn !== input.permit.turn) fail("HISTORY_BINDING");
  const history = JSON.stringify(observation), candidates = enumerateCandidates(history).candidates;
  const keys = candidates.map(key), features = encodeFeatures(history, candidates.map(candidate => JSON.stringify(candidate)));
  checkTime(input, deadline);
  const request: ScoreRequest = Object.freeze({ version: "chess-coach.inference.v1", featureVersion: features.featureVersion,
    requestId: input.permit.permitId, modelId: input.modelId, rows: features.rows, values: Object.freeze(Array.from(features.values)) });
  const issued = input.clockNs(), raw = await bounded(input, deadline, () => scorer.score(encodeScoreRequest(request)));
  if (raw.receivedNs < issued || raw.receivedNs >= deadline || raw.receivedNs > input.clockNs()) fail("SCORE_RECEIPT");
  const response = decodeScoreResponse(raw.json, request), probabilities = distribution(response.logits);
  const draw = input.mode === "sample" ? drawStream(input.sampling) : { uniform: null, after: input.sampling };
  const index = selectedIndex(response.logits, keys, input.mode, draw.uniform), candidate = candidates[index]!;
  let minerals = 0, gas = 0;
  for (const action of candidate.actions) {
    if (action.kind === "deploy") minerals += UNIT_COST[action.unit];
    if (action.kind !== "classical") gas += specialGasCost(action.kind);
  }
  const journal = decisionJournalShape.parse({ version: "chess-coach.decision.v1", attemptId: input.permit.attemptId, permitId: input.permit.permitId,
    planningOrdinal: input.permit.planningOrdinal, side: input.permit.side, modelId: input.modelId, historyDigest: sha(history), featureVersion: FEATURE_VERSION,
    enumerationVersion: ENUMERATION_VERSION, orderedCandidateDigest: sha(JSON.stringify(keys)), mode: input.mode, selectedIndex: index, selectedKey: keys[index],
    actions: candidate.actions, requestedSpend: { minerals, gas }, uniform: draw.uniform, selectedLogProbability: probabilities.logProbabilities[index],
    samplingBefore: input.sampling, samplingAfter: draw.after });
  checkTime(input, deadline);
  return { journal, features };
}

export class PolicyWorker {
  private readonly input: PolicyContext;
  private committedSampling: StreamState;
  private phase: "issued" | "planning" | "tentative" | "acked" | "failed" = "issued";
  private tentative: DecisionJournal | null = null;
  constructor(input: PolicyContext, private readonly scorer: FrozenScorePort) {
    this.input = context(input);
    this.committedSampling = this.input.sampling;
  }
  sampling(): StreamState { return structuredClone(this.committedSampling); }
  async plan(permitJson: string): Promise<string> {
    if (this.phase !== "issued") { this.phase = "failed"; return fail("WORKER_PHASE"); }
    this.phase = "planning";
    try {
      if (!isDeepStrictEqual(planPermitShape.parse(JSON.parse(permitJson)), this.input.permit)) fail("PERMIT");
      const prepared = await reconstruct(this.input, this.scorer, false);
      if (this.phase !== "planning") fail("WORKER_PHASE");
      this.tentative = prepared.journal;
      this.phase = "tentative";
      return JSON.stringify(prepared.journal);
    } catch (error) { this.phase = "failed"; throw error; }
  }
  acceptAck(digest: string): void {
    if (this.phase !== "tentative" || sha(JSON.stringify(this.tentative)) !== digest) { this.phase = "failed"; fail("ACK"); }
    try { checkTime(this.input, this.input.workDeadlineNs); }
    catch (error) { this.phase = "failed"; throw error; }
    this.committedSampling = this.tentative!.samplingAfter;
    this.phase = "acked";
  }
}

export class PolicySession {
  private readonly input: PolicyContext;
  private phase: "issued" | "verifying" | "acked" | "admitted" | "failed" = "issued";
  private accepted: Pick<AckedDecision, "journal" | "digest"> | null = null;
  constructor(input: PolicyContext, private readonly verifier: FrozenScorePort) { this.input = context(input); }
  async acknowledge(raw: { json: string; receivedNs: bigint }): Promise<AckedDecision> {
    if (this.phase !== "issued") { this.phase = "failed"; return fail("OWNER_PHASE"); }
    this.phase = "verifying";
    try {
      if (raw.receivedNs < BigInt(this.input.permit.issuedNs) || raw.receivedNs >= BigInt(this.input.permit.deadlineNs) || raw.receivedNs > this.input.clockNs()) fail("DECISION_RECEIPT");
      const claimed = decodeDecisionJournal(raw.json), expected = await reconstruct(this.input, this.verifier, true);
      if (this.phase !== "verifying" || !isDeepStrictEqual(claimed, expected.journal)) fail("DECISION_MISMATCH");
      const digest = sha(JSON.stringify(expected.journal));
      this.accepted = { journal: expected.journal, digest };
      this.phase = "acked";
      return structuredClone({ ...expected, digest });
    } catch (error) { this.phase = "failed"; throw error; }
  }
  async admit<T>(admission: (actions: Candidate["actions"]) => Promise<T> | T): Promise<T> {
    if (this.phase !== "acked" || this.accepted === null) { this.phase = "failed"; return fail("ADMISSION_PHASE"); }
    this.phase = "admitted";
    try {
      checkTime(this.input, this.input.workDeadlineNs);
      const result = await admission(structuredClone(this.accepted.journal.actions));
      if (this.phase !== "admitted") fail("ADMISSION_PHASE");
      checkTime(this.input, this.input.workDeadlineNs);
      return result;
    }
    catch (error) { this.phase = "failed"; throw error; }
  }
}
