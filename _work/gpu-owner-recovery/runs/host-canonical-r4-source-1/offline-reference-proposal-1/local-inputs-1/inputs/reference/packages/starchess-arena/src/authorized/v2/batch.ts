import { UNIT_COST, specialGasCost } from "@chess-coach/starchess-core/planning-v1";
import { readSnapshot } from "./observation";
import { actionRef, array, bytes, cell, equal, fail, freeze, id, integer, literal, object, ordered, side, spawn, square, tag, unitType, version } from "./schema";
import type { AuthorizedBoundaryBatch, AuthorizedEvent, BoundaryPhase, Side } from "./types";

const fields = {
  "own-paid-receipt": ["receiptId", "actionRef", "unit", "requestedSquare", "minerals"],
  "own-gas-debited": ["actionRef", "gas"],
  "own-unit-endowed": ["id", "square", "type", "paidBasis"],
  "own-unit-created": ["lineageId", "receiptId", "square", "type"],
  "own-deployment-unmaterialized": ["receiptId", "paidMinerals"],
  "own-unit-moved": ["id", "from", "to"],
  "own-unit-transformed": ["id", "fromType", "toType", "paidDelta"],
  "own-unit-mode-changed": ["id", "mode"],
  "own-unit-destroyed": ["id", "typeAtLoss", "square", "retiredPaidBasis"],
  "own-mine-endowed": ["mineId", "actionRef", "square"],
  "own-mine-created": ["mineId", "actionRef", "square"],
  "own-mine-removed": ["mineId"],
  "own-income": ["actualCreditedMinerals"],
  "own-cc-lives-changed": ["before", "after"],
  "enemy-unit-destruction-witnessed": ["witnessId", "square", "type", "replacementLowerBound", "paidLowerBound"],
  "vision-witness": ["turn", "changes"],
} as const;
const readEvent = (v: unknown, p: string, color: Side): AuthorizedEvent => {
  const kind = tag(v, p, "kind");
  if (typeof kind !== "string" || !Object.hasOwn(fields, kind)) return fail(`${p}.kind`);
  const k = kind as keyof typeof fields;
  const r = object(v, p, ["kind", "seq", ...fields[k]]);
  const seq = integer(r.seq, `${p}.seq`, 1);
  const unitId = () => id(r.id, `${p}.id`, color, "unit");
  const mineId = () => id(r.mineId, `${p}.mineId`, color, "mine");
  const receiptId = () => id(r.receiptId, `${p}.receiptId`, color, "receipt");
  const ref = () => actionRef(r.actionRef, `${p}.actionRef`);
  const at = () => square(r.square, `${p}.square`);
  switch (k) {
    case "own-paid-receipt": {
      const unit = spawn(r.unit, `${p}.unit`);
      const minerals = integer(r.minerals, `${p}.minerals`, 1, 9);
      const actionRef = ref();
      const receipt = receiptId();
      if (minerals !== UNIT_COST[unit]) fail(`${p}.minerals`, "DERIVED");
      if (receipt !== `${color}:receipt:${actionRef.planningOrdinal}:${actionRef.acceptedActionOrdinal}`) fail(`${p}.receiptId`, "IDENTITY");
      return { kind: k, seq, receiptId: receipt, actionRef, unit, requestedSquare: square(r.requestedSquare, `${p}.requestedSquare`), minerals };
    }
    case "own-gas-debited": return { kind: k, seq, actionRef: ref(), gas: integer(r.gas, `${p}.gas`, 1, 3) };
    case "own-unit-endowed": return { kind: k, seq, id: unitId(), square: at(), type: unitType(r.type, `${p}.type`), paidBasis: literal(r.paidBasis, `${p}.paidBasis`, 0) };
    case "own-unit-created": return { kind: k, seq, lineageId: id(r.lineageId, `${p}.lineageId`, color, "unit"), receiptId: receiptId(), square: at(), type: spawn(r.type, `${p}.type`) };
    case "own-deployment-unmaterialized": return { kind: k, seq, receiptId: receiptId(), paidMinerals: integer(r.paidMinerals, `${p}.paidMinerals`, 1, 9) };
    case "own-unit-moved": {
      const from = square(r.from, `${p}.from`), to = square(r.to, `${p}.to`);
      if (from === to) fail(p, "CONSISTENCY");
      return { kind: k, seq, id: unitId(), from, to };
    }
    case "own-unit-transformed": {
      const fromType = unitType(r.fromType, `${p}.fromType`), toType = spawn(r.toType, `${p}.toType`);
      if (fromType === toType) fail(p, "CONSISTENCY");
      return { kind: k, seq, id: unitId(), fromType, toType, paidDelta: literal(r.paidDelta, `${p}.paidDelta`, 0) };
    }
    case "own-unit-mode-changed": {
      if (r.mode !== "tank" && r.mode !== "siege") fail(`${p}.mode`);
      return { kind: k, seq, id: unitId(), mode: r.mode as "tank" | "siege" };
    }
    case "own-unit-destroyed": return { kind: k, seq, id: unitId(), typeAtLoss: spawn(r.typeAtLoss, `${p}.typeAtLoss`), square: at(), retiredPaidBasis: integer(r.retiredPaidBasis, `${p}.retiredPaidBasis`, 0, 9) };
    case "own-mine-endowed": return { kind: k, seq, mineId: mineId(), square: at(), actionRef: literal(r.actionRef, `${p}.actionRef`, null) };
    case "own-mine-created": return { kind: k, seq, mineId: mineId(), square: at(), actionRef: ref() };
    case "own-mine-removed": return { kind: k, seq, mineId: mineId() };
    case "own-income": return { kind: k, seq, actualCreditedMinerals: integer(r.actualCreditedMinerals, `${p}.actualCreditedMinerals`, 0, 3) };
    case "own-cc-lives-changed": {
      const before = integer(r.before, `${p}.before`, 0, 3), after = integer(r.after, `${p}.after`, 0, 3);
      if (after >= before) fail(p, "CONSISTENCY");
      return { kind: k, seq, before, after };
    }
    case "enemy-unit-destruction-witnessed": {
      const type = spawn(r.type, `${p}.type`), replacementLowerBound = integer(r.replacementLowerBound, `${p}.replacementLowerBound`, 1, 9);
      if (replacementLowerBound !== UNIT_COST[type]) fail(`${p}.replacementLowerBound`, "DERIVED");
      return { kind: k, seq, witnessId: id(r.witnessId, `${p}.witnessId`, color, "witness"), square: at(), type, replacementLowerBound, paidLowerBound: literal(r.paidLowerBound, `${p}.paidLowerBound`, 0) };
    }
    case "vision-witness": {
      const changes = array(r.changes, `${p}.changes`, 64, (v, at) => cell(v, at, color), 1);
      ordered(changes, x => x.square, `${p}.changes`);
      return { kind: k, seq, turn: integer(r.turn, `${p}.turn`, 0, 45), changes };
    }
  }
};
export const readBatch = (value: unknown): AuthorizedBoundaryBatch => {
  const r = object(value, "$", ["version", "side", "ordinal", "phase", "turn", "planningOrdinal", "seqBefore", "seqThrough", "events", "snapshot"]);
  version(r.version, "$.version", "challenge-boundary-batch-v1");
  const color = side(r.side, "$.side");
  const ordinal = integer(r.ordinal, "$.ordinal", 0, 128);
  if (r.phase !== "initial" && r.phase !== "turn-open" && r.phase !== "settled") fail("$.phase");
  const phase = r.phase as BoundaryPhase;
  const turn = integer(r.turn, "$.turn", 0, 45);
  const planningOrdinal = integer(r.planningOrdinal, "$.planningOrdinal", 0, 64);
  const seqBefore = integer(r.seqBefore, "$.seqBefore");
  const seqThrough = integer(r.seqThrough, "$.seqThrough");
  const events = array(r.events, "$.events", 2048, (v, p) => readEvent(v, p, color));
  if (!Number.isSafeInteger(seqBefore + events.length) || seqThrough !== seqBefore + events.length) fail("$.seqThrough", "SEQUENCE");
  events.forEach((event, i) => { if (event.seq !== seqBefore + i + 1) fail(`$.events[${i}].seq`, "SEQUENCE"); });
  const snapshot = readSnapshot(r.snapshot, "$.snapshot");
  if (snapshot.side !== color) fail("$.snapshot.side", "SIDE");
  if (snapshot.turn !== turn) fail("$.snapshot.turn", "CONSISTENCY");
  if (phase === "initial") {
    if (ordinal !== 0 || planningOrdinal !== 0 || seqBefore !== 0) fail("$", "SEQUENCE");
    if (events.some(x => x.kind !== "own-unit-endowed" && x.kind !== "own-mine-endowed")) fail("$.events", "ORDER");
    const units = events.filter(x => x.kind === "own-unit-endowed");
    const mines = events.filter(x => x.kind === "own-mine-endowed");
    ordered(units, x => x.square, "$.events"); ordered(mines, x => x.square, "$.events");
    if (events.slice(0, units.length).some(x => x.kind !== "own-unit-endowed")) fail("$.events", "ORDER");
    if (!equal(units.map(x => ({ id: x.id, square: x.square, type: x.type, paidBasis: x.paidBasis })), snapshot.ownUnitLineage.map(x => ({ id: x.id, square: x.square, type: x.type, paidBasis: x.paidBasis }))) ||
      !equal(mines.map(x => ({ mineId: x.mineId, square: x.square })), snapshot.ownMineLineage) ||
      units.some(x => x.id !== `${color}:unit:opening:${x.square}` || x.paidBasis !== 0) || mines.some(x => x.mineId !== `${color}:mine:opening:${x.square}`)) fail("$.events", "IDENTITY");
    const economic = snapshot.economicState;
    if (economic.ownPaidDebits !== 0 || economic.ownPaidSurviving !== 0 || economic.ownPaidDestroyed !== 0 || economic.ownPaidWasted !== 0 || economic.ownReplacementDestroyed !== 0 ||
      economic.enemyLoss.confirmedUnitCount !== 0 || economic.enemyLoss.replacementLowerBound !== 0 || economic.receipts.length !== 0 || economic.retiredOwnIds.length !== 0) fail("$.snapshot.economicState", "CONSERVATION");
    if (snapshot.memory.some(x => snapshot.cells.find(cell => cell.square === x.square)!.visibility === "unknown")) fail("$.snapshot.memory", "CONSISTENCY");
  } else {
    if (ordinal !== (phase === "turn-open" ? 2 * planningOrdinal + 1 : 2 * planningOrdinal) || (phase === "settled" && planningOrdinal === 0)) fail("$", "SEQUENCE");
    if (events.some(x => x.kind === "own-unit-endowed" || x.kind === "own-mine-endowed")) fail("$.events", "IDENTITY");
    if (phase === "turn-open" && events.some(x => !["own-unit-destroyed", "own-mine-removed", "own-cc-lives-changed", "enemy-unit-destruction-witnessed", "vision-witness"].includes(x.kind))) fail("$.events", "ORDER");
  }
  let visionTurn = -1, effectsStarted = false, lastDebitOrdinal = -1, awaitingDeployGas = false, receipts = 0;
  const gasRefs = new Set<number>();
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!, p = `$.events[${i}]`;
    if (event.kind === "vision-witness") {
      if (event.turn < visionTurn || event.turn > turn) fail(`${p}.turn`, "SEQUENCE");
      visionTurn = event.turn;
    }
    if ("actionRef" in event && event.actionRef !== null && event.actionRef.planningOrdinal !== planningOrdinal - 1) fail(`${p}.actionRef`, "SEQUENCE");
    if (event.kind === "own-paid-receipt" || event.kind === "own-gas-debited") {
      const action = event.actionRef.acceptedActionOrdinal;
      if (phase !== "settled" || effectsStarted || action < lastDebitOrdinal) fail(p, "ORDER");
      if (event.kind === "own-paid-receipt") {
        if (++receipts > 1 || awaitingDeployGas || action <= lastDebitOrdinal) fail(p, "IDENTITY");
        awaitingDeployGas = true;
      } else {
        if (gasRefs.has(action) || (awaitingDeployGas && (action !== lastDebitOrdinal || event.gas !== specialGasCost("deploy")))) fail(p, "IDENTITY");
        gasRefs.add(action); awaitingDeployGas = false;
      }
      lastDebitOrdinal = action;
    } else {
      if (awaitingDeployGas) fail(p, "ORDER");
      effectsStarted = true;
    }
  }
  if (awaitingDeployGas) fail("$.events", "ORDER");
  const income = events.filter(x => x.kind === "own-income");
  if (phase === "settled" ? income.length !== 1 || events.at(-1)?.kind !== "own-income" : income.length !== 0) fail("$.events", "ORDER");
  return { version: "challenge-boundary-batch-v1", side: color, ordinal, phase, turn, planningOrdinal, seqBefore, seqThrough, events, snapshot };
};
export const validateBoundaryBatch = (value: unknown): AuthorizedBoundaryBatch => {
  const result = readBatch(value);
  bytes(result);
  return freeze(result);
};
