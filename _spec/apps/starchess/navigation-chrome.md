# StarChess navigation-chrome rationale

Why the nav / top-chrome pixels are the way they are. This file is the
home for reasoning the lead stripped out of source prose comments so
code stays comment-light and `// SPEC:` pointers stay the only
code-side edge. Code and tests were preserved intact at the strip
(492/492 pass); related chrome comments already committed were left
intact and are cited, not duplicated.

Implementation lives primarily in:

- `apps/starchess/src/app/BaseScreen.tsx` (live `topChrome()`, `topNavRow`)
- `apps/starchess/src/app/BaseScreen.module.css` (`.topPane`, `.topChrome`,
  `.topTurnBar`, `.topResourceBar`, `.dualResources`, `.topNavRow`)
- `apps/starchess/src/demos/ReviewDemoScreen.tsx` (review `dualResourceBars()`,
  detail `topPane`)
- `apps/starchess/src/demos/ReviewDemoScreen.module.css` (`.dualResources`,
  `.navDockDynamic`, dynamic `.topPane` stand-down)
- `packages/ui/web/src/primitives/ChevronNav.tsx` +
  `ChevronNav.starchess.module.css` / `ChevronNav.chess.module.css`
- `packages/ui/web/src/atoms/ReviewTurnNav.tsx` +
  `ReviewTurnNav.module.css`
- `packages/ui/web/src/atoms/MatchHistoryFilters.tsx` +
  `MatchHistoryFilters.module.css` (review list pager)
- `packages/ui/web/src/primitives/Breadcrumb.tsx` +
  `Breadcrumb.module.css` (tutorial section crumbs)
- `apps/starchess/src/presentation/hud/components/ResourceBar.tsx` +
  `ResourceBar.module.css` (play `.bar` wraps its content; named review bars
  `.bar:has(.name)` 18rem / compact 12rem — fixed, not `fit-content`, so the
  review pair reads as a matched pair regardless of name length or digits and
  the flanking turn arrows never shift as numbers change; `TeamFrame`)
- `apps/starchess/src/stories/Navigation.stories.tsx` +
  `Navigation.stories.module.css` (7-story production mirror)
- `apps/starchess/.storybook/preview.tsx` (viewports + `storySort`)
- Guards: `apps/starchess/src/__tests__/navTouchTargets.test.ts`,
  `apps/starchess/src/__tests__/storybook/storybookProjection.test.ts`

Companion diagrams (logic, not rationale):
`_spec/apps/starchess/screens.puml` (Screen HUD regions),
`_spec/apps/starchess/architecture/base-screen.puml` (BaseScreen props),
`_spec/apps/starchess/architecture/screen-entities.puml`,
`_spec/apps/chess/responsiveness/rules.md` (viewport contract),
`_spec/apps/starchess/architecture/storybook-projection.puml` (projection rule).

---

## 1. 40px touch floors on mobile, tight silhouettes on desktop

Small viewports grow the hit area; desktop keeps the slim text-button look.
No `data-testid` selectors in any touched stylesheet (css-layout contract).

| Control | Mobile rule | Desktop |
|---|---|---|
| `ChevronNav` `.nav` (starchess + `apps/chess` copies) | `(max-width: 719px)` → `min-width: 40px` + `min-height: 40px` | no 40px floor |
| `ReviewTurnNav` `.btn` (review ‹ ›) | `(max-width: 719px)` → `min-width: 40px` + `min-height: 40px` | no 40px floor |
| `MatchHistoryFilters` `.page-btn` (date pager) | `(max-width: 719px)` block → `min-width: 40px` + `min-height: 40px` | slim pager, no 40px floor |
| `Breadcrumb` `.crumb` (tutorial sections) | `(max-width: 719px)` → `min-height: 40px` only (no min-width); footer grows to fit, never shrunk to save space | no 40px floor |

Human decision preserved here: crumbs kept the 40px height floor even
though a narrower exception was proposed. Do not reintroduce the exception.

Out of scope on purpose, already 40px, untouched:
`DualNavButton` `.half` (`width/min-width/height/min-height: 40px` base) and
`IconButton` `.icon-btn` (`width/height: 40px` base). No change, no new guard.

Nuances, not regressions:

- Only the `(max-width: 719px)` media **block** is kept in sync between the
  two `ChevronNav` copies (the sync guard joins those blocks and compares
  them). The full files differ by theme tokens and comments.
- `Breadcrumb.module.css` also has a separate `(max-width: 720px)` type-
  compaction block (gap, padding, font-size). That is not the touch floor;
  do not merge the two queries.
- `DualNavButton.vertical .half` is `2.25rem` (36px) for the narrow side
  rail, and `ReviewDemoScreen.module.css` `.navDockDynamic button` is
  `min-width/min-height: 2.25rem` (36px) for the floating dock. The 40px
  contract covers the in-flow nav arrows, pager, and crumbs above — not
  these two dock/rail variants.

## 2. Nav band first, chrome stack after

The top section is sibling rows: the `‹ Back` + title nav band closes
before the chrome stack opens, so resource bars never share the nav grid
track. A long name or a second bar cannot squeeze `‹ Back` or overflow X.

- Live Single (`BaseScreen.tsx`): `.topNavRow` holds `ScreenBackNav`
  (`live-back`) followed by the sibling `.topChrome`
  (`starchess-board-chrome`) row.
- Review detail (`ReviewDemoScreen.tsx`): `Screen.SidebarInset.topPane`
  holds `ScreenBackNav` (`review-detail-back`, title stack inside) followed
  by the resources `Show` → `ReviewTurnNav` + `dualResourceBars()` as its
  own row.
- `ScreenBackNav` itself is a grid band (`Back | center | trailing`,
  `minmax(3.5rem, 1fr)` side floors, `align-items: start`,
  `margin-bottom: auto` pinning) — the split above is about what shares
  that band, not its internals.

## 3. Review dual bars: compact + nameless in the dynamic band

Frames carry the team colors (`ResourceBar` → `TeamFrame` +
`TEAM_PRIMARY`), so names are chrome the short band cannot afford.

- Dynamic band (`DYNAMIC_MOBILE_MQ`): both bars render
  `compact={dynamicMobile()}` and `name={dynamicMobile() ? undefined : …}`.
  Pair layout: `flex-wrap: nowrap`, `width: 100%`, children `flex: 1 1 0` +
  `min-width: 0` (both `BaseScreen.module.css` and
  `ReviewDemoScreen.module.css` `.dualResources`).
- Desktop: side-by-side named pair (`flex-wrap: wrap`, `width: fit-content`,
  `justify-content: center`).
- Narrow phones: the same `wrap` pair stacks when the strip does not fit.
- Ended games (`BaseScreen.tsx` `ended()` branch): both bars render
  `compact` unconditionally with no `name` prop at all — compact everywhere,
  not just dynamic.

## 4. Live Single shows the viewer bar only

Dual bars are review-only. `BaseScreen.tsx` `topChrome()` live fallback is
a single `<ResourceBar class={topResourceBar} />` with no `color` prop, so
it resolves to `viewerColor(store)`; the adjutant side stays hidden outside
review. There is no `liveDualResources` wrapper, no `liveDualCompact`, and
no `compact={mobileViewport()}` on live bars. An enemy-bar experiment was
built during the workstream and reverted on user correction — do not
reintroduce a live dual.

## 5. Bar first on phones, TurnBar on top on desktop; pixels owned by Storybook

> **Superseded on phones** by "Mobile banner: one chrome from the Screen
> primitives up" below: live screens now carry Back, resources and the
> compact TurnBar in the two-row banner. Desktop ordering here still holds.


Desktop DOM order is TurnBar then viewer bar; phones swap the visual order
so the bar reads first with TurnBar underneath.

- Production (`BaseScreen.module.css`): `@media (max-width: 719px)` sets
  `.topChrome > .topTurnBar { order: 2 }` and
  `.topChrome > .topResourceBar { order: 1 }`.
- Story mirror (`Navigation.stories.module.css`): same swap as
  `.topChrome > .turnFill { order: 2 }` /
  `.topChrome > .liveBar { order: 1 }`.
- The pixels for this are owned by Storybook viewports, not unit tests:
  `preview.tsx` defines Mobile `390×844`, Dynamic `560×420`, Desktop
  `1280×900`. Stories pin each case (`SingleDesktopChrome` → desktop,
  `SingleMobileBanner` → mobile, `SingleDynamicBanner` → dynamic,
  `ReviewDualNav` → desktop, `ReviewListBanner` → mobile,
  `TutorialCoachHeader` → mobile, `TurnArrowsIsolated` → mobile).

## 6. Deterministic width cascade, no bundle-order ties

Desktop is content-sized; phones lock fixed strips. Specificity does the
work so bundle order cannot flip the result.

- Live bar: `ResourceBar.module.css` `.bar { width: 18rem }` default;
  `BaseScreen.module.css` `@media (min-width: 720px)` rule
  `.topChrome .topResourceBar:not(.compact)` → `width: fit-content`, and
  `@media (max-width: 719px)` same selector → `width: 18rem`.
- Story mirror uses a doubled class for one extra specificity point:
  `.liveBar.liveBar { width: 18rem }` base and
  `@media (min-width: 720px)` `.topChrome .liveBar.liveBar:not(.compact)` →
  `width: fit-content`.
- Compact banner bar: `.bar.compact { width: 12rem }` (11px type, tighter
  gaps; content ≈ 9.5rem). The banner turn column takes the slack so End
  Turn + timer stay pinned right as numbers change (`fixedResources`).
- Review pair in the dynamic band sizes on `flex-basis`, not `width`:
  `.dualResources > *` / `.dualResources > :global(.compact)` use
  `flex: 1 1 0` + `min-width: 0` while `.bar.compact` keeps its fixed 12rem
  (`ReviewDemoScreen.module.css` notes either bundle order resolves the
  same). Single-row bars elsewhere must not reintroduce
  `flex: 1 1 100%` name-wrapping (pinned by guard).
- `MobileBanner` `fixedResources` flips its tracks so the slack sits left
  of End Turn; the story `SingleDynamicBanner` pins that arrangement.

## 7. Static guards because jsdom cannot measure layout

`navTouchTargets.test.ts` reads stylesheets and component source as text;
it asserts media-rule presence, selector presence, ordering, and absence
(no geometry). Families:

- Touch-target media rules: ChevronNav both apps, review arrows + pager,
  breadcrumb crumbs.
- `ChevronNav` sync: the two `(max-width: 719px)` blocks joined and
  compared for equality.
- Desktop silhouette: none of the five nav stylesheets carries a 40px
  `min-height`/`min-width` outside a media block.
- Rows ordering: `</ScreenBackNav>` (`live-back`, `review-detail-back`)
  precedes the chrome-stack open (`styles.topChrome`, `<ReviewTurnNav`).
- DOM bar-first order: `BaseScreen.tsx` `barFirst()` present with desktop
  fallback `{topTurnBar()}{topResources()}`; neither `BaseScreen.module.css`
  nor `Navigation.stories.module.css` contains an `order: 1/2` swap.
- Projection / mirror guards: story shells present (`.topChrome`,
  `.turnFill`, `.dualResources`, `.bannerFilters`, doubled
  `.liveBar.liveBar`, `justify-content: center`), desktop fit-content band,
  dynamic `nowrap` pair, viewer-only live (`no liveDualResources`, …),
  review compact + nameless in dynamic, and no `data-testid` styling.
- `storybookProjection.test.ts` holds the catalog boundary the stories
  rely on (no non-story `~/stories/` imports, no story-owned SCFEN,
  lesson reachability).

## 8. Storybook `Navigation/Chrome` mirrors production via its own module

Seven stories (`SingleDesktopChrome`, `SingleMobileBanner`,
`SingleDynamicBanner`, `ReviewDualNav`, `ReviewListBanner`,
`TutorialCoachHeader`, `TurnArrowsIsolated`) under title `Navigation/Chrome`, sorted by
`preview.tsx` `storySort` (`Navigation → [Chrome, *]`).

Own-CSS-module rule: the folder mirrors production chrome through
`Navigation.stories.module.css` only — no inline `style=` props, no
cross-component stylesheet imports. Shared production components
(`ScreenBackNav`, `ChevronNav`, `ReviewTurnNav`, `ResourceBar`, `TurnBar`,
`MobileBanner`, `MatchHistoryFilters`, `Breadcrumb`, `CoachAvatar`,
`StaticScfenBoard`) are imported as components; their stylesheets are
never imported. Do not add inline styles or cross-imports to work around
a mirror gap — fix the mirror selectors (`.topChrome`, `.turnFill`,
`.dualResources`, `.bannerFilters`, doubled `.liveBar`) instead.

## 9. TurnBar on top for tall-mobile sidebar, DOM order, lazy story wrappers

> **Superseded on phones** by "Mobile banner: one chrome from the Screen
> primitives up" below: live screens now carry Back, resources and the
> compact TurnBar in the two-row banner. Desktop ordering here still holds.


Supersedes §5's `order: 1/2` swap (rules deleted from both stylesheets);
§5's viewport pinning (which story covers which viewport) still holds.

- Tall-mobile sidebar (`BaseScreen.tsx` `showTopTurnBar()`): no rail, so
  `TurnBar` renders in `topChrome` under the resource bar, `compact` when
  `turnInSidebar()`. One End instance per branch — the footer keeps only
  the coach-header copy (`showFooterTurnBar()`, tutorials), which never
  renders `topChrome`. The two predicates are mutually exclusive.
- Bar-first in DOM (`barFirst()` = phone except dynamic): `topChrome()`
  renders resources then turn, so keyboard / screen-reader order matches
  the visual — never CSS `order`. Desktop keeps TurnBar first via the
  `Show` fallback (`{topTurnBar()}{topResources()}`).
- Story mirror (`SingleDesktopChrome`): desktop order only (TurnBar, then
  the ResourceBar) — phones no longer render this in-flow chrome; they get
  `SingleMobileBanner` / `SingleDynamicBanner`. Mobile stories mount the
  real `StarChessMobileBanner` / `StarChessMobileSubBanner`; the story module
  mirrors `BaseScreen`'s one-row inline
  (`.bannerInline`).

## Mobile banner: one chrome from the Screen primitives up

`StarChessMobileBanner` (`packages/ui/web/src/atoms/`) is the mobile top
chrome for every live screen; `Screen.starchess.module.css` reserves its room.

- **Dynamic band** (`DYNAMIC_MOBILE_MQ`): every banner, one row —
  `‹ Back | resources | turn`, transparent panel. Unchanged.
- **Tall phones** (every mobile width outside the dynamic band): only
  `band="mobile"` banners show, as two rows. Row 1 `‹ Back + ResourceBar`
  (no title) on solid black; row 2 is the **sub-banner**: the compact TurnBar
  (last queued action + End + timer), transparent, pinned right.
- `Screen` reserves `--mobile-banner-tall-height` (6.25rem) above the grid
  when a `band="mobile"` banner is present, and hides any in-flow
  `ScreenBackNav` Back (`.screen-back` hook, `visibility: hidden` so a
  header's centre stays centred) — the banner owns Back.
- `BaseScreen` renders one banner at the `Screen` root for `/single` and
  tutorials (`band="mobile"`) whenever `bannerOwnsChrome()` (live, mobile,
  coach header or an exit). While it does, the in-flow nav row (Back + title
  + chrome) and the lesson header's ResourceBar are **not rendered** — not
  CSS-hidden — so there is exactly one TurnBar / End / ResourceBar on the page
  (a hidden duplicate doubled `turn-end` and ran a second TurnBar). Lessons
  show the ResourceBar in the banner only once the coach hides
  (`hudResources`), where it takes the title's place. The footer TurnBar is gone.
- Review detail keeps `band="dynamic"` for now. `ReviewDemoScreen
  bannerChrome` is the proposal (Storybook "Game Detail · banner (proposal)"):
  row 1 `‹ Back` + both compact nameless bars on one line, sub-banner
  `‹ result ›` turn nav; replaces the in-flow top pane on tall phones and the
  floating arrow dock in Dynamic.
- Queue chips are whole-chip buttons (× is a cue), 40px tall in every bar;
  the compact bar holds 40px with or without a chip, and the tutorial cancel
  chevron sits left of the chip there (the inline queue clips above it).

Banner construction (`StarChessMobileBanner.module.css`):

- Shared geometry lives in a plain `(max-width: 719px)` block; each band
  only switches `display` on. Tall phones = every mobile width outside the
  dynamic band: `(max-width: 479px), (max-width: 719px) and (min-height: 640px)`.
- Two full-bleed rows, each owning its height (no outer padding, no row gap)
  so its content centres vertically: row 1 `minmax(48px, auto)` painted black
  by `::before`, row 2 painted `rgb(0 0 0 / 0.3)` by `::after` (both
  `align-self: stretch`, or they collapse to 0 under `align-items: center`).
  The sub-banner has equal padding above and below; no rule between the rows
  (the black row already separates them).
- Columns `4rem minmax(min-content, 1fr) minmax(0, 4rem)`: the empty third
  column mirrors Back so a single ResourceBar centres on the banner, and it
  yields down to 0 when the resources need the room (review's pair).
- In the banner the ResourceBar is `flex: 0 1 auto` (wraps its content); the
  turn column keeps End pinned right. An empty turn slot is `display: none`.
- Lesson header ResourceBar (`hudResources`, coach hidden) sits absolute at
  the header band's bottom, `pointer-events` only on the bar; hidden on mobile
  where the banner carries it.

Chips and the cancel hint:

- `Chip` variants are data attributes (`data-tone`, `data-size`,
  `data-removable`) styled with `.chip:where([data-…])` — `:where` keeps them
  at one-class specificity, so consumer classes (e.g. the sidebar's
  `styles.chip`) still override exactly as the old per-tone classes did.
  `onRemove` renders a `<button>` root; `removeTestId` moves onto it (e2e
  `queue-remove-*`).
- `CancelHint` wraps a queue chip: neon guide-green border + glow on the chip
  and the board's gas-hint chevron — `down` centred above the chip (the whole
  chip is the cancel target), `right` at its left for one-row bars whose
  inline queue clips anything above. The sidebar queue (overflow clipped)
  reserves 16px above itself only while a hint is present (`:has`).

## Mobile banner — one stripe on every screen (2026-09-27)

Below 720px every screen except the Menu carries the same stripe,
`StarChessMobileBanner`: `‹ Back` · centred title · spacer, one black 48px
full-bleed row (`--mobile-banner-row-height`), `z-index: 60` so lesson
headers (z 50 while the guide bubble shows) never cover it. It has no
content slots — `resources` / `turn` / `band` / `subBanner` /
`turnPlacement` / `fixedResources` are gone.

| Screen | Title | Under the stripe |
|---|---|---|
| `/single` | **no title** — the ResourceBar sits in the centre slot (`center`) | nothing: the turn controls live in the footer `HudDock` (below) |
| lessons | lesson title (`bannerTitle`) **until the coach hides** (`hudResources`); then the ResourceBar **replaces the title** in the centre slot, 40px tall like the End Turn row (`.bannerResourceBar`), as on `/single`. Tall phones only: the Dynamic band never shows a title, and desktop keeps its own header | nothing: footer `HudDock`, as on `/single` |
| tutorial replays | story label (`reviewLabel`) | sub-banner: `‹ Turn N ›` stepper |
| review list | "Review" | sub-banner: compact filters; matches fill the middle; Arena library in the footer |
| review detail | result line, coloured (`titleColor`) | in-flow: stacked resource bars with ‹ › on each side |

- **Tall-phone footer HUD (`HudDock`, 2026-09-27)**: `BaseScreen` no longer
  renders a sub-banner. Whenever `bannerOwnsChrome()` on a tall phone
  (`footerTurnDock()`), the footer's gas row is one tray —
  `[queued chip] [GasRack] [End Turn] [timer]` — in the rack's fill and
  border, running to the 16px screen gutter. Columns `minmax(0, 1fr) 96px
  7.4rem` — fixed tracks, never `auto`: a new chip, a spent canister, or a
  lesson that hides the turn controls (`turnHidden`) or the gas leaves the
  rack and End/timer exactly where they are. The tray stays in flow on short viewports (a
  lone rack still collapses to height 0 there). The GasRack's tail is fixed
  width at every gas level; reserves stack behind the ready canister, tucked
  under the circle's rim. The Dynamic band and desktop are unchanged.
  Story: `Features/GasDeploy` → "Mobile HUD dock", "Rack · gas levels".
- `StarChessMobileSubBanner` is the old second row, lifted out of the
  banner: absolute at `top: 48px`, `inline` (the screen reserves
  `--mobile-banner-tall-height`) or `float` (no reservation, z 60).
- `Screen` reserves 48px under any `.mobile-banner`, and hides the in-flow
  `‹ Back` *cell* (`.screen-back`, visibility only — lessons keep the coach
  that sits in the same `ScreenBackNav`). Hosts whose in-flow row is only
  Back + title drop it on mobile (review detail `.inFlowBack`, review list
  `.listChrome`).
- Review detail: its top pane is a `Screen.SidebarInset` (x 32–358 at 390px,
  `overflow: hidden`); the arrows-plus-bars row is 374px, so on mobile the
  pane is `overflow: visible` or the ‹ › are clipped. The dynamic band keeps
  the side-by-side compact bars; the portaled arrow dock is retired.
- Board-less screens bound their middle row with `minmax(0, 1fr)` (desktop
  and mobile), otherwise a long list grows the row past the viewport and the
  footer is cropped. The review list's footer drops the board-width cap, the
  sidebar padding and (mobile) the screen's bottom `padding-block`, so the
  Arena library lines up with the list tiles.

### Short landscape (dynamic band, w ≥ 480 · h < 640) — `BaseScreen` screens

No sub-banner fits: the stripe is the whole chrome, one row,
`‹ Back [ResourceBar] [TurnBar compact]` (`fill` drops the right spacer so
the centre can take the width), then the board. The split is two TurnBar
instances only on tall phones: `compact hideQueue` (End + timer — the only
instance that arms the planning timer; `noQueue` drops its empty 1fr queue
column) and `density="queueOnly"` (last chip, never ticks).
