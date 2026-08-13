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
| Board size (mobile) | Coach: `min(100vw - 2rem, 320px)` · StarChess: `min(100vw - 4rem, 480px)` | Coach dynamic board cap 320px; StarChess keeps **2rem gutters each side** |
| App max (StarChess desktop) | `board + 4rem`; top/footer `max-width: board` | No classical sideboard; chrome ≤ mid-pane board |
| Body min (board screens) | Coach: `board` / `board + sidebar + 1.5rem` · StarChess: `board` / `board + 4rem` | Via `body:has([data-testid=screen-root])` |

**Contract:** the root gameplay shell must not layout below the width required for
`board + sideboard` (desktop) or `board` (mobile). Below that floor the page may
scroll horizontally — it must **not** squash board squares.

### 1b. Forbid vertical scroll

Board-centric `Screen` shells own the viewport (`height: 100dvh; overflow: hidden`
on `.app-container`). Vertical page scroll to reveal the board or chrome is
forbidden. `html` / `body:has([data-testid=screen-root])` also use
`overflow: hidden` (no ≤1px PTR overflow).

Allowed exceptions (local scroll only):

- `GameHistoryList` overflow inside Review's list pane
- Modal / drawer bodies
- LAN lobby checklist regions that are themselves scroll containers
- In-panel overflow (e.g. floating CoachPanel body, TurnBarSidebar chips)
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
/* desktop board screens (≥720, has [data-board-column]):
   +1rem for opponent CapturedPieces under the title stack */
grid-template-rows: calc(var(--avatar-height) + 1rem) auto minmax(0, auto);
/* when data-footer-float="true": */
grid-template-rows: minmax(0, auto) auto 0fr;
/* desktop board + footer-float (CoachPanel): */
grid-template-rows: calc(var(--avatar-height) + 1rem) auto 0fr;
/* mobile board screens — board-only middle; leftover hugs via top/bottom: */
grid-template-rows: minmax(min-content, 1fr) auto minmax(min-content, 1fr);
/* mobile board + float: */
grid-template-rows: minmax(min-content, 1fr) auto 0fr;
/* mobile list / no board column — middle claims leftover for scroll: */
grid-template-rows: minmax(0, auto) 1fr minmax(0, auto);
```

1. **Middle first** — **ChessBoard (+ sideboard) only**; never stolen from for chrome. Captures, tool bars, FEN, banners, and panels live in top / bottom. On mobile board screens leftover height splits into **top** (`flex-end`) and **bottom** (`flex-start`) so chrome hugs the board; `min-content` minima keep chrome from crushing. List screens without `[data-board-column]` keep middle as `1fr` for scroll. Regions pin to tracks via `grid-row` (`top`→1, `middle`→2, `bottom`→3) so a `display:none` top inset (Review mobile) does not auto-place the board into row 1.
2. **Top second** — Back / avatar / MobileBanner / tool bars / opponent captures; on mobile packs to the **end** (near the board). Captures are a board-width strip (`max-width: var(--board-size)`), **top-left** aligned (`OpponentCaptures`).
3. **Bottom last** — player captures / CoachPanel / EngineDepth `BoardControls` bar; collapses on §4 float **only when the float source is in the footer** (CoachPanel). Review MoveList floats from the top without collapsing the footer. When docked on mobile packs to the **start** (near the board). Player captures share the same board-width strip, **bottom-right** aligned (`PlayerCaptures`) — desktop footer `align-items: center` must not shrink-wrap the strip or `flex-end` is a no-op.

---

## 3. Coach Avatar ↔ Chessboard overlap ≤ 50%

At most **50% of the live CoachAvatar height** may sit below the Chessboard top
edge (Coach mobile). Tall mobile keeps `MobileBanner` flush top and floats
the hero avatar **over** the banner (`z-index`, negative margin) with the tool
bar still below. **Dynamic** (`--dynamic-mobile`: mobile · `min-width: 480px` ·
`max-height: 639px`, e.g. Storybook Dynamic 560×420) **fuses** `MobileBanner` +
`MobileSidebar` into one top strip via `[data-testid=mobile-fuse]`:
`‹ Back` · action items · compact `CoachAvatar` at **0.75** · history nav ·
hamburger. Captured-piece strips also scale to **0.75** and hug the board
(no gap). Narrow short (`width < 480`) keeps the stacked banner + bar. E2E
asserts the overlap cap on Coach across viewports.

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
short dynamic (e.g. 480×480) still floats.

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
| Placement | **Top** Screen region (under MobileBanner / desktop titles), same chrome stack as Analysis FEN. Footer holds player captures + `BoardControls` (EngineDepth bar). Desktop board screens fix the top **grid track** to `calc(var(--avatar-height) + 1rem)` (parent `grid-template-rows`, not child max-height; +1rem for opponent CapturedPieces) so board Y stays aligned with Coach / Analysis; MoveList floats when it would exceed that track. |
| Form | Same `MoveList`, `.wrapper.floating` — horizontal strip of up to **3 turns** (`1. e4 e5` = one turn). Each player ply shows **SAN + cp Δ + coach emotion tags inline** (same annotations as the docked list). `data-testid=floating-move-list`. **Mobile / dynamic:** just below MobileBanner. **Desktop:** just below the title stack (ScreenBackNav), hanging slightly under the fixed top track (`overflow: visible` while floating). `left: calc(50% - var(--sidebar-width) / 2)` when Sidebar is shown. |
| When | Float when (a) `top (excluding MoveList) + board + MoveList budget + footer + shell padding` exceeds the viewport, **or** (b) on desktop, `top + MoveList budget` exceeds the fixed top track (`--avatar-height + 1rem`). Portrait phone **rowsPerPage = 6** (desktop ≥720 **3**). |
| Scroll | Window follows the active ply as the player navigates history (centered when possible) |
| Dismiss | × **or** playing a move (enters analysis / MatrixOverlay — `fenHistory` changes while `reviewAnalysisMode`) |
| Reappear | After dismiss, **every history-nav** action (`currentIndex` change with unchanged `fenHistory`) shows the float again |
| Shell flag | Same `data-footer-float` / `footerFloat` store (Review owns measurement when CoachPanel is absent). **Do not collapse** the bottom grid row when the float source is a top-region MoveList — BoardControls must stay visible. |

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

## 5. Menu splash columns — by aspect, not width

`MenuScreen` is the one screen that splits into columns, and the split is keyed
on **aspect**, not width alone. Width alone (`--sm-up`) put tall 480–719px
phones into two columns, which is wrong: they have height to spare and no
horizontal room.

| Band | Columns | Why |
|---|---|---|
| `--desktop` (≥720) | **2** — form left, destinations right | Room for both |
| `--dynamic-mobile` (480–719 × ≤639) | **2** | Landscape: one column would not fit the height |
| everything else below 720 | **1** | Portrait: height to stack, no width to split |

Implementation: `SplashScreen.module.css` gates the grid on
`@media (--desktop), (--dynamic-mobile)` scoped by `:has(.menu-options)`;
`MenuScreen.module.css` places the items in it under the same query. Narrow
**and** short (`< 480 × ≤ 639`) stays single column and compacts instead — cat
scaled to 0.75, tighter row/gap rhythm. In the dynamic band the splash title is
clipped to a11y-only and Selena speaks it from a `ChatBubble` at her right.

**StarChess parity.** `apps/starchess` `ChessMenuMockup` is a facsimile of this
screen and must match it at all three profiles (Storybook `Screens/Menu` ·
Coach `--default` vs StarChess `--star-chess`, viewports Desktop 1280×900 ·
Mobile 390×844 · Dynamic 560×420). Two Coach details the mock has to reproduce
by hand, since it doesn't share the stylesheets:

- Below 480px Coach shrinks its **root font** to `0.85rem` / `line-height: 1.2`
  (`apps/ui/src/index.css`). StarChess keeps a 16px root, so the mock re-applies
  the 0.85 factor to its own rem values (px and em values scale in neither).
- The bubble's position comes from `ChatBubble`'s pop-in animation: it fills
  forwards on `transform: scale(1)`, overriding `.coach-line`'s
  `translateY(-50%)`, so the bubble hangs from Selena's midline. The mock copies
  the animation to land in the same place.

---

## Breakpoint cheat-sheet

| Token | CSS / JS | Role |
|---|---|---|
| `--desktop` / `DESKTOP_MQ` | `min-width: 720px` | Sidebar visible; fixed 480px board (prefer this token) |
| `--mobile` / `MOBILE_MQ` | `max-width: 719px` | Exclusive complement of `--desktop` |
| `--sm-up` | `min-width: 480px` | Slightly larger type / spacing. **Not** a layout switch — see §5 |
| `--tall-mobile` / `TALL_MOBILE_MQ` | mobile + `min-height: 640px` | Hero `CoachAvatar`; Analysis `MobileBanner` at top; drawer floats top-right on non-toolbar bars |
| `--short-mobile` / `SHORT_MOBILE_MQ` | mobile + `max-height: 639px` | Clumped gaps; Coach compact avatar; Analysis `MobileBanner` stays at top; shared `--board-chrome-inline` L/R gutter |
| `--dynamic-mobile` / `DYNAMIC_MOBILE_MQ` | mobile + `min-width: 480px` + `max-height: 639px` | Fused `MobileBanner`+`MobileSidebar` row (`[data-testid=mobile-fuse]`); Coach avatar + captures at 0.75; board cap 320px |

---

## Implementation checklist

1. Keep this file + [`layout.puml`](./layout.puml) in sync with behaviour.
2. Refresh screenshots: `apps/e2e` → `npm run capture:responsiveness`.
3. Keep `CLAUDE.md` spec index in sync.
