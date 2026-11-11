// SPEC: _spec/apps/starchess/architecture/reactivity.md, _spec/apps/starchess/architecture/reactivity/presentation.md

export const sameSet = <T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean => {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
};

export const sameList = <T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
};

export const sameFlat = (a: object | null | undefined, b: object | null | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = Object.keys(ra);
  if (keys.length !== Object.keys(rb).length) return false;
  for (const k of keys) {
    const va = ra[k];
    const vb = rb[k];
    if (Object.is(va, vb)) continue;
    if (Array.isArray(va) && Array.isArray(vb) && sameList(va, vb)) continue;
    return false;
  }
  return true;
};

export const sameMap = <K, V>(
  a: ReadonlyMap<K, V>,
  b: ReadonlyMap<K, V>,
  eq: (x: V, y: V) => boolean = (x, y) => Object.is(x, y) || sameFlat(x as object, y as object),
): boolean => {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (!b.has(k)) return false;
    if (!eq(v, b.get(k) as V)) return false;
  }
  return true;
};
