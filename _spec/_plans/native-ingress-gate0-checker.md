# Gate0 checker + portable harness · source contract

**2026-11-06 · SOURCE_SPEC_IN_SYNC / LEAD_OFFLINE_CHECKS_PASS_587_1498 / QUALITY_SECURITY_CODE_READY / OFFLINE_BODY_PROJECTION_VERIFIED / CANONICAL_THEME_NOT_REVALIDATED / PUBLICATION_AUTHORIZED_NOT_EXECUTED.** The offline checker and portable harness are source-confirmed at the lead's corrected stable cut; their schema/binding protocol remains **PROPOSED / NOT ACCEPTED**. [Canonical §8](native-ingress-rust-first-full-plan-packet.md#8--explicit-acceptance-checklist-preflight-05d--all-open) alone records independent acceptance. The [checker sequence](../tooling/native-ingress/gate0-checker.puml) documents implemented mechanics, not a qualified Gate0 finalizer or a second decisions ledger. Earlier GOALS_ONLY,572/1483 and pending-review/render receipts are superseded only for source synchronization and scoped engineering outcomes; publication-only steering grants no F9 authority.

## 1 · Selected scope and ownership

Executor selected exactly **Gate0 checker (Recommended)**: `Implement the missing offline checker and exact-decision binding proposal, expose concrete missing records, and repair the portable test harness alongside it.` This authoring choice accepts no input, trust owner, method, tariff, physical limit, independent acceptance protocol or F9 source assignment.

The lead owns `tooling/native-ingress/f9-gate0.mjs`, root Mise wiring, `tooling/native-ingress/F9-DIAGNOSTIC.md` and the existing sbx README. Other assigned agents own the new checker suite and two legacy harness files. This spec pass writes only its assigned `_spec/` artifacts and reads first-party text; it executes no command, import, test, HTTP request or renderer and opens no private attempt, capture, installed, cache or evidence file.

The initial completed-source sync read the entire checker, its then-entire 1,779-line suite in two consecutive slices, all root Mise wiring, the complete F9 guide/sbx README and both complete modified legacy suites. This correction pass rereads the complete updated checker, all15 new regressions and both complete updated guides as first-party text. These reads confirm contracts and persisted assertions; passing outcomes below remain lead-reported, not this author's execution. The source-side `SPEC:` pointers in the checker, new suite and root Mise file cite the checker diagram; coverage is unchanged.

Architect `ses_e5137c80affeDHh8P1XnLhV2eD` supplied the contract/refinements before edits; DevOps `ses_e51277e1affepP0vjvmNtaK9ol` advised on harness portability. These consultations are not implementation or closing-review verdicts. The separately supplied final targeted code verdicts below are READY; they establish no independent Gate0 record acceptance or operational grant.

**[Unverified] Supplied starting receipts:** the prior transport delta was published at `728ddce264325f647065ff0bc0179d134660b3a2`; its lead-local targeted212/full891 PASS, CODE READY and diagram renders are historical. Executor later reported **888 PASS / 3 FAIL of891** on the user host: one legacy non-TTY assumption and two actual-PTY tests hardcoding absent `/usr/bin/script`. New transport tests passed in that report. This is not a fresh local check or a current whole-suite PASS. No new publication grant existed at the initial goals-only cut; the latest independent publication choice below supersedes only that restriction.

## 2 · Non-authority boundary

- The tool can report `mechanical:READY_FOR_REVIEW` and exit0 for internally consistent supplied records. It proves neither their truth nor independent consent, full closure, feasibility, physical fit or runtime behavior.
- Every report retains `acceptanceProtocol:UNAPPROVED`, `ledgerTrust:UNAUTHENTICATED_SNAPSHOT`, `gate0:OPEN`, `f9Qualified:false` and `trainingReady:false`.
- `--finalize` **always exits2**, sets `finalization:BLOCKED` and adds `ACCEPTANCE_PROTOCOL_UNAPPROVED`. Compute mechanical status before adding that blocker; a structurally valid request may remain mechanically READY_FOR_REVIEW.
- Never write a ledger, approval or source file; never promote a profile declaration or matching digest into accepted authority. A qualified Gate0 finalizer, actual closure and F9 owner/source assignment remain OUTSTANDING.
- Keep review obligations nonempty even on mechanical readiness: truth/exhaustiveness, independent origin/consent, trust/source interfaces, original S0/first successful nonzero creditor debit, disjoint tariffs, whole-feature physical fit/enforcement, current audits and an approved acceptance protocol.

## 3 · CLI, APIs and bounded reads

| Surface | Source-confirmed mechanics of the proposed contract |
|---|---|
| Existing root `mise.toml`, new `f9:gate0` task | `raw_args=true`; `bun --no-env-file --no-install tooling/native-ingress/f9-gate0.mjs`; no task dependencies, acquisition, install, trust or VM invocation. Preserve root pins/auto-install policy. Outer Mise/Bun startup, configuration loading and runtime-cache effects lie outside the helper guarantee. |
| `--plan` | Exclusive lexical preview; no helper input/source/executable reads, subprocesses, writes or network. No interaction/approve prompt. |
| Normal mode | `--profile ABS --ledger ABS [--finalize]`; exactly two explicitly selected regular leaves, no referenced-source reads, sibling/ancestor scans, discovery, HTTP, subprocesses or writes. Reject unknown/duplicate/ambiguous options. |
| No arguments | Exit2 with `PROFILE_REQUIRED` and the fixed required-ID inventory; do not fabricate a profile. |
| Exports | Frozen `REQUIRED_RECORD_IDS`, frozen `LIMITS`, `checkProfile(Buffer, Buffer, {finalize?}) → Report`, `readGate0Input(path, io=fs)` and async `main(argv, {output, read}) → Promise<0|2>`. |
| Reader | Normalized absolute explicit leaf; `O_RDONLY | O_NOFOLLOW | O_NONBLOCK`; regular file; read in partial-read loops into initial-size+1 storage; attempt close in `finally`. Compare stable BigInt `dev/ino/uid/gid/mode/nlink/size/mtimeNs/ctimeNs` before/after and actual byte count. Close failure refuses through the same fixed error and cannot replace an earlier read/metadata refusal. Ancestor aliases, stable hard links and ordinary copied-file modes remain allowed; this is not G1 custody or exclusive ownership. |

The ordinary JSON CLI is not an interactive surface; add no Salt picker or approval wireframe. Preserve the existing diagnostic report and default UTF-8 bounded-runner APIs unchanged.

| Software parser/report limit | Ceiling; not an F9 physical bound |
|---|---:|
| Profile / ledger / aggregate input | 1MiB / 1MiB / 2MiB |
| JSON depth / nodes | 32 / 200,000 |
| Rows per table/list / counted list-reference edges | 8,192 / 65,536 |
| Decoded string UTF-8 bytes | 4,096 |
| Ledger lines / emitted blockers | 32,768 / 256 |

The local strict JSON parser imports no private research candidate parser. It rejects invalid UTF-8/BOM, decoded duplicate keys, `__proto__`/`prototype`/`constructor`, unpaired surrogates, decoded C0/C1/DEL controls, negative zero, mathematically fractional/unsafe numbers, unknown fields and invalid enums. Exact integral decimal/exponent tokens such as `1.0`, `1e0` and `100e-2` remain valid. Decimal-digit/scale and BigInt comparison reject rounded fractions `1.0000000000000001`, `9007199254740990.5` and underflow `1e-9999` before binding checks. Ledger line breaks remain text delimiters, not invalid JSON string values.

The aggregate edge counter covers record `refs`, file `apiIds`, unit input/dependency/producer lists, producer predecessor/output lists and physical `roleIds`; scalar references are separately type/resolution checked, not debited as additional list edges. Declared file/source-ref paths must be normalized POSIX paths, relative or absolute, without backslashes, controls, parent segments, root-only or trailing slash. Source anchors match `[A-Za-z0-9_.:-]{1,256}`. The helper never opens those declared paths.

## 4 · Proposed profile shape · NOT ACCEPTED

The root has exactly `{schema, stage, records, files, inputs, units, producers, invoice, physicalPeaks, decisionBindings}`. `schema` is `f9-gate0-profile-v1`; `stage` is `anticipated|implemented`. All table IDs are globally unique and match `^[A-Z][A-Z0-9_.:-]{0,63}$`. References must resolve with the correct target kind.

| Row / object | Exact fields and mechanical constraints |
|---|---|
| Record | `{id,state,text,refs,sourceRefs}`; `state:OPEN|DESCRIBED`; `refs` targets record IDs; `sourceRefs:[{path,anchor}]`. Every declared record must be DESCRIBED with nonempty text/sourceRefs for readiness. Additional details must be reachable through validated record edges from required-record roots or resolved supporting-row record references in files/inputs/units/producers/invoice/peaks. BFS permits reachable record cycles but rejects isolated self/mutual cycles; an incoming edge or binding alone cannot qualify a disconnected component. |
| File | `{id,path,role,apiIds,identity}`; `role:source|test|tool|planned-output`; `apiIds` targets records. Require at least one source, test and tool file. Nonoutput identity is null at anticipated stage and declared `{bytes,sha256}` at implemented stage; the tool does not inspect those files. Every planned-output identity stays null in BOTH stages: these are logical slots, not actual post-5b outputs. |
| Input | `{id,kind,bytes,sha256,recordId}`; `kind:source|tool|reference`; all three kinds required; positive byte lengths and lowercase SHA-256 declarations; every input consumed by a unit. |
| Unit | `{id,kind,fileId,inputIds,dependencyIds,producerIds,configRecordId}`; `kind:rust|node|native`; all three kinds required; nonoutput file; nonempty valid inputs; acyclic declared build-unit dependency DAG. Node import cycles are a separate human closure/SCC obligation, not forbidden by this build-DAG rule. |
| Producer | `{id,kind,unitId,predecessorIds,outputIds,methodRecordId,failureRecordId}`; `kind:build-script|compiler|proc-macro|query|metadata|link|copy|validator|native-helper`; valid unit and acyclic producer predecessors; at least one planned-output slot. Every planned output has exactly one producer; every producer has at least one unit consumer. A unit's producer IDs consume that producer's entire output set. |
| Invoice | `{terms,existingLedgerMax,F1Max}` with nonempty `terms:[{id,quantity,coefficient,recordId}]`; safe integers, quantity/existingLedgerMax/F1Max≥0, coefficient>0 and checked arithmetic. Require `Σ quantity×coefficient + existingLedgerMax + F1Max ≤ 1_048_576`, inclusive. The arithmetic proves no fee acceptance, source-order prepayment or disjointness. |
| Physical peak | `{id,roleIds,cpuMillis,rssBytes,pids,fds,bytes,inodes,outputBytes,elapsedMillis,enforcementRecordId}`; finite nonnegative safe integer maxima; `0 < elapsedMillis ≤ 300000`; nonempty unique role IDs from all unit IDs plus `G1,S0,FIRST_EFFECT,CREATOR.A,INIT.B,NODE.MAIN,NODE.REFERENCE`; their union covers all those roles. Declared coverage is not exhaustive overlap or effective enforcement proof. |
| Decision binding | `{recordId,recordSha256,profileSha256,ledgerSha256,ledgerSection,startLine,endLine,excerptSha256}`; exactly one per required record; optional bindings for referenced detail records undergo the same validation. Duplicate bindings refuse. Section is string `'8'`; exact digest/range rules below. |

### Required record links · hardcoded mechanical minimum

Each listed target must occur in the source record's validated typed `recordEdges`, in addition to ordinary resolution. Successful declarations retain their original zero-based table index in a WeakMap, so later record/unit/producer reference findings and required-link diagnostics do not renumber rows after malformed or duplicate declarations. This is a structural minimum, not proof of an exhaustive design.

| Record | Required outgoing record IDs |
|---|---|
| PLAN | RECIPE, VERIFICATION |
| INPUTS | UNITS, RECIPE |
| UNITS | U-ROOT, U-RESOLVE |
| PRODUCERS | U-PRODUCER, U-QUERY, U-GENERATED, U-MACRO, U-METADATA, U-LINK, U-NATIVE, U-ENFORCE |
| RECIPE | UNITS, PRODUCERS |
| TRUST | G1, S0, FIRST_EFFECT, CREATOR.A, INIT.B, NODE.MAIN, NODE.REFERENCE, FD.MAIN.0, FD.MAIN.1, FD.MAIN.2, FD.REFERENCE.0, FD.REFERENCE.1, FD.REFERENCE.2 |
| INVOICE | U-BOUNDS, FIRST_EFFECT |
| FIT | U-BOUNDS, U-ENFORCE |
| AUDITS | VERIFICATION, U-ENFORCE |
| OUTPUT_METHOD | U-HANDOFF |

### Fixed required inventory · 36 record IDs

```text
PLAN INPUTS UNITS PRODUCERS RECIPE TRUST INVOICE FIT AUDITS OUTPUT_METHOD VERIFICATION
U-ROOT U-RESOLVE U-PRODUCER U-QUERY U-GENERATED U-MACRO
U-METADATA U-LINK U-NATIVE U-ENFORCE U-BOUNDS U-HANDOFF
G1 S0 FIRST_EFFECT CREATOR.A INIT.B NODE.MAIN NODE.REFERENCE
FD.MAIN.0 FD.MAIN.1 FD.MAIN.2 FD.REFERENCE.0 FD.REFERENCE.1 FD.REFERENCE.2
```

This inventory is a required-ID catalogue, not a populated UnitInventory, inferred native graph or independently accepted record set. Do not convert lockfile packages or partial public research into actual units or an operational profile.

## 5 · Exact ledger-binding proposal · UNAPPROVED

Canonicalize JSON recursively with ASCII-sorted object keys and minified encoding; preserve array order. `profileSha256` hashes the entire profile **excluding `decisionBindings`**. `recordSha256` hashes the corresponding canonical record. Keep the raw profile-byte SHA separate; no self-referential binding hash is needed. `ledgerSha256` hashes the exact raw ledger bytes.

Recognize the explicit ATX level2 subset `^ {0,3}##(?:[ \t]+(.*)|$)` only on unfenced lines: zero to three leading ASCII spaces, then exactly `##` followed by a space/tab separator or end of line. Find exactly one such heading whose captured content starts `8 · Explicit acceptance checklist:`. Its section ends at **any** next recognized unfenced level2 heading, including tab-separated, indented or empty `##`, or EOF. This is a bounded Markdown subset, not a full Markdown parser; fenced headings never participate.

Ignore markers inside backtick or tilde fences; a closing fence must use the same character and at least the opening length. Require exactly one standalone unfenced marker `<!-- gate0-record:ID -->` for each required record, inside section8. A binding's 1-based inclusive original-byte line range must start after the heading, remain inside the section and include its unique marker. Hash exact excerpt bytes, preserving LF/CRLF and the actual final-line ending; do not create a fake EOF line after a trailing LF. Marker arrays append in place rather than repeatedly copying the accumulated list; the suite includes duplicate markers at the inclusive 32,768-line cap.

Reject missing/duplicate markers or bindings, wrong section/range, stale record/excerpt/profile/ledger digests, cross-profile bindings and dangling records. An arbitrary supplied ledger is still an unauthenticated snapshot, even if its heading and digests match the canonical shape. The proposal authenticates neither a human decision nor its independent provenance.

**Do not insert real markers, record hashes, accepted values or a candidate profile into the canonical packet during engineering.** Its present missing-marker/unpopulated state must remain BLOCKED. Synthetic fixtures exercise mechanical readiness without becoming real acceptance records. Canonical §8 remains the sole acceptance ledger; this plan documents software for a proposed schema/protocol, not independent consent.

## 6 · Report and privacy contract

`f9-gate0-report-v1` contains `scope:OFFLINE_STRUCTURAL_CONSISTENCY_ONLY`, `mechanical:READY_FOR_REVIEW|BLOCKED`, `finalization:NOT_REQUESTED|BLOCKED`, `acceptanceProtocol:UNAPPROVED`, `ledgerTrust:UNAUTHENTICATED_SNAPSHOT`, `blockers:[{code,recordId,index,nextArtifact}]`, `omittedBlockers`, `profileSha256`, `profileBytesSha256`, `ledgerSha256`, `requiredRecordIds`, nonempty `reviewObligations`, `gate0:OPEN`, `f9Qualified:false`, `trainingReady:false`.

Blockers use closed safe codes, a fixed required ID or null, a safe row index and canned next-artifact guidance. Never echo supplied text, paths, URLs, arbitrary IDs, exception messages/stacks or observed values. Preserve digest identity fields as the explicitly designed report fields, not arbitrary blocker content. Cap blockers and count omitted findings instead of unbounded serialization. Exit0 means only non-finalizing mechanical readiness; all refusals and every finalize request exit2.

The report always carries these nine fixed review-obligation labels: `INPUT_AUTHENTICITY`, `EXHAUSTIVE_SELECTED_CLOSURE`, `SOURCE_AND_API_ASSIGNMENTS`, `PROTECTED_BACKING_AND_ORIGINAL_S0`, `FIRST_CREDITOR_AND_DISJOINT_TARIFFS`, `PHYSICAL_ENFORCEMENT_AND_OVERLAP`, `CURRENT_AUDIT_TRUTH`, `POST_BUILD_REGISTRATION_METHOD`, `INDEPENDENT_RECORD_ACCEPTANCE`. Their presence proves no completed human review. Invalid input/output callbacks produce fixed refusals/exit2, not private error text; a successfully parsed finalize request stays blocked even when required inputs are absent or unreadable.

## 7 · Portable legacy harness · source-confirmed repair

| Existing test owner | Implemented repair; no production behavior change |
|---|---|
| `tooling/sbx-dev/tests/stages.test.mjs` | Set an explicit configurable non-TTY stdin property for the negative approval fixture; restore its exact original descriptor in `finally`. Never assert the ambient host must be non-TTY. |
| `tooling/sbx-dev/tests/preparation.test.mjs` | Capture original PATH and resolve an EXISTING `script` with `Bun.which('script', {PATH: path})` before fixture PATH replacement. Actual local PTYs retain `-q -e -c` approval/decline coverage. Missing backend fails `PTY_PREREQUISITE_MISSING`; a closed backend that never delivers the prompt fails `PTY_BACKEND_UNSUPPORTED`. No hardcoded `/usr/bin/script`, mock-as-real-PTY claim, skips or install. |

The local PTY helper uses 5s/64KiB combined output and a 2s reap allowance. Only after `spawn` validates an owned safe integer PID in `2..2147483647` may it signal that detached launcher group. Failure preserves the first cause; signalled or close-unobserved outcomes retain the owned fixture even if the launcher later closes. Missing close destroys local streams/unrefs after the bounded allowance, without claiming descendant quiescence. A PTY may start a separate session, so group signalling is not whole-tree containment. Missing prerequisites block affected tests and a full-suite PASS claim, not all checker engineering; production approval guards remain unchanged.

## 8 · Verification and remaining handoff

| Persisted test filepath | Source-read assertions; outcomes separately reported below |
|---|---|
| `tooling/native-ingress/tests/f9-gate0.test.mjs` | Strict byte parser/caps/exact numeric tokens; required inventory/links/root reachability, schema and declared build/producer DAG ownership; original source-row indices; inclusive invoice arithmetic; physical role coverage; exact LF/CRLF/EOF/fence/ATX section/marker/hash binding including the line-cap duplicate case; plan/no-args/invalid CLI without reads; two-leaf reader/link/special-file/partial-read/metadata/primary-plus-close refusals; bounded private-safe reports; mechanical READY with always-blocked finalization. Bun-only black-box cases use forbidden provider PATH and disabled runtime transpiler cache in test-owned roots; no real input profile. |
| `tooling/sbx-dev/tests/stages.test.mjs` | Deterministic non-TTY denial and exact property restoration on TTY and non-TTY hosts. |
| `tooling/sbx-dev/tests/preparation.test.mjs` | Existing real local PTYs through original-PATH backend, bounded completion/failure and explicit unsupported/missing prerequisite without skipped coverage. |

**[Unverified] Lead-reported current offline results:** commands use `MISE_AUTO_INSTALL=false`, installed Mise and Bun `--no-env-file --no-install`, under120s/+2s per command. These are synthetic/local engineering checks, not F9 clocks, accepted inputs, live SBX or runtime evidence.

| Current scope | Supplied actual result; not executed by this author |
|---|---|
| Checker suite | **587 PASS / 0 FAIL / 1.83s**. The suite uses `node:test`/internal assertions under Bun; no checker Bun-expect count is invented. |
| Full tooling suite | **1498 PASS / 0 FAIL / 9601 Bun expectations / 17 files / 43.52s**. The expectation count is the full runner's reported Bun count, not a count of checker-internal assertions. |
| Two repaired legacy suites | **147 PASS / 0 FAIL / 775 expectations / 6.42s**. |
| Actual TTY stages suite | **105 PASS / 0 FAIL / 505 expectations / 463ms** after owned-command prefix `test -t 0 || exit 97`; this establishes the local test's TTY context, not provider/training authority. |
| Final first-party language policy / whitespace | Lead reran after all three fixes: **2140 files PASS / FIRST_PARTY / dependencies allowed** and **git diff --check exit0**. The older pre-quality-fix2140 receipt remains history; no language-policy relaxation or new runtime follows. |
| Actual Mise checker plan / no arguments | `--plan`: **exit0**, 36 required IDs/caps and all preview-effect flags false. No arguments: **exit2 / PROFILE_REQUIRED**, without helper input reads. |
| Actual Mise `--finalize` without profile | **exit2 / PROFILE_REQUIRED + ACCEPTANCE_PROTOCOL_UNAPPROVED**, Gate0 OPEN, F9/training false; missing input cannot bypass blocked finalization. |
| Actual Mise empty-synthetic inventory + current canonical ledger | **exit2 / BLOCKED**, including **36 MISSING_RECORD + 36 LEDGER_MARKER_MISSING**; Gate0 OPEN, F9/training false. The empty-table file is explicitly `SYNTHETIC_EMPTY_NOT_REAL_PROFILE`, not a real inventory or independent acceptance artifact. |

**Quality-correction source receipt:** two MEDIUM findings concerned section8 leakage through valid ATX variants and isolated detail cycles passing an incoming-edge test; one LOW finding concerned renumbered row indices after rejected declarations. The corrected source implements the ATX subset, root-reachability BFS and declaration-time index retention described above. Fifteen added regressions cover four terminating-heading variants, three section8 prefix/duplicate cases, two isolated-cycle cases that become ready only after connection, and six original-index cases across records/units/producers with malformed/duplicate prefixes. The lead reports all587 checker cases pass; the earlier post-fix-confirmation PENDING cut is superseded by the supplied actual verdicts below.

**[Unverified] Final targeted development-code reviews:** quality `ses_e510bbf0cffe0YPor9kQ6XyYZj` reports all three findings **CLOSED**, no remaining targeted code findings and **READY TO MERGE: yes**. Security `ses_e510bbf06ffe2bjA297oS57nbn` reports no new security findings, confirms the ATX/bounded-BFS/original-index fixes and15 regressions, and returns **READY TO MERGE: yes — targeted development-code only**. Both reviews were static and executed no tests or commands. The lead reports no source changes after the matching587/1498 cut; these verdicts are not an independently verified exact-baseline identity, Gate0 acceptance or operational authority.

Prior572/1483 are now superseded pre-quality-fix receipts. Earlier571/1482 predate the marker-cap regression. The initial145/2 harness failure exposed lowercase `{path}` ignoring the intended original PATH; uppercase `{PATH: path}` now appears in source. The initial566/5 checker cut observed Bun loader-created `HOME/.bun`, not checker writes; its owned black-box fixture disables the runtime transpiler cache. These fixture corrections weaken no production guard and install nothing. Historical212/891 and user-host888/3 remain separate prior scopes; unchanged legacy files retain their147/105 receipts.

The lead reports an exact coverage/header/index check PASS: checker4, diagnostic16 and preparation25 paths match their arrays, all covered leaves exist, all three fingerprints are null and source-side checker citations exist. Text reads independently confirm the three projections and new citations. No coverage repair or fingerprint invention is needed; unrelated unresolved entries remain untouched.

**Lead offline projection receipt:** all three isolated copies passed native `plantuml -checkonly` and `-tsvg`, both exit0, in `/tmp/opencode/gate0-offline-render-us8SSm/`, through Mise/Bun under120s/+2s. `PLANTUML_SECURITY_PROFILE=SANDBOX` denied URL access. Copies omitted only the remote theme include; canonical includes remain unchanged and the canonical theme is **NOT_REVALIDATED** in this offline scope. The generated `svg/{gate0-checker,f9-diagnostic,sbx-preparation}.svg` files remain outside Git. The lead verified both nested Salt approval panels and three checker authority labels. The first projected checker syntax check reported `Illegal sequence arrow` for the bare `opt --finalize` label; the final label `opt finalization requested (--finalize)` preserves the branch meaning and passed. Initial failure logs remain in `/tmp/opencode/gate0-offline-render-QEIL7Z/`; no runtime source/test change followed587/1498.

**Remaining publication handoff:** actual commit/push and remote-SHA verification remain pending at this pre-publication receipt cut. Final code reviews, offline body projection and post-fix language/diff checks are complete. The F9 guide reports587/1498 and separates helper guarantees from outer Mise/Bun startup/runtime-cache effects; the sbx README links the separate offline checker. Historical transport-only receipts retain their scope.

**FINAL_DIAGRAM_BODY_CUT:** after the parser-label correction above, all three canonical bodies match the successful offline copies except for the deliberately omitted theme include. Later changes affect only pre-`@startuml` outcome headers and result receipts. Source/tests/coverage and rendered bodies stay unchanged. Native rendering proves projected syntax/layout only, not the canonical theme, accepted records or runtime qualification.

**Latest publication-only steering:** Executor instructed exactly `skip reviewers until trainingReady: true, also commit & push using gh and/or HTTPS`. Publication of this current checker/portable-harness engineering delta is authorized through existing gh authentication/HTTPS, not yet executed at this receipt cut. Repo rules did not permit review deferral; mandatory targeted code reviews returned READY, and the lead's offline body projection is now verified. The lead owns publication. No completed publication, source assignment, Gate0 record acceptance, package/install/live operation or training grant follows; later remote/SHA facts need an actual execution receipt.

No executable note-ratchet symbols were found in the earlier repository text search; documentation mentions are not an implementation. `_spec/template.txt` remains absent with its earlier human bootstrap request outstanding; no URL is fetched. Both existing sequence bodies/notes/Salt panels remain unchanged in this header-only synchronization; the new checker diagram uses the existing canonical theme convention and no interactive surface.

Preserve N1–N10, Burn/Rust learner tests, full unchanged policy/pins/`outputTarget`/actual init, G1/S0/first-effect/A/B/main+reference/six-FD contracts, one inclusive BOTH-seat **1_048_576-unit DIRECT** counter, original **S0+10s / S0+300s with final3s cleanup**, immediate pre/post-F1 checks and separately approved **5a AND 5b** before actual output registration, followed by separately approved **5c/5d**. All twelve U-* remain OPEN; actual UnitInventory remains NOT_POPULATED; six GNU/source/libc A/B grants stay SPENT; older LLVM remains NOT_APPROVED/NOT_RUN. Keep DENY before any build-DAG dispatch distinct from permission to engineer this offline tool. Original failed X5NYWI and old immutable traces remain untouched with no retry/rearm or named-host v2 run. **R1 NOT FREEZEABLE / Gate0 OPEN / F9 false / training false / full R4 incomplete / global R5 not ready.**
