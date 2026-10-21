# F9 — proposed observation, custody, meter and clock mechanisms

**[Unverified] 2026-10-21 · PROPOSAL / RUNTIME FEASIBILITY UNVERIFIED · PLAN ONLY · NO AUTHORITY-REALM SELECTION · IMPLEMENTATION + OPERATIONS BLOCKED · trainingReady:false.**

## 1. Scope, authority and publication checkpoint

This proposal develops the unresolved mechanisms in [implementation §10](native-ingress-implementation.md#10-preservation-compatible-placement--design-decision-pending); it approves no file/API/recipe/invoice or implementation.
The accepted [N1–N10 mapping](native-ingress-authority.md), identified by `bf38a0fa226d6f1cb7141742a39c6961b484e629f375365636ac7a2854c7d5df`, remains unchanged. Do not repeat mapping acceptance.
Directory A, manifest-free `tooling/native-ingress/`, remains selected for design only. A/B/C describe directory placement, never authority realms; use R-OUT/R-IN/R-NONE below.
Parent reports actual non-force publication of `83d416e7aa1a3ea41ada7d6e6905a1fe7f3b9382`, four documents/805 insertions, with message beginning `docs(training): record Rust host prep`.
Parent reports remote HEAD/local tracking equality and a clean worktree at that checkpoint, using `/tmp/opencode/f9-host-prep-publication-result.json`; no UTC timestamp or continuing cleanliness is inferred.
This is a supplied publication fact, not a keeper receipt read or verification. [M1 STOP](native-ingress-host-preparation.md#m1-recorded-execution--stop--grant-consumed) and [M2 INSTALLED](native-ingress-mise-install.md#m2-recorded-execution--installed--grant-consumed) retain their scopes and consumed grants.
Source anchors and upstream mechanisms below come from parent/advisor findings, not new measurements. Upstream documentation establishes neither local API support nor installed-daemon identity.
This proposal grants no commands, installed-root/log/PATH/control/receipt access, daemon contact, probes, capture, build or runtime operations. Lead-owned document checks remain separate from actual runtime measurements.

## 2. Independent EXPECTED versus observed ACTUAL

| Registration stage | Independently selected EXPECTED inputs | ACTUAL obligation / prohibited circularity |
|---|---|---|
| Before an approved build | Exact source/test snapshot; accepted verification policy; inventory/auditor inputs and required results; dependency lock and selected closure; compiler/configuration/tools; native libraries; core rules; fixed worker/reference entries; exact recipe and immutable RecipeRef; independently approved init SHA. | Register selection before worker claims. Worker paths/digests/output cannot choose expectations; required current audit prerequisites precede full freeze. |
| After that approved build, before launch | Preserve the first registration's exact source/recipe/policy semantics; join independently measured image configuration, ordered rootfs diffIDs/layers, local ImageID and physical archive identity to those inputs. | A fixed source-bound observer measures approved-build outputs; second registration cannot reselect source, recipe or policy to match whatever built. No self-ImageID embedded in its own rootfs. |
| During actual execution | Keep the independent references fixed and host-private. | Bind observations to owned container/attach-stream/process handles, actual root, kernel state and checked bytes; never worker-supplied PIDs, paths, digests or a serialized verified flag. |

Archive SHA, local ImageID and registry digest identify different objects. None substitutes for another; no registry ancestry or digest is fabricated.
An archive or unstarted filesystem copy does not establish live rootfs, actual init, effective policy or all loaded bytes. Docker inspection remains a trusted-daemon claim, not instruction-level attestation.
Expectations, raw inspections and retained reports are data. Only local private controls following required actual checks may permit a native operation or recipient accessor.

## 3. Candidate authority realms — none selected; feasibility unverified

| Realm | Proposed owner / observation topology | Unresolved barrier / current disposition |
|---|---|---|
| R-OUT | Host Rust owns the private session, shared meter, F1 and loans, and actually observes fixed Node container endpoints from outside. | Colocates observer/issuer/meter, but a mutable host Rust executable is not captured read-only proof. Independent immutable captured host-Rust loading and exact container/attachment→Node custody remain unresolved. |
| R-IN | Captured Rust parent, UID/GID10001:10001 under daemon init, directly owns BOTH Node children, private controls, F1 and loans. Outer trusted controller checks Docker policy/image. | Local proc/rootfs observation is simpler in principle, not proven. Causal outer checks→inner issuance/accessor gates, meter ownership and nonrenewing clocks remain unresolved. |
| R-NONE | Evidence-only diagnostic status when required actual checks cannot be reached. | Current authority disposition for every blocked candidate: no Native controls. This is neither a positive F9 fallback/pass nor a selectable waiver of N3. Executing any diagnostic still requires its separate exact approval. |

Architect `ses_ea073c0aaffen2hONzZNguuxx1` and DevOps `ses_ea073c05affeb3GoGOA6TUy953` conditionally favor R-IN for proc access.
Backend `ses_ea073c057ffeX3TGfjau9sDymo` favors R-OUT to colocate the actual observer, issuer and meter without an authority handoff. No unanimous recommendation or human realm selection exists.
No recommendation or later candidate-investigation choice can waive missing evidence. This document creates no architecture-selection record.

### R-OUT custody and confinement gaps

- Bind each independently inspected owned container and its exact attach stream to the actual fixed Node process. A Rust `Child` for Docker CLI is not a `Child` for Node.
- Host UID1000 versus container UID10001, user/PID namespaces and LSM/ptrace restrictions may deny proc access; current reachability is unknown.
- Define immutable captured loading for the host Rust observer/issuer and its native libraries; hashing a mutable host binary before/after execution is insufficient.
- State whether the two endpoints require one or two containers and how both fit the aggregate envelope. Two containers cannot silently double 2CPU/4GiB, PIDs or lifecycle allowances.
- No sudo, capability, host mount, in-container daemon socket or privileged-helper grant follows from a reachability gap.

### R-IN outer/inner causality gaps

- Candidate fixed stdin may deliver independently registered host-private expectations before either Node child starts; this is channel design only, not an existing native wire DTO or accepted setup/release API.
- No extra read-only configuration mount, writable-output authority input or daemon-socket input is permitted. Output remains output, not expectation selection.
- Audit private control-FD custody, inheritance closure and same-UID child interference. Direct ownership alone does not prove isolation from malicious peers.
- Outer full-policy/image checks must causally gate inner issuance and EVERY continuing accessor without constructing authority from outer JSON, Node objects or a verified flag.
- That causal mechanism remains UNRESOLVED; raw outer inspection/expectation data has no authority. Outer results never recreate inner capabilities.
- Keep existing economic start/open/settle/close, native protocols, Configuration26, Versions21, O9 and the AFTER-BEGIN visitor unchanged.

## 4. Future mechanism/evidence matrix — not implemented or measured

Each row requires an independently expected selection, an actual source-bound observer and a safe permission classification. Unknown or inaccessible evidence means STOP, not optimistic inference.

| Mechanism | EXPECTED selection | ACTUAL observer / measurement | Permissions classification | STOP / unresolved gaps |
|---|---|---|---|---|
| Image/process/archive binding | Registered source/recipe/configuration, ordered rootfs diffIDs, measured local ImageID/archive identity and fixed entry. | Independently inspect the owned image/container; bind exact attachment/process, actual root and kernel-opened files to the selected configuration and physical archive. | Trusted daemon claims plus conditional kernel access; no new grants. | Inspect alone is not all-loaded-byte proof; archive/unstarted copy is not live-root/init proof. R-OUT Node custody and immutable host Rust remain unresolved. |
| Full existing runtime policy | Independently bound `packages/starchess-arena/hermetic/policy.mjs::assertContainerPolicy`, including pins, outputTarget and imported bindings, plus independently expected runtime configuration. | Execute the existing bound predicate, or establish EXACT Rust correspondence and input-domain parity against the same complete inputs. Bind runtime configuration/environment separately; do not attribute checks absent from the original predicate to that function. | Checker placement/parity mechanism UNRESOLVED. | Rust subsets and boolean reports are forbidden; no protected-policy rewrite is approved. Complete security/private PID+IPC/capability/user/mount predicates and separately required configuration bindings remain mandatory. |
| Kernel identity/custody | Fixed owned processes and approved executable/namespace relationships. | Read process start identity, UID/GID, namespace inodes, cgroup membership and executable handles; direct owned Node children only where permissions allow. | Proc/namespace/LSM dependent; safe mechanism unidentified. | Caller-claimed PIDs are not custody. PID reuse, observation races, inaccessible state or lost ownership STOP. |
| Actual init bytes | Independently approved init SHA before launch, distinct from a host filename/version/commit. | Open `/proc/1/exe` in the same PID namespace; bound-hash the SAME FD and bind it to the actual process lifecycle. | Proc access conditional; no capability assumption. | Alternative actual injected read-only init-mount bytes require source/path/mount/process correspondence. `/usr/libexec/docker/docker-init` candidate and Moby version/commit are not actual-byte proof. Denied proc or unexplained mount STOP. |
| Mount tree / actual root | Exact unchanged user-bind/output and `/tmp` restrictions plus explicitly classified kernel/daemon-generated mounts. | Observe mountinfo rooted at the actual process root: proc/dev/sys/cgroup/shm/mqueue, resolver/hosts files, masking and distinct injected init mount. | Read-only kernel observation if accessible; no write probe. | Docker inspect Mounts is not the entire live tree. Unknown shadowing or writable executable sources STOP; EACCES is not EROFS proof. No extra user mounts. |
| Native mappings / backing files | Exact captured runtime/native closure and independently classified exceptional executable mappings. | Join proc maps dev/inode/offset/perms to opened read-only captured backing files through the observed root, preserving handles and custody. | Conditional maps/file access; map_files may require capabilities. | Reject deleted/unknown/memfd code unless independently classified in the selected closure. V8 JIT/vDSO are not ordinary captured files. Snapshots are not full load history or instruction/memory attestation. |
| Continuing load invariant | Audited source/runtime loading rules, not a claimed module list. | Combine fixed bootstrap, captured loader and runtime/native load constraints with actual-root/mapping bindings. | Required invariant is source/runtime audited; not established by polling. | Must explain all executable sources and changes over the entire lifecycle. Maps sampling and pre/post hashing cannot replace it. |
| Node bootstrap / emitted graph | Unchanged selected TS; captured exact AOT compiler/configuration; registered importer/specifier→module/builtin edges and formats. | Bind fixed bootstrap before hook-controlled self-claims. Synchronous registerHooks must resolve only registered edges and load-check AND SUPPLY the SAME captured bytes. | Local Node API/version support UNVERIFIED. | Unsupported CJS/vendor/addon/eval/VM, query/fragment aliases or format behavior STOP. No browser alias, patch, whitelist, constructor exception or auditor waiver. |
| Effective runtime confinement | Full unchanged policy, expected UID/GID/namespaces/capabilities/NoNewPrivs and resource values. | Observe proc status, namespace relationships and kernel cgroup controls; distinguish actual effective hierarchy from requested Docker limits. | Kernel access/controllers/hierarchy visibility conditional. | Hidden ancestors, unsupported controllers or namespace ambiguity STOP. RSS sampling/requested limits/rlimit RSS are not an enforced memory bound. |
| Mixed Rust/Node closure | Exact cfg/features, proc macros, generated/include inputs, sysroot/linker/native/data and Node runtime/type-only/reexport/conditions/host-model partition. | Independent selected-graph auditor joins source/build/runtime inputs and privileged builtin reachability to actual selected execution. | Auditor coverage is required before authority, not supplied by old TS audit. | Cargo metadata, dep-info and compiler logs contribute but are insufficient alone. Unwaived current R4 stops persist; issuers/loaders/private contexts never enter model-facing closure. |

For a fully visible applicable cgroup-v2 hierarchy, candidate expectations are CPU quota/period=2, `memory.max=4294967296`, `memory.swap.max=0`, `pids.max=256`; exact controls and ancestry still require a design and actual proof.
Docker cp cannot use proc/sys/dev/tmpfs corner cases as a workaround for unavailable live observations. Do not assume `map_files` access or add capabilities to obtain it.

## 5. Shared public meter — mandatory unresolved contract

There is ONE authoritative **1048576-unit** reconstructed-window meter for BOTH recipients. Existing F1/ledger fees compose with NEW disjoint charges; no coefficients or fit are claimed.
Before effects, classify and bound each selected parse, retention, copy, hash, comparison, binding, accessor and measurement operation as owed public work or separately supervised private native-proof work.
Actual runtime/library hashing, byte reads and control transfers require explicit quantities and source-audited charges wherever public work is owed. Count copies in BOTH transfer directions and failure prefixes.
Separately declared private physical work is neither free nor unbounded; it cannot absorb R4/public work by calling it native or generator work. The separate generator2048 does not fund ingress.

| Candidate | Meter ownership obligation | Unresolved STOP |
|---|---|---|
| R-OUT | Local Rust owns actual observation, private issuance and existing F1 transaction meter. | Exact disjoint schedules and physical bounds remain unknown, including outer launch/observation work before any paid transition. |
| R-IN | Preserve one authoritative meter even when outer public startup work occurs before the inner meter exists. | Causal precharge ownership, handoff/reservation semantics and failure atomicity are UNRESOLVED; no accepted bridge or API exists. |

Two independent 1M meters, arbitrary `remainingUnits` JSON, a verified flag, post-hoc billing/refunds or a startup exemption cannot solve R-IN.
Existing F1 takes local `&mut LedgerWork`; no existing remote-charge facility may be assumed. Reservation/ownership proposals must preserve exact existing F1 semantics and fail before owed effects.
Byte/frame/scalar/allocation quantities, coefficients, bounds and failure-prefix schedules must be source-audited later. Operation counts, logical counters and metadata alone prove neither invoice completeness nor fit.

## 6. Absolute clocks and aggregate physical envelopes — mandatory unresolved contract

ONE absolute cold **10s** starts BEFORE outer launch/native initialization/window/reference comparison. No helper/RPC/inner startup resets it; lifecycle **300s** includes reserved **3s** cleanup.
R-IN requires a nonrenewing cross-realm clock bridge for issuance and every accessor, including any outer refresh channel. Serializing Rust `Instant` is not such a bridge; wall-clock `SystemTime` is not assumed monotonic.
Optional investigation candidate: conservative intervals from `/proc/uptime`, only with kernel-validated same time-namespace identities and bounded observation uncertainty. This is not selected, validated or an accepted clock API.
Clock-bridge semantics remain UNRESOLVED. An outer 10s timeout alone does not prove that inner accessor gates refused before the absolute deadline.
Existing R3 startup10s/permit10s/match300s-from-ready remain distinct and unchanged; `Transaction::new` cannot renew work or time.

| Physical roles / resources | Required aggregate design | Current gap |
|---|---|---|
| Outer host/controller, captured Rust parent, BOTH Node children, daemon init and helpers | CPU/RSS/PID/output/time/storage peaks and all coexistence; explicit container topology and lifecycle owner. | No role is unbounded or silently outside the envelope; two endpoints do not double 2CPU/4GiB/256 PIDs. |
| Build/capture/archive/runtime storage | Exact selected counts/bytes, staging/copies, ordered layers, archive and simultaneous build/runtime peaks. | M2 installation and old VFS indicators prove neither current effective capacity nor capture closure. |
| Enforcement and teardown | Safe audited enforcement, fail-closed gates and owned process-tree close/EOF/reap within reserved cleanup. | Effective aggregate enforcement facilities and safe Rust implementations remain unidentified. A timeout request is not kernel completion/reap proof. |

## 7. Safe-Rust and immutable-source boundaries

Parent source anchor: `apps/arena/src/lib.rs:2` contains `#![forbid(unsafe_code)]`. Preserve that boundary.
Do not implicitly introduce unsafe prctl/pidfd/syscalls, new crates/dependencies, cgroup delegation or privileged helpers. A later design must name a safe audited mechanism or STOP; none receives approval here.
Keep the complete existing policy predicate unchanged, including its imported inputs. Checker location/exact Rust parity remains a mechanism question, not permission to rewrite protected policy.
No source file is assigned here. Directory A adds no manifest/importer/lockfile, old-v11 coverage, third diagram owner or planned-source coverage; diagrams/index remain untouched.

## 8. Native/F1 lifecycle preserved — not a new protocol

1. Fixed captured worker and independent reference use existing `economic.start`, standard-v1; BOTH canonical initial recipients satisfy D4/B3, endowed paid basis0 and initial grants0.
2. Compare COMPLETE native state, banks, rules, raw results, views, begin/resolve, contexts, grants and boundary ordering; worker output is never the expected oracle.
3. Reference imports neither EconomicWorker nor EconomicReplay. Shared core/projector remains a common-model limitation, not independent proof of those implementations.
4. Perform exactly one `economic.open`, empty-pass `economic.settle` and `economic.close`. No model/A2 work or rewritten producer/projector bodies.
5. Retain actual ORIGINAL wire-boundary spans from bounded checked frames, not reserialized reports. Wire encoding and ledger canonical encoding incur distinct applicable work.
6. Own ONE `FeatureInputPair`: initialize1, advance2; no `analyze_record` shortcut, duplicate HistoryPair or second ledger fold.
7. Publish both-seat successors atomically; charge only permitted immediate identical replay without reissuing facts. Bind recipient/session/context/cursor/exact bytes and continuing execution custody.
8. Private synchronous loans recheck live authority before/after callbacks and EVERY accessor. RAII releases on exit/unwind; reject nesting, staging or commit while borrowed.
9. Close BOTH children with clean EOF/reap; lost custody, death, poisoning, mismatch, inherited pipes or failed cleanup revoke controls and invalidate proof.
10. Retained report bytes are never live permission; synthetic negatives never establish positive authority. No Deserialize/public literal/verified-flag construction or outer-result capability recreation.

Preserve native DTOs/protocols, Configuration26/Versions21, O9/amendmentRef and existing nonterminal AFTER-BEGIN `visitR3EconomicInputs`; initial Rust verification is separate and never invokes that visitor early.
One positive pass would not prove complete origin/promotion/casualty/mine/closeout/A4 spatial behavior, full D1 scalar accounting or whole-model closure.

## 9. Definite next design work — not an operations packet

First resolve mechanism contracts: compare R-OUT immutable-host/loading and container→Node reachability against R-IN outer→inner causality, shared-meter and absolute-clock bridges. Inaccessible obligations leave R-NONE evidence-only status, not permission to execute diagnostics.
Then specify independent RecipeRef/exact recipe, installed-byte allowlist/licenses, captured compiler/configuration, build/runtime native graph and resource/invoice contracts, using only later separately approved observations where necessary.
Required current source-audit prerequisites and exact contract design precede full freeze. Actual new F9 loading/mixed-graph/enforcement/init/native proof follows separately approved implementation AND operations; it is not circularly required to preexist implementation.
No issuer may succeed before its required actual checks pass. Missing mechanisms STOP full freeze; choosing an investigation priority never waives accepted barriers.

If a later review needs a priority decision, these are OPTIONAL investigation proposals, not a new planning-direction approval request:

| Priority | Design-only investigation | Excluded authority |
|---|---|---|
| Develop R-OUT contract | Specify immutable host Rust plus exact owned container/attach→Node binding and proc reachability requirements. | No architecture/auth selection, helper grants or execution permission. |
| Develop R-IN contract | Specify outer-check causality, FD custody, one-meter precharge ownership and nonrenewing clocks. | No serialized authority, new accepted APIs, implementation or operations. |
| Design capability-reachability diagnostic-only packet | Describe a future bounded permission-classification packet and refusal interpretation. | No executable packet, probe approval, positive F9 fallback or N3 waiver. |

### Selected next priority — planning only

| Date | Actual choice | Effective scope / exclusions |
|---|---|---|
| 2026-10-21 | `Plan feasibility (Recommended)` | Develop the [bounded feasibility-metadata contract proposal](native-ingress-feasibility.md), initially one proposed fixed-socket GET /info. Priority only: no realm/architecture acceptance, implementation, daemon contact, probes, root inspection or diagnostic execution. |

The priority selection itself granted no operation. After measured collector/entry registration,181 network-free VM cases and final byte reviews, Executor separately approved one exact metadata query. Parent reports `F9_FEASIBILITY_BYTES_OK`, one frozen entry invocation and exit0/OBSERVED_METADATA; the [filtered result and consumed grant](native-ingress-feasibility.md#14-recorded-metadata-observation--one-query--grant-consumed) record reported Docker29.7.2/API1.55 and cgroupfs/v2. Matching kernel strings do not establish common namespaces or proc access; rootless remains UNKNOWN. No realm is selected, no root/path inspection or follow-up is authorized, and R-OUT/R-IN causality, loading, single-meter and deadline mechanisms remain unresolved. Reviews are not continuing operational permission.

## 10. Source and documentation anchors — supplied, not reread or probed

- [Accepted N1–N10](native-ingress-authority.md); [implementation/file-map history](native-ingress-implementation.md); [traceability owner](../ml/native-ingress-authority.md); [offline-capture approach](native-economic-ledger.md#91-future-image-authority--offline-local-capture-selected).
- [Complete policy source](../../packages/starchess-arena/hermetic/policy.mjs), [safe Rust boundary](../../apps/arena/src/lib.rs), [F1 local ownership](../../packages/training/src/feature_input.rs), [legacy transport](../../apps/arena/src/worker_transport.rs), [legacy reconstruction](../../apps/arena/src/economic.rs). These identify supplied source contracts, not new observations.
- [Node synchronous registerHooks](https://nodejs.org/api/module.html#moduleregisterhooksoptions): future API contract only; local support unknown.
- [proc exe](https://man7.org/linux/man-pages/man5/proc_pid_exe.5.html), [maps](https://man7.org/linux/man-pages/man5/proc_pid_maps.5.html), [mountinfo](https://man7.org/linux/man-pages/man5/proc_pid_mountinfo.5.html), [map_files](https://man7.org/linux/man-pages/man5/proc_pid_map_files.5.html): kernel observation semantics and permission limitations.
- [Linux proc](https://docs.kernel.org/filesystems/proc.html), [cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html), [Docker cp corner cases](https://docs.docker.com/reference/cli/docker/container/cp/#corner-cases): mechanism limitations, not current capabilities.
- [Moby v28.5.1 oci_linux.go](https://github.com/moby/moby/blob/v28.5.1/daemon/oci_linux.go): reviewed-version init injection reference only, NOT installed-daemon identity or actual init-byte evidence.

```text
notEstablished:
  full-training-closure
  genuine-native-authority
  whole-decision-adequacy
  calibration
  training-readiness
trainingReady: false
```

No collection, fitting, calibration, training, activation, deployment, security-posture change, installed-root rescope or Native/readiness claim follows. All candidate feasibility remains UNVERIFIED; no runtime checks are claimed.

## 11. Document checks and scoped review

Lead checked the three-document continuation scope, complete published PLAN suffix and implementation-plan prefix preservation, accepted bf38/M1/M2 program identities,16 local links/anchors and whitespace. Those document checks passed; runtime tests were not rerun and no installed-root, daemon or process-observation probe ran.

Read-only Adversarial `ses_ea060df5bffeS6ypJslTrwcdVH` and Security `ses_ea060df55ffebEUkYELHcyU2hn` reported no findings, DOCS READY yes and READY TO PRESENT design priorities yes. These reviews do not approve an authority realm, implementation, inspection or operations. This mechanism continuation is subsequent uncommitted planning work, not part of publication `83d416e7`.

## 12. Sole-owner accounting, custody and deadlines — conditional design continuation

**[Unverified] DIRECT SAME-COUNTER ACCOUNTING SELECTED FOR DESIGN ONLY / NOT IMPLEMENTED / AUTHORITY REALM UNSELECTED / FULL PLAN UNAPPROVED / IMPLEMENTATION + OPERATIONS BLOCKED · trainingReady:false.**

The [ownership selection ledger](native-ingress-ownership.md#12-selection-ledger--direct-accounting-design-only) records Executor's2026-10-21 instruction excerpt `Apply direct software accounting`, not a synthetic TUI option. Direct SAME-COUNTER accounting is now selected FOR DESIGN: ONE `LedgerWork`, inclusive 1_048_576 units for BOTH seats, ONE `FeatureInputPair` and the original clock origin. Every owed F1 and disjoint new binding/control/read/decode/copy fee is precharged on that SAME counter BEFORE effects. No selected-path per-recipient/helper/separate meter, refusal replacement, reset, refund, prepaid reservation or subcounter follows. Existing public ledger APIs/`with_limit` remain unchanged for other consumers/tests; no global API ban is imposed. Exact fee values, the full source-audited direct invoice, quantities and resource fit remain OPEN.

Conditional prepayment, conservation, stranded-capacity counterexample and the intact arithmetic model remain HISTORICAL UNSELECTED COMPARISON, not a fallback/switch or selected Native constructor. Neither arithmetic nor a detached reservation object supplies Native authority, cross-realm causality or a clock bridge. The former three-priority presentation and §11 ownership reviews are preselection history, not review of this selection delta. No R-OUT/R-IN realm, full file/API/recipe/invoice plan, accepted constructor, Native context/public protocol or source implementation is approved. The software-work counter is not gameplay gas/minerals; no gameplay rule, feature count, horizon, H1, learning recipe, currency or native-income change follows. Strategy waiting adds no lookahead or Native-AI training authorization.

The continuation specifies absorbing revocation, exclusive validation before potentially reaping polls, no PID use after reap, normal-close revocation before wait and original-`t0` pre/post-call/accessor deadlines. Actual container→Node/stream/captured-FD custody, immutable backing/continuing loading, safe observation and aggregate physical bounds remain unestablished. Synchronous F1 success followed by a late check may change private state without external publication; no whole-transaction rollback is promised.

Next design work resolves actual custody, immutable loading, safe observers, full-policy/init mechanisms and source-audited direct invoice/quantity/resource obligations with required current audits. Actual new F9 proof follows separately approved implementation and operations, not circular preimplementation proof. The accounting selection forces no R-OUT physical realm and waives no missing check. Preserve charged immediate identical N5 replay and logical-not-total-call/physical-cap distinctions.

Parent reports published `ae80f3c8e773f090553d53cf5ab381b93b76d956` as the matching remote/local clean checkpoint; [ownership provenance](native-ingress-ownership.md#1-scope-provenance-and-unchanged-boundaries) records the supplied fact without receipt access. This appendix and the new ownership draft are subsequent unpublished planning. The published bytes above remain unchanged. Directory A remains design-selected only; accepted N1–N10, F1 fee profiles/source/calls, cold absolute10s, lifecycle300s including reserved3s cleanup, separate generator2048, no refund/no extra1M, O9/native DTO/Configuration26/Versions21/public nonterminal AFTER-BEGIN visitor and all five exclusions remain unchanged. All M2/query/receipt grants remain consumed; no new probe, source change, capture, build, training, activation, deployment or runtime operation follows. The four continuation drafts remain uncommitted after `ae80f3c8`; no automatic commit, push or publication follows. Parent owns current PLAN-prefix updates and selection-delta review. The persisted arithmetic model's parent-reported561348 assertions remain model-equation evidence only, not a new run or actual Rust/F1/custody/native verification.

## 13. Immutable owner launch — prerequisite design pointer

**[Unverified] DESIGN ONLY / LOADING + CUSTODY GATES STOP / NO QUALIFIED LOCAL MECHANISM / AUTHORITY REALM UNSELECTED / FULL PLAN + IMPLEMENTATION + OPERATIONS UNAPPROVED · trainingReady:false.**

[Ownership §13](native-ingress-ownership.md#13-immutable-rust-owner-launch--first-prerequisite-contract) specifies the first prerequisite: independently selected captured Rust-owner loading with qualified backing and continuing N3 closure. It records conditional ordinary static-main kernel exclusion, the parent-verified upstream v7.0 HSM exception, sealed-memfd and existing fs-verity alternatives, G1–G5 trust/accounting gates, conditional unselected R-OUT custody and private-interface semantics. These supplied source mechanisms are not local kernel/configuration/permission evidence. A mutable host executable, read-only FD, chmod or pre/post hash remains insufficient; unknown qualification means STOP, not Linux-wide impossibility.

Root A and the actual DIRECT same-counter selection remain unchanged; no realm or complete file/API/recipe/invoice plan is approved. The three new mechanism-design options require parent review before any later user question and select no dependency, provisioning or operation. All existing M2/query/root/receipt grants remain consumed. Published prefixes, accepted bf38/N1–N10, all fees/caps/clocks, policy/protocols, the intact model and its historical561348 assertions, and all five exclusions remain untouched. No new check, source read, probe, build, capture, access grant or positive Native proof follows. Parent owns PLAN and review; `trainingReady:false`.

## 14. Sealed launch — selected design source catalog

**[Unverified] ROUTE B SELECTED FOR DESIGN INVESTIGATION ONLY / NO LOCAL QUALIFICATION / AUTHORITY REALM UNSELECTED / FULL PLAN + IMPLEMENTATION + OPERATIONS UNAPPROVED · trainingReady:false.**

The [ownership §14 ledger](native-ingress-ownership.md#14-sealed-launch-selection-ledger--design-investigation-only) records Executor's2026-10-21 instruction excerpt `agreed, proceed with your choice`, bound to the prior recommendation `Design sealed launch`, not a literal TUI selection. It supersedes §13's pending-fork language: B is design-selected; protective backing A/fs-verity and C remain preselection history, not active fallback routes. Root A and DIRECT accounting remain unchanged; R-OUT/R-IN and the complete plan are not selected.

The [sealed-launch dossier](native-ingress-sealed-launch.md) catalogs supplied upstream safe nix0.31.3 memfd/seal/exact-FD exec APIs, unsafe experimental rustix runtime exec rejection, proposed single syscall-dependency entry and future platform qualification. The prior GitHub404 is historical, not proof of missing implementation. A safe exported exec call replaces the process; it does not construct a Child or preserve an old active meter/supervisor. These source facts qualify neither installed bytes nor actual kernel/configuration/permissions.

Staged obligations preserve independent static-artifact expectations, verified W/G/S seals before same-FD digest, exact-object launch/binding-FD custody and owner-paid actual-executable dev/inode comparison. Bounded fixed-artifact preparation remains a PROPOSED classification, not a public-fee exemption; pre-owner owed effects mean STOP. Trusted launch, safe handoff/spawn, original clock origin, exact dependency/interfaces, closure/recipe, fees and physical envelope remain open before code/build/full-plan freeze. No Native endpoint controls follow without all remaining actual policy/init/Node custody/graph checks.

No command, test, hash, agent call, new source/web read, installed-root/proc/PATH/log/control/receipt/socket/daemon/network access, dependency/manifests/lock/source/gate/index/diagram edit, capture, build or runtime operation follows. Published prefixes, accepted bf38/M1/M2/feasibility raw programs, fees/caps/clocks, policy/protocols and exact historical model remain unchanged. No escrow/subbudget/replacement/restored meter or cross-exec work state follows. All five exclusions remain; `trainingReady:false`. The dossier is the fifth continuation draft; parent owns PLAN and later reviews.
