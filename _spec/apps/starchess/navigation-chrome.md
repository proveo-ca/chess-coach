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
- `apps/starchess/src/components/primitives/ChevronNav.tsx` +
  `ChevronNav.module.css` (plus the `apps/ui` mirror copy)
- `apps/starchess/src/components/atoms/ReviewTurnNav.tsx` +
  `ReviewTurnNav.module.css`
- `apps/starchess/src/components/atoms/MatchHistoryFilters.tsx` +
  `MatchHistoryFilters.module.css` (review list pager)
- `apps/starchess/src/components/primitives/Breadcrumb.tsx` +
  `Breadcrumb.module.css` (tutorial section crumbs)
- `apps/starchess/src/presentation/hud/components/ResourceBar.tsx` +
  `ResourceBar.module.css` (`.bar` 18rem, `.bar.compact` 12rem, `TeamFrame`)
- `apps/starchess/src/stories/Navigation.stories.tsx` +
  `Navigation.stories.module.css` (7-story production mirror)
- `apps/starchess/.storybook/preview.tsx` (viewports + `storySort`)
- Guards: `apps/starchess/src/__tests__/navTouchTargets.test.ts`,
  `apps/starchess/src/__tests__/storybook/storybookProjection.test.ts`

Companion diagrams (logic, not rationale):
`_spec/apps/starchess/screens.puml` (Screen HUD regions),
`_spec/apps/starchess/architecture/base-screen.puml` (BaseScreen props),
`_spec/apps/starchess/architecture/screen-entities.puml`,
`_spec/apps/ui/responsiveness/rules.md` (viewport contract),
`_spec/apps/starchess/architecture/storybook-projection.puml` (projection rule).

---

## 1. 40px touch floors on mobile, tight silhouettes on desktop

Small viewports grow the hit area; desktop keeps the slim text-button look.
No `data-testid` selectors in any touched stylesheet (css-layout contract).

| Control | Mobile rule | Desktop |
|---|---|---|
| `ChevronNav` `.nav` (starchess + `apps/ui` copies) | `(max-width: 719px)` → `min-width: 40px` + `min-height: 40px` | no 40px floor |
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
  `1280×900`. Stories pin each case (`SingleTopChrome` → mobile,
  `SingleDynamicBanner` → dynamic, `ReviewDualNav` → desktop,
  `ReviewListChrome` → mobile, `ReviewListBanner` → dynamic,
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

Seven stories (`SingleTopChrome`, `SingleDynamicBanner`, `ReviewDualNav`,
`ReviewListChrome`, `ReviewListBanner`, `TutorialCoachHeader`,
`TurnArrowsIsolated`) under title `Navigation/Chrome`, sorted by
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
- Story mirror (`SingleTopChrome`): local `Bar` / `Turn` wrapper components
  around the same `Show when={barFirst()}`, not hoisted JSX values. Hoisted
  JSX evaluates eagerly outside `MatchStoreProvider` and crashes TurnBar's
  `useMatchStore`; component children stay lazy as getters.
