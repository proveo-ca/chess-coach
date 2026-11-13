// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import {
  abortPlanningWork, appendActions65, appendCells64, appendChanges64, appendEvents2048, appendEvidenceRows8192,
  appendMemory64, appendOwnMines3, appendOwnPieces64, appendOwnUnits64, appendPartition, appendReceipts64,
  appendRetiredOwnIds128, appendSquareSet64, appendTables1588, appendTemperatures, appendTransitionRows8192,
  beginActions65, beginCells64, beginChanges64, beginEvents2048, beginEvidenceRows8192, beginMemory64,
  beginOwnMines3, beginOwnPieces64, beginOwnUnits64, beginPartition, beginReceipts64, beginRetiredOwnIds128,
  beginSquareSet64, beginTables1588, beginTemperatures, beginTransitionRows8192, constructCanonicalOpening,
  constructFloat64Hex, constructRef, consumeWorkBlock, encodeOwnedAuthority, encodeOwnedBinding,
  encodeOwnedBoundaryBatch, encodeOwnedCandidate, encodeOwnedEconomicArtifact, encodeOwnedEstimatorProvenance,
  encodeOwnedFeatureManifest, encodeOwnedHistory, encodeOwnedPin, encodeOwnedTrainingRecipe, finishActions65,
  finishCells64, finishChanges64, finishEvents2048, finishEvidenceRows8192, finishMemory64, finishOwnMines3,
  finishOwnPieces64, finishOwnUnits64, finishPartition, finishReceipts64, finishRetiredOwnIds128, finishSquareSet64,
  finishTables1588, finishTemperatures, finishTransitionRows8192, makeActionRef, makeBoundaryBatch, makeCandidate,
  makeCanonicalManifestV3, makeCharonMissilesAction, makeClassicalAction, makeConfiguration418, makeDeployAction,
  makeEconomicArtifact, makeEconomicAuthority, makeEconomicBinding, makeEconomicLedger, makeEconomicPin,
  makeEconomicRecipe, makeEnemyLoss, makeEnemyUnitDestructionWitnessedEvent, makeEstimatorProvenance,
  makeEvidenceRow, makeEvidenceTable, makeHistory, makeHostLimits, makeLitCell, makeMaterializedDisposition,
  makeOwnCCLivesChangedEvent, makeOwnDeploymentUnmaterializedEvent, makeOwnGasDebitedEvent, makeOwnIncomeEvent,
  makeOwnMine, makeOwnMineCreatedEvent, makeOwnMineEndowedEvent, makeOwnMineRemovedEvent, makeOwnPaidReceiptEvent,
  makeOwnPiece, makeOwnState, makeOwnUnit, makeOwnUnitCreatedEvent, makeOwnUnitDestroyedEvent, makeOwnUnitEndowedEvent,
  makeOwnUnitModeChangedEvent, makeOwnUnitMovedEvent, makeOwnUnitTransformedEvent, makePaidReceipt, makePartitionBin,
  makePiece, makeRevealedCell, makeSiegeModeAction, makeSighting, makeSnapshotV2, makeSpiderMineAction,
  makeStimStepAction, makeTacticalJumpAction, makeTrainingRecipe, makeTransitionRow, makeTransitionTable,
  makeUnknownCell, makeUnmaterializedDisposition, makeValidation, makeVersions418, makeVisionWitnessEvent,
  readSnapshotByte, rejectPlanningWork, requireCandidate, requireHistory, requirePlanningMeter, requireSnapshot,
  requireStartupArtifactContext, snapshotLength,
  beginBoundaryBatchDecode, completeBoundaryBatchBytes, finishBoundaryBatchDecode, abortBoundaryBatchDecode,
  type ActionRef as KernelActionRef, type Batch as KernelBatch, type ByteProduction as KernelByteProduction,
  type ConstructionContext as KernelConstructionContext, type Event as KernelEvent, type Ledger as KernelLedger,
  type Mine as KernelMine, type Own as KernelOwn, type OwnedByteRef as KernelOwnedByteRef,
  type OwnedByteSnapshot as KernelOwnedByteSnapshot, type OwnedFloat64Hex as KernelOwnedFloat64Hex,
  type OwnedPublicOpening as KernelOwnedPublicOpening, type Piece as KernelPiece, type Receipt as KernelReceipt,
  type StartupArtifactContext as KernelStartupArtifactContext, type Unit as KernelUnit,
} from "./ownedKernel";
import jsSHA from "jssha/sha256";
import type { Side, Square, Meter, EconomicRecipe, EconomicArtifact, Table, Bin, FeatureManifestV3, EconomicPin, EconomicBinding,
  EstimatorProvenance, EconomicAuthority, TrainingRecipeV2, Configuration418, HostLimits, Versions418, Cells, Memory, AuthorizedSnapshotV2 } from "./contracts";
import { BAND_STARTS } from "./contracts";

const k = Object.freeze({
  abortPlanningWork, appendActions65, appendCells64, appendChanges64, appendEvents2048, appendEvidenceRows8192,
  appendMemory64, appendOwnMines3, appendOwnPieces64, appendOwnUnits64, appendPartition, appendReceipts64,
  appendRetiredOwnIds128, appendSquareSet64, appendTables1588, appendTemperatures, appendTransitionRows8192,
  beginActions65, beginCells64, beginChanges64, beginEvents2048, beginEvidenceRows8192, beginMemory64,
  beginOwnMines3, beginOwnPieces64, beginOwnUnits64, beginPartition, beginReceipts64, beginRetiredOwnIds128,
  beginSquareSet64, beginTables1588, beginTemperatures, beginTransitionRows8192, constructCanonicalOpening,
  constructFloat64Hex, constructRef, consumeWorkBlock, encodeOwnedAuthority, encodeOwnedBinding,
  encodeOwnedBoundaryBatch, encodeOwnedCandidate, encodeOwnedEconomicArtifact, encodeOwnedEstimatorProvenance,
  encodeOwnedFeatureManifest, encodeOwnedHistory, encodeOwnedPin, encodeOwnedTrainingRecipe, finishActions65,
  finishCells64, finishChanges64, finishEvents2048, finishEvidenceRows8192, finishMemory64, finishOwnMines3,
  finishOwnPieces64, finishOwnUnits64, finishPartition, finishReceipts64, finishRetiredOwnIds128, finishSquareSet64,
  finishTables1588, finishTemperatures, finishTransitionRows8192, makeActionRef, makeBoundaryBatch, makeCandidate,
  makeCanonicalManifestV3, makeCharonMissilesAction, makeClassicalAction, makeConfiguration418, makeDeployAction,
  makeEconomicArtifact, makeEconomicAuthority, makeEconomicBinding, makeEconomicLedger, makeEconomicPin,
  makeEconomicRecipe, makeEnemyLoss, makeEnemyUnitDestructionWitnessedEvent, makeEstimatorProvenance,
  makeEvidenceRow, makeEvidenceTable, makeHistory, makeHostLimits, makeLitCell, makeMaterializedDisposition,
  makeOwnCCLivesChangedEvent, makeOwnDeploymentUnmaterializedEvent, makeOwnGasDebitedEvent, makeOwnIncomeEvent,
  makeOwnMine, makeOwnMineCreatedEvent, makeOwnMineEndowedEvent, makeOwnMineRemovedEvent, makeOwnPaidReceiptEvent,
  makeOwnPiece, makeOwnState, makeOwnUnit, makeOwnUnitCreatedEvent, makeOwnUnitDestroyedEvent, makeOwnUnitEndowedEvent,
  makeOwnUnitModeChangedEvent, makeOwnUnitMovedEvent, makeOwnUnitTransformedEvent, makePaidReceipt, makePartitionBin,
  makePiece, makeRevealedCell, makeSiegeModeAction, makeSighting, makeSnapshotV2, makeSpiderMineAction,
  makeStimStepAction, makeTacticalJumpAction, makeTrainingRecipe, makeTransitionRow, makeTransitionTable,
  makeUnknownCell, makeUnmaterializedDisposition, makeValidation, makeVersions418, makeVisionWitnessEvent,
  readSnapshotByte, rejectPlanningWork, requireCandidate, requireHistory, requirePlanningMeter, requireSnapshot,
  requireStartupArtifactContext, snapshotLength,
  beginBoundaryBatchDecode, completeBoundaryBatchBytes, finishBoundaryBatchDecode, abortBoundaryBatchDecode,
});
declare namespace k {
  type ActionRef = KernelActionRef;
  type Batch = KernelBatch;
  type ByteProduction = KernelByteProduction;
  type ConstructionContext = KernelConstructionContext;
  type Event = KernelEvent;
  type Ledger = KernelLedger;
  type Mine = KernelMine;
  type Own = KernelOwn;
  type OwnedByteRef = KernelOwnedByteRef;
  type OwnedByteSnapshot = KernelOwnedByteSnapshot;
  type OwnedFloat64Hex = KernelOwnedFloat64Hex;
  type OwnedPublicOpening = KernelOwnedPublicOpening;
  type Piece = KernelPiece;
  type Receipt = KernelReceipt;
  type StartupArtifactContext = KernelStartupArtifactContext;
  type Unit = KernelUnit;
}

type Parsed = Record<string, unknown>;
type Atom = Readonly<{ kind: "string"; maximum: number }> | Readonly<{ kind: "integer"; maximum: number; minimum: number }> |
  Readonly<{ kind: "literal"; value: string | number | null | boolean }>;
type Schema = Atom | Readonly<{ kind: "nullable"; child: Schema }> | Readonly<{ kind: "table-rows" }> | Readonly<{ kind: "object"; fields: readonly Field[];
  select?: (r: Parsed) => readonly string[]; build: (c: k.ConstructionContext, r: Parsed) => unknown }> |
  Readonly<{ kind: "array"; child: Schema; minimum: number; maximum: number; rowBudget?: boolean;
    build: (c: k.ConstructionContext, values: readonly unknown[], r: Reader) => unknown }> |
  Readonly<{ kind: "tuple"; children: readonly Schema[]; build: (c: k.ConstructionContext, values: readonly unknown[]) => unknown }>;
type Field = Readonly<{ name: string; schema: Schema }>;
type Reader = { bytes: k.OwnedByteSnapshot; length: number; offset: number; dry: boolean; rows: number; context: k.ConstructionContext; side?: Side };
const create = Object.create;
const define = Object.defineProperty;
const push = (target: unknown[], value: unknown): void => {
  const descriptor = { __proto__: null, value, writable: true, configurable: true, enumerable: true };
  define(target, `${target.length}`, descriptor);
};
const SHA256 = jsSHA;
const FixedUint8Array = Uint8Array;
const fromCode = String.fromCharCode;
const denseCharacters = Array.from.bind(Array);
const joinCharacters = Function.prototype.call.bind(Array.prototype.join);
const codeAt = Function.prototype.call.bind(String.prototype.charCodeAt);
const string = (maximum = 128): Schema => ({ kind: "string", maximum });
const integer = (maximum = Number.MAX_SAFE_INTEGER, minimum = 0): Schema => ({ kind: "integer", maximum, minimum });
const literal = (value: string | number | null | boolean): Schema => ({ kind: "literal", value });
const nullable = (child: Schema): Schema => ({ kind: "nullable", child });
const field = (name: string, schema: Schema): Field => ({ name, schema });
const object = (fields: readonly Field[], build: (c: k.ConstructionContext, r: Parsed) => unknown, select?: (r: Parsed) => readonly string[]): Schema =>
  ({ kind: "object", fields, build, select });
const array = (child: Schema, minimum: number, maximum: number, build: (c: k.ConstructionContext, values: readonly unknown[], r: Reader) => unknown, rowBudget = false): Schema =>
  ({ kind: "array", child, minimum, maximum, build, rowBudget });
const tuple = (children: readonly Schema[], build: (c: k.ConstructionContext, values: readonly unknown[]) => unknown): Schema => ({ kind: "tuple", children, build });
const fail = (code = "CANONICAL"): never => k.rejectPlanningWork("$.bytes", code);
const data = (target: Parsed, name: string, value: unknown): void => {
  const descriptor = { __proto__: null, value, enumerable: true, configurable: false, writable: false };
  define(target, name, descriptor);
};
const byte = (r: Reader): number => r.offset < r.length ? k.readSnapshotByte(r.bytes, r.offset) : -1;
const consume = (r: Reader, expected: number): void => { if (byte(r) !== expected) return fail(); r.offset++; };
const text = (r: Reader, maximum: number): string => {
  consume(r, 34); const start = r.offset; let count = 0;
  while (true) {
    const current = byte(r);
    if (current === 34) break;
    if (current < 32 || current > 126 || ++count > maximum) return fail(current > 126 ? "UTF8" : "TOKEN");
    if (current === 92) { r.offset++; if (byte(r) !== 34 && byte(r) !== 92) return fail(); }
    r.offset++;
  }
  const end = r.offset; r.offset++;
  const slots = { __proto__: null, length: count }, characters = denseCharacters(slots, () => "");
  let index = 0;
  for (let i = start; i < end; i++) {
    let current = k.readSnapshotByte(r.bytes, i);
    if (current === 92) current = k.readSnapshotByte(r.bytes, ++i);
    characters[index++] = fromCode(current);
  }
  return joinCharacters(characters, "");
};
const number = (r: Reader, minimum: number, maximum: number): number => {
  const first = byte(r); if (first < 48 || first > 57) return fail("NUMBER");
  let value = 0, digits = 0;
  while (byte(r) >= 48 && byte(r) <= 57) {
    const next = byte(r) - 48;
    if (++digits > 16 || digits > 1 && first === 48 || value > Math.floor((maximum - next) / 10)) return fail("NUMBER");
    value = value * 10 + next; r.offset++;
  }
  return value >= minimum ? value : fail("NUMBER");
};
const word = (r: Reader, expected: string): void => {
  for (let i = 0; i < expected.length; i++) consume(r, codeAt(expected, i));
};
const parse = (r: Reader, schema: Schema, depth = 0, parent?: Parsed): unknown => {
  if (depth > 16) return fail("DEPTH");
  switch (schema.kind) {
    case "table-rows": return parent?.kind === "transition" ? parse(r, transitionRows, depth) : parent?.kind === "evidence" ? parse(r, evidenceRows, depth) : fail("SCHEMA");
    case "string": return text(r, schema.maximum);
    case "integer": return number(r, schema.minimum, schema.maximum);
    case "literal": {
      const expected = schema.value;
      if (typeof expected === "string") { if (text(r, expected.length) !== expected) return fail("VERSION"); }
      else if (typeof expected === "number") { if (number(r, expected, expected) !== expected) return fail(); }
      else word(r, expected === null ? "null" : expected ? "true" : "false");
      return expected;
    }
    case "nullable": if (byte(r) === 110) { word(r, "null"); return null; } else return parse(r, schema.child, depth + 1);
    case "tuple": {
      consume(r, 91); const values: unknown[] = [];
      for (let i = 0; i < schema.children.length; i++) {
        if (i !== 0) consume(r, 44);
        const value = parse(r, schema.children[i]!, depth + 1);
        if (!r.dry) push(values, value);
      }
      consume(r, 93); return r.dry ? undefined : schema.build(r.context, values);
    }
    case "array": {
      consume(r, 91); let count = 0; const values: unknown[] = [];
      while (byte(r) !== 93) {
        if (count >= schema.maximum) return fail("CARDINALITY");
        if (count !== 0) consume(r, 44);
        if (schema.rowBudget && ++r.rows > 8192) return fail("CARDINALITY");
        const value = parse(r, schema.child, depth + 1); count++;
        if (!r.dry) push(values, value);
      }
      if (count < schema.minimum) return fail("CARDINALITY");
      r.offset++; return r.dry ? undefined : schema.build(r.context, values, r);
    }
    case "object": {
      consume(r, 123); const record = create(null) as Parsed; let previous = "", present = 0, count = 0;
      while (byte(r) !== 125) {
        if (count >= schema.fields.length) return fail("SCHEMA");
        if (count !== 0) consume(r, 44);
        const name = text(r, 64);
        if (name <= previous) return fail("DUPLICATE"); previous = name;
        let index = -1;
        for (let i = 0; i < schema.fields.length; i++) if (schema.fields[i]!.name === name) { index = i; break; }
        if (index < 0) return fail("SCHEMA");
        present |= 1 << index; consume(r, 58);
        data(record, name, parse(r, schema.fields[index]!.schema, depth + 1, record)); count++;
      }
      r.offset++;
      const selected = schema.select?.(record);
      let required = 0;
      for (let i = 0; i < schema.fields.length; i++) if (!selected || selected.includes(schema.fields[i]!.name)) required |= 1 << i;
      if (present !== required) return fail("SCHEMA");
      return r.dry ? undefined : schema.build(r.context, record);
    }
  }
};
const sq = string(2), side = string(1), type = string(1), id = string(64);
const h = object([field("hex", string(16))], (_, r) => k.constructFloat64Hex(r.hex as string));
const ref = object([field("byteLength", integer()), field("sha256", string(64))], (_, r) => k.constructRef(r.byteLength as number, r.sha256 as string));
const piece = object([field("color", side), field("type", type)], (c, r) => k.makePiece(c, r.type as k.Piece['type'], r.color as Side));
const cell = object([field("square", sq), field("visibility", string(8)), field("piece", nullable(piece))], (c, r) => {
  if (r.visibility === "unknown") return k.makeUnknownCell(c, r.square as Square);
  if (r.visibility === "lit") return k.makeLitCell(c, r.square as Square, r.piece as k.Piece | null);
  if (r.visibility !== "revealed") return fail("SCHEMA");
  const current = r.piece as k.Piece;
  if (current === null) return fail("SCHEMA");
  return k.makeRevealedCell(c, r.square as Square, current, current.color === "w" ? "b" : "w");
}, r => r.visibility === "unknown" ? ["square", "visibility"] : r.visibility === "lit" || r.visibility === "revealed" ? ["square", "visibility", "piece"] : fail("SCHEMA"));
const cells = array(cell, 64, 64, (c, values) => { const cursor = k.beginCells64(c); for (const v of values) k.appendCells64(c, cursor, v as Cells[number]); return k.finishCells64(c, cursor); });
const changes = array(cell, 1, 64, (c, values) => { const cursor = k.beginChanges64(c); for (const v of values) k.appendChanges64(c, cursor, v as Cells[number]); return k.finishChanges64(c, cursor); });
const sighting = object([field("square", sq), field("piece", piece), field("observedTurn", integer(45))], (c, r) => k.makeSighting(c, r.square as Square, r.piece as k.Piece, r.observedTurn as number));
const memory = array(sighting, 0, 64, (c, values) => { const cursor = k.beginMemory64(c); for (const v of values) k.appendMemory64(c, cursor, v as Memory[number]); return k.finishMemory64(c, cursor); });
const squares = (maximum = 64): Schema => array(sq, 0, maximum, (c, values) => { const cursor = k.beginSquareSet64(c); for (const v of values) k.appendSquareSet64(c, cursor, v as Square); return k.finishSquareSet64(c, cursor); });
const ownPiece = object([field("square", sq), field("piece", piece)], (c, r) => k.makeOwnPiece(c, r.square as Square, r.piece as k.Piece));
const ownPieces = array(ownPiece, 1, 64, (c, values) => { const cursor = k.beginOwnPieces64(c); for (const v of values) k.appendOwnPieces64(c, cursor, v as k.Own['pieces'][number]); return k.finishOwnPieces64(c, cursor); });
const unit = object([field("id", id), field("square", sq), field("type", type), field("paidBasis", integer(9)), field("replacementValue", integer(9))], (c, r) => k.makeOwnUnit(c, r.id as string, r.square as Square, r.type as k.Piece['type'], r.paidBasis as number, r.replacementValue as number));
const units = array(unit, 1, 64, (c, values) => { const cursor = k.beginOwnUnits64(c); for (const v of values) k.appendOwnUnits64(c, cursor, v as k.Unit); return k.finishOwnUnits64(c, cursor); });
const mine = object([field("mineId", id), field("square", sq)], (c, r) => k.makeOwnMine(c, r.mineId as string, r.square as Square));
const mines = array(mine, 0, 3, (c, values) => { const cursor = k.beginOwnMines3(c); for (const v of values) k.appendOwnMines3(c, cursor, v as k.Mine); return k.finishOwnMines3(c, cursor); });
const actionRef = object([field("planningOrdinal", integer(63)), field("acceptedActionOrdinal", integer(3))], (c, r) => k.makeActionRef(c, r.planningOrdinal as number, r.acceptedActionOrdinal as number));
const disposition = object([field("kind", string(14)), field("lineageId", id)], (c, r) => r.kind === "materialized" ? k.makeMaterializedDisposition(c, r.lineageId as string) : k.makeUnmaterializedDisposition(c),
  r => r.kind === "materialized" ? ["kind", "lineageId"] : r.kind === "unmaterialized" ? ["kind"] : fail("SCHEMA"));
const receipt = object([field("receiptId", id), field("actionRef", actionRef), field("unit", type), field("requestedSquare", sq), field("minerals", integer(9, 1)), field("disposition", disposition)],
  (c, r) => k.makePaidReceipt(c, r.receiptId as string, r.actionRef as k.ActionRef, r.unit as Exclude<k.Piece['type'], "k">, r.requestedSquare as Square, r.minerals as number, r.disposition as k.Receipt['disposition']));
const receipts = array(receipt, 0, 64, (c, values) => { const cursor = k.beginReceipts64(c); for (const v of values) k.appendReceipts64(c, cursor, v as k.Receipt); return k.finishReceipts64(c, cursor); });
const retired = array(id, 0, 128, (c, values, r) => { const cursor = k.beginRetiredOwnIds128(c, r.side ?? (typeof values[0] === "string" && values[0][0] === "b" ? "b" : "w")); for (const v of values) k.appendRetiredOwnIds128(c, cursor, v as string); return k.finishRetiredOwnIds128(c, cursor); });
const enemyLoss = object([field("confirmedUnitCount", integer(128)), field("replacementLowerBound", integer(1152)), field("paidLowerBound", literal(0)), field("upper", literal("unknown")), field("completeness", literal("witnessed-only"))],
  (c, r) => k.makeEnemyLoss(c, r.confirmedUnitCount as number, r.replacementLowerBound as number));
const ledger = object([field("version", literal("challenge-economic-ledger-v1")), field("side", side), field("ownPaidDebits", integer(576)), field("ownPaidSurviving", integer(576)), field("ownPaidDestroyed", integer(576)), field("ownPaidWasted", integer(576)), field("ownReplacementDestroyed", integer(1152)), field("enemyLoss", enemyLoss), field("receipts", receipts), field("retiredOwnIds", retired)],
  (c, r) => k.makeEconomicLedger(c, r.side as Side, r.ownPaidDebits as number, r.ownPaidSurviving as number, r.ownPaidDestroyed as number, r.ownPaidWasted as number, r.ownReplacementDestroyed as number, r.enemyLoss as k.Ledger['enemyLoss'], r.receipts as readonly k.Receipt[], r.retiredOwnIds as readonly string[]));
const own = object([field("minerals", integer(12)), field("gas", integer(3)), field("gasIncome", integer(3)), field("ccLives", integer(3)), field("pieces", ownPieces), field("mines", squares(3)), field("siegedTanks", squares())],
  (c, r) => k.makeOwnState(c, r.minerals as number, r.gas as number, r.gasIncome as number, r.ccLives as number, r.pieces as k.Own['pieces'], r.mines as readonly Square[], r.siegedTanks as readonly Square[]));
const snapshot = object([field("version", literal("challenge-observation-v2")), field("side", side), field("turn", integer(45)), field("own", own), field("cells", cells), field("memory", memory), field("ownUnitLineage", units), field("ownMineLineage", mines), field("economicState", ledger)],
  (c, r) => k.makeSnapshotV2(c, r.side as Side, r.turn as number, r.own as k.Own, r.cells as Cells, r.memory as Memory, r.ownUnitLineage as readonly k.Unit[], r.ownMineLineage as readonly k.Mine[], r.economicState as k.Ledger));
const history = object([field("version", literal("challenge-history-v2")), field("currentAuthorizedSnapshotV2", snapshot), field("economicState", ledger), field("everLit", squares())],
  (c, r) => k.makeHistory(c, r.currentAuthorizedSnapshotV2 as AuthorizedSnapshotV2, r.economicState as k.Ledger, r.everLit as readonly Square[]));

const eventFieldNames: Record<k.Event['kind'], readonly string[]> = {
  "own-paid-receipt": ["kind", "seq", "receiptId", "actionRef", "unit", "requestedSquare", "minerals"], "own-gas-debited": ["kind", "seq", "actionRef", "gas"],
  "own-unit-endowed": ["kind", "seq", "id", "square", "type", "paidBasis"], "own-unit-created": ["kind", "seq", "lineageId", "receiptId", "square", "type"],
  "own-deployment-unmaterialized": ["kind", "seq", "receiptId", "paidMinerals"], "own-unit-moved": ["kind", "seq", "id", "from", "to"],
  "own-unit-transformed": ["kind", "seq", "id", "fromType", "toType", "paidDelta"], "own-unit-mode-changed": ["kind", "seq", "id", "mode"],
  "own-unit-destroyed": ["kind", "seq", "id", "typeAtLoss", "square", "retiredPaidBasis"], "own-mine-endowed": ["kind", "seq", "mineId", "actionRef", "square"],
  "own-mine-created": ["kind", "seq", "mineId", "actionRef", "square"], "own-mine-removed": ["kind", "seq", "mineId"], "own-income": ["kind", "seq", "actualCreditedMinerals"],
  "own-cc-lives-changed": ["kind", "seq", "before", "after"], "enemy-unit-destruction-witnessed": ["kind", "seq", "witnessId", "square", "type", "replacementLowerBound", "paidLowerBound"],
  "vision-witness": ["kind", "seq", "turn", "changes"],
};
const event = object([
  field("kind", string(33)), field("seq", integer(Number.MAX_SAFE_INTEGER, 1)), field("receiptId", id), field("actionRef", nullable(actionRef)), field("unit", type),
  field("requestedSquare", sq), field("minerals", integer(9, 1)), field("gas", integer(3, 1)), field("id", id), field("square", sq), field("type", type),
  field("paidBasis", literal(0)), field("lineageId", id), field("paidMinerals", integer(9, 1)), field("from", sq), field("to", sq), field("fromType", type), field("toType", type),
  field("paidDelta", literal(0)), field("mode", string(5)), field("typeAtLoss", type), field("retiredPaidBasis", integer(9)), field("mineId", id),
  field("actualCreditedMinerals", integer(3)), field("before", integer(3)), field("after", integer(3)), field("witnessId", id), field("replacementLowerBound", integer(9, 1)),
  field("paidLowerBound", literal(0)), field("turn", integer(45)), field("changes", changes),
], (c, r) => {
  const seq = r.seq as number, current = r.kind as k.Event['kind'];
  switch (current) {
    case "own-paid-receipt": return k.makeOwnPaidReceiptEvent(c, seq, r.receiptId as string, r.actionRef as k.ActionRef, r.unit as Exclude<k.Piece['type'], "k">, r.requestedSquare as Square, r.minerals as number);
    case "own-gas-debited": return k.makeOwnGasDebitedEvent(c, seq, r.actionRef as k.ActionRef, r.gas as number);
    case "own-unit-endowed": return k.makeOwnUnitEndowedEvent(c, seq, r.id as string, r.square as Square, r.type as k.Piece['type']);
    case "own-unit-created": return k.makeOwnUnitCreatedEvent(c, seq, r.lineageId as string, r.receiptId as string, r.square as Square, r.type as Exclude<k.Piece['type'], "k">);
    case "own-deployment-unmaterialized": return k.makeOwnDeploymentUnmaterializedEvent(c, seq, r.receiptId as string, r.paidMinerals as number);
    case "own-unit-moved": return k.makeOwnUnitMovedEvent(c, seq, r.id as string, r.from as Square, r.to as Square);
    case "own-unit-transformed": return k.makeOwnUnitTransformedEvent(c, seq, r.id as string, r.fromType as k.Piece['type'], r.toType as Exclude<k.Piece['type'], "k">);
    case "own-unit-mode-changed": return k.makeOwnUnitModeChangedEvent(c, seq, r.id as string, r.mode as "tank" | "siege");
    case "own-unit-destroyed": return k.makeOwnUnitDestroyedEvent(c, seq, r.id as string, r.typeAtLoss as Exclude<k.Piece['type'], "k">, r.square as Square, r.retiredPaidBasis as number);
    case "own-mine-endowed": if (r.actionRef !== null) return fail("SCHEMA"); return k.makeOwnMineEndowedEvent(c, seq, r.mineId as string, r.square as Square);
    case "own-mine-created": return k.makeOwnMineCreatedEvent(c, seq, r.mineId as string, r.actionRef as k.ActionRef, r.square as Square);
    case "own-mine-removed": return k.makeOwnMineRemovedEvent(c, seq, r.mineId as string);
    case "own-income": return k.makeOwnIncomeEvent(c, seq, r.actualCreditedMinerals as number);
    case "own-cc-lives-changed": return k.makeOwnCCLivesChangedEvent(c, seq, r.before as number, r.after as number);
    case "enemy-unit-destruction-witnessed": return k.makeEnemyUnitDestructionWitnessedEvent(c, seq, r.witnessId as string, r.square as Square, r.type as Exclude<k.Piece['type'], "k">, r.replacementLowerBound as number);
    case "vision-witness": return k.makeVisionWitnessEvent(c, seq, r.turn as number, r.changes as Cells);
  }
}, r => {
  switch (r.kind) {
    case "own-paid-receipt": case "own-gas-debited": case "own-unit-endowed": case "own-unit-created": case "own-deployment-unmaterialized": case "own-unit-moved":
    case "own-unit-transformed": case "own-unit-mode-changed": case "own-unit-destroyed": case "own-mine-endowed": case "own-mine-created": case "own-mine-removed":
    case "own-income": case "own-cc-lives-changed": case "enemy-unit-destruction-witnessed": case "vision-witness": return eventFieldNames[r.kind];
    default: return fail("SCHEMA");
  }
});
const events = array(event, 0, 2048, (c, values) => { const cursor = k.beginEvents2048(c); for (const v of values) k.appendEvents2048(c, cursor, v as k.Event); return k.finishEvents2048(c, cursor); });
const batch = object([field("version", literal("challenge-boundary-batch-v1")), field("side", side), field("ordinal", integer(128)), field("phase", string(9)), field("turn", integer(45)), field("planningOrdinal", integer(64)), field("seqBefore", integer()), field("seqThrough", integer()), field("events", events), field("snapshot", snapshot)],
  (c, r) => k.makeBoundaryBatch(c, r.side as Side, r.ordinal as number, r.phase as k.Batch['phase'], r.turn as number, r.planningOrdinal as number, r.seqBefore as number, r.seqThrough as number, r.events as readonly k.Event[], r.snapshot as AuthorizedSnapshotV2));
const action = object([field("kind", string(14)), field("timing", string(1)), field("color", side), field("from", sq), field("to", sq), field("unit", type), field("promotion", type)], (c, r) => {
  const side = r.color as Side, from = r.from as Square, to = r.to as Square, timing = r.timing as "B" | "F", promotion = r.promotion as Exclude<k.Piece['type'], "k"> | undefined;
  switch (r.kind) {
    case "classical": if (r.timing !== "C") return fail("SCHEMA"); return k.makeClassicalAction(c, side, from, to, promotion);
    case "deploy": return k.makeDeployAction(c, timing, side, from, to, r.unit as Exclude<k.Piece['type'], "k">);
    case "stimStep": return k.makeStimStepAction(c, timing, side, from, to, promotion);
    case "spiderMine": return k.makeSpiderMineAction(c, timing, side, from, r.to as Square | undefined);
    case "charonMissiles": return k.makeCharonMissilesAction(c, timing, side, from, to);
    case "siegeMode": return k.makeSiegeModeAction(c, timing, side, from, r.to as Square | undefined);
    case "tacticalJump": return k.makeTacticalJumpAction(c, timing, side, from, to);
    default: return fail("SCHEMA");
  }
}, r => {
  switch (r.kind) {
    case "classical": case "stimStep": return r.promotion === undefined ? ["kind", "timing", "color", "from", "to"] : ["kind", "timing", "color", "from", "to", "promotion"];
    case "deploy": return ["kind", "timing", "color", "from", "to", "unit"];
    case "charonMissiles": case "tacticalJump": return ["kind", "timing", "color", "from", "to"];
    case "spiderMine": case "siegeMode": return r.to === undefined ? ["kind", "timing", "color", "from"] : ["kind", "timing", "color", "from", "to"];
    default: return fail("SCHEMA");
  }
});
const actions = array(action, 0, 65, (c, values) => {
  const cursor = k.beginActions65(c); for (const v of values) k.appendActions65(c, cursor, v as Parameters<typeof k.appendActions65>[2]); return k.finishActions65(c, cursor);
});
const spend = object([field("minerals", integer(585)), field("gas", integer(195))], (_, r) => r);
const candidate = object([field("version", literal("challenge-candidate-codec-v1")), field("key", string(32768)), field("actions", actions), field("ownSpend", spend)], (c, r) => {
  const values = r.actions as Parameters<typeof k.makeCandidate>[2], claimed = r.ownSpend as Parsed;
  const result = k.makeCandidate(c, values[0]?.color ?? "w", values);
  if (result.key !== r.key || result.ownSpend.minerals !== claimed.minerals || result.ownSpend.gas !== claimed.gas) return fail("DERIVED");
  return result;
});

const opening = object([field("version", literal("starchess-economic-opening-v1")), field("turn", literal(0)),
  field("bank", object([field("w", literal(3)), field("b", literal(3))], (_, r) => r)),
  field("cc", object([field("w", literal("e1")), field("b", literal("e8"))], (_, r) => r)),
  field("marines", object([field("w", tuple([literal("c2"), literal("d2"), literal("e2"), literal("f2")], (_, v) => v)),
    field("b", tuple([literal("c7"), literal("d7"), literal("e7"), literal("f7")], (_, v) => v))], (_, r) => r))], () => k.constructCanonicalOpening());
const recipe = object([field("version", literal("starchess-economic-recipe-v1")), field("supportVersion", literal("economic-accounting-relaxation-v1")),
  field("graphVersion", literal("positive-headstock-suffix-v1")), field("innovationVersion", literal("authorized-economic-innovation-v1")), field("geometryVersion", literal("authorized-promotion-geometry-v1")),
  field("calibrationVersion", literal("starchess-economic-calibration-v1")), field("workCap", literal(1048576)), field("materialCeiling", literal(576)), field("bankCap", literal(12)),
  field("bandStarts", tuple(BAND_STARTS.map(v => literal(v)), (_, v) => v)), field("alpha", h), field("minimumGroups", literal(32)),
  field("diagnosticHorizons", tuple([literal(1), literal(2), literal(3)], (_, v) => v))], (c, r) => k.makeEconomicRecipe(c, r.alpha as k.OwnedFloat64Hex));
const transitionRow = tuple([integer(9), integer(9), integer(9), integer(32), integer(617), h], (c, v) => k.makeTransitionRow(c, v[0] as number, v[1] as number, v[2] as number, v[3] as number, v[4] as number, v[5] as k.OwnedFloat64Hex));
const evidenceRow = tuple([integer(3), integer(3), integer(2), h], (c, v) => k.makeEvidenceRow(c, v[0] as number, v[1] as number, v[2] as number, v[3] as k.OwnedFloat64Hex));
const transitionRows = array(transitionRow, 0, 8192, (c, v) => { const cursor = k.beginTransitionRows8192(c); for (const x of v) k.appendTransitionRows8192(c, cursor, x as Parameters<typeof k.appendTransitionRows8192>[2]); return k.finishTransitionRows8192(c, cursor); }, true);
const evidenceRows = array(evidenceRow, 0, 8192, (c, v) => { const cursor = k.beginEvidenceRows8192(c); for (const x of v) k.appendEvidenceRows8192(c, cursor, x as Parameters<typeof k.appendEvidenceRows8192>[2]); return k.finishEvidenceRows8192(c, cursor); }, true);

const table = object([field("kind", string(10)), field("level", integer(3)), field("bank", nullable(integer(12))), field("band", nullable(integer(18))), field("tier", nullable(integer(2))), field("groups", integer(14400)), field("rows", { kind: "table-rows" })], (c, r) =>
  r.kind === "transition" ? k.makeTransitionTable(c, r.level as number, r.bank as number | null, r.band as number | null, r.tier as number | null, r.groups as number, r.rows as Parameters<typeof k.makeTransitionTable>[6]) :
    k.makeEvidenceTable(c, r.level as number, r.bank as number | null, r.band as number | null, r.tier as number | null, r.groups as number, r.rows as Parameters<typeof k.makeEvidenceTable>[6]));
const tables = array(table, 0, 1588, (c, v) => { const cursor = k.beginTables1588(c); for (const x of v) k.appendTables1588(c, cursor, x as Table); return k.finishTables1588(c, cursor); });
const bin = tuple([integer(45), integer(45), integer(64), integer(64)], (c, v) => k.makePartitionBin(c, v[0] as number, v[1] as number, v[2] as number, v[3] as number));
const partition = array(bin, 3, 12, (c, v) => { const cursor = k.beginPartition(c); for (const x of v) k.appendPartition(c, cursor, x as Bin); return k.finishPartition(c, cursor); });
const temperatures = array(h, 3, 12, (_, v) => v);
const artifact = object([field("version", literal("starchess-economic-artifact-v1")), field("status", literal("FROZEN")), field("opening", opening), field("recipe", recipe), field("tables", tables), field("partition", partition), field("temperatures", temperatures)], (c, r) => {
  const bins = r.partition as readonly Bin[], cursor = k.beginTemperatures(c, bins);
  for (const value of r.temperatures as readonly k.OwnedFloat64Hex[]) k.appendTemperatures(c, cursor, value);
  return k.makeEconomicArtifact(c, r.opening as k.OwnedPublicOpening, r.recipe as EconomicRecipe, r.tables as readonly Table[], bins, k.finishTemperatures(c, cursor));
});
const manifestEntry = object([field("name", string()), field("meaningId", string(32)), field("scaleId", string(32))], (_, r) => r);
const scales = object([field("minerals", literal(12)), field("gas", literal(3)), field("turn", literal(45)), field("ccLives", literal(3)), field("maxSpawn", literal(9)),
  field("paid", literal(3072)), field("replacement", literal(2304)), field("coords", literal(7)), field("squares", literal(64)), field("actions", literal(4)), field("pairs", literal(6)),
  field("relationPairs", literal(4096)), field("visionOverlap", literal(256)), field("files", literal(8))], (_, r) => r);
const manifest = object([field("version", literal("challenge-feature-manifest-v3")), field("dimension", literal(418)), field("names", array(string(), 418, 418, (_, v) => v)),
  field("entries", array(manifestEntry, 418, 418, (_, v) => v)), field("scales", scales)], c => k.makeCanonicalManifestV3(c));
const pin = object([field("version", literal("starchess-economic-pin-v1")), field("economicArtifactRef", ref), field("estimatorProvenanceRef", ref), field("featureManifestRef", ref), field("amendmentRef", ref)],
  (c, r) => k.makeEconomicPin(c, r.economicArtifactRef as k.OwnedByteRef, r.estimatorProvenanceRef as k.OwnedByteRef, r.featureManifestRef as k.OwnedByteRef, r.amendmentRef as k.OwnedByteRef));
const binding = object([field("version", literal("starchess-economic-binding-v1")), field("policyArtifactRef", ref), field("economicArtifactRef", ref), field("estimatorProvenanceRef", ref), field("featureManifestRef", ref), field("amendmentRef", ref)],
  (c, r) => k.makeEconomicBinding(c, r.policyArtifactRef as k.OwnedByteRef, r.economicArtifactRef as k.OwnedByteRef, r.estimatorProvenanceRef as k.OwnedByteRef, r.featureManifestRef as k.OwnedByteRef, r.amendmentRef as k.OwnedByteRef));
const provenance = object([field("version", literal("starchess-estimator-provenance-v1")), field("economicArtifactRef", ref), field("coreRulesRef", ref), field("fittingCodeRef", ref), field("collectionRecipeRef", ref), field("fittingRecipeRef", ref),
  field("collectionRosterRef", ref), field("splitRosterRef", ref), field("labelBytesRef", ref), field("fitJournalRef", ref), field("calibrationJournalRef", ref)],
  (c, r) => k.makeEstimatorProvenance(c, r.economicArtifactRef as k.OwnedByteRef, r.coreRulesRef as k.OwnedByteRef, r.fittingCodeRef as k.OwnedByteRef, r.collectionRecipeRef as k.OwnedByteRef, r.fittingRecipeRef as k.OwnedByteRef, r.collectionRosterRef as k.OwnedByteRef, r.splitRosterRef as k.OwnedByteRef, r.labelBytesRef as k.OwnedByteRef, r.fitJournalRef as k.OwnedByteRef, r.calibrationJournalRef as k.OwnedByteRef));
const authority = object([field("version", literal("starchess-economic-authority-v1")), field("contractsRef", ref), field("r2GeneratorRef", ref), field("baseRef", ref), field("correctiveRef", ref), field("r3SeamRef", ref), field("r3NativeCorrectionRef", ref), field("ownedIngressRef", ref)],
  (c, r) => k.makeEconomicAuthority(c, r.contractsRef as k.OwnedByteRef, r.r2GeneratorRef as k.OwnedByteRef, r.baseRef as k.OwnedByteRef, r.correctiveRef as k.OwnedByteRef, r.r3SeamRef as k.OwnedByteRef, r.r3NativeCorrectionRef as k.OwnedByteRef, r.ownedIngressRef as k.OwnedByteRef));
const limits = object([field("startupMs", literal(10000)), field("planMs", literal(10000)), field("matchMs", literal(300000)), field("maxWindows", literal(64)), field("maxRecordedPlies", literal(128)), field("maxProposals", literal(4096)), field("maxIpcMessages", literal(2048)), field("maxProgressBytes", literal(1048576)), field("maxCompletionBytes", literal(16777216))], c => k.makeHostLimits(c));
const validation = object([field("profile", literal("A")), field("eps", tuple([h], (_, v) => v)), field("atol", h), field("rtol", h)],
  (c, r) => k.makeValidation(c, (r.eps as readonly k.OwnedFloat64Hex[])[0]!, r.atol as k.OwnedFloat64Hex, r.rtol as k.OwnedFloat64Hex));
const profiles = object([field("api", literal("A")), field("provenance", literal("A")), field("quota", literal("B")), field("curriculum", literal("A")), field("validation", literal("A"))], (_, r) => r);
const configuration = object([field("profiles", profiles), field("horizon", literal(1)), field("dimension", literal(418)), field("uniqueCap", literal(512)), field("workCap", literal(2048)), field("maxGeneratedActions", literal(4)),
  field("familyCapacity", literal(48)), field("compositionCapacity", literal(175)), field("passCapacity", literal(1)), field("maxStartedPerMaster", literal(1000)),
  field("masters", tuple([literal(101), literal(102), literal(103), literal(104), literal(105)], (_, v) => v)), field("checkpointCadence", literal(100)), field("initialization", literal("zeros")),
  field("arithmetic", literal("float64-cpu")), field("optimizer", literal("SGD")), field("learningRate", h), field("temperature", h), field("l2", h), field("clipping", literal("none")),
  field("baseline", literal("per-seed-all-history-eligible-mean")), field("emptyDecision", literal("diagnostic-only")), field("abortPolicy", literal("stop-all")), field("primaryMaster", literal(101)),
  field("openingRef", ref), field("hostLimits", limits), field("validation", validation)],
  (c, r) => k.makeConfiguration418(c, r.learningRate as k.OwnedFloat64Hex, r.temperature as k.OwnedFloat64Hex, r.l2 as k.OwnedFloat64Hex, r.openingRef as k.OwnedByteRef, r.hostLimits as HostLimits, r.validation as Configuration418['validation']));
const versions = object([field("snapshot", literal("challenge-observation-v2")), field("observationCodec", literal("challenge-observation-codec-v2")), field("history", literal("challenge-history-v2")), field("batch", literal("challenge-boundary-batch-v1")),
  field("ledger", literal("challenge-economic-ledger-v1")), field("provenance", literal("engine-provenance-v1")), field("candidateCodec", literal("challenge-candidate-codec-v1")), field("generator", literal("challenge-composition-v3")), field("projection", literal("authorized-own-projection-v1")),
  field("features", literal("challenge-features-v3")), field("featureManifest", literal("challenge-feature-manifest-v3")), field("comparator", literal("score-desc-key-asc-v1")), field("rng", literal("starchess-training-rng-v1")), field("episodeProtocol", literal("starchess-training-episode-v2")),
  field("checkpoint", literal("starchess-training-checkpoint-v2")), field("artifact", literal("starchess-training-artifact-v2")), field("optimizer", literal("starchess-sgd-float64-v1")), field("loss", literal("starchess-reinforce-sum-v1")), field("eligibility", literal("starchess-training-eligibility-v1")),
  field("recipe", literal("starchess-training-recipe-v2")), field("hostConfig", literal("starchess-training-host-v2"))], c => k.makeVersions418(c));
const trainingRecipe = object([field("version", literal("starchess-training-recipe-v2")), field("configuration", configuration), field("versions", versions), field("economicPinRef", ref)],
  (c, r) => k.makeTrainingRecipe(c, r.configuration as Configuration418, r.versions as Versions418, r.economicPinRef as k.OwnedByteRef));

const decode = <T>(c: k.ConstructionContext, value: unknown, production: k.ByteProduction, schema: Schema,
  emit: (c: k.ConstructionContext, value: unknown) => Uint8Array, planning: boolean, side?: Side): T => {
  if (planning) k.requirePlanningMeter(c); else k.requireStartupArtifactContext(c);
  let boundaryTicket: ReturnType<typeof k.beginBoundaryBatchDecode> | undefined;
  try {
  const bytes = k.requireSnapshot(value, production), length = k.snapshotLength(bytes);
  if (production === "boundaryBatch") boundaryTicket = k.beginBoundaryBatchDecode(c as Meter, bytes);
  else if (planning) {
    const units = 2048 + 96 * length;
    if (units > 1048576) return fail("WORK_CAP");
    k.consumeWorkBlock(c, "scalar", units, "$.schema");
  }
  const r: Reader = { bytes, length, offset: 0, dry: true, rows: 0, context: c, side };
  parse(r, schema); if (r.offset !== length) return fail();
  r.offset = 0; r.rows = 0; r.dry = false;
  const result = parse(r, schema) as T;
  if (r.offset !== length) return fail();
  const canonical = emit(c, result);
  if (canonical.length !== length) return fail();
  for (let i = 0; i < length; i++) if (canonical[i] !== k.readSnapshotByte(bytes, i)) return fail();
  if (boundaryTicket) {
    k.completeBoundaryBatchBytes(c, bytes, result as k.Batch);
    k.finishBoundaryBatchDecode(c as Meter, boundaryTicket);
    boundaryTicket = undefined;
  } else {
    const original = new FixedUint8Array(length);
    for (let i = 0; i < length; i++) original[i] = k.readSnapshotByte(bytes, i);
    const originalHash = new SHA256("SHA-256", "UINT8ARRAY"), canonicalHash = new SHA256("SHA-256", "UINT8ARRAY");
    originalHash.update(original); canonicalHash.update(canonical);
    if (originalHash.getHash("HEX") !== canonicalHash.getHash("HEX")) return fail();
  }
  return result;
  } catch (error) {
    if (boundaryTicket) { try { k.abortBoundaryBatchDecode(c as Meter, boundaryTicket); } catch { } }
    if (planning) { try { k.abortPlanningWork(c); } catch { } }
    throw error;
  }
};
export const decodeOwnedEconomicArtifact = (c: k.StartupArtifactContext, bytes: unknown): EconomicArtifact => decode(c, bytes, "economicArtifact", artifact, k.encodeOwnedEconomicArtifact, false);
export const decodeOwnedFeatureManifest = (c: k.StartupArtifactContext, bytes: unknown): FeatureManifestV3 => decode(c, bytes, "featureManifest", manifest, k.encodeOwnedFeatureManifest, false);
export const decodeOwnedPin = (c: k.StartupArtifactContext, bytes: unknown): EconomicPin => decode(c, bytes, "pin", pin, k.encodeOwnedPin, false);
export const decodeOwnedBinding = (c: k.StartupArtifactContext, bytes: unknown): EconomicBinding => decode(c, bytes, "binding", binding, k.encodeOwnedBinding, false);
export const decodeOwnedEstimatorProvenance = (c: k.StartupArtifactContext, bytes: unknown): EstimatorProvenance => decode(c, bytes, "estimatorProvenance", provenance, k.encodeOwnedEstimatorProvenance, false);
export const decodeOwnedAuthority = (c: k.StartupArtifactContext, bytes: unknown): EconomicAuthority => decode(c, bytes, "authority", authority, k.encodeOwnedAuthority, false);
export const decodeOwnedTrainingRecipe = (c: k.StartupArtifactContext, bytes: unknown): TrainingRecipeV2 => decode(c, bytes, "trainingRecipe", trainingRecipe, k.encodeOwnedTrainingRecipe, false);
export const decodeOwnedBoundaryBatch = (c: Meter, bytes: unknown): k.Batch => decode(c, bytes, "boundaryBatch", batch, k.encodeOwnedBoundaryBatch, true);
export const decodeOwnedHistory = (c: Meter, bytes: unknown): ReturnType<typeof k.requireHistory> => decode(c, bytes, "history", history, k.encodeOwnedHistory, true);
export const decodeOwnedCandidate = (c: Meter, bytes: unknown, side?: Side): ReturnType<typeof k.requireCandidate> => {
  const result = decode<ReturnType<typeof k.requireCandidate>>(c, bytes, "candidate", candidate, k.encodeOwnedCandidate, true, side);
  if (side !== undefined && side !== "w" && side !== "b" || side !== undefined && result.actions.some(a => a.color !== side)) return fail("SIDE");
  return result;
};
