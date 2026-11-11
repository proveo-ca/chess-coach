import '@testing-library/jest-dom/vitest';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

type MatchMediaListener = (e: { matches: boolean }) => void;

if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  window.matchMedia = ((query: string) => {
    const listeners = new Set<MatchMediaListener>();
    const media = {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (type: string, cb: MatchMediaListener) => {
        if (type === "change") listeners.add(cb);
      },
      removeEventListener: (type: string, cb: MatchMediaListener) => {
        if (type === "change") listeners.delete(cb);
      },
      addListener: (cb: MatchMediaListener) => listeners.add(cb),
      removeListener: (cb: MatchMediaListener) => listeners.delete(cb),
      dispatchEvent: () => true,
    };
    return media as unknown as MediaQueryList;
  }) as unknown as typeof window.matchMedia;
}
