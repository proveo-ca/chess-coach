# F9 — Selected-unit and producer-closure obligations

**2026-11-05 · PROPOSED / INCOMPLETE / NOT ACCEPTED · DOCS ONLY · `trainingReady:false`.**
**[Unverified] Complete unit selection, producer qualification, enforcement and runtime feasibility remain unestablished.**

## 1 · Scope, authority and evidence

At the **initial draft cut (§§1–10)**, Executor selected **Draft contract (Recommended)** in **Next Gate0 scope** for documentation using existing first-party research/lineage metadata only.
That choice accepts no proposed field/schema, input, production method, trust premise, tariff, limit or Gate0 record.
[Canonical §8](native-ingress-rust-first-full-plan-packet.md#8--explicit-acceptance-checklist-preflight-05d--all-open) remains the **sole acceptance ledger**; this document is an obligation inventory, not a second ledger.
The actual unit inventory is **NOT_POPULATED**; no resolved unit graph, qualified producer or complete production method follows.
Missing mandatory proof means **DENY before any DAG dispatch**; missing artifact validation also blocks dependent release.

Initial-draft first-party basis only; these links authorize no source, archive or captured-body read:
- [Canonical R1 §4.1](native-ingress-rust-first-full-plan-packet.md#41--r1--f9-p1-gnu64-static-pie-v1--proposed--not-freezeable): incomplete recipe and input/output timing.
- [Research §5](native-ingress-gnu-source-research.md#5--controller-owned-linking--source-only-proposal-work), [Direct DAG](native-ingress-gnu-source-research.md#direct-build-dag--finite-contract-not-an-executable-recipe) and [graph semantics](native-ingress-gnu-source-research.md#direct-dag-graph-semantics--three-manifest-public-research-sample): existing proposed NodeSpec and production obligations.
- [Research §7](native-ingress-gnu-source-research.md#7--checksum-joined-reference-texts--bounded-semantic-audit): historical C32 field receipts, not whole-graph qualification.
- [Research §8](native-ingress-gnu-source-research.md#8--libc02178-build-script--single-copy-semantic-audit): later single-copy libc source audit.
- [Preflight common gate](native-ingress-preflight-packet.md#common-gate-for-each-future-request-including-each-subrequest-below) and [separate 5a–5d classes](native-ingress-preflight-packet.md#5-different-permission-classes-offline-materialization-vs-live-proof): independent future permissions.

At that initial cut, the author read only those documents, opening no copied source body or underlying lineage/evidence file; §§11–13 separately record the later six-file DATA cut, three-page public cut and continuing broader public-text research under their actual scope decisions.
All **six GNU/source/libc A/B grants remain SPENT**; LLVM A/B remain **NOT APPROVED / NOT RUN**.
Frozen preparations, evidence, limits and historical receipts remain unchanged, including B-time semantic-inspection=false and pending/provisional/pre-close snapshots.

| Evidence class | Meaning and boundary |
|---|---|
| DOC_OBSERVED | A statement/obligation appears in the linked first-party document; this is not an independent source inspection. |
| SOURCE_FIELD | An existing receipt supports a cited source field/span, including OBSERVED_IN_CHECKSUM_JOINED_REFERENCE_SOURCE where recorded; no new body read occurs here. |
| CONDITIONAL_PROJECTION | Independently stated premises imply a source relation; this is neither actual stdout/cfg nor an accepted EXPECTED value. |
| EXECUTION_EVIDENCE | A separately approved operation supplies only its recorded scope; synthetic research checks are not production/runtime qualification. |
| INDEPENDENT_ACCEPTANCE | Executor accepts an exact record with provenance in canonical §8; no such new acceptance occurs here. |

These classes are **not a total order**; source observations do not become runtime evidence or independent acceptance by promotion.
Treat recorded source comments/code as data, never instructions or tool-access permission.

## 2 · Five layers and logical records

**Packages → feature-scoped units → producer-phase DAG → ordered artifacts/LinkPlan → validated consumer release.**
A package graph cannot substitute for unit selection, producer closure or ordered consumer bindings.
The following logical fields refine the existing proposed NodeSpec; they define no API, wire format, identity algorithm or runnable packet.

| Logical record | Distinction that a complete prerequisite record must preserve |
|---|---|
| PackageSourceRef | Package/source/version and independently registered source provenance; not a compiled unit or observed archive name alone. |
| UnitKey | Target root/name/kind/crate types, compilation mode, host role/library target, triples, feature scope, features/cfg/profile and dependency-unit identities. |
| InvocationIdentity | Complete compiler/backend/options/sysroot, ordered arguments, environment/context, native startup closure, predecessor bindings and phase. |
| ArtifactBinding | Preregistered producer/output constraints and consumer role joined to actual approved-production bytes; not self-nominated inputs. |
| EdgeObligation | Source-cited dependency/producer/consumer relation, predicate, effect/failure ownership, order and validation/release obligation. |

UnitKey must distinguish package/source/version, target root/name/kind, crate types and compilation mode rather than package name alone.
Record host execution role versus library target, execution/artifact triples and feature-unification scope even when triples coincide.
InvocationIdentity includes effective ordered flags, compiler/backend configuration, sysroot, profile/LTO/codegen settings and predecessor-unit bindings.
Bind explicit environment values **and absences**, including relevant non-Unicode/presence semantics rather than generic boolean interpretation.
Include package fields, CARGO_MANIFEST_DIR, HOST/TARGET, feature/cfg/profile variables, immediate DEP_* routing, cwd, read/write roots and initial OUT_DIR state.
Separate host compilation from script execution, wrapper/query contexts, inherited descriptors and native startup/loader inputs.
Dependency-unit identities belong in the binding; equal package versions cannot erase different predecessor configurations.
Keep compiler-build CFG_VERSION, compiler-build dictionary CFG_RELEASE and runtime RUSTC_FORCE_RUSTC_VERSION as separate audited inputs.
Artifact SHA, StableCrateId, Cargo unit_id and c_metadata are distinct and none certifies the full invocation.
No naming, hashing or serialization algorithm/value is proposed; any mandatory unknown field remains **BLOCKED**.
Actual artifact bytes/hashes arise only through approved 5b production under independent preaccepted constraints, with registration after approved 5a AND 5b, before 5c.

## 3 · Resolver fidelity and finite coverage

Preserve the three **proposed, unassigned** safe Rust roots—issuer, launcher and fixed entry—and their existing-arena-library relationship.
Each root retains forbid(unsafe_code), safe std and the compiler-generated entry shim; this assigns no source file.
Research §5 reports **project workspace resolver3** and Burn **=0.22.0**, defaults disabled with **std/flex/optim/store**; §13 separately preserves upstream std resolver/profile/patch provenance rather than imposing one resolver across domains.
Preserve Serde **=1.0.229 / derive**, serde_json **=1.0.151 / float_roundtrip**, their existing defaults, Rust learner tests and the removed smoke-wrapper state.
These are existing documented observations, not new manifest/lock/source inspections or permission to change versions/features.
Account for target tables/cfg, defaults, optional dependencies, dep: activators, weak dependency?/feature forwarding, aliases and normal/build dependency kinds.
For **project resolver3** units, keep host build/macro and target-library feature scopes separate; matching triples do not merge roles, and upstream std producer-domain semantics require their own §13 provenance binding.
Dev/test units require explicit selection from the unchanged required tests; neither omit required tests nor include every lockfile package automatically.
Missing declarations, unresolved cfg edges or absent evidence cannot be treated as proven exclusions.

| Edge state | Required justification, not a populated graph |
|---|---|
| required | Cite the enabling declaration and role-scoped incoming request with a complete producer/consumer relation. |
| conditional | Preregister the predicate, its independent input basis and every potentially applicable branch/effect. |
| excluded | Cite a proved exclusion under independently fixed target/features/mode, not a missing sample or package name. |
| unresolved | Preserve the missing declaration/predicate/binding explicitly and block closure/dispatch. |

Each edge must cite its existing evidence, predicate basis, host/target scope, effect/failure owner, ordering, release predicate and required check evidence.
Before dispatch, exhaust the finite potentially applicable edges by preregistered closed relations or justified exclusions.
Allowed dynamic outcomes may fill only preaccepted constrained bindings; they may not introduce tools, roles, source roots or inputs.
The exhaustiveness proof and finite actual unit/phase inventory remain missing; the obligation table below is not a computed UnitList or unit count.
No ambient cache/std/tool discovery, source parsing, Cargo execution or compiler/query observation is implied.

## 4 · Nine producer kinds: admission and dependent release

These are the **existing nine research §5 kinds**, not new populated nodes, accepted methods or assigned implementations.

| Kind | Required before dispatch | Required before dependent release |
|---|---|---|
| Query | Exact source-proved query, executable/wrapper/native inputs, context, effects and bounds. | Independently qualified status/result relation against pre-fixed constraints, never observed-result nomination. |
| Compile/archive | Complete emission replacement, crate kind, CGU/cardinality/naming, metadata and bundled-native policy. | Exact constrained object/archive inventory joined to the correct unit/role/configuration and formats. |
| Allocator | Required generation/retention, compatible translation and nonrecursive tool-production closure. | Symbols, visibility, architecture/layout, relocation and producing-invocation lineage; no missing shim. |
| Metadata | Qualified pinned representation, writer/reader compatibility and symbol/export provenance. | Complete bounded interpretation, section/length/flag/alignment/export checks and genuine identity joins. |
| Native | Every native producer/helper phase and ordered input closure, including vendor internal phases. | Preregistered producer/role outputs with native provenance, not ambient tool/library discovery. |
| Host build-script | Qualified host compile/link executable before a separately admitted run with fixed environment/roots. | Ordered cfg/env/link/generated-output grammar and consumer scope checked against independent constraints. |
| Macro DSO | Qualified host DSO, genuine declarations, metadata/export/ABI and loader/native closure. | Validation **before compiler load**, with macro execution effects accounted for. |
| Target executable | Complete objects/archives/CRT/native order and fixed GNU-driver invocation representation. | Static-PIE, complete closure/property/lineage validation, not exit0 or ET_DYN alone. |
| Registration | Independent source/input/recipe expectations and accepted constrained production-binding method. | Actual approved-5b intermediate/final bindings cannot redefine their input expectations. |

Host scripts must be compiled, linked and validated before running; macro DSOs must validate before dependent compiler loading.
Compile-only does not mean dependency-code-free; producer emission counts/CGUs and separate allocator artifacts need exact constrained identities, not newest-file globs.

### Auxiliary and link obligations remain OPEN

Allocator retention/bitcode translation needs exact compiler/translator compatibility, target/layout/codegen configuration and a nonrecursive tool-production proof.
No LLVM input, translator, installation or operation is selected; a declared tool capability is not qualified availability.
Metadata readers/writers require complete bounded schema/provenance, producer-host widths, references and genuine record-boundary checks.
Raw .rmeta, rlib metadata and a DSO .rustc payload are not interchangeable representations.
A header/footer, GNU note or matching symbol name alone proves neither a valid full record nor genuine compiler-generated declarations/ABI.
Manual LinkPlan validation must preserve dependency formats/identities, conditional and injected roles, panic-runtime uniqueness/strategy compatibility and effective per-output settings.
Keep std/core/alloc, allocator/panic/compiler-builtins/CRT, native #[link] cfg/modifiers and producer-versus-consumer predicates in their ordered roles.
Qualify archive grouping/indexing/bundled members/LTO transformations and state boundaries; never globally deduplicate repeats or infer final arguments from declarations.
Object-only skips specified final-link checks, not every compiler check; this draft supplies no implemented metadata or LinkPlan validator.
Retain three safe Rust roots, GNU-driver linking and R1 static-PIE constraints; no fourth root, application FFI/unsafe, staticlib substitution, direct ld, musl fallback or new Cargo dependency follows.

## 5 · Sampled producer knowledge, not global selection

Research §§7–8 records **24 sampled manifests / seven declared script bodies now source-inspected**, not all actual selected/transitive units.
Historical source capture stays **24 archives / 32 texts / 171,310 text bytes**; the later **one libc copy** is outside C32, not a rewritten archive/capture count.
Std-workspace libc **0.2.178** remains distinct from application libc **0.2.191**; actual distribution/producing configurations remain unqualified.
Only the cited source fields have the existing receipt status; sample completion establishes neither installed trust nor producer closure.

Libc's initial rerun line precedes its RUSTC query with optional RUSTC_WRAPPER and a conditional second query when initial stdout starts clippy.
Only the nonempty-wrapper second form adds --rustc; absent/empty wrapper repeats the direct command, without authorizing a harness retry.
Readable LIBC_CI with no readable override can attempt bare freebsd-version; emcc or compile-time-Windows emcc.bat probing has no runtime target-OS guard.
A GNU64 library target does not exclude those probes; VxWorks environment handling also lacks a target guard.
Readable presence includes empty/0/false, four target variables default empty, and five explicit rerun invalidations are not complete environment-tracking proof.
Preregister executable/wrapper loading, context and native/descendant effects; Command.output provides no source-level query timeout/output cap, env_clear, cwd or executable qualification.
GNU time/file cfg relations and the conditional minor95 **14+3=17 check-cfg** prediction are not actual cfgs, query stdout, downstream ABI or final arguments.
Independent query status/build identity must exceed permissive or incomplete parser checks; preserve the recorded order, duplicates and failure prefixes.
Neither a successful query nor tool absence may nominate EXPECTED inputs or silently excuse an unregistered attempted effect.

Serde writes private.rs before querying; bind its exact template/patch-byte relation, protected initial OUT_DIR and still-unqualified consumer inclusion rather than treating script exit0 as proof.
Dispatch uses compiled host-unit features; helper runtime feature tests/comma membership differ from Common's literal whole-family equality test.
Preserve those source-specific relations and ordered output families without claiming pure cfg translation or bounded native startup effects.

## 6 · Phase consumption, enforcement and terminal failure

Use the existing conceptual phase model, not a new API or operational authority:
`PLANNED → INPUTS_BOUND → ATTEMPT_CONSUMED → RESULT_RECORDED → VALIDATED → RELEASED`.
RELEASED means validated build-consumer visibility, not Native authority or final independent output acceptance.
Any failure, partial result or ambiguous completion is **TERMINAL** with retained evidence, never rearm.
Consume each phase's permission before spawn and prepay each owed effect/cleanup liability before incurring it.
A failed spawn, including E2BIG, consumes the attempt; changing unit identity, representation or path never rearms it.
Include supervisor, descriptor, environment and admission/setup effects that precede spawn; naming a phase does not exempt its earlier effects.
Unregistered source/generator/edge/query/path/native inputs or missing whole-tree guarantees block **before any DAG dispatch**, not after accepting a different build.
Unknown, missing, crossed, stale or unvalidated artifacts block dependent release even when their producer exits0.
Exit0, a path, artifact digest or controller boolean is neither permission nor consumer qualification.
Exclude Cargo execution through every script, macro load, helper, descendant and failure path, not merely the controller/wrapper entry.
Use Bun/Rust for first-party tooling; dependency-owned Python is conditional on a selected audited producer and registered interpreter/closure, never fallback.
Requested cgroups, timers, kills or source guards alone prove neither effective whole-tree enforcement, G1 custody nor positive quiescence.
Every executable load, exception/failure path and surviving drain/disposal/reap duty needs qualified ownership and bounded effects.

## 7 · Gate timing and complete-F9 handoff

| Boundary | Required design/permission versus actual evidence; all unresolved |
|---|---|
| Gate0 | Independently fix expected inputs/finite inventory, complete methods/RecipeRef, current prerequisite audits/availability, nonzero disjoint tariffs/invoice and whole-feature physical fit before acceptance; no actual output/runtime proof is demanded yet. |
| Implemented revision | After separately approved implementation, preregister its exact source/test revision against the accepted plan before capture/build/runtime; no planned-file hash is invented. |
| 5a capture | Own exact common-gate approval, accepted allowlist/identities/licenses/counts/bytes and physical/cleanup bounds; no acquisition or automatic build. |
| 5b build/registration | Own exact approval after 5a under frozen expectations; actual output identities register **after approved 5a AND 5b, before 5c**, never by observed-output self-nomination. |
| 5c live qualification | Own exact approval with registered outputs; prove actual selected loading/closure/G1, original clocks, policy/init, Node/FD custody and effective controls before authority/publication. |
| 5d Native proof | Own separate approval after qualified 5c; actual positive/N9-negative canonical both-recipient/F1/reference/clean-close proof, not synthetic qualification. |

Pre-freeze mechanism/audit acceptance and later actual runtime evidence are different obligations; do not require actual 5c/5d positives to author or accept a complete design.
Reference archive/member hashes are not installed input trust or actual production-5b output identities.
The Rust closure must hand off to the full Node/reference graph, including type-only/reexports/resolution/native loaders and host/model partition.
Creator A must bind successful same-init exec before first PID-derived proc; actual B remains separately approved and prepaid.
Preserve full imported policy/pins/outputTarget/actual daemon-used init, both actual Node handles and all **six independent FD0/1/2 routes**.
This closure contract closes no G1/backing, original-S0, first-creditor, control/resource or runtime-custody gap.
Bound CPU/RSS/PID/FD/I/O/byte/inode/storage/output/elapsed across feasible overlap peaks, including capture/build/runtime coexistence and materialization.
Every failure prefix needs surviving supervisor/custody/drain/disposal/reap guarantees before liability, not eventual forced-removal claims.
Invent no fee or numerical ceiling and inherit none from temporary research-operation caps.

## 8 · Finite OPEN-obligation inventory

Every row is **OPEN**; pointers are current partial evidence, not consent, a populated unit table or completed proof.
Timing distinguishes pre-freeze contracts from later approved-production/consumer/runtime evidence.

| ID | Partial first-party basis | Missing proof and timing | STOP |
|---|---|---|---|
| U-ROOT | Canonical R1; research §5 local observations | Exact root/test/source/configuration expectations before Gate0; implemented revision before operations. | No assignment/dispatch from candidate roots. |
| U-RESOLVE | Research §5 project graph; §7 sample; §13 domains | Exhaustive project-resolver3 edges plus distinct upstream resolver/profile/patch provenance and role/feature/cfg/mode bindings before freeze/dispatch. | No package-graph, lock-wide or global-resolver shortcut. |
| U-PRODUCER | Research §5 nine-kind NodeSpec | Complete finite phase/functionality/provenance/consumer contracts before dispatch; actual outputs only under approved production. | No invented producer or premature release. |
| U-QUERY | Research §§5/8 script/query relations | Every conditional query/wrapper/native context and independent result/status/bounds contract before dispatch. | No unregistered probe or output-chosen EXPECTED. |
| U-GENERATED | Research §5 Serde; §7 comparisons | Protected initial state/template/patch/consumer constraints before dispatch; actual constrained bytes at 5b before consumption. | No alias/overwrite or unconstrained generated input. |
| U-MACRO | Research §5 auxiliary/macro frontier | Genuine declarations/export/ABI/metadata and loader/effect contracts before freeze; validate DSO before compiler load. | No unvalidated dependency-code execution. |
| U-METADATA | Research §5 decoder/version distinctions | Complete bounded schema/record provenance and reader/writer/identity joins before release method acceptance. | No prefix/header/symbol-only certification. |
| U-LINK | Research §5 object-only/final-link audit; §13 profiles/panic | Dependency/panic/native/LTO/order validator contract before dispatch; actual artifact checks before release. | No missing shim, reordered/deduplicated roles or fallback. |
| U-NATIVE | Canonical R1; research §§5/8; §13 std producers | Exact selected std/CRT/compiler/helper/library/continuing closure, provenance/licenses/security and availability before freeze. | No archive-reference-to-installed-trust shortcut. |
| U-ENFORCE | Research §5 whole-tree no-Cargo; common gate | Effective execution/filesystem/network/admission and surviving failure-owner design before dispatch; actual later evidence under own approvals. | No wrapper-only or requested-control proof. |
| U-BOUNDS | Canonical invoice/physical obligations; preflight 5 | Finite counts/maxima, first creditor/nonzero disjoint tariff and inclusive fit before Gate0; effective approved-operation bounds later. | No unpaid pre-owner effect/liability or unbounded cleanup. |
| U-HANDOFF | Canonical §8; preflight 5a–5d | Complete Rust/Node/reference/policy/init/FD/origin mechanisms before Gate0; actual identities/qualification/Native at their own later gates. | No closure-label Native or training authority. |

These identifiers organize obligation themes only; they assign no source owners, accept no records and populate no operational nodes.

## 9 · Verification and next boundaries

**Planned scenarios only · NOT AUTHORED / NOT RUN:**
- Wrong unit/feature/host role, unresolved conditional edge or unregistered generated/query/native input.
- Missing allocator, invalid metadata provenance, wrong macro ABI or dependency/panic/native-link mismatch.
- Premature script execution/compiler macro load/consumer release, illicit Cargo/descendant dispatch or reordered output.
- Successful-looking malformed/failed query, lost directive prefix, unintended write/alias or unexpected helper count.
- Failed-spawn/E2BIG retry, changed-unit rearm, ambiguous completion, supervisor/FD loss or unbounded cleanup.
Tests require their own exact source/test and run approvals; no test paths, implementation or test authorship are assigned here.
At the initial draft cut, document verification used first-party readback/link/format inspection only; no command, test, executable import, source/payload/evidence read or new hash verification occurred in that authorship pass.
Architect/devops pre-draft advisories were reported complete; **initial-draft scoped DOCS-consistency review READY, no findings** (quality **READY TO MERGE: yes**; security **READY — DOCS CONSISTENCY ONLY**); not acceptance or operational permission or review of the later §§11–13 deltas.
Any review verdict covers document consistency only, not record acceptance or operational permission.
That initial cut granted no further source/body/archive/network/query/test/implementation operation; §13 records the later continuing PUBLIC TEXT class without per-URL prompts, while nonpublic/new-local/archive/execution/acceptance crossings still need fresh scopes.

## 10 · Preserved constraints and disposition

Preserve Burn, Rust learner tests, removed ML smoke-wrapper state and all frozen N1–N10; change no source, dependency, manifest or feature selection.
Preserve full Docker policy, imported pins/outputTarget and actual daemon-used init; no reduced subset, extra application root or trust/policy waiver follows.
Keep one inclusive BOTH-seat **1_048_576-unit DIRECT** counter with disjoint new charges plus existing ledger and unchanged F1 fees.
Original S0 precedes all causal launch work; retain **S0+10s / S0+300s with final3s cleanup**, without renewed origin or meter.
Check immediately before/after synchronous F1; late postcheck revokes publication without rolling back private state or successful charges.
No input/provider/method/schema/ABI/trust/class/tariff/limit/RecipeRef/source assignment or Gate0 record is accepted.
All six GNU/source/libc A/B grants remain spent and frozen; LLVM A/B remain unapproved/unrun; the initial draft choice authorized no archive/captured-body/source read, network/download, test/query/compiler/package execution or A/B operation, while §§11–13 record later separate six-file DATA, three-page public-text and continuing broader public-text scopes.
**PROPOSED / INCOMPLETE / NOT ACCEPTED · actual unit inventory NOT_POPULATED · initial-draft/§11/§12 scoped DOCS reviews READY for their prior cuts only, not acceptance or operational permission · §13 scoped DOCS/METADATA-consistency READY, no findings; not producer/ABI/Gate0 qualification or new permission · §§14–15 latest combined DOCS/METADATA-consistency READY, no remaining findings; not acceptance or operational permission · §16 new-delta scoped DOCS/METADATA-consistency READY, no findings; not acceptance or operational permission · §17 scoped DOCS-consistency READY, no findings; not method or record acceptance.**
**R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`.**

## 11 · Six repository graph inputs · DATA audit

**2026-11-05 · OBSERVED_REPOSITORY_DECLARATIONS / SELECTION_NOT_RESOLVED / NOT_ACCEPTED · scoped DOCS/METADATA-consistency review READY, no findings; not acceptance or operational permission.**

In **Populate graph prerequisites**, Executor selected **Audit graph inputs (Recommended)** for the six named repository files as DATA only.
This fresh decision permits their bounded data/hash observations and documentation, not a source-tree walk, broader hierarchy read or input/method/trust acceptance.
This documentation pass reads existing first-party documents only; the facts below are **lead-reported**, not independent rereads or hash checks by this author.
Architect context advice preceded edits; devops compared the provided observations with first-party documentation, not the six files independently.

### Read method and observed identities

The lead reports an initial bounded Bun built-in filesystem/crypto read of all six files, using O_NOFOLLOW/O_NONBLOCK, regular-file checks and stable fstat, totaling **171,932 bytes**.
Research-only caps were **32KiB per manifest/config**, **1MiB for Cargo.lock**, **1.2MiB combined**; the implemented conservative aggregate guard was **1,200,000 bytes**, below 1.2MiB.
The lead then reread the five small files as data and made a second bounded lock read for **narrow literal-regex package-header/field extraction**, not TOML parsing or Cargo/resolver evaluation.
These are reported read-method observations, not accepted numerical Gate0 limits, a qualified production method, ancestor-path proof or whole-runtime containment.

| Named file | Bytes | Lead-observed SHA-256 |
|---|---:|---|
| Cargo.toml | 174 | `e799fac8fb82452f402f554012812af9e8f24d84dcb2682d7d8d102b068aa791` |
| Cargo.lock | 170,624 | `6907d97e5a09dc1b68f053194b50224bfba422047ca9e32e2d1b0497dac912c1` |
| packages/training/Cargo.toml | 443 | `999220960ff321a68b6714ab8d9caa58b8dfbff1eac1605512796aaa4f433198` |
| apps/arena/Cargo.toml | 378 | `b1e58e798e7752220bad8b19ca46a617f03447c571ac4a0d6d09858a8c2b0ad2` |
| rust-toolchain.toml | 263 | `bc06aaf6dd996cac05cd9bade444c98458f048b64806b8331d4e292d15c303e3` |
| .cargo/config.toml | 50 | `a10aa163b901ff3436bffa6fecd648ef5a385048bf2e91f29814d216beabebd6` |

These observed repository-file identities are **not independently accepted SOURCE/INPUT EXPECTED values**, publisher trust, G1 or protected-backing proof.
The lock identity matches the previously recorded **170,624-byte** hash; no dependency update or write to any of the six files is reported.
The lead reports **post-audit six-file byte-preservation checks COMPLETE / ALL UNCHANGED** after one more bounded read of exactly the six approved DATA files (**171,932 bytes**), with O_NOFOLLOW/O_NONBLOCK, size/stable-fstat and length/SHA-256 checks within **32KiB per manifest/config / 1MiB lock / 1,200,000-byte aggregate guard**. Reported helper reads total **514,488 bytes** (171,932 initial + 170,624 lock extraction + 171,932 postcheck), plus **1,308 bytes** of five small-file displays = **515,796 bytes** of approved DATA content, **not a whole-host physical counter**. The lead also reports MATCH for all six identity rows, fourteen named lock spans/names/versions, **666 literal package blocks / format4**, and **59 first-party Markdown link targets/anchors**, with no CR/trailing whitespace; devops did not reread the six files. Reported work remained first-party Bun filesystem/crypto/text processing, with zero package/Cargo/resolver/compiler/query/test execution, zero input writes and no other member/source/cache/installed/archive/captured-body reads. These are lead-reported preservation/document checks, not an independent recheck by this author or new G1/control/native/runtime qualification.

### Literal repository declarations

| File and cited lines | Reported literal observation; scope boundary |
|---|---|
| Cargo.toml:2–4 | [workspace]; members packages/training, apps/arena, tooling/xtask; resolver="3"; MATCH to the earlier research §5 declaration. |
| packages/training/Cargo.toml:2–7 | Package training-native 0.1.0, edition2024, rust-version1.95, publish=false. |
| packages/training/Cargo.toml:9–12 | Normal dependencies Burn =0.22.0, default-features=false, std/flex/optim/store; Serde =1.0.229 with derive; serde_json =1.0.151 with float_roundtrip. |
| packages/training/Cargo.toml:14–15 | Explicit dev dependency tempfile =3.27.0; test/target-unit selection remains unresolved. |
| apps/arena/Cargo.toml:2–7 | Package arena 0.1.0, edition2024, rust-version1.95, publish=false. |
| apps/arena/Cargo.toml:9–12 | Same Serde/JSON requests plus training-native path ../../packages/training. |
| apps/arena/Cargo.toml:14–15 | Explicit dev dependency tempfile =3.27.0; not an inventory of actual test entries. |
| rust-toolchain.toml:2–5 | Requested channel1.95.0, profile=minimal, components rustfmt/clippy; not installed-executable identity, availability or acquisition permission. |
| .cargo/config.toml:1–2 | xtask alias literal `run --frozen --package xtask --`; not permission for Cargo execution or an xtask-manifest read. |

The explicit workspace member list is not the three proposed compilation roots or a selected unit count.
No default-members/workspace.dependencies/patch/replace tables were reported **within the 174-byte root manifest**; this says nothing about ancestors or other files.
No explicit [lib]/[[bin]]/build/links/proc-macro fields were reported within the two member manifests; absence there does not prove no autodiscovered targets/scripts.
The xtask member manifest and package trees remain **UNOPENED in this scope**; earlier tree observations are not refreshed by these six reads.
Burn/default/Serde/JSON declarations MATCH the prior facts, with existing Serde/JSON defaults preserved; explicit dev dependencies do not authorize reducing required Rust tests.

### Narrow lock observations · fourteen named blocks

Cargo.lock:3 declares format version4; the literal scan reports **666 [[package]] blocks**, not 666 units, selected packages or full-tree coverage.
Only the following **14 named blocks** are projected here; this is not reconstruction of the entire lock graph or resolution of any feature predicate.

| Named block | Cited lock lines | Reported literal relation; no selection inferred |
|---|---|---|
| arena 0.1.0 | 162–170 | Dependencies serde, serde_json, tempfile, training-native. |
| training-native 0.1.0 | 5807–5815 | Dependencies burn, serde, serde_json, tempfile. |
| xtask 0.1.0 | 6877–6885 | Dependencies rustix1.1.5, serde_json, serde_yaml, sha2. |
| burn 0.22.0 | 570–584 | Dependencies burn-core, burn-linalg, burn-nn, burn-optim, burn-signal, burn-std, burn-store, burn-vision; this broader lock set does not activate every optional relation. |
| burn-backend-extension 0.22.0 | 621–630 | Dependencies proc-macro2, quote, syn3.0.9. |
| burn-derive 0.22.0 | 722–733 | Dependencies burn-einsum, derive-new, proc-macro2, quote, syn3.0.9. |
| serde 1.0.229 | 5121–5129 | Version MATCH; no complete unit activation follows. |
| serde_core 1.0.229 | 5141–5148 | Version MATCH; no complete unit activation follows. |
| serde_derive 1.0.229 | 5150–5159 | Version MATCH; the lock name alone is not a proc-macro-type proof. |
| serde_json 1.0.151 | 5161–5172 | Version MATCH; no global feature assignment follows. |
| tempfile 3.27.0 | 5498–5509 | Dependencies fastrand, getrandom0.4.3, once_cell, rustix1.1.5, windows-sys0.61.2. |
| libc 0.2.191 | 3485–3489 | Application lock version, distinct from std-workspace libc0.2.178; the earlier 0.2.178 body audit does not transfer to 0.2.191. |
| cc 1.8.0 | 1066–1076 | Literal package/version only; selected producer/tool roles remain unresolved. |
| pkg-config 0.3.34 | 4318–4322 | Literal package/version corrects the earlier 0.3.33 transcription; no execution or selection follows. |

The arena/training-native/xtask blocks contain no registry source/checksum keys; that absence establishes neither their provenance nor selected roles.
Tempfile's windows-sys lock edge does not establish Windows selection or runtime activation.
Sibling lock entries and derive-like names establish neither genuine macro types nor actual unit counts.

| Registry checksum declaration in the named lock block | SHA-256; not a captured-package or installed-byte join |
|---|---|
| tempfile 3.27.0 | `32497e9a4c7b38532efcdebeef879707aa9f794296a4f0244f6f69e9bc8574bd` |
| pkg-config 0.3.34 | `f6b464fbc74e149a392436b17d523f769e057cb6877f6a5c4618bc6f11800548` |

Repository-file hashes and registry checksum declarations do not join uncaptured package bodies or installed bytes to these observations.

### Correction, not dependency change

**CONFLICT / TRANSCRIPTION CORRECTION:** the earlier research document's line263 said **pkg-config0.3.33**, while this **same unchanged lock** declares **0.3.34** at4318–4322.
This section supersedes **that prior version statement only**; the research document remains untouched as the earlier observation, not a dependency-upgrade record.
Any projection using0.3.33 must **STOP until its corrected binding is reviewed**; no new dependency/provider selection, download, installation or pkg-config execution is accepted.
The provided comparisons report no other substantive contradiction; matching version/dependency declarations still do not qualify their producers.

### Remaining obligations and current cut

These are bounded **RootInputObservations**, not populated UnitInventory records or an accepted logical schema.
Current status is **OBSERVED_REPOSITORY_DECLARATIONS / SELECTION_NOT_RESOLVED / NOT_ACCEPTED**; actual unit inventory stays **NOT_POPULATED**.
Feature/cfg/host-target/profile/test-entry selection, genuine compiler/sysroot, producer/native/query/output bindings and full Node/policy/G1/origin/fee/limit graphs remain unresolved.
Complete target/test inventories, source/package records and unit-feature proofs need their own exact independent scopes; missing fields cannot be filled from lock inference.
Every **U-ROOT/U-RESOLVE/U-PRODUCER/U-QUERY/U-GENERATED/U-MACRO/U-METADATA/U-LINK/U-NATIVE/U-ENFORCE/U-BOUNDS/U-HANDOFF** obligation stays **OPEN**.
**This audit's scoped DOCS/METADATA-consistency review is READY, no findings** (quality **READY TO MERGE: yes**; security **READY — SCOPED DOCS/METADATA ONLY**); neither reviewer read the six underlying inputs, recomputed hashes, read source/archive/captured bodies or executed code. Identities/preservation remain **LEAD-REPORTED**, not independently verified or accepted EXPECTED values; these verdicts accept no record, runtime/graph completion or new permission and remain separate from earlier initial-contract/libc READY.
No package/Cargo/resolver/compiler/test/query/dependency code ran in the reported data audit; builtin filesystem/crypto and literal text processing supplied observations only.
The new choice supersedes only the current named repository-DATA read scope, never retroactively the initial Draft contract grant, input expectations or trust/acceptance fields.
No additional member/source hierarchy/cache/installed/archive/captured-body read, network/download, training, A/B operation or automatic follow-up is granted.
All six GNU/source/libc A/B grants remain **SPENT**; LLVM remains **NOT APPROVED / NOT RUN**; frozen evidence/preparations remain unchanged.
Preserve Burn/Rust learner tests, N1–N10, full policy/actual init, inclusive BOTH-seat **1_048_576-unit DIRECT**, original **S0+10s / S0+300s with final3s cleanup**, pre/post-F1 checks and separately approved **5a AND 5b** before actual output registration/**5c/5d**.
**R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`; DENY before any DAG dispatch.**

## 12 · Three public manifests · unresolved producer frontier

**Historical three-page cut:** its BODY_NOT_INSPECTED/read limits and scoped READY describe that cut; §13 records later public JSON/Syn/std-source observations and the continuing broader public permission without altering byte evidence.

**2026-11-05 · PUBLIC_TEXT_OBSERVED / ARCHIVE_JOIN_NOT_ESTABLISHED / UNIT_SELECTION_NOT_RESOLVED · scoped DOCS/METADATA-consistency READY, no remaining findings; public fields remain lead-reported, not independent source/byte verification.**

In **Manifest frontier research**, Executor selected **Research 3 manifests (Recommended)** for one attempt at each exact page in the order below, followed by research/closure/canonical documentation only.
[Research §9](native-ingress-gnu-source-research.md#9--three-public-manifests--unjoined-text-frontier) records the lead-observed rendered fields and section/field citations; this author performs no new HTTP, source/payload read or hash check.
These are later public-text observations, separate from the initial document-only cut and §11's six-file DATA read; those actual choices/reviews remain dated history, not retroactive HTTP grants.

| Ordered exact public page | Covered declaration frontier |
|---|---|
| 1 · [serde_json1.0.151](https://docs.rs/crate/serde_json/1.0.151/source/Cargo.toml) | package/build/lib/features/dependency kinds and seven explicit tests; new build.rs body gap. |
| 2 · [serde_derive1.0.229](https://docs.rs/crate/serde_derive/1.0.229/source/Cargo.toml) | Explicit proc-macro host candidate, build=false and dependency-feature requirements. |
| 3 · [tempfile3.27.0](https://docs.rs/crate/tempfile/3.27.0/source/Cargo.toml) | Default/optional/platform-conditioned dependencies and five explicit tests. |

The lead reports one successful webfetch markdown call per page, timeout30, with matching page heading and package.name/version; architect context advice and devops supplied-field comparison are complete without independent extra HTTP.
Three tool calls are not physical GET/redirect/native-process proof, and timeout30 is not an accepted Gate0/security/F9-clock bound.
No raw response/Markdown hash, archive-to-copy join or publisher authentication was measured; these pages are **not checksum-qualified SOURCE_FIELD evidence**.
MATCH means covered declaration/version agreement only, not unit resolution, actual cfg/features or trusted input selection.
No sidebar, feature/docs page, Cargo.toml.orig, build.rs, archive/member, installed or captured file was followed; comments/instructions remain DATA.

### Producer and unit obligations exposed by the fields

**serde_json1.0.151:** package:12–21 reports edition2021/rust-version1.71 and build="build.rs" at21; lib.name=serde_json, lib.path=src/lib.rs, with all auto-target switches=false.
At this three-page cut the script was **DECLARED / BODY_NOT_INSPECTED / ARCHIVE_JOIN_NOT_ESTABLISHED**; §13 records its later public source relation, not byte qualification or accepted effects from absent manifest fields.
Features default=[std] and float_roundtrip=[] MATCH the preserved root request; alloc/std forwarding goes through serde_core, while preserve_order=[indexmap,std] does not establish actual indexmap activation.
Requirements indexmap2.2.3 optional, itoa1.0, memchr2/defaults-false, serde_core1.0.220/defaults-false and zmij1.0 are not exact locked versions or a solved graph.
The separate target cfg(any()) serde1.0.220/defaults-false declaration is not an unconditional normal edge.
Documentation/playground feature lists and the x86 GNU documentation target are metadata, not production selection; dependency tests compiletest/debug/lexical/map/regression/stream/test and their dev dependencies do not automatically become all required first-party test units.

**serde_derive1.0.229:** package edition2021/rust-version1.71, build=false at21 and exclude=[build.rs] at22; lib.name=serde_derive, lib.path=src/lib.rs, proc-macro=true.
This is a host-macro candidate, not an ordinary library or proven DSO execution; build=false excludes no descendant producers.
Features default=[]/deserialize_in_place=[] and proc-macro2/quote proc-macro features plus syn3 clone-impls/derive/parsing/printing/proc-macro defaults-false requirements remain host-unit obligations.
Root derive and known lock-name/version agreement supplies no byte join, full feature scope, genuine declaration/export/metadata/ABI, loader/native qualification or permission to compile/load it.

**tempfile3.27.0:** package edition2021/rust-version1.63, build=false at23; lib.name=tempfile, lib.path=src/lib.rs and all auto-target switches=false, with default=[getrandom]/nightly=[].
Normal fastrand2.1.1 and once_cell1.19.0/std/defaults-false differ from target-conditioned rustix1.1.4/fs, optional getrandom>=0.3.0,<0.5/defaults-false and Windows-only windows-sys>=0.52,<0.62.
Default getrandom does not erase its unix/windows/wasi guard; rustix's unix/wasi and windows-sys's Windows predicates remain separate.
The known lock's getrandom0.4.3/rustix1.1.5/windows-sys0.61.2 satisfy those ranges, not actual activation or Windows selection.
Tests env/namedtempfile/spooled/tempdir/tempfile and dev doc-comment0.3 do not define the actual first-party required-test unit set; include globs grant no reads, and filesystem/entropy/native implementations remain uninspected.

### Disposition and next boundary

The covered comparisons report no new source-field conflict, but JSON's new build declaration adds an unresolved producer obligation outside the old sample.
Old **24 sampled manifests / seven source-inspected script bodies**, **24 archives / 32 texts plus one separate libc body**, and §11 DATA identities/preservation are unchanged; no eighth body or globally checksum-qualified count follows.
The std-workspace libc0.2.178 source audit does not transfer to application libc0.2.191; the current pkg-config0.3.34 correction still supersedes only the untouched prior research line263 version statement.
Actual UnitInventory remains **NOT_POPULATED**; all twelve U-* rows stay **OPEN**, including U-RESOLVE/U-PRODUCER/U-QUERY/U-GENERATED/U-MACRO/U-NATIVE.
Actual target/test/feature/cfg/host/profile bindings, remaining dependency coordinates/source joins, selected transitive producers, metadata/ABI/native/G1, resources/economics and full Node/policy handoff remain unqualified.
**Scoped public-frontier DOCS/METADATA-consistency READY, no remaining findings** (quality **READY TO MERGE: yes**; security **SCOPED DOCS/METADATA READY**); public fields remain lead-reported, not independent source/byte verification or producer/unit/Gate0/runtime acceptance or new permission. Neither reviewer refetched pages or recomputed hashes.
All three one-attempt public reads are spent; no other URL/navigation, retry/substitution, new source/body/member/archive/installed/captured-file read, hash check, acquisition or execution is authorized.
No package/compiler/Cargo/resolver/query/test code or training ran in the reported manifest pass, and no new operational A/B grant or accepted input/tool/provider/method/schema/ABI/trust/class/fee/tariff/limit/RecipeRef/Gate0 record follows.
Canonical §8 remains the sole acceptance ledger; future additional scope requires a fresh named decision, never autorun from this research result.
All six GNU/source/libc A/B grants stay **SPENT**; LLVM stays **NOT APPROVED / NOT RUN**; preserve all frozen preparations/evidence and Burn/Rust learner tests, N1–N10 and full policy/actual init.
Keep inclusive BOTH-seat **1_048_576-unit DIRECT**, **S0+10s / S0+300s with final3s cleanup**, pre/post-F1 checks and separately approved **5a AND 5b** before actual output registration/**5c/5d**.
**PROPOSED / INCOMPLETE / NOT ACCEPTED · R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`; DENY before any DAG dispatch.**

## 13 · Resolver domains and conditional producer obligations

**2026-11-05 · PUBLIC_TEXT_OBSERVED / BATCH_COMPLETE_PUBLIC_SOURCE_OBSERVATIONS / SELECTION_NOT_RESOLVED · scoped DOCS/METADATA-consistency READY, no findings; not acceptance or operational permission.**

[Research §10](native-ingress-gnu-source-research.md#10--expanded-public-source-batch--conditional-producer-and-resolver-domains) records ten exact public targets: lead9 (JSON script plus eight pinned Rust paths) and devops1 (Syn manifest), each once, all successful; it is the source/field citation owner for this section.
The broader canonical §8 freeform answer remains verbatim `any necessary public research is permitted, all tool HTTP GET required`; necessary PUBLIC TEXT research **continues until steered**, without per-URL questions.
This is a result cut under that existing permission, **not a new human choice**, archive/local-read grant, producer method, schema/API, identity algorithm or independently accepted input record.
All observations remain public rendered/text source, not response hashes, authenticated byte joins or installed/compiler/distribution identity; this author performed no HTTP, source/evidence read or hash verification.
Ten tool calls/timeout30 do not bound physical HTTP/redirect/native/response effects or establish S0/security limits; comments/code/unstable flags remain DATA.

### Project resolver3 and upstream std provenance are separate domains

| Domain / record | Preserved source relation | Required OPEN binding |
|---|---|---|
| Project roots/dependencies | Existing workspace resolver3, unchanged Burn defaults-false/std-flex-optim-store, Serde/JSON defaults and required Rust tests. | Exact role-scoped host/target/features/cfg/profile/dependency-unit selection before freeze; no root/config edit. |
| Upstream Rust library workspace | Pinned library/Cargo.toml resolver1, profile-rustflags source feature, std/sysroot/coretests/alloctests members and stdarch/windows_link exclusions. | Distinct source-workspace/resolver provenance, not a conflict or permission to switch the project's resolver. |
| Upstream patches | Local rustc-std-workspace-core/alloc/std crates.io patches. | Bind actual historical source/patch inputs independently; do not treat application lock/source as the same domain. |
| Upstream profiles | compiler_builtins release CGU10000; panic_abort package panic flags; dist inheritance/CGU/debug/bitcode/frame-pointer and per-package overrides. | Source defaults are not actual artifact CGUs/counts, selected panic mode or accepted app/compiler options. |
| Supplied std/sysroot artifacts | Upstream manifests/lock describe possible producers and dummy-root defaults. | Actual distribution source/build/configuration/override/feature/ABI lineage remains unknown; no source-built std or rebuild method is selected. |

No blanket resolver3 rule may silently replace upstream resolver1 provenance; no upstream default may silently replace independently fixed project bindings.
Host/target unit identities and genuine dependency bindings remain distinct even where a source domain unifies features; preserve the actual domain's qualified semantics.
R2's compiler_builtins CGU10000 is **not 10000 objects**; actual per-CGU/allocator/native/archive inventory still needs constrained production and validation.
Source -Z/profile-rustflags/public-dependency declarations authorize no unstable Cargo/compiler execution, RUSTC_BOOTSTRAP, private ABI or production-method extension.

### JSON body observation refines, but does not qualify, its producer

The historical §12 manifest-only BODY_NOT_INSPECTED cut is followed by **PUBLIC_BODY_SOURCE_OBSERVED** for serde_json1.0.151/build.rs, not an eighth checksum-joined script audit.
Source order is two print sites → var_os(ARCH).unwrap() → var_os(WIDTH).unwrap() → seven-name-ARCH OR WIDTH64 predicate → one fast_arithmetic cfg print.
Both environment reads precede the OR; missing inputs can panic after prior stdout and non-UTF-8 OsString values are not rejected by a UTF-8 conversion.
An x86_64/width32 source input still predicts64, so a width-only translator is unsound; success predicts three directives, **not actual stdout/cfg, a normative count or chosen EXPECTED**.
No explicit query/generated/native-link operation appears in that body, but startup/I/O/panic/std/native effects and fast_arithmetic consumers remain unqualified.
Before dispatch/release, bind source/context, both values/absence, exact grammar/order, permitted effects and failure/cleanup; no executable cfg-projection method is selected here.

### Syn is a helper library; proc-macro is also a feature name

Syn3.0.9 declares an ordinary library name=syn, path=src/lib.rs and build=false, while its feature named proc-macro forwards dependency features rather than declaring a proc-macro target.
printing activates optional quote through dep:quote; quote?/proc-macro weak forwarding does not itself activate it.
Default features and known Serde/Burn incoming feature requests are conditional obligations, not a complete unified host-feature assignment from equal name/version.
Register each role/profile/target/unification scope and remaining proc-macro2/quote/unicode-ident coordinate; do not fetch guessed dependency versions or infer native/descendant absence from build=false.
Syn's 27 tests/two benches, docs all-features/x86 GNU metadata and cfg(not(miri)) dev reqwest/tar/flate2/etc declarations select no production HTTP/archive helpers or automatic required project test units.
Host helper/macro DSO metadata, genuine declarations/exports, ABI/native loader closure and validation **before compiler load** remain U-MACRO/U-METADATA/U-NATIVE obligations.

### Std default producer, panic crates and native-link context

The published default-name std/build.rs plus omitted explicit std build field creates a source/default-producer provenance obligation, not proof of the installed distribution's production.
Its four initial env::var ARCH/OS/VENDOR/ENV reads require readable UTF-8; ARCH is reread for STD_ENV_ARCH after later output, so preserve both read sites and failure prefixes.
NetBSD readable-presence and the final synthetic-target lookup have different short-circuit predicates; GNU/Linux examples are conditional, not actual selected-unit cfgs.
Preserve the full supported-platform OR predicate by the pinned source reference, plus mixed cargo:/cargo:: check-cfg/cfg/rustc-env grammar and order; no observed stdout/maxima or query-free producer qualification follows.
Upstream std dylib/rlib types and mandatory unwind/panic_abort versus optional panic_unwind dependencies differ from actual panic strategy, injection, retained code and the F9 static-PIE executable constraints.
Dummy sysroot default panic-unwind, library profile panic flags and manifest empty libunwind markers are separate source inputs, not selected runtime/native producers.
panic_abort's Android-only libc and Android/zkvm alloc predicates show why flat lock lists cannot become unconditional GNU edges.
Keep std-domain libc0.2.178/cc1.2.0/shlex1.3.0 distinct from the application's libc0.2.191/cc1.8.0/shlex2.0.1 roles; libc's lock checksum declaration is not a raw-response hash or authenticated artifact join.
Unwind/panic aliases, cfg predicates and omitted build fields need full source/producer qualification; no additional panic/unwind script read or application unsafe/FFI waiver occurred.
U-LINK remains OPEN for dependency-format/genuine-metadata/injected-panic uniqueness/strategy, native predicates/modifiers/order, repeated inputs, CRT/std/compiler-builtins, archive/index/group/LTO and actual-object checks before release.
Object-only success, crate names, marker features or source profile values supply none of that manual validator or actual production-5b evidence.

### Open obligations, review and continuing boundaries

All twelve **U-ROOT/U-RESOLVE/U-PRODUCER/U-QUERY/U-GENERATED/U-MACRO/U-METADATA/U-LINK/U-NATIVE/U-ENFORCE/U-BOUNDS/U-HANDOFF** rows remain **OPEN**; their new §13 basis is partial evidence, not closure.
Actual UnitInventory remains **NOT_POPULATED**; selected unit/features/profiles, source joins, compiler/sysroot/native/ABI/G1, licenses/security/economics/physical fit and full Node/reference/policy/init/FD handoff remain unqualified.
**Scoped batch DOCS/METADATA-consistency READY, no findings** (quality **READY TO MERGE: yes**; security **READY — SCOPED DOCS/METADATA CONSISTENCY ONLY**); review covers documents/provided source fields only, not independent GET/byte/hash verification, publisher/native/producer/ABI/Gate0 qualification or new permission; older scoped READY remains separate.
No tests were authored/run, new hashes computed or source/production files assigned/created; this documentation pass verifies by first-party readback only.
Necessary public-text permission continues without per-URL prompts; automatic failure retry, nearest-version/source substitution and endpoint adaptation after refusal remain forbidden.
Nonpublic/new-local/installed/captured-file/archive-materialization, compiler/Cargo/resolver/query/test/package execution, F9 build/training and record acceptance still need fresh exact scope and applicable gates.
All six GNU/source/libc A/B grants remain **SPENT**; LLVM remains **NOT APPROVED / NOT RUN**, with no rearm or new operation granted.
No tool/provider/production method, LLVM/staticlib/musl/direct-ld path, extra root/dependency, schema/ABI/hash algorithm, class/fee/tariff/limit/RecipeRef or Gate0 record is accepted.
Preserve Burn/Rust learner tests, full N1–N10 and imported policy/actual-init/Node/FD contracts, BOTH-seat **1_048_576-unit DIRECT**, original **S0+10s / S0+300s with final3s cleanup**, pre/post-F1 and separately approved **5a AND 5b** before actual output registration/**5c/5d**.
**PROPOSED / INCOMPLETE / NOT ACCEPTED · Gate0 OPEN / R1 NOT FREEZEABLE / `trainingReady:false`; DENY before any DAG dispatch.**

## 14 · Guarded metadata · target candidates and locked frontier

**2026-11-05 · METADATA_OBSERVED / TARGET_CANDIDATES_ONLY / SELECTION_NOT_RESOLVED · latest combined DOCS/METADATA-consistency READY, no remaining findings; not acceptance or operational permission.**

[Research §11](native-ingress-gnu-source-research.md#11--guarded-repository-metadata--target-candidates-and-locked-frontier) preserves both actual choices, two full DATA-file identities, guarded inventory summary,39 exact lock projections and six registry checksum declarations.
In **Repository metadata boundary**, Executor selected **Inspect metadata (Recommended)** for the exact two DATA files and allowed package-root/src/tests/examples/benches metadata only.
No operation began after the architect's atomic-path warning until Executor selected **Guarded research (Recommended)** in **Metadata path-safety boundary**.
That choice admits the source-level observed-symlink/drift checks under **STABLE_OWNED_REPOSITORY**, with the race blind spot accepted **for research only**; it accepts no production method, trust premise, physical limit or Gate0 record.
This author uses provided lead observations/first-party docs only, never independent DATA-file, directory, source, evidence or hash reads.

### Path guard is an assumption, not an atomic authority boundary

Bun opendir reopens the pathname rather than the NOFOLLOW-checked descriptor; intervening path swaps can evade before/after lstat/fstat observations.
Source-level skip/check logic plus final observed-entry drift checks cannot prove atomic enumeration, immutable ancestors, G1 loading or a qualified kernel/API mechanism.
Research caps were manifest32KiB, lock1MiB, combined1.2MiB, at most2048 inventory records/depth16/256KiB retained pathname-type records; none is an accepted F9 physical limit.
The lead reports one inline Bun built-in filesystem/crypto operation with normal shell-tool return under a30s setting, not physical exit/quiescence or original-S0 evidence.
NOFOLLOW/NONBLOCK stable-fstat DATA reads, buffer1 streamed opendir, check descriptors, lstat snapshots, skip rules and close-once/final checks produced detected-drift none and cleanup=[], **not an atomicity proof**.
Reported file/network/package/compiler/query/test/archive/installed/captured effects are scoped to this operation: writes0, network0, executable package/Cargo/resolver/compiler/query/test work0 and no protected-body reads.
At this metadata cut, independent public agents were still working; §15 records their later batch completion, and this operation's network0 is not a global no-HTTP claim.
No proc/fd path, readlink, following-stat, hidden-tree/cache traversal or Rust/Node-body open was reported.

### Two observed DATA inputs; previous root identities are not refreshed

The operation read **Cargo.lock170,624 bytes** at unchanged SHA-2566907d97e5a09dc1b68f053194b50224bfba422047ca9e32e2d1b0497dac912c1 and **tooling/xtask/Cargo.toml353 bytes**, total **170,977 bytes**.
The full xtask digest is recorded in research §11; closure §11's earlier six-file identity table remains historical, not a fresh read/hash of training/arena/config/toolchain inputs.
xtask0.1.0/edition2024/rust-version1.95/publish=false declares exact serde_json1.0.151, serde_yaml0.9.34, sha20.10.9 requests and Unix rustix1.1.5/process.
Keep manifest requirement **=0.9.34** distinct from lock literal **0.9.34+deprecated**; preserve the build suffix and do not assert a conflict/upgrade without semver proof.
Absence of explicit lib/bin/build/links/crate-type/auto-target fields is confined to this manifest; it selects no xtask executable, F9 source/root, environment/profile/sysroot or admitted invocation.

### Metadata paths are only conditional target candidates

The **95-record** observation includes three package roots and at most depth3; compact path/type/depth/action encoding measured **8,999 bytes**, not a complete tool-response/physical-resource bound.
The docs persist a summary plus frontier table, not the complete95-record dataset or a portable evidence bundle; original95/39 tool records remain in the transcript.
Zero symlink records were observed in that limited inventory without target reads, while the pathname race remains possible.
node_modules/engine directory metadata and .gitignore filenames were skipped without cache/nonstandard/hidden-tree body traversal; Node graph/policy/effective-control facts are not refreshed.

| Observed regular paths under each root | Candidate relation, not selected units |
|---|---|
| packages/training/src/lib.rs; packages/training/src/main.rs | Conventional library/binary candidates, conditioned on prior manifest declarations and actual target semantics. |
| apps/arena/src/lib.rs; apps/arena/src/main.rs | Same conditional candidate relation, without arena source-body/configuration inspection. |
| tooling/xtask/src/lib.rs; tooling/xtask/src/main.rs | Existing workspace-member candidates, not permission to execute xtask or select every member binary. |

These **six paths are not six units or three new F9 roots**; issuer/launcher/fixed-entry assignments remain proposed and unassigned.
The reported **21 top-level tests/*.rs paths** comprise15 training and6 arena filename candidates; actual cfg/harness/target selection and test bodies remain uninspected.
Research §11 records every candidate name, including the unchanged required Rust tests; no filename observation authorizes reduction, execution or a selected Cargo test count.
Nested support/native.rs, legacy.mjs and support/economic.rs plus fixture JSON names are helper/file metadata, not automatic test roots, native proof or payload reads.
No examples/benches, root build.rs or src/bin were recorded in completed allowed enumerations; xtask/tests was not a root entry, not a failed probe or proof against other generated/explicit targets.
Existing arena Rust smoke.rs metadata is **not the removed ML smoke wrapper**; do not delete, restore or equate the artifacts.

### Locked coordinates preserve multiple versions and unresolved roles

The literal scan still reports666 headers and39 chosen name/version/start-line records; it is not TOML/resolver evaluation, a complete graph,39 units or actual source/package selection.
Keep getrandom0.2.17/0.3.4/0.4.3, rustix0.38.44/1.1.5, Syn2.0.119/3.0.9, linux-raw-sys0.4.15/0.12.1 and windows-sys0.52.0/0.59.0/0.61.2 distinct.
derive-new0.7.0's Syn2 and serde_derive1.0.229's Syn3 relations require their own incoming host/helper roles and feature-unification contexts, not name-only merging.
Known macro frontier coordinates proc-macro2=1.0.107/quote=1.0.47/unicode-ident=1.0.27 enable exact public-source research under the continuing permission, not source-byte acceptance.
Registry SHA declarations for these packages/getrandom/rustix/libc are **archive declarations only**, not observed package bodies, publisher authentication, installed trust or accepted EXPECTED inputs.
Project resolver3 versus upstream std resolver1/profile provenance, std libc0.2.178 versus app0.2.191 and pkg-config0.3.34's narrow correction remain unchanged.
Actual root/target/test/feature/cfg/profile/environment/sysroot/producer/LinkPlan/ABI/native bindings and whole Node/reference/policy/init/FD/custody/physical/economic fit remain OPEN.

### Review, ongoing public work and unchanged admission cuts

Disposition is **OBSERVATIONS_RECORDED_NOT_UNIT_SELECTION**, actual UnitInventory **NOT_POPULATED**, and all twelve U-* obligations **OPEN**; no UnitKey/invocation is completed from filenames/lock headers.
**Latest combined DOCS/METADATA-consistency READY, no remaining findings** covers research §§11–12, closure §§14–15 and corresponding canonical documents only, not independent bytes, the guarded-path assumption, producer/ABI/Gate0 qualification or new permission; previous scoped READY remains separate history.
At this guarded-metadata cut MACRO/DATALIB/NATIVE research was **IN PROGRESS**; §15 records the later24-call public batch, not a public-closure PASS.
Necessary PUBLIC TEXT HTTP GET permission continues until steered without per-URL prompts; this exact local metadata scope does not extend to further local bodies, caches, installed/captured files, archive materialization or execution.
No automatic failure retry/nearest-version substitution/refusal endpoint adaptation, new A/B operation, file/code/test creation or acceptance follows; further boundary crossings need their own exact decisions.
All six GNU/source/libc A/B grants remain SPENT, LLVM unapproved/unrun, and no source/input/key/trust/method/schema/ABI/class/fee/tariff/limit/RecipeRef or Gate0 record is accepted.
Preserve N1–N10, Burn/Rust learner tests, full policy/actual-init/Node/reference/FD handoff, BOTH-seat **1_048_576-unit DIRECT**, original **S0+10s / S0+300s with final3s cleanup**, pre/post-F1 and separately approved **5a AND 5b** before actual output registration/**5c/5d**.
Verification by this author is first-party doc readback only; no underlying reads, source/hash checks, command, test or execution occurred here.
**PROPOSED / INCOMPLETE / NOT ACCEPTED · R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`; DENY before any DAG dispatch.**

## 15 · Query, probe, write and delete obligations

**2026-11-05 · PUBLIC_TEXT_OBSERVED / 24_PUBLIC_CALLS_OBSERVED / PRODUCER_CONTRACTS_OPEN · latest combined DOCS/METADATA-consistency READY, no remaining findings; not acceptance or operational permission.**

[Research §12](native-ingress-gnu-source-research.md#12--exact-locked-dependency-public-frontier--probes-and-destructive-cleanup) preserves24 exact agent-reported tool targets:15 manifests,6 scripts and3 proc-macro2 probe-source pages, each once; textual clarification added no fetch.
MACRO11 used text/timeout60, DATALIB6 timeout30/format NOT_REPORTED and NATIVE7 text/timeout120; no count/timeout proves physical HTTP/native/output bounds, authenticated bytes or accepted F9 limits.
All three reports are complete **for this batch**, but source-field subsets are not an exhaustive effect inventory, complete producer closure, UnitList or operational readiness.
Necessary PUBLIC TEXT permission remains active without per-URL prompts until steered; this result grants no local/evidence/captured/archive/body/hash scan, execution/removal or new acceptance scope.
This author used first-party docs/provided observations only; no independent GET, source/input read, hash, command, probe or test occurred here.

### Exact source frontier does not collapse unit or feature identities

The39 lock projections enable exact proc-macro2/quote/unicode-ident/Syn2/derive-new/burn-einsum, data-library and native-manifest research, not selection of every lock package or test target.
Syn2 and Syn3 remain distinct helper roles; a feature called proc-macro does not declare a proc-macro crate, whereas derive-new explicitly declares that target.
Optional quote/weak forwarding, once_cell synchronization activators, fastrand wasm JS entropy edges, getrandom backend predicates and Rustix raw/libc branches need independently fixed incoming features/target/profile contexts.
Empty memchr libc feature does not create a libc dependency; optional dependencies without explicit feature tables are not proof of no implicit features.
Dependency dev reqwest/tar/criterion, documentation targets/all-features and getrandom's NetBSD binary-download snippets are **DATA**, not production helper selection or permission to fetch/extract/run them.
Project resolver3, upstream std resolver1/profile provenance, std libc178 versus application191, all existing requested defaults/features and required Rust tests stay unchanged.
build=false disables only a package's own script; explicit absence of a source operation cannot qualify startup, dependency loading, native implementations or descendants.

### Phase contracts required before any producer dispatch

These are **logical OPEN obligations under the existing NodeSpec**, not a new API, wire format, schema, tool assignment or implemented translator.

| Phase / source relation | Required before dispatch | Required result/release distinction |
|---|---|---|
| Direct version query | Exact RUSTC identity/context/effects, successful-status rule, full parser/version expectations and bounds, including pre-feature queries. | MAX, prefix-only exit0, ignored status and plausible stdout do not establish a genuine compiler. |
| Wrapper-dependent compile probe | Per-phase executable/prefix identity, TARGET/flags/source/sysroot/loader closure and full cumulative emission specification. | proc-macro2 uses both wrappers; Rustix only RUSTC_WRAPPER; direct version queries bypass wrappers. |
| Conditional source phase | Every branch/predicate and permitted failure/result class preregistered before effects; consume once before spawn. | Legitimate conditional phases cannot rearm a failed unit or turn spawn failure into unsupported-feature evidence. |
| Directory creation/reuse | Protected independently expected OUT_DIR/namespace/initial contents and ownership/mutator contract before create or retention. | AlreadyExists is not creator ownership or an empty/disposable directory. |
| Probe input/output | Exact source binding or stdin program, output path/format/cardinality and pre-debit write/overwrite/cleanup liabilities. | Metadata/dep-info and inherited/null/captured streams have different effects; prefix --emit is insufficient when flags append. |
| Relative following metadata | Bound package/CWD/source path and permitted following/absence semantics before Rustix's backend-sensitive check. | fs::metadata(...).is_ok is not NOFOLLOW/readability, protected backing or absence proof. |
| Recursive directory removal | A full method must first satisfy unchanged no-auto-removal/retained-failure constraints and qualified cleanup ownership. | proc-macro2 remove_dir_all of possibly preexisting OUT_DIR/probe is not admitted by source inspection. |
| Final file removal | Exact constrained path/ownership/failure contract consistent with retained evidence and quiescence obligations. | Rustix's ignored remove_file result is neither confirmed cleanup nor permission to remove anything. |

No accepted counts, tariffs or maxima are derived from source phase names, conditional branches,24 public calls or tool timeouts.
Application call counts are not native/kernel bounds; each pre-owner effect and liability must be independently classified/prepaid or refused under the unchanged first-creditor cut.
Any unresolved source/phase/query/output/native input or failure owner retains **DENY BEFORE ANY DAG DISPATCH**; unvalidated artifacts remain unavailable to consumers.

### proc-macro2 requires more than a feature-output projection

Its direct version query occurs before the proc-macro feature gate, missing RUSTC exits1 and other query/parse failure can become u32::MAX without status validation.
Conditional check-cfg16/version/semver/span relations and feature-off return therefore supply neither query-free production nor genuine source/compiler identity.
Unstable phases remove then conditionally preserve RUSTC_BOOTSTRAP; RUSTC_STAGE presence can suppress spawn or make a stable helper return true without compiling.
Those branches are DATA, not permission to set stage/bootstrap, bypass a gate, retry an operation or approve a new compiler mode.
The probe creates/reuses OUT_DIR/probe, prefixes nonempty RUSTC_WRAPPER/WORKSPACE_WRAPPER, accepts OS-string TARGET and appends all encoded flags/tokens; full argument analysis must precede compiler-capable dispatch.
After status/nonzero/spawn-error classification, recursive cleanup can remove preexisting contents; NotFound/Linux-error39 suppression and other stderr/exit1 paths establish no preservation or positive quiescence.
The three explicit Span/Literal/location/file probe source pages are not macro/native/std loader closure or absence of compiler effects.
Absence of a direct generated Rust-source write in that helper eliminates neither compiler metadata/dep-info writes nor deletion liabilities.

### Other source-specific outcomes cannot share one generic environment/query rule

Quote's missing/failed/permissive-status version path can return prefix-only; Zmij missing RUSTC exits1 but other failures become MAX, and OPT_LEVEL s/z maps to opt_level=s.
Getrandom maps missing/non-Unicode sanitize input to empty and uses substring memory matching, not comma membership or backend selection.
Rustix requires readable target fields, uses following relative arch-file metadata, conditionally probes core features and unconditionally probes NonZero formatting/diagnostic attributes, then ignores final removal errors.
Its can_compile pipes source to stdin, emits a reusable metadata path, applies only RUSTC_WRAPPER and appended encoded flags; unwrap panic, spawn/write/wait failure and wait-false need distinct outcomes.
Libc191 env_flag treats absent/exact0 as false, non-Unicode as panic and other strings as true, but this is **not every call site's environment semantics**.
Its FreeBSD/emcc guards differ from178, GNU time parsing precedes a later GNU32 guard, and enum-order sort/dedup of collected cfgs differs from178's literal sequence.
Preserve verbose/rerun/check-cfg/cfg/failure-prefix relations and version-specific helpers; no actual cfg/stdout, complete boolean-key inventory or native consumer qualification is inferred.

### Policy challenge and unresolved qualification

**Vendor automatic deletion and conditional failed-compile probes are unaccepted obligations**, not a waiver of no automatic removal, consume-once/no retry-rearm or retained ambiguous-prefix evidence.
A future method must reconcile source behavior with protected initial outputs, exact failure classes, before-effect debit, finite full-tree effects and surviving cleanup; none is selected, implemented or accepted here.
No deletion/probe/compile, source patch, RUSTC_STAGE/BOOTSTRAP shortcut, retained-root cleanup or fee-exempt private relabeling is authorized.
Macro DSOs still require genuine metadata/declarations/exports/ABI/native-loader checks **before compiler load**; compile-only production is not dependency-code-free.
Manual LinkPlan dependency/panic/native/order/archive/LTO validation and actual post-approved-production bindings remain OPEN; source bodies do not supply actual5b outputs or G1.
All twelve U-* rows remain **OPEN**, UnitInventory **NOT_POPULATED**, and actual source/feature/profile/environment/sysroot/ABI/native/ancestor/physical/economic/Node/policy/init/FD/original-clock bindings remain unqualified.
**Latest combined DOCS/METADATA-consistency READY, no remaining findings** (quality **READY TO MERGE: yes**; security **COMBINED DOCS/METADATA CONSISTENCY ONLY**); this reviews documents/provided fields for research §§11–12, closure §§14–15 and corresponding canonical receipts, not independent byte verification, producer/unit/ABI/Gate0 qualification, record acceptance or new operations. Prior READY remains scoped history; no production/test/probe implementation or evidence/data file was authored, and no captured/package/compiler/probe code was executed.
The broad public permission continues until steered, without per-URL prompts; no further local source/hash inventory, archive acquisition/materialization, package/compiler/Cargo/resolver/query/test execution, F9 build or training follows.
All six GNU/source/libc A/B grants remain **SPENT**, LLVM **NOT APPROVED / NOT RUN**; no input/key/trust/method/schema/ABI/provider/tool/class/fee/tariff/limit/RecipeRef/Gate0 record is accepted.
Preserve N1–N10, Burn/Rust learner tests, full policy/actual-init/Node/reference/FD custody, BOTH-seat **1_048_576-unit DIRECT**, **S0+10s / S0+300s with final3s cleanup**, pre/post-F1 and separately approved **5a AND 5b** before actual output registration/**5c/5d**.
**PROPOSED / INCOMPLETE / NOT ACCEPTED · R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`; DENY before any DAG dispatch.**

## 16 · Optional tooling provenance and unknown script contracts

**2026-11-05 · FOUR_PUBLIC_MANIFEST_CALLS_OBSERVED / PRODUCER_CONTRACTS_OPEN · new-delta scoped DOCS/METADATA-consistency READY, no findings; not acceptance or operational permission.**
**[Unverified] PUBLIC_TEXT_OBSERVED fields supplied by devops, not independent source-byte, producer or unit verification.**

[Research §13](native-ingress-gnu-source-research.md#13--optional-tooling-manifest-frontier--digest-and-yaml-provenance) records four exact manifest targets, each once, format=text/timeout60, heading/package MATCH, without failed branch/retry/substitution/additional fetch.
This is a separate four-manifest batch, not a rewrite of §15's24 calls; tool observations establish no physical request/redirect/native count, accepted cap or archive/local/binary/authenticated-hash join.
The coordinates already belonged to the39 authorized lock projections; optional tooling context comes from xtask's sha2="=0.10.9"/serde_yaml="=0.9.34" requirements, not root admission or dependency-unit selection.

### Existing logical obligations remain OPEN, not new types or methods

| Boundary | Unresolved producer obligation |
|---|---|
| Root/context | Independently fix incoming root/role/target/feature/cfg/profile context; workspace membership admits no xtask F9/learner root. |
| Feature activation | Bind sha2 optional asm/CPU helpers and digest implicit/strong forwarding; docs.rs all-features/GNU-target metadata selects no project configuration. |
| Own script | sha2 build=false disables only its own script; digest/serde_yaml/unsafe-libyaml omit build declarations, leaving script status UNKNOWN, not false. |
| Descendant coordinates | Manifest ranges supply no new locked cpufeatures/sha2-asm/crypto-common/block-buffer/indexmap/ryu coordinates; do not guess recursive targets. |
| Source/native/unsafe | Unread library/test/native/backend/consumer bodies and [lib] metadata do not bind whole units, native linkage or ABI/FFI qualification; publisher c2rust prose grants no application unsafe waiver. |
| Version identity | Preserve xtask =0.9.34 separately from lock/public 0.9.34+deprecated; URL %2B is encoding, not another version or conflict/upgrade proof. |

For the three missing build declarations, environment/query/wrappers/flags/streams/writes/removal/order/failures remain UNKNOWN, not audited absence; no explicit script/helper reference justified more fetching in this bounded batch.
No conventional build.rs path was probed; stop at unknown explicit versions, mismatch or scope boundaries without claiming complete graph closure or selecting a production digest/hash algorithm.
§15's proc-macro2 recursive preexisting-output deletion and Rustix ignored removal remain hard dispatch blockers under unchanged no-auto-removal/no-retry/retained-prefix policy; this batch reconciles neither.

The combined mandatory review is **READY, no findings — SCOPED DOCS/METADATA CONSISTENCY ONLY** for research §13/closure §16/the corresponding canonical marker and RESULT ONLY receipt, plus narrow earlier-cut metadata corrections; earlier READY scopes and completed DOC checks remain their prior cuts.
Source facts remain reported, not independently verified; this verdict provides no independent byte/package/producer/unit/ABI/trust/limit/Gate0 qualification, hash-algorithm selection, acceptance or new authority.

Canonical §8 stays the sole acceptance ledger; architect next-artifact advice is not human selection, an owed/private/fee-class decision, method acceptance or execution authority.
Broad necessary PUBLIC TEXT permission continues without per-URL prompts; no local/body/hash/archive/installed/captured read, test/execution/implementation, retry/removal, patch or STAGE/BOOTSTRAP bypass follows.
Actual UnitInventory remains **NOT_POPULATED**, all twelve U-* **OPEN**, and G1/native/ABI/physical/economic/producer/execution-trust qualification remains unresolved; no Gate0 record is accepted.
Preserve all §15 protected contracts, N1–N10/Burn/Rust/full policy/Node/init/FD, BOTH-seat **1_048_576-unit DIRECT**, original **S0+10s / S0+300s with final3s cleanup**, pre/post-F1 and **5a AND 5b** before **5c/5d**; six A/B grants stay SPENT and LLVM unapproved/unrun.
**PROPOSED / INCOMPLETE / NOT ACCEPTED · R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`; DENY before any DAG dispatch.**

## 17 · Preservation-compatible producer obligations

**2026-11-05 · PROPOSED / INCOMPLETE / NOT ACCEPTED · DOC PREPARATION ONLY · scoped DOCS-consistency READY, no findings; not acceptance or operational permission.**
**[Unverified] Source fields are PUBLIC_TEXT_REPORTED, not authenticated bytes, independently verified behavior or qualified unchanged scripts.**

Canonical §8 records Executor's actual **Producer draft (Recommended)** selection in **Next Gate0 prerequisite**; that choice authorizes this document preparation only, not implementation, a production method or record acceptance.
Provided advisories: architect `ses_e55bc76b2ffeK7zs71JeNm840B` preceded edits; build-domain `ses_e55a9307bffeW4mv2VyNWOm7QI` completed using DOCS only, without new source verification.
Writing these obligations satisfies none of them and qualifies neither unchanged script; all proposed mechanisms and exact ownership assignments remain unresolved.
[Research §12](native-ingress-gnu-source-research.md#12--exact-locked-dependency-public-frontier--probes-and-destructive-cleanup) supplies the existing M7/N6 field references; [research §14](native-ingress-gnu-source-research.md#14--preservation-prerequisite--source-deletion-challenge) records the preservation challenge, not additional source evidence.

### Existing logical phase model, not a new interface

Use the existing proposed NodeSpec, UnitKey, InvocationIdentity and ArtifactBinding obligations, with the existing flow:
`PLANNED → INPUTS_BOUND → ATTEMPT_CONSUMED → RESULT_RECORDED → VALIDATED → RELEASED`.
Actual UnitInventory remains **NOT_POPULATED** and all twelve U-* **OPEN**; no new state API, schema, wire format, identity/hash algorithm, numerical limit or source assignment is defined.
The source references and paths below identify existing reports, not new source/test paths, implementation owners or executable instructions.

### Seven reported source relations and current refusal cuts

| Phase | Reported source reference | Current compatibility gap | Refusal predicate |
|---|---|---|---|
| proc-macro2 direct version query | Research §12 M7: var_os RUSTC --version before the proc-macro feature gate, no wrappers/status check; missing RUSTC exits1, other query/parse failure becomes None→MAX. | Genuine executable/identity, independently qualified status/parser and complete query/native effects are unbound. | Missing any binding; MAX or feature-off cannot establish genuine query success or query absence. |
| proc-macro2 directory creation/reuse | M7 creates OUT_DIR/probe and tolerates AlreadyExists. | Protected initial contents/backing/ancestors, custodian and permitted mutators are unbound. | AlreadyExists or a fresh/private/owned-directory label proves neither protected ownership nor deletion permission. |
| proc-macro2 child outcome/conditional phase | M7 maps nonzero status and spawn error to false; first unstable phase removes RUSTC_BOOTSTRAP from the child environment; if first fails and the original var_os value is present, a second preserves it; any var_os RUSTC_STAGE presence skips unstable spawning/makes the stable helper true. | Vendor false erases operational distinctions; no independent preaccepted classifier qualifies a semantic result or successor. | Unclassified false/spawn error is TERMINAL, not phase-two permission; stage/bootstrap branches qualify no probe and authorize no bypass. |
| proc-macro2 recursive removal | M7 calls remove_dir_all(OUT_DIR/probe) after forming the status boolean, including spawn error/nonzero, before helper return and even for preexisting contents; NotFound/host-Linux raw error39 are tolerated, other removal errors print stderr/exit1. | Reachable or unresolved deletion conflicts with unchanged no-auto-removal/retained-prefix policy across all reachable prefixes; no qualified method exists. | DENY the whole DAG; an external custodian, fresh directory, post-hoc copy or late validator alone cannot permit or remedy the forbidden next source effect. |
| Rustix relative metadata | Research §12 N6: following fs::metadata on the relative architecture file, tested with is_ok, affects backend choice. | CWD/exact source/backings and permitted outcomes are unbound; following metadata is not NOFOLLOW, readability or exclusion proof. | Missing source/context/outcome bindings or treating metadata failure as qualified absence. |
| Rustix reusable probe output | N6 can_compile uses fixed OUT_DIR/rustix_test_can_compile as -o output, without exclusive/no-alias/initial-ownership proof or OUT_DIR creation; piped stdin carries the writeln program, stdout/stderr are null. | Complete executable/wrapper/argv/source/output-generation/emission/native effects are unbound; environment/spawn/stdin/write/wait unwrap panic differs from completed false. | Any missing binding/classifier or metadata-only/pure-cfg assumption from prefix flags; a reusable path does not authorize overwriting. |
| Rustix reached tail removal | N6 main's reached tail ignores the result of remove_file(probe_file()); an earlier panic need not reach that tail. | Ignored removal proves neither retention/disposal nor positive quiescence; panic establishes neither tail execution nor cleanly skipped cleanup. | Reachable or unresolved removal remains a hard policy conflict; do not claim every attempt always cleans up. |

These are source-specific obligations, not one generic producer environment boolean or cleanup rule; independently fix exact feature/target/cfg/host/library contexts before observation.
Treat deletion as potentially reachable unless an independent exclusion is proved; no feature exclusion or STAGE/BOOTSTRAP value is selected here, and present knowledge retains **DENY BEFORE ANY DAG DISPATCH**.
This is not a global impossibility claim; an exclusion needing a new environment or method selection requires a future decision, not inference from this draft.

### Logical responsibilities, not new named interfaces

| Responsibility | Required separation before qualification |
|---|---|
| Source owner | Supply provenance and complete branch/effect relations; reported source or an observed result cannot nominate its own EXPECTED constraints. |
| Controller | Bind independently accepted premises, consume once before spawn and preserve raw outcome channels; a vendor boolean cannot replace independent classification. |
| Custodian | Preserve protected backing/ancestors/descriptors, permitted-mutator constraints, evidence and surviving failure ownership throughout every prefix. |
| Validator | Check independent constraints before writes, loads and release at their respective boundaries; an artifact cannot nominate its own admissibility. |

One component may carry several responsibilities only while separating accounting and independent acceptance obligations.
Exact source owners, component interfaces and kernel/API mechanisms remain **UNASSIGNED / OPEN**, not implemented or already qualified.

### Full invocation, initial state and continuous custody

Bind executable identities, complete ordered wrapper prefixes/base arguments/appended flags, TARGET, sysroot, native/DSO effects, source/CWD and all predecessor bindings before dispatch.
proc-macro2 conditionally prefixes nonempty OS-string RUSTC_WRAPPER → RUSTC_WORKSPACE_WRAPPER before RUSTC; its reported base includes --cfg=procmacro2_build_probe, --edition=2021, --crate-name=proc_macro2, --crate-type=lib, --cap-lints=allow, --emit=dep-info,metadata, --out-dir OUT_DIR/probe, then the reported probe source; any present OS-string TARGET, including empty/non-Unicode, is appended as target input.
Rustix requires Unicode RUSTC; it uses a nonempty Unicode RUSTC_WRAPPER when supplied, otherwise direct RUSTC, and applies no RUSTC_WORKSPACE_WRAPPER; its base is --crate-type=rlib --emit=metadata --target TARGET -o OUT_DIR/rustix_test_can_compile, then encoded flags, then `-`.
Bind the Rustix stdin program's provenance and writeln newline, generated-output constraints and per-site panic/completed-false distinctions independently.

Bind all relevant environment values **and absences**, including non-Unicode and presence semantics; no common boolean convention may replace each source call site's rule.
For proc-macro2 CARGO_ENCODED_RUSTFLAGS, missing/non-Unicode or a present empty string adds no arguments; nonempty Unicode splits on U+001F and appends every token, including leading/trailing/consecutive-separator blank segments.
Rustix's own encoded-flags empty-string behavior is **UNLISTED / UNKNOWN** in the current reports; do not transplant proc-macro2's nonempty guard or authorize a new probe to fill it.
Prefix --emit does not prove complete metadata-only/no-link emission; independently fix the complete cumulative flag/emission contract rather than assuming the base dominates appended flags.

Independently fix desired invocation/output constraints before observed stdout, status or hashes; observations cannot generate their own EXPECTED identity or approval.
The proc-macro2 version query captures stdout/stderr, its probe inherits stdout with null stderr, and Rustix pipes stdin with null stdout/stderr; these reported channels are distinct obligations.
Reserve inherited/null/captured streams and all native/descendant output effects separately; no source operation count, tool timeout or output ceiling becomes an accepted bound here.
Protect initial source/output backing, ancestors, permitted writers, descriptors and continuity against symlink/hardlink/mapping/late-FD aliases and inherited writers; these obligations remain OPEN.
The research-only STABLE_OWNED_REPOSITORY pathname assumption, lstat checks and fresh-directory labels prove neither atomic backing nor G1 custody.

### Outcomes, terminal prefixes and surviving preservation duties

Preregister a complete finite conditional graph, independent result classes and every permitted successor before effects.
A qualified semantic negative MAY enable a **distinct preregistered phase** only under an independently accepted pre-dispatch classifier; that qualified result is not an operational failure, retry or permission rearm.
The classifier must distinguish semantic evidence from spawn failure, operational nonzero, malformed output and ambiguous completion before any successor is allowed.
Vendor bool/false, nonzero status, ignored query status or parser MAX alone proves no unsupported-feature result.
Default spawn/write/wait failure, panic, unclassified nonzero or ambiguous completion is **TERMINAL**; changing identity, representation, path or lock cannot rearm the attempt.
No dependent or producer successor follows a terminal prefix; unvalidated artifacts remain unavailable to consumers.

Only separately preregistered, bounded and prepaid **surviving custody/drain/reap/evidence duties** may remain; this permits no automatic deletion or ambiguous-state cleanup.
An individually authorized phase output write would still need qualified initial-state/alias bindings and could not authorize unapproved overwrites or retry overwriting.
proc-macro2 can delete before its controller sees the helper return; refusing after that return cannot protect the prefix or prevent the forbidden effect.
Any feasible method must stop a terminal prefix **before the next forbidden source effect**; listing controls does not prove the unchanged script does so, and no replacement/interposition/patch method is selected.
Exit0, suppressed errors or ignored removal cannot establish preservation or cleanup success; retained prefix and positive quiescence still require an independent method.

### Payment, release and evidence timing

Source-order query/setup/namespace/read/write/retention/native prefixes and cleanup liabilities, including controller/custodian effects before spawn.
For each owed effect or liability, require G1, the original S0, a qualified owner and its required successful paid DIRECT debit before incurring it, or **STOP BEFORE its causal owed prefix**; the first-creditor cut must already hold and an earlier debit cannot pay a different uncharged effect.
No private/fresh OUT_DIR is free by its label; no fee exemption, class, coefficient, tariff or maximum is invented or accepted.
Surviving custodians/duties need their own bounded prepaid liabilities without original-clock renewal, meter reset or renewed used allowance.
Keep the one inclusive BOTH-seat **1_048_576-unit DIRECT** counter and existing disjoint charges/F1 fees unchanged.

| Design completion and prerequisite audits before Gate0 | Evidence only under later separately approved operations |
|---|---|
| Complete independently accepted source/reachability/classification/preservation methods, source/tool availability and prerequisite audits. | Actual permitted branch/outcome/invocation identities from the approved operation, not invented observations in a design draft. |
| Qualified backing/ancestor/mutator/failure-owner and quiescence mechanisms covering every prefix. | Actual custody continuity, retained evidence and positive quiescence results at the operation's applicable boundary. |
| Finite physical overlap/count/output/elapsed bounds and disjoint prepaid liabilities under original-S0/first-creditor rules. | Actual approved-operation effects/charges/clock evidence; requested controls and exit0 alone do not qualify them. |
| Independent expected ArtifactBinding/output constraints and accepted validation/release methods. | Actual outputs arise under approved5b; registration follows separately approved **5a AND 5b**, before5c, never self-nominated EXPECTED inputs. |
| Host-script executable and macro-DSO qualification methods, including genuine metadata/declarations/export/ABI/native closure. | Validate host scripts before execution and macro DSOs **before compiler load** under their applicable approvals. |
| Ordered cfg/env/generated-artifact grammar, producer/consumer joins and validation predicates. | Validate actual ordered outputs and constrained artifact/consumer joins before **RELEASED** visibility, not from producer exit alone. |

Later5c/5d need their own exact approvals and actual runtime/Native proof; no actual5c positive is demanded prematurely to complete the design.
This draft supplies neither those design methods nor later operation evidence, and authorizes no5a/5b/5c/5d operation.

### Finite completion predicates and full-DAG refusal

Each phase row requires provenance/reachability, all inputs/effects, outcome classification, continuous custody, paid bounds, a pre-effect refusal boundary and independent validation.
For every potentially reachable source prefix, show how preservation and surviving failure ownership hold without silently permitting removal, overwrite or another producer attempt.
Missing **ANY** required relation blocks the **whole DAG**, not merely that child; all12 U-* obligations remain OPEN and actual UnitInventory NOT_POPULATED.
Composing obligations is not a proof, independently accepted method or satisfaction of an obligation.

### Scenarios only · NOT AUTHORED / NOT RUN

These are proposed refusal/evidence predicates, not implemented assertions, test counts or source/test assignments.

| Scenario | Expected refusal or independently required evidence |
|---|---|
| Preexisting output versus fresh/private directory | Refuse automatic deletion in either case; freshness/ownership alone supplies neither protected-state proof nor policy permission. |
| Symlink/hardlink/mapping/late inherited writer | Refuse uncertain aliases, backing or custodian continuity before affected source effects. |
| Wrapper-added emit/target flags; empty flags versus blank tokens | Require complete emission/argv bindings and proc-macro2's exact guard; retain Rustix's unlisted empty behavior as unknown. |
| MAX or ignored query status | Refuse genuine-query or unsupported-feature classification from fallback/parser output alone. |
| STAGE helper true without compilation | Refuse probe qualification or a stage/bootstrap bypass inferred from source return values. |
| Spawn error collapsed to false before conditional phase two | TERMINAL; no vendor-boolean successor or retry permission. |
| Operational nonzero versus semantic negative | Require the independently accepted pre-dispatch classifier for a distinct preregistered semantic phase; otherwise TERMINAL. |
| Stdin/write/wait unwrap panic | Preserve raw failure prefix and surviving duties; infer neither completed false nor a reached cleanup tail. |
| Ignored cleanup, lost prefix, post-hoc copy or late validator | Refuse retention/quiescence proof or deletion permission from errors suppressed or validation performed after loss. |
| Changed-identity rearm, unpaid setup/cleanup or late S0 renewal | Refuse before the owed causal prefix or forbidden successor; preserve consumed attempts and the original meter/clock. |

Existing Rust learner tests remain preserved and unrun here; these scenarios authorize no test file, authorship or execution.

### Current disposition and unchanged boundaries

The completed mandatory review is **READY, no findings — SCOPED DOCS CONSISTENCY ONLY** for this preservation draft/research pointer/summary223/current canonical delta, including the reviewed per-effect payment and GFM clarifications; source facts remain reported, not independently verified, with no producer-method/policy-waiver/Gate0 acceptance. Prior READY scopes and their completed checks remain separate.
This draft uses the three existing first-party DOCS/provided facts only: **new URL calls0 / new local bodies0 / new tests0**, with no command, import, new hash or underlying-data/source/evidence read.
Broad necessary PUBLIC TEXT permission continues independently without per-URL prompts, but this choice grants no new local/archive/cache/installed/captured read or execution authority.
No replacement method, patch, translator, STAGE/BOOTSTRAP bypass, custodian API, new tool/dependency, digest/schema/algorithm, tariff/limit/RecipeRef or F9 source assignment is authorized or accepted.
Preserve N1–N10, Burn/Rust learner tests, full policy/Node/reference/actual-init/FD contracts, original **S0+10s / S0+300s with final3s cleanup**, pre/post-F1 and **5a AND 5b** before actual output registration/**5c/5d**.
All six GNU/source/libc A/B grants remain **SPENT**, LLVM **NOT APPROVED / NOT RUN**; no automatic removal/retry-rearm, consumed-grant rearm, record acceptance or publishing authority follows.
**PROPOSED / INCOMPLETE / NOT ACCEPTED · R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`; DENY before any DAG dispatch.**
