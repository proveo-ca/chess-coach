import type { Clock, LocationPort, RandomSource, Scheduler } from "~/types/ports";

export const browserClock: Clock = {
  now: () => Date.now(),
};

export const browserScheduler: Scheduler = {
  delay: (ms, fn) => {
    const id = window.setTimeout(fn, ms);
    return () => window.clearTimeout(id);
  },
};

export const browserRandom: RandomSource = {
  next: () => Math.random(),
};

export const browserLocation: LocationPort = {
  search: () => (typeof window !== "undefined" ? window.location.search : ""),
};

// SPEC: _spec/apps/starchess/replay-import.puml
/** Decode `?scfen=` (URI-encoded SCFEN string). /single only. */
export const readScfenQuery = (search: string): string | null => {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = params.get("scfen");
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/** Decode `?game=<arenaId>` on /review. Returns trimmed id or null. */
export const readArenaGameQuery = (search: string): string | null => {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = params.get("game");
  if (!raw) return null;
  const id = raw.trim();
  return id.length > 0 ? id : null;
};

/**
 * Decode `?scfens=` on /review — comma-separated SCFENs (short games only;
 * full 50-turn games overflow URL limits ~5-10KB). Returns null on empty.
 */
export const readScfensQuery = (search: string): string[] | null => {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = params.get("scfens");
  if (!raw) return null;
  // URLSearchParams already decodes, split on comma then trim.
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  return parts.map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
};

/**
 * Mutual exclusion for /review import: `?game=` takes priority over `?scfens=`.
 * No route accepts both spellings.
 */
export const readReviewImport = (
  search: string,
): { gameId?: string; scfens?: string[] } | null => {
  const gameId = readArenaGameQuery(search);
  if (gameId) return { gameId };
  const scfens = readScfensQuery(search);
  if (scfens) return { scfens };
  return null;
};
