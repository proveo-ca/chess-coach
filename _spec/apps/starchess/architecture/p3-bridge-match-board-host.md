# P3 — Bridge / Template Method: unify live vs review hosts

**Patterns:** Bridge (GoF) — or Template Method + Composition if Bridge feels heavy  
**Status:** ACCEPTED  
**Depends on:** P1+P2 preferred (stable `LiveStarChessBoard` → Stage contract)  
**Unblocks:** single mount point for Live board; less Screen grid duplication

## Goal

Collapse duplicated `Screen` board-column wiring so **one** component mounts
`LiveStarChessBoard` + `MatchStore` binding, while **chrome mode** (live
BaseScreen HUD vs review DualNav vs tutorial typewriter) varies independently.
No HUD content redesign — same regions, same controls, same routes.

## Problem (current)

Two host paths (from `architecture/screen-entities.puml`):

| Path | Chrome | Board mount |
| ---- | ------ | ----------- |
| `BaseScreen` | live ResourceBar / GasDeploy / TurnBar / spawn overlays | `LiveStarChessBoard` `visionMode='player'` |
| `ReviewDemoScreen` | DualNav + BoardSideRail + caption | `LiveStarChessBoard` direct (skips BaseScreen) |
| `TutorialReviewHost` | typewriter footer + coach header | `LiveStarChessBoard` direct (skips BaseScreen) |

Shared shape already exists via `Screen` / `Screen.BoardArea` / `BoardSideRail`,
but each host re-implements the board column host div + Live props + store
provider patterns. Risk of drift (variant defaults, fog passthrough, rail props).

## Design

### Bridge via composition

- **Abstraction** = chrome / shell mode (what surrounds the board).
- **Implementor** = board binding (always `LiveStarChessBoard` + match vision props).

```
MatchBoardHost (Abstraction)
  ├── chrome: LiveChrome | DualNavChrome | TypewriterChrome
  └── board:  LiveBoardBinding  → LiveStarChessBoard
```

Prefer **Composition over inheritance** — no `BaseScreen extends MatchBoardHost`.
`BaseScreen`, `ReviewDemoScreen`, `TutorialReviewHost` become thin chrome
assemblers that slot into `MatchBoardHost`.

### What moves where

| Responsibility | Owner after P3 |
| -------------- | -------------- |
| `Screen` + `BoardArea` + `BoardColumn` + board host wrapper | `MatchBoardHost` |
| Mount `LiveStarChessBoard` with fog/vision/variant/pieceSet/hints | `LiveBoardBinding` (single place) |
| MatchStoreProvider + createMatchStore(review history) | keep on review hosts (or small `ReviewStoreShell`) |
| Live HUD: ResourceBar, GasRack (`presentation/hud`), DeployModal, spawn hit overlays | stay in `BaseScreen` / live chrome slots |
| DualNav / ReviewTurnNav (`components/primitives` shell) / match title | stay in `ReviewDemoScreen` chrome slots |
| Typewriter nav / beats | stay in `TutorialReviewHost` chrome slots |
| `BoardSideRail` + optional `TurnBarSidebar` | slot via rail prop (shared defaults OK) |

### Explicitly not a god component

`MatchBoardHost` does **not** own adjutant, arm timer, review seek logic, or
typewriter beats — only the structural grid that every path already copies.

## Contracts (target)

```ts
export type LiveBoardBindingProps = {
  fog?: boolean;
  visionMode?: VisionMode;
  variant?: BoardSkin;
  pieceSet?: PieceSet;
  hintSquares?: readonly Square[];
};

/** Single mount point for LiveStarChessBoard. */
export const LiveBoardBinding: Component<LiveBoardBindingProps>;

export type MatchBoardHostProps = {
  board?: JSX.Element;
  boardOverlay?: JSX.Element;
  header?: JSX.Element;
  rail?: JSX.Element;
  railVisible?: boolean;
  onHome?: () => void;
  footer?: JSX.Element;
  boardColumnStart?: JSX.Element;
  class?: string;
};

export const MatchBoardHost: Component<MatchBoardHostProps>;
```

## Migration steps

1. Extract `LiveBoardBinding` (literal current Live mount JSX + props).
2. Extract `MatchBoardHost` from the common `Screen`→`BoardArea`→host div skeleton
   (start from `ReviewDemoScreen` — smallest chrome — then fold others).
3. Switch `ReviewDemoScreen` → host; visual/QA review DualNav demos.
4. Switch `TutorialReviewHost` → host.
5. Switch `BaseScreen` → host **last** (most overlays / live-only chrome).
6. Grep: only `LiveBoardBinding` (or Host default) references `LiveStarChessBoard`.

## Non-goals

- Merging live and review **HUD content** into one config mega-prop
- Changing vision defaults (`BaseScreen` stays player; review stays prop-driven)
- Introducing multiplayer host
- Replacing `LiveMatchShell` (sky chrome stays outside)
- CSS layout contract violations (`data-testid` styling, etc.)

## Risks & open questions

- **Q1:** Bridge vs plain composition — recommend composition in code; “Bridge”
  in docs only if chrome/board stay explicit dual hierarchies.
- **Q2:** Keep `MatchStoreProvider` parent-side (live session already higher up).
- **Q3:** BaseScreen boardOverlay measure stays in live chrome, not Host generic measure.
- **Q4:** Host accepts minimal `class` on host div — no style piercing.
