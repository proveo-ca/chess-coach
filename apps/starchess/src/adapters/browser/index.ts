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

/** Decode `?scfen=` (URI-encoded SCFEN string). */
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
