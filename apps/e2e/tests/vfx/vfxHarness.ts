import { expect, type Page } from "@playwright/test";

/**
 * Shared harness for the VFX guarantee suite.
 *
 * Roster: `_spec/apps/starchess/vfx-guarantees.md` (guarantee → source → test).
 * Sources are `composite-vfx-stack.puml` (layer stack), `timeline-perf.puml` /
 * `timeline-vfx-density.puml` (caps, paint budget) and `animation-pipeline.md`
 * (sole clock, hide ownership).
 *
 * Sampling runs **inside the page** (16ms interval): a Playwright poll loop is
 * too coarse for cues that live ~200ms, and every sample must read the DOM in
 * one atomic frame to compare overlay vs board state.
 */

export const ROOT = "[data-starchess-combat-root]";
export const BOARD_GRID = "[data-board-grid]";

/** Layer roots in CombatOverlayRoot order — stable stack, never per-layer `Show`. */
export const LAYER_ORDER = [
  "data-starchess-cc-damage-layer",
  "data-starchess-gas-drop-layer",
  "data-starchess-attack-layer",
  "data-starchess-death-layer",
  "data-starchess-move-layer",
  "data-starchess-jump-layer",
  "data-starchess-mine-missile-layer",
  "data-starchess-deploy-layer",
] as const;

/** One selector per VFX kind the Composite can play. */
export const CUE = {
  ccDamage: "[data-starchess-cc-damage-layer] [data-cc-damage]",
  gasDrop: "[data-starchess-gas-drop-layer] [data-gas-drop-id]",
  attack: "[data-starchess-attack-layer] [data-attack-anim]",
  death: "[data-starchess-death-layer] [data-death-phase]",
  move: "[data-starchess-move-layer] [data-move-id]",
  jump: "[data-starchess-jump-layer] [data-move-id]",
  jumpTrail: "[data-starchess-jump-layer] [data-jump-trail-frame]",
  mineMissile: "[data-starchess-mine-missile-layer] [data-mine-missile]",
  mineTrail: "[data-starchess-mine-missile-layer] [data-mine-trail-frame]",
  deploy: "[data-starchess-deploy-layer] [data-deploy-piece]",
} as const;

export type CueKind = keyof typeof CUE;

/** Mirrors `presentation/animations/vfxPerf.ts` — pinned here on purpose. */
export const VFX_CAP = {
  tight: 4,
  desktop: 8,
  reviewTight: 2,
  reviewDesktop: 4,
} as const;

/** Any settled unit on a square (img skin or inline nerd glyph, no intent ghost). */
export const settledPiece = (page: Page, square: string, glyph: string) => {
  const root = `${BOARD_GRID} [data-square='${square}']`;
  return page.locator(
    `${root} img[alt='${glyph}'], ${root} [data-piece-inline='${glyph.split(" ")[1]}']:not([data-intent-dest])`,
  );
};

/** Clear the one-time milestone broadcast when deep-linking into turns 1/11/21. */
export const dismissTurnBonus = async (page: Page) => {
  const bubble = page.getByTestId("turn-bonus-bubble");
  const shown = await bubble
    .waitFor({ state: "visible", timeout: 1_000 })
    .then(() => true)
    .catch(() => false);
  if (!shown) return;
  await bubble.click();
  await expect(page.getByTestId("turn-bonus-bubble")).toBeHidden({ timeout: 2_000 });
};

/** Canonical deep link: baseURL is `/starchess/`. */
export const gotoScfen = async (page: Page, scfen: string) => {
  await page.goto(`single?scfen=${encodeURIComponent(scfen)}`);
  await expect(
    page
      .getByTestId("starchess-board-chrome")
      .or(page.getByTestId("mobile-banner"))
      .filter({ visible: true })
      .first(),
  ).toBeVisible({ timeout: 20_000 });
  await dismissTurnBonus(page);
  await expect(page.locator(`${ROOT}`)).toHaveCount(1, { timeout: 10_000 });
};

export const clearStorage = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
};

export type VfxWatch = {
  samples: number;
  /** Max simultaneous elements per cue kind. */
  max: Record<CueKind, number>;
  /** Cue kinds that rendered at least once. */
  ever: CueKind[];
  /** Distinct child-order signatures of the combat root — must stay at one. */
  layerOrders: string[];
  /** Root children that lost their identity mark (a layer remounted). */
  layerRemounts: number;
  /** Distinct combat-root elements seen — >1 means the whole stack remounted. */
  rootSwaps: number;
  /** Samples where a mover and the board both drew the same square. */
  doubleDraws: number;
  /** Distinct `<ccId>:<hitPhase>` signatures seen in the Command Center-damage layer. */
  ccPhases: string[];
  /** Distinct `data-attack-anim` weapon kinds that played. */
  attackAnims: string[];
  /** Distinct `data-deploy-piece` units that dropped. */
  deployPieces: string[];
  /** Cue elements replaced while their id kept rendering (CSS restart). */
  cueRemounts: Record<string, number>;
  /** Max |root − board grid| edge drift in px. */
  rootDrift: number;
  /** Distinct computed `contain` values on the root. */
  containValues: string[];
  /** Distinct `data-overlay-dpr` values. */
  dprValues: string[];
  /** Samples with a board on screen but no combat root. */
  rootMissing: number;
  /** Jump trail rendered in a sample with no jump hull — fade outlives the cue. */
  trailOutlivedJump: boolean;
  /** Mine trail rendered in a sample with no missile — wake outlives the cue. */
  trailOutlivedMissile: boolean;
  /** `data-phase` values seen on the board container. */
  boardPhases: string[];
  /** ms timestamp of the last sample that had any cue on screen (0 = none). */
  lastCueMs: number;
  nowMs: number;
};

/**
 * Install the in-page sampler. Call before the action that triggers a resolve;
 * read with {@link readVfxWatch} / {@link waitForVfxIdle}.
 */
export const startVfxWatch = async (page: Page) => {
  await page.evaluate(
    ({ cue, layers, root: rootSel, grid: gridSel }) => {
      const w = window as unknown as {
        __vfx?: { timer: number; state: Record<string, unknown> };
      };
      if (w.__vfx) window.clearInterval(w.__vfx.timer);

      const kinds = Object.keys(cue) as string[];
      const state = {
        samples: 0,
        max: Object.fromEntries(kinds.map((k) => [k, 0])) as Record<string, number>,
        ever: [] as string[],
        layerOrders: [] as string[],
        layerRemounts: 0,
        rootSwaps: 0,
        doubleDraws: 0,
        ccPhases: [] as string[],
        attackAnims: [] as string[],
        deployPieces: [] as string[],
        cueRemounts: {} as Record<string, number>,
        rootDrift: 0,
        containValues: [] as string[],
        dprValues: [] as string[],
        rootMissing: 0,
        trailOutlivedJump: false,
        trailOutlivedMissile: false,
        boardPhases: [] as string[],
        lastCueMs: 0,
        nowMs: 0,
      };
      // key → { nodes: Set<mark>, peak: simultaneous } → remounts = nodes − peak.
      const identity = new Map<string, { nodes: Set<number>; peak: number }>();
      let marks = 0;
      let layersMarked = false;

      const push = (list: string[], value: string | null) => {
        if (value != null && !list.includes(value)) list.push(value);
      };
      const keyOf = (el: Element) =>
        el.getAttribute("data-move-id") ??
        el.getAttribute("data-gas-drop-id") ??
        el.getAttribute("data-mine-missile") ??
        el.getAttribute("data-jump-trail-frame") ??
        el.getAttribute("data-cc-id") ??
        el.getAttribute("data-square") ??
        "?";

      const sample = () => {
        state.samples += 1;
        state.nowMs = Date.now();

        const root = document.querySelector(rootSel);
        const grid = document.querySelector(gridSel);
        if (grid && !root) state.rootMissing += 1;

        if (root) {
          const tagged = root as Element & { __vfxRoot?: number };
          if (tagged.__vfxRoot === undefined) {
            state.rootSwaps += 1;
            tagged.__vfxRoot = state.rootSwaps;
          }
          const children = [...root.children];
          push(
            state.layerOrders,
            children
              .map((c) => c.getAttributeNames().find((n) => n.startsWith("data-starchess")) ?? c.tagName)
              .join(","),
          );
          if (!layersMarked && children.length === layers.length) {
            children.forEach((c, i) => {
              (c as Element & { __vfxLayer?: number }).__vfxLayer = i;
            });
            layersMarked = true;
          } else if (layersMarked) {
            const kept = children.filter(
              (c) => (c as Element & { __vfxLayer?: number }).__vfxLayer !== undefined,
            ).length;
            state.layerRemounts = Math.max(state.layerRemounts, children.length - kept);
          }
          push(state.containValues, getComputedStyle(root).contain);
          push(state.dprValues, root.getAttribute("data-overlay-dpr"));
          if (grid) {
            const r = root.getBoundingClientRect();
            const g = grid.getBoundingClientRect();
            state.rootDrift = Math.max(
              state.rootDrift,
              Math.abs(r.x - g.x),
              Math.abs(r.y - g.y),
              Math.abs(r.width - g.width),
              Math.abs(r.height - g.height),
            );
          }
        }

        push(
          state.boardPhases,
          document.querySelector("[data-testid='chessboard']")?.getAttribute("data-phase") ?? null,
        );

        let anyCue = false;
        const counts: Record<string, number> = {};
        for (const kind of kinds) {
          const els = [...document.querySelectorAll(cue[kind as keyof typeof cue])];
          counts[kind] = els.length;
          if (els.length > 0) {
            // A burning hull is persistent presentation, not a transient cue —
            // it must not keep the recording "busy" forever.
            if (kind !== "ccDamage") anyCue = true;
            if (!state.ever.includes(kind)) state.ever.push(kind);
            if (els.length > state.max[kind]!) state.max[kind] = els.length;
          }
          const perKey = new Map<string, number>();
          for (const el of els) {
            const node = el as Element & { __vfxMark?: number };
            if (node.__vfxMark === undefined) {
              marks += 1;
              node.__vfxMark = marks;
            }
            const key = `${kind}:${keyOf(el)}`;
            const entry = identity.get(key) ?? { nodes: new Set<number>(), peak: 0 };
            entry.nodes.add(node.__vfxMark);
            identity.set(key, entry);
            perKey.set(key, (perKey.get(key) ?? 0) + 1);
          }
          for (const [key, n] of perKey) {
            const entry = identity.get(key)!;
            entry.peak = Math.max(entry.peak, n);
          }
        }
        // Hide ownership: while a mover owns a square the board must not draw it.
        // Hoverbikes are exempt — their fallback pose flips `data-square` to the
        // destination at the last leg, where a board commit is legitimate.
        for (const mover of document.querySelectorAll(
          `${cue.move}:not([data-move-piece='n'])`,
        )) {
          const square = mover.getAttribute("data-square");
          if (!square) continue;
          const glyphs = document.querySelectorAll(
            `${gridSel} [data-square='${square}'] img[alt], ${gridSel} [data-square='${square}'] [data-piece-inline]`,
          ).length;
          if (glyphs > 0) state.doubleDraws += 1;
        }

        for (const hull of document.querySelectorAll(cue.attack)) {
          push(state.attackAnims, hull.getAttribute("data-attack-anim"));
        }
        for (const drop of document.querySelectorAll(cue.deploy)) {
          push(state.deployPieces, drop.getAttribute("data-deploy-piece"));
        }

        for (const slot of document.querySelectorAll(
          "[data-starchess-cc-damage-layer] [data-cc-id]",
        )) {
          push(
            state.ccPhases,
            `${slot.getAttribute("data-cc-id")}:${slot.getAttribute("data-cc-hit-phase")}`,
          );
        }

        if (counts.jumpTrail! > 0 && counts.jump === 0) state.trailOutlivedJump = true;
        if (counts.mineTrail! > 0 && counts.mineMissile === 0) {
          state.trailOutlivedMissile = true;
        }
        if (anyCue) state.lastCueMs = state.nowMs;

        state.cueRemounts = {};
        for (const [key, entry] of identity) {
          const extra = entry.nodes.size - entry.peak;
          if (extra > 0) state.cueRemounts[key] = extra;
        }
      };

      sample();
      const timer = window.setInterval(sample, 16);
      w.__vfx = { timer, state };
    },
    { cue: CUE, layers: LAYER_ORDER, root: ROOT, grid: BOARD_GRID },
  );
};

export const readVfxWatch = (page: Page): Promise<VfxWatch> =>
  page.evaluate(() => {
    const w = window as unknown as { __vfx?: { state: unknown } };
    return JSON.parse(JSON.stringify(w.__vfx?.state ?? {})) as never;
  });

export const stopVfxWatch = async (page: Page) => {
  await page.evaluate(() => {
    const w = window as unknown as { __vfx?: { timer: number } };
    if (w.__vfx) window.clearInterval(w.__vfx.timer);
  });
};

/**
 * Wait until the overlay has been cue-free for `idleMs`, then stop sampling and
 * return the recording. Fails the calling test if no cue ever rendered.
 */
export const waitForVfxIdle = async (
  page: Page,
  { idleMs = 700, timeout = 25_000 }: { idleMs?: number; timeout?: number } = {},
): Promise<VfxWatch> => {
  const deadline = Date.now() + timeout;
  let watch = await readVfxWatch(page);
  while (Date.now() < deadline) {
    watch = await readVfxWatch(page);
    if (watch.lastCueMs > 0 && watch.nowMs - watch.lastCueMs > idleMs) break;
    await page.waitForTimeout(100);
  }
  await stopVfxWatch(page);
  return watch;
};

/** Queue → End → record the whole resolve. */
export const recordResolve = async (page: Page, opts?: { idleMs?: number }) => {
  await startVfxWatch(page);
  await page.getByTestId("turn-end").click();
  return waitForVfxIdle(page, opts);
};

/** Record a fixed window instead of waiting for the overlay to drain. */
export const recordResolveFor = async (page: Page, ms: number) => {
  await startVfxWatch(page);
  await page.getByTestId("turn-end").click();
  await page.waitForTimeout(ms);
  const watch = await readVfxWatch(page);
  await stopVfxWatch(page);
  return watch;
};
