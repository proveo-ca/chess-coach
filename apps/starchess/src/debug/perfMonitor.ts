// SPEC: _spec/apps/starchess/architecture/naming.puml
/**
 * Runtime perf / resource monitor for VFX guarding.
 * Enable: `?debug=perf` · localStorage starchess_debug=perf · VITE_STARC_DEBUG=1
 */
export type PerfSnapshot = {
  t: number;
  /** Frames in the last sample window. */
  fps: number;
  /** Long tasks (>50ms) since previous sample. */
  longTasks: number;
  /** Cumulative long-task duration ms in window. */
  longTaskMs: number;
  jsHeapUsedMb: number | null;
  jsHeapTotalMb: number | null;
  jsHeapLimitMb: number | null;
  domNodes: number;
  svgElements: number;
  svgPaths: number;
  combatRoots: number;
  combatChildren: number;
  pieceImgs: number;
  storeDispatches: number;
  storeByType: Record<string, number>;
  timelineActive: boolean;
  matchPhase: string;
  visibility: DocumentVisibilityState;
  dpr: number;
};

type PerfListener = (snap: PerfSnapshot) => void;

const LS_KEY = "starchess_debug";
const SAMPLE_MS = 1000;

let enabled = false;
let started = false;
let rafId = 0;
let sampleTimer: ReturnType<typeof setInterval> | null = null;
let frames = 0;
let longTasks = 0;
let longTaskMs = 0;
let dispatchCount = 0;
const dispatchByType = new Map<string, number>();
let lastMatchPhase = "";
let lastTimelineActive = false;
const listeners = new Set<PerfListener>();
let po: PerformanceObserver | null = null;
let hudEl: HTMLDivElement | null = null;
const history: PerfSnapshot[] = [];
const HISTORY_CAP = 120;

const mem = (): {
  used: number | null;
  total: number | null;
  limit: number | null;
} => {
  const m = (
    performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
    }
  ).memory;
  if (!m) return { used: null, total: null, limit: null };
  const mb = (n: number) => Math.round((n / (1024 * 1024)) * 10) / 10;
  return { used: mb(m.usedJSHeapSize), total: mb(m.totalJSHeapSize), limit: mb(m.jsHeapSizeLimit) };
};

const countDom = () => {
  const all = document.getElementsByTagName("*").length;
  const svgs = document.getElementsByTagName("svg").length;
  const paths = document.getElementsByTagName("path").length;
  const roots = document.querySelectorAll("[data-starchess-combat-root]").length;
  let combatChildren = 0;
  document.querySelectorAll("[data-starchess-combat-root]").forEach((r) => {
    combatChildren += r.querySelectorAll("*").length;
  });
  const pieceImgs = document.querySelectorAll(
    '[data-testid="chessboard"] img, [data-board-grid] img, [data-piece-inline]',
  ).length;
  return { all, svgs, paths, roots, combatChildren, pieceImgs };
};

const sample = (): PerfSnapshot => {
  const heap = mem();
  const dom = countDom();
  const byType: Record<string, number> = {};
  for (const [k, v] of dispatchByType) byType[k] = v;
  dispatchByType.clear();
  const dispatches = dispatchCount;
  dispatchCount = 0;
  const lt = longTasks;
  const ltMs = Math.round(longTaskMs);
  longTasks = 0;
  longTaskMs = 0;
  const fps = frames;
  frames = 0;

  const snap: PerfSnapshot = {
    t: performance.now(),
    fps,
    longTasks: lt,
    longTaskMs: ltMs,
    jsHeapUsedMb: heap.used,
    jsHeapTotalMb: heap.total,
    jsHeapLimitMb: heap.limit,
    domNodes: dom.all,
    svgElements: dom.svgs,
    svgPaths: dom.paths,
    combatRoots: dom.roots,
    combatChildren: dom.combatChildren,
    pieceImgs: dom.pieceImgs,
    storeDispatches: dispatches,
    storeByType: byType,
    timelineActive: lastTimelineActive,
    matchPhase: lastMatchPhase,
    visibility: document.visibilityState,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
  };
  history.push(snap);
  if (history.length > HISTORY_CAP) history.shift();
  return snap;
};

const tickRaf = () => {
  frames += 1;
  rafId = requestAnimationFrame(tickRaf);
};

const paintHud = (s: PerfSnapshot) => {
  if (!hudEl) return;
  const heap =
    s.jsHeapUsedMb != null
      ? `${s.jsHeapUsedMb}/${s.jsHeapTotalMb} MB`
      : "n/a (Chromium only)";
  const types = Object.entries(s.storeByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${k}:${v}`)
    .join(" ");
  hudEl.textContent = [
    `StarChess PERF  fps=${s.fps}  longTasks=${s.longTasks}(${s.longTaskMs}ms)`,
    `heap ${heap}  dpr=${s.dpr}  vis=${s.visibility}`,
    `dom=${s.domNodes}  svg=${s.svgElements}  path=${s.svgPaths}  pieces=${s.pieceImgs}`,
    `combatRoots=${s.combatRoots}  combatNodes=${s.combatChildren}`,
    `dispatch/s=${s.storeDispatches}  ${types}`,
    `phase=${s.matchPhase || "—"}  timeline=${s.timelineActive ? "on" : "off"}`,
  ].join("\n");
};

const ensureHud = () => {
  if (hudEl || typeof document === "undefined") return;
  hudEl = document.createElement("div");
  hudEl.setAttribute("data-testid", "starchess-perf-hud");
  hudEl.setAttribute("aria-hidden", "true");
  Object.assign(hudEl.style, {
    position: "fixed",
    left: "8px",
    bottom: "8px",
    zIndex: "99999",
    margin: "0",
    padding: "8px 10px",
    maxWidth: "min(420px, 92vw)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "11px",
    lineHeight: "1.35",
    whiteSpace: "pre-wrap",
    color: "#e8f4f8",
    background: "rgba(5, 20, 28, 0.88)",
    border: "1px solid #00bac6",
    borderRadius: "6px",
    pointerEvents: "none",
    boxShadow: "0 4px 18px rgba(0,0,0,0.45)",
  } as CSSStyleDeclaration);
  document.body.appendChild(hudEl);
};

const logSample = (s: PerfSnapshot) => {
  // Structured for DevTools filter: starchess-perf
  console.info("[starchess-perf]", s);
  paintHud(s);
  for (const fn of listeners) {
    try {
      fn(s);
    } catch {
      /* ignore listener errors */
    }
  }
};

export const isPerfDebugEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("debug") === "perf" || q.get("perf") === "1") return true;
    if (localStorage.getItem(LS_KEY) === "perf") return true;
  } catch {
    /* ignore */
  }
  return import.meta.env.VITE_STARC_DEBUG === "1" || import.meta.env.VITE_STARC_DEBUG === "true";
};

/** Call from match store dispatch — no-op when debug off. */
export const perfNoteDispatch = (type: string): void => {
  if (!enabled) return;
  dispatchCount += 1;
  dispatchByType.set(type, (dispatchByType.get(type) ?? 0) + 1);
};

/** Optional match context for the HUD line. */
export const perfNoteMatch = (phase: string, timelineActive: boolean): void => {
  if (!enabled) return;
  lastMatchPhase = phase;
  lastTimelineActive = timelineActive;
};

export const onPerfSample = (fn: PerfListener): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getPerfHistory = (): readonly PerfSnapshot[] => history;

export const dumpPerfHistory = (): void => {
  console.table(
    history.map((s) => ({
      fps: s.fps,
      longTasks: s.longTasks,
      longMs: s.longTaskMs,
      heapMb: s.jsHeapUsedMb,
      dom: s.domNodes,
      svg: s.svgElements,
      paths: s.svgPaths,
      combat: s.combatChildren,
      disp: s.storeDispatches,
      phase: s.matchPhase,
      tl: s.timelineActive,
    })),
  );
  console.info("[starchess-perf] full history", history.slice());
};

export const startPerfMonitor = (): void => {
  if (started || typeof window === "undefined") return;
  enabled = true;
  started = true;
  ensureHud();
  document.documentElement.dataset.starchessPerf = "1";
  console.info(
    "[starchess-perf] monitor on — samples/sec in console; dump: window.__starchessPerf.dump()",
  );

  rafId = requestAnimationFrame(tickRaf);

  if (typeof PerformanceObserver !== "undefined") {
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.entryType === "longtask" || e.duration >= 50) {
            longTasks += 1;
            longTaskMs += e.duration;
          }
        }
      });
      po.observe({ entryTypes: ["longtask"] });
    } catch {
      // longtask not supported — ignore
    }
  }

  sampleTimer = setInterval(() => {
    logSample(sample());
  }, SAMPLE_MS);

  (
    window as unknown as {
      __starchessPerf: {
        dump: () => void;
        history: () => readonly PerfSnapshot[];
        sample: () => PerfSnapshot;
      };
    }
  ).__starchessPerf = {
    dump: dumpPerfHistory,
    history: getPerfHistory,
    sample: () => {
      const s = sample();
      logSample(s);
      return s;
    },
  };
};

export const stopPerfMonitor = (): void => {
  enabled = false;
  started = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (sampleTimer) clearInterval(sampleTimer);
  sampleTimer = null;
  po?.disconnect();
  po = null;
  hudEl?.remove();
  hudEl = null;
  delete document.documentElement.dataset.starchessPerf;
};

/** Boot hook — safe to call always. */
export const initPerfDebug = (): void => {
  if (!isPerfDebugEnabled()) return;
  startPerfMonitor();
};
