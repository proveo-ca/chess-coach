import { UNIT_COST } from "@chess-coach/starchess-core/planning-v1";
import { actionRef, array, byteEqual, bytes, cell, copyBytes, equal, fail, freeze, id, integer, literal, object, ordered, parseBytes, piece, replacement, side, spawn, square, squares, SQUARES, tag, unitType, version } from "./schema";
import type { AuthorizedHistory, AuthorizedSnapshotV2, EconomicState, OwnMineLineage, OwnUnitLineage, PaidReceipt, Side, Sighting } from "./types";

export const readEconomicState = (value: unknown, p: string, color: Side): EconomicState => {
  const r = object(value, p, ["version", "side", "ownPaidDebits", "ownPaidSurviving", "ownPaidDestroyed", "ownPaidWasted", "ownReplacementDestroyed", "enemyLoss", "receipts", "retiredOwnIds"]);
  version(r.version, `${p}.version`, "challenge-economic-ledger-v1");
  if (side(r.side, `${p}.side`) !== color) fail(`${p}.side`, "SIDE");
  const receipts = array(r.receipts, `${p}.receipts`, 64, (v, at): PaidReceipt => {
    const x = object(v, at, ["receiptId", "actionRef", "unit", "requestedSquare", "minerals", "disposition"]);
    const receiptId = id(x.receiptId, `${at}.receiptId`, color, "receipt");
    const ref = actionRef(x.actionRef, `${at}.actionRef`);
    if (receiptId !== `${color}:receipt:${ref.planningOrdinal}:${ref.acceptedActionOrdinal}`) fail(`${at}.receiptId`, "IDENTITY");
    const unit = spawn(x.unit, `${at}.unit`);
    const minerals = integer(x.minerals, `${at}.minerals`, 1, 9);
    if (minerals !== UNIT_COST[unit]) fail(`${at}.minerals`, "DERIVED");
    const kind = tag(x.disposition, `${at}.disposition`, "kind");
    const d = object(x.disposition, `${at}.disposition`, kind === "materialized" ? ["kind", "lineageId"] : ["kind"]);
    const disposition = kind === "materialized"
      ? { kind, lineageId: id(d.lineageId, `${at}.disposition.lineageId`, color, "unit") } as const
      : { kind: literal(kind, `${at}.disposition.kind`, "unmaterialized") };
    if (disposition.kind === "materialized" && !disposition.lineageId.startsWith(`${color}:unit:created:`)) fail(`${at}.disposition.lineageId`, "IDENTITY");
    return { receiptId, actionRef: ref, unit, requestedSquare: square(x.requestedSquare, `${at}.requestedSquare`), minerals, disposition };
  });
  ordered(receipts, x => x.receiptId, `${p}.receipts`);
  if (new Set(receipts.map(x => x.actionRef.planningOrdinal)).size !== receipts.length) fail(`${p}.receipts`, "IDENTITY");
  const created = receipts.flatMap(x => x.disposition.kind === "materialized" ? [x.disposition.lineageId] : []);
  if (new Set(created).size !== created.length || created.some((_, i) => !created.includes(`${color}:unit:created:${i + 1}`))) fail(`${p}.receipts`, "IDENTITY");
  const births = receipts.filter(x => x.disposition.kind === "materialized").sort((a, b) => a.actionRef.planningOrdinal - b.actionRef.planningOrdinal);
  if (births.some((x, i) => x.disposition.kind === "materialized" && x.disposition.lineageId !== `${color}:unit:created:${i + 1}`)) fail(`${p}.receipts`, "IDENTITY");
  const retiredOwnIds = array(r.retiredOwnIds, `${p}.retiredOwnIds`, 128, (v, at) => id(v, at, color, "unit"));
  ordered(retiredOwnIds, x => x, `${p}.retiredOwnIds`);
  if (retiredOwnIds.some(x => x.includes(":created:") && !created.includes(x))) fail(`${p}.retiredOwnIds`, "IDENTITY");
  const ownPaidDebits = integer(r.ownPaidDebits, `${p}.ownPaidDebits`, 0, 576);
  const ownPaidSurviving = integer(r.ownPaidSurviving, `${p}.ownPaidSurviving`, 0, 576);
  const ownPaidDestroyed = integer(r.ownPaidDestroyed, `${p}.ownPaidDestroyed`, 0, 576);
  const ownPaidWasted = integer(r.ownPaidWasted, `${p}.ownPaidWasted`, 0, 576);
  const ownReplacementDestroyed = integer(r.ownReplacementDestroyed, `${p}.ownReplacementDestroyed`, 0, 1152);
  const wasted = receipts.filter(x => x.disposition.kind === "unmaterialized").reduce((n, x) => n + x.minerals, 0);
  const destroyed = receipts.filter(x => x.disposition.kind === "materialized" && retiredOwnIds.includes(x.disposition.lineageId)).reduce((n, x) => n + x.minerals, 0);
  if (ownPaidDebits !== receipts.reduce((n, x) => n + x.minerals, 0) || ownPaidWasted !== wasted || ownPaidDestroyed !== destroyed ||
    ownPaidDebits !== ownPaidSurviving + ownPaidDestroyed + ownPaidWasted || ownReplacementDestroyed < retiredOwnIds.length || ownReplacementDestroyed > retiredOwnIds.length * 9) fail(p, "CONSERVATION");
  const loss = object(r.enemyLoss, `${p}.enemyLoss`, ["confirmedUnitCount", "replacementLowerBound", "paidLowerBound", "upper", "completeness"]);
  const confirmedUnitCount = integer(loss.confirmedUnitCount, `${p}.enemyLoss.confirmedUnitCount`, 0, 128);
  const replacementLowerBound = integer(loss.replacementLowerBound, `${p}.enemyLoss.replacementLowerBound`, 0, 1152);
  if (replacementLowerBound < confirmedUnitCount || replacementLowerBound > 9 * confirmedUnitCount) fail(`${p}.enemyLoss`, "CONSERVATION");
  return {
    version: "challenge-economic-ledger-v1", side: color, ownPaidDebits, ownPaidSurviving, ownPaidDestroyed, ownPaidWasted, ownReplacementDestroyed,
    enemyLoss: { confirmedUnitCount, replacementLowerBound, paidLowerBound: literal(loss.paidLowerBound, `${p}.enemyLoss.paidLowerBound`, 0), upper: literal(loss.upper, `${p}.enemyLoss.upper`, "unknown"), completeness: literal(loss.completeness, `${p}.enemyLoss.completeness`, "witnessed-only") },
    receipts, retiredOwnIds,
  };
};
export const readMineLineage = (v: unknown, p: string, color: Side): OwnMineLineage[] => {
  const result = array(v, p, 3, (v, at): OwnMineLineage => {
    const x = object(v, at, ["mineId", "square"]);
    return { mineId: id(x.mineId, `${at}.mineId`, color, "mine"), square: square(x.square, `${at}.square`) };
  });
  ordered(result, x => `${x.square}:${x.mineId}`, p);
  if (new Set(result.map(x => x.mineId)).size !== result.length) fail(p, "IDENTITY");
  if (result.some(x => x.mineId.includes(":opening:") && x.mineId !== `${color}:mine:opening:${x.square}`)) fail(p, "IDENTITY");
  return result;
};
export const readSnapshot = (value: unknown, p = "$"): AuthorizedSnapshotV2 => {
  const r = object(value, p, ["version", "side", "turn", "own", "cells", "memory", "ownUnitLineage", "ownMineLineage", "economicState"]);
  version(r.version, `${p}.version`, "challenge-observation-v2");
  const color = side(r.side, `${p}.side`);
  const turn = integer(r.turn, `${p}.turn`, 0, 45);
  const own = object(r.own, `${p}.own`, ["minerals", "gas", "gasIncome", "ccLives", "pieces", "mines", "siegedTanks"]);
  const minerals = integer(own.minerals, `${p}.own.minerals`, 0, 12);
  const gasIncome = integer(own.gasIncome, `${p}.own.gasIncome`, 0, 3);
  const gas = integer(own.gas, `${p}.own.gas`, 0, gasIncome);
  const ccLives = integer(own.ccLives, `${p}.own.ccLives`, 0, 3);
  const cells = array(r.cells, `${p}.cells`, 64, (v, at, i) => {
    const current = cell(v, at, color);
    if (current.square !== SQUARES[i]) fail(`${at}.square`, "ORDER");
    return current;
  }, 64);
  const pieces = array(own.pieces, `${p}.own.pieces`, 64, (v, at) => {
    const x = object(v, at, ["square", "piece"]);
    const current = piece(x.piece, `${at}.piece`);
    if (current.color !== color) fail(`${at}.piece.color`, "SIDE");
    return { square: square(x.square, `${at}.square`), piece: current };
  }, 1);
  ordered(pieces, x => x.square, `${p}.own.pieces`);
  const expectedPieces = cells.flatMap(x => x.visibility !== "unknown" && x.piece?.color === color ? [{ square: x.square, piece: x.piece }] : []);
  if (!equal(pieces, expectedPieces) || pieces.filter(x => x.piece.type === "k").length !== 1) fail(`${p}.own.pieces`, "CONSISTENCY");
  const mines = squares(own.mines, `${p}.own.mines`, 3);
  const siegedTanks = squares(own.siegedTanks, `${p}.own.siegedTanks`);
  if (mines.some(at => cells[SQUARES.indexOf(at)]!.visibility !== "lit") || siegedTanks.some(at => !pieces.some(x => x.square === at && x.piece.type === "r"))) fail(`${p}.own`, "CONSISTENCY");
  const memory = array(r.memory, `${p}.memory`, 64, (v, at): Sighting => {
    const x = object(v, at, ["square", "piece", "observedTurn"]);
    const current = piece(x.piece, `${at}.piece`);
    if (current.color === color) fail(`${at}.piece.color`, "SIDE");
    return { square: square(x.square, `${at}.square`), piece: current, observedTurn: integer(x.observedTurn, `${at}.observedTurn`, 0, turn) };
  });
  ordered(memory, x => x.square, `${p}.memory`);
  for (const current of cells) {
    if (current.visibility === "unknown") continue;
    const remembered = memory.find(x => x.square === current.square);
    if (current.piece && current.piece.color !== color) {
      if (!remembered || remembered.observedTurn !== turn || !equal(remembered.piece, current.piece)) fail(`${p}.memory`, "CONSISTENCY");
    } else if (remembered) fail(`${p}.memory`, "CONSISTENCY");
  }
  const ownUnitLineage = array(r.ownUnitLineage, `${p}.ownUnitLineage`, 64, (v, at): OwnUnitLineage => {
    const x = object(v, at, ["id", "square", "type", "paidBasis", "replacementValue"]);
    const type = unitType(x.type, `${at}.type`);
    const paidBasis = integer(x.paidBasis, `${at}.paidBasis`, 0, 9);
    const replacementValue = integer(x.replacementValue, `${at}.replacementValue`, 0, 9);
    if (replacementValue !== replacement(type)) fail(`${at}.replacementValue`, "DERIVED");
    return { id: id(x.id, `${at}.id`, color, "unit"), square: square(x.square, `${at}.square`), type, paidBasis, replacementValue };
  }, 1);
  ordered(ownUnitLineage, x => x.square, `${p}.ownUnitLineage`);
  if (new Set(ownUnitLineage.map(x => x.id)).size !== ownUnitLineage.length || !equal(ownUnitLineage.map(x => ({ square: x.square, piece: { type: x.type, color } })), pieces)) fail(`${p}.ownUnitLineage`, "CONSISTENCY");
  const ownMineLineage = readMineLineage(r.ownMineLineage, `${p}.ownMineLineage`, color);
  if (!equal(mines, [...new Set(ownMineLineage.map(x => x.square))].sort())) fail(`${p}.ownMineLineage`, "CONSISTENCY");
  const economicState = readEconomicState(r.economicState, `${p}.economicState`, color);
  const materialized = economicState.receipts.filter(x => x.disposition.kind === "materialized");
  for (const lineage of ownUnitLineage) {
    if (economicState.retiredOwnIds.includes(lineage.id)) fail(`${p}.ownUnitLineage`, "IDENTITY");
    if (lineage.type === "k" && !lineage.id.includes(":opening:")) fail(`${p}.ownUnitLineage`, "IDENTITY");
    const receipt = materialized.find(x => x.disposition.kind === "materialized" && x.disposition.lineageId === lineage.id);
    if (lineage.id.includes(":opening:")) {
      if (lineage.paidBasis !== 0 || receipt) fail(`${p}.ownUnitLineage`, "CONSERVATION");
    } else if (!receipt || receipt.minerals !== lineage.paidBasis) fail(`${p}.ownUnitLineage`, "CONSERVATION");
  }
  if (materialized.some(x => {
    const disposition = x.disposition;
    return disposition.kind === "materialized" && !ownUnitLineage.some(l => l.id === disposition.lineageId) && !economicState.retiredOwnIds.includes(disposition.lineageId);
  })) fail(`${p}.economicState.receipts`, "IDENTITY");
  if (ownUnitLineage.reduce((n, x) => n + x.paidBasis, 0) !== economicState.ownPaidSurviving) fail(`${p}.economicState`, "CONSERVATION");
  return { version: "challenge-observation-v2", side: color, turn, own: { minerals, gas, gasIncome, ccLives, pieces, mines, siegedTanks }, cells, memory, ownUnitLineage, ownMineLineage, economicState };
};
export const validateObservation = (value: unknown): AuthorizedSnapshotV2 => {
  const result = readSnapshot(value);
  bytes(result);
  return freeze(result);
};
export const encodeObservation = (snapshot: AuthorizedSnapshotV2): Uint8Array => bytes({ codecVersion: "challenge-observation-codec-v2", observation: readSnapshot(snapshot) });
export const decodeObservation = (input: Uint8Array): AuthorizedSnapshotV2 => {
  const copy = copyBytes(input);
  const r = object(parseBytes(copy), "$", ["codecVersion", "observation"]);
  version(r.codecVersion, "$.codecVersion", "challenge-observation-codec-v2");
  const snapshot = readSnapshot(r.observation);
  if (!byteEqual(copy, encodeObservation(snapshot))) fail("$", "JSON");
  return freeze(snapshot);
};
export const readHistory = (value: unknown): AuthorizedHistory => {
  const r = object(value, "$", ["version", "currentAuthorizedSnapshotV2", "economicState", "everLit"]);
  version(r.version, "$.version", "challenge-history-v2");
  const snapshot = readSnapshot(r.currentAuthorizedSnapshotV2, "$.currentAuthorizedSnapshotV2");
  const economicState = readEconomicState(r.economicState, "$.economicState", snapshot.side);
  if (!equal(economicState, snapshot.economicState)) fail("$.economicState", "CONSISTENCY");
  const everLit = squares(r.everLit, "$.everLit");
  if (snapshot.cells.some(x => x.visibility === "lit" && !everLit.includes(x.square))) fail("$.everLit", "CONSISTENCY");
  const result: AuthorizedHistory = { version: "challenge-history-v2", currentAuthorizedSnapshotV2: snapshot, economicState, everLit };
  bytes(result);
  return freeze(result);
};
