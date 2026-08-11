# Strategy + Rename: `StarChessBoard` + `VisionStrategy`

**Patterns:** Strategy (GoF), Extract Class  
**Status:** ACCEPTED (alias `ObserverStarChessBoard.tsx` removed)  
**Depends on:** none  
**Unblocks:** composite VFX stack (stable leaf name), honest type exports

## Goal

Replace the misnamed shared leaf `ObserverStarChessBoard` with a pure board
renderer `StarChessBoard` whose vision/fog presentation is selected by a
`VisionStrategy` (`PlayerFogStrategy` | `ObserverDualVisionStrategy`). Same
pixels and fog/vision math; clearer ownership of types and CSS.

## Problem (current)

1. There is **no** `StarChessBoard` component — only orphaned
   `StarChessBoard.module.css`.
2. `ObserverStarChessBoard` is the snapshot board for **both** live player fog
   and review observer dual-vision; the name implies review-only.
3. Types (`VisionMode`, `IntentGhost`, …) are re-exported from the Observer
   module even though canonical homes are `~/types/board`.
4. Callers (`AnimationStage`, `StaticScfenBoard`, demos) import the leaf by the
   wrong conceptual name.

## Design

### Extract Class

- Move square-grid rendering body into `StarChessBoard`
  (`presentation/board/StarChessBoard.tsx`).
- Adopt / merge styles into `StarChessBoard.module.css` (retire orphan; migrate
  rules from `ObserverStarChessBoard.module.css` without visual delta).
- `fogProjection` helpers stay pure; strategies call them.

### Strategy

| Strategy | When | Behavior (unchanged) |
| -------- | ---- | -------------------- |
| `PlayerFogStrategy` | `visionMode === 'player'` (default) | Single-viewer fog veil when `fog !== false`; `getVisionDisplayCells` / fog holes for viewer |
| `ObserverDualVisionStrategy` | `visionMode === 'observer'` | Full board, no player veil; dual `getSideVision` borders in team colors |

Selection is a pure function of existing props (`visionMode`, `fog`, `viewer`,
snapshot) — **not** a runtime plugin registry. Two concrete strategies today;
no factory/manager.

### Alias / delete path

1. Export `StarChessBoard` + strategies.
2. `export const ObserverStarChessBoard = StarChessBoard` (deprecated alias) **or**
   thin re-export file for one release.
3. Point `AnimationStage` / `StaticScfenBoard` at `StarChessBoard`.
4. Remove alias after import sweep; delete `ObserverStarChessBoard.tsx` name.

## Contracts (target)

```ts
// presentation/board/vision/VisionStrategy.ts
export type VisionStrategyInput = {
  snapshot: ScFenSnapshot;
  viewer: StarChessColor;
  fog: boolean;
  moveCues?: readonly MoveCue[];
  moveProgress?: Readonly<Record<string, 0 | 1>>;
};

export type VisionStrategyResult = {
  usePlayerFog: boolean;
  // existing fogProjection shapes Observer already feeds SVG
};

export type VisionStrategy = {
  readonly id: VisionMode;
  project(input: VisionStrategyInput): VisionStrategyResult;
};

export const PlayerFogStrategy: VisionStrategy;
export const ObserverDualVisionStrategy: VisionStrategy;
export function visionStrategyFor(mode: VisionMode | undefined): VisionStrategy;
```

```ts
// presentation/board/StarChessBoard.tsx
export const StarChessBoard: Component<{
  snapshot: ScFenSnapshot;
  viewer?: StarChessColor;
  fog?: boolean;
  visionMode?: VisionMode; // selects strategy — same public API as today
  variant?: BoardSkin;
  pieceSet?: PieceSet;
  phase?: ReviewTurnPhase;
  // … identical remaining props to current ObserverStarChessBoard
}>;
```

Types: import from `~/types/board` only — **stop** re-exporting from the board leaf
(callers that imported types from Observer switch to `~/types/board`).

## Migration steps

1. Add `VisionStrategy` + two objects; unit-test `project()` parity vs current
   `isObserver` / `usePlayerFog` branches (snapshot fixtures from existing demos).
2. Extract `StarChessBoard` body; wire `visionStrategyFor(props.visionMode)`.
3. Alias `ObserverStarChessBoard` → `StarChessBoard`.
4. Retarget imports; drop type re-exports from leaf.
5. CSS: move module to `StarChessBoard.module.css`; visual regression on
   FogVisionDemo / DualNav review / live single.
6. Delete alias + old filename.

## Non-goals

- Changing fog math in `fogProjection.ts`
- Splitting VFX / `AnimationStage` (composite VFX stack)
- Unifying `BaseScreen` / review hosts (MatchBoardHost bridge)
- New vision modes beyond `player` | `observer`

## Risks & open questions

- **Q1:** Keep deprecated export one release vs codemod all imports in one PR?
- **Q2:** Strategy as plain objects vs small functions — prefer objects only if
  we need `id` for tests/devtools; functions are enough for two cases.
- **Q3:** Does any external package import `ObserverStarChessBoard` by path?
  (grep workspace before delete.)
