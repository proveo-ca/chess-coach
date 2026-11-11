// SPEC: _spec/observations.puml
import { UNIT_COST } from "../../game-core/src/constants";
import { sq } from "../../game-core/src/board";
import type { Observation } from "./shape";

export type SemanticIssue = { path: (string | number)[]; message: string };

export function observationIssues(snapshot: Observation): SemanticIssue[] {
  const issues: SemanticIssue[] = [];
  const issue = (path: (string | number)[], message: string): void => { issues.push({ path, message }); };
  const ordered = <T>(values: readonly T[], key: (value: T) => string, path: string[]): void => {
    if (values.some((value, index) => index > 0 && key(values[index - 1]!) >= key(value))) issue(path, "Expected unique sorted entries");
  };
  const samePiece = (a: { type: string; color: string }, b: { type: string; color: string }): boolean => a.type === b.type && a.color === b.color;
  const own = snapshot.own;
  const side = snapshot.side;
  const cells = new Map(snapshot.cells.map(cell => [cell.square, cell]));
  const pieces = new Map(own.pieces.map(entry => [entry.square, entry.piece]));
  const memory = new Map(snapshot.memory.map(entry => [entry.square, entry]));
  if (own.gas > own.gasIncome) issue(["own", "gas"], "Gas exceeds current income");
  ordered(own.pieces, entry => entry.square, ["own", "pieces"]);
  ordered(own.mines, at => at, ["own", "mines"]);
  ordered(own.siegedTanks, at => at, ["own", "siegedTanks"]);
  ordered(snapshot.memory, entry => entry.square, ["memory"]);
  ordered(snapshot.everLit, at => at, ["everLit"]);
  if (own.pieces.filter(entry => entry.piece.type === "k").length !== 1) issue(["own", "pieces"], "Expected one own Command Center");
  snapshot.cells.forEach((cell, index) => {
    if (cell.square !== sq(Math.floor(index / 8), index % 8 + 1)) issue(["cells", index, "square"], "Expected file-major square order");
    if (cell.visibility === "unknown") return;
    if (cell.visibility === "lit" && !snapshot.everLit.includes(cell.square)) issue(["everLit"], "Lit cells must belong to recipient light history");
    if (cell.visibility === "revealed" && (cell.piece.type !== "q" || cell.piece.color === side)) issue(["cells", index], "Only enemy BattleShips can remain revealed under fog");
    const remembered = memory.get(cell.square);
    if (cell.piece?.color === side) {
      const owned = pieces.get(cell.square);
      if (!owned || !samePiece(owned, cell.piece)) issue(["cells", index], "Own piece does not match own state");
    }
    if (cell.piece && cell.piece.color !== side) {
      if (!remembered || remembered.observedTurn !== snapshot.turn || !samePiece(remembered.piece, cell.piece)) issue(["memory"], "Visible enemy requires a current sighting");
    } else if (remembered) issue(["memory"], "Visible empty or own cell must clear enemy memory");
  });
  own.pieces.forEach((entry, index) => {
    const cell = cells.get(entry.square);
    if (entry.piece.color !== side || !cell || cell.visibility !== "lit" || !cell.piece || !samePiece(entry.piece, cell.piece)) issue(["own", "pieces", index], "Own pieces must match lit cells");
  });
  for (const at of own.mines) if (cells.get(at)?.visibility !== "lit") issue(["own", "mines"], "Own mines must light their cells");
  for (const at of own.siegedTanks) if (pieces.get(at)?.type !== "r") issue(["own", "siegedTanks"], "Siege mode requires an own Tank");
  snapshot.memory.forEach((entry, index) => {
    if (entry.piece.color === side || entry.observedTurn > snapshot.turn) issue(["memory", index], "Invalid recipient enemy memory");
  });

  const ledger = snapshot.economy;
  if (ledger.side !== side) issue(["economy", "side"], "Ledger belongs to another side");
  ordered(ledger.receipts, receipt => receipt.receiptId, ["economy", "receipts"]);
  ordered(ledger.retiredOwnIds, id => id, ["economy", "retiredOwnIds"]);
  ordered(snapshot.ownUnitLineage, entry => entry.square, ["ownUnitLineage"]);
  ordered(snapshot.ownMineLineage, entry => `${entry.square}:${entry.mineId}`, ["ownMineLineage"]);
  const materialized = ledger.receipts.flatMap(receipt => receipt.disposition.kind === "materialized" ? [{ id: receipt.disposition.lineageId, receipt }] : []);
  const created = new Map(materialized.map(entry => [entry.id, entry.receipt]));
  const retired = new Set(ledger.retiredOwnIds);
  const live = new Set(snapshot.ownUnitLineage.map(entry => entry.id));
  const validId = (id: string, kind: "unit" | "mine"): boolean => {
    if (!id.startsWith(`${side}:${kind}:`)) return false;
    if (id.includes(":opening:")) return true;
    const counter = Number(id.split(":")[3]);
    return Number.isSafeInteger(counter) && counter >= 1 && counter <= (kind === "unit" ? 64 : 192);
  };
  const births = [...materialized].sort((a, b) => a.receipt.actionRef.planningOrdinal - b.receipt.actionRef.planningOrdinal);
  if (created.size !== materialized.length || births.some((entry, index) => entry.id !== `${side}:unit:created:${index + 1}`)) issue(["economy", "receipts"], "Expected unique chronological creation identities");
  if (new Set(ledger.receipts.map(receipt => receipt.actionRef.planningOrdinal)).size !== ledger.receipts.length) issue(["economy", "receipts"], "Expected at most one paid deployment per planning turn");
  ledger.receipts.forEach((receipt, index) => {
    const ref = receipt.actionRef;
    if (receipt.receiptId !== `${side}:receipt:${ref.planningOrdinal}:${ref.acceptedActionOrdinal}` || receipt.minerals !== UNIT_COST[receipt.unit]) issue(["economy", "receipts", index], "Receipt identity or paid cost mismatch");
  });
  if (live.size !== snapshot.ownUnitLineage.length || snapshot.ownUnitLineage.length !== own.pieces.length) issue(["ownUnitLineage"], "Expected one unique identity per own piece");
  snapshot.ownUnitLineage.forEach((entry, index) => {
    const piece = pieces.get(entry.square);
    const receipt = created.get(entry.id);
    const opening = entry.id.includes(":opening:");
    if (!validId(entry.id, "unit") || retired.has(entry.id) || !piece || piece.type !== entry.type ||
      entry.replacementValue !== (entry.type === "k" ? 0 : UNIT_COST[entry.type]) ||
      (opening ? entry.paidBasis !== 0 || !!receipt : !receipt || receipt.minerals !== entry.paidBasis) ||
      (entry.type === "k" && !opening)) issue(["ownUnitLineage", index], "Lineage, paid basis or replacement value mismatch");
  });
  if (ledger.retiredOwnIds.some(id => !validId(id, "unit") || (id.includes(":created:") && !created.has(id)))) issue(["economy", "retiredOwnIds"], "Unknown retired identity");
  if (materialized.some(entry => !live.has(entry.id) && !retired.has(entry.id))) issue(["economy", "receipts"], "Materialized identity is neither live nor retired");
  const paid = ledger.receipts.reduce((sum, receipt) => sum + receipt.minerals, 0);
  const wasted = ledger.receipts.filter(receipt => receipt.disposition.kind === "unmaterialized").reduce((sum, receipt) => sum + receipt.minerals, 0);
  const destroyed = materialized.filter(entry => retired.has(entry.id)).reduce((sum, entry) => sum + entry.receipt.minerals, 0);
  const surviving = snapshot.ownUnitLineage.reduce((sum, entry) => sum + entry.paidBasis, 0);
  if (ledger.ownPaidDebits !== paid || ledger.ownPaidWasted !== wasted || ledger.ownPaidDestroyed !== destroyed || ledger.ownPaidSurviving !== surviving ||
    paid !== surviving + destroyed + wasted || ledger.ownReplacementDestroyed < retired.size || ledger.ownReplacementDestroyed > 9 * retired.size) issue(["economy"], "Paid or replacement conservation mismatch");
  const loss = ledger.enemyLoss;
  if (loss.replacementLowerBound < loss.confirmedUnitCount || loss.replacementLowerBound > 9 * loss.confirmedUnitCount) issue(["economy", "enemyLoss"], "Witnessed loss bound mismatch");
  const mineSquares = [...new Set(snapshot.ownMineLineage.map(entry => entry.square))].sort();
  if (mineSquares.length !== own.mines.length || mineSquares.some((at, index) => at !== own.mines[index]) || new Set(snapshot.ownMineLineage.map(entry => entry.mineId)).size !== snapshot.ownMineLineage.length) issue(["ownMineLineage"], "Mine identities do not match own mines");
  snapshot.ownMineLineage.forEach((entry, index) => {
    if (!validId(entry.mineId, "mine") || (entry.mineId.includes(":opening:") && entry.mineId !== `${side}:mine:opening:${entry.square}`)) issue(["ownMineLineage", index], "Mine identity mismatch");
  });
  return issues;
}
