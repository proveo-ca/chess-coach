import jsSHA from "jssha/sha256";
import { specialGasCost } from "@chess-coach/starchess-core/planning-v1";
import { readBatch, validateBoundaryBatch } from "./batch";
import { readEconomicState, readHistory, readMineLineage, readSnapshot } from "./observation";
import { array, byteEqual, bytes, equal, fail, freeze, id, integer, object, ordered, parseBytes, replacement, squares } from "./schema";
import type { AuthorizedBoundaryBatch, AuthorizedEvent, AuthorizedHistory, EconomicState, ObservedCell, OwnMineLineage, OwnUnitLineage, PaidReceipt, ReconciledBoundaryState, Sighting, Square } from "./types";

const hash = (input: Uint8Array): Uint8Array => {
  const sha = new jsSHA("SHA-256", "UINT8ARRAY");
  sha.update(input);
  return sha.getHash("UINT8ARRAY");
};
const mineOrder = (a: OwnMineLineage, b: OwnMineLineage): number => a.square < b.square ? -1 : a.square > b.square ? 1 : a.mineId < b.mineId ? -1 : a.mineId > b.mineId ? 1 : 0;
const sortedMines = (values: Iterable<OwnMineLineage>): OwnMineLineage[] => [...values].sort(mineOrder);
const readState = (value: unknown): ReconciledBoundaryState => {
  const r = object(value, "$", ["snapshot", "economicState", "ownMineAuditState", "everLit", "ordinal", "phase", "planningOrdinal", "seqThrough", "lastBatchBytes"]);
  const snapshot = readSnapshot(r.snapshot, "$.snapshot");
  const economicState = readEconomicState(r.economicState, "$.economicState", snapshot.side);
  if (!equal(economicState, snapshot.economicState)) fail("$.economicState", "CONSISTENCY");
  const m = object(r.ownMineAuditState, "$.ownMineAuditState", ["liveOwnMines", "retiredOwnMineIdsSorted", "ownMineCreationCounter"]);
  const liveOwnMines = readMineLineage(m.liveOwnMines, "$.ownMineAuditState.liveOwnMines", snapshot.side);
  const retiredOwnMineIdsSorted = array(m.retiredOwnMineIdsSorted, "$.ownMineAuditState.retiredOwnMineIdsSorted", 195, (v, p) => id(v, p, snapshot.side, "mine"));
  ordered(retiredOwnMineIdsSorted, x => x, "$.ownMineAuditState.retiredOwnMineIdsSorted");
  const ownMineCreationCounter = integer(m.ownMineCreationCounter, "$.ownMineAuditState.ownMineCreationCounter", 0, 192);
  const issued = [...liveOwnMines.map(x => x.mineId), ...retiredOwnMineIdsSorted];
  const created = issued.filter(x => x.includes(":created:"));
  if (!equal(liveOwnMines, snapshot.ownMineLineage) || new Set(issued).size !== issued.length || issued.length - created.length > 3 || created.length !== ownMineCreationCounter ||
    created.some((_, i) => !created.includes(`${snapshot.side}:mine:created:${i + 1}`))) fail("$.ownMineAuditState", "IDENTITY");
  const everLit = squares(r.everLit, "$.everLit");
  if (snapshot.cells.some(x => x.visibility === "lit" && !everLit.includes(x.square))) fail("$.everLit", "CONSISTENCY");
  if (!(r.lastBatchBytes instanceof Uint8Array)) fail("$.lastBatchBytes");
  const batch = readBatch(parseBytes(r.lastBatchBytes as Uint8Array));
  const lastBatchBytes = new Uint8Array(r.lastBatchBytes as Uint8Array);
  if (!byteEqual(lastBatchBytes, bytes(batch))) fail("$.lastBatchBytes", "JSON");
  const ordinal = integer(r.ordinal, "$.ordinal", 0, 128);
  const planningOrdinal = integer(r.planningOrdinal, "$.planningOrdinal", 0, 64);
  const seqThrough = integer(r.seqThrough, "$.seqThrough");
  if (ordinal !== batch.ordinal || r.phase !== batch.phase || planningOrdinal !== batch.planningOrdinal || seqThrough !== batch.seqThrough || !equal(snapshot, batch.snapshot)) fail("$", "CONSISTENCY");
  if (ownMineCreationCounter > 3 * planningOrdinal || economicState.receipts.some(x => x.actionRef.planningOrdinal >= planningOrdinal)) fail("$", "SEQUENCE");
  return freeze({ snapshot, economicState, ownMineAuditState: { liveOwnMines, retiredOwnMineIdsSorted, ownMineCreationCounter }, everLit, ordinal, phase: batch.phase, planningOrdinal, seqThrough, lastBatchBytes });
};
const foldCells = (memory: Map<Square, Sighting>, everLit: Set<Square>, cells: readonly ObservedCell[], turn: number, side: "w" | "b"): void => {
  for (const cell of cells) {
    if (cell.visibility === "lit") everLit.add(cell.square);
    if (cell.visibility === "unknown") continue;
    if (cell.piece && cell.piece.color !== side) memory.set(cell.square, { square: cell.square, piece: { ...cell.piece }, observedTurn: turn });
    else memory.delete(cell.square);
  }
};
export const reconcileBoundary = (previous: ReconciledBoundaryState | null, value: AuthorizedBoundaryBatch): ReconciledBoundaryState => {
  const batch = validateBoundaryBatch(value), encoded = bytes(batch);
  const prior = previous === null ? null : readState(previous);
  if (prior) {
    if (batch.side !== prior.snapshot.side) fail("$.side", "SIDE");
    if (batch.ordinal === prior.ordinal) {
      if (!byteEqual(hash(encoded), hash(prior.lastBatchBytes)) || !byteEqual(encoded, prior.lastBatchBytes)) fail("$", "DUPLICATE");
      return prior;
    }
    if (batch.phase === "initial" || batch.ordinal !== prior.ordinal + 1 || batch.seqBefore !== prior.seqThrough ||
      batch.phase !== (prior.phase === "turn-open" ? "settled" : "turn-open") ||
      batch.planningOrdinal !== prior.planningOrdinal + (batch.phase === "settled" ? 1 : 0)) fail("$", "SEQUENCE");
    if (prior.snapshot.turn === 45 || prior.snapshot.own.ccLives === 0) fail("$", "PROTOCOL");
    if (batch.phase === "settled" ? batch.turn !== prior.snapshot.turn + 1 : batch.turn < prior.snapshot.turn || batch.turn > prior.snapshot.turn + 1) fail("$.turn", "SEQUENCE");
  } else if (batch.phase !== "initial") fail("$", "SEQUENCE");
  const color = batch.side, snapshot = batch.snapshot;
  const units = new Map<string, OwnUnitLineage>((prior?.snapshot.ownUnitLineage ?? []).map(x => [x.id, { ...x }]));
  const modes = new Map<string, "tank" | "siege" | null>((prior?.snapshot.ownUnitLineage ?? []).filter(x => x.type === "r").map(x => [x.id, prior!.snapshot.own.siegedTanks.includes(x.square) ? "siege" : "tank"]));
  const mines = new Map<string, OwnMineLineage>((prior?.ownMineAuditState.liveOwnMines ?? []).map(x => [x.mineId, { ...x }]));
  const retired = new Set(prior?.economicState.retiredOwnIds ?? []);
  const retiredMines = new Set(prior?.ownMineAuditState.retiredOwnMineIdsSorted ?? []);
  const receipts = new Map<string, PaidReceipt>((prior?.economicState.receipts ?? []).map(x => [x.receiptId, x]));
  const pending = new Map<string, Extract<AuthorizedEvent, { kind: "own-paid-receipt" }>>();
  const mineBirthIds: string[] = [];
  const mineActions = new Set<number>();
  const gas = new Map<number, number>();
  const memory = new Map<Square, Sighting>((prior?.snapshot.memory ?? []).map(x => [x.square, { ...x, piece: { ...x.piece } }]));
  const everLit = new Set<Square>(prior?.everLit ?? []);
  const projection = new Map<Square, ObservedCell>((prior?.snapshot.cells ?? []).map(x => [x.square, x]));
  let paidDebits = prior?.economicState.ownPaidDebits ?? 0, paidDestroyed = prior?.economicState.ownPaidDestroyed ?? 0;
  let paidWasted = prior?.economicState.ownPaidWasted ?? 0, replacementDestroyed = prior?.economicState.ownReplacementDestroyed ?? 0;
  let lossCount = prior?.economicState.enemyLoss.confirmedUnitCount ?? 0, lossReplacement = prior?.economicState.enemyLoss.replacementLowerBound ?? 0;
  let minerals = prior?.snapshot.own.minerals ?? snapshot.own.minerals;
  let ccLives = prior?.snapshot.own.ccLives ?? snapshot.own.ccLives;
  let unitCounter = (prior?.economicState.receipts ?? []).filter(x => x.disposition.kind === "materialized").length;
  let visionTurn = prior?.snapshot.turn ?? snapshot.turn;
  const liveUnit = (unitId: string, p: string): OwnUnitLineage => units.get(unitId) ?? fail(p, "IDENTITY");
  for (let i = 0; i < batch.events.length; i++) {
    const e = batch.events[i]!, p = `$.events[${i}]`;
    switch (e.kind) {
      case "own-unit-endowed": {
        if (e.id !== `${color}:unit:opening:${e.square}` || units.has(e.id) || retired.has(e.id)) fail(p, "IDENTITY");
        units.set(e.id, { id: e.id, square: e.square, type: e.type, paidBasis: 0, replacementValue: replacement(e.type) });
        if (e.type === "r") modes.set(e.id, snapshot.own.siegedTanks.includes(e.square) ? "siege" : "tank");
        break;
      }
      case "own-paid-receipt":
        if (receipts.has(e.receiptId) || pending.has(e.receiptId)) fail(p, "IDENTITY");
        pending.set(e.receiptId, e); paidDebits += e.minerals; minerals -= e.minerals;
        if (minerals < 0) fail(p, "CONSERVATION");
        break;
      case "own-gas-debited": gas.set(e.actionRef.acceptedActionOrdinal, e.gas); break;
      case "own-unit-created": {
        const receipt = pending.get(e.receiptId) ?? fail(p, "IDENTITY");
        if (receipt.unit !== e.type || receipt.requestedSquare !== e.square || e.lineageId !== `${color}:unit:created:${unitCounter + 1}` || units.has(e.lineageId) || retired.has(e.lineageId)) fail(p, "IDENTITY");
        unitCounter++;
        units.set(e.lineageId, { id: e.lineageId, square: e.square, type: e.type, paidBasis: receipt.minerals, replacementValue: replacement(e.type) });
        if (e.type === "r") modes.set(e.lineageId, null);
        const { kind: _kind, seq: _seq, ...payment } = receipt;
        receipts.set(e.receiptId, { ...payment, disposition: { kind: "materialized", lineageId: e.lineageId } });
        pending.delete(e.receiptId);
        break;
      }
      case "own-deployment-unmaterialized": {
        const receipt = pending.get(e.receiptId) ?? fail(p, "IDENTITY");
        if (receipt.minerals !== e.paidMinerals) fail(p, "IDENTITY");
        const { kind: _kind, seq: _seq, ...payment } = receipt;
        receipts.set(e.receiptId, { ...payment, disposition: { kind: "unmaterialized" } });
        pending.delete(e.receiptId); paidWasted += e.paidMinerals;
        break;
      }
      case "own-unit-moved": {
        const unit = liveUnit(e.id, p);
        if (unit.square !== e.from) fail(p, "CONSISTENCY");
        units.set(e.id, { ...unit, square: e.to });
        break;
      }
      case "own-unit-transformed": {
        const unit = liveUnit(e.id, p);
        if (unit.type !== e.fromType) fail(p, "CONSISTENCY");
        units.set(e.id, { ...unit, type: e.toType, replacementValue: replacement(e.toType) });
        modes.delete(e.id); if (e.toType === "r") modes.set(e.id, null);
        break;
      }
      case "own-unit-mode-changed": {
        if (liveUnit(e.id, p).type !== "r" || modes.get(e.id) === e.mode) fail(p, "CONSISTENCY");
        modes.set(e.id, e.mode); break;
      }
      case "own-unit-destroyed": {
        const unit = liveUnit(e.id, p);
        if (retired.has(e.id) || unit.type !== e.typeAtLoss || unit.square !== e.square || unit.paidBasis !== e.retiredPaidBasis) fail(p, "IDENTITY");
        units.delete(e.id); modes.delete(e.id); retired.add(e.id);
        paidDestroyed += unit.paidBasis; replacementDestroyed += replacement(e.typeAtLoss);
        break;
      }
      case "own-mine-endowed":
        if (e.mineId !== `${color}:mine:opening:${e.square}` || mines.has(e.mineId) || retiredMines.has(e.mineId)) fail(p, "IDENTITY");
        mines.set(e.mineId, { mineId: e.mineId, square: e.square }); break;
      case "own-mine-created": {
        const action = e.actionRef.acceptedActionOrdinal;
        if (mines.has(e.mineId) || retiredMines.has(e.mineId) || mineBirthIds.includes(e.mineId) || mineActions.has(action) ||
          gas.get(action) !== specialGasCost("spiderMine") || [...receipts.values()].some(x => x.actionRef.planningOrdinal === e.actionRef.planningOrdinal && x.actionRef.acceptedActionOrdinal === action) || [...pending.values()].some(x => x.actionRef.acceptedActionOrdinal === action)) fail(p, "IDENTITY");
        mineActions.add(action); mineBirthIds.push(e.mineId);
        mines.set(e.mineId, { mineId: e.mineId, square: e.square }); break;
      }
      case "own-mine-removed":
        if (!mines.has(e.mineId) || retiredMines.has(e.mineId)) fail(p, "IDENTITY");
        mines.delete(e.mineId); retiredMines.add(e.mineId); break;
      case "own-income": {
        const expected = Math.min(12 - minerals, snapshot.turn <= 10 ? 1 : snapshot.turn <= 20 ? 2 : 3);
        if (e.actualCreditedMinerals !== expected) fail(p, "DERIVED");
        minerals += e.actualCreditedMinerals; break;
      }
      case "own-cc-lives-changed":
        if (ccLives !== e.before) fail(p, "CONSISTENCY");
        ccLives = e.after; break;
      case "enemy-unit-destruction-witnessed":
        if (e.witnessId !== `${color}:witness:${lossCount + 1}`) fail(p, "IDENTITY");
        lossCount++; lossReplacement += e.replacementLowerBound;
        if (memory.get(e.square)?.piece.type === e.type) memory.delete(e.square);
        break;
      case "vision-witness":
        if (e.turn < visionTurn) fail(p, "SEQUENCE");
        visionTurn = e.turn;
        if (e.changes.some(x => equal(x, projection.get(x.square)))) fail(p, "DERIVED");
        e.changes.forEach(x => projection.set(x.square, x));
        foldCells(memory, everLit, e.changes, e.turn, color);
        break;
    }
  }
  if (pending.size !== 0) fail("$.events", "CONSERVATION");
  const mineCounterBefore = prior?.ownMineAuditState.ownMineCreationCounter ?? 0;
  if (mineBirthIds.some((_, i) => !mineBirthIds.includes(`${color}:mine:created:${mineCounterBefore + i + 1}`))) fail("$.events", "IDENTITY");
  const ownMineCreationCounter = mineCounterBefore + mineBirthIds.length;
  const liveOwnMines = sortedMines(mines.values());
  const ownUnitLineage = [...units.values()].sort((a, b) => a.square < b.square ? -1 : a.square > b.square ? 1 : 0);
  if (!equal(ownUnitLineage, snapshot.ownUnitLineage) || !equal(liveOwnMines, snapshot.ownMineLineage)) fail("$.snapshot", "CONSISTENCY");
  for (const unit of units.values()) {
    if (unit.type !== "r") continue;
    const mode = modes.get(unit.id);
    if (mode !== null && (mode === "siege") !== snapshot.own.siegedTanks.includes(unit.square)) fail("$.snapshot.own.siegedTanks", "CONSISTENCY");
  }
  if (minerals !== snapshot.own.minerals || ccLives !== snapshot.own.ccLives) fail("$.snapshot.own", "CONSISTENCY");
  const spentGas = [...gas.values()].reduce((n, x) => n + x, 0);
  if (prior) {
    if (spentGas > prior.snapshot.own.gas) fail("$.events", "CONSERVATION");
    if (batch.phase === "turn-open") {
      if (snapshot.own.gasIncome !== prior.snapshot.own.gasIncome || snapshot.own.gas !== snapshot.own.gasIncome) fail("$.snapshot.own", "CONSISTENCY");
    } else if (snapshot.own.gas !== 0 || snapshot.own.gasIncome !== (snapshot.turn <= 10 ? 1 : snapshot.turn <= 20 ? 2 : 3)) fail("$.snapshot.own", "CONSISTENCY");
  }
  foldCells(memory, everLit, snapshot.cells, snapshot.turn, color);
  const foldedMemory = [...memory.values()].sort((a, b) => a.square < b.square ? -1 : 1);
  if (!equal(foldedMemory, snapshot.memory)) fail("$.snapshot.memory", "CONSISTENCY");
  const paidSurviving = ownUnitLineage.reduce((n, x) => n + x.paidBasis, 0);
  if (paidDebits !== paidSurviving + paidDestroyed + paidWasted) fail("$.snapshot.economicState", "CONSERVATION");
  const economicState: EconomicState = {
    version: "challenge-economic-ledger-v1", side: color, ownPaidDebits: paidDebits, ownPaidSurviving: paidSurviving, ownPaidDestroyed: paidDestroyed, ownPaidWasted: paidWasted, ownReplacementDestroyed: replacementDestroyed,
    enemyLoss: { confirmedUnitCount: lossCount, replacementLowerBound: lossReplacement, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" },
    receipts: [...receipts.values()].sort((a, b) => a.receiptId < b.receiptId ? -1 : 1), retiredOwnIds: [...retired].sort(),
  };
  if (!equal(economicState, snapshot.economicState)) fail("$.snapshot.economicState", "CONSISTENCY");
  const result: ReconciledBoundaryState = { snapshot, economicState, ownMineAuditState: { liveOwnMines, retiredOwnMineIdsSorted: [...retiredMines].sort(), ownMineCreationCounter }, everLit: [...everLit].sort(), ordinal: batch.ordinal, phase: batch.phase, planningOrdinal: batch.planningOrdinal, seqThrough: batch.seqThrough, lastBatchBytes: encoded.slice() };
  return readState(result);
};
export const advanceHistory = (previous: AuthorizedHistory | null, boundary: ReconciledBoundaryState): AuthorizedHistory => {
  const checked = readState(boundary);
  const prior = previous === null ? null : readHistory(previous);
  if (prior === null) {
    if (checked.phase !== "initial") fail("$", "SEQUENCE");
  } else {
    if (prior.currentAuthorizedSnapshotV2.side !== checked.snapshot.side) fail("$.side", "SIDE");
    if (prior.everLit.some(at => !checked.everLit.includes(at))) fail("$.everLit", "CONSISTENCY");
    if (!equal(prior.currentAuthorizedSnapshotV2, checked.snapshot) && (checked.phase === "initial" || prior.currentAuthorizedSnapshotV2.turn > checked.snapshot.turn ||
      prior.economicState.receipts.some(x => !checked.economicState.receipts.some(next => equal(x, next))) ||
      prior.economicState.retiredOwnIds.some(x => !checked.economicState.retiredOwnIds.includes(x)) ||
      prior.economicState.enemyLoss.confirmedUnitCount > checked.economicState.enemyLoss.confirmedUnitCount ||
      prior.economicState.enemyLoss.replacementLowerBound > checked.economicState.enemyLoss.replacementLowerBound ||
      prior.economicState.ownReplacementDestroyed > checked.economicState.ownReplacementDestroyed)) fail("$", "SEQUENCE");
  }
  const memory = new Map<Square, Sighting>((prior?.currentAuthorizedSnapshotV2.memory ?? []).map(x => [x.square, x]));
  const everLit = new Set<Square>(prior?.everLit ?? []);
  const batch = readBatch(parseBytes(checked.lastBatchBytes));
  for (const event of batch.events) {
    if (event.kind === "vision-witness") foldCells(memory, everLit, event.changes, event.turn, checked.snapshot.side);
    else if (event.kind === "enemy-unit-destruction-witnessed" && memory.get(event.square)?.piece.type === event.type) memory.delete(event.square);
  }
  foldCells(memory, everLit, checked.snapshot.cells, checked.snapshot.turn, checked.snapshot.side);
  if (!equal([...memory.values()].sort((a, b) => a.square < b.square ? -1 : 1), checked.snapshot.memory) || !equal([...everLit].sort(), checked.everLit)) fail("$", "CONSISTENCY");
  return readHistory({ version: "challenge-history-v2", currentAuthorizedSnapshotV2: checked.snapshot, economicState: checked.economicState, everLit: checked.everLit });
};
