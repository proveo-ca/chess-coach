import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { expect, test, type CDPSession, type Page } from "@playwright/test";

import { CUE, ROOT, type CueKind } from "./vfxHarness";

/**
 * Which combat animations need optimizing — Moves · Attacks · Deaths · Deploys.
 *
 * The timeline's wall-clock pace is authoritative (multiplayer: every client
 * advances in lockstep), so an animation never slows the game. A slow device
 * shows up as VFX that do not fit their slot; this suite names them.
 *
 * Every Storybook demo runs at 1× and 20× CPU (`Emulation.setCPUThrottlingRate`,
 * the call behind DevTools' "20× slowdown"). Per CSS animation it records:
 *
 * - **non-composited** (1× run, from the trace): Chromium's own verdict —
 *   `compositeFailed` bits + `unsupportedProperties` on the `Animation` trace
 *   events, the same data as DevTools' "non-composited animations" insight.
 *   These run on the main thread every frame.
 * - **cut** — the cue unmounted before this animation's finite keyframes ended:
 *   its keyframes outlast the slot the timeline gives it at that CPU speed.
 * - **mount hitch** — the rAF frame in which it first appeared was long
 *   (> 50ms): starting it (style, layer, SVG paint) is expensive.
 *
 * The ranked report goes to `test-results/vfx-optimize/` (JSON + Markdown) and
 * the console. Set `VFX_OPTIMIZE_STRICT=1` to fail on any flagged animation, and
 * `VFX_TIER=lite` to measure the lite tier (`report-lite.md`).
 * Needs the StarChess Storybook (`E2E_TARGET=starchess` starts it on :6007).
 */

const STORYBOOK = process.env.STORYBOOK_URL ?? "http://127.0.0.1:6007";
const STRICT = process.env.VFX_OPTIMIZE_STRICT === "1";
const TIER = process.env.VFX_TIER === "lite" ? "lite" : "full";
const SUFFIX = TIER === "lite" ? "-lite" : "";
const RATES = [1, 20] as const;
const WINDOW_MS = 5_000;
const LONG_FRAME_MS = 50;
/** A mount hitch counts at 20× only past this (≈ 5ms of real work at 1×). */
const HITCH_FLAG_MS = 100;
/** Progress an animation must reach before its cue unmounts to count as played. */
const PLAYED = 0.95;

const REPO = resolve(__dirname, "../../../..");
const CSS_ROOTS = ["apps/starchess/src", "packages/ui/web/src"];
const OUT_DIR = resolve(__dirname, "../../test-results/vfx-optimize");

type Category = "move" | "attack" | "death" | "deploy";

type Scenario = {
  category: Category;
  story: string;
  /** Cue kinds that must appear in the window for the run to count. */
  expect: CueKind[];
  /** Review stories only play when stepped. */
  stepReview?: boolean;
};

const SCENARIOS: Scenario[] = [
  ...["path-block-discovered-marine", "same-square-mechas", "hoverbike-speed"].map(
    (s): Scenario => ({
      category: "move",
      story: `starchess-collision--${s}`,
      expect: ["move"],
      stepReview: true,
    }),
  ),
  ...[
    "marine",
    "hoverbike",
    "mecha",
    "packed-tank-mode",
    "sieged-tank-mode",
    "battle-ship",
    "command-center",
  ].map(
    (s): Scenario => ({ category: "attack", story: `starchess-attack-animations--${s}`, expect: ["attack"] }),
  ),
  ...["marine", "hoverbike", "mecha", "siege-tank", "battle-ship", "command-center", "spider-mine"].map(
    (s): Scenario => ({ category: "death", story: `starchess-death-animations--${s}`, expect: ["death"] }),
  ),
  { category: "deploy", story: "starchess-collision--deploy-crush-enemy", expect: ["deploy", "death"] },
];

/** Chromium `CompositorAnimations::FailureReason` bits (mirrors DevTools' table). */
const COMPOSITE_FAILURE = [
  "accelerated animations disabled",
  "effect suppressed by devtools",
  "invalid animation or effect",
  "unsupported timing parameters",
  "non-replace composite mode",
  "target has invalid compositing state",
  "target has incompatible animations",
  "target has CSS offset",
  "multiple transform properties",
  "affects non-CSS properties",
  "transform cannot be accelerated on target",
  "transform depends on box size",
  "filter may move pixels",
  "unsupported CSS property",
  "mixed keyframe value types",
  "timeline source has invalid compositing state",
  "no visible change",
  "affects !important property",
  "SVG target has independent transform property",
] as const;

const decodeFailure = (bits: number) =>
  COMPOSITE_FAILURE.filter((_, i) => bits & (1 << i));

/** `_shardFly_1ndnb_1` (CSS-module hash) → `shardFly`. */
const prettyName = (raw: string) => raw.match(/^_(.+)_[a-z0-9]{5}_\d+$/)?.[1] ?? raw;

// ---------------------------------------------------------------- in-page probe

type AnimStat = { starts: number; cut: number; minProgress: number; hitchMs: number[] };

type Sample = {
  frames: number;
  fps: number;
  p95Ms: number;
  longFrames: number;
  cues: Partial<Record<CueKind, number>>;
  anims: Record<string, AnimStat>;
};

/**
 * rAF sampler inside the page (Playwright polling is too coarse for ~200ms cues).
 * Tracks every finite CSS animation under a cue element by `animationName`.
 */
const sampleFrames = (page: Page, windowMs: number) =>
  page.evaluate(
    ({ windowMs, cue, longMs, played }) =>
      new Promise<Sample>((done) => {
        type Live = { name: string; progress: number };
        const live = new Map<Element, Map<Animation, Live>>();
        const seenCues: Record<string, Set<Element>> = {};
        const anims: Record<string, AnimStat> = {};
        const stat = (name: string) => (anims[name] ??= { starts: 0, cut: 0, minProgress: 1, hitchMs: [] });

        const progressOf = (a: Animation) => {
          if (a.playState === "finished") return 1;
          const end = Number(a.effect?.getComputedTiming().endTime);
          return Math.min(1, Number(a.currentTime ?? 0) / (end || 1));
        };

        const scan = (frameMs: number) => {
          for (const [kind, sel] of Object.entries(cue)) {
            for (const el of document.querySelectorAll(sel)) {
              (seenCues[kind] ??= new Set()).add(el);
              const tracked = live.get(el) ?? new Map<Animation, Live>();
              live.set(el, tracked);
              for (const a of el.getAnimations({ subtree: true })) {
                const name = (a as CSSAnimation).animationName;
                if (!name || !Number.isFinite(Number(a.effect?.getComputedTiming().endTime))) continue;
                const t = tracked.get(a);
                if (t) {
                  t.progress = Math.max(t.progress, progressOf(a));
                  continue;
                }
                tracked.set(a, { name, progress: progressOf(a) });
                const s = stat(name);
                s.starts++;
                if (frameMs > longMs) s.hitchMs.push(Math.round(frameMs));
              }
            }
          }
          for (const [el, tracked] of live) {
            if (el.isConnected) continue;
            live.delete(el);
            for (const t of tracked.values()) {
              if (t.progress >= played) continue;
              const s = stat(t.name);
              s.cut++;
              s.minProgress = Math.min(s.minProgress, +t.progress.toFixed(2));
            }
          }
        };

        const deltas: number[] = [];
        const t0 = performance.now();
        let last = t0;
        const tick = (now: number) => {
          const d = now - last;
          deltas.push(d);
          last = now;
          scan(d);
          if (now - t0 < windowMs) {
            requestAnimationFrame(tick);
            return;
          }
          const sorted = [...deltas].sort((a, b) => a - b);
          done({
            frames: deltas.length,
            fps: +(deltas.length / ((now - t0) / 1000)).toFixed(1),
            p95Ms: +sorted[Math.floor(sorted.length * 0.95)]!.toFixed(1),
            longFrames: deltas.filter((x) => x > longMs).length,
            cues: Object.fromEntries(Object.entries(seenCues).map(([k, s]) => [k, s.size])),
            anims,
          });
        };
        requestAnimationFrame(tick);
      }),
    { windowMs, cue: CUE, longMs: LONG_FRAME_MS, played: PLAYED },
  );

// ---------------------------------------------------------------- trace probe

type CompositeVerdict = { node: string; failure: number; unsupported: string[] };

/** Chromium's per-animation compositing verdict from the `Animation` trace events. */
type TraceEvent = {
  name: string;
  ph: string;
  id?: string;
  id2?: { local?: string };
  args?: { data?: Record<string, unknown> };
};

const traceComposite = async <T,>(cdp: CDPSession, during: () => Promise<T>) => {
  const events: TraceEvent[] = [];
  const onData = (e: { value: object[] }) => {
    events.push(...(e.value as TraceEvent[]));
  };
  cdp.on("Tracing.dataCollected", onData);
  const complete = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", {
    transferMode: "ReportEvents",
    traceConfig: {
      // Only the animation events: the timeline categories fill the trace
      // buffer on the review stories and drop the moves' verdicts.
      includedCategories: ["blink.animations"],
    },
  });
  const result = await during();
  await cdp.send("Tracing.end");
  await complete;
  cdp.off("Tracing.dataCollected", onData);

  // Chromium reuses an animation's trace id once it ends, so each begin event
  // opens a fresh record and later events attach to the latest one.
  type Rec = { name?: string; node?: string; failure: number; unsupported: Set<string> };
  const recs: Rec[] = [];
  const open = new Map<string, Rec>();
  for (const e of events) {
    if (e.name !== "Animation") continue;
    const id = e.id2?.local ?? e.id ?? "";
    const data = e.args?.data ?? {};
    let rec = open.get(id);
    if (e.ph === "b" || !rec) {
      rec = { failure: 0, unsupported: new Set<string>() };
      recs.push(rec);
      open.set(id, rec);
    }
    if (e.ph === "b") {
      rec.name = String(data.displayName ?? "");
      rec.node = String(data.nodeName ?? "").split(" ")[0];
    }
    if (typeof data.compositeFailed === "number") rec.failure |= data.compositeFailed;
    for (const p of (data.unsupportedProperties as string[] | undefined) ?? []) rec.unsupported.add(p);
  }
  const verdicts: Record<string, CompositeVerdict> = {};
  for (const r of recs) {
    if (!r.name) continue;
    const v = (verdicts[r.name] ??= { node: r.node ?? "?", failure: 0, unsupported: [] });
    v.failure |= r.failure;
    v.unsupported = [...new Set([...v.unsupported, ...r.unsupported])];
  }
  return { result, verdicts };
};

// ---------------------------------------------------------------- report

type Row = {
  name: string;
  source: string;
  categories: Set<Category>;
  stories: Set<string>;
  node: string;
  nonComposited: string[];
  unsupported: Set<string>;
  starts: Record<number, number>;
  cut: Record<number, number>;
  minProgress: Record<number, number>;
  hitchMs: Record<number, number[]>;
};

const rows = new Map<string, Row>();
const storyRuns: Record<string, unknown>[] = [];

const rowFor = (raw: string): Row => {
  const name = prettyName(raw);
  let row = rows.get(name);
  if (!row) {
    row = {
      name,
      source: "",
      categories: new Set(),
      stories: new Set(),
      node: "?",
      nonComposited: [],
      unsupported: new Set(),
      starts: {},
      cut: {},
      minProgress: {},
      hitchMs: {},
    };
    rows.set(name, row);
  }
  return row;
};

/** `@keyframes <name>` → `path:line`, so each flag points at code. */
const findKeyframes = (() => {
  let index: Map<string, string> | undefined;
  const walk = (dir: string, out: string[]) => {
    for (const f of readdirSync(dir)) {
      if (f === "node_modules" || f.startsWith(".")) continue;
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (f.endsWith(".css")) out.push(p);
    }
    return out;
  };
  return (name: string) => {
    if (!index) {
      index = new Map();
      for (const root of CSS_ROOTS) {
        for (const file of walk(join(REPO, root), [])) {
          readFileSync(file, "utf8")
            .split("\n")
            .forEach((line, i) => {
              const m = line.match(/@keyframes\s+([\w-]+)/);
              if (m && !index!.has(m[1]!)) index!.set(m[1]!, `${relative(REPO, file)}:${i + 1}`);
            });
        }
      }
    }
    return index.get(name) ?? "?";
  };
})();

type Flag = "non-composited" | "cut@1x" | "cut@20x" | "mount-hitch@20x";

const flagsOf = (r: Row): Flag[] => {
  const flags: Flag[] = [];
  if (r.nonComposited.length) flags.push("non-composited");
  if (r.cut[1]) flags.push("cut@1x");
  if (r.cut[20]) flags.push("cut@20x");
  const hitches = r.hitchMs[20] ?? [];
  if (hitches.some((h) => h > HITCH_FLAG_MS)) flags.push("mount-hitch@20x");
  return flags;
};

/** Worst first: main-thread every frame > cut at full speed > mount cost > cut only when throttled. */
const severity = (r: Row) => {
  const f = flagsOf(r);
  const hitch = Math.max(0, ...(r.hitchMs[20] ?? []));
  return (
    (f.includes("non-composited") ? 1e6 : 0) +
    (f.includes("cut@1x") ? 1e5 : 0) +
    (f.includes("mount-hitch@20x") ? 1e3 + hitch : 0) +
    (f.includes("cut@20x") ? ((r.cut[20] ?? 0) / Math.max(1, r.starts[20] ?? 1)) * 100 : 0)
  );
};

const writeReport = () => {
  const ranked = [...rows.values()]
    .map((r) => ({ ...r, source: findKeyframes(r.name), flags: flagsOf(r) }))
    .sort((a, b) => severity(b) - severity(a));
  const pct = (cut = 0, starts = 0) => (starts ? `${cut}/${starts}` : "–");
  const lines = [
    "| # | animation | on | flags | non-composited reason | cut 1× | cut 20× | min progress 20× | max mount hitch 20× | categories | source |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...ranked.map(
      (r, i) =>
        `| ${i + 1} | \`${r.name}\` | ${r.node} | ${r.flags.join(", ") || "ok"} | ${[
          ...r.nonComposited,
          ...[...r.unsupported].map((p) => `\`${p}\``),
        ].join("; ")} | ${pct(r.cut[1], r.starts[1])} | ${pct(r.cut[20], r.starts[20])} | ${
          r.cut[20] ? r.minProgress[20] : "–"
        } | ${r.hitchMs[20]?.length ? `${Math.max(...r.hitchMs[20])}ms` : "–"} | ${[...r.categories].join(", ")} | ${r.source} |`,
    ),
  ];
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, `report${SUFFIX}.json`),
    JSON.stringify(
      {
        animations: ranked.map((r) => ({
          ...r,
          categories: [...r.categories],
          stories: [...r.stories],
          unsupported: [...r.unsupported],
        })),
        stories: storyRuns,
      },
      null,
      2,
    ),
  );
  const legend = [
    "- **non-composited** — Chromium runs it on the main thread every frame (reason from the trace).",
    "- **cut@Nx** — its cue unmounted before the keyframes ended: they outlast the slot the timeline gives them at that CPU speed. A collision story kills movers mid-path by design, so a move cut there can be intended.",
    `- **mount-hitch@20x** — the frame it started in took > ${HITCH_FLAG_MS}ms at 20×.`,
  ];
  writeFileSync(
    join(OUT_DIR, `report${SUFFIX}.md`),
    `# VFX optimization report (${TIER} tier)\n\n${legend.join("\n")}\n\n${lines.join("\n")}\n`,
  );
  console.log(`\nVFX optimization report (${TIER}) → ${relative(REPO, OUT_DIR)}/report${SUFFIX}.md\n${lines.join("\n")}\n`);
  return ranked;
};

// ---------------------------------------------------------------- suite

test.describe("VFX · which animations need optimizing", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "CPU throttling + compositor trace are Chromium CDP features");
  test.use({ viewport: { width: 390, height: 844 } });
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  for (const sc of SCENARIOS) {
    for (const rate of RATES) {
      test(`${sc.category} · ${sc.story.split("--")[1]} · ${rate}× · ${TIER}`, async ({ page }) => {
        // The tier store reads this before any layer mounts (it owns <html data-vfx-tier>).
        await page.addInitScript((tier) => {
          localStorage.setItem(
            "starchess_vfx_tier",
            JSON.stringify({ tier, probedAt: Date.now(), probeVersion: 1, liteStreak: 0 }),
          );
        }, TIER);
        await page.goto(`${STORYBOOK}/iframe.html?id=${sc.story}&viewMode=story`);
        await page.locator(ROOT).first().waitFor({ state: "attached", timeout: 30_000 });
        await page.waitForTimeout(500);

        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });

        const run = async () => {
          const sampling = sampleFrames(page, WINDOW_MS);
          if (sc.stepReview) {
            const next = page.getByTestId("review-turn-next").first();
            for (let i = 0; i < 2; i++) {
              if (await next.isEnabled().catch(() => false)) await next.click({ timeout: 10_000 });
              await page.waitForTimeout(2_000);
            }
          }
          return sampling;
        };
        // The compositing verdict does not depend on CPU speed: trace at 1× only.
        const { result: sample, verdicts }: { result: Sample; verdicts: Record<string, CompositeVerdict> } =
          rate === 1 ? await traceComposite(cdp, run) : { result: await run(), verdicts: {} };
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

        for (const [raw, v] of Object.entries(verdicts)) {
          const row = rowFor(raw);
          row.node = v.node;
          row.nonComposited = [...new Set([...row.nonComposited, ...decodeFailure(v.failure)])];
          for (const p of v.unsupported) row.unsupported.add(p);
          row.categories.add(sc.category);
          row.stories.add(sc.story);
        }
        for (const [raw, s] of Object.entries(sample.anims)) {
          const row = rowFor(raw);
          row.categories.add(sc.category);
          row.stories.add(sc.story);
          row.starts[rate] = (row.starts[rate] ?? 0) + s.starts;
          row.cut[rate] = (row.cut[rate] ?? 0) + s.cut;
          if (s.cut) row.minProgress[rate] = Math.min(row.minProgress[rate] ?? 1, s.minProgress);
          (row.hitchMs[rate] ??= []).push(...s.hitchMs);
        }
        const summary = {
          story: sc.story,
          category: sc.category,
          rate,
          fps: sample.fps,
          p95Ms: sample.p95Ms,
          longFrames: sample.longFrames,
          cues: sample.cues,
        };
        storyRuns.push(summary);
        test.info().annotations.push({ type: "fps", description: JSON.stringify(summary) });

        for (const kind of sc.expect) {
          expect(sample.cues[kind] ?? 0, `${kind} VFX never played at ${rate}×`).toBeGreaterThan(0);
        }
      });
    }
  }

  test.afterAll(() => {
    const ranked = writeReport();
    if (STRICT) {
      const flagged = ranked.filter((r) => r.flags.length).map((r) => `${r.name} (${r.flags.join(", ")})`);
      expect(flagged, "animations that need optimizing").toEqual([]);
    }
  });
});
