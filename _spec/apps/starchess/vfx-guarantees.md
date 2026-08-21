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
| V24 | Fog tutorial burns a cburnett king (`data-king-glyph`), StarChess burns the CC hull | `kingDamageOverlay.tsx` | `vfx-playback-integrity.spec.ts` |
| V25 | A burning king does not leak through fog (fire paints over the board) | `kingDamage.ts` (`visibleKingDamageCues`) | `vfx-playback-integrity.spec.ts` |
| V26 | Live play never exceeds `VFX_CAP_DESKTOP` (8) same-kind cues | `timeline-vfx-density.puml` | `vfx-density-caps.spec.ts` |
| V27 | Tight viewports never exceed `VFX_CAP_TIGHT` (4) | same | `vfx-density-caps.spec.ts` |
| V28 | DualNav review replay never exceeds `VFX_CAP_REVIEW_DESKTOP` (4) | same (`capForDensity`) | `vfx-density-caps.spec.ts` |
| V29 | No `@keyframes` animates a paint-only property (`outline-color`, `border-*-color`, `box-shadow`) outside the pinned allowlist | `timeline-vfx-density.puml` (paint audit) | `vfx-paint-budget.spec.ts` |
| V30 | No paint-animating keyframe actually **runs** under the combat root (allowlist aside) — checked on a knight frag, the densest weapon | same | `vfx-paint-budget.spec.ts` |
| V31 | `.board-phase-ring` fades opacity-only (colours snap) | `timeline-vfx-density.puml` (phase ring) | `vfx-paint-budget.spec.ts` |
| V32 | The ring — not a container repaint — carries the resolve state (`data-phase`) | same | `vfx-paint-budget.spec.ts` |
| V34 | A mine held back by a Marine Extra Step chases the marine to its destination — the stim move lands *before* the boom (`famx`/`famm`/`famd` on the `afterMove` rung) | `mine-contact.puml` (one walk per marine), `cue-lanes.puml` (arrival-mine prefixes) | `vfx-cue-coverage.spec.ts` |

Pinned allowlist for V29/V30: `fragShockwave` (border-colour, accepted P2 in
`timeline-perf.puml`) and `sc-hint-pulse` (tutorial hint ring, board chrome).
Anything new is a regression.

### Adjacent — owned by another subject folder

| # | Guarantee | Test |
|---|---|---|
| V33 | Progressive path fog lights the fog-edge square **while** the move layer is still on screen (not only after the occupy commit) | `apps/e2e/tests/starchess/starchess-fog-path.spec.ts` |

V33 lives with fog, not VFX, but it fails if move cues stop rendering — keep the
two in sync when the move layer changes.

## V18 — currently failing (king hit-boom never paints)

`KingDamageSlot` (`presentation/animations/components/kingDamageOverlay.tsx`)
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

* V26–V28 are **ceilings**, not cap proofs: no deterministic live seed produces
  more than 3 same-kind cues, so they fail only if a cap is dropped *and* a
  scene gets dense. The cap math itself is pinned by
  `apps/starchess/src/__tests__/vfxPerf.test.ts`.
* The density **mode** (`full` vs `review`) has no DOM projection, so e2e cannot
  assert which cap was chosen — only that the rendered count respects it.
* `transition` on paint-only properties is only checked for
  `.board-phase-ring` (V31); the shipped `.pieceSpecialUsed` outline transition
  is the accepted P2 exception.
