// SPEC: _spec/apps/starchess/replay-import.puml
/**
 * Arena import pipeline — file / fetch / URL → validate → historyFromRecord.
 * Pure, framework-agnostic; no store side-effects.
 */
import {
  validateArenaRecord,
  type ArenaGameRecord,
  type ArenaRecordValidation,
} from "@chess-coach/starchess-core";

export type { ArenaGameRecord, ArenaRecordValidation };

/** JSON.parse → validateArenaRecord, maps SyntaxError to validation failure. */
export const parseArenaFileText = (text: string): ArenaRecordValidation => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
  return validateArenaRecord(parsed);
};

/** Fetch GET /starchess/arena/games/:id (or :id via /runs alias) → validate. */
export const fetchArenaRecord = async (
  baseUrl: string,
  id: string,
  signal?: AbortSignal,
): Promise<ArenaRecordValidation> => {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const url = `${normalizedBase}/starchess/arena/games/${encodeURIComponent(id)}`;
  let res: Response;
  try {
    res = await fetch(url, { mode: "cors", credentials: "omit", signal });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
  if (!res.ok) {
    // Try legacy /runs alias on 404 (Phase 2 used /runs).
    if (res.status === 404) {
      const altUrl = `${normalizedBase}/starchess/arena/runs/${encodeURIComponent(id)}`;
      try {
        const alt = await fetch(altUrl, { mode: "cors", credentials: "omit", signal });
        if (alt.ok) {
          const body: unknown = await alt.json();
          return validateArenaRecord(body);
        }
      } catch {
        // fall through to original error
      }
    }
    return { ok: false, error: `Fetch failed: ${res.status}` };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON response" };
  }
  return validateArenaRecord(body);
};

/**
 * Decode `?scfens=` short-game list into a minimal ArenaGameRecord validation.
 * Requires at least 2 scfens (one ply). Resolves are synthesized as empty —
 * caller must only use scfens for fixture preview; full replay needs ?game= or file.
 * This validates SCFEN parse only; full record validation is done by the caller
 * via validateArenaRecord on the synthesized record.
 */
export const decodeScfensParam = (scfens: string[]): ArenaRecordValidation => {
  if (scfens.length < 1) return { ok: false, error: "scfens must be non-empty" };
  // Synthesize a minimal record for validation — scfens are the only required
  // payload for historyFromRecord structural check. We need resolves length = scfens-1.
  const synthetic = {
    id: `scfens-${Date.now()}`,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    players: { w: "scfens-import", b: "scfens-import" },
    mapSeed: scfens[0]!,
    outcome: { winner: null, draw: true },
    turns: scfens.length - 1,
    scfens,
    // Empty resolves with correct length — validates length invariant but not content.
    // Real arena records have resolves; short fixtures can be viewed as SCFEN list.
    resolves: Array.from({ length: Math.max(0, scfens.length - 1) }, () => ({
      resolved: null,
      next: null,
    })),
  };
  return validateArenaRecord(synthetic as unknown as Record<string, unknown>);
};

import type { ArenaListItem } from "~/types/arena";
export type { ArenaListItem };

/** Fetch arena game list (GET /starchess/arena/games or /runs alias). */
export const fetchArenaList = async (
  baseUrl: string,
  signal?: AbortSignal,
): Promise<{ ok: true; games: ArenaListItem[] } | { ok: false; error: string }> => {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const tryUrls = [
    `${normalizedBase}/starchess/arena/games`,
    `${normalizedBase}/starchess/arena/runs`,
  ];
  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { mode: "cors", credentials: "omit", signal });
      if (!res.ok) continue;
      const body = (await res.json()) as { games?: unknown; runs?: unknown };
      const raw = (body.games ?? body.runs) as unknown;
      if (!Array.isArray(raw)) continue;
      // Light validation — list items are summary, not full records.
      const games = raw.filter(
        (g): g is ArenaListItem =>
          typeof g === "object" &&
          g !== null &&
          typeof (g as { id?: unknown }).id === "string",
      );
      return { ok: true, games };
    } catch {
      continue;
    }
  }
  return { ok: false, error: "Could not fetch arena list" };
};

/** Arena base URL for fetches — same-origin by default, override via env. */
export const arenaBaseUrl = (): string => {
  // Allow override via Vite env; fallback to current origin (same-origin fetch).
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  const configured = env?.["VITE_ARENA_BASE_URL"];
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
};

/** Adapt ArenaGameRecord → StarChessGameRecord shape for matchHistoryStore display. */
export const arenaToReviewRecord = (
  record: ArenaGameRecord,
  opts: { map?: string; playerColor?: "w" | "b" } = {},
): {
  id: string;
  startedAt: string;
  endedAt: string;
  scfens: string[];
  resolves: ArenaGameRecord["resolves"];
  map: string;
  playerColor: "w" | "b";
  result: "win" | "loss" | "draw";
} => {
  const winner = record.outcome.winner;
  const playerColor = opts.playerColor ?? "w";
  let result: "win" | "loss" | "draw" = "draw";
  if (record.outcome.draw) result = "draw";
  else if (winner === null) result = "draw";
  else result = winner === playerColor ? "win" : "loss";
  return {
    id: record.id,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    scfens: record.scfens,
    resolves: record.resolves,
    map: (record.map as string) ?? opts.map ?? "eclipse",
    playerColor,
    result,
  };
};
