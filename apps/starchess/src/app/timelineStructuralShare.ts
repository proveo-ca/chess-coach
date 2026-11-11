// SPEC: _spec/apps/starchess/architecture/timeline-perf.puml, _spec/apps/starchess/match-store.puml
/**
 * Structural sharing for TIMELINE_COMMIT — keep previous refs when membership equal.
 */
import type { Square } from "@chess-coach/starchess-core";

export const sameSquareSet = (a: ReadonlySet<Square>, b: readonly Square[]): boolean => {
  if (a.size !== b.length) return false;
  for (const s of b) if (!a.has(s)) return false;
  return true;
};

export const sameSquareList = (a: readonly Square[], b: readonly Square[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

export const withHiddenSquares = (
  prev: ReadonlySet<Square>,
  next: readonly Square[] | undefined,
): ReadonlySet<Square> => {
  if (next === undefined) return prev;
  if (sameSquareSet(prev, next)) return prev;
  return new Set(next);
};

export const withIdList = (
  prev: readonly string[],
  next: readonly string[] | undefined,
): readonly string[] => {
  if (next === undefined) return prev;
  if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
  return [...next];
};

export const withSquareList = (
  prev: readonly Square[],
  next: readonly Square[] | undefined,
): readonly Square[] => {
  if (next === undefined) return prev;
  if (sameSquareList(prev, next)) return prev;
  return [...next];
};

export const withSquareSet = (
  prev: ReadonlySet<Square>,
  next: readonly Square[] | undefined,
): ReadonlySet<Square> => {
  if (next === undefined) return prev;
  if (sameSquareSet(prev, next)) return prev;
  return new Set(next);
};

export const withShallowRecord = <T extends Record<string, unknown>>(
  prev: Readonly<T>,
  next: T | undefined,
): Readonly<T> => {
  if (next === undefined) return prev;
  const pKeys = Object.keys(prev);
  const nKeys = Object.keys(next);
  if (pKeys.length !== nKeys.length) return { ...next };
  for (const k of nKeys) {
    if ((prev as Record<string, unknown>)[k] !== (next as Record<string, unknown>)[k]) {
      return { ...next };
    }
  }
  return prev;
};

export type TrailSeg = { id: string; from: Square; to: Square };

export const withTrails = (
  prev: readonly TrailSeg[],
  next: readonly TrailSeg[] | undefined,
): readonly TrailSeg[] => {
  if (next === undefined) return prev;
  if (
    prev.length === next.length &&
    prev.every((t, i) => {
      const n = next[i]!;
      return t.id === n.id && t.from === n.from && t.to === n.to;
    })
  ) {
    return prev;
  }
  return [...next];
};
