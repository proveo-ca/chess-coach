/**
 * Arena player contracts — the shapes the runner drives.
 *
 * A player decides one plan per open planning window: a snapshot plus
 * `spendMinerals` when it spent Command Center storage (deployed with the
 * turn's spawn). The runner threads the arena-owned mineral bank and the
 * known-vs-seen accumulator through `SideContext` (`storedFor` mirrors the
 * app host; `kvs` mirrors the strategic host's `StrategicAdjutantContext`).
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml
 */

import type { CCIntel } from "@chess-coach/starchess-core";
import type { KnownVsSeen, PieceColor, ScFenSnapshot, Square } from "@chess-coach/starchess-core";

export type { PieceColor, ScFenSnapshot, KnownVsSeen, CCIntel };

/** Per-call planning context for one side, one open planning window. */
export type SideContext = {
  color: PieceColor;
  /**
   * "Stored for this turn" income ledger mirror (the app host threads the same
   * value via `storedFor`). Deterministic — never a wall-clock.
   */
  storedFor: number;
  /** Arena-owned mineral bank (spendMinerals debits the owning side). */
  bank: { w: number; b: number };
  /** Known-vs-seen intel about the *opponent* accumulated so far. */
  kvs: KnownVsSeen;
  /** CC search state — the host threads the previous CCIntel and last Hoverbike probe. */
  ccIntel?: CCIntel | null;
  lastCCProbe?: { to: Square; empty: boolean } | null;
  /**
   * Wall-clock engine budget for this planning window (0 = engine off /
   * deterministic even when a feed is attached). The runner owns the budget
   * and records it in `meta.engine`.
   */
  movetimeMs?: number;
};

/** A script's decision for the open window. */
export type ScriptPlan = {
  /** Board after this side's queued play (chart through `addScAction`). */
  snapshot: ScFenSnapshot;
  /** Command Center storage spent this turn (debit from the bank). */
  spendMinerals?: number;
};

/** One script player (sync or async; the runner awaits). */
export type ScriptPlayer = {
  readonly name: string;
  play(snap: ScFenSnapshot, ctx: SideContext): ScriptPlan | Promise<ScriptPlan>;
};

export type Players = { w: ScriptPlayer | null; b: ScriptPlayer | null };