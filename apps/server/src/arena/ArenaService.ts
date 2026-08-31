/**
 * `ArenaService` — orchestrates node-side arena runs for the HTTP surface.
 *
 * Maps pairing specs to script players, runs each (pairing × seed) cross
 * product through `runMatch` (attaching the pool-backed feed only when the
 * caller asks for engine lookahead with a positive budget), adapts each run to
 * the shared record schema, stores it, and returns the created records. The
 * feed is advisory and the runner refuses a budget (movetimeMs=0) to keep
 * engine-off runs deterministic.
 *
 * // SPEC: _spec/apps/server/starchess-arena-feed.puml
 */

import { MAX_GAME_TURNS, validateScFen } from "@chess-coach/starchess-core";
import {
  naiveScript,
  recordFromRun,
  runMatch,
  strategicScript,
  type ArenaGameRecord,
  type EngineFeed,
  type ScriptPlayer,
} from "@chess-coach/starchess-arena";

import { BadRequestError } from "../http.ts";
import type { ArenaRecordStore } from "./ArenaRecordStore.ts";

export type ScriptId = "adjutant-naive" | "adjutant-strategic";

const SCRIPT_IDS = new Set<string>(["adjutant-naive", "adjutant-strategic"]);

/** Bounds so a single request can't overwhelm the pool/CPU (unauthenticated surface). */
export const MAX_PAIRINGS = 8;
export const MAX_SEEDS = 8;
export const MAX_MOVETIME_MS = 5000;

export const isScriptId = (value: unknown): value is ScriptId =>
  typeof value === "string" && SCRIPT_IDS.has(value);

/** One head-to-head pairing, declared by script id. */
export type PairingSpec = {
  w: ScriptId;
  b: ScriptId;
};

export type ArenaRunsRequest = {
  pairings: PairingSpec[];
  /** Opening SCFEN seeds; defaults to the canonical Start when empty. */
  seeds?: string[];
  /** Attach the engine feed (only honored with `movetimeMs > 0`). */
  engine?: boolean;
  /** Per-window engine budget in ms (0 = engine off / deterministic). */
  movetimeMs?: number;
};

export class ArenaService {
  constructor(
    readonly store: ArenaRecordStore,
    private readonly feed?: EngineFeed | null,
  ) {}

  private scriptFor(id: ScriptId): ScriptPlayer {
    if (id === "adjutant-naive") return naiveScript();
    if (id === "adjutant-strategic") return strategicScript({ feed: this.feed });
    throw new Error(`Unknown script id: ${id}`);
  }

  private validate(req: ArenaRunsRequest): void {
    if (!Array.isArray(req.pairings) || req.pairings.length === 0) {
      throw new BadRequestError("pairings must be a non-empty array");
    }
    if (req.pairings.length > MAX_PAIRINGS) {
      throw new BadRequestError(`pairings exceeds the max of ${MAX_PAIRINGS}`);
    }
    for (const p of req.pairings) {
      if (!p || !SCRIPT_IDS.has(p.w) || !SCRIPT_IDS.has(p.b)) {
        throw new BadRequestError(`Invalid pairing: ${JSON.stringify(p)}`);
      }
    }
    if (req.seeds !== undefined && !Array.isArray(req.seeds)) {
      throw new BadRequestError("seeds must be an array of SCFENs");
    }
    const seeds = req.seeds ?? [];
    if (seeds.length > MAX_SEEDS) {
      throw new BadRequestError(`seeds exceeds the max of ${MAX_SEEDS}`);
    }
    for (const seed of seeds) {
      if (typeof seed !== "string" || seed === "" || /[\u0000-\u001f\u007f]/.test(seed)) {
        throw new BadRequestError("seeds must be non-empty SCFEN strings without control characters");
      }
      if (!validateScFen(seed).ok) {
        throw new BadRequestError("seeds contains an invalid SCFEN");
      }
    }
    if (req.movetimeMs !== undefined && (req.movetimeMs < 0 || !Number.isFinite(req.movetimeMs))) {
      throw new BadRequestError("movetimeMs must be a non-negative number");
    }
    if ((req.movetimeMs ?? 0) > MAX_MOVETIME_MS) {
      throw new BadRequestError(`movetimeMs exceeds the max of ${MAX_MOVETIME_MS}`);
    }
  }

  private async runOne(
    req: ArenaRunsRequest,
    pairing: PairingSpec,
    seed: string | undefined,
  ): Promise<ArenaGameRecord> {
    const movetimeMs = req.engine && (req.movetimeMs ?? 0) > 0 ? req.movetimeMs! : 0;
    const feed = req.engine && movetimeMs > 0 ? this.feed : null;
    const run = await runMatch({
      players: { w: this.scriptFor(pairing.w), b: this.scriptFor(pairing.b) },
      ...(seed ? { opening: seed } : {}),
      feed,
      movetimeMs,
      maxTurns: MAX_GAME_TURNS,
    });
    return this.store.put(recordFromRun(run));
  }

  /** Run every (pairing × seed) and persist the resulting records. */
  async batches(req: ArenaRunsRequest): Promise<ArenaGameRecord[]> {
    this.validate(req);
    const seeds = (req.seeds ?? []).length > 0 ? req.seeds! : [undefined];
    const records: ArenaGameRecord[] = [];
    for (const pairing of req.pairings) {
      for (const seed of seeds) {
        records.push(await this.runOne(req, pairing, seed));
      }
    }
    return records;
  }
}
