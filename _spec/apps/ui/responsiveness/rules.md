# UI Responsiveness Contract

Living contract for how `apps/ui` fits the Chessboard + sideboard into constrained
viewports. Implementation lives primarily in:

- `apps/ui/src/components/primitives/Screen.module.css` (root `display: grid`)
- `apps/ui/src/components/primitives/Screen.tsx` (`data-region`, `data-footer-float`)
- `apps/ui/src/components/features/CoachPanel.tsx` (§4 floating advice)
- `apps/ui/src/components/features/MoveList.tsx` (§4 floating move strip on Review /:id)
- `apps/ui/src/store/viewportLayoutStore.ts`
- `apps/ui/src/theme.css` (`--board-size`, `--sidebar-width`, `--avatar-height`, breakpoints)
- `apps/ui/src/components/features/MobileSidebar.module.css` (mobile avatar overflow)

Visual evidence: [`screenshots.md`](./screenshots.md).  
Grid priority diagram: [`layout.puml`](./layout.puml).  
E2E: `apps/e2e/tests/responsiveness.spec.ts`.

---

## 1. Base rule — Chessboard + sideboard are the essentials

The playable surface is **non-negotiable**. Everything else (header avatar strip,
footer advice / move list, chrome) yields before the board stack or the sideboard.

### 1a. Enforce a minimum width

| Constraint | Value | Rationale |
|---|---|---|
| Desktop breakpoint | `min-width: 720px` (`--desktop`) | Board `480px` + sidebar `6rem` + gaps fit (Coach) |
| Board size (desktop) | `--board-size: 480px` | Fixed square; never shrinks with chrome |
| Board size (mobile) | Coach: `min(100vw - 2rem, 480px)` · StarChess: `min(100vw - 4rem, 480px)` | StarChess keeps **2rem gutters each side** |
| App max (StarChess desktop) | `board + 4rem`; top/footer `max-width: board` | No classical sideboard; chrome ≤ mid-pane board |
| Body min (board screens) | Coach: `board` / `board + sidebar + 1.5rem` · StarChess: `board` / `board + 4rem` | Via `body:has([data-testid=screen-root])` |

**Contract:** the root gameplay shell must not layout below the width required for
`board + sideboard` (desktop) or `board` (mobile). Below that floor the page may
scroll horizontally — it must **not** squash board squares.

### 1b. Forbid vertical scroll

Board-centric `Screen` shells own the viewport (`height: 100dvh; overflow: hidden`
on `.app-container`). Vertical page scroll to reveal the board or chrome is
forbidden.

**PTR affordance:** `html` / `body:has([data-testid=screen-root])` may retain
**≤1px** vertical overflow (`min-height: calc(100dvh + 1px)`, `overflow-y: auto`)
solely so Android Chrome / installed PWA pull-to-refresh still works. That 1px
must not expose chrome; the shell remains visually locked.

Allowed exceptions (local scroll only):

- `GameHistoryList` overflow inside Review's list pane
- Modal / drawer bodies
- LAN lobby checklist regions that are themselves scroll containers

---

## 2. Root `display: grid` priority

`.app-container` is a 3-row grid:

| Row | Region | Contents (typical) | Priority |
|---|---|---|---|
| 1 | Top `data-region=top` | Header / SidebarInset | **2nd** |
| 2 | Middle `data-region=middle` | BoardArea (board + sideboard) | **1st** |
| 3 | Bottom `data-region=bottom` | Footer (`CoachPanel`, move list) | **3rd** |

```css
grid-template-rows: minmax(0, auto) auto minmax(0, auto);
/* when data-footer-float="true": */
grid-template-rows: minmax(0, auto) auto 0fr;
/* mobile (max-width: 719px) — middle claims leftover height: */
grid-template-rows: minmax(0, auto) 1fr minmax(0, auto);
/* mobile + float: */
grid-template-rows: minmax(0, auto) 1fr 0fr;
```

1. **Middle first** — board/sideboard stay content-sized (`--board-size`); never stolen from for chrome. On mobile the **middle row** may be `1fr` so leftover viewport height centers the board stack (bar + board as one unit) instead of packing under the top — not a priority demotion. Regions pin to tracks via `grid-row` (`top`→1, `middle`→2, `bottom`→3) so a `display:none` top inset (Review mobile) does not auto-place the board into row 1.
2. **Top second** — `minmax(0, auto)` may shrink/clip; stays flush to the top of the viewport.
3. **Bottom last** — collapses when CoachPanel / MoveList activate §4 float; when docked on mobile it sits under the stretched middle (footer near the bottom of the viewport).

---

## 3. Coach Avatar ↔ Chessboard overlap ≤ 50%

At most **50% of the live CoachAvatar height** may sit below the Chessboard top
edge (Coach mobile). Tall mobile stacks the avatar **above** the tool bar (no
overlap). Short / §4 float keeps the compact avatar in the bar with
`centerOverflow`. E2E asserts the overlap cap on Coach across viewports.

| Screen | Assert overlap |
|---|---|
| `CoachScreen` | Yes |
| Menu / Analysis / Review / Lan | N/A (no avatar+board pair) |

---

## 4. Dismissible floating bottom (short viewports)

When `top + board-column content + in-flow footer budget > viewport`, the bottom
row collapses (`data-footer-float="true"`) and content floats over the board
instead. **Measure `data-board-column` content height**, not the stretched middle
`1fr` grid track — otherwise tall mobile always floats. Helper:
`apps/ui/src/utils/footerFloatMeasure.ts`.

Tall mobile (e.g. 390×844) docks CoachPanel / MoveList when the budget fits;
short dynamic (e.g. 390×560) still floats.

### 4a. Coach advice (`CoachPanel`)

| Property | Rule |
|---|---|
| Form | The **same** `CoachPanel` (`.coach-panel.floating`), fixed over lower board — not a separate chip. `data-testid=floating-advice` on that panel |
| Max height | ≤ **50% of `--avatar-height`** (in-flow panel budget; `overflow-y: auto` so Why-hint / blunder text stay reachable). Do not use the compact bar avatar height — it crushes the float. |
| Appear delay | **None** — float appears instantly when advice/emotion/blunder content is available. |
| Dismiss | × suppresses the **current** content until it changes (or a new blunder hover episode starts). Human move hides the float but does **not** suppress the next advice line. |
| Shell flag | `data-footer-float="true"` on `[data-testid=screen-root]` |

```
emotion/advice/blunder updates
        │
        ▼
 float CoachPanel instantly (≤ ½ --avatar-height)
        │
   ┌────┴────┐
dismiss    human move
   │           │
   └─────┬─────┘
         ▼
   remove float
```

### 4b. Review move list (`MoveList` on `/review/:id`)

| Property | Rule |
|---|---|
| Form | Same `MoveList`, `.wrapper.floating` — horizontal strip of up to **3 turns** (`1. e4 e5` = one turn). Each player ply shows **SAN + cp Δ + coach emotion tags inline** (same annotations as the docked list). `data-testid=floating-move-list`. **Desktop only** (`min-width: 720px`, when `Sidebar` is shown): `left: calc(50% - var(--sidebar-width) / 2)` so the strip centers on the ChessBoard (same inset as Header/Footer / floating CoachPanel). Mobile stays viewport-centred (`left: 50%`). |
| When | Float when `top + board-column content + MoveList budget` exceeds the viewport (≈ 1.5rem wrapper + optional ≈ 2.8rem page-nav when `turnCount > rowsPerPage` + `min(rowsPerPage, turnCount)` × ≈ 2.1rem, plus slack). Portrait phone **rowsPerPage = 6** (desktop ≥720 **3**). Desktop uses the same fit check — if a docked page would clip, float the 3-turn strip. |
| Scroll | Window follows the active ply as the player navigates history (centered when possible) |
| Dismiss | × **or** playing a move (enters analysis / MatrixOverlay — `fenHistory` changes while `reviewAnalysisMode`) |
| Reappear | After dismiss, **every history-nav** action (`currentIndex` change with unchanged `fenHistory`) shows the float again |
| Shell flag | Same `data-footer-float` / `footerFloat` store (Review owns measurement when CoachPanel is absent) |

```
top + board content + MoveList page budget > viewport
        │
        ▼
 float MoveList (3 turns)
        │
   ┌────┴──────────┐
  × dismiss    play move
   │                 │
   └───────┬─────────┘
           ▼
     hide float
           │
    history nav
           │
           ▼
     show float again
```

---

## Breakpoint cheat-sheet

| Token | CSS / JS | Role |
|---|---|---|
| `--desktop` / `DESKTOP_MQ` | `min-width: 720px` | Sidebar visible; fixed 480px board (prefer this token) |
| `--mobile` / `MOBILE_MQ` | `max-width: 719px` | Exclusive complement of `--desktop` |
| `--sm-up` | `min-width: 480px` | Slightly larger type / spacing |
| `--tall-mobile` / `TALL_MOBILE_MQ` | mobile + `min-height: 640px` | Hero `CoachAvatar`; Analysis title toolbar; drawer floats top-left on non-toolbar bars |
| `--short-mobile` / `SHORT_MOBILE_MQ` | mobile + `max-height: 639px` | Clumped gaps; Coach compact avatar; Analysis title toolbar hidden — menu in FenLoader leading (left of FEN); shared `--board-chrome-inline` L/R gutter |

---

## Implementation checklist

1. Keep this file + [`layout.puml`](./layout.puml) in sync with behaviour.
2. Refresh screenshots: `apps/e2e` → `npm run capture:responsiveness`.
3. Keep `CLAUDE.md` spec index in sync.
