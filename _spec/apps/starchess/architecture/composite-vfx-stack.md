# Composite + Facade: VFX layer stack

**Patterns:** Composite, Facade, Parameter Object  
**Status:** ACCEPTED  
**Depends on:** `StarChessBoard` leaf name preferred; can alias through Observer  
**Unblocks:** cheaper cue updates; cleaner Live surface for MatchBoardHost

## Goal

Keep `AnimationStage` as the store-free **Facade** over board + combat VFX, but
extract a stable **Composite** overlay root (`CombatOverlayRoot`) and pass cue
traffic as one **Parameter Object** (`CombatCueFrame`) so Live does not recompose
a 20-prop surface into the board on every cue tick.

## Problem (current)

1. `AnimationStage` always mounts the full VFX stack under
   `data-starchess-combat-root` (correct: do **not** wrap each layer in `Show` —
   remounts restart CSS). Structure is right; ownership is flat inside the Facade.
2. `LiveStarChessBoard` spreads many memos into individual `AnimationStage` props
   → large reactive surface / prop churn.
3. `ResizeObserver` + measure live on the stage host that also owns the board grid
   query — overlay geometry coupled to stage root.
4. `deriveVisualFrame` already exists for hide/ownership but is not the transport
   object Live→Stage uses for cues.

## Design

### Facade (keep)

`AnimationStage` remains the public store-free entry for Storybook demos and Live:

- Resolves `fen` | `snapshot`
- Renders board leaf (`StarChessBoard`)
- Hosts overlay measure + `CombatOverlayRoot`

### Composite

```
CombatOverlayRoot          «Composite»
  ├── KingDamageOverlay    «Leaf»
  ├── GasDropAnimation
  ├── AttackAnimation
  ├── DeathAnimation
  ├── MoveAnimation
  ├── QueenJumpAnimation
  ├── MineMissileAnimation
  └── DeployAnimation
```

- Stable child order (same as today) — **never** conditional mount per layer.
- Empty cues → existing `NO_*` stable empties.
- Composite owns `boardWidth` / `boardHeight` fan-out so leaves stay dumb.

### Parameter Object

| Bag | Contents | Invalidates |
| --- | -------- | ----------- |
| `BoardViewProps` | snapshot, viewer, fog, visionMode, variant, pieceSet, phase, intents, selection, hideSquares, mines, armed… | board leaf |
| `CombatCueFrame` | attack/death/move/jump/mine/deploy/gas/kingDamage cues + progress/leg/trails/dying | overlay composite only |

Live builds `CombatCueFrame` once and passes **one** object into the Facade.

### Perf isolation

1. **Overlay host only measures** — cue-only updates do not invalidate board squares.
2. **Solid:** pass `CombatCueFrame` into `CombatOverlayRoot` as a single prop so
   board memo deps omit cue arrays.
3. Keep `contain: layout` on combat root (already present).
4. Do **not** gate individual layers with `Show`.

## Contracts (target)

```ts
export type CombatCueFrame = {
  attackCues: readonly AttackCue[];
  attackDying?: Record<string, boolean>;
  deathCues: readonly DeathCue[];
  moveCues: readonly MoveCue[];
  moveProgress: Readonly<Record<string, 0 | 1>>;
  moveLeg?: Record<string, 0 | 1>;
  jumpCues: readonly MoveCue[];
  jumpTrails: readonly QueenJumpTrail[];
  mineMissiles: readonly MineMissileCue[];
  mineMissileTrails: readonly QueenJumpTrail[];
  deployCues: readonly DeployCue[];
  gasDropCues: readonly GasDropCue[];
  kingDamage: readonly KingDamageCue[];
};

export type CombatOverlayRootProps = {
  box: { top: number; left: number; w: number; h: number };
  cues: CombatCueFrame;
  specialUsedSquares: ReadonlySet<Square>;
  pieceSet?: PieceSet;
};

export const CombatOverlayRoot: Component<CombatOverlayRootProps>;

export type AnimationStageProps = BoardViewProps & {
  combat?: CombatCueFrame;
  // legacy flat cue props optional during migration (Facade adapts → frame)
};
```

## Migration steps

1. Extract `CombatOverlayRoot` with identical layer order + `NO_*` defaults.
2. Introduce `CombatCueFrame`; Facade accepts `combat?` **or** flat props.
3. Switch `LiveStarChessBoard` to build/pass `combat` bag; drop flat spread.
4. Move measure/RO to overlay host wrapper; confirm Storybook demos + timeline.
5. Remove flat cue props from public Facade type after call-site sweep (or keep
   as thin deprecated sugar for demos).

## Depends-up

[`timeline-perf.md`](./timeline-perf.md) tightened cue invalidation (commit
coalesce + shell ∥ timeline). Shipped compositor relief
([`timeline-vfx-density.puml`](./timeline-vfx-density.puml)) adds review caps
(`capForDensity`, 2026-08-11) upstream of this Composite plus the board
phase-ring overlay — it must **not** introduce per-layer `Show` or change this
Composite layer order.

## Non-goals

- Changing cue math, timeline player, or `deriveVisualFrame` priority rules
- Lazy-loading individual VFX modules
- Vision Strategy work (board strategy design)
- Screen chrome unify (MatchBoardHost)
- Removing `Show when={overlayReady()}` around the whole composite

## Decisions

- **Q1 — one API:** Migrated. Flat cue props removed; callers use
  `combat={{ deathCues: … }}` only (Live + Storybook demos + debris playground).
- **Q2 — bag vs store:** Keep **Parameter Object** (`CombatCueFrame`) — plain
  object param, not a Solid store.
- **Q3 — measure ownership:** Keep **RO in Facade** (`AnimationStage`).
- **Q4:** Flat props deleted after call-site sweep; no separate profile gate.
  Also dropped unused Stage props (`mines`, `chasingMines`) and unused
  `useCombatOverlays().gasDropSquares` / `LiveStarChessBoard` `BoardVariant` re-export.
