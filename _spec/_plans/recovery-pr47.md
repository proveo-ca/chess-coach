# PR47 recovery — provenance, archive decision and selected rewrite

Status: **PUBLISHED-TIP BACKUP VERIFIED; RECOVERY MATERIAL PRESENT; MEANINGFUL-HISTORY REWRITE / LEASE PUSH SELECTED, NOT EXECUTED HERE. UNFINISHED R4 FOUNDATIONS ARCHIVED; FULL R4 BLOCKED ON INGRESS DECISION. CURRENT POST-COMPATIBILITY / POST-RESTORATION VERIFICATION PENDING.**

This report records supplied actual user decisions and lead/scout findings. Spec-keeper read repository docs/directories and selected active source files, and wrote only REC docs. It ran no Git/GitHub/DB/process command, hash, test, renderer, staging, commit or push. It read no secrets and did not access the inaccessible root store. Do not treat this report as independent Git/hash reproduction, a new approval of frozen contracts or current PR/Main runtime proof.

## 1. Workspaces, PR state and dated evidence

| Item | Actual supplied finding / scope |
|---|---|
| Published PR | GitHub **PR47 OPEN**, base branch **`main`**, head branch **`feat-ml-adjuntant`**. Current supplied head is `46c5106864e985065451abb3d5cf8bcad521e57d`. |
| PR head timestamps | Authored and committed **2026-10-03T16:17:01Z**. This is the published older/precanonical revision, not the full recovered R3 working tree. |
| MAIN working tree | `/home/gu1lty/Projects/proveo/chess-coach`, current supplied PR/head revision `46c51068`. The MAIN filesystem label is not the GitHub base branch's resolved commit ID. |
| REC working tree | `/tmp/opencode/chess-coach-r3-recovered`; last recovered committed base `1f2c232b`, dated **2026-10-07T19:23:58Z**, with subsequent October 8 working changes. |
| Common ancestor | Supplied merge-base prefix **`8e`**; no full object ID is invented here. |
| History divergence | Actual supplied count: **106 REC-only raw commits missing from PR**, **80 published/MAIN-side-only raw commits**. The earlier 78 estimate is superseded by the actual 80 count, not silently retained as correct. These are commit counts, not counts of files or patch groups. |
| Base query | Base branch name `main` is known; the lead's exact GitHub base-tip query/choice remains pending before constructing the rewritten feature history. |

The lead created, pushed and remotely verified:

`backup/feat-ml-adjuntant-20261008-46c51068`

→ `46c5106864e985065451abb3d5cf8bcad521e57d`.

That backup is **actual and retained**. Rewriting the PR feature history, new significant commits, force-with-lease publication and a restored/new PR tip are **not yet claimed complete**. The lead may additionally preserve the 106-commit raw REC history under a separate reachable backup before rewriting; that is a recommended/optional lead step, not an already-created ref.

## 2. Actual decisions and execution-age request

| User decision | Granted scope / current disposition |
|---|---|
| Restore ALL, commit and push PR47 | Explicit restoration/publication direction for the lead. This report is progress documentation; it is not a claim that restoration, commit or push completed. |
| Back up current HEAD; use significant commit names | Published-tip backup above is complete. Significant grouped commits are still a target of the rewrite. |
| **“Rewrite + lease (Recommended)”** | Actual TUI selection authorizes meaningful feature-history reconstruction and force-with-lease **after verification**, retaining the verified backup. It does not permit silently dropping unrelated published-side changes. |
| **“Archive unfinished R4 (Recommended)”** | Actual TUI selection authorizes preserving the eight raw foundation/source-test files in recovery history, keeping active R2/R3 and good pure prerequisites. It waives no HIGH finding and amends no frozen A1/A2/§12 contract. |
| End executions older than one day | The supplied current readonly project-DB check found **no recorded running/pending project task older than 24h**, and the supplied worker-process check found **no worker process older than 24h**. No eligible execution termination is recorded. Do not delete sessions or history. |

The original R4 source instruction remains part of the history, but the later archive decision governs the unsuccessful raw-object foundations. Full R4 work is blocked pending an explicit ingress decision under the unchanged frozen contract. No collection, fitting, calibration, transfer, training, new evidence generation or model/registry activation follows from the rewrite or archive selection.

## 3. Session forensics and byte-identity limits

Session scout `ses_ee538430effeLb2Ln4YsGT6Jtz` checked two accessible project stores with **265 / 261 sessions** and their event sets. The lead/scout verified **31 original current work files from the October 8 session patches**, with exact recorded hashes matched at the recovery checkpoint. The two event sets exposed no additional written code beyond that recovered material. Do not add the two store counts as though they were disjoint unique sessions.

The root store was inaccessible. The search therefore does not prove the absence of all work in every possible store. No secret read, history deletion or invented root-store result is recorded.

The current corrected working set is reported as **42 later corrected changes**. Compatibility repairs, KeyIndex ownership repair and foundation archival intentionally changed the recovered state. **Do not claim every current file is still byte-identical to all 31 original raw files.** The original 31-file/hash recovery finding and the later 42-change correction scope are different checkpoints. Their exact external inventories/hashes belong to the lead/scout; this concern roster is not an invented replacement hash manifest.

## 4. Recovery roster and preservation obligations

| Family | Material to retain / verification boundary |
|---|---|
| Active native R3 source | Core `resolve/provenance*.ts`, Begin/End kernels, vision/ray-scan mutation/query sites, promotion ownership guard, core root exports, counted planning and their tests. Earlier R3 local proof remains attached to its revision. |
| Active pure/host R3 source | Arena `authorized/v1/**`, `authorized/v2/**`, `observations.ts`, `events.ts`, `challenge/r3Projection.ts`, `r3Session.ts`, `r3Private.ts`; retain current compatibility and checked-boundary access. |
| Active candidates / ownership | Training candidates/composition/domain/contracts/identity and V1/V2 traversal tests. `KeyIndex.add` retains an owned byte copy; the five ownership regressions remain active. |
| Active pure prerequisites | Core `/planning-v1` has **21 runtime symbols** after retaining six pure geometry/order/income exports; private `readR3CheckedBoundary` and its tests remain active. These are not an implemented belief/encoder/binding. |
| Source/manifest/audit controls | Preserve root/package manifests, fixed lockfile/workspace declarations, source-inventory/public-closure controls, strict invoice and verification scripts. The build/lead owns actual changed-file reconciliation; spec-keeper modifies none of them. |
| Canonical docs | Preserve the frozen economic bodies, accepted R3 snapshots, [eight-path migration](ml-adjutant-spec-file-migration.md), recipe/weights/traceability and exact review/approval history. Canonical names must not become aliases for older pulled drafts. |
| Active tests | Native provenance/promotion/count tests; pure V1/V2 and real-native boundary/privacy tests; source/public audits; zero-CC standalone V1 compatibility and identity-ownership regressions. Archived R4 tests do not count as active passing implementation. |
| Historical evidence | Existing R0 and R2 published bundles/closure records remain byte-preserved history. Restoring existing historical bytes is not a fresh publication or verification generation; no R2 flags/results are rewritten to fit changed source. |
| Unpublished local diagnostics | `/tmp/opencode/r3-local-verification-I3uWGD` and `/tmp/opencode/r3-spec-render-xaCaZz` retain prior local/report/render scope. They are not a new Docker image or calibration/learning dataset. |
| MAIN-only preservation | Retain `orrery` Gitlink **`e6d6786f9a4b2a4555920329d3490f9ef833634f`** and the MAIN index entry for `_spec/_plans/chess-ui-primitives.puml`, including its coverage. Do not erase those published-side changes by replacing the tree or index wholesale from REC. |

The UI index record must be preserved even if its diagram needs a separate reconciliation; do not remove the record or invent a stub during ML recovery. The missing MAIN R2 evidence at the earlier documentation-only checkpoint is reported as missing context, not proof that a new generation was published. The lead's explicit Restore ALL direction owns any later exact restoration; no completed MAIN/PR source restoration is asserted by this report.

## 5. Exact canonical supersession map

These are the eight actual primary-owner filename mappings retained from the approved migration. They do not change semantic IDs, frozen body definitions, approval identities or runtime permission.

| Historical filename | Canonical filename |
|---|---|
| `ml-adjutant-r1-contracts.md` | [ml-adjutant-r3-contracts.md](ml-adjutant-r3-contracts.md) |
| `ml-adjutant-r1-economic-amendment.md` | [ml-adjutant-r4-economic-amendment.md](ml-adjutant-r4-economic-amendment.md) |
| `ml-adjutant-r1-economic-corrective-annex.md` | [ml-adjutant-r4-economic-corrective-annex.md](ml-adjutant-r4-economic-corrective-annex.md) |
| `ml-adjutant-weights.md` | [ml-adjutant-r4-weights.md](ml-adjutant-r4-weights.md) |
| `ml-adjutant-weight-design-traceability.md` | [ml-adjutant-r4-weight-design-traceability.md](ml-adjutant-r4-weight-design-traceability.md) |
| `ml-adjutant-r1-recipe.md` | [ml-adjutant-r6-recipe.md](ml-adjutant-r6-recipe.md) |
| `ml-adjutant-challenge.md` | [ml-adjutant-r8-challenge.md](ml-adjutant-r8-challenge.md) |
| `ml-adjutant-execution-revisions.md` | [ml-adjutant-r0-execution-revisions.md](ml-adjutant-r0-execution-revisions.md) |

Separately, the older MAIN `ml-adjutant-r2-generator-v3.md` is not the current [r2-generator-v3.md](r2-generator-v3.md) authority. Its five-promotion draft and older selected dependency remain historical. Active generation offers **four promotions `n,b,r,q`**, five deployment units `p,n,b,r,q`, retained CandidateBatchV3/diagnostics B and **512 / 2048 / four-slot** bounds. The canonical scoped SHA selection is `jssha` **3.3.2**, not the older Noble draft. Restore chronology; do not activate an old draft merely because the pulled filename exists.

The canonical R4 family and its contract/dependency/migration docs are present in REC. Their earlier absence from MAIN and MAIN's older same-named roadmap must be handled with the scoped restoration map, not blind overwrite or a claim that MAIN already implements R3/R4.

## 6. Unfinished R4 foundations — archive, not implementation

The lead reports an unresolved HIGH confirmed by the architect session referenced as `ses_eeada7ff…`: portable raw-object own-key enumeration cannot meet the required bounded ingress/validation accounting under frozen **A1/A2 and base §12**. Enumerating unknown raw keys before enforcing the bound cannot be relabeled free, precharged as a constant or hidden in an unmetered cache. This report does not approve an alternative ingress contract.

The actual **“Archive unfinished R4 (Recommended)”** selection preserves these files at:

`_spec/_refactors/pr47-recovery/r4-foundations/packages/starchess-training/src/`

| Archived relative path | Role |
|---|---|
| `economic/contracts.ts` | Draft foundation contracts |
| `economic/float64.ts` | Draft Float64 helpers |
| `economic/schema.ts` | Draft raw-object/schema validation |
| `economic/work.ts` | Draft work accounting |
| `feature/manifest.ts` | Draft feature-manifest foundation |
| `__tests__/economicContracts.test.ts` | Retained draft tests |
| `__tests__/economicWork.test.ts` | Retained draft tests |
| `__tests__/featureManifestV3.test.ts` | Retained draft tests |

The foundation agent owns those eight files and the [archive README](../_refactors/pr47-recovery/r4-foundations/README.md). Spec-keeper read only their directory roster and did not edit the archive or README. Their exact-byte move/identity confirmation belongs to the agent/lead; no independent hash comparison is claimed here. The active economic/feature directories were empty and the three draft test files absent from the active test roster at this inspection.

Earlier **77 PASS** was an intermediate foundation checkpoint. The latest supplied R4 reports are **108 passed / 2 failed** and **198 passed / 2 failed**: both failed. Archive retention neither turns those runs into PASS nor makes the raw foundations active, compatible or complete. There is no active completed material-belief updater/readout, 418 encoder or estimator/host binding supplied by this draft.

Active good prerequisites remain separate: `orderBHeadsFirst`, `incomeForTurn`, `energyForTurn`, `rayBetween`, `attacksSquare`, `getUnitVision`, the 21-symbol pure planning barrel, private checked-boundary accessor and their tests. No raw-object R4 validator or manifest implementation is restored to the model export closure by archiving. Archived `_refactors` material is recovery history, exempt from current-source coverage/reference obligations and excluded from active implementation/test claims.

Full R4 is **BLOCKED PENDING INGRESS DECISION**. The frozen base/annex and historical370/amended418 definitions stay exact. Any design fork needed to make ingress bounded requires its own explicit decision; the archive choice is no HIGH waiver, cap/signature relaxation, fitted model or permission to collect/calibrate/train.

## 7. Proof chronology — what is and is not current

- Earlier recovered R3 local verification **548 core / 85 training / 2359 arena**, types/strict, bounded audits, 54+54 non-learned diagnostics and diagram rendering retains its exact successful scope in the [R3 execution record](ml-adjutant-r3-seam-addendum.md#completed-recovered-local-verification--bounded-r3-only).
- That **2359** suite predates the current compatibility/restoration correction set. It is not the current rewritten/ported-source proof. Preserve its success and all earlier failed/incomplete runs without asserting a new full PASS.
- Latest supplied targeted observations are **251 arena**, **98 V2/R3**, and **five candidate identity-ownership tests**, reported by agents. Standalone zero-CC public V1 compatibility and owned KeyIndex storage are active repairs. Their counts are separate focused scopes; do not sum them into a full-suite result.
- Fresh full post-compatibility/post-archive/post-rewrite suites, types/strict, inventory/public closure, baseline/script checks and closing source/spec review remain required for the final assembled revision. Source-pin/manifest-dependent results must bind that final source, not an older checkpoint.
- No global R5 fresh Docker/hermetic/calibration/readiness, R4 completion, learned pass, model weights or publication of a new evidence generation is claimed.

The active [native provenance](../packages/starchess-core/native-provenance.puml) and [authorized economic boundary](../packages/starchess-arena/authorized-economic-boundaries.puml) diagrams keep their present source citations and concern ownership. The unresolved archived R4 work must not masquerade as a missing active source edge or a shipped-behavior diagram.

## 8. Selected meaningful-history strategy — planned groups only

The exact base-tip query and final group boundaries remain lead-owned. Suggested significant subjects, not created commits:

1. `docs(spec): restore canonical ML contracts and scoped session recovery`
2. `feat(training): restore bounded R2 generation and pure native planning bridge`
3. `fix(assurance): restore R2 controls and preserve published evidence history`
4. `feat(core): add native causal provenance and ownership-safe promotion`
5. `feat(arena): add authorized V2 economics and transactional host verification`
6. `feat(training): add counted history generation and owned candidate identities`
7. `fix(assurance): harden source guards and preserve standalone V1 compatibility`
8. `feat(planning): retain pure geometry and checked-boundary prerequisites`
9. `docs(recovery): archive unfinished R4 foundations without relaxing frozen contracts`

Groups must retain dependency order and meaningful tests/docs. Do not replay all 106 raw commits as though every intermediate revision were releasable, and do not delete the verified raw backup/history. Preserve all unrelated published-side material among the 80 divergent commits, especially the exact orrery Gitlink and UI index record; only the explicitly mapped obsolete ML filenames/drafts receive scoped supersession.

After final assembled-source verification, the selected force-with-lease target is the head branch **`feat-ml-adjuntant`**, with expected old head:

`46c5106864e985065451abb3d5cf8bcad521e57d`.

The lead must recheck that remote expectation and retained backup before publication. A changed remote head must fail the lease and stop for a new preservation/verification decision; do not fall back to an unconditional force. No new commit ID, rewritten history, completed MAIN restoration or lease push is recorded yet.

## 9. Outstanding handoff

Finish archive byte-identity/active-roster confirmation with the owning agent; preserve a raw REC history backup if the lead chooses; resolve the exact GitHub base object; assemble significant groups while retaining MAIN-only material; verify the final current source/manifests/tests/spec links and untouched protected bodies/evidence; then perform the user-selected rewrite/lease publication under the lead's authority. Confirm the resulting PR head after publication before claiming restoration complete.

The requested old-execution check found no eligible old project task/worker in the accessible checks; do not fabricate a termination or delete session history. The inaccessible root store remains a stated limit, not a target for secret reads.

Current state: **REC recovery documentation updated; current source verification and rewrite/publication pending. FULL R4 BLOCKED, RAW FOUNDATIONS ARCHIVE-ONLY.**
