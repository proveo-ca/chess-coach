// SPEC: _spec/recipient-production.puml
import { UNIT_COST, getSideVision, placementToMap, sq } from "@chess-coach/game-core";
import type { ScAction, ScFenSnapshot, ScPiece, Square, StarChessColor } from "@chess-coach/game-core";
import type { CausalEvent, CausalJournalData, CausalState, EngineMineId, EngineUnitId } from "../../game-core/src/causal-types";
import { decodeObservation } from "./index";
import { decodeCausalJournal, encodeCausalJournal } from "./causal-journal";
import type { Observation, ObservedCell } from "./shape";
import { decodeRecipientBatch, encodeRecipientBatch } from "./recipient-codec";

type UnitLineage = Observation["ownUnitLineage"][number];
type MineLineage = Observation["ownMineLineage"][number];
type Receipt = Observation["economy"]["receipts"][number];
export type RecipientEvent =
  | { kind: "vision"; turn: number; changes: readonly ObservedCell[] }
  | { kind: "own-unit-created"; unit: UnitLineage }
  | { kind: "own-unit-moved"; id: UnitLineage["id"]; from: Square; to: Square }
  | { kind: "own-unit-transformed"; id: UnitLineage["id"]; fromType: ScPiece["type"]; toType: ScPiece["type"] }
  | { kind: "own-unit-destroyed"; id: UnitLineage["id"]; square: Square; type: ScPiece["type"]; paidBasis: number; replacementValue: number }
  | { kind: "own-tank-mode"; id: UnitLineage["id"]; mode: "tank" | "siege" }
  | { kind: "own-mine-created"; mine: MineLineage }
  | { kind: "own-mine-removed"; mineId: MineLineage["mineId"]; square: Square }
  | { kind: "enemy-unit-destruction-witnessed"; witnessId: `${StarChessColor}:witness:${number}`; square: Square; type: ScPiece["type"]; replacementLowerBound: number; paidLowerBound: 0 }
  | { kind: "paid-receipt"; receipt: Receipt };
export type RecipientBatch = { version: "chess-coach.recipient-batch.v1"; side: StarChessColor; ordinal: number;
  phase: "initial" | "opened" | "settled"; planningOrdinal: number; events: (RecipientEvent & { sequence: number })[]; observation: Observation };
export type RecipientState = { observation: Observation; callOrdinal: number; batchOrdinal: number; planningOrdinal: number;
  eventCounter: number; unitCounter: number; mineCounter: number; witnessCounter: number;
  units: [EngineUnitId, UnitLineage][]; mines: [EngineMineId, MineLineage][]; witnessed: EngineUnitId[] };
export type RecipientProduction = { state: RecipientState; batch: RecipientBatch };
const clone = <T>(value: T): T => structuredClone(value);
function fail(code: string): never { throw new Error(`Recipient production: ${code}`); }
const cost = (type: ScPiece["type"]): number => type === "k" ? 0 : UNIT_COST[type];
const sorted = <T>(values: readonly T[], key: (value: T) => string): T[] => [...values].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);

function actualCells(snapshot: ScFenSnapshot, side: StarChessColor): ObservedCell[] {
  const board = placementToMap(snapshot.placement), sieged = new Set(snapshot.siegedTanks ?? []);
  const vision = getSideVision(board, side, { mines: snapshot.mines, tankModeFor: at => sieged.has(at) ? "siege" : "tank" });
  return Array.from({ length: 64 }, (_, index) => {
    const square = sq(Math.floor(index / 8), index % 8 + 1)!, piece = board.get(square);
    return vision.litSquares.has(square) ? { square, visibility: "lit", piece: piece ?? null }
      : piece && vision.revealedPieces.has(square) ? { square, visibility: "revealed", piece } : { square, visibility: "unknown" };
  });
}

function own(snapshot: ScFenSnapshot, side: StarChessColor, minerals: number): Observation["own"] {
  return { minerals, gas: snapshot.gas[side], gasIncome: snapshot.gasIncome[side], ccLives: snapshot.ccLives[side],
    pieces: sorted([...placementToMap(snapshot.placement)].filter(([, piece]) => piece.color === side).map(([square, piece]) => ({ square, piece })), entry => entry.square),
    mines: [...new Set((snapshot.mines ?? []).filter(mine => mine.color === side).map(mine => mine.at))].sort(),
    siegedTanks: [...new Set(snapshot.siegedTanks ?? [])].filter(at => placementToMap(snapshot.placement).get(at)?.color === side &&
      placementToMap(snapshot.placement).get(at)?.type === "r").sort() };
}

export function seedRecipient(snapshot: ScFenSnapshot, native: CausalState, side: StarChessColor, minerals: number): RecipientProduction {
  if (side !== "w" && side !== "b") fail("SIDE");
  if (native.callOrdinal !== 0 || native.turn !== snapshot.turn) fail("INITIAL_NATIVE_STATE");
  const units: RecipientState["units"] = native.entities.flatMap(entity => entity.kind === "unit" && entity.side === side ? [[entity.id,
    { id: `${side}:unit:opening:${entity.square}`, square: entity.square, type: entity.type, paidBasis: 0, replacementValue: cost(entity.type) }] as RecipientState["units"][number]] : []);
  const mines: RecipientState["mines"] = native.entities.flatMap(entity => entity.kind === "mine" && entity.side === side ? [[entity.id,
    { mineId: `${side}:mine:opening:${entity.square}`, square: entity.square }] as RecipientState["mines"][number]] : []);
  const cells = actualCells(snapshot, side);
  const observation = decodeObservation(JSON.stringify({ version: "chess-coach.observation.v1", side, turn: snapshot.turn, own: own(snapshot, side, minerals), cells,
    memory: cells.flatMap(cell => cell.visibility !== "unknown" && cell.piece && cell.piece.color !== side ? [{ square: cell.square, piece: cell.piece, observedTurn: snapshot.turn }] : []),
    everLit: cells.flatMap(cell => cell.visibility === "lit" ? [cell.square] : []), ownUnitLineage: sorted(units.map(([, unit]) => unit), unit => unit.square),
    ownMineLineage: sorted(mines.map(([, mine]) => mine), mine => `${mine.square}:${mine.mineId}`), economy: { side,
      ownPaidDebits: 0, ownPaidSurviving: 0, ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0,
      enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" }, receipts: [], retiredOwnIds: [] } }));
  const state: RecipientState = { observation, units, mines, witnessed: [], callOrdinal: 0, batchOrdinal: 0, planningOrdinal: 0,
    eventCounter: 0, unitCounter: 0, mineCounter: 0, witnessCounter: 0 };
  return { state, batch: { version: "chess-coach.recipient-batch.v1", side, ordinal: 0, phase: "initial", planningOrdinal: 0, events: [], observation: clone(observation) } };
}

export function produceRecipient(parent: RecipientState, snapshot: ScFenSnapshot, native: CausalState, raw: CausalJournalData,
  phase: "opened" | "settled", minerals: number, actions: readonly ScAction[] = []): RecipientProduction {
  const journal = decodeCausalJournal(encodeCausalJournal(raw)), next = clone(parent), side = parent.observation.side;
  if (journal.callOrdinal !== parent.callOrdinal + 1 || native.callOrdinal !== journal.callOrdinal || journal.turn !== parent.observation.turn ||
    snapshot.turn !== native.turn || JSON.stringify(journal.initialCells[side]) !== JSON.stringify(parent.observation.cells) ||
    JSON.stringify(journal.finalCells[side]) !== JSON.stringify(actualCells(snapshot, side))) fail("CONTINUITY");
  if (phase === "opened" && actions.length) fail("OPEN_ACTIONS");
  const units = new Map(next.units), mines = new Map(next.mines), witnessed = new Set(next.witnessed);
  const memory = new Map(parent.observation.memory.map(sighting => [sighting.square, sighting]));
  const everLit = new Set(parent.observation.everLit), events: RecipientBatch["events"] = [];
  const ledger = clone(parent.observation.economy), receipts = [...ledger.receipts], retired = new Set(ledger.retiredOwnIds);
  let paidDestroyed = ledger.ownPaidDestroyed, replacementDestroyed = ledger.ownReplacementDestroyed, paidWasted = ledger.ownPaidWasted;
  let enemyCount = ledger.enemyLoss.confirmedUnitCount, enemyReplacement = ledger.enemyLoss.replacementLowerBound;
  const ownActions = actions.filter(action => action.color === side);
  const deployment = new Map(ownActions.flatMap((action, acceptedActionOrdinal) => action.kind === "deploy" ? [[action.seq,
    { action, acceptedActionOrdinal, unitId: null as UnitLineage["id"] | null, resolved: false }]] : []));
  const emit = (event: RecipientEvent): void => {
    if (events.length >= 4096) fail("EVENT_BOUND");
    events.push({ ...clone(event), sequence: ++next.eventCounter });
  };
  const fold = (cells: readonly ObservedCell[], turn: number): void => {
    for (const cell of cells) {
      if (cell.visibility === "unknown") continue;
      if (cell.visibility === "lit") everLit.add(cell.square);
      if (cell.piece && cell.piece.color !== side) memory.set(cell.square, { square: cell.square, piece: cell.piece, observedTurn: turn });
      else memory.delete(cell.square);
    }
  };
  const vision = (changes: readonly ObservedCell[], turn: number): void => { fold(changes, turn); emit({ kind: "vision", changes, turn }); };
  const effect = (event: CausalEvent): void => {
    if (event.kind === "visibility") { if (event.recipient === side) vision(event.changes, event.turn); return; }
    switch (event.kind) {
      case "unit-created": {
        if (event.entity.side !== side) break;
        const paid = deployment.get(event.actionSeq);
        if (!paid || paid.unitId || paid.action.unit !== event.entity.type || paid.action.to !== event.entity.square) fail("PAID_BIRTH");
        const unit: UnitLineage = { id: `${side}:unit:created:${++next.unitCounter}`, square: event.entity.square,
          type: event.entity.type, paidBasis: UNIT_COST[event.entity.type], replacementValue: cost(event.entity.type) };
        paid.unitId = unit.id;
        units.set(event.entity.id, unit);
        emit({ kind: "own-unit-created", unit });
        break;
      }
      case "unit-destroyed": {
        if (event.entity.side === side) {
          const unit = units.get(event.entity.id) ?? fail("OWN_LOSS_ID");
          if (unit.square !== event.entity.square || unit.type !== event.entity.type) fail("OWN_LOSS_OPERAND");
          units.delete(event.entity.id);
          retired.add(unit.id);
          paidDestroyed += unit.paidBasis;
          replacementDestroyed += unit.replacementValue;
          emit({ kind: "own-unit-destroyed", id: unit.id, square: unit.square, type: unit.type, paidBasis: unit.paidBasis, replacementValue: unit.replacementValue });
        } else if ((event.visibleTo.includes(side) || event.targets.some(target => target.recipient === side)) && !witnessed.has(event.entity.id)) {
          witnessed.add(event.entity.id);
          enemyCount++;
          enemyReplacement += cost(event.entity.type);
          emit({ kind: "enemy-unit-destruction-witnessed", witnessId: `${side}:witness:${++next.witnessCounter}`, square: event.entity.square,
            type: event.entity.type, replacementLowerBound: cost(event.entity.type), paidLowerBound: 0 });
          if (memory.get(event.entity.square)?.piece.type === event.entity.type) memory.delete(event.entity.square);
        }
        break;
      }
      case "unit-moved": {
        const unit = units.get(event.entityId);
        if (!unit) break;
        if (unit.square !== event.from) fail("OWN_MOVE");
        units.set(event.entityId, { ...unit, square: event.to });
        emit({ kind: "own-unit-moved", id: unit.id, from: event.from, to: event.to });
        break;
      }
      case "unit-transformed": {
        const unit = units.get(event.entityId);
        if (!unit) break;
        if (unit.type !== event.fromType) fail("OWN_TRANSFORM");
        units.set(event.entityId, { ...unit, type: event.toType, replacementValue: cost(event.toType) });
        emit({ kind: "own-unit-transformed", id: unit.id, fromType: event.fromType, toType: event.toType });
        break;
      }
      case "tank-mode-changed": {
        const unit = units.get(event.entityId);
        if (unit) emit({ kind: "own-tank-mode", id: unit.id, mode: event.after });
        break;
      }
      case "mine-created": {
        if (event.entity.side !== side) break;
        const mine: MineLineage = { mineId: `${side}:mine:created:${++next.mineCounter}`, square: event.entity.square };
        mines.set(event.entity.id, mine);
        emit({ kind: "own-mine-created", mine });
        break;
      }
      case "mine-removed": {
        if (event.entity.side !== side) break;
        const mine = mines.get(event.entity.id) ?? fail("OWN_MINE_ID");
        mines.delete(event.entity.id);
        emit({ kind: "own-mine-removed", mineId: mine.mineId, square: mine.square });
        break;
      }
      case "deployment-resolved": {
        if (event.side !== side) break;
        const paid = deployment.get(event.actionSeq);
        if (!paid || paid.resolved || (event.unitId === null ? paid.unitId !== null : units.get(event.unitId)?.id !== paid.unitId)) fail("DEPLOYMENT_DISPOSITION");
        paid.resolved = true;
        break;
      }
      case "cc-damaged": break;
    }
  };
  for (let index = 0; index < journal.events.length;) {
    const group = journal.events[index]!.group, start = index;
    while (index < journal.events.length && journal.events[index]!.group === group) index++;
    const members = journal.events.slice(start, index);
    for (const event of members) if (event.kind === "unit-destroyed" || event.kind === "cc-damaged") {
      for (const target of event.targets) if (target.recipient === side) vision([{ square: target.square, visibility: "lit", piece: target.piece }], journal.turn);
    }
    for (const event of members) effect(event);
  }
  for (const paid of deployment.values()) {
    if (!paid.resolved || !paid.action.unit || !paid.action.to) fail("MISSING_DISPOSITION");
    const minerals = UNIT_COST[paid.action.unit];
    const receipt: Receipt = { receiptId: `${side}:receipt:${parent.planningOrdinal}:${paid.acceptedActionOrdinal}`,
      actionRef: { planningOrdinal: parent.planningOrdinal, acceptedActionOrdinal: paid.acceptedActionOrdinal },
      unit: paid.action.unit, requestedSquare: paid.action.to, minerals,
      disposition: paid.unitId ? { kind: "materialized", lineageId: paid.unitId } : { kind: "unmaterialized" } };
    if (!paid.unitId) paidWasted += minerals;
    receipts.push(receipt);
    emit({ kind: "paid-receipt", receipt });
  }
  const liveOwn = native.entities.filter(entity => entity.kind === "unit" && entity.side === side);
  const liveMines = native.entities.filter(entity => entity.kind === "mine" && entity.side === side);
  if (liveOwn.length !== units.size || liveOwn.some(entity => {
    const unit = units.get(entity.id as EngineUnitId);
    return !unit || unit.square !== entity.square || entity.kind !== "unit" || unit.type !== entity.type;
  }) || liveMines.length !== mines.size || liveMines.some(entity => mines.get(entity.id as EngineMineId)?.square !== entity.square)) fail("FINAL_IDENTITY");
  fold(journal.finalCells[side], snapshot.turn);
  const observation = decodeObservation(JSON.stringify({ ...parent.observation, turn: snapshot.turn, own: own(snapshot, side, minerals),
    cells: journal.finalCells[side], memory: sorted([...memory.values()], value => value.square), everLit: [...everLit].sort(),
    ownUnitLineage: sorted([...units.values()], value => value.square), ownMineLineage: sorted([...mines.values()], value => `${value.square}:${value.mineId}`),
    economy: { ...ledger, ownPaidDebits: receipts.reduce((sum, receipt) => sum + receipt.minerals, 0), ownPaidSurviving: [...units.values()].reduce((sum, unit) => sum + unit.paidBasis, 0),
      ownPaidDestroyed: paidDestroyed, ownPaidWasted: paidWasted, ownReplacementDestroyed: replacementDestroyed,
      enemyLoss: { ...ledger.enemyLoss, confirmedUnitCount: enemyCount, replacementLowerBound: enemyReplacement },
      receipts: sorted(receipts, receipt => receipt.receiptId), retiredOwnIds: [...retired].sort() } }));
  next.units = [...units]; next.mines = [...mines]; next.witnessed = [...witnessed]; next.observation = observation;
  next.callOrdinal = journal.callOrdinal; next.batchOrdinal++;
  if (phase === "settled") next.planningOrdinal++;
  const batch: RecipientBatch = { version: "chess-coach.recipient-batch.v1", side, ordinal: next.batchOrdinal, phase,
    planningOrdinal: next.planningOrdinal, events, observation: clone(observation) };
  return { state: next, batch: decodeRecipientBatch(encodeRecipientBatch(batch)) };
}
