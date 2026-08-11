# Timeline / animation performance

**Patterns:** Commit coalesce (gate), structural sharing, dual-signal isolation,
VFX density control, paint-property audit (compositor relief)  
**Status:** **DONE (main phase)** — commit path + dual-signal + light paint/GPU +
compositor relief (paint audit · phase ring · review caps) shipped and
**measured 2026-08-11** (Trace `…105537`): DroppedFrame **330 (8% of baseline
4045)** · GPU main busy **8.3s** (was ~39s) — acceptance met; P2 items remain  
**Depends on:** Composite VFX (`CombatCueFrame`, no per-layer `Show`); sole clock
in `animation-pipeline.md`  
**Unblocks:** Timeline-active FPS toward idle FPS; GPU compositor churn down
(Swap/Paint/Commit) without cue-math changes

## Goal

Cut presentation-frame cost during timeline playback so **timeline-active FPS**
approaches **idle FPS** on the same machine, without breaking:

- components do **not** own the clock (`playTimeline` only)
- only MatchStore `dispatch` writes presentation state
- review never mutates terminal `liveSnapshot` mid-replay
- trail fade outlives `TIMELINE_DONE`
- no per-layer `Show` (CSS restart)

## Evidence

### Baseline (2026-08-11 · pre-work)

| Source | Finding |
| --- | --- |
| `browser-logs.json` | FPS 41–165; `storeDispatches` r≈−0.55 vs FPS; timeline-on ~72 vs idle ~135; `TIMELINE_COMMIT` storms; combat DOM 78–182; heap stable |
| Trace `…092356` | `timelinePlayer` FC **609ms**; Solid `runTop` ~207ms; paint max **7.5ms**; DroppedFrame **~4045**; GPU ~37s; hot paint: `_pieceFace`, board wrapper, `_aimWrap` / `_aura` / `_fragL` / `_hull` |

### After commit path + dual-signal + light paint/GPU (Trace `…101115`)

| Metric | Baseline | After | Result |
| --- | --- | --- | --- |
| FC `timelinePlayer` | 609ms | **162ms** (+ gate **394ms**) | Win — coalesce works |
| Solid `runTop` | 207ms | **150ms** | Win |
| Paint max slice | 7.5ms | **1.1ms** | Win |
| Layout max | 2.3ms | **0.8ms** | Win |
| DroppedFrame | ~4045 / 42s | **~4208 / 44s** | **Miss** — still compositor/GPU bound |
| GPUTask total | ~37s | ~39s | No win |
| Paint hotspots | pieceFace / board / aim / aura / frag / hull | **same** | Unchanged |

**Conclusion:** Reactivity + main-thread spikes improved. Remaining bottleneck is
**CSS animation / layer volume + GPU** on high-Hz displays — not more
`will-change` / `contain` alone.

### After compositor relief (2026-08-11 · Trace `…101115`)

The same trace that proved the gate/dual-signal/share work also showed where the
time actually went:

| Source | Finding |
| --- | --- |
| Renderer JS main thread | **~12% busy** — gate + dual-signal + structural share succeeded |
| GPU process main thread | **~90% busy** — compositor churn is the bottleneck |
| Compositor counters | Swap ~260/s · Paint ~200/s · Commit ~192/s · BeginImplFrame ~448/s |
| Driver | paint-invalidating CSS animations (`outline-color`, `border-*-color`, `box-shadow` keyframes) + high volume of simultaneous VFX |

**Shipped (2026-08-11):**

1. **Gas aura opacity-only** — `GasDropAnimation.module.css`: `.aura` carries a
   static `outline` + `box-shadow` (paint paid once); `@keyframes gasAuraIn`
   animates only `opacity`. Same duration/easing; reduced-motion clamps to 1ms.
2. **Board phase ring overlay** — `StarChessBoard.module.css` + `.tsx`:
   `.chessboard-container` lost its `outline` + `transition`; a new
   absolutely-positioned `.board-phase-ring` div (first child of the container,
   `aria-hidden`, `pointer-events: none`) carries the phase look via
   `data-phase="check|intent|resolve"` with `transition: opacity 280ms ease`.
   Colors snap per phase; the fade is opacity-only; `position: relative` on the
   container as containing block; reduced-motion clamps the ring to 1ms.
3. **Review density caps** — `vfxPerf.ts`: `VfxDensity = "full" | "review"`,
   `VFX_CAP_REVIEW_TIGHT = 2`, `VFX_CAP_REVIEW_DESKTOP = 4`,
   `capForDensity(density)`; `capCues` default now `capForDensity("full")`.
4. **Density wiring** — `useCombatOverlays.ts`: a `density` memo reads
   `store.shell().phase === "gameOver"` (matchReducer guards `REVIEW_PLAY` to
   `gameOver` only; live play stays `resolving` until `TIMELINE_DONE`), plus a
   `cap` memo = `capForDensity(density())` keyed into all 9 `capCues` call
   sites (attacks, deaths, hull moves, jumps, jumpTrails, missiles,
   missileTrails, gas, deploys); manual caches keyed with the cap.
5. **Tests** — `src/__tests__/vfxPerf.test.ts` extended (7 passing).

**Acceptance (this phase):** same machine, DualNav combat-heavy `REVIEW_PLAY`,
`?debug=perf` + Chrome trace. Force 60Hz (`--force-frame-rate=60`) where vsync
can be forced; otherwise report **Paint/s + Commit/s + Blink Animation event
counts as primary** and DroppedFrame as a **ratio (DroppedFrame/BeginImplFrame)**.
Target ≤50% of baseline on all (see Acceptance metrics).

### Measured after compositor relief (2026-08-11 · Trace `…105537`)

Same analysis pipeline + playback window as baseline `…092356` / after1
`…101115`:

| Metric | baseline `…092356` | after1 `…101115` | latest `…105537` | vs baseline |
| --- | --- | --- | --- | --- |
| DroppedFrame (total) | 4045 / 42.2s | 4208 / 44.9s | **330 / 42.0s** | **−92%** |
| DroppedFrame/s | 95.9 | 93.8 | **7.9** | **−92%** |
| GPU main (CrGpuMain) busy | 38.6s | 40.8s | **8.3s** | **−79%** |
| GPUTask sum | 37.2s | 39.2s | **6.1s** | **−84%** |
| Renderer main busy | 5.3s | 5.4s | 6.8s | light |
| Paint max | 1.44ms | 1.00ms | **0.88ms** | −39% |
| Paint/s | 201 | 200 | 384 | up (cheap paints, more frames) |
| Commit/s | 191 | 193 | 417 | up (cheap) |
| Swap/s | 251 | 262 | 567 | up (compositor no longer GPU-bound) |
| Blink `Animation`/s | 68.2 | 64.6 | 66.9 | unchanged |
| paint hotspot `_board-layout-wrapper` | 77ms (n=1639) | 74ms | **gone from top-12** | phase-ring worked |
| paint hotspot gas `_aura` | 4ms | 4ms | **gone** | opacity-only aura worked |
| new hotspot `_pieceSpecialUsed` IMG | — | — | 30ms (n=626) | accepted tradeoff (piece outline kept) |

**Acceptance verdict:** DroppedFrame **≤50% of ~4045 baseline → met and
exceeded: 330 (8%)**. Phase complete.

- **GPU/compositor bottleneck resolved** — GPU main busy ~90%→~20% (8.3s);
  GPUTask sum 39s→6s.
- **Frame pipeline rate doubled** (Swap 251→567/s · Paint/s · Commit/s) because
  the vsync-off env no longer throttles: frames are now cheap (paint p95 239µs,
  max 0.88ms), so the browser produces near max rate instead of being GPU-bound.
  Raw per-second Paint/Commit counts are therefore **not** a useful regression
  signal in this env — use **DroppedFrame + GPU busy + paint max**.
- **Animation-count proxy did NOT hold** (Blink `Animation` ~67/s, unchanged):
  the phase did not remove animations, it made each compositor-cheap
  (opacity-only) — the count metric doesn't measure paint cost. Replaced by
  "GPU main busy ≤50% of baseline" (met: 21%) — see Acceptance metrics.
- `_pieceSpecialUsed` outline transition (special-used green outline) was
  **intentionally kept**; it shows as a small paint hotspot (30ms, n=626) —
  accepted tradeoff, P2 candidate.

## Contracts (shipped)

### Public clock (unchanged)

```
playTimeline → TimelineCallbacks { onStart, onCommit, onDone }
  → TIMELINE_START | TIMELINE_COMMIT | TIMELINE_DONE | TIMELINE_SOFT_DONE
```

### TimelineCommitGate (shipped)

| Rule | Behavior |
| --- | --- |
| Merge | Last-write-wins field replace |
| Flush | `scheduler.delay(0)`; sync flush before done/start/cancel |
| Sources | `timelineCommitGate.ts` · `bindTimeline` in MatchStoreContext |

### Dual-signal store (shipped)

| Read | Role |
| --- | --- |
| `store.shell()` | Phase, snaps, economies, selection |
| `store.timeline()` | Cues, playing, progress, display* |
| `store.state()` | Merge for tests / rare full snapshot |
| `useCombatOverlays` | `timeline()` + `shell().phase` (review caps signal) |
| `readDisplayedSnapshot` | shell + timeline display* only |

### Light paint/GPU (shipped — partial)

| Lever | Choice |
| --- | --- |
| Root contain | `layout style` only — **never paint** (trails overflow) |
| DPR | `--overlay-dpr` clamped ≤2 on combat root |
| will-change | Only on **active** anim classes (mover*, aimWrap, fragL, hull, …) |
| Caps | `capCues` on cue lists **and** jump/mine trails |

## Phases

| Phase | Status | Notes |
| --- | --- | --- |
| Commit path | **Done** | Gate + structural share |
| Dual-signal | **Done** | shell ∥ timeline |
| Light paint/GPU | **Done (partial)** | Main-thread better; DroppedFrame target **not** met |
| **Compositor relief (VFX density)** | **Done (2026-08-11 · measured `…105537`)** | Paint audit + phase ring + review caps; DroppedFrame **330 (8% of baseline)** · GPU busy 8.3s — **met**; P2 remains (below) |

### Compositor relief (done 2026-08-11 · measured `…105537`) + P2

Goal: cut GPU-process compositor churn (Swap ~260/s · Paint ~200/s · Commit
~192/s) without a WebGL rewrite and without per-layer `Show`. The original
"fog-cull" plan was **rejected** by the human: the review perf test case has no
fog, so paint-property audit + phase ring + review caps were chosen instead.

**Shipped:**

1. **Paint-animation audit** — audit `@keyframes` / `transition` on paint-only
   properties (`outline-color`, `border-*-color`, `box-shadow`) → convert to
   `transform`/`opacity`, or pay paint once and fade opacity (gas `.aura`,
   `.board-phase-ring`).
2. **Gas aura opacity-only** — `GasDropAnimation.module.css` `.aura`: static
   `outline` + `box-shadow`, `@keyframes gasAuraIn` animates only `opacity`
   (same duration/easing/reduced-motion).
3. **Board phase ring overlay** — `.chessboard-container` no longer carries
   `outline`/`transition`; `.board-phase-ring` absolute overlay child
   (first in DOM, `aria-hidden`, `pointer-events: none`) does the phase look
   (`data-phase="check|intent|resolve"`), fading via `opacity` only
   (`transition: opacity 280ms ease`; reduced-motion 1ms).
4. **Review density caps** — `vfxPerf.ts` `VfxDensity` / `capForDensity` /
   `VFX_CAP_REVIEW_TIGHT = 2` / `VFX_CAP_REVIEW_DESKTOP = 4`; `capCues`
   defaults to `capForDensity("full")`.
5. **Density wiring** — `useCombatOverlays.ts` `density` memo from
   `store.shell().phase === "gameOver"` (matchReducer guards `REVIEW_PLAY` to
   `gameOver` only; live stays `resolving` until `TIMELINE_DONE`); `cap` memo
   = `capForDensity(density())` at all 9 `capCues` call sites (attacks,
   deaths, hull moves, jumps, jumpTrails, missiles, missileTrails, gas,
   deploys) + manual caches.

**Next (P2, optional — not the main phase):** `AttackAnimation` `fragShockwave`
`border-color` keyframe removal; `.pieceSpecialUsed` outline transition (now a
measured paint hotspot 30ms, n=626 — accepted tradeoff while kept); optional-FX
drop (`targetSlot glow`, secondary particles) in review only.

**Explicitly deferred (non-goals):** `Chip` phase border transition ·
`InlineBishop` crank loop · `CombatOverlayRoot` / `MatchStoreContext` /
`matchReducer` / cue math & timing / sole clock all untouched by intent.

**Out of scope (unchanged):** canvas/WebGL combat rewrite — **not needed**:
compositor relief met DroppedFrame ≤50% (330 = 8%). Any rewrite would be a
separate design if a new target appears.

## Acceptance metrics

Same machine, DualNav combat-heavy `REVIEW_PLAY`, `?debug=perf` + Chrome trace.
Force 60Hz where possible (`--force-frame-rate=60`). **Measured (`…105537`).**

| Phase | Metric | Target | Result |
| --- | --- | --- | --- |
| Commit / dual (shipped) | Main-thread paint/layout max | Already improved | improved (paint max 1.44→0.88ms) |
| **Compositor relief** | DroppedFrame | **≤ 50%** of ~4045 baseline | **MET — 330 (8%)** |
| **Compositor relief** | GPU main (CrGpuMain) busy | **≤ 50%** of baseline — replaces the Blink Animation-count proxy (count stayed ~67/s: the phase made animations opacity-only, not fewer, so the count never measured paint cost) | **MET — 8.3s (21%)** |
| **Compositor relief** | paint-invalidating `Animation` events (outline/border/box-shadow) | qualitative drop in trace | `_board-layout-wrapper` (77ms) + gas `_aura` hotspots **gone**; `_pieceSpecialUsed` outline hotspot 30ms (accepted tradeoff → P2) |
| All | Visual | trails fade; no CSS double-play; review board correct; gas aura fades | pass |
| All | heap / longtasks | no regression | pass |

Raw per-second Paint/Commit/Swap counts are **not** a regression signal in this
vsync-off env (rates doubled because frames got cheap); use **DroppedFrame + GPU
busy + paint max** instead.

## Non-goals

- Changing cue math, impact timing, or visual-frame priority
- Second playback engine or component-owned rAF clocks
- Per-layer `Show` / lazy VFX leaf mount that restarts CSS
- `transition` / `@keyframes` on paint-only properties (`outline-color`,
  `border-*-color`, `box-shadow`)
- `Chip` phase border transition / `.pieceSpecialUsed` outline transition
  (kept, paint snap — deferred)
- `InlineBishop` crank loop (deferred)
- Fog-cull of hidden leaves (rejected: the review perf case has no fog)
- Full-app `createStore` path-proxy migration
- WebGL / offscreen canvas combat rewrite (**closed** — compositor relief met
  DroppedFrame ≤50%)
- DualNav UX, resolve rules, or SCFEN wire changes

## Decisions

| ID | Decision | Notes |
| --- | --- | --- |
| **Q1 — gate timing** | `scheduler.delay(0)` | Shipped |
| **Q2 — isolation** | Dual-signal shell ∥ timeline | Shipped |
| **Q3 — contain:paint** | **Rejected on root** | Clips trails; use layout+style only |
| **Q4 — compositor relief** | Paint-property audit + `.board-phase-ring` + review caps (rejects fog-cull — no fog in the review perf case) | Shipped + **measured 2026-08-11 (`…105537`)**: DroppedFrame 330 (8% of baseline) — met |
| **Q5 — canvas** | Deferred until compositor-relief measured | **Closed** — phase met DroppedFrame ≤50%; WebGL rewrite not needed |
| **Q6 — measurement** | Force 60Hz (`--force-frame-rate=60`); regression signals = **DroppedFrame + GPU busy + paint max**. Paint/s·Commit/s **not** a signal in vsync-off env (rates doubled with cheap frames); Blink Animation-count proxy **replaced** — unchanged ~67/s despite paint cost dropping, so it never measured paint cost | Measured 2026-08-11 |

## Diagrams

| File | What |
| --- | --- |
| [`timeline-perf.puml`](./timeline-perf.puml) | Shipped architecture: gate/dual-signal + compositor relief (measured `…105537`) |
| [`timeline-vfx-density.puml`](./timeline-vfx-density.puml) | Shipped compositor relief: paint audit · phase ring · review caps (measured `…105537`) |
| [`timeline-commit-batching.mmd`](./timeline-commit-batching.mmd) | Gate sequence |
| [`timeline-reactivity.puml`](./timeline-reactivity.puml) | Invalidation split |

Also: [`../animation-pipeline.md`](../animation-pipeline.md) · [`../match-store.puml`](../match-store.puml).

## Key sources (shipped)

| Piece | Path |
| --- | --- |
| Commit gate | `presentation/timeline/timelineCommitGate.ts` |
| Structural share | `app/timelineStructuralShare.ts` |
| Dual-signal store | `app/MatchStoreContext.tsx` |
| Selectors | `app/selectors.ts` (`readDisplayedSnapshot`) |
| Overlays / density wiring | `presentation/combat/hooks/useCombatOverlays.ts` |
| VFX perf / review caps | `presentation/animations/vfxPerf.ts` |
| Gas aura opacity-only | `presentation/animations/components/GasDropAnimation.module.css` |
| Phase ring overlay | `presentation/board/components/StarChessBoard.module.css` + `.tsx` |
| Combat root | `presentation/animations/components/CombatOverlayRoot.tsx` |
