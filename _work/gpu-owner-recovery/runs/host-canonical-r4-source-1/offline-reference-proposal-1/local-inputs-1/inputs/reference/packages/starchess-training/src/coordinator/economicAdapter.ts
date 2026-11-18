// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { createHash } from "node:crypto";
import { types } from "node:util";
import type { CandidateBatchV3, CandidateDiagnostics } from "../contracts";
import { composeCandidatesFromHistoryV2 } from "../candidates";
import type { Candidate, CheckedBoundary, History, Meter, Side, Square, AuthorizedSnapshotV2 } from "../economic/contracts";
import {
  abortPlanningWork, requirePlanningMeter, consumeWorkBlock, rejectPlanningWork, requireCandidate, requireHistory,
  requireFloat64Hex, constructRef, snapshotFixedBytes, completeBoundaryBatchBytes, encodeOwnedBoundaryBatch, encodeOwnedHistory,
  makePiece, makeUnknownCell, makeLitCell, makeRevealedCell, makeSighting, makeOwnPiece, makeOwnUnit, makeOwnMine,
  makeActionRef, makeMaterializedDisposition, makeUnmaterializedDisposition, makePaidReceipt, makeEnemyLoss,
  makeEconomicLedger, makeOwnState, makeSnapshotV2, makeHistory, makeMineAudit, makeBoundary, makeBoundaryBatch,
  beginCells64, appendCells64, finishCells64, beginChanges64, appendChanges64, finishChanges64,
  beginMemory64, appendMemory64, finishMemory64, beginOwnPieces64, appendOwnPieces64, finishOwnPieces64,
  beginOwnUnits64, appendOwnUnits64, finishOwnUnits64, beginOwnMines3, appendOwnMines3, finishOwnMines3,
  beginReceipts64, appendReceipts64, finishReceipts64, beginSquareSet64, appendSquareSet64, finishSquareSet64,
  beginRetiredOwnIds128, appendRetiredOwnIds128, finishRetiredOwnIds128,
  beginRetiredMineIds195, appendRetiredMineIds195, finishRetiredMineIds195,
  beginEvents2048, appendEvents2048, finishEvents2048, beginActions65, appendActions65, finishActions65,
  makeOwnPaidReceiptEvent, makeOwnGasDebitedEvent, makeOwnUnitEndowedEvent, makeOwnUnitCreatedEvent,
  makeOwnDeploymentUnmaterializedEvent, makeOwnUnitMovedEvent, makeOwnUnitTransformedEvent,
  makeOwnUnitModeChangedEvent, makeOwnUnitDestroyedEvent, makeOwnMineEndowedEvent, makeOwnMineCreatedEvent,
  makeOwnMineRemovedEvent, makeOwnIncomeEvent, makeOwnCCLivesChangedEvent, makeEnemyUnitDestructionWitnessedEvent,
  makeVisionWitnessEvent, makeClassicalAction, makeDeployAction, makeStimStepAction, makeSpiderMineAction,
  makeCharonMissilesAction, makeSiegeModeAction, makeTacticalJumpAction, makeCandidate,
  type Piece, type Event, type Ledger, type OwnedCursor,
} from "../economic/ownedKernel";
import { advanceEconomicState, encodeFeaturesV3, flattenFeaturesV3, initializeEconomicState, readoutEconomic } from "../features";
import { decodeOwnedNumber, encodeOwnedNumber, equalOwnedRefs } from "../economic/ownedScalars";
import { drawEpisodeRng, restoreEpisodeRng, snapshotEpisodeRng, requireActiveStreamState, checkPersistentEpisodeStream, deriveEpisodeRoot } from "./episodeRng";
import { requireEpisodeRequest } from "./episodeRequest";
import type { ActiveStreamState, CompactSampleJournalEntry, OriginalEpisodeRequestV2 } from "./episodeContracts";
import {
  readPlanningBindings, generatePlanningCandidates, hostedInitializeEconomicState, hostedAdvanceEconomicState,
  hostedReadoutEconomic, hostedEncodeFeaturesV3, hostedFlattenFeaturesV3, recheckPlanningScope, abortPlanningScope,
  type PrivateHostedScope,
} from "./planningScope";
import { EpisodeVerificationError } from "./episodeVerification";
import { requireBoundPlanningConfiguration } from "./startupScope";

export type OwnedPlanningInput = Readonly<{ history: History; boundary: CheckedBoundary }>;
export type CandidatePipelineResult = Readonly<{ journalEntry: CompactSampleJournalEntry; scoreDelta: readonly number[] }>;
const freeze = Object.freeze, descriptor = Object.getOwnPropertyDescriptor, isProxy = types.isProxy;
const batchRecords = new WeakMap<object, { history: History; historyDigest: ReturnType<typeof constructRef>; keysDigest: ReturnType<typeof constructRef>; consumed: boolean }>();
const batchLookup = WeakMap.prototype.get.bind(batchRecords), batchPublish = WeakMap.prototype.set.bind(batchRecords);
const pay = (meter: Meter, units: number): void => consumeWorkBlock(meter, "scalar", units, "$.adapter");
const fail = (code: string): never => rejectPlanningWork("$.adapter", code);
const digest = (bytes: Uint8Array) => constructRef(bytes.length, createHash("sha256").update(bytes).digest("hex"));
const field = <T>(meter: Meter, value: unknown, key: string, optional = false): T => {
  pay(meter, 128);
  if (value === null || typeof value !== "object" || isProxy(value)) return fail("PROVENANCE");
  const d = descriptor(value, key);
  if (!d && optional) return undefined as T;
  if (!d || !("value" in d) || !d.enumerable && key !== "length") return fail("SCHEMA");
  return d.value as T;
};
const length = (meter: Meter, value: unknown, maximum: number): number => {
  const n = field<unknown>(meter, value, "length");
  if (!Array.isArray(value) || typeof n !== "number" || !Number.isSafeInteger(n) || n < 0 || n > maximum || Object.is(n, -0)) return fail("CARDINALITY");
  return n;
};
const version = (meter: Meter, value: unknown, expected: string): void => {
  if (field(meter, value, "version") !== expected) fail("VERSION");
};

export const reconstructEconomicInput = (input: unknown, meter: Meter): OwnedPlanningInput => {
  requirePlanningMeter(meter);
  try {
    const f = <T>(v: unknown, key: string): T => field<T>(meter, v, key);
    const list = <T>(v: unknown, maximum: number, begin: () => OwnedCursor<T>, append: (cursor: OwnedCursor<T>, value: T) => void,
      finish: (cursor: OwnedCursor<T>) => readonly T[], copy: (v: unknown) => T): readonly T[] => {
      const n = length(meter, v, maximum), cursor = begin();
      for (let i = 0; i < n; i++) append(cursor, copy(f(v, `${i}`)));
      return finish(cursor);
    };
    const piece = (v: unknown): Piece => makePiece(meter, f(v, "type"), f(v, "color"));
    const cell = (v: unknown): AuthorizedSnapshotV2["cells"][number] => {
      const square = f<Square>(v, "square"), visibility = f(v, "visibility");
      if (visibility === "unknown") return makeUnknownCell(meter, square);
      const raw = f(v, "piece"), p = raw === null ? null : piece(raw);
      if (visibility === "lit") return makeLitCell(meter, square, p);
      if (visibility !== "revealed" || p === null) return fail("SCHEMA");
      return makeRevealedCell(meter, square, p, p.color === "w" ? "b" : "w");
    };
    const cells = (v: unknown, changes = false) => changes ? list(v, 64, () => beginChanges64(meter), (c, x) => appendChanges64(meter, c, x), c => finishChanges64(meter, c), cell) :
      list(v, 64, () => beginCells64(meter), (c, x) => appendCells64(meter, c, x), c => finishCells64(meter, c), cell);
    const squares = (v: unknown) => list(v, 64, () => beginSquareSet64(meter), (c, x) => appendSquareSet64(meter, c, x), c => finishSquareSet64(meter, c), v => v as Square);
    const mines = (v: unknown) => list(v, 3, () => beginOwnMines3(meter), (c, x) => appendOwnMines3(meter, c, x), c => finishOwnMines3(meter, c),
      v => makeOwnMine(meter, f(v, "mineId"), f(v, "square")));
    const actionRef = (v: unknown) => makeActionRef(meter, f(v, "planningOrdinal"), f(v, "acceptedActionOrdinal"));
    const ledgers = new WeakMap<object, Ledger>(), snapshots = new WeakMap<object, AuthorizedSnapshotV2>();
    const ledger = (v: unknown): Ledger => {
      pay(meter, 64);
      if (v === null || typeof v !== "object" || isProxy(v)) return fail("PROVENANCE");
      const cached = ledgers.get(v); if (cached) return cached;
      version(meter, v, "challenge-economic-ledger-v1"); const side = f<Side>(v, "side");
      const enemy = f(v, "enemyLoss");
      if (f(enemy, "paidLowerBound") !== 0 || f(enemy, "upper") !== "unknown" || f(enemy, "completeness") !== "witnessed-only") return fail("SCHEMA");
      const loss = makeEnemyLoss(meter, f(enemy, "confirmedUnitCount"), f(enemy, "replacementLowerBound"));
      const receipts = list(f(v, "receipts"), 64, () => beginReceipts64(meter), (c, x) => appendReceipts64(meter, c, x), c => finishReceipts64(meter, c), r => {
        const d = f(r, "disposition"), kind = f(d, "kind");
        const disposition = kind === "materialized" ? makeMaterializedDisposition(meter, f(d, "lineageId")) :
          kind === "unmaterialized" ? makeUnmaterializedDisposition(meter) : fail("SCHEMA");
        return makePaidReceipt(meter, f(r, "receiptId"), actionRef(f(r, "actionRef")), f(r, "unit"), f(r, "requestedSquare"), f(r, "minerals"), disposition);
      });
      const retired = list(f(v, "retiredOwnIds"), 128, () => beginRetiredOwnIds128(meter, side), (c, x) => appendRetiredOwnIds128(meter, c, x), c => finishRetiredOwnIds128(meter, c), v => v as string);
      const result = makeEconomicLedger(meter, side, f(v, "ownPaidDebits"), f(v, "ownPaidSurviving"), f(v, "ownPaidDestroyed"), f(v, "ownPaidWasted"), f(v, "ownReplacementDestroyed"), loss, receipts, retired);
      ledgers.set(v, result); return result;
    };
    const snapshot = (v: unknown): AuthorizedSnapshotV2 => {
      pay(meter, 64);
      if (v === null || typeof v !== "object" || isProxy(v)) return fail("PROVENANCE");
      const cached = snapshots.get(v); if (cached) return cached;
      version(meter, v, "challenge-observation-v2");
      const own = f(v, "own"), ownPieces = list(f(own, "pieces"), 64, () => beginOwnPieces64(meter), (c, x) => appendOwnPieces64(meter, c, x), c => finishOwnPieces64(meter, c),
        v => makeOwnPiece(meter, f(v, "square"), piece(f(v, "piece"))));
      const state = makeOwnState(meter, f(own, "minerals"), f(own, "gas"), f(own, "gasIncome"), f(own, "ccLives"), ownPieces, squares(f(own, "mines")), squares(f(own, "siegedTanks")));
      const observed = cells(f(v, "cells")), memory = list(f(v, "memory"), 64, () => beginMemory64(meter), (c, x) => appendMemory64(meter, c, x), c => finishMemory64(meter, c),
        v => makeSighting(meter, f(v, "square"), piece(f(v, "piece")), f(v, "observedTurn")));
      const units = list(f(v, "ownUnitLineage"), 64, () => beginOwnUnits64(meter), (c, x) => appendOwnUnits64(meter, c, x), c => finishOwnUnits64(meter, c),
        v => makeOwnUnit(meter, f(v, "id"), f(v, "square"), f(v, "type"), f(v, "paidBasis"), f(v, "replacementValue")));
      const result = makeSnapshotV2(meter, f(v, "side"), f(v, "turn"), state, observed, memory, units, mines(f(v, "ownMineLineage")), ledger(f(v, "economicState")));
      snapshots.set(v, result); return result;
    };
    const event = (v: unknown): Event => {
      const kind = f(v, "kind"), seq = f<number>(v, "seq");
      switch (kind) {
        case "own-paid-receipt": return makeOwnPaidReceiptEvent(meter, seq, f(v, "receiptId"), actionRef(f(v, "actionRef")), f(v, "unit"), f(v, "requestedSquare"), f(v, "minerals"));
        case "own-gas-debited": return makeOwnGasDebitedEvent(meter, seq, actionRef(f(v, "actionRef")), f(v, "gas"));
        case "own-unit-endowed": if (f(v, "paidBasis") !== 0) return fail("SCHEMA"); return makeOwnUnitEndowedEvent(meter, seq, f(v, "id"), f(v, "square"), f(v, "type"));
        case "own-unit-created": return makeOwnUnitCreatedEvent(meter, seq, f(v, "lineageId"), f(v, "receiptId"), f(v, "square"), f(v, "type"));
        case "own-deployment-unmaterialized": return makeOwnDeploymentUnmaterializedEvent(meter, seq, f(v, "receiptId"), f(v, "paidMinerals"));
        case "own-unit-moved": return makeOwnUnitMovedEvent(meter, seq, f(v, "id"), f(v, "from"), f(v, "to"));
        case "own-unit-transformed": if (f(v, "paidDelta") !== 0) return fail("SCHEMA"); return makeOwnUnitTransformedEvent(meter, seq, f(v, "id"), f(v, "fromType"), f(v, "toType"));
        case "own-unit-mode-changed": return makeOwnUnitModeChangedEvent(meter, seq, f(v, "id"), f(v, "mode"));
        case "own-unit-destroyed": return makeOwnUnitDestroyedEvent(meter, seq, f(v, "id"), f(v, "typeAtLoss"), f(v, "square"), f(v, "retiredPaidBasis"));
        case "own-mine-endowed": if (f(v, "actionRef") !== null) return fail("SCHEMA"); return makeOwnMineEndowedEvent(meter, seq, f(v, "mineId"), f(v, "square"));
        case "own-mine-created": return makeOwnMineCreatedEvent(meter, seq, f(v, "mineId"), actionRef(f(v, "actionRef")), f(v, "square"));
        case "own-mine-removed": return makeOwnMineRemovedEvent(meter, seq, f(v, "mineId"));
        case "own-income": return makeOwnIncomeEvent(meter, seq, f(v, "actualCreditedMinerals"));
        case "own-cc-lives-changed": return makeOwnCCLivesChangedEvent(meter, seq, f(v, "before"), f(v, "after"));
        case "enemy-unit-destruction-witnessed": if (f(v, "paidLowerBound") !== 0) return fail("SCHEMA"); return makeEnemyUnitDestructionWitnessedEvent(meter, seq, f(v, "witnessId"), f(v, "square"), f(v, "type"), f(v, "replacementLowerBound"));
        case "vision-witness": return makeVisionWitnessEvent(meter, seq, f(v, "turn"), cells(f(v, "changes"), true));
        default: return fail("SCHEMA");
      }
    };
    const rawBatch = f(input, "batch"), rawBoundary = f(input, "boundary"), rawHistory = f(input, "history");
    version(meter, rawBatch, "challenge-boundary-batch-v1"); version(meter, rawHistory, "challenge-history-v2");
    const events = list(f(rawBatch, "events"), 2048, () => beginEvents2048(meter), (c, x) => appendEvents2048(meter, c, x), c => finishEvents2048(meter, c), event);
    const batch = makeBoundaryBatch(meter, f(rawBatch, "side"), f(rawBatch, "ordinal"), f(rawBatch, "phase"), f(rawBatch, "turn"), f(rawBatch, "planningOrdinal"), f(rawBatch, "seqBefore"), f(rawBatch, "seqThrough"), events, snapshot(f(rawBatch, "snapshot")));
    const byteLength = f<unknown>(input, "batchByteLength");
    if (typeof byteLength !== "number" || !Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > 1048576 || Object.is(byteLength, -0)) return fail("BYTES");
    const read = f<(i: number) => number>(input, "readBatchByte"); if (typeof read !== "function") return fail("PROVENANCE");
    pay(meter, 512 + 16 * byteLength); const source = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i++) {
      const value = read(i); if (!Number.isInteger(value) || value < 0 || value > 255) return fail("BYTES"); source[i] = value;
    }
    const bytes = snapshotFixedBytes(source, "boundaryBatch", meter), canonical = encodeOwnedBoundaryBatch(meter, batch);
    if (canonical.length !== byteLength) return fail("CANONICAL");
    pay(meter, 128 + 8 * byteLength);
    for (let i = 0; i < byteLength; i++) if (canonical[i] !== source[i]) return fail("CANONICAL");
    const verified = completeBoundaryBatchBytes(meter, bytes, batch), boundarySnapshot = snapshot(f(rawBoundary, "snapshot")), audit = f(rawBoundary, "ownMineAuditState");
    const retired = list(f(audit, "retiredOwnMineIdsSorted"), 195, () => beginRetiredMineIds195(meter, batch.side), (c, x) => appendRetiredMineIds195(meter, c, x), c => finishRetiredMineIds195(meter, c), v => v as string);
    const mineAudit = makeMineAudit(meter, mines(f(audit, "liveOwnMines")), retired, f(audit, "ownMineCreationCounter"));
    const boundary = makeBoundary(meter, boundarySnapshot, ledger(f(rawBoundary, "economicState")), mineAudit, squares(f(rawBoundary, "everLit")), f(rawBoundary, "ordinal"), f(rawBoundary, "phase"), f(rawBoundary, "planningOrdinal"), f(rawBoundary, "seqThrough"), verified);
    const history = makeHistory(meter, snapshot(f(rawHistory, "currentAuthorizedSnapshotV2")), ledger(f(rawHistory, "economicState")), squares(f(rawHistory, "everLit")));
    const boundaryHistory = makeHistory(meter, boundary.snapshot, boundary.economicState, boundary.everLit);
    const actual = encodeOwnedHistory(meter, history), expected = encodeOwnedHistory(meter, boundaryHistory);
    pay(meter, 128 + 8 * actual.length);
    if (actual.length !== expected.length) return fail("CONSISTENCY");
    for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) return fail("CONSISTENCY");
    return freeze({ history, boundary });
  } catch (error) { try { abortPlanningWork(meter); } catch { } throw error; }
};

const copyAction = (meter: Meter, raw: unknown) => {
  const f = <T>(key: string, optional = false): T => field<T>(meter, raw, key, optional);
  const kind = f("kind"), timing = f<"B" | "F">("timing"), side = f<Side>("color"), from = f<Square>("from");
  switch (kind) {
    case "classical": if ((timing as string) !== "C") return fail("SCHEMA"); return makeClassicalAction(meter, side, from, f("to"), f("promotion", true));
    case "deploy": return makeDeployAction(meter, timing, side, from, f("to"), f("unit"));
    case "stimStep": return makeStimStepAction(meter, timing, side, from, f("to"), f("promotion", true));
    case "spiderMine": return makeSpiderMineAction(meter, timing, side, from, f("to", true));
    case "charonMissiles": return makeCharonMissilesAction(meter, timing, side, from, f("to"));
    case "siegeMode": return makeSiegeModeAction(meter, timing, side, from, f("to", true));
    case "tacticalJump": return makeTacticalJumpAction(meter, timing, side, from, f("to"));
    default: return fail("SCHEMA");
  }
};
const KINDS = freeze(["classical", "deploy", "stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump"] as const);
const PRUNING = freeze(["actor", "shape", "timing", "resources", "mineCap", "ownOccupancy"] as const);
const copyDiagnostics = (meter: Meter, raw: unknown, expected: CandidateDiagnostics): CandidateDiagnostics => {
  const scalar = <T>(v: unknown, key: string, e: T): T => { const actual = field<T>(meter, v, key); if (actual !== e) return fail("PROVENANCE"); return actual; };
  const record = <K extends string>(v: unknown, keys: readonly K[], e: Readonly<Record<K, number>>): Readonly<Record<K, number>> => {
    const result = Object.create(null) as Record<K, number>;
    for (const key of keys) result[key] = scalar(v, key, e[key]); return freeze(result);
  };
  const strings = <T extends string>(v: unknown, e: readonly T[]): readonly T[] => {
    if (length(meter, v, 8) !== e.length) return fail("PROVENANCE");
    const result: T[] = []; for (let i = 0; i < e.length; i++) result.push(scalar(v, `${i}`, e[i]!)); return freeze(result);
  };
  const rawPools = field(meter, raw, "pools"); if (length(meter, rawPools, 8) !== expected.pools.length) return fail("PROVENANCE");
  const pools = expected.pools.map((e, i) => { const v = field(meter, rawPools, `${i}`); return freeze({ id: scalar(v, "id", e.id), initialCapacity: scalar(v, "initialCapacity", e.initialCapacity),
    finalCapacity: scalar(v, "finalCapacity", e.finalCapacity), retained: scalar(v, "retained", e.retained), exhausted: scalar(v, "exhausted", e.exhausted) }); });
  return freeze({ profile: scalar(raw, "profile", expected.profile), attemptedExtensions: scalar(raw, "attemptedExtensions", expected.attemptedExtensions),
    uniqueIncludingPass: scalar(raw, "uniqueIncludingPass", expected.uniqueIncludingPass), retainedNonPass: scalar(raw, "retainedNonPass", expected.retainedNonPass),
    duplicates: scalar(raw, "duplicates", expected.duplicates), ownerSkipped: scalar(raw, "ownerSkipped", expected.ownerSkipped), quotaSkipped: scalar(raw, "quotaSkipped", expected.quotaSkipped),
    pruned: record(field(meter, raw, "pruned"), PRUNING, expected.pruned), activeFamilies: strings(field(meter, raw, "activeFamilies"), expected.activeFamilies),
    exhaustedLanes: strings(field(meter, raw, "exhaustedLanes"), expected.exhaustedLanes), pools: freeze(pools),
    retainedByOwner: record(field(meter, raw, "retainedByOwner"), KINDS, expected.retainedByOwner), retainedByLength: record(field(meter, raw, "retainedByLength"), ["1", "2", "3", "4"], expected.retainedByLength),
    attemptCapReached: scalar(raw, "attemptCapReached", expected.attemptCapReached), capacityCapReached: scalar(raw, "capacityCapReached", expected.capacityCapReached), stopReason: scalar(raw, "stopReason", expected.stopReason) });
};
export const constructOwnedGeneratedBatch = (historyValue: History, generated: CandidateBatchV3, meter: Meter): CandidateBatchV3 => {
  requirePlanningMeter(meter);
  try {
    const history = requireHistory(historyValue), expected = composeCandidatesFromHistoryV2(history);
    version(meter, generated, "challenge-composition-v3"); const raw = field(meter, generated, "candidates"), n = length(meter, raw, 512);
    if (n < 1 || n !== expected.candidates.length) return fail("NONMEMBER");
    pay(meter, 32768 + 418 * 1536 + n * (512 + 2 * 418 * 32) + 418 * 32);
    const candidates: Candidate[] = [];
    for (let i = 0; i < n; i++) {
      const v = field(meter, raw, `${i}`); version(meter, v, "challenge-candidate-codec-v1");
      const actions = field(meter, v, "actions"), count = length(meter, actions, 4), cursor = beginActions65(meter);
      for (let j = 0; j < count; j++) appendActions65(meter, cursor, copyAction(meter, field(meter, actions, `${j}`)));
      const candidate = makeCandidate(meter, history.currentAuthorizedSnapshotV2.side, finishActions65(meter, cursor)), e = expected.candidates[i]!, spend = field(meter, v, "ownSpend");
      pay(meter, 512 + 8 * candidate.key.length);
      if (candidate.key !== field(meter, v, "key") || candidate.key !== e.key || candidate.ownSpend.minerals !== field(meter, spend, "minerals") ||
        candidate.ownSpend.gas !== field(meter, spend, "gas") || candidate.ownSpend.minerals !== e.ownSpend.minerals || candidate.ownSpend.gas !== e.ownSpend.gas) return fail("NONMEMBER");
      candidates.push(candidate);
    }
    const diagnostics = copyDiagnostics(meter, field(meter, generated, "diagnostics"), expected.diagnostics);
    const historyBytes = encodeOwnedHistory(meter, history); pay(meter, 512 + 48 * historyBytes.length);
    let keyLength = 2;
    for (const candidate of candidates) { pay(meter, 128 + 8 * candidate.key.length); keyLength += 3 + candidate.key.length * 2; }
    pay(meter, 512 + 64 * keyLength); const parts = ["["];
    for (let i = 0; i < n; i++) {
      if (i !== 0) parts.push(","); parts.push('"');
      for (const character of candidates[i]!.key) parts.push(character === '"' || character === "\\" ? `\\${character}` : character);
      parts.push('"');
    }
    parts.push("]"); const keyBytes = new TextEncoder().encode(parts.join(""));
    const result = freeze({ version: expected.version, candidates: freeze(candidates), diagnostics });
    batchPublish(result, { history, historyDigest: digest(historyBytes), keysDigest: digest(keyBytes), consumed: false }); return result;
  } catch (error) { try { abortPlanningWork(meter); } catch { } throw error; }
};

export const executeCandidatePipeline = (scope: PrivateHostedScope, requestValue: OriginalEpisodeRequestV2, startValue: ActiveStreamState,
  weightsValue: readonly { hex: string }[]): CandidatePipelineResult => {
  try {
    const bindings = readPlanningBindings(scope), request = requireEpisodeRequest(requestValue);
    const history = requireHistory(bindings.history), manifestDigest = requireBoundPlanningConfiguration(request, bindings.artifact, bindings.manifest);
    let state = bindings.state;
    if (state === null) {
      state = hostedInitializeEconomicState(scope, bindings.opening, bindings.boundaries[0]!, bindings.artifact);
      for (let i = 1; i < bindings.boundaries.length; i++) state = hostedAdvanceEconomicState(scope, state, bindings.boundaries[i]!, bindings.artifact);
    }
    const batch = generatePlanningCandidates(scope), receipt = batchLookup(batch);
    if (!receipt || receipt.history !== history || receipt.consumed) throw new EpisodeVerificationError("identity");
    receipt.consumed = true;
    const start = requireActiveStreamState(startValue); checkPersistentEpisodeStream(start, deriveEpisodeRoot(request.master, "policy-sampling"));
    if (weightsValue === null || typeof weightsValue !== "object" || isProxy(weightsValue) || !Array.isArray(weightsValue) || !Object.isFrozen(weightsValue) || descriptor(weightsValue, "length")?.value !== 418) throw new EpisodeVerificationError("provenance");
    const weights = new Float64Array(418), weightParts = ["["];
    for (let j = 0; j < 418; j++) {
      const d = descriptor(weightsValue, `${j}`); if (!d || !("value" in d)) throw new EpisodeVerificationError("provenance");
      const h = requireFloat64Hex(d.value); weights[j] = decodeOwnedNumber(h);
      if (j !== 0) weightParts.push(","); weightParts.push('{"hex":"', h.hex, '"}');
    }
    weightParts.push("]");
    if (!equalOwnedRefs(digest(new TextEncoder().encode(weightParts.join(""))), request.weightsRef)) throw new EpisodeVerificationError("identity");
    const last = bindings.boundaries[bindings.boundaries.length - 1]!;
    if (history.currentAuthorizedSnapshotV2.side !== request.schedule.candidateSide || last.phase !== "turn-open") throw new EpisodeVerificationError("identity");
    hostedReadoutEconomic(scope, history, state, bindings.artifact);
    const n = batch.candidates.length, logits = new Float64Array(n), probabilities = new Float64Array(n), accumulator = new Float64Array(418);
    let maximum = -Infinity;
    for (let i = 0; i < n; i++) {
      const candidate = requireCandidate(batch.candidates[i]!);
      const features = hostedFlattenFeaturesV3(scope, hostedEncodeFeaturesV3(scope, history, state, batch, candidate, bindings.artifact));
      let logit = 0;
      for (let j = 0; j < 418; j++) { logit += weights[j]! * features[j]!; if (!Number.isFinite(logit)) throw new EpisodeVerificationError("nonfinite"); }
      logits[i] = logit; maximum = Math.max(maximum, logit);
    }
    let total = 0;
    for (let i = 0; i < n; i++) { probabilities[i] = Math.exp(logits[i]! - maximum); total += probabilities[i]!; }
    if (!Number.isFinite(total) || total <= 0) throw new EpisodeVerificationError("distribution");
    for (let i = 0; i < n; i++) probabilities[i] /= total;
    const cursor = restoreEpisodeRng(start), uniform = drawEpisodeRng(cursor);
    let cumulative = 0, selectedIndex = -1;
    for (let i = 0; i < n; i++) { cumulative += probabilities[i]!; if (uniform < cumulative) { selectedIndex = i; break; } }
    if (selectedIndex === -1) for (let i = n - 1; i >= 0; i--) if (probabilities[i]! > 0) { selectedIndex = i; break; }
    if (selectedIndex === -1) throw new EpisodeVerificationError("distribution");
    for (let i = 0; i < n; i++) {
      const features = hostedFlattenFeaturesV3(scope, hostedEncodeFeaturesV3(scope, history, state, batch, requireCandidate(batch.candidates[i]!), bindings.artifact));
      for (let j = 0; j < 418; j++) {
        accumulator[j] += probabilities[i]! * features[j]!;
        if (!Number.isFinite(accumulator[j])) throw new EpisodeVerificationError("gradient");
      }
    }
    const selected = requireCandidate(batch.candidates[selectedIndex]!);
    const selectedFeatures = hostedFlattenFeaturesV3(scope, hostedEncodeFeaturesV3(scope, history, state, batch, selected, bindings.artifact));
    for (let j = 0; j < 418; j++) { accumulator[j] = selectedFeatures[j]! - accumulator[j]!; if (!Number.isFinite(accumulator[j])) throw new EpisodeVerificationError("gradient"); }
    const logProbability = (logits[selectedIndex]! - maximum) - Math.log(total);
    const journalEntry = freeze({ decisionId: freeze({ planningOrdinal: last.planningOrdinal, side: request.schedule.candidateSide }),
      permitId: `${request.attemptId}:plan:${last.planningOrdinal}:${request.schedule.candidateSide}`, historyDigest: receipt.historyDigest, manifestDigest,
      generatorVersion: batch.version, orderedCandidateKeysDigest: receipt.keysDigest, selectedIndex, selectedKey: selected.key, actions: selected.actions,
      requestedSpend: selected.ownSpend, uniform: encodeOwnedNumber(uniform), selectedLogProbability: encodeOwnedNumber(logProbability), samplingBefore: start, samplingAfter: snapshotEpisodeRng(cursor) });
    recheckPlanningScope(scope); return freeze({ journalEntry, scoreDelta: freeze(Array.from(accumulator)) });
  } catch (error) { abortPlanningScope(scope); throw error; }
};
export { advanceEconomicState, encodeFeaturesV3, flattenFeaturesV3, initializeEconomicState, readoutEconomic, requireCandidate, requireHistory };
