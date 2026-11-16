/**
 * Arena mineral banking — income grant + spend debit.
 *
 * The arena threads the bank as *hosted* state (like the app's `stored`),
 * never stamped into recorded SCFENs (recording parity with human games: the
 * web replay rebuilds the stored display with the standard income ledger). The
 * scoreboard reads `meta.finalBank` for the two sides' closing storage.
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml
 */

import {
  applyStoredIncome,
  OPENING_STORED_MATERIAL,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

export type Bank = { w: number; b: number };

export const seedBankForOpening = (opening: ScFenSnapshot): Bank => {
  const seeded = opening.stored ?? { w: 0, b: 0 };
  // The ledger floors the opening bank at the initial stored material, exactly
  // like incomeForTurn's turn-1 tier — a turn-0 seed must never grant less.
  const w = Math.max(seeded.w, OPENING_STORED_MATERIAL);
  const b = Math.max(seeded.b, OPENING_STORED_MATERIAL);
  return { w, b };
};

/** Grant each side its stored income for the advanced `turn`. */
export const grantStoredIncome = (bank: Bank, turn: number): Bank =>
  applyStoredIncome(bank, turn);

/** Debit a side's spend (spawn/storage) — floors at zero, never negative. */
export const debitSpend = (bank: Bank, color: "w" | "b", amount: number): Bank => {
  if (amount <= 0) return bank;
  const next = { ...bank };
  next[color] = Math.max(0, next[color] - Math.floor(amount));
  return next;
};