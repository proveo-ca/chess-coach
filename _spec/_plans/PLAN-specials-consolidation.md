# PLAN — Specials consolidation into `apps/starchess/src/presentation/specials`

Status: **DONE** — all phases implemented (barrel+shims, CCDeploy, five arms, planning occupancy, timeline/combat dedupe, shim deletion). Shims deleted: `types/specials.ts`, `hud/specialCopy.ts`, `specials/marineGasArm.ts`, `board/occupancyForQueuedMoves.ts`. Post-plan renames applied: shipTacticalJump / shipJump(+ShipJump animation, cue flag) / hoverbikeMine / tankSiege / CCDeploy (engine action kinds untouched). Companion to the deploy-over-ally engine change (CC `deploy` crushes ally non-kings).

Scope: gather presentation-side specials sprawl into one owner: `apps/starchess/src/presentation/specials/`.
Engine rules stay in `packages/starchess-core/src/rules/specials/` behind the public `index.ts` ACL — this plan never moves engine code into presentation.

---

## 1. Why (sprawl inventory)

| Concern | Today | Should live |
|---|---|---|
| Per-piece arm router + defs | `presentation/specials/pieceSpecials.ts` ✅ | keep, expand |
| Marine gas arm + `specialTimingFor` + `tryQueue` | `presentation/specials/marineGasArm.ts` ✅ | keep, extract `tryQueue`/`specialTimingFor` to `specials/queue.ts` so all arms share it |
| Queen jump targets | `presentation/specials/shipTacticalJump.ts` ✅ | keep |
| Mine leg geometry + `<SpiderMine/>` | `presentation/specials/spiderMineLegs.ts` + `components/SpiderMine.tsx` ✅ | keep |
| Gas→arm hook | `presentation/specials/hooks/usePieceSpecialArm.ts` ✅ | keep |
| CC deploy flow (anchor, adjacent ring, modal/pick, `tacticalJumpTargets`, b/r/n/q arms) | `app/BaseScreen.tsx:149-160,238-410,779-810` ❌ spread | move to `specials/arms/{kingDeploy.ts,spiderMine.ts,charonMissiles.ts,siegeMode.ts,shipJump.ts}` + `specials/deployTargets.ts` (UI wrapper over core `spawnCCAnchor`/`adjacentSquares`) |
| Gas rack UI (drag/drop, ghost canisters) | `presentation/hud/components/GasRack.tsx` + `types/specials.ts` ❌ | move type to `specials/types.ts` (re-export for compat); keep `GasRack` in hud, import arms/types from `specials` |
| Special copy (names/descriptions/costs) | `presentation/hud/specialCopy.ts` ❌ | move to `specials/copy.ts` (re-export shim in hud) |
| Planning occupancy (B spawn/gas/warp projection, fog layering) | `presentation/board/occupancyForQueuedMoves.ts` ❌ | move to `specials/planning/occupancy.ts` (pure, testable); thin re-export in board |
| Intent overlays (B/F canister badge + dest ghost) | `presentation/combat/intentOverlays.ts:293` ❌ | stay in combat, import timing/target helpers from `specials` (no logic move, kill duplication) |
| Timeline gas/crush/jump cues | `presentation/timeline/timelinePlayer.ts:34,176-329,562-613` + `cueLanes.ts` + `resolveWaves.ts` ❌ | stay in timeline, import `tacticalJumpTargets`/timing from `specials` (delete local copies) |
| Economy (gas remain, `hasUsedSpecialThisTurn`, `MARK_SPECIAL_USED`) | `app/matchEconomy.ts`, `app/matchReducer.ts` | stay; arms call through `tryQueue`/dispatch (no move) |
| Board input (`moveThenGasPromotes`, selection of B-virtual units) | `presentation/board/hooks/useBoardInput.ts` | stay; import arms from `specials` |
| Engine (validation, `spawnCCAnchor`, `deployTargets`, `applySpecial/spawn`, registry, costs) | `packages/starchess-core/src/rules/specials/*`, `board/deploy-reach.ts`, `resolve/submit-turn.ts` | **do not move** — presentation imports only via `@chess-coach/starchess-core` public index |

---

## 2. Target layout (presentation only)

```
apps/starchess/src/presentation/specials/
  index.ts                 # public barrel (arms, targets, timing, types, copy)
  types.ts                 # GasDeployTarget (+ ArmResult re-export) — from types/specials.ts
  copy.ts                  # from hud/specialCopy.ts
  queue.ts                 # specialTimingFor + tryQueue — from pawnGasArm.ts
  pieceSpecials.ts         # defs + armPieceSpecial (slim, imports arms/)
  pawnGasArm.ts            # slim wrapper over arms/marineGas.ts (compat)
  shipTacticalJump.ts     # keep
  spiderMineLegs.ts        # keep
  deployTargets.ts         # NEW UI wrapper: spawnCCAnchor + adjacentSquares → ring targets (ally-crush aware)
  arms/
    marineGas.ts           # from pawnGasArm.pawnGasArm
    kingDeploy.ts          # from BaseScreen spawn flow (modal/pick/targets/commit)
    spiderMine.ts          # from BaseScreen n-arm
    charonMissiles.ts         # from BaseScreen b-arm
    siegeMode.ts           # from BaseScreen r-arm
    shipJump.ts           # from BaseScreen q-arm
  planning/
    occupancy.ts           # from board/occupancyForQueuedMoves.ts
  hooks/
    usePieceSpecialArm.ts  # keep
  components/
    SpiderMine.tsx         # keep (+ DeployModal/TargetRing moved here from BaseScreen)
```

Shims (delete after callers migrate): `types/specials.ts`, `hud/specialCopy.ts`, `board/occupancyForQueuedMoves.ts` re-export from `specials/`.

---

## 3. Phases (each independently verifiable)

| # | Move | Verify |
|---|---|---|
| 0 | Barrel + shims: create `specials/index.ts`, `types.ts`, `copy.ts`, `queue.ts` (pure moves, no logic change) | `tsc --noEmit`, existing `pawnGasArm.coverage`, `mineTargeting`, `pawnGasOrder` tests pass |
| 1 | Extract `kingDeploy.ts` + `deployTargets.ts` from `BaseScreen:149-160,238-410`; BaseScreen imports from `specials` | ally-crush ring shows ally squares (after engine predicate change); `spawnAdjacent` unchanged behavior on enemy/empty |
| 2 | Extract `spiderMine/charonMissiles/siegeMode/shipJump/marineGas` arms; `pieceSpecials` slims to router | `vitest` gas/mine/special suites; Storybook `SpecialMoves`, `GasDeploy` stories unchanged |
| 3 | Move `occupancyForQueuedMoves.ts` → `specials/planning/occupancy.ts`; board keeps re-export | `useBoardInput` tests, fog + B-spawn selectability tests pass |
| 4 | Timeline/combat dedupe: import jump targets + timing from `specials`; no local reach copies | timeline crush/deploy suites (B/F ally-crush deploy+death cues); `check:css-layout` |
| 5 | Delete shims; `grep` gate: no `specials` logic outside `presentation/specials` + engine core | `rg "tacticalJumpTargets|specialTimingFor|tryQueue|spawnCCAnchor" apps/starchess/src --files-with-matches` only hits `presentation/specials` + thin importers |

---

## 4. Contracts / invariants

- Engine boundary: `presentation/specials/*` imports engine only via `@chess-coach/starchess-core` public index (`spawnCCAnchor`, `adjacentSquares`, `tacticalJumpTargets` stays local, `deployTargets` core for AI). Never `resolve/resolve-turn`, `rules/validation` directly (ACL test `bundleBoundary` must pass).
- Single owners: ring block set = `spawnCCAnchor`; reach = core `deploy-reach`; queue write = `tryQueue`→reducer; resolve = `submit-turn`; cues = `timelinePlayer`.
- Deploy-over-ally rides phase 1: `deployTargets.ts` wrapper reflects new predicate (kings-only block); resolve + `deploy`+`death` cues already color-blind (architect design) — consolidation must not fork that logic.
- CSS: no styling via `data-testid`; layout classes on roots; `compact/class` props into HUD; `npm run check:css-layout` in `apps/starchess`.
- Coverage floor 75% four-axis on gated `.ts` surface.

## 5. Risks

- BaseScreen is large (979 lines) — extract arms incrementally behind the existing `armPieceSpecial` router; keep `MARK_SPECIAL_USED`/`pending` semantics identical.
- `deployCovers` widening (ally targets) affects AI scoring — accepted for this slice, follow-up AI ticket (per architect design).
- Import cycles: `pawnGasArm` imports `useBoardInput.moveThenGasPromotes` — move shared pred to `specials/planning` or inject as arg during extraction.

## 6. Done when

- `rg` shows all presentation specials logic owned by `presentation/specials/`; hud/board/combat/timeline are thin importers.
- All existing gas/mine/special/timeline tests + `tsc` + `check:css-layout` + ACL pass.
- Follow-up deletes shims; spec links (`// SPEC:`) point at `core/board/*`, `core/turn/*`, `deploy-reach.puml`, `resolve.puml`.
