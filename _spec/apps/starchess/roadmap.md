# StarChess spec remediation roadmap

Living plan after the Aug 2026 drift sweep. **P0–P1 done**; P2 remains.

## P0 — Fix wrong claims + thin live UI coverage (done)

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

## P1 — Relocate / rewrite rules specs (done)

| Item | Status |
|---|---|
| `_spec/packages/starchess-core/` — scfen-wire, scfen-queue, resolve, turn-queue-sequence, sc-moves, index | Done |
| Retarget core + app `// SPEC:` off `_spec/apps/ui/starchess/*` | Done |
| `sc-moves.puml` — `useBoardInput` + MatchStore (no Coach `BoardMoveProvider`) | Done |
| `match-store.puml` under `_spec/apps/starchess/` | Done |
| Product demos/mode live under `_spec/apps/starchess/`; `_spec/apps/ui/starchess/` removed | Done |

## P2 — Remaining polish

1. ~~Optionally delete `_spec/apps/ui/starchess/` stubs~~ **Done** — directory removed (content lived in core + apps/starchess; stubs/PNGs had no unique value).
2. Align `starchess-mode` UX package with sidebar chrome as product default.
3. Extend demos inventory: `VermeerLiveTurnSidebar`, menu stories, review DualNav host.
4. Mention StarChess in `_spec/summary.md` / top-level architecture if still silent.

## Verify

```bash
pnpm --filter @chess-coach/starchess-core test
pnpm --filter @chess-coach/starchess test
plantuml -checkmetadata _spec/packages/starchess-core/*.puml _spec/apps/starchess/*.puml
cd apps/ui && npm run lint && npm run test:int
```
