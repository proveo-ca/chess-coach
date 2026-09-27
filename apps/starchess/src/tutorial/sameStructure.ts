// SPEC: _spec/apps/starchess/architecture/reactivity.md, _spec/apps/starchess/architecture/reactivity/tutorial.md
export const sameStructure = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameStructure(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = Object.keys(ra);
  if (keys.length !== Object.keys(rb).length) return false;
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(rb, k) || !sameStructure(ra[k], rb[k])) return false;
  }
  return true;
};
