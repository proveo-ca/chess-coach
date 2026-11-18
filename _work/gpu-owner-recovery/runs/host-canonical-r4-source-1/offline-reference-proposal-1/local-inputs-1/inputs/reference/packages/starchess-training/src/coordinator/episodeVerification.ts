// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml, _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  initializeR3Session, stageR3Begin, stageR3Settlement, verifyAndCommitR3,
  type R3Session, type R3StagedTransition,
} from "@chess-coach/starchess-arena";
import {
  parseScFen, scOutcome, addScAction, AddScActionError, UNIT_COST, incomeForTurn,
  seedKvsForOpening, updateKvsForSnap, seedCcIntelForOpening, updateCcIntelForSnap,
  seedRunnerMemory, seedAttackerMemory, updateRunnersForSnap, updateAttackersForSnap, witnessFromEndTurn,
  strategicCandidates, applyCandidate, type ScActionInput, type StrategicResult,
} from "@chess-coach/starchess-core";
import type {
  ChallengeStop, CompactSampleJournalEntry, CompleteMessage, DecisionId, DecisionResultMessage, EpisodeMessage,
  OriginalEpisodeRequestV2, OppPrivateJournal, PlanPermit, ReadyMessage, SettlementMessage, StopProof, StopReason,
  TurnOpenResultMessage, EpisodeScoreAccumulator,
} from "./episodeContracts";
import type { Side } from "../economic/contracts";
import { constructRef, OPENING_CANONICAL_BYTES_TEXT } from "../economic/ownedKernel";
import { encodeOwnedNumber } from "../economic/ownedScalars";
import { encodeEpisodeMessage, encodeInitialNativeProvenance, encodeNativeEpisodeEvidence, EPISODE_LIMITS, rawFrameReceipt, requireDecodedEpisodeMessage,
  requireWrittenAcknowledgement, type RawEpisodeFrame } from "./episodeProtocol";
import { requireEpisodeRequest, validateEpisodeRequestStartup, type TrustedExpectedEpisodeBindings } from "./episodeRequest";
import { drawEpisodeRng, equalEpisodeStreamStates, restoreEpisodeRng, snapshotEpisodeRng, constructEpisodeStartStreams, type EpisodeRng } from "./episodeRng";
import type { RegisteredByteStore } from "./registeredBytes";

const freeze = Object.freeze;
const FixedMap = WeakMap, FixedSet = WeakSet;
const getIdentity = Function.prototype.call.bind(WeakMap.prototype.get) as <T>(map: WeakMap<object, T>, key: object) => T | undefined;
const setIdentity = Function.prototype.call.bind(WeakMap.prototype.set) as <T>(map: WeakMap<object, T>, key: object, value: T) => void;
const deleteIdentity = Function.prototype.call.bind(WeakMap.prototype.delete) as (map: WeakMap<object, unknown>, key: object) => boolean;
const hasIdentity = Function.prototype.call.bind(WeakSet.prototype.has) as (set: WeakSet<object>, key: object) => boolean;
const addIdentity = Function.prototype.call.bind(WeakSet.prototype.add) as (set: WeakSet<object>, key: object) => void;
const privateMap = <T>() => {
  const map = new FixedMap<object, T>();
  return freeze({ get: (key: object): T | undefined => getIdentity(map, key), set: (key: object, value: T): void => setIdentity(map, key, value),
    delete: (key: object): boolean => deleteIdentity(map, key) });
};
const privateSet = () => {
  const set = new FixedSet<object>();
  return freeze({ has: (key: object): boolean => hasIdentity(set, key), add: (key: object): void => addIdentity(set, key) });
};
const now = process.hrtime.bigint.bind(process.hrtime);
const canonicalOpening = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
export class EpisodeVerificationError extends Error {
  override readonly name = "EpisodeVerificationError";
  constructor(readonly reason: StopReason) { super(reason); }
}
const reject = (reason: StopReason): never => { throw new EpisodeVerificationError(reason); };
export const physicalRef = (bytes: Uint8Array) => constructRef(bytes.length, createHash("sha256").update(bytes).digest("hex"));
declare const executionBrand: unique symbol;
declare const replicaBrand: unique symbol;
declare const acceptedBrand: unique symbol;
export type TrustedExecutionContext = Readonly<{ [executionBrand]: "independent-episode-startup" }>;
export type EpisodeReplica = Readonly<{ [replicaBrand]: "private-native-replica" }>;
export type LocalAcceptedPermit = Readonly<{ [acceptedBrand]: "checked-real-channel-ack" }>;
type Execution = {
  request: OriginalEpisodeRequestV2; weights: ReturnType<typeof validateEpisodeRequestStartup>;
  sourceSeal: unknown; boundModels: unknown;
};
const executions = privateMap<Execution>();
export const constructTrustedExecutionContext = (
  request: OriginalEpisodeRequestV2, expected: TrustedExpectedEpisodeBindings, store: RegisteredByteStore,
  sourceSeal: unknown, boundModels: unknown,
): TrustedExecutionContext => {
  const original = requireEpisodeRequest(request), weights = validateEpisodeRequestStartup(original, expected, store);
  const token = freeze({}) as TrustedExecutionContext;
  executions.set(token, freeze({ request: original, weights, sourceSeal, boundModels }));
  return token;
};
export const requireTrustedExecutionContext = (context: unknown): Readonly<Execution> => {
  if (context === null || typeof context !== "object") return reject("identity");
  const execution = executions.get(context);
  if (!execution) return reject("identity");
  return execution;
};
type QueueStage = { side: Side; intents: ScActionInput[]; gasAfter: number; spend: number };
type Stage = "ready" | "begin" | "planning" | "settlement" | "complete" | "closed";
type Control = {
  execution: Execution; binding: object; session: R3Session; stage: Stage; realm: "parent" | "child";
  transition: R3StagedTransition | null; pair: { w?: QueueStage; b?: QueueStage };
  active: LocalAcceptedPermit | null; permit: PlanPermit | null; matchDeadline: bigint | null;
  candidate: CompactSampleJournalEntry[]; opponent: OppPrivateJournal[]; accumulator: number[];
  policy: EpisodeRng; enemy: EpisodeRng; stop: StopProof | null; plies: number;
  journal: Buffer[]; journalSize: number; kvs: ReturnType<typeof seedKvsForOpening>;
  ackCandidateCount: number; ackOpponentCount: number;
  ccIntel: ReturnType<typeof seedCcIntelForOpening>; runner: ReturnType<typeof seedRunnerMemory>; attacker: ReturnType<typeof seedAttackerMemory>;
};
const replicas = privateMap<Control>();
const nativeMessages = privateMap<EpisodeMessage>();
const nativeEvidence = privateMap<object>();
const nativeOrigins = privateMap<{ control: Control; transition: R3StagedTransition | null }>();
type PermitControl = {
  replica: EpisodeReplica; permit: PlanPermit; deadline: bigint; matchDeadline: bigint;
  status: "planning" | "verifying" | "accepted" | "revoked"; receipt: bigint | null; admitted: boolean;
  written: boolean;
};
const accepted = privateMap<PermitControl>();
const acceptedAckFrames = privateSet();
const controlFor = (replica: unknown): Control => {
  if (replica === null || typeof replica !== "object") return reject("session");
  const control = replicas.get(replica);
  if (!control || control.stage === "closed") return reject("session");
  return control;
};
export const createEpisodeReplica = (context: TrustedExecutionContext, realm: "parent" | "child"): EpisodeReplica => {
  const execution = requireTrustedExecutionContext(context), binding = freeze({});
  const opening = parseScFen(canonicalOpening), session = initializeR3Session(binding, opening, { w: 3, b: 3 });
  const token = freeze({}) as EpisodeReplica;
  replicas.set(token, { execution, binding, session, realm, stage: "ready", transition: null, pair: {}, active: null, permit: null,
    matchDeadline: null, candidate: [], opponent: [], accumulator: Array(418).fill(0), policy: restoreEpisodeRng(execution.request.streams["policy-sampling"]),
    enemy: restoreEpisodeRng(execution.request.streams.opponent), stop: null, plies: 0, journal: [], journalSize: 0, ackCandidateCount: 0, ackOpponentCount: 0,
    kvs: seedKvsForOpening(opening), ccIntel: seedCcIntelForOpening(), runner: seedRunnerMemory(), attacker: seedAttackerMemory() });
  return token;
};
const nativeProduction = <T extends EpisodeMessage>(message: T, evidence: object, control: Control, transition: R3StagedTransition | null): T => {
  freeze(message); nativeMessages.set(message, message); nativeEvidence.set(message, evidence); nativeOrigins.set(message, { control, transition }); return message;
};
export const requireNativeEvidenceProduction = (message: unknown): object => {
  requireNativeMessageProduction(message);
  return nativeEvidence.get(message as object)!;
};
export const requireNativeMessageProduction = (message: unknown): EpisodeMessage => {
  if (message === null || typeof message !== "object") return reject("provenance");
  const production = nativeMessages.get(message);
  if (!production) return reject("provenance");
  return production;
};
const header = <K extends EpisodeMessage["kind"]>(control: Control, kind: K, messageOrdinal: number) =>
  ({ version: "starchess-training-episode-v2" as const, attemptId: control.execution.request.attemptId, messageOrdinal, kind });
export const expectedReadyMessage = (replica: EpisodeReplica, ordinal: number): ReadyMessage => {
  const c = controlFor(replica);
  if (c.stage !== "ready") return reject("protocol");
  return nativeProduction({ ...header(c, "ready", ordinal), openingDigest: physicalRef(Buffer.from(OPENING_CANONICAL_BYTES_TEXT)),
    initialPublicBatch: c.session.recipients[c.execution.request.schedule.candidateSide].batch,
    privateProvenanceDigest: physicalRef(encodeInitialNativeProvenance(c.binding, c.session)) },
  freeze({ snapshot: c.session.snapshot, bank: c.session.bank, provenance: c.session.provenance,
    batches: freeze({ w: c.session.recipients.w.batch, b: c.session.recipients.b.batch }) }), c, null);
};
const journal = (c: Control, message: EpisodeMessage): void => {
  const bytes = encodeEpisodeMessage(message);
  const native = message.kind === "ready" || message.kind === "turn-open-result" || message.kind === "settlement" ? encodeNativeEpisodeEvidence(message) : null;
  if (bytes.length + c.journalSize + 1 + (native ? native.length + 1 : 0) > EPISODE_LIMITS.maxCompletionBytes) return reject("size");
  c.journal.push(bytes, Buffer.from("\n")); c.journalSize += bytes.length + 1;
  if (native) { c.journal.push(native, Buffer.from("\n")); c.journalSize += native.length + 1; }
};
export const verifyReadyReceipt = (replica: EpisodeReplica, message: ReadyMessage, frame: RawEpisodeFrame): void => {
  const c = controlFor(replica);
  requireNativeMessageProduction(message);
  if (requireDecodedEpisodeMessage(frame) !== message) return reject("protocol");
  if (c.stage !== "ready" || message.kind !== "ready" || nativeOrigins.get(message)?.control !== c) return reject("protocol");
  c.matchDeadline = rawFrameReceipt(frame) + BigInt(EPISODE_LIMITS.matchMs) * 1000000n;
  journal(c, message); c.stage = scOutcome(c.session.snapshot) ? "complete" : "begin";
};
export const startChildReplica = (replica: EpisodeReplica, message: ReadyMessage, matchDeadline: bigint): void => {
  const c = controlFor(replica);
  if (c.realm !== "child" || c.stage !== "ready" || nativeOrigins.get(message)?.control !== c) return reject("protocol");
  journal(c, message); c.matchDeadline = matchDeadline; c.stage = "begin";
};
const bankAfter = (c: Control, transition: R3StagedTransition): { w: number; b: number } => {
  if (transition.phase === "turn-open") return c.session.bank;
  const stages = transition.successfulOwnStages;
  if (!stages) return reject("session");
  const grant = incomeForTurn(transition.companion.nativeResult.next.turn);
  return freeze({ w: Math.min(12, c.session.bank.w - stages.w.spend + grant), b: Math.min(12, c.session.bank.b - stages.b.spend + grant) });
};
export const expectedBeginMessage = (replica: EpisodeReplica, ordinal: number): TurnOpenResultMessage => {
  const c = controlFor(replica);
  if (c.stage !== "begin" || c.session.planningOrdinal >= 64) return reject("protocol");
  const transition = stageR3Begin(c.binding, c.session); c.transition = transition;
  return nativeProduction({ ...header(c, "turn-open-result", ordinal), planningOrdinal: c.session.planningOrdinal,
    begin: transition.companion.nativeResult as TurnOpenResultMessage["begin"], bank: bankAfter(c, transition),
    publicBatch: transition.batches[c.execution.request.schedule.candidateSide], privateProvenanceDigest: physicalRef(transition.provenanceBytes) },
  freeze({ companion: transition.companion, bank: bankAfter(c, transition), batches: transition.batches }), c, transition);
};
const updateMemory = (c: Control, transition: R3StagedTransition): void => {
  const result = transition.companion.nativeResult;
  const end = transition.phase === "settled" ? result as SettlementMessage["end"] : (result as TurnOpenResultMessage["begin"]).asResolve;
  if (!end) return;
  c.kvs = updateKvsForSnap(c.kvs, c.session.snapshot);
  c.ccIntel = updateCcIntelForSnap(c.ccIntel, c.session.snapshot);
  const witness = witnessFromEndTurn(end);
  c.runner = updateRunnersForSnap(c.runner, c.session.snapshot, witness);
  c.attacker = updateAttackersForSnap(c.attacker, c.session.snapshot, witness);
  c.plies++;
};
export const verifyNativeMessage = (replica: EpisodeReplica, message: TurnOpenResultMessage | SettlementMessage): void => {
  const c = controlFor(replica), transition = c.transition;
  requireNativeMessageProduction(message);
  const origin = nativeOrigins.get(message);
  if (!transition || origin?.control !== c || origin.transition !== transition || message.planningOrdinal !== c.session.planningOrdinal ||
    message.kind === "turn-open-result" && c.stage !== "begin" || message.kind === "settlement" && c.stage !== "settlement") return reject("protocol");
  const session = verifyAndCommitR3(c.binding, c.session, transition);
  journal(c, message); c.session = session; c.transition = null;
  updateMemory(c, transition);
  c.stage = scOutcome(session.snapshot) ? "complete" : transition.phase === "turn-open" ? "planning" : "begin";
  if (transition.phase === "settled") c.pair = {};
};
export const replicaStage = (replica: EpisodeReplica): Stage => controlFor(replica).stage;
export const replicaRequest = (replica: EpisodeReplica): OriginalEpisodeRequestV2 => controlFor(replica).execution.request;
export const replicaDeadlines = (replica: EpisodeReplica): Readonly<{ match: bigint | null; plan: bigint | null; role: PlanPermit["role"] | null }> => {
  const c = controlFor(replica), token = c.active && accepted.get(c.active);
  return freeze({ match: c.matchDeadline, plan: token?.deadline ?? null, role: token?.permit.role ?? null });
};
export const checkReplicaMatchDeadline = (replica: EpisodeReplica, time = now()): void => {
  const deadline = controlFor(replica).matchDeadline;
  if (deadline !== null && time >= deadline) return reject("match-timeout");
};
const roleFor = (c: Control, side: Side): PlanPermit["role"] => side === c.execution.request.schedule.candidateSide ? "candidate" : "strategic";
const nextSide = (c: Control): Side | null => c.execution.request.schedule.suite === "corpus" ? c.pair.b ? null : "b" :
  !c.pair.w ? "w" : !c.pair.b ? "b" : null;

export const checkPlanningStartupBindings = async (replica: EpisodeReplica): Promise<void> => {
  const c = controlFor(replica);
  if (c.execution.sourceSeal === null || c.execution.sourceSeal === undefined || c.execution.boundModels === null || c.execution.boundModels === undefined) return reject("source");
  try {
    const bootstrap = await import("./sourceBootstrap");
    const seal = bootstrap.requireVerifiedSourceSeal(c.execution.sourceSeal);
    const startup = await import("./startupScope");
    startup.requireBoundModels(c.execution.boundModels, seal);
    startup.requireEpisodeConfiguration(c.execution.boundModels, seal, c.execution.request);
  } catch { return reject("source"); }
  checkReplicaMatchDeadline(replica);
};
export const issueParentPlanPermit = async (replica: EpisodeReplica, time: () => bigint = now): Promise<PlanPermit | null> => {
  const c = controlFor(replica);
  if (c.realm !== "parent" || c.active || c.permit) return reject("permit");
  if (c.stage === "complete" || c.stage === "settlement") return null;
  if (c.stage !== "planning") return reject("protocol");
  if (c.session.planningOrdinal >= 64 || c.plies >= 128) {
    establishStop(replica, { kind: "progress-limit", phase: "planning", planningOrdinal: c.session.planningOrdinal, turn: c.session.snapshot.turn }, "native", "progress-cap");
    return null;
  }
  await checkPlanningStartupBindings(replica);
  if (c.execution.request.schedule.suite === "corpus") {
    const startup = await import("./startupScope");
    const actions = startup.readBoundCorpusWhite(c.execution.boundModels, c.execution.request, c.session.planningOrdinal);
    if (actions === null) {
      establishStop(replica, { kind: "trace-exhausted", phase: "planning", planningOrdinal: c.session.planningOrdinal, turn: c.session.snapshot.turn }, "recorded-white", "trace-exhaustion");
      return null;
    }
    const stage = stageOwnQueue(c, "w", actions);
    if (!stage.ok) { establishStop(replica, stage.stop, "recorded-white", "recorded-white-rejection"); return null; }
    c.pair.w = stage.staged;
  }
  const side = nextSide(c);
  if (side === null) return null;
  const permit = freeze({ permitId: `${c.execution.request.attemptId}:plan:${c.session.planningOrdinal}:${side}`,
    planningOrdinal: c.session.planningOrdinal, turn: c.session.snapshot.turn, side, role: roleFor(c, side) });
  const startedAt = time();
  checkReplicaMatchDeadline(replica, startedAt);
  c.permit = permit;
  const token = freeze({}) as LocalAcceptedPermit;
  accepted.set(token, { replica, permit, deadline: startedAt + 10000000000n, matchDeadline: c.matchDeadline!, status: "planning", receipt: null, admitted: false, written: false });
  c.active = token;
  return permit;
};
export const acknowledgeParentPermitWrite = (replica: EpisodeReplica, message: EpisodeMessage): void => {
  const c = controlFor(replica);
  requireWrittenAcknowledgement(message);
  if (message.kind !== "turn-open-accepted" && message.kind !== "decision-accepted") return reject("permit");
  const permit = message.nextPermit;
  if (message.kind === "decision-accepted") {
    const latest = message.decisionId.side === c.execution.request.schedule.candidateSide ? c.candidate.at(-1) : c.opponent.at(-1);
    if (!latest || latest.decisionId.side !== message.decisionId.side || latest.decisionId.planningOrdinal !== message.decisionId.planningOrdinal) return reject("journal");
    c.ackCandidateCount = c.candidate.length; c.ackOpponentCount = c.opponent.length;
  }
  if (permit === null) return;
  if (!c.active || c.permit !== permit) return reject("permit");
  const entry = accepted.get(c.active)!;
  if (entry.status !== "planning") return reject("permit");
  entry.written = true;
};
export const acceptChildPlanPermit = (replica: EpisodeReplica, frame: RawEpisodeFrame): LocalAcceptedPermit | null => {
  const c = controlFor(replica);
  const message = requireDecodedEpisodeMessage(frame);
  if (acceptedAckFrames.has(frame)) return reject("permit");
  if (message.kind !== "turn-open-accepted" && message.kind !== "decision-accepted") return reject("permit");
  if (message.kind === "turn-open-accepted" && message.planningOrdinal !== c.session.planningOrdinal) return reject("permit");
  const permit = message.nextPermit;
  if (c.realm !== "child" || c.active || c.permit) return reject("permit");
  acceptedAckFrames.add(frame);
  if (permit === null) {
    if (c.stage !== "complete" && c.stage !== "settlement") return reject("permit");
    return null;
  }
  if (c.stage !== "planning" || nextSide(c) !== permit.side || permit.planningOrdinal !== c.session.planningOrdinal ||
    permit.turn !== c.session.snapshot.turn || permit.role !== roleFor(c, permit.side) ||
    permit.permitId !== `${c.execution.request.attemptId}:plan:${permit.planningOrdinal}:${permit.side}`) return reject("permit");
  const receipt = rawFrameReceipt(frame), token = freeze({}) as LocalAcceptedPermit;
  accepted.set(token, { replica, permit, deadline: receipt + 10000000000n, matchDeadline: c.matchDeadline!, status: "planning", receipt: null, admitted: false, written: true });
  c.active = token; c.permit = permit;
  return token;
};
export const authenticateAcceptedPermit = (token: unknown, claimAdmission = false, time = now()): Readonly<{
  replica: EpisodeReplica; permit: PlanPermit; binding: object; session: R3Session; sourceSeal: unknown; boundModels: unknown;
}> => {
  if (token === null || typeof token !== "object") return reject("permit");
  const entry = accepted.get(token);
  if (!entry) return reject("permit");
  const c = controlFor(entry.replica);
  if (!entry.written || c.active !== token || c.stage !== "planning" || c.permit !== entry.permit || entry.status !== "planning" && entry.status !== "verifying" ||
    entry.status === "planning" && time >= entry.deadline || entry.status === "verifying" && (entry.receipt === null || entry.receipt >= entry.deadline) ||
    time >= entry.matchDeadline || scOutcome(c.session.snapshot) || claimAdmission && entry.admitted) return reject("permit");
  if (claimAdmission) entry.admitted = true;
  return freeze({ replica: entry.replica, permit: entry.permit, binding: c.binding, session: c.session,
    sourceSeal: c.execution.sourceSeal, boundModels: c.execution.boundModels });
};
export const activeAcceptedPermit = (replica: EpisodeReplica): LocalAcceptedPermit => {
  const c = controlFor(replica);
  if (!c.active) return reject("permit");
  return c.active;
};
export const beginParentDecisionVerification = (replica: EpisodeReplica, message: DecisionResultMessage, frame: RawEpisodeFrame): LocalAcceptedPermit => {
  const c = controlFor(replica), token = activeAcceptedPermit(replica), entry = accepted.get(token)!;
  const receipt = rawFrameReceipt(frame);
  if (requireDecodedEpisodeMessage(frame) !== message) return reject("protocol");
  if (c.realm !== "parent" || entry.status !== "planning" || message.role !== entry.permit.role ||
    message.journalEntry.permitId !== entry.permit.permitId || message.journalEntry.decisionId.side !== entry.permit.side ||
    message.journalEntry.decisionId.planningOrdinal !== entry.permit.planningOrdinal) return reject("permit");
  if (receipt >= entry.matchDeadline) return reject("match-timeout");
  if (receipt >= entry.deadline) return reject(entry.permit.role === "candidate" ? "candidate-deadline" : "opponent");
  entry.status = "verifying"; entry.receipt = receipt;
  return token;
};
export const markChildDecisionSent = (replica: EpisodeReplica, message: DecisionResultMessage): void => {
  const c = controlFor(replica), token = activeAcceptedPermit(replica), entry = accepted.get(token)!;
  const permit = authenticateAcceptedPermit(token).permit;
  if (c.realm !== "child" || entry.status !== "planning" || permit.permitId !== message.journalEntry.permitId || permit.role !== message.role) return reject("permit");
  entry.status = "verifying"; entry.receipt = now();
};
const stageOwnQueue = (c: Control, side: Side, actions: readonly ScActionInput[]):
  { ok: true; staged: QueueStage } | { ok: false; stop: ChallengeStop } => {
  const open = c.session.snapshot;
  if ((open.queue?.actions.length ?? 0) !== 0) return reject("session");
  let snapshot = open, spend = 0;
  for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
    const action = actions[actionIndex]!;
    if (action.color !== side) return reject("codec");
    const cost = action.kind === "deploy" && action.unit ? UNIT_COST[action.unit] : 0;
    const base = { kind: "queue-rejected" as const, phase: "admission", planningOrdinal: c.session.planningOrdinal, turn: open.turn, side, actionIndex, action };
    if (spend + cost > c.session.bank[side]) return { ok: false, stop: { ...base, reason: "minerals", requiredMinerals: spend + cost, availableMinerals: c.session.bank[side] } };
    try { snapshot = addScAction({ snapshot, action }).snapshot; spend += cost; }
    catch (error) {
      if (!(error instanceof AddScActionError)) throw error;
      return { ok: false, stop: { ...base, reason: error.message, engineCode: error.code } };
    }
  }
  return { ok: true, staged: { side, intents: [...actions], spend, gasAfter: snapshot.gas[side] } };
};
const recomputations = privateMap<{ replica: EpisodeReplica; token: LocalAcceptedPermit; delta: readonly number[] | null }>();
export const reconstructStrategicDecision = (replica: EpisodeReplica): OppPrivateJournal => {
  const c = controlFor(replica), permit = authenticateAcceptedPermit(activeAcceptedPermit(replica)).permit;
  if (permit.role !== "strategic" || c.execution.request.schedule.suite !== "live-strategic") return reject("opponent");
  const before = snapshotEpisodeRng(c.enemy), cursor = restoreEpisodeRng(before), side = permit.side;
  const built = strategicCandidates(c.session.snapshot, { color: side, storedFor: seat => c.session.bank[seat], kvs: c.kvs.perSide[side],
    ccIntel: c.ccIntel.perSide[side], runnerMemory: c.runner.perSide[side], attackerMemory: c.attacker.perSide[side], rng: () => drawEpisodeRng(cursor) });
  let result: StrategicResult = { snapshot: c.session.snapshot };
  if (built) {
    if (built.candidates.length > EPISODE_LIMITS.maxProposals) return reject("opponent");
    for (const candidate of built.candidates) {
      const planned = applyCandidate(c.session.snapshot, candidate, built.us);
      if (planned) { result = planned; break; }
    }
  }
  const actions = (result.snapshot.queue?.actions ?? []).map(({ seq: _seq, ...action }) => freeze(action));
  let expectedSnapshot = c.session.snapshot;
  try { for (const action of actions) expectedSnapshot = addScAction({ snapshot: expectedSnapshot, action }).snapshot; }
  catch { return reject("opponent"); }
  if (actions.length > 65 || !isDeepStrictEqual(result.snapshot, expectedSnapshot)) return reject("opponent");
  const journalEntry = freeze({ decisionId: freeze({ planningOrdinal: permit.planningOrdinal, side }), permitId: permit.permitId, actions: freeze(actions),
    reportedMinSpend: result.spendMinerals?.amount ?? 0, opponentBefore: before, opponentAfter: snapshotEpisodeRng(cursor) });
  recomputations.set(journalEntry, { replica, token: activeAcceptedPermit(replica), delta: null });
  return journalEntry;
};
export const reconstructCandidateDecision = async (replica: EpisodeReplica): Promise<Readonly<{
  journalEntry: CompactSampleJournalEntry; scoreDelta: readonly number[];
}>> => {
  const c = controlFor(replica), token = activeAcceptedPermit(replica);
  if (authenticateAcceptedPermit(token).permit.role !== "candidate") return reject("permit");
  const scopeModule = await import("./planningScope");
  const adapter = await import("./economicAdapter");
  const scope = await scopeModule.openPlanningScope(token);
  try {
    const result: CandidatePipelineResult = adapter.executeCandidatePipeline(scope, c.execution.request, snapshotEpisodeRng(c.policy), c.execution.weights);
    scopeModule.recheckPlanningScope(scope);
    if (result.scoreDelta.length !== 418) return reject("gradient");
    for (const value of result.scoreDelta) if (!Number.isFinite(value)) return reject("gradient");
    scopeModule.closePlanningScope(scope);
    recomputations.set(result.journalEntry, { replica, token, delta: result.scoreDelta });
    return result;
  } catch (error) { scopeModule.abortPlanningScope(scope); throw error; }
};
export type CandidatePipelineResult = Readonly<{ journalEntry: CompactSampleJournalEntry; scoreDelta: readonly number[] }>;
export const acceptVerifiedDecision = (replica: EpisodeReplica, claimed: DecisionResultMessage,
  reconstructed: OppPrivateJournal | CompactSampleJournalEntry, delta: readonly number[] | null): void => {
  const c = controlFor(replica), token = activeAcceptedPermit(replica), entry = accepted.get(token)!;
  authenticateAcceptedPermit(token);
  const computed = recomputations.get(reconstructed);
  if (!computed || computed.replica !== replica || computed.token !== token || computed.delta !== delta) return reject("journal");
  const expected: DecisionResultMessage = claimed.role === "candidate" ? { ...header(c, "decision-result", claimed.messageOrdinal), role: "candidate", journalEntry: reconstructed as CompactSampleJournalEntry } :
    { ...header(c, "decision-result", claimed.messageOrdinal), role: "strategic", journalEntry: reconstructed as OppPrivateJournal };
  if (!encodeEpisodeMessage(claimed).equals(encodeEpisodeMessage(expected))) return reject("journal");
  const item = expected.journalEntry;
  if (item.permitId !== entry.permit.permitId || item.decisionId.side !== entry.permit.side || item.decisionId.planningOrdinal !== entry.permit.planningOrdinal) return reject("permit");
  if (claimed.role === "candidate") {
    const sample = item as CompactSampleJournalEntry;
    if (!delta || delta.length !== 418 || !equalEpisodeStreamStates(sample.samplingBefore, snapshotEpisodeRng(c.policy))) return reject("rng");
    const cursor = restoreEpisodeRng(sample.samplingBefore as never);
    if (encodeOwnedNumber(drawEpisodeRng(cursor)).hex !== sample.uniform.hex || !equalEpisodeStreamStates(sample.samplingAfter, snapshotEpisodeRng(cursor))) return reject("rng");
    for (let i = 0; i < 418; i++) if (!Number.isFinite(c.accumulator[i]! + delta[i]!)) return reject("gradient");
    journal(c, expected);
    for (let i = 0; i < 418; i++) c.accumulator[i] += delta[i]!;
    c.policy = restoreEpisodeRng(sample.samplingAfter as never); c.candidate.push(sample);
  } else {
    const reply = item as OppPrivateJournal;
    if (delta || !equalEpisodeStreamStates(reply.opponentBefore, snapshotEpisodeRng(c.enemy))) return reject("rng");
    journal(c, expected); c.enemy = restoreEpisodeRng(reply.opponentAfter as never); c.opponent.push(reply);
  }
  recomputations.delete(reconstructed);
  entry.status = "accepted"; c.active = null; c.permit = null;
  const staged = stageOwnQueue(c, item.decisionId.side, item.actions);
  if (!staged.ok) {
    if (claimed.role !== "candidate") return reject("opponent");
    establishStop(replica, staged.stop, "native", "candidate-native-rejection");
  } else {
    if (claimed.role === "strategic" && staged.staged.spend !== (item as OppPrivateJournal).reportedMinSpend) return reject("opponent");
    c.pair[item.decisionId.side] = staged.staged;
    if (nextSide(c) === null) c.stage = "settlement";
  }
  if (c.realm === "child") { c.ackCandidateCount = c.candidate.length; c.ackOpponentCount = c.opponent.length; }
};
export const expectedSettlementMessage = (replica: EpisodeReplica, ordinal: number): SettlementMessage => {
  const c = controlFor(replica);
  if (c.stage !== "settlement" || !c.pair.w || !c.pair.b) return reject("protocol");
  const transition = stageR3Settlement(c.binding, c.session, { w: c.pair.w, b: c.pair.b }); c.transition = transition;
  return nativeProduction({ ...header(c, "settlement", ordinal), planningOrdinal: c.session.planningOrdinal,
    end: transition.companion.nativeResult as SettlementMessage["end"], bank: bankAfter(c, transition),
    publicBatch: transition.batches[c.execution.request.schedule.candidateSide], privateProvenanceDigest: physicalRef(transition.provenanceBytes) },
  freeze({ companion: transition.companion, bank: bankAfter(c, transition), batches: transition.batches }), c, transition);
};
const id = (item: { decisionId: DecisionId }): DecisionId => item.decisionId;
const evidence = (c: Control): ReturnType<typeof physicalRef> => physicalRef(Buffer.concat(c.journal, c.journalSize));
const establishStop = (replica: EpisodeReplica, stop: ChallengeStop, origin: StopProof["origin"], reason: StopReason): StopProof => {
  const c = controlFor(replica);
  if (c.stop) return reject("protocol");
  c.stop = freeze({ stop: freeze(stop), origin, reason, checkedBoundaryOrdinal: c.session.recipients.w.batch.ordinal,
    acceptedCandidateCount: c.candidate.length, evidenceRef: evidence(c) });
  c.stage = "complete";
  return c.stop;
};
export const expectedCompleteMessage = (replica: EpisodeReplica, ordinal: number): CompleteMessage => {
  const c = controlFor(replica);
  if (c.stage !== "complete") return reject("protocol");
  if (c.ackCandidateCount !== c.candidate.length || c.ackOpponentCount !== c.opponent.length) return reject("journal");
  if (!c.stop) {
    if (!scOutcome(c.session.snapshot)) return reject("forged-progress");
    establishStop(replica, { kind: "terminal", phase: "terminal", planningOrdinal: c.session.planningOrdinal, turn: c.session.snapshot.turn }, "native", "core-terminal");
  }
  return freeze({ ...header(c, "complete", ordinal), acceptedCandidateDecisionIds: freeze(c.candidate.map(id)), acceptedOpponentDecisionIds: freeze(c.opponent.map(id)),
    scoreAccumulator: freeze(c.accumulator.map(encodeOwnedNumber)) as EpisodeScoreAccumulator,
    rngSummaries: constructEpisodeStartStreams(c.execution.request.streams.selection, c.execution.request.streams["environment-settlement"],
      snapshotEpisodeRng(c.policy), snapshotEpisodeRng(c.enemy)), stopProof: c.stop! });
};
export type VerifiedEpisodeOutcome = Readonly<{
  classification: "native" | "candidate-deadline" | "infrastructure"; reason: StopReason; reward: -1 | 0 | 1 | null;
  eligible: boolean; acceptedCandidateCount: number; complete: CompleteMessage | null;
}>;
export const verifyCompleteMessage = (replica: EpisodeReplica, claimed: CompleteMessage): VerifiedEpisodeOutcome => {
  const c = controlFor(replica), expected = expectedCompleteMessage(replica, claimed.messageOrdinal);
  if (!encodeEpisodeMessage(claimed).equals(encodeEpisodeMessage(expected))) return reject("forged-progress");
  checkReplicaMatchDeadline(replica);
  const proof = expected.stopProof;
  let reward: -1 | 0 | 1;
  if (proof.reason === "core-terminal") {
    const outcome = scOutcome(c.session.snapshot);
    if (!outcome) return reject("forged-progress");
    reward = outcome.draw ? 0 : outcome.winner === c.execution.request.schedule.candidateSide ? 1 : -1;
  } else if (proof.reason === "candidate-native-rejection" || proof.reason === "recorded-white-rejection" || proof.reason === "trace-exhaustion" || proof.reason === "progress-cap") reward = -1;
  else return reject("forged-progress");
  c.stage = "closed";
  return freeze({ classification: "native", reason: proof.reason, reward, eligible: c.candidate.length > 0, acceptedCandidateCount: c.candidate.length, complete: expected });
};
export const stopSupervisedReplica = (replica: EpisodeReplica, reason: StopReason, time = now()): VerifiedEpisodeOutcome => {
  const c = controlFor(replica), entry = c.active && accepted.get(c.active);
  const proved = reason === "candidate-deadline" && entry && entry.written && entry.permit.role === "candidate" && entry.status === "planning" && time >= entry.deadline &&
    (c.matchDeadline === null || entry.deadline < c.matchDeadline);
  if (entry) entry.status = "revoked";
  c.active = null; c.permit = null;
  if (reason === "candidate-deadline" && !proved) reason = "unattributed-timeout";
  const complete = proved ? (establishStop(replica, { kind: "watchdog", phase: "planning", planningOrdinal: c.session.planningOrdinal, turn: c.session.snapshot.turn,
    side: entry!.permit.side }, "candidate-deadline", "candidate-deadline"), expectedCompleteMessage(replica, 0)) : null;
  c.stage = "closed";
  return freeze({ classification: proved ? "candidate-deadline" : "infrastructure", reason, reward: proved ? -1 : null,
    eligible: !!proved && c.ackCandidateCount > 0, acceptedCandidateCount: c.ackCandidateCount, complete });
};
export const prepareChildPlanning = async (replica: EpisodeReplica): Promise<void> => {
  const c = controlFor(replica);
  if (c.realm !== "child" || c.stage !== "planning") return reject("protocol");
  if (c.plies >= 128) {
    establishStop(replica, { kind: "progress-limit", phase: "planning", planningOrdinal: c.session.planningOrdinal, turn: c.session.snapshot.turn }, "native", "progress-cap");
    return;
  }
  await checkPlanningStartupBindings(replica);
  if (c.execution.request.schedule.suite === "corpus") {
    const startup = await import("./startupScope");
    const actions = startup.readBoundCorpusWhite(c.execution.boundModels, c.execution.request, c.session.planningOrdinal);
    if (actions === null) {
      establishStop(replica, { kind: "trace-exhausted", phase: "planning", planningOrdinal: c.session.planningOrdinal, turn: c.session.snapshot.turn }, "recorded-white", "trace-exhaustion"); return;
    }
    const staged = stageOwnQueue(c, "w", actions);
    if (!staged.ok) { establishStop(replica, staged.stop, "recorded-white", "recorded-white-rejection"); return; }
    c.pair.w = staged.staged;
  }
};
export const prepareNextNativeWindow = (replica: EpisodeReplica): void => {
  const c = controlFor(replica);
  if (c.stage === "begin" && (c.session.planningOrdinal >= 64 || c.plies >= 128)) {
    establishStop(replica, { kind: "progress-limit", phase: "planning", planningOrdinal: c.session.planningOrdinal, turn: c.session.snapshot.turn }, "native", "progress-cap");
  }
};
