# StarChess VFX guarantees (e2e roster)

Every combat-VFX promise the app makes, and the e2e test that holds it.
Specs stay the source of truth for *why*; this file is the roster of *what is
actually pinned in CI*.

Suite: `apps/e2e/tests/vfx/` (StarChess target only — `E2E_TARGET=starchess`,
registered in `apps/e2e/target.ts` as `**/vfx-*.spec.ts`).
Run: `npm run e2e:starchess -- tests/vfx`.

## How the suite observes VFX

Cues live 200–700ms. A Playwright locator poll backs off to ~1s and silently
misses them, so cue presence is read from an **in-page sampler**
(`tests/vfx/vfxHarness.ts`, 16ms interval) that records, per resolve: which cue
kinds rendered, peak simultaneous count per kind, layer/ cue element identity,
overlay-vs-grid drift, king hit phases, and double-draw violations. Locators are
used only for **settled** state (final placement, persistent fire, computed
style).

## Roster

| # | Guarantee | Source of truth | Test |
|---|---|---|---|
| V1 | Combat root mounts once, `aria-hidden`, `pointer-events: none`, `z-index 30`, `overflow: visible` (trails must escape the box) | `composite-vfx-stack.puml` | `vfx-overlay-contract.spec.ts` |
| V2 | All eight layers mounted in CombatOverlayRoot order with zero cues (`NO_*` stable empties) | `composite-vfx-stack.puml` | `vfx-overlay-contract.spec.ts` |
| V3 | Neither the root nor any layer is remounted during a resolve (no per-layer `Show` — remounts restart CSS) | `composite-vfx-stack.puml`, `timeline-perf.puml` | `vfx-overlay-contract.spec.ts` |
| V4 | Root keeps `contain: layout style` — never `paint` | `timeline-perf.puml` (Q3) | `vfx-overlay-contract.spec.ts` |
| V5 | `data-overlay-dpr` / `--overlay-dpr` clamp DPR to ≤2 | `timeline-perf.puml` | `vfx-overlay-contract.spec.ts` |
| V6 | Overlay box registers on `[data-board-grid]` (±1px) on desktop / dynamic / mobile and re-registers after a resize | `composite-vfx-stack.puml` (OverlayMeasureHost) | `vfx-overlay-contract.spec.ts` |
| V7 | Registration holds *while* cues play (no drift mid-resolve) | same | `vfx-overlay-contract.spec.ts` |
| V8 | Idle overlay carries no `will-change` (active anim classes only) | `timeline-perf.puml` | `vfx-overlay-contract.spec.ts` |
| V9 | Overlay is measured, not guessed — covers exactly 8×8 squares | `boardGeom.ts` / AnimationStage | `vfx-overlay-contract.spec.ts` |
| V10 | A classical move plays through the move layer (no teleport) | `animation-pipeline.md` | `vfx-cue-coverage.spec.ts` |
| V11 | Pawn gas step plays the canister drop **and** the stim move | `cue-playback.puml` (gas window) | `vfx-cue-coverage.spec.ts` |
| V12 | A capture plays the attacker's weapon hull and the victim's death | `cue-playback.puml` (phase-1 attack) | `vfx-cue-coverage.spec.ts` |
| V13 | Charon snipe fires `data-attack-anim="bishopCharon"` | `attackVectors.ts` / specials | `vfx-cue-coverage.spec.ts` |
| V14 | Promotion drops the promoted unit through the deploy layer | `cue-playback.puml` (promo deploy) | `vfx-cue-coverage.spec.ts` |
| V15 | Spawn plays canister drop + deploy | `cue-playback.puml` (spawn deploy) | `vfx-cue-coverage.spec.ts` |
| V16 | Tactical Jump uses the jump layer and its trail — **never** a move-layer slide | `cue-playback.puml` (Tactical Jump) | `vfx-cue-coverage.spec.ts` |
| V17 | Spider-mine chase plays the missile, its wake and the death | `cue-playback.puml` (chase missile), `mine-contact.puml` | `vfx-cue-coverage.spec.ts` |
| V18 | A connecting king shot **booms** (250ms hit flash), then burns | `kingDamage.ts` (`impactSeq`), `blunder`-free hull rules in `cue-playback.puml` | `vfx-cue-coverage.spec.ts` — **failing, see below** |
| V19 | A playing cue element is never replaced while its id stays on screen (CSS restart = "knight plays twice", "gatling loops", hull flash-back) | `useCombatOverlays.ts` header, `cue-playback.puml` | `vfx-playback-integrity.spec.ts` |
| V20 | The overlay drains to zero cues after the resolve, layers stay mounted (no orphan clock) | `timeline-perf.puml` (sole clock) | `vfx-playback-integrity.spec.ts` |
| V21 | Jump and mine trails outlive their cue (fade past `TIMELINE_DONE`) | `timeline-perf.puml`, `cue-playback.puml` | `vfx-playback-integrity.spec.ts` |
| V22 | While a mover owns a square the board does not draw it (`deriveVisualFrame` hide ownership) | `animation-pipeline.md` (square ownership) | `vfx-playback-integrity.spec.ts` |
| V23 | Tutorial auto-End (`endTurnAfterQueue` → `endTurnLikeAClick`) still plays the move VFX | `animation-pipeline.md` (auto-End must not dispatch from an effect) | `vfx-playback-integrity.spec.ts` |
| V24 | Fog tutorial burns a cburnett king (`data-king-glyph`), StarChess burns the CC hull | `ccDamageOverlay.tsx` | `vfx-playback-integrity.spec.ts` |
| V25 | A burning king does not leak through fog (fire paints over the board) | `kingDamage.ts` (`visibleKingDamageCues`) | `vfx-playback-integrity.spec.ts` |
| V26 | Live play never exceeds `VFX_CAP_DESKTOP` (8) same-kind cues | `timeline-vfx-density.puml` | `vfx-density-caps.spec.ts` |
| V27 | Tight viewports never exceed `VFX_CAP_TIGHT` (4) | same | `vfx-density-caps.spec.ts` |
| V28 | DualNav review replay never exceeds `VFX_CAP_REVIEW_DESKTOP` (4) | same (`capForDensity`) | `vfx-density-caps.spec.ts` |
| V29 | No `@keyframes` animates a paint-only property (`outline-color`, `border-*-color`, `box-shadow`) outside the pinned allowlist | `timeline-vfx-density.puml` (paint audit) | `vfx-paint-budget.spec.ts` |
| V30 | No paint-animating keyframe actually **runs** under the combat root (allowlist aside) — checked on a knight frag, the densest weapon | same | `vfx-paint-budget.spec.ts` |
| V31 | `.board-phase-ring` fades opacity-only (colours snap) | `timeline-vfx-density.puml` (phase ring) | `vfx-paint-budget.spec.ts` |
| V32 | The ring — not a container repaint — carries the resolve state (`data-phase`) | same | `vfx-paint-budget.spec.ts` |
| V34 | A mine held back by a Marine Extra Step chases the marine to its destination — the stim move lands *before* the boom (`farmx`/`farmm`/`farmd` on the `afterMove` rung) | `mine-contact.puml` (one walk per marine), `cue-lanes.puml` (arrival-mine prefixes) | `vfx-cue-coverage.spec.ts` |
| V35 | A damaged Command Center **keeps burning while it walks** — `visibleKingDamageCues` drops that side (`movingColors`), the move hull carries `damage` + `seed` instead, so the slide never flashes a pristine CC and no second hull draws over it | `kingDamage.ts` (`movingColors` gate, `withCCFire`), `board-entities.puml` | **unit only — see gaps** |
| V36 | A damaged Command Center **keeps burning while it shoots** — the `attackFrom` gate already dropped the slot, so the shot hull carries `damage` + `seed` through the hatch / battery CSS | `kingDamage.ts` (`attackFrom` gate, `withCCFire`) | **unit only — see gaps** |
| V37 | A **shot-out spider mine leaves a wreck** — `DeathMine` breaks up visibly on its own tile (crown, pods, four legs) with the Hoverbike frag boom fired in place, and `spentMines` darkens the intact glyph for the window so it never draws under its own explosion | `cue-playback.puml` (mine-death lanes owe `spentMines`), `board-entities.puml` | **unit only — see gaps** |

| V38 | A capture onto a **mined** tile buries **both** — `Rxe5` on an e5 holding a unit and a mine plays the victim's wreck and the mine's, with the glyph darkened; visible captures pair them in one phase-1 window, a fogged approach pairs `prdm` with `prdth` before the occupy slide, and the attacker lands alive either way | `mine-contact.puml` (a blocker draws the shot; a capture reports its mine), `cue-projection.puml` | **unit only — see gaps** |
| V39 | VFX that is a unit's **own** ordnance carries its player's swatch — Hoverbike deploy jet + frag boom, Ship laser, mine-wreck boom — and two sides firing in one window keep their tints apart | `board-entities.puml` (`teamTintStyle`) | **unit only — see gaps** |
| V40 | A spawn **crush** layers the deploy hull **above** the victim's death boom on the shared square — co-present cues, same tile, `Deploy z37 > Death z35`, topmost hit-test is the deploy layer | `composite-vfx-stack.puml` (Deploy DOM-last ≈ topmost; explicit z under `isolate`) | `vfx-crush-compose.spec.ts` |

### V37 — why the mine wreck needs its own tuning

A mine is the smallest thing on the board: its art fills barely half its own
viewBox, so a wrecked part is 4–7px on a 55px tile. Three shared defaults each
erase a wreck that size, and all three were observed doing exactly that
(Chromium, `starchess-death-animations--spider-mine`, 6× device scale):

| Shared default | What it does to a 4px part | Mine override |
|---|---|---|
| `.boomFlash` at `inset: 12%` | an opaque gradient over 88% of the tile hides the whole wreck | `inset: 30%` (as the Marine and Command Center already pull theirs in) |
| `shardFly`'s `cubic-bezier(0.15, 0.75, 0.2, 1)` | front-loaded: 12% into the window a part has travelled 70% and faded to ~0.3 — fine on a 12px Hoverbike chunk, invisible on a mine leg | `mineShardFly`, opaque through the first half, gentler curve |
| default `distScale: 1` | parts clear the tile before they can be read | `PART_FLIGHT = 0.42` — the scatter stays on its own square |

The frag boom is a fourth: it is positioned and the wreck's `svg` is not, so it
always paints on top and has to stay brief and translucent.

Pinned allowlist for V29/V30: `sc-hint-pulse` (tutorial hint ring, board
chrome). `fragShockwave` left it once its colour shift became a two-ring
opacity cross-fade. Anything new is a regression.

### Adjacent — owned by another subject folder

| # | Guarantee | Test |
|---|---|---|
| V33 | Progressive path fog lights the fog-edge square **while** the move layer is still on screen (not only after the occupy commit) | `apps/e2e/tests/starchess/starchess-fog-path.spec.ts` |

V33 lives with fog, not VFX, but it fails if move cues stop rendering — keep the
two in sync when the move layer changes.

## V18 — currently failing (king hit-boom never paints)

`CCDamageSlot` (`presentation/animations/components/ccDamageOverlay.tsx`)
starts at `phase: "fire"` and its `createEffect` plays the boom when
`impactSeq` passes `lastPlayedBoomSeq`:

```ts
if (seq > last) { lastPlayedBoomSeq.set(id, seq); playBoom(); }
else setPhase("fire");
```

`props.cues` is a fresh array on every recompute of `visibleKingDamage`
(`LiveStarChessBoard`), so `byId()` → `cue()` → the effect re-runs whenever the
displayed snapshot changes — which is every `TIMELINE_COMMIT`. The second run in
the same batch sees `seq === last` and takes the `else`, so `phase` goes
`boom → fire` before Solid flushes: the DOM only ever shows `fire`
(`data-king-hit-phase` observed transition is `fire -> fire`, MutationObserver
with `attributeOldValue`). The hit flash never renders — on the mount chip or on
any later chip, on `/single` and in the tutorial.

The effect body predates `revision: tutorial` (6afeb05); what that commit added
is the fog predicate inside `visibleKingDamageCues`, which makes
`visibleKingDamage` recompute on the displayed snapshot and so lands the reset in
the same batch as the boom.

Candidate fix (one line, no cue-math change): do not reset a boom that is still
in flight — `else if (phase() !== "boom") setPhase("fire")` — or key the played
seq per slot instead of resetting on every re-run.

## Known gaps

* **V35–V39 have no e2e pin.** The offending frames last one cue (a king move is
  200ms, a death `DEATH_MS`), and the sampler records cue *kinds*, layer identity
  and king hit phases — not a hull's `data-king-damage`, `data-death-glyph`, or
  whether a mine glyph is still drawn under a wreck. Pinning them in CI needs
  `vfxHarness.ts` to sample those attributes off the move / attack / death layers
  and `[data-spider-mine]`. Until then they are held by unit tests:
  `__tests__/MoveAnimation.test.tsx` and `__tests__/AttackAnimation.test.tsx`
  (each hull paints its cue's damage state) over `__tests__/ccDamage.test.ts`
  (`visibleKingDamageCues · travelling king` for the layer handoff, `withCCFire`
  for the dressing that replaces it); `__tests__/DeathAnimation.test.tsx` (the
  wreck is the mine, is shard-built, and carries the frag boom) over
  `__tests__/timelinePlayer.test.ts` (`mine wreck hides its glyph` — both the
  batched phase-1 lane and the sequential rung, and `capture onto a mined tile`
  for V38's paired wrecks); and for V39, `__tests__/teamColors.test.ts` (the two
  spellings of a swatch stay in step) over the three layer suites
  (`DeployAnimation` / `AttackAnimation` / `DeathAnimation`), which assert the
  tint reaches each cue element and that two sides in one window keep theirs
  apart.
* V26–V28 are **ceilings**, not cap proofs: no deterministic live seed produces
  more than 3 same-kind cues, so they fail only if a cap is dropped *and* a
  scene gets dense. The cap math itself is pinned by
  `apps/starchess/src/__tests__/vfxPerf.test.ts`.
* The density **mode** (`full` vs `review`) has no DOM projection, so e2e cannot
  assert which cap was chosen — only that the rendered count respects it.
* `transition` on paint-only properties is only checked for
  `.board-phase-ring` (V31); the shipped `.pieceSpecialUsed` outline transition
  is the accepted P2 exception.
* **Which animations need optimizing is detected, not guaranteed.**
  `vfx-fps-throttle.spec.ts` runs every Moves / Attacks / Deaths / Deploys
  Storybook demo at 1× and 20× CPU (`Emulation.setCPUThrottlingRate`, Chromium
  only, needs Storybook on :6007) and ranks each CSS animation in
  `apps/e2e/test-results/vfx-optimize/report.md`: **non-composited** (Chromium's
  `compositeFailed` verdict from the `blink.animations` trace), **cut** (its cue
  unmounted before its keyframes ended) and **mount hitch** (a long frame when it
  started). The timeline's pace is authoritative — multiplayer clients advance
  in lockstep — so a cut animation is fixed in the VFX, never by making the
  timeline wait. `VFX_OPTIMIZE_STRICT=1` fails on any flag.
  `VFX_TIER=lite` measures the lite tier.
* **VFX tier probe** — `vfx-tier-probe.spec.ts` pins the calibration in
  `vfx-tier.puml`: the menu probe keeps `full` at 1× / 6× / 10× CPU, goes `lite`
  on the second 20× probe (and the tier reaches `/single`), and never runs under
  reduced motion.
