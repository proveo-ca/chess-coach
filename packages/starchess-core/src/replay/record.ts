/**
 * Shared playable-record schema for the script arena + web replay.
 *
 * Single owner for the record shape (`ArenaGameRecord`) and the settled-ply
 * decode (`historyFromRecord`), consumed by BOTH BRIDGE apps/starchess
 * (DualNav replay) and BRIDGE packages/starchess-arena (game recording).
 * The app's human-match `StarChessGameRecord` stays app-local; it satisfies
 * the `historyFromRecord` input structurally (scfens + resolves).
 *
 * Recording invariant: `resolves[i]` produced `scfens[i+1]` — the settled ply
 * records `resolve.next`, never the pre-resolve snapshot.
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml, _spec/apps/starchess/replay-import.puml
 */

import { parseScFen } from "../scfen";
import type { EndScTurnResult } from "../resolve/submit-turn";
import type { ScFenSnapshot } from "../model/types";
import type { ScOutcome } from "../outcome";

export type { EndScTurnResult, ScFenSnapshot };

export type ArenaOutcome = ScOutcome;

/** How a run ended — `finished` = a king hit zero; stall/abort are not wins. */
export type ArenaRecordStatus = "finished" | "aborted" | "stall";

/** One headless script-vs-script match, replayable by the web app. */
export type ArenaGameRecord = {
  id: string;
  startedAt: string;
  endedAt: string;
  /** Script ids per side (e.g. "adjutant-naive", "adjutant-strategic"). */
  players: { w: string; b: string };
  /** Opening position this game was seeded from. */
  mapSeed: string;
  /** Optional board-variant / skin passthrough for the web replay host. */
  map?: string;
  variant?: string;
  outcome: ArenaOutcome;
  /** Settled turn count (terminal `snap.turn`). */
  turns: number;
  /** Settled DualNav plies as SCFEN strings (gas normalized). */
  scfens: string[];
  /** Resolve that produced scfens[i+1] from scfens[i]. */
  resolves: EndScTurnResult[];
  meta?: {
    engine: { used: boolean; movetimeMs: number } | null;
    /** Arena-owned mineral bank at terminal (host truth for scoreboard). */
    finalBank?: { w: number; b: number };
    status?: ArenaRecordStatus;
  };
};

/**
 * Rebuild DualNav snaps from a persisted record. Legacy plies may advance
 * `turn` without restamping `G:` income — `repairGas` realigns them, matching
 * the app's existing replay host exactly.
 */
export const historyFromRecord = (
  record: { scfens: string[]; resolves: readonly EndScTurnResult[] },
): { settledSnapshots: ScFenSnapshot[]; settledResolves: EndScTurnResult[] } => {
  const settledSnapshots = record.scfens.map((s) =>
    parseScFen(s, { repairGas: true }),
  );
  return {
    settledSnapshots,
    settledResolves: [...record.resolves],
  };
};

/**
 * Math.random-free id — UUID when the runtime offers one (browser / node ≥ 19);
 * a monotonic process counter otherwise. `id` is excluded from determinism
 * equality, so this never affects rerun-equality.
 */
let arenaRecordSeq = 0;
export const makeArenaRecordId = (): string => {
  arenaRecordSeq += 1;
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return `arc-${c.randomUUID()}`;
  return `arc-${Date.now().toString(36)}-${arenaRecordSeq.toString(36)}`;
};

/**
 * Pieces of a finished run that are independent of who ran it — the arena's
 * turn driver produces these; the schema owner here turns them into a record
 * (ids/timestamps, `map*`/`variant` passthrough). `id`/`startedAt`/`endedAt`
 * are excluded from determinism equality (rerun-equality asserts on the
 * `scfens` + `resolves` payload only).
 */
export type ArenaRunSummary = {
  players: { w: string; b: string };
  mapSeed: string;
  map?: string;
  variant?: string;
  outcome: ArenaOutcome;
  turns: number;
  scfens: readonly string[];
  resolves: readonly EndScTurnResult[];
  meta?: {
    engine?: { used: boolean; movetimeMs: number } | null;
    finalBank?: { w: number; b: number };
    status?: ArenaRecordStatus;
  };
  /** Deterministic recorded wall clock for `startedAt` (run owner). */
  startedAt?: string;
};

/** Schema owner turns a run summary into a persisted `ArenaGameRecord`. */
export const recordFromRun = (summary: ArenaRunSummary): ArenaGameRecord => {
  const startedAt = summary.startedAt ?? new Date().toISOString();
  return {
    id: makeArenaRecordId(),
    startedAt,
    endedAt: new Date().toISOString(),
    players: { w: summary.players.w, b: summary.players.b },
    mapSeed: summary.mapSeed,
    ...(summary.map !== undefined ? { map: summary.map } : {}),
    ...(summary.variant !== undefined ? { variant: summary.variant } : {}),
    outcome: summary.outcome,
    turns: summary.turns,
    scfens: [...summary.scfens],
    resolves: [...summary.resolves],
    meta: summary.meta
      ? { ...summary.meta, engine: summary.meta.engine ?? null }
      : undefined,
  };
};

export type ArenaRecordValidation =
  | { ok: true; record: ArenaGameRecord }
  | { ok: false; error: string };

/**
 * Validate an untrusted value as an `ArenaGameRecord` before it reaches
 * `historyFromRecord` (which throws on malformed SCFEN). Shared by every
 * import channel — server `?game=` fetch, file upload, and `?scfens=`
 * decoding. Accepts extra fields but requires the shape + parseable plies.
 */
export const validateArenaRecord = (value: unknown): ArenaRecordValidation => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "record must be an object" };
  }
  const r = value as Record<string, unknown>;

  const id = r["id"];
  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, error: "record.id must be a non-empty string" };
  }
  for (const k of ["startedAt", "endedAt", "mapSeed"]) {
    if (typeof r[k] !== "string") return { ok: false, error: `record.${k} must be a string` };
  }
  const players = r["players"];
  if (
    typeof players !== "object" ||
    players === null ||
    typeof (players as { w?: unknown }).w !== "string" ||
    typeof (players as { b?: unknown }).b !== "string"
  ) {
    return { ok: false, error: "record.players.{w,b} must be strings" };
  }
  if (typeof r["turns"] !== "number") {
    return { ok: false, error: "record.turns must be a number" };
  }
  const outcome = r["outcome"];
  const winner = (outcome as { winner?: unknown } | null)?.winner ?? null;
  const draw = (outcome as { draw?: unknown } | null)?.draw;
  if (typeof outcome !== "object" || outcome === null || (winner !== null && winner !== "w" && winner !== "b")) {
    return { ok: false, error: "record.outcome must be { winner: 'w'|'b'|null, draw: boolean }" };
  }
  if (winner === null) {
    if (draw !== true) return { ok: false, error: "record.outcome must be { winner: 'w'|'b'|null, draw: boolean }" };
  } else {
    if (draw !== undefined && draw !== false)
      return { ok: false, error: "record.outcome must be { winner: 'w'|'b'|null, draw: boolean }" };
  }

  const scfens = r["scfens"];
  const resolves = r["resolves"];
  if (!Array.isArray(scfens) || scfens.length === 0) {
    return { ok: false, error: "record.scfens must be a non-empty array" };
  }
  if (!Array.isArray(resolves) || resolves.length !== scfens.length - 1) {
    return { ok: false, error: "record.resolves.length must equal record.scfens.length - 1" };
  }
  for (let i = 0; i < scfens.length; i += 1) {
    const s = scfens[i];
    if (typeof s !== "string") return { ok: false, error: `record.scfens[${i}] must be a string` };
    try {
      parseScFen(s);
    } catch {
      return { ok: false, error: `record.scfens[${i}] is not a parseable SCFEN` };
    }
  }
  if (r["meta"] !== undefined) {
    if (typeof r["meta"] !== "object" || r["meta"] === null) {
      return { ok: false, error: "record.meta must be an object" };
    }
    const engine = (r["meta"] as { engine?: unknown }).engine;
    if (
      engine !== undefined &&
      engine !== null &&
      (typeof engine !== "object" || typeof (engine as { used?: unknown }).used !== "boolean")
    ) {
      return { ok: false, error: "record.meta.engine must be { used: boolean, movetimeMs: number } | null" };
    }
  }

  return { ok: true, record: r as unknown as ArenaGameRecord };
};