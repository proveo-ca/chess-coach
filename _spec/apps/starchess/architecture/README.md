# StarChess architecture (board / screen class maps)

Canonical home for board presentation and screen-host class structure under
`apps/starchess`.

## Current-state maps

| Diagram | What |
| --- | --- |
| [`board-entities.puml`](./board-entities.puml) | Leaves → `StarChessBoard` → `AnimationStage` / VFX → `Live` \| `Static` |
| [`screen-entities.puml`](./screen-entities.puml) | SPA routes / demos → `MatchBoardHost` → `LiveBoardBinding` |

## Accepted structure designs (P1–P3)

Applied; no further behavioral change. Kept as design history + pattern notes.

| ID | Name | Pattern(s) | Status |
| -- | ---- | ---------- | ------ |
| **P1** | [`p1-strategy-starchess-board`](./p1-strategy-starchess-board.md) · [`.puml`](./p1-strategy-starchess-board.puml) | Strategy, Extract Class | **ACCEPTED** |
| **P2** | [`p2-composite-vfx-stack`](./p2-composite-vfx-stack.md) · [`.puml`](./p2-composite-vfx-stack.puml) | Composite, Facade, Parameter Object | **ACCEPTED** |
| **P3** | [`p3-bridge-match-board-host`](./p3-bridge-match-board-host.md) · [`.puml`](./p3-bridge-match-board-host.puml) | Bridge via Composition | **ACCEPTED** |

## Validation

```bash
plantuml -checkonly _spec/apps/starchess/architecture/*.puml
```

## Note

Root-level `board-entities.puml` / `screen-entities.puml` and `proposals/` were
moved here. Prefer `architecture/` paths in `// SPEC:` anchors.
