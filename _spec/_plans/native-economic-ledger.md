# Native economic ledger — current scope and acceptance

**2026-10-18 · BOUNDED LEDGER VERIFICATION/REVIEW COMPLETE · CURRENT258d GATE PASS:29 COMMANDS / RUST301 / NODE175 / CORE668 · ALL3 CURRENT REVIEWS READY / NO FINDINGS · LEDGER-ADV-4 RESOLVED · FOLLOW-UP PUBLICATION AUTHORIZED, NOT EXECUTED · trainingReady:false · F1 FUTURE.**

Executor selected **Ledger first**, then **Revise v1 in place** for the unfinished economic schema.
This plan owns delivery and forward acceptance; [detailed design](../ml/native-economic-ledger.md) owns the contract, accounting, privacy, resource bounds and terminal-closeout reasoning.
The current receipt was read for this evidence-only update; the lead executed the gate. This Markdown pass runs no commands or verification and changes no contract/source/diagram/index inputs.

## 1. Baseline and authority boundary

- Revise the same `arena-economic-v1`, `arena-economic-rules-v1`, `arena-economic-boundary-v1` and `arena-economic-report-v1` IDs/files together. This is breaking unfinished WIP, **not backward compatibility**, a legacy parser or a parallel economic-v2 path.
- Preserve existing **arena-engine-v1/v2**, live mutation/replay, native rules/UI, RunRecord bytes, baseline reports/selectors/seeding, dependencies, frozen 418/D+B contracts, pins, protected corpora/evidence and the six-owner graph/status files. Economic-v1 revision authority does not widen any protected legacy contract.
- The user personally published **4990d951034632d68307d3bb06c9d99e68b60da3**, `feat: economic ledgers & training prep`,39 files, parent `df968b5c33b432a3901f8cb91296b06deb394230`. That publication is not all-closing approval; do not amend/rebase it or claim these later changes in it. No later commit/push is supplied.
- [Native runner](../ml/native-runner.md) remains the frozen baseline proof owner. Baseline N1–N3 closure does not close separate legacy R4 N1–N7/M2, inventory or resource/public-closure stops.
- Future **Training-ready** and **Offline local capture** authority remains bounded by §9. Current `trainingReady:false` is unchanged.

## 2. Selected delivery and exclusions

| Deliver | Do not claim or change |
|---|---|
| Native-derived rules, public nominal entitlement and exact own receipts/lineage. | No Rust-authored native rule authority or hidden enemy bank/population/paid-basis estimator. |
| Authorized calculated / seen / witnessed enemy destruction / own lost reports. | No production posterior/PMF, frozen418 encoder parity or padded feature-completion claim. |
| One independent native-consequence reconstruction of existing records. | No policy regeneration or `VerifiedRun`; existing `arena replay` owns native+policy verification. |
| Strict transactional histories, explicit native origin modes and scoped diagnostics. | No inference/default/compatibility rescue for missing origin facts or failed tails. |
| Host-only terminal training closeout. | No raw-income rollback, resource reward shaping, terminal bootstrap, frozen-label change or measured bias-reduction claim. |
| Persisted controls and existing-owner spec integration. | No legacy production/test-module oracle import, new owner/module or protected corpus/evidence rewrite. |

<a id="3-accepted-architect-v2-delivery-and-file-allocation"></a>
## 3. Current in-place v1 contract and file allocation

`arena ledger --record <file>` runs **one** fixed `worker-economic.ts` process and independent native-consequence reconstruction, never `replay_record` or policy-choice verification.
The report states `policyVerification:not-executed`.

### Explicit origin-mode freeze

| Effect | Required field | Value rule |
|---|---|---|
| `unit-born` | `mode` | `tank\|siege` iff `type:r`; explicit null for non-rook. |
| `unit-transformed` | `toMode` | `tank\|siege` iff `toType:r`; explicit null otherwise. |

Absent keys reject even where null is valid. Preserve closed objects, duplicate/unknown-key rejection and exact canonical bytes.

- **Birth:** copy the recipient-owned native `create.entity.tankMode` for a rook; never derive it from the predecessor's ownership or final authorized geometry.
- **Transformation:** bind the actual native OWN same-entity trace. Take the first subsequent actual mode-change `before`; otherwise actual death entity mode; otherwise the unique matching native frame-after entity mode. Validate every subsequent mode-change continuation and the final death/frame anchor **after** those changes. Never cross entities to infer chronology.
- **Rust:** install explicit `mode`/`to_mode`, validate exact before-mode continuity and retain exact current mode at destruction, including transient birth/promotion then death. Use complete `afterOwn` **only for reconciliation** after all effects.
- No Tank default, postimage-origin inference, unresolved-mode state, constrained branch, ambiguity-refusal substitute or dual-version fallback implements this contract. Actual malformed/contradictory native traces still fail closed.
- Promotion preserves native identity and paid basis and creates no mineral debit. New deployments mint new recipient-local IDs and bind their actual payment.

| Existing owner | Files / responsibility |
|---|---|
| Rust shared contract/history/work | `packages/training/src/ledger/{mod,contracts,history,work}.rs` |
| Rust controls/shared fixture | `packages/training/tests/{ledger_contracts,ledger_history}.rs`, `tests/fixtures/ledger-boundaries.json` |
| Node wire/native reconstruction/projection/worker | `apps/arena/engine/{economic-wire,economic-replay,economic-project,worker-economic}.ts` |
| Node controls | `apps/arena/engine/test/{economic-project,economic-replay,worker-economic}.test.ts` |
| Host/client/transport | `apps/arena/src/{economic,economic_client,worker_transport}.rs`; unchanged-wire `engine_v2.rs` integration and CLI/module wiring |
| Host controls | `apps/arena/tests/{economic_replay,readiness}.rs`, `apps/arena/tests/support/economic.rs` |
| Diagrams | Existing [training](../packages/training/burn-compat.puml) / [arena](../apps/arena/burn-compat.puml), exact covers30/54; no new files/index coverage/shared-golden rewrite |

Node reconstructs from fixed native fixtures/admitted queues, compares every recorded native fact, and filters recipient facts before contiguous sequence allocation. It publishes own locators, not durable IDs, private masks or paid-basis arithmetic.
Rust resolves whole immutable preimages plus same-group births, stages all effects, reconciles final geometry and commits both recipients atomically.
Only complete terminal/window-limit reconstruction, conserved ledgers and clean exit construct private `VerifiedEconomicRun`; checked public `LedgerPair` alone is not native authority.
Exact operation envelopes/nullability are in [detailed §5.2](../ml/native-economic-ledger.md#52-fixed-protocol-and-file-responsibilities).

### 3.1 Completed shared API and frozen history interface

Contract entrypoints remain `LedgerRules::validate`, `EconomicBoundary::validate`, `decode_boundary`, `canonical_boundary_bytes` and `OwnGeometry::from_snapshot`, each carrying the existing work accounting.
`LedgerPair::initialize`, immutable `advance`, `reports`, `rules` and `last_boundaries` use shared `Pair<T>` and private checked state.
Retain only the last pair's full canonical bytes: identical current delivery is charged/idempotent, conflicting current delivery rejects, older pairs reject `SEQUENCE`. Never retain a whole episode or use a digest-only key.
Reject distinct successors at `last.turn >= rules.max_turn`, while preserving charged identical-current duplication even at initial45/custom-max1.
All generic `Pair<Option<T>>` keys remain required, including null/nested cases.
Report roots and nested accounting are in [detailed §6.2](../ml/native-economic-ledger.md#62-actual-shared-contract-api-and-lead-frozen-history-api).

Each reconstructed window shares **one inclusive1048576 meter and one absolute10-second deadline across both recipients**. First transaction includes initial+open+settle; later transactions open+settle; only a new window resets either allowance.
Remove obsolete rook-inheritance scratch/pre-scan and its extra2-per-fact reservation. Shared constants and other applications stay unchanged; existing byte/canonical fees cover the added fields.
Shared fees: byte/table1, cell/unit/mine8, action/fact16, group8, boundary64, rules32+tables, canonical byte3+boundary traversal.
History fees remain base128/cell16/memory32/item192/report320/profile64+8 per entry/identityByte1/fact64/action192/geometry32/lookup2/arithmetic32. Failed work is never refunded.
Host chronology charges64/event and16/seat grant match; terminal accounting/projection160 uses that same transaction meter.

Private native producer caps remain **1152 total effects /70 entities /16 MiB native data**, with finite checks, bounded per-frame maps and same-entity lists. Forward transform scans may repeat under that existing effect ceiling and absolute10-second deadline, with time checks during scans. There is **no8-transform cap**, new Node logical fee table or new meter.
Node has no new logical fee table/meter. Keep2048 public groups/entries,64 vision changes,1-MiB replies,64-KiB requests/stderr and16-MiB record/report bounds.
Keep the fixed worker/cwd/scrubbed environment, one outstanding correlated increasing u32 request ID, no shell/eval/caller paths/retry, and **one300-second lifecycle including3-second cleanup**.

<a id="32-terminal-training-closeout--source-contract-pre-repair-proof-retained"></a>
<a id="32-terminal-training-closeout--source-present-whole-gate-proof-pending"></a>
### 3.2 Terminal training closeout

Preserve host-private `terminal_training_closeout(&VerifiedEconomicRun)->Option<TerminalTrainingCloseout>`, `NativeChronology` and `CheckedTerminalAccounting`.
Report `terminalTrainingCloseout` remains REQUIRED NULLABLE. Its object version is `arena-terminal-training-closeout-v1`, with `terminalPhase:initial|begin|end`, required-nullable `excludedReceipt{grantOrdinal,sourcePlanningOrdinal,settledTurn,reason}`, per-seat `{excludedMineralCredit,eligibleMineralCredits,trainingClosingBank}`, `terminalGasRefillEligible:false`, `usableGas:{w:0,b:0}`.

- Only a complete verified **native terminal** with checked receipt/phase chronology and clean exit yields Some. Window limits/planning, rejection, failed/unknown prefixes yield None.
- Direct terminal end excludes that actual settlement credit; fatal following begin excludes only its matching preceding credit whose intent never opened. Bind the exact receipt even at zero credit.
- Initial terminal excludes no receipt and preserves endowment. A passed matching begin releases its preceding credit before features; never exclude an older usable grant.
- Checked math: `eligibleMineralCredits = rawActualCredits - excludedActualCredit`; `trainingClosingBank = rawClosingBank - excludedActualCredit`.
- Zero usable gas means no terminal intent budget, not a refund. Raw native gas/grants/history/paid basis stay unchanged.
- Keep closeout outside `AuthorizedFeatureHistory`, WDL-only±1/0 rewards, frozen D+B labels, calibration and terminal bootstrap. No learner or measured bias reduction follows.

Required following-check example: turn9/bank3 settles at10 with credit1/raw bank4; fatal begin at raw11 gives training bank3, **not2 from tier11**.
Full schema/private proof and raw-preservation distinctions remain in [detailed §7.3](../ml/native-economic-ledger.md#73-host-only-terminal-training-closeout).

## 4. Required economic acceptance

| ID | Invariant; corrected-source gate PASS in §8, resolving reviews pending |
|---|---|
| E1 · native authority | Native helpers construct rules/tables; Rust validates bounded facts, never a second authoritative formula. Default opening3, cap12, native unit costs including k1 stay unchanged. |
| E2 · origin | Support unchanged tiny/standard/all-actors fixtures. Origin is record-initial-forward; endowed pieces basis0 and actual fixture bank, no invented prior purchases/grants. |
| E3 · clocks | Initial counters0/groups empty. Window k open has planning/grant k; settlement advances to k+1 while admitted action refs retain k. Allocate recipient sequences after filtering hidden empty groups. |
| E4 · income/gas | Actual settlement grants once even at cap/zero credit or terminal end. Nominal tiers1/2/3 apply equally; actual credit may differ. End gas0; next playable open refills updated carried capacity, never additive wealth. |
| E5 · conservation | `originBank + actualCredits - paidDebits = ownBank`; `paidDebits = survivingPaid + destroyedPaid + wastedPaid`. One native deployment disposition per accepted payment; free promotion retains basis. |
| E6 · authorized knowledge | Current cells versus timestamped memory, not a unique enemy population. Native mine multiset cap3 preserves duplicate squares. No hidden global IDs/masks/resources leak. |
| E7 · captures/losses | Require actual causal destruction witness, not fog disappearance. Nullable ownActionRef is source action, not killer ownership. Separate exact paid loss, replacement, waste and CC lives; ordinary king replacement0. |
| E8 · explicit modes | Required native-own birth.mode/transform.toMode, exact same-entity continuity and transient loss mode; complete afterOwn is reconciliation only. |
| E9 · atomicity | Charged immediate duplicate rule, horizon guard, immutable preimage+birth resolution and both-seat atomic publication. Rejection grants/debits nothing; failed tails retain only checked prefixes. |
| E10 · assurance | Scoped computed checks and private complete-run capability, not serialized readiness flags. NON_ADMITTED/learned:false/modelArtifact:null/trainingReady:false/policyVerification:not-executed. |
| E11 · bounds | Existing fees/caps, shared1048576/10s transaction and300s lifecycle, no resets/chunks/dropped facts or arbitrary capacity increases. Logical counters do not prove runtime adequacy. |
| E12 · closeout | Exact private receipt chronology/math/nullability and unchanged raw grants/history/rewards/labels; no terminal intent budget or authority grant. |

### 4.1 NORMAL SETTLEMENTS — public thresholds at turns 1, 11 and 21

| Normal playable turns | Actual nonterminal crossing | Nominal minerals White / Black | Next gas capacity per seat |
|---|---|---|---|
| **1–10** | **0→1** | **1 /1** | **1** |
| **11–20** | **10→11** | **2 /2** | **2** |
| **21–45** | **20→21** | **3 /3** | **3** |

Initialization is endowment, not a grant. Actual capped credits may differ or be zero; each settlement still advances grantOrdinal once.
Settlement updates capacity and ends with available gas0; the following playable open refills it. Turn21 fixture initialization cannot replace the20→21 grant test.
Game-ending native begin counters/raw gas are separate [Appendix A](../ml/native-economic-ledger.md#appendix-a-regression-only-game-ending-native-turn-start) cases, **not** next-playable-turn entitlements.

<a id="5-persisted-test-obligations--planned-not-executed"></a>
<a id="5-persisted-test-obligations--whole-gate-pending"></a>
<a id="5-persisted-test-obligations--whole-gate-pass"></a>
<a id="5-persisted-test-obligations--pre-repair-pass-retained-fresh-gate-pending"></a>
## 5. Persisted test obligations

The complete current258d gate ran the required targets unfiltered: Rust301, Node175 and core668. These remain retained obligations, not permission to borrow a prior leaf or waive resolving reviews.

| Suite/concern | Required retained/new controls |
|---|---|
| Strict schema | Rook tank/siege and non-rook explicit null for both fields; missing/null/type/tag/unknown/duplicate/array negatives; nested required Pair keys; complete canonical identity. |
| Native projection | Own/enemy/empty predecessor births; marked/unmarked native promotion to rook; same-entity trace first-mode-before/death/frame anchors; multiple mode changes; transient birth/transform/death; contradictory/cross-entity anchors; hidden-twin authorized byte identity. |
| Rust history | Direct origin values; exact before-mode continuity; paid/endowed/free promotion; exact transient destruction mode; immutable swaps/replacements; wrong/retired subjects; contradiction rollback; atomic cap/replay behavior. |
| Actual host | Retain actual full-native-journal HIGH-4 RED, require corrected GREEN after Node handoff; compare native/raw/EOF truth before fold and complete final agreement. Targeted RED is not unfiltered suite proof. |
| Defaults/time | Actual native default opening and all fixed fixtures;45-window uniform pass/pass;0→1/10→11/20→21 both-seat grants/capacities;9→10/44→45/cap asymmetry/zero-credit/horizon controls. |
| Accounting/privacy | Paid materialized/wasted/immediate death, promotion basis, separate CC lives; mine multiplicity; timestamped memory; transient causal visibility/consumed proof, source-action witness/null, no hidden death/probe leak. |
| Transactions/transport | Charged duplicates/current conflicts/old SEQUENCE, stale/foreign/order tamper, before-work charging, no refund/reset, both-seat rollback; strict framing/IDs/UTF-8/EOF/byte/deadline/reap failures. |
| Capabilities/closeout | Complete terminal/window-limit vs failed prefix/rejection; exact direct/following/initial/zero-credit/released receipt; planning/window/prefix nullability; raw-history/feature/WDL/D+B isolation. Node native and Rust synthetic proof scopes stay distinct. |
| Preservation/integration | All existing assertions, fixed protocols/native engine/dependencies/legacy graph/status/frozen docs/pins/corpora/evidence; required Rust/Node/core targets nonempty/unfiltered; both owner syntax/bounded SVG and note-box checks. |

## 6. Implementation order and reviewer lock

1. Shared fields/strict contract controls: **DONE**, with required nullable semantics.
2. Rust history consumer: **DONE**, supplied unfilteredtraining165/contracts42/history49, all-targets check/Clippy-Dwarnings/owned fmt PASS. No inference scratch/pre-scan remains.
3. Node producer/three economic test consumers: **DONE**, supplied unfilteredNode175/types/warnings-denied lint PASS. Native-own same-entity origin/continuation/endpoint checks run before public sorting; repeated forward scans stay under existing bounds/deadline.
4. Host all-targets leaf: **DONE**, lead-executed unfilteredarena106 PASS, including both actual own/enemy Siege-replacement native journals and retained full-record/closeout/replay controls. This is not the complete root gate.
5. All code/spec handoffs and lead preflight are DONE; source/configuration/tests/index/diagrams were FROZEN before the complete gate. No such input changed after it.
6. Lead-executed `cargo xtask check` **DONE/PASS** (`sh_14d22f3bb001z0KzLRlx3wHIG2`): all29 static/build/dependency, unfiltered Rust+Node+core, required-target, preservation, coverage/index, both checkonly/bounded-SVG and whitespace results PASS with identical before/after258d identity. Separate lead note/navigation preflight also PASS; it is not an extra invoice command.
7. **ALL3 fresh current258d rereviews DONE/READY**, findings NONE; adversarial explicitly RESOLVES HIGH-4 and security completed all16 paths/HEAD-diff scope inspection. Bounded NON_ADMITTED ledger/terminal-closeout verification and review are COMPLETE. Any subsequent source/configuration/test/index/diagram change requires the complete gate again before rereview. Markdown-only evidence/status edits preserve verified inputs and require fresh whitespace/preservation checks.

**Reviewers are FORBIDDEN until the complete unchanged-input gate passes.** No leaf counts, old receipts, static consultation, earlier approval or user publication waive HIGH-4.
The actual current PASS satisfied that lock for the completed fresh rereviews, not for future changed input.

<a id="7-current-gate-ledger--source-repairsleaf-green-whole-result--rereviews-pending"></a>
## 7. Current gate and closing status

| Item | Current disposition |
|---|---|
| Decision/freeze | User-selected breaking in-place v1, final architect explicit-origin freeze DONE; no pending schema-choice TUI. |
| Shared fields | Rust contracts/contract tests +Node wire DONE; pre-schema JSON RED4 fail/2 pass retained; now covered by training contract42 GREEN. |
| Rust history | DONE; current whole-gate Rust301 includes training165/history49/contracts42, with all-targets check/Clippy-Dwarnings/fmt PASS. |
| Node producer | Current whole-gate unfilteredNode175/types/warnings-denied lint PASS, including actual cross-owner/promotion/privacy controls. |
| Native HIGH-4/host | Repaired own/enemy native-journal replacements GREEN within whole-gate arena106, preserving raw bytes/normal EOF/conservation. Earlier targeted RED is regression evidence, not current status. |
| Full gate/reviews | Complete29-command gate PASS at258d; reviewEligible:true. ALL3 current resolving reviews DONE/READY, findings NONE; HIGH-4 explicitly RESOLVED. Security scope inspection complete; no old approval is borrowed. |
| Coverage/readability | Whole-gate covers30/54 and baseline43-entry preservation PASS; both syntax/bounded SVG PASS. Separate preflight22 notes PASS,2–5 lines/max46 columns, note bodies unchanged; navigation suffixes byte-exact. |
| Current proof | Receipt PRESENT/read,29/29 PASS, Rust301=arena106+training165+xtask30 /Node175 /core668; identical before/after258d hash. |
| Tools/publication | Pinned-tool version checks PASS within the gate; user4990d951 publication stands. Current16-file follow-up publication AUTHORIZED but not executed, awaiting final metadata checks/current-input join and actual commit/non-force push. |
| Readiness/F1 | Bounded ledger verification/review COMPLETE, NON_ADMITTED/trainingReady:false. F1 freeze DONE/implementation FUTURE only after actual repair publication and separate assignment. |

<a id="8-historical-pre-repair-gate-and-actual-blocked-closing-cycle"></a>
<a id="81-actual-findings-and-repair-lock"></a>
<a id="82-observed-post-repair-whole-pass--current-source-join-raw-artifacts-unavailable"></a>
<a id="82-observed-post-repair-whole-pass--source-join-checkpoint-raw-artifacts-unavailable"></a>
<a id="83-post-repair-closing-rereviews--two-approvals-adversarial-pending"></a>
<a id="83-post-repair-closing-rereviews--actual-new-adverse-result"></a>
<a id="new-ledger-adv-4--high-reported-static-counterexample--native-repro-pending"></a>
<a id="new-ledger-adv-4--high-actual-native-producer-repro--rust-fix-pending"></a>
<a id="84-user-performed-publication--not-final-closing-acceptance"></a>
<a id="8-current-evidence-limits-and-open-high"></a>
<a id="8-current-complete-gate-and-pending-closing"></a>
## 8. Current complete gate and closing approval

Actual lead execution **sh_14d22f3bb001z0KzLRlx3wHIG2 DONE/PASS**; [current receipt.json](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-20315-1792295503171478138-0/receipt.json) is **PRESENT and was read**, not reconstructed evidence.
Version/scope are `rust-training-verification-v3` / `native-economic-ledger`; status PASS, reviewEligible:true, error:null, identityError:null. All29 results are PASS/exit0/reaped, with no timeout/signal/cleanup failure.

```text
inputSha256 == inputSha256After ==
258d4126e0641365f53b173a3415674412b095c6500238b0fafb0e0f446eb76e
```

| Current unfiltered proof | Actual PASS count |
|---|---|
| Rust workspace/all targets |301 = arena106 +training165 +xtask30 |
| Node engine |175 |
| Native core |668 |
| Required nonempty Rust targets |ledger_contracts42 /ledger_history49 /economic_replay9 /readiness4 |

Static/types/lint/fmt/check/Clippy-Dwarnings/build/selected CPU dependencies, tracked/untracked preservation before/after, baseline43/index and covers30/54 preservation, both PlantUML syntax/bounded SVG jobs and receipt-time whitespace all PASS in that one unchanged-input run. Counts are not stitched leaves.
Separate lead preflight PASS:22 note boxes,2–5 lines/max46 columns, unchanged note bodies and byte-exact PLAN suffix4+ /README first2+suffix6+. These checks are **outside** the fixed29-command invoice.
The native HIGH-4 counterexample's actual RED→corrected native-journal GREEN remains useful regression reasoning; current adversarial review explicitly **RESOLVES LEDGER-ADV-4**, with no new findings. DevOps and completed security scope review approve the same current gate/input.

| Fresh read-only rereview | Actual current disposition |
|---|---|
| Adversarial `ses_eb7cb724effe5uE3Hebn2Gb0wF` |DONE `READY TO MERGE:yes`; LEDGER-ADV-4 RESOLVED, new findings NONE; bounded NON_ADMITTED ledger/closeout only |
| Security `ses_eb7cb7218ffePBBBS1MqCmBCtM` |DONE `READY TO MERGE:yes`, findings NONE/risk low; all16 inventory paths/captured HEAD diff against4990d951 plus surrounding source/current receipt inspected, scope limitation RESOLVED; no independent gate rerun |
| DevOps `ses_eb7cb7206ffe1XrslbW4r6OyGq` |DONE `READY TO MERGE:yes`, findings NONE; current source/receipt/raw-log inspection, no independent gate rerun |

No source/configuration/test/index/diagram inputs changed after the gate. This four-Markdown evidence update changes no normative contract or verified source identity; lead must recheck whitespace/preservation/navigation after it.
**Bounded NON_ADMITTED ledger/terminal-closeout verification and ALL3 reviews are COMPLETE**, findings NONE; HIGH-4 is RESOLVED. Optional property-based native-mode-chain/hidden-twin strengthening is not a blocker or executed proof.
Follow-up publication is **AUTHORIZED, NOT EXECUTED**: after this handoff the lead will check whitespace/navigation preservation and the current-input hash join, then explicitly stage16 files/commit/non-force push. No later commit hash, publication or F1 implementation is invented. Detailed [current completion/publication status](../ml/native-economic-ledger.md#94-current-closing-lock) preserves these boundaries; trainingReady:false remains unchanged.

## 9. Following milestone authority — selected Training-ready, not policy training

Executor selected **Training-ready**: future feature/belief/Rust learner implementation and required bounded **LOCAL** collection, belief-table fitting/calibration, profiling and container validation.
Required gates remain real418 authorized features/belief, actual Rust learner, authorized calibration, full end-to-end correctness, runtime/resource/authority closure and final readiness review. The ledger does not complete them or close legacy resource stops.
Only after these gates may **separate explicit policy-training approval** authorize training; learned-model admission follows training. No activation/deployment, engine/frozen-contract/corpus rewrite or reward/label/closeout change is authorized.
F1 freeze and its manifest-fee/private-seed addendum are DONE. Implementation remains FUTURE, only after actual verified repair publication and separate assignment: checked ordered `FeatureInputPair`, standalone **unwired** pure Node geometry, exact418 metadata registry and private labels DOCUMENT ONLY. No encoder/belief/learner/collector/permits/empirical/image work belongs to F1.
Future assigned docs are `_spec/_plans/native-feature-seams.md` and `_spec/ml/native-feature-seams.md`; neither is created here.

### 9.1 Future image authority — Offline local capture selected

Executor selected a **separate image from explicitly allowlisted installed tools/runtime files without downloads**. Missing components STOP; exclude credentials/unrelated files and measure identities.
Pinned-base acquisition/offline-bundle alternatives were not selected. No image-network acquisition, privilege change or fallback grant follows; user-selected mise tool restoration is separate.
Future image planning must define tools/licenses/loaders/native libraries, build/runtime split, new-generation identities, measured size/headroom and actual container proof without changing legacy pins. No image build/run or fresh Docker/headroom result is claimed.
