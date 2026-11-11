# StarChess architecture (board / screen class maps)

Canonical home for board presentation and screen-host class structure under
`apps/starchess`.

## Current-state maps

| Diagram | What |
| --- | --- |
| [`board-entities.puml`](./board-entities.puml) | Leaves → `StarChessBoard` → `AnimationStage` / VFX → `Live` \| `Static` |
| [`screen-entities.puml`](./screen-entities.puml) | SPA routes / demos → `MatchBoardHost` → `LiveBoardBinding` |
| [`base-screen.puml`](./base-screen.puml) | `BaseScreen` props + HUD composition |
| [`naming.puml`](./naming.puml) | Allowed `nerd` piece-set vs product naming |

## Accepted structure designs

Applied; no further behavioral change. Kept as design history + pattern notes.

| Name | Pattern(s) | Status |
| ---- | ---------- | ------ |
| [`strategy-starchess-board.puml`](./strategy-starchess-board.puml) | Strategy, Extract Class | **ACCEPTED** |
| [`composite-vfx-stack.puml`](./composite-vfx-stack.puml) | Composite, Facade, Parameter Object | **ACCEPTED** |
| [`bridge-match-board-host.puml`](./bridge-match-board-host.puml) | Bridge via Composition | **ACCEPTED** |
| [`storybook-projection.puml`](./storybook-projection.puml) | Catalog + Projection, Extract Class | **ACCEPTED** — all phases applied |

## Performance designs

| Name | Pattern(s) | Status |
| ---- | ---------- | ------ |
| [`timeline-perf.puml`](./timeline-perf.puml) · [batching](./timeline-commit-batching.mmd) · [reactivity](./timeline-reactivity.puml) | Commit gate, structural share, dual-signal, light paint/GPU | **DONE (main phase)** — measured 2026-08-11 (DroppedFrame 330 / 8% of baseline); P2 remains |
| [`timeline-vfx-density`](./timeline-vfx-density.puml) | Paint-property audit, phase ring, review caps | **SHIPPED + MEASURED** (2026-08-11: DroppedFrame 330 / 8% of baseline — met; GPU busy 8.3s) |

## Validation

```bash
plantuml -checkonly _spec/apps/starchess/architecture/*.puml
```

## Note

Root-level `board-entities.puml` / `screen-entities.puml` and `proposals/` were
moved here. Prefer `architecture/` paths in `// SPEC:` anchors.
