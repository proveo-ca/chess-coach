/**
 * `runMatch` — the deterministic arena turn driver.
 *
 * Mirrors the app's loop (turn-open checks → side plans → settle → income →
 * record) on the pure SCFEN engine, with no DOM/worker/fetch. Deterministic
 * when no engine feed is attached: same opening + same players ⇒ identical
 * `scfens` + `resolves` payloads (this doubles as the regression corpus for
 * both adjutants).
 *
 * Loop invariants (recording parity with human games):
 *   1. `beginScTurn` chip plies are recorded immediately as their own settle
 *      (`{ scfen: post-chip, resolve: asResolve }`), including a terminal king
 *      chip (stop after recording it) — mirrors the app's BEGIN_CHECKS_DONE.
 *   2. Each settled ply records `endScTurn().next` — `resolves[i]` produces
 *      `scfens[i+1]`; `scfens[0]` is the opening.
 *   3. The mineral bank is arena-threaded (never stamped into SCFENs) and
 *      stored income is granted for the advanced turn; strategic spends debit
 *      the owning side.
 *   4. Scripts plan in exactly `[w, b]` order — a determinism invariant (w
 *      debiting before b plans must never reorder).
 *
 * Termination: `maxTurns` (engine cap MAX_GAME_TURNS=45) settled turns ⇒
 * HP of the command centers decides win/loss/draw (higher HP wins, equal draw);
 * both-null players are rejected; an `endScTurn` throw aborts and records
 * `meta.status: "aborted"`. Scripts return plain snapshots — the runner
 * `await`s for async engine lookahead.
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml
 */

import {
  beginScTurn,
  endScTurn,
  formatScFen,
  MAX_GAME_TURNS,
  mulberry32,
  seedCcIntelForOpening,
  seedKvsForOpening,
  seedAttackerMemory,
  seedRunnerMemory,
  updateAttackersForSnap,
  updateCcIntelForSnap,
  updateKvsForSnap,
  updateRunnersForSnap,
  witnessFromEndTurn,
  type KvsState,
  normalizeSnapGas,
  parseScFen,
  scOutcome,
  type EndScTurnResult,
  type ScFenSnapshot,
  type ScOutcome,
} from "@chess-coach/starchess-core";

import type { EngineFeed } from "../feed/types";
import type { Players, ScriptPlayer, SideContext } from "../players/types";
import { STAR_STARTING_SCFEN } from "../seeds";
import { debitSpend, grantStoredIncome, seedBankForOpening, type Bank } from "./bank";

export type { ScFenSnapshot, EndScTurnResult, ScOutcome, Bank };

export type ArenaRunStatus = "finished" | "aborted" | "stall";

export type ArenaPly = {
  /** Settled DualNav ply — `formatScFen(normalizeSnapGas(esr.next))`. */
  scfen: string;
  /** The resolve that produced this ply's board. */
  resolve: EndScTurnResult;
};

export type ArenaRunOptions = {
  players: Players;
  /** Opening SCFEN map seed; defaults to the canonical Start. */
  opening?: string;
  /** Engine-lookahead feed (Phase 2; absent ⇒ deterministic fallback). */
  feed?: EngineFeed | null;
  /** Per-query engine budget hint (Phase 2; recorded for the scoreboard). */
  movetimeMs?: number;
  /** Settled-turn cap before a stall draw (default 200). */
  maxTurns?: number;
  /** Opening tie-break seed; equal seeds replay a game exactly (default 0). */
  seed?: number;
  /** Board-variant / skin passthrough for the web replay host. */
  map?: string;
  variant?: string;
};

export type ArenaRun = {
  /** Opening SCFEN this game was seeded from. */
  startScfen: string;
  /** Script names per side (`null` = no player / scratch). */
  players: { w: string | null; b: string | null };
  /** Settled plies in order; `plies[i]` came from `scfens[i]`. */
  plies: ArenaPly[];
  /** Terminal outcome — `null` only when the run aborted mid-game. */
  outcome: ScOutcome | null;
  turns: number;
  /** Bank after each settled ply (trail; last == `meta.finalBank`). */
  bankTrail: Bank[];
  /** Arena-owned known-vs-seen ledger at terminal. */
  kvs: KvsState;
  meta: {
    engine: { used: boolean; movetimeMs: number } | null;
    finalBank: Bank;
    status: ArenaRunStatus;
    maxTurns: number;
  };
  map?: string;
  variant?: string;
};

export const DEFAULT_MAX_TURNS = MAX_GAME_TURNS;

/** Run one headless script-vs-script game. Deterministic; rejects both-null. */
export const runMatch = async (options: ArenaRunOptions): Promise<ArenaRun> => {
  const {
    players,
    opening = STAR_STARTING_SCFEN,
    feed = null,
    movetimeMs = 0,
    maxTurns = DEFAULT_MAX_TURNS,
    seed = 0,
    map,
    variant,
  } = options;

  const rngs = { w: mulberry32(seed), b: mulberry32(~seed) } as const;

  if (players.w === null && players.b === null) {
    throw new Error("runMatch: at least one side must be a script");
  }

  const snap0 = parseScFen(opening);
  let snap = snap0;
  let bank = seedBankForOpening(snap);
  let kvs = seedKvsForOpening(snap);
  let ccIntel = seedCcIntelForOpening();
  let runnerMemory = seedRunnerMemory();
  let attackerMemory = seedAttackerMemory();

  const scfens: string[] = [formatScFen(normalizeSnapGas(snap))];
  const resolves: EndScTurnResult[] = [];
  const bankTrail: Bank[] = [];

  let outcome: ScOutcome | null = null;
  let status: ArenaRunStatus = "stall";

  try {
    for (let settled = 0; settled < maxTurns; settled += 1) {
      // 1. Turn-open checks — a chip ply records as its own settle.
      const opened = beginScTurn(snap);
      if (opened.asResolve) {
        const postChip = opened.next;
        resolves.push(opened.asResolve);
        scfens.push(formatScFen(normalizeSnapGas(postChip)));
        bankTrail.push({ ...bank });
        kvs = updateKvsForSnap(kvs, postChip);
        ccIntel = updateCcIntelForSnap(ccIntel, postChip);
        // The chip's own account of itself: a turn-open shot names its shooter.
        const chipWitness = witnessFromEndTurn(opened.asResolve);
        runnerMemory = updateRunnersForSnap(runnerMemory, postChip, chipWitness);
        attackerMemory = updateAttackersForSnap(attackerMemory, postChip, chipWitness);
        snap = postChip;
        outcome = scOutcome(snap);
        if (outcome !== null) {
          status = "finished";
          break;
        }
      } else {
        // No chip — advance to the turn-open, gas-refilled snapshot so scripts
        // plan with a real gas budget (endScTurn zeroes gas each settle; the
        // app does the same via `begun?.next ?? refillTurnGas(cur)`).
        snap = opened.next;
      }

      // 2. Plans, exactly w-then-b (never reorder — determinism invariant).
      for (const color of ["w", "b"] as const) {
        const script: ScriptPlayer | null = players[color];
        if (!script) continue;
        if ((snap.queue?.actions ?? []).some((a) => a.color === color)) continue;
        const ctx: SideContext = {
          color,
          // Income-ledger mirror: this side's live stored minerals (the app
          // host threads the same value; bank is arena-owned, never in-snap).
          storedFor: bank[color],
          bank,
          kvs: kvs.perSide[color],
          ccIntel: ccIntel.perSide[color],
          runnerMemory: runnerMemory.perSide[color],
          attackerMemory: attackerMemory.perSide[color],
          // 0 when no feed/budget — keeps the run deterministic.
          movetimeMs: feed && movetimeMs > 0 ? movetimeMs : 0,
          rng: rngs[color],
        };
        const plan = await script.play(snap, ctx);
        snap = plan.snapshot;
        if (plan.spendMinerals) bank = debitSpend(bank, color, plan.spendMinerals);
      }

      // 3. Settle the turn (a throw aborts — recorded, never crashes).
      const esr = endScTurn(snap, { skipTurnStartChecks: true });

      // 4. Grant stored income for the advanced turn.
      bank = grantStoredIncome(bank, esr.next.turn);

      // 5. Record the settled ply (`resolve.next`, never the pre-resolve snap).
      resolves.push(esr);
      scfens.push(formatScFen(normalizeSnapGas(esr.next)));
      bankTrail.push({ ...bank });
      kvs = updateKvsForSnap(kvs, esr.next);
      ccIntel = updateCcIntelForSnap(ccIntel, esr.next);
      const witness = witnessFromEndTurn(esr);
      runnerMemory = updateRunnersForSnap(runnerMemory, esr.next, witness);
      attackerMemory = updateAttackersForSnap(attackerMemory, esr.next, witness);
      snap = esr.next;

      outcome = scOutcome(snap);
      if (outcome !== null) {
        status = "finished";
        break;
      }
    }
  } catch {
    status = "aborted";
  }

  if (status === "stall") {
    // Engine cap: at turn 45, HP decides win/loss/draw (lives in engine core)
    const capOutcome = scOutcome(snap);
    outcome = capOutcome ?? { winner: null, draw: true };
  }

  return {
    startScfen: opening,
    players: { w: players.w?.name ?? null, b: players.b?.name ?? null },
    plies: resolves.map((resolve, i) => ({ resolve, scfen: scfens[i + 1]! })),
    outcome,
    turns: snap.turn,
    bankTrail,
    kvs,
    meta: {
      // Engine only "used" when given a budget; a feed attached with
      // movetimeMs=0 stays engine:false and deterministic (rerun-equality).
      engine: feed && movetimeMs > 0 ? { used: true, movetimeMs } : null,
      finalBank: bankTrail.at(-1) ?? { w: 0, b: 0 },
      status,
      maxTurns,
    },
    ...(map !== undefined ? { map } : {}),
    ...(variant !== undefined ? { variant } : {}),
  };
};