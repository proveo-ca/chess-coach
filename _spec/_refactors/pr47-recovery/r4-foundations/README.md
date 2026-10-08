# PR47 recovery — archived R4 foundations

```text
status: blocked_draft
executor_choice: Archive unfinished R4 (Recommended)
r4_complete: false
fitter: absent
model_ready: false
high_waiver: false
source_meter_contract_changed: false
```

## Executor disposition

Executor actually selected **“Archive unfinished R4 (Recommended)”** in the TUI.
Executor authorized preserving every shared foundation source and test in this mirrored recovery-history archive.
This archive preserves the unfinished draft instead of activating its implementation.
Verified R2/R3 remains the active baseline.
The verified core pure-geometry exports and arena checked-boundary accessor remain live prerequisites under their separate ownership.
The lead owns the separately authorized backup, meaningful history rewrite, and force-with-lease operations.

This disposition grants no contract amendment or HIGH waiver.
It changes no frozen SourceMeter/Meter contract, configuration, feature registry, or approval gate.
It grants no collection, fitting, calibration, transfer, training, artifact-publication, or model-readiness authority.
No fitter or calibrated model accompanies this archive.
R4 remains unfinished.

## Exact source-path map

Archive paths are relative to this directory.
Each destination mirrors the full original repository-relative source path.
The eight snapshots retain their raw bytes, original headers, and failing assertions.

| Original active path | Archived snapshot |
|---|---|
| `packages/starchess-training/src/economic/contracts.ts` | [packages/starchess-training/src/economic/contracts.ts](packages/starchess-training/src/economic/contracts.ts) |
| `packages/starchess-training/src/economic/float64.ts` | [packages/starchess-training/src/economic/float64.ts](packages/starchess-training/src/economic/float64.ts) |
| `packages/starchess-training/src/economic/schema.ts` | [packages/starchess-training/src/economic/schema.ts](packages/starchess-training/src/economic/schema.ts) |
| `packages/starchess-training/src/economic/work.ts` | [packages/starchess-training/src/economic/work.ts](packages/starchess-training/src/economic/work.ts) |
| `packages/starchess-training/src/feature/manifest.ts` | [packages/starchess-training/src/feature/manifest.ts](packages/starchess-training/src/feature/manifest.ts) |
| `packages/starchess-training/src/__tests__/economicContracts.test.ts` | [packages/starchess-training/src/__tests__/economicContracts.test.ts](packages/starchess-training/src/__tests__/economicContracts.test.ts) |
| `packages/starchess-training/src/__tests__/economicWork.test.ts` | [packages/starchess-training/src/__tests__/economicWork.test.ts](packages/starchess-training/src/__tests__/economicWork.test.ts) |
| `packages/starchess-training/src/__tests__/featureManifestV3.test.ts` | [packages/starchess-training/src/__tests__/featureManifestV3.test.ts](packages/starchess-training/src/__tests__/featureManifestV3.test.ts) |

## Review and blocking condition

The supplied adversarial review session is `ses_ee4033dbaffe47xmv8LO9Kq8Yf`.
It reported a HIGH for unbounded own-key enumeration/allocation before sufficient capacity checks in `readObject`.
The supplied security review reported the overlapping MEDIUM Float64 ingress issue.
The handoff supplied no security-review session ID.

Remediation added prepaid ingress guards, startup/planning validation separation, feature-block constraints, and available-backoff consistency checks.
The final own-key reflection still allocates a complete list for wide non-enumerable and symbol-key records.
The bounded enumerable guard does not establish a bounded allocation guarantee for those raw objects.
The two persisted regressions expose this unresolved condition.
The snapshot therefore has no no-blockers disposition.
The archive records the blocker instead of changing the contract or waiving the finding.

## Recorded pre-archive verification

| Verification scope | Latest recorded result |
|---|---|
| Focused foundation tests | **108 passed / 2 failed**, 110 total |
| Full training suite with the draft active | **198 passed / 2 failed**, 200 total across 9 files |
| Strict training typecheck, including owned tests | **PASS** |
| Whitespace checks across all eight owned files | **8 checked / 0 failed** |

Both remaining failures belong to `economicWork.test.ts`.
They require wide non-enumerable and symbol-key ingress to avoid allocating an unbounded own-key list.
Both observed one unsafe enumeration where the assertions require zero.

The initial **77/77 PASS** covered an earlier, smaller regression set.
Later regressions superseded that bounded partial assurance.
The initial PASS never established complete scalar-work safety, fitted calibration, integrated R4 readiness, or R5 acceptance.
Synthetic `FROZEN` artifact fixtures validate draft schema behavior only.
They provide no fitting, calibration, native-containment, or model-readiness proof.

The archived tests remain unchanged under `_spec/_refactors/`.
The active Vitest configuration selects `src/**/*.test.ts` within the training package.
The active TypeScript configuration includes that package's `src` and `vitest.config.ts`.
Archiving removes these snapshots from active compilation and test discovery.
It adds no test skip or test-filter amendment.

## Executed post-archive verification

The agent executed the following checks in `/tmp/opencode/chess-coach-r3-recovered` after the exact moves.

| Check | Actual result |
|---|---|
| `npm run test --prefix packages/starchess-training` | **90 passed / 0 failed across 6 files** |
| `npm run typecheck --prefix packages/starchess-training -- --strict` | **PASS** |
| `npm run typecheck --prefix packages/starchess-core -- --strict` | **PASS** |
| `npm run typecheck --prefix packages/starchess-arena -- --strict` | **PASS** |
| Original source-path absence checks | **8 absent / 0 remaining** |
| Active `packages/` search for foundation imports, helper symbols, test filenames, and V3/economic-artifact version literals | **No matches** |
| Active `apps/`, `scripts/`, and agent machine-configuration reference searches | **No matches** |
| Training package/test/type configuration diff | **No changes** |

The active suite contains the legacy 85 tests and five candidate-identity ownership tests.
The archived failing assertions remain intact outside active discovery.
This active-suite PASS does not resolve the archived R4 blocker or complete R4.

## Raw-byte identity ledger

The agent measured these SHA-256 digests and Git blob object IDs from the original files before moving them.
`git hash-object` ran without `-w`.
The ledger lives outside the eight source snapshots.
The lead can independently compare the archived bytes against these measurements.
After the move, `sha256sum --check` reported **OK for all eight destinations** against the pre-move digests.
After the move, all eight `git hash-object` results matched the corresponding pre-move object IDs below.
The before/after comparison establishes exact byte preservation for this move.

| Original path | SHA-256 before move | Git blob object ID before move |
|---|---|---|
| `packages/starchess-training/src/economic/contracts.ts` | `9a2f6419a5cfd318f3ff10388f60ae87ab0d610492c42e7ce96929b6c14cc0b4` | `e07606abcf3738954d0bd06a41c6e16d6f5c7240` |
| `packages/starchess-training/src/economic/float64.ts` | `c2e5e3c44ce4adb46f5ac355bec3bb2d647c8bd2714e6f8cdeacb3e719ac8d73` | `260e1d882adbb0b6dfe93f4064fa9d04a82f07fb` |
| `packages/starchess-training/src/economic/schema.ts` | `53f872bf3ce89a6463f3eee4163a13d956bb39ffaaa15aebe20f15d8739aefcd` | `681e042eacb6f272a90db8abff3dcc76a741cb94` |
| `packages/starchess-training/src/economic/work.ts` | `dedb940544b4412c27e1934d968538ffe5d73f7c0489eb1f928d852fe95d0b18` | `be4eb73bfee471fe6ae81e39d0945c86e1fa5e23` |
| `packages/starchess-training/src/feature/manifest.ts` | `176c2ddc11dbbba171916e15bb9f2dcb8a4c2da0719aade77c74b69621e3c503` | `c295bdf16ee6e518c4a032236f3e300e0166ec96` |
| `packages/starchess-training/src/__tests__/economicContracts.test.ts` | `43b77694db1b0a2930e0c6982c32b79d228e47611e54fe28909409799c864d0e` | `305d724a2a4824820f34af275426becc360dc189` |
| `packages/starchess-training/src/__tests__/economicWork.test.ts` | `89dd9bc179f2fc0d749179330b9c217ae9915aa6e61fea2728c6e34e21cf67e1` | `3850cce85d8f7f572b24d95dca0d0ba1b846e4c1` |
| `packages/starchess-training/src/__tests__/featureManifestV3.test.ts` | `de26e4c32fd0942cdf6be64ff31414ec1f3ddd56eae8b7733f65b793b9042276` | `96d661cbc65fb4ca302b162d38e3eca0a95be61c` |
