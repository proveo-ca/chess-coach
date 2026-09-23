type ResizeObserverCallbackLike = (
  entries: Array<{ target: Element; contentRect: DOMRectReadOnly }>,
) => void;

class StorybookResizeObserver {
  private readonly callback: ResizeObserverCallbackLike;

  constructor(callback: ResizeObserverCallbackLike) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback([{ target, contentRect: target.getBoundingClientRect() }]);
  }

  unobserve() {}

  disconnect() {}
}

class StorybookWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;

  postMessage() {}

  terminate() {}

  addEventListener() {}

  removeEventListener() {}
}

export function resetStorybookRandom(seed = 0x5eed): void {
  let state = seed >>> 0;
  Math.random = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function installStorybookBrowserMocks(): void {
  if (typeof window === "undefined") return;

  if (!window.ResizeObserver) {
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: StorybookResizeObserver,
    });
  }

  if (!window.Worker) {
    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: StorybookWorker,
    });
  }

  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }

  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }

  if (!navigator.clipboard) {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => "",
        writeText: async () => {},
      },
    });
  }

  if (!navigator.share) {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {},
    });
  }

  window.prompt = () => null;
}
