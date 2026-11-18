/**
 * `naiveScript` — the naive adjutant as an arena player (sync, deterministic).
 *
 * Wraps core `adjutant(snap, { color, storedFor })` unchanged; the naive
 * result carries no `spendMinerals`, so the runner debits nothing from the
 * bank on its turns (parity with the app host, which also drives naive without
 * an explicit spend signal — spawn storage is validated by the core's own
 * economy/strategy spend gate, never by the runner).
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml
 */

import {
  adjutant,
  type AdjutantContext,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import type { ScriptPlayer, SideContext } from "./types";

export const NAIVE_SCRIPT_NAME = "adjutant-naive";

/** Runs the naive adjutant's planner for one open window. */
export const naiveScript = (overrides: Partial<ScriptPlayer> = {}): ScriptPlayer => ({
  name: NAIVE_SCRIPT_NAME,
  ...overrides,
  play(snap: ScFenSnapshot, ctx: SideContext) {
    const ctxOut: AdjutantContext = {
      color: ctx.color,
      storedFor: (color) => Object.entries(ctx.bank).find(([side]) => side === color)![1],
      rng: ctx.rng,
    };
    const result = adjutant(snap, ctxOut);
    return {
      snapshot: result.snapshot,
      spendMinerals: result.spendMinerals?.amount,
    };
  },
});
