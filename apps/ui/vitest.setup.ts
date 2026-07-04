/**
 * Node ≥22 defines an experimental `localStorage` global (undefined unless the
 * process is started with --localstorage-file). Vitest's jsdom environment
 * skips window keys that already exist on globalThis, so that Node stub
 * shadows jsdom's real Storage and every bare `localStorage` access in tests
 * and source resolves to undefined. Replace it with an in-memory Storage.
 */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  } as Storage;
}

const usable = (() => {
  try {
    globalThis.localStorage.setItem("__vitest_probe__", "1");
    globalThis.localStorage.removeItem("__vitest_probe__");
    return true;
  } catch {
    return false;
  }
})();

if (!usable) {
  Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage(),
    configurable: true,
    writable: true,
  });
}
