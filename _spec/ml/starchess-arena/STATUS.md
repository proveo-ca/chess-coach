# starchess-arena — current status

**[Unverified] 2026-10-16 · FROZEN WIP / HUMAN-ACCEPTED PUBLICATION RISKS; both fresh reviews NOT READY, N1–N7 HIGH static candidates / M2 MEDIUM; prior specific cases CLOSED / CONTROL VERIFIED; AP5 and full R4 BLOCKED. Keeper reproduces no hashes or execution.**

## Responsibility

- Own [`@chess-coach/starchess-arena`](../../../packages/starchess-arena/package.json), authorized v1/v2 contracts, observations/events/intent codec, and challenge admission/supervision.
- Depend on native core and exact `jssha` **3.3.2**; export `.`, `/observations`, `/events`, `/intent-codec-v1`.
- Keep full state, causal traces, and truth host-private; expose recipient-authorized projections, never private model input.
- Keep public and inventory auditors independent inside this package; hermetic placement does not transfer public solver ownership to verification tooling.

## Current findings

### Public auditor — owner FROZEN / partial / NOT READY

Owner: [`hermetic/public-closure.mjs`](../../../packages/starchess-arena/hermetic/public-closure.mjs); controls: [`publicClosureInvocation.test.ts`](../../../packages/starchess-arena/src/__tests__/publicClosureInvocation.test.ts).
The public owner completed the bounded repair phase and froze this two-file pair; **no source editor is active** for the checkpoint.
The newer explicit **"commit & push"** grant authorizes WIP checkpoint publication separately from the earlier private-analysis grant; no more features or R4 acceptance follow.
After both fresh NOT READY reviews, the user selected exactly **"Push WIP with known risks"**: unresolved HIGH static candidates and failed actual-root closure are accepted for **NON_ADMITTED WIP publication on `feat-ml-adjuntant` only**.
That decision supplies no merge readiness, finding/assertion/cap waiver, admission, training, profiling, or activation; commit/push are not yet recorded as done.
Lead independently reran focused controls, core, pin migration, actual CLI, package types, strict, and syntax for the **FROZEN CHECKPOINT**.
Lead's [start identity][identity-start] and [end identity][identity-end] match; [frozen copies][frozen] remain local receipts, not admitted source images.

| Frozen checkpoint file | Lead-recorded SHA-256, not recomputed here |
|---|---|
| `public-closure.mjs` | `0853c82077f0174e6b55d7dda53305d36c605021c503cb6bcf14ad7bb0c98f5a` |
| `publicClosureInvocation.test.ts` | `643788a254f97eeec22cbb36ed4e22f74d1dd94ccbbdd052e2884d57a0b0542d` |

Current matching-source lead [focused result][focused] / [execution receipt][focused-receipt]: **242 PASS / 0 FAIL / 0 pending / exit0 / 19.997497s**.
Public contributes **210 PASS**; selectors contribute **32 PASS**.
**AP1–AP4 and S1–S7 specific reported cases CLOSED / CONTROL VERIFIED by fresh review, not whole-family proof.**
Each guarded positive passes; each unsafe check executes once and retains the original policy `toThrow` assertion, strengthened to exclude analysis ceilings and parser/analyzer exceptions.

| Reported HIGH case / retained control | Current unsafe semantic refusal |
|---|---|
| AP1 — `retains mutations of every allocation recipe` | Destructured `identity({rows})` / inserted unknown refuses unproved primitive dispatch: `unknownFactory():false:unresolved identifier` |
| AP2 — `closes public exposure through actual returned array contents` | Exported `map` content callable refuses unproved primitive dispatch: `(value as string):false:unknown arguments` |
| AP3 — same returned-content control | Exported collector content callable refuses unproved primitive dispatch: `(value as string):false:unknown arguments` |
| AP4 — same returned-content control | Pushed/apply returned callable refuses unproved primitive dispatch: `(value as string):false:unknown arguments` |

The [owner's semantic refusal record][policy] binds those suffixes to this public pair; each is an `Error` with common prefix `Code constructor acquisition in public closure: packages/starchess-arena/src/events.ts -> unproved primitive native dispatch: (value as string).includes("x") -> `.
These are intended semantic refusals, not arbitrary throws; no resource/parser/analyzer failure supplies these PASSes.
Fresh frozen-copy security `ses_eb995d9e3ffeKZauFvaB3a3L05` and adversarial `ses_eb995da16ffetegLcbK1mNOWaw` both completed **NOT READY** on `0853…`; the same sessions' earlier `94a9…` verdicts remain historical.
Security closes old S1–S7 specific witnesses; adversarial closes its prior five HIGH cases and M1 specific charging case.
New [N1–N7/M2 findings](../R4.md#fresh-static-review-findings--open--not-reproduced) remain OPEN: **seven HIGH families / eight distinct static witnesses** (two N3 contexts), plus MEDIUM argument-part allocation before charging.
N1 sequencing, N2 uninitialized export, N3 unresolved spread-field/default, N4 unused initializer effects, N5 opaque array dispatch, N6 opaque method receiver, and N7 later-added heap fields are **unexecuted static predictions**, not reproduced RED regressions or passing controls.
Reported-case PASSes establish neither broader-family soundness nor full-source SAFE.

AP5: latest actual five-root [CLI receipt][cli] is **exit1 / 2.125799s**, not closure PASS.
The [refusal stream][cli-stderr] first names `packages/starchess-core/src/board/placement.ts` at the **static analysis argument-ID ceiling 262144/262144, N=1294**.
Counters: **27329 queries / 123275 edges / 23701 routes / 1464103 steps**.
Phase work includes returns **781648** and discovery **403002**; those measurements alone do not establish the cause of all charged work.
This is neither a native-engine error nor a JavaScript argument-count limit.
[Owner static freeze][static] records byte-identical fixed-limit block, mutation-node scan, and outer convergence, plus syntax/scoped whitespace PASS.
The 20/600-binding and wrapper16/17 controls remain unchanged and PASS.

### Executed new review regressions — pre-fix solver

**HISTORICAL, not current RED:** lead persisted and executed these regressions against solver `94a9…` before fixes, using separate changed test revisions.
The witnesses now have passing controls on `0853…` / `6437…`; the historical raw reports remain intact and must not supply current-source counts.

| Raw RED result / receipt | Executed outcome | Meaning |
|---|---|---|
| [Certificate regressions][review-red] / [receipt][review-red-receipt] | **9 FAIL / 0 PASS / 190 filtered / exit1 / 1.517892s** | Eight unsafe ACCEPTs; one safe original-RHS object false rejection |
| [Direct-spread regression][spread-red] / [receipt][spread-red-receipt] | **1 FAIL / 0 PASS / 199 filtered / exit1 / 1.016389s** | Separate ninth unsafe ACCEPT; S7 |

Each unsafe assertion failed because the expected function did not throw; these are confirmed controls, not only unexecuted static witnesses.
The separate safe RHS-object positive failed then and now PASSes in the current focused run.
Keep both raw reports; do not stitch their revisions with any focused result.

| Reported case | Current specific control disposition; fresh review closes prior cases |
|---|---|
| S1 — reported HIGH | Bound-apply/filter MAY forwarding unsafe refusal and guarded positives PASS |
| S2 — reported HIGH | Missing/default call/apply forwarding paired controls PASS |
| S3 — reported HIGH | Updated empty/replaced own-field exposure controls PASS |
| S4 — reported HIGH | Actual getter RETURN/updated `this` field exposure and scalar-only safe controls PASS |
| S5 — reported HIGH | Actual mutated array-like numeric-field refusal and safe pairs PASS |
| S6 — reported HIGH | Original destructuring RHS unsafe refusal and safe original-object `.text.includes` PASS |
| S7 — reported HIGH | Summarized ordinary direct-spread callable exposure unsafe refusal and safe pairs PASS |
| M1 — prior static MEDIUM | Specific charging case CLOSED by fresh adversarial review; no complete cost proof follows |

The [R4 checkpoint matrix](../R4.md#latest-design-pattern-findings--next-repair-design) records installed private repairs separately from pending general proof.
The owner is FROZEN; passing reported cases and safe RHS value do not clear AP5 or the complete functional legacy gate.

### Inventory auditor — unchanged / editing gated

Owner: [`src/challenge/sourceInventory.ts`](../../../packages/starchess-arena/src/challenge/sourceInventory.ts).
The owner static freeze retains unchanged identity `0959221fdd5888bf002a3c33cc29c4d67057ab9270d6d294bbb8d8a26508e9fe`.
The real R3 `expected[index]` / wrapper16 **analysis gate** remains unresolved; no native validator defect is established.
The complete public gate below precedes any inventory editing; peer agreement cannot replace independent proof.

## Checkpoint patterns + deferred remaining gates

R4 mapping: arena owns the private-analysis refinements [P1](../R4.md#p1)–[P8](../R4.md#p8) in the [current checkpoint plan](../R4.md).
The latest user grant freezes source work for **WIP checkpoint publication**, not new implementation or full R4 acceptance.
The frozen public code includes versioned heap/exposure graph queries and scoped-call deltas instead of synchronous exposure/whole-runtime DSU authority.
Immutable binding snapshots, revision memoization, lazy no-op refinement, allocation/frame/callsite identities, and weak heap facts are present; full persistent ENV and full path-sensitive heap state remain proposed/pending.
P2A argument-query memoization, P2B dependency-first no-mutation heap fast path, P2C append-only scope logs, and P2D per-target incoming cursors are present; AP5 still stops.
Forwarding missingness/uncertainty, actual own-field/getter RETURN/array-like data, reachable clobbers/defaults, native insertion/spread, and original RHS value handling support passing paired controls, not full design coverage.
Full P3 persistent ENV, full path-sensitive heap, and P6 diagnostic ordering remain pending.
The [P1–P8 matrix](../R4.md#latest-design-pattern-findings--next-repair-design) distinguishes installed mechanisms from unfulfilled refinements; neither public closure nor inventory proof is complete.

1. Keep unresolved **N1–N7/M2** static findings and both fresh NOT READY verdicts visible under the exact **"Push WIP with known risks"** publication decision. Reproduction and repairs remain deferred; no source editor is active now.
2. Deferred AP5 work requires genuine charged-cost reduction without weakening passing semantic/safe controls, 20/600, wrapper16/17, `noopNoImport`, or the source-getter guard. Never fake/pad cost, truncate routes, reset counters, inflate N, waive assertions, add native authority, or increase limits.
3. Complete matching-source actual five-root closure and all **653** public legacy controls plus applicable focused/types/strict/closing reviews before public acceptance. The current full 653 gate is **NOT RUN** because source closure still STOPs; owner `stored.args` **2 PASS / 1417 filtered** is only its own selection.
4. **BLOCKED:** inventory editing/completion/review follows the complete public gate, independently of public solver/caches/verdicts or archived prototypes; final integrated verification and training/runtime authority gates remain separate.

Add no whitelist, new native `Set`/`Map` model, policy exemption, validator workaround, or cap/deadline change.

## Verification + References

- Current frozen-pair lead static receipts: [core types][types-core] **PASS / 1.508624s**; [arena types][types-arena] **PASS / 2.584710s**; [training types][types-training] **PASS / 4.211917s**; [strict invoice][strict] **PASS / 4.173236s**; [syntax][syntax] **exit0**. These are not unfiltered suite results.
- Current owner targeted `stored.args` [result][stored-args] / [receipt][stored-args-receipt]: **2 PASS / 0 FAIL / 1417 filtered / exit0**; no current full 653 result follows.
- **HISTORICAL `94a9…` / `363c…` only:** completed legacy public [result][legacy] / [receipt][legacy-receipt] / [raw failures][legacy-failures], **568 PASS / 85 FAIL / 766 filtered / 653 selected / exit1 / 264.564506s**. [Legacy start identity][legacy-start] and [end identity][legacy-end] match that older pair, not the current pair. Its 85 failed tests do not prove 85 distinct defects or current counts; budget/fixture-baseline diagnostics remain ungrouped.
- Fresh checkpoint [core result][checkpoint-core] / [receipt][checkpoint-core-receipt]: **668 PASS**; [pin migration result][checkpoint-migration] / [receipt][checkpoint-migration-receipt]: **26 PASS**. These do not establish complete R4 or current runtime-image authority.
- Full **46-command**, inventory, unfiltered arena/training, app, and browser reruns were skipped for this WIP checkpoint because public/inventory gates remain blocked, not waived.
- Fresh [checkpoint preservation][checkpoint-preservation] records **12** budget-pinned sources equal HEAD, frozen R3 unchanged (`cfc388d269b44d0d91c726e82be8b2464fdf573d7300c5f8bb5bfe2c9bc3ca2b`), **57** validated published artifacts, evidence mode **0700**, unchanged inventory, and exact headroom v2 unchanged. Lead records protected v2 body SHA-256 `295388ddfe0ffecdd2f37c442203804ac9a6bfa2b7d0a57345852d1c29616bef` including delimiters; keeper reproduces no hash.
- [Earlier preservation preflight][preservation] remains historical; lead retains final metadata/link/index/body checks and render/Git handoff, without an invented publication result.
- Earlier same-day complete ledgers belong to older source; do not reuse them as current results or stitch revisions.
- Receipts are local lead observations, not published assurance or admitted images; keeper reads but runs no verification.
- [Existing finite-invocation authority](../../_plans/r4-finite-invocation-resolution.md) retains frozen contract/history; its older operating labels are not new current proof.
- [Invocation/effect concern](../../packages/starchess-arena/invocation-effect-analysis.puml).
- [Authorized recipient boundary](../../packages/starchess-arena/authorized-economic-boundaries.puml).
- [Whole R4 authority prerequisites](../../_plans/ml-adjutant-r4-authority-chain.md).
- [Current ownership overview](../overview.puml).

[focused]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/focused.json
[focused-receipt]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/focused.receipt.json
[cli]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/public-cli.receipt.json
[cli-stderr]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/public-cli.stderr
[policy]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-patterns-review-qy2mi89x/freeze-semantic-refusals.json
[static]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-patterns-review-qy2mi89x/freeze-static.json
[stored-args]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-patterns-review-qy2mi89x/freeze-stored-args-legacy.json
[stored-args-receipt]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-patterns-review-qy2mi89x/freeze-stored-args-legacy.receipt.json
[identity-start]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/start-identity.json
[identity-end]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/end-identity.json
[frozen]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/frozen/
[checkpoint-core]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/checkpoint-core.json
[checkpoint-core-receipt]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/checkpoint-core.receipt.json
[checkpoint-migration]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/checkpoint-migration.json
[checkpoint-migration-receipt]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/checkpoint-migration.receipt.json
[checkpoint-preservation]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/checkpoint-preservation.json
[legacy-start]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-pattern-lead-qg5_ujui/legacy-start-identity.json
[legacy-end]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-pattern-lead-qg5_ujui/legacy-end-identity.json
[legacy]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-pattern-lead-qg5_ujui/legacy-public.json
[legacy-receipt]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-pattern-lead-qg5_ujui/legacy-public.receipt.json
[legacy-failures]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-pattern-lead-qg5_ujui/legacy-public-failures.json
[review-red]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-pattern-lead-qg5_ujui/review-certificate-red.json
[review-red-receipt]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-pattern-lead-qg5_ujui/review-certificate-red.receipt.json
[spread-red]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-pattern-lead-qg5_ujui/review-direct-spread-red.json
[spread-red-receipt]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-pattern-lead-qg5_ujui/review-direct-spread-red.receipt.json
[preservation]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-pattern-lead-qg5_ujui/preservation-preflight.json
[types-core]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/types-starchess-core.receipt.json
[types-arena]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/types-starchess-arena.receipt.json
[types-training]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/types-starchess-training.receipt.json
[strict]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/strict.receipt.json
[syntax]: /tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-review-lead-GDwYa4/syntax.receipt.json
