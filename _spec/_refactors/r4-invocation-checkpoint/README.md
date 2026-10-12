# R4 invocation checkpoint — prototype quarantine

**Status: WIP / PROTOTYPE QUARANTINED / NOT R4 ACCEPTANCE / known RED regressions.** Architect approved exact preservation plus scoped restoration instead of leaving unsafe prototype paths active. This directory preserves the rejected implementation and its findings; it does not resolve them or approve execution.

Related goals: [finite invocation plan](../../_plans/r4-finite-invocation-resolution.md) and [invocation/effect diagram](../../packages/starchess-arena/invocation-effect-analysis.puml). Existing prerequisites remain in the [authority chain](../../_plans/ml-adjutant-r4-authority-chain.md) and [HOST/SBX history](../../_plans/ml-adjutant-r4-host-delegation.md).

## Archive identity and scope

The preserved bytes are [sourceInventory.ts.snapshot](sourceInventory.ts.snapshot), with metadata in [integrity.json](integrity.json). The manifest records:

| Field | Recorded value |
|---|---|
| Original source path | `packages/starchess-arena/src/challenge/sourceInventory.ts` |
| Baseline commit | `e68c1b2bdd74eda116e65d360f2ce9c57182c34e` |
| Snapshot byte length | `233891` |
| Snapshot SHA-256 | `59dc02915146133f69ac8252e0c86151dff51b0298e1046631f3bbaf3abae82a` |
| archiveOnly | `true` |

Do not modify the raw snapshot or integrity manifest in this documentation pass. Do not compile, import, load or execute the snapshot as an auditor. Frozen historical snapshots are coverage-exempt; the active goal diagram retains its existing seven source/test covers, with no archive cover added. Archive metadata grants no image, source seal, B1, ledger, permit, dispatch or runtime authority.

Keeper read archived ranges to confirm the anchors below and read the manifest fields. Keeper ran no command, test, render, hash or Git operation and did not inspect active source. Executable outcomes and active-byte equivalence below are supplied lead/owner reports, not keeper recomputation.

## Scoped restoration — not an acceptance repair

Owner reports active `sourceInventory.ts` SHA-256 `0959221fdd5888bf002a3c33cc29c4d67057ab9270d6d294bbb8d8a26508e9fe`. Owner reports baseline equivalence when the comparison removes **only** the SPEC pointer, retained literalArrayRoute/safeArraySelector definitions and their computed-key guard. This is the scoped comparison, not a claim that the unnormalized active file is byte-identical to baseline.

Owner reports restoration and refreeze completed. No new invocation graph, SourceRef/ValueRef migration or native-grounding implementation remains installed in active inventory source. Complete SCC/source/value/frame/return/native-effect contracts remain **PLANNED future work in both auditors**. Public source retains its original resolver plus selector/callable-alternative/discard-proof guards; restoration changed no public bytes, new tests or fixtures. RED tests remain enabled.

Only the introduced active prototype paths were removed by this remediation. Their removal does not establish baseline soundness, resolve retained public/key-guard debt or discharge the future design obligations. Completed adversarial/security code reviews permit the bounded WIP code checkpoint, not actual admission. Backend checkpoint-boundary review and the final documentation review/render rechecks remain pending; the full arena invoice and code-diff reviews are complete.

## Exact prototype invoice — archived, not current production proof

Lead reports the fresh five-file prototype invoice below, with **no source drift**. Do not substitute these counts for post-restoration results.

| Prototype scope | Supplied result |
|---|---|
| Complete five-file invoice | **1617 total /1407 PASS /210 FAIL /0 pending** |
| Legacy slice | **1419 total /1246 PASS /173 FAIL**, attributed to eager new native-guard preemptions |
| Selectors | **32 PASS** |
| Invocation | **46 PASS** |
| Inventory callback grounding | **24 PASS /3 RED** |
| Public invocation | **59 PASS /34 RED** |
| Package types | **All3 PASS** |
| Tooling | **69 PASS** |
| Public roots | **Five-root PASS**, not seven-root/B1 proof |
| Budget CLI | **Exit2**, not acceptance |

The retained public result is93 tests /59 PASS /34 FAIL /0 pending /exit1. Its JSON is `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-checkpoint-v060pvvb/public-tests.json`; lead also retained stdout/stderr/exit artifacts. Unchanged public bytes do not turn that execution into a fresh post-restoration run.

Earlier mechanical checkpoints remain historical: finite invocation46 PASS, selectors16 PASS, grounding14 PASS/13 RED and2 legacy R3 RED. The plan retains the earlier inventory26/29, removed-prototype30 matrix14 PASS/16 FAIL, computed first6 RED/10 PASS, public32/33 comparator rejection, inventory legacy414 PASS/2 RED and prior32/31/21 scopes. Preserve each revision separately; do not combine passing counts or erase failing observations.

## Retained adversarial findings

Supplied adversarial review session: `ses_ed2d919feffeiQJTbmlkpCy06A`. The source anchors below refer **only** to the exact archived `sourceInventory.ts.snapshot`, not restored active line numbers. Keeper confirmed the named code locations; the supplied review's static witnesses were not executed admissions or additional test counts.

| Severity | Retained finding | Exact archived source anchors |
|---|---|---|
| HIGH | Eager native receiver rejection preempted ordinary untouched-batch paths. | [snapshot:1794–1804](sourceInventory.ts.snapshot#L1794-L1804), [snapshot:1875–1877](sourceInventory.ts.snapshot#L1875-L1877), [snapshot:2198–2205](sourceInventory.ts.snapshot#L2198-L2205) |
| HIGH | Invoked symbolic function values could appear grounded without a proved call target. | [snapshot:1864–1866](sourceInventory.ts.snapshot#L1864-L1866), [snapshot:2083–2098](sourceInventory.ts.snapshot#L2083-L2098) |
| HIGH | nativeIncoming preempted ordinary incoming calls and export/escape obligations. | [snapshot:1751–1756](sourceInventory.ts.snapshot#L1751-L1756), [snapshot:1947–1975](sourceInventory.ts.snapshot#L1947-L1975) |
| HIGH | filter/sort returned the first receiver and dropped alternative receiver provenance. | [snapshot:1823–1825](sourceInventory.ts.snapshot#L1823-L1825) |
| HIGH | Native callback handling omitted destructuring-default taint before continuing past ordinary default handling. | [snapshot:2216–2237](sourceInventory.ts.snapshot#L2216-L2237) |
| HIGH | Native callback thisArg writes were omitted from mutation propagation. | [snapshot:1693–1702](sourceInventory.ts.snapshot#L1693-L1702), [snapshot:1806–1817](sourceInventory.ts.snapshot#L1806-L1817), [snapshot:2216–2222](sourceInventory.ts.snapshot#L2216-L2222) |
| MEDIUM | Mixed array/callable branches used an existential literal-array guard rather than complete alternative proof. | [snapshot:2456–2466](sourceInventory.ts.snapshot#L2456-L2466) |

The introduced graph/native paths are removed from active inventory source according to the restoration report. These findings remain preserved, not marked resolved by archival. Final adversarial review in the same session reports no introduced active blockers and all six HIGH paths quarantined. It classifies mixed-array/callable MEDIUM debt as baseline, not a new regression; the narrow computed-key guard remains active. Its verdict is **bounded WIP publish YES /READY TO MERGE yes**, not actual admission or resolution of the algorithm.

## Retained security findings

Prototype inventory security session: `ses_ed2d8db33ffeu4x5CL5qe29TtB`. The supplied prototype review retained the three HIGH themes of callable elements without call-target proof, first-receiver loss and thisArg effects, plus the native/ordinary-incoming gap. Their archived anchors are respectively1864–1866/2083–2098,1823–1825,1693–1702/1806–1817/2216–2222 and1947–1975 above. These are static unexecuted witnesses, not new proof counts. Quarantine removes introduced active paths; it does not convert the witnesses into passing negative tests or establish restored-source safety.

The completed post-restoration inventory security rereview in that session reports **checkpoint code gate YES /introduced new HIGH none /actual admission NO**. It reviewed both auditors, all checkpoint test files and archive documentation. Baseline HIGH annotation-derived numeric evidence and single-expected-target callback loss remain. The rereview was static and ran no independent tests. Final metadata review after this documentation update remains pending, not the completed code-diff gate.

Public security session: `ses_ed2dd60dbffehWPBvsNmm8aI7s`. The supplied review reports existing HIGH selector annotation/source-grounding unsoundness and baseline conditional-callback loss in `packages/starchess-arena/hermetic/public-closure.mjs`. It identified no delta-specific new HIGH regression. That result does **not** approve actual admission or resolve the existing HIGHs. This inventory-only archive contains no public snapshot; no public line numbers or executed witness results were supplied here, so none are invented.

## Current post-restoration checkpoint — DONE WITH FAILURES

Lead reports the completed fresh **UNFILTERED arena** invoice: **2625 total /2315 PASS /71 FAIL /239 pending**, across41 files and104 raw logical suites, actual child exit1 and **no source drift**. Do not infer a file-status split from the logical suites. The report is `r4-checkpoint-v060pvvb/restored-arena-tests.json` in the retained checkpoint directory, alongside stdout/stderr/exit and restored-source start/end JSON receipts.

| Current owner scope — same unfiltered run | Supplied result |
|---|---|
| computed selectors | **32 PASS** |
| public invocation | **59 PASS /34 FAIL** |
| inventory callback grounding | **15 PASS /12 FAIL** |
| inventory invocation | **25 PASS /21 FAIL** |
| legacy challengeSourceInventory | **1419 total /1417 PASS /2 FAIL** |

The new owners contribute67 failed assertions:34+12+21. The other4 failures are3 R3 expected[index]/wrapper16 failures and1 unclassified stack-trace failure, for the full71. The legacy R3 host-private capture assertion reports **Error /STACK_TRACE_ERROR /duration5771.199248**; the report does not explicitly classify it as a timeout, so its cause remains unknown here. The other legacy failure is the real-repository R3 expected[index]/wrapper16 error. ContractCoverage and challengeSuites each retain1 R3 wrapper failure. challengeEvidenceImport retains1 FAILED IMPORT with that wrapper error and239 pending tests; its import diagnostic is not an extra failed assertion beyond71. No failed or pending test is waived, disabled or promoted.

| Other current post-restoration validation | Supplied result |
|---|---|
| source-inventory CLI | **Exit1**, first R3 expected[index] failure |
| public roots | **Five-root PASS /exit0**, not seven-root/B1 proof |
| package types | **All3 PASS /exit0** |
| acceptance CLI `--stage full --mode accept` | **Exit2 /BLOCKED /NOT_ESTABLISHED /zero spawned commands**, from `accept-refusal.json` |
| budget | **Exit2**, infeasible/complete adequacy unproven |
| tooling | Earlier **69 PASS**, unchanged-tooling scope; no new tooling-suite execution claimed |

Lead verified12 audited production source files exactly unchanged from HEAD and the historical bundle57. Lead reports exact seven-path index/SPEC pointers PASS with prior index entry payloads preserved. Lead directly checked staged archive bytes' SHA against the integrity manifest. These are lead validations, not keeper Git/hash operations; source/tests/raw snapshot/integrity/index remain unchanged in this final documentation pass.

Lead completed final check-only and SVG rendering, producing temporary `invocation-effect-analysis.svg`. Final adversarial and security documentation reviews approve bounded WIP publication with no introduced HIGH/BLOCKER. Additional backend checkpoint-boundary advice remains pending and supplies no acceptance evidence. These gates accept a bounded WIP checkpoint, not actual admission, complete source proof or runtime authority.

Lead explicitly skipped **NEW unfiltered core/training suites and a NEW46-command full HOST diagnostic rerun** for the incomplete checkpoint already blocked by the fresh unfiltered arena/cap. Earlier full counts retain their older revision scopes and are not reused as current proof. This recorded skip is not an acceptance waiver. No further feature work or excluded operation is authorized.

## Remaining R4 — future acceptance work

The [current remaining-R4 checklist](../../_plans/r4-finite-invocation-resolution.md#remaining-r4--acceptance-gates-remain-open) retains:

- Raw14-candidate quote1069888 against cap1048576 and max512 schedule store quotes13841600 before remaining work; complete disjoint budget adequacy is unproven.
- Complete independent auditors, including recursion, returns, primitive evidence from actual source rather than annotations, every callable alternative and all native/receiver/argument effects.
- B1 createPlanningLedger/LedgerPair/LedgerOwner restrictions and atomic `/features` + inference `/artifacts` closure across all seven roots.
- Immutable image/runtime/tool/config loading identities, local and continuing seals, same-graph genuine dispatch and the installed native/fflate acquisition block.
- A genuine cold path through permits, bound models, hosted A2, independent parent verification and ACK.
- Future full accepted pipeline verification after retained REDs are repaired; current full arena/types/code/documentation gates are completed, not acceptance. Additional backend advice remains pending; acceptance CLI exits2/BLOCKED/NOT_ESTABLISHED with zero spawned commands.
- Weights **NONE** and machine learning unavailable; no training, calibration, data collection or data-ops authorization.
