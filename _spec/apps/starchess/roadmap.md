# StarChess spec remediation roadmap

Living plan after the Aug 2026 drift sweep. Spec-claim fixes and core relocation
are done; polish items remain. Timeline perf is a separate track under
`architecture/`.

## Fix wrong claims + thin live UI coverage (done)

| Item | Status |
|---|---|
| `deployment.puml` — Adjutant opposite of `team`; `/single` sidebar HUD | Done |
| `animation-pipeline.md` — `playTimeline` / `TIMELINE_*` / MatchStore | Done |
| `screens.puml` — Screen HUD (Resource / TurnBarSidebar / DualNav / Exit) | Done |
| `menu-flow.puml` — Menu → NewGame → `/single` | Done |
| `index.puml` — live spec map | Done |
| `demos.puml` / `starchess-mode.puml` — retire GameOverBanner / deleted paths as “pending shipped gaps” | Done |
| CLAUDE.md index + key `// SPEC:` on live screens | Done |
| ui/starchess `index.puml` points at live `_spec/apps/starchess/` | Done |

## Relocate / rewrite rules specs (done)

| Item | Status |
|---|---|
| `_spec/packages/starchess-core/` — scfen-wire, scfen-queue, resolve, turn-queue-sequence, sc-moves, index | Done |
| Retarget core + app `// SPEC:` off `_spec/apps/ui/starchess/*` | Done |
| `sc-moves.puml` — `useBoardInput` + MatchStore (no Coach `BoardMoveProvider`) | Done |
| `match-store.puml` under `_spec/apps/starchess/` | Done |
| Product demos/mode live under `_spec/apps/starchess/`; `_spec/apps/ui/starchess/` removed | Done |

## Remaining polish

1. ~~Optionally delete `_spec/apps/ui/starchess/` stubs~~ **Done** — directory removed (content lived in core + apps/starchess; stubs/PNGs had no unique value).
2. Align `starchess-mode` UX package with sidebar chrome as product default.
3. Extend demos inventory: `VermeerLiveTurnSidebar`, menu stories, review DualNav host.
4. Mention StarChess in `_spec/summary.md` / top-level architecture if still silent.

## Animation / timeline performance

Design: [`architecture/timeline-perf.puml`](./architecture/timeline-perf.puml).

| Phase | Work | Status |
| --- | --- | --- |
| Specs | timeline-perf + batching/reactivity diagrams | **Done** |
| Commit path | `TimelineCommitGate` (`delay(0)`) + reducer structural share | **Implemented** |
| Dual-signal | Shell ∥ timeline; selector split | **Implemented** |
| Light paint/GPU | DPR, contain layout style, will-change active, trail caps | **Implemented** (DroppedFrame target missed) |
| **Compositor relief** | Paint-property audit (outline/border/box-shadow → transform/opacity), `.board-phase-ring` opacity-only overlay, review caps (`capForDensity`) — [`timeline-vfx-density.puml`](./architecture/timeline-vfx-density.puml) | **Shipped + measured** (2026-08-11 · `…105537`: DroppedFrame 330 / 8% of baseline — met) |

## Verify

```bash
pnpm --filter @chess-coach/starchess-core test
pnpm --filter @chess-coach/starchess test
plantuml -checkonly _spec/packages/starchess-core/*.puml _spec/apps/starchess/*.puml \
  _spec/apps/starchess/architecture/*.puml _spec/apps/starchess/core/turn/*.puml
cd apps/ui && npm run lint && npm run test:int
```
