# F9 — sealed native-owner launch: design investigation and API catalog

**[Unverified] 2026-10-21 · ROUTE B SELECTED FOR DESIGN INVESTIGATION ONLY / NOT IMPLEMENTED / NO LOCAL QUALIFICATION / FULL PLAN + IMPLEMENTATION + OPERATIONS UNAPPROVED · trainingReady:false.**

## 1. Selection, provenance and scope

| Date | Actual instruction excerpt | Binding recommendation | Effective scope |
|---|---|---|---|
| 2026-10-21 | `agreed, proceed with your choice` | `Design sealed launch` | Route B: develop the sealed-executable launch DESIGN; not a literal TUI selection, full-plan acceptance or execution grant. |

The [ownership §14 ledger](native-ingress-ownership.md#14-sealed-launch-selection-ledger--design-investigation-only) owns precedence over §13's preselection fork.
Root A, manifest-free `tooling/native-ingress/`, and DIRECT same-counter accounting remain selected for design only.
Route B is a launch-mechanism investigation, not R-OUT/R-IN architecture selection, an accepted Native API or a new directory choice.
Protective backing A, existing fs-verity and scope-frozen C remain preselection history, not active fallback routes.
This dossier becomes the fifth continuation draft; the four existing drafts remain retained and unpublished after the supplied `ae80f3c8` checkpoint.

Research comes ONLY from supplied parent reads and read-only advisors: Architect `ses_e9fab3c82ffeXhVizMbkVgTQ7Q`, Backend `ses_e9fab3c4effeJNU8NRoSTtUd8q`, DevOps `ses_e9fab3c46ffexy4VZCcqDwTEhD`.
The parent directly checked the critical nix safe exec API, flags and rustix unsafe runtime source.
The keeper fetched no URLs, reread no source, and performed no local probes, commands, tests, hashes, Git actions or agent calls.
Upstream source/API facts do not qualify installed bytes, cache, configuration, kernel semantics or actual permissions.
All M2/query/receipt grants remain consumed; reported kernel7.0.12 and Docker29.7.2 are old metadata, not runtime qualification.

## 2. Frozen resources and authority boundary

ONE direct `LedgerWork` retains inclusive1_048_576 units shared by BOTH seats, unchanged F1 fees and all owed disjoint public work.
No escrow, subbudget, helper allowance, refund, replacement meter, serialized/restored meter or assumed work-state continuation across exec is selected.
Preserve cold absolute10s, lifecycle300s including reserved3s cleanup, and separate generator2048; the generator does not fund ingress.
Preserve `#![forbid(unsafe_code)]`, existing capabilities/security policy and aggregate resource caps; missing mechanisms mean STOP, not privilege changes.
Accepted N1–N10/bf38, O9, native DTO/protocols, Configuration26, Versions21 and public nonterminal AFTER-BEGIN visitor remain unchanged.
No A2/model-history preparation, collection, fitting, calibration, training, activation or deployment follows.
This document changes no source, manifest, dependency, lockfile, diagram, coverage index, gate or frozen program.
It grants no installed-root/proc/PATH/log/control/receipt/socket/daemon access, network operation, acquisition, build, capture or execution.

## 3. A — independent artifact and closed native graph

Register independent expected source, exact build/native closure, ELF digest AND length, recipe and policy BEFORE runtime claims.
First investigate a compatible NATIVE STATIC ELF: actual artifact has no `PT_INTERP` and no `DT_NEEDED`.
Audit late dynamic loading, plugins, scripts and executable helper edges; metadata alone does not prove the runtime closure.
GNU Rust installation does not establish available static libraries, a suitable linker, an extra Rust target or a static output.
Missing compatible inputs mean STOP; no installation, download, target acquisition or alternative build fallback follows.

A dynamic interpreter/DSO alternative is NOT selected and cannot become an automatic fallback.
A separate later design must protect the actual selected loader and every executable library BEFORE loading, plus continuing resolution.
Sealing only the main ELF cannot establish N3's complete continuing native-loading contract.

## 4. B — bounded artifact preparation: proposed classification, NOT accepted

Preparation may propose handling fixed artifact/recipe/software bytes ONLY, with no R4 history, boundary, recipient, live window or model data.
Its output is immutable material, not Native permission, live execution proof or an accepted authority constructor.
Declare finite physical CPU/RSS/PID/time/output/FD/count/staging/storage and peak-coexistence bounds before acceptance; this dossier invents no numbers.
Ordinary capture/provisioning may be proposed as a separate bounded pre-Native physical stage.
That label NEVER automatically exempts public copying, hashing, selection or binding fees.
Classification outside accepted N3/N4 requires a narrow explicit policy decision and the full accepted recipe before operations.

If any pre-owner operation owes public work, STOP before its effects; no post-hoc debit can repair it.
Do not create an active Rust meter/custody supervisor and then re-exec it while assuming its state survives.
No counter snapshot, restoration, replacement, prepayment bridge or serialization supplies DIRECT continuity.
Preparation permission also remains separate from model-history/A2 permission, which is not granted.

## 5. C — seal and authenticate the exact object

| Ordered proposed step | Required condition / STOP |
|---|---|
| Create object | Explicit `MFD_EXEC \| MFD_ALLOW_SEALING \| MFD_CLOEXEC`; unknown effective policy or unavailable reviewed flag API means STOP. |
| Populate | Copy exact independently registered bytes under hard artifact-length and buffer caps; no truncation/clamping or self-selected digest. |
| Quiesce writes | Remove the preparer's shared writable mappings before content sealing; do not unmap unknown actors' mappings. |
| Seal content | Add `F_SEAL_WRITE \| F_SEAL_GROW \| F_SEAL_SHRINK`, then read back and require ALL THREE before digesting. |
| Proposed strengthening | Freeze executable mode with `F_SEAL_EXEC` and finalize with `F_SEAL_SEAL`; qualify the exact safe API/constants first, then read back the complete W/G/S/EXEC/SEAL mask. |
| Authenticate | Hash the sealed object through the SAME FD and exact length against independent expected source/build/artifact inputs. |

`F_SEAL_FUTURE_WRITE` alone is insufficient because existing writable mappings can remain.
`F_SEAL_SEAL` prevents further seals; it is not a content seal and must not be added prematurely.
Existing seals are already irreversible; finalization is not what makes WRITE/GROW/SHRINK irreversible.
Unknown policy, `EBUSY`, writable pins, length/digest/seal mismatch or unsupported behavior means STOP, not policy relaxation or guessed repair.
Exact EXEC-seal interface qualification remains open; this catalog does not promise an unseen source API.

## 6. D — same-object FD launch and descriptor custody

The fixed approved launcher must privately own the prepared `OwnedFd` and consume the prepared object through an exact native-FD syscall.
Use no shell, pathname reopening, `/proc` execution fallback or caller-selected arbitrary executable FD.
The execution FD retains CLOEXEC; deliberately keep ONE allowlisted binding FD to the SAME object non-CLOEXEC across native exec.
Close unrelated FDs; the exact duplication/handoff API, descriptor inheritance audit and startup-environment role remain unfrozen.
A descriptor SLOT number is not provenance and must not become a public arbitrary-FD CLI selector.

Safe `execveat` replaces the current process and never returns success; it does not spawn or construct a `Child`.
Ordinary failure returns an error; rare post-teardown failure can terminate the process instead of returning to the old supervisor.
An independently owned outer observer must treat resulting death/EOF as STOP, not preserved supervisor authority.
An existing outer `Child` may continue tracking the same child across exec, but no approved spawn/helper mechanism currently establishes that topology.
Define an independently owned launch-staging role before child exec; no unsafe fork/`pre_exec` or convenient Node helper is authorized.

## 7. E — actual owner initialization and live executable binding

After independently trusted loading, the owner creates ONE work counter and records `t0` BEFORE any OWED public read/hash/compare/check/copy.
Precharge inspection of the inherited binding object's type, seals, exact length, digest and independent source/build expectation.
Open actual kernel `/proc/self/exe`; retain and inspect that SAME FD rather than resolving and reopening a pathname.
Compare its live `(dev, ino)` identity with the inherited sealed object, not merely equal hashes.
An identical-byte copy on a different object must fail; bind handle lifetime so descriptor reuse cannot masquerade as continuity.
The kernel/proc view must be genuine and already permitted; no new mount, access grant or local probe follows.

Initial checker trust rests on the independently registered captured artifact and trusted host/kernel/launcher selection.
A blind self-hash cannot authenticate arbitrary code already executing as the checker.
Object identity/seals do not attest private process memory or exclude ptrace; the closed graph and declared host premises remain necessary.
No endpoint Native controls may exist until remaining F9 full-policy/init, actual Node custody, graph and continuing checks pass.

## 8. Clock and bootstrap contract — OPEN

The applicable cold10s/lifecycle300s launch origin may precede owner entry; creating local `t0` cannot silently exclude earlier load/startup time.
Specify an accepted nonrenewing timing contract that preserves that earlier origin at every required gate.
No fresh10s after startup, serialized `Instant`, remaining-milliseconds flag or handoff-generated deadline is accepted here.
Exact startup timing/control gates remain OPEN; selecting route B approves no timing solution.
Work state is NOT transferred across exec; timing cannot justify a restored/fresh replacement meter.
Any unclassified pre-meter public operation or unsafe actor stage means STOP.

## 9. Supplied safe-API catalog — upstream signatures, not dependency approval

| Crate / API | Signature and feature | Safety / disposition |
|---|---|---|
| rustix1.1.5 `fs::memfd_create` | `<P: path::Arg>(name: P, flags: MemfdFlags) -> io::Result<OwnedFd>`; `fs` | SAFE exported call; candidate creation only. |
| rustix1.1.5 `fs::fcntl_get_seals` | `<Fd: AsFd>(fd: Fd) -> io::Result<SealFlags>`; `fs` | SAFE exported call. |
| rustix1.1.5 `fs::fcntl_add_seals` | `<Fd: AsFd>(fd: Fd, seals: SealFlags) -> io::Result<()>`; `fs` | SAFE exported call. |
| rustix1.1.5 experimental `runtime_448b8ad740e2a26f::execveat` | `<Fd: AsFd>(dirfd: Fd, path: &CStr, argv: *const *const u8, envp: *const *const u8, flags: AtFlags) -> io::Errno`; hidden experimental runtime + `fs` | UNSAFE; rejected for the arena call site. Historical GitHub404 did not establish absence of implementation. |
| nix0.31.3 `sys::memfd::memfd_create` | `<P: NixPath + ?Sized>(name: &P, flags: MFdFlags) -> Result<OwnedFd>`; `fs` | SAFE exported call. |
| nix0.31.3 `fcntl::fcntl` | `<Fd: AsFd>(fd: Fd, arg: FcntlArg) -> Result<c_int>`; `fs`; `F_ADD_SEALS`/`F_GET_SEALS` | SAFE exported call; exact seal flags still require review. |
| nix0.31.3 `unistd::execveat` | `<Fd: AsFd, SA: AsRef<CStr>, SE: AsRef<CStr>>(dirfd: Fd, pathname: &CStr, args: &[SA], env: &[SE], flags: AtFlags) -> Result<Infallible>`; `process`; Linux/Android | SAFE direct syscall; empty CStr + `AT_EMPTY_PATH` selects the exact FD, without fallback. |

Safe nix `fexecve` is not preferred: its libc wrapper may use a proc fallback rather than the exact selected syscall route.
Keep typed CString/CStr storage alive; nix builds NUL-terminated pointer vectors and allocates, requiring accounting and fork-safety review.
A safe signature does not prove async-signal safety or waive arena's unsafe prohibition; dependencies may use unsafe internally and need source review.
Pass `&OwnedFd` or `&File` to retain caller ownership on returning failure. The generic by-value form can consume an owned descriptor; it creates no new child. Exact ownership and error cleanup must be specified by the accepted interface.
This is API research, not an implemented backend, capture approval or complete launcher interface audit.

## 10. Minimal proposed syscall dependency — not the full runtime freeze

Research candidate: ONE new direct entry, nix exact0.31.3, defaults disabled, features `fs` and `process`.
For the explicit EXEC flag omitted as a named nix constant, the candidate uses `MFdFlags::from_bits_retain(nix::libc::MFD_EXEC)`.
Upstream libc publishes Linux `MFD_EXEC=0x0010`; do not truncate unknown bits or assume EXEC from default behavior.
Add no direct libc/memfd/rustix dependency merely for this candidate; optional rustix1.1.5 `fs` plus nix `process` would be two entries and is NOT selected.
EXEC-seal constants, digest/ELF parser, FD duplication and identity safe interfaces still require review; ONE entry describes syscall APIs, not a complete cryptographic/native closure.

| Supplied manifest/lock fact | Permitted conclusion |
|---|---|
| `Cargo.lock` has no nix entry; existing libc0.2.191, bitflags2.13.2, cfg-if1.0.5, cfg_aliases0.2.2 | Existing versions are supplied source facts, not installed-cache or acquisition evidence. |
| nix normal ranges: libc `^0.2.186`, bitflags `^2.3.3`, cfg-if `^1`; build cfg_aliases `^0.2.1` | Supplied versions satisfy ranges at manifest level ONLY; no actual Cargo resolution, feature-graph or lock-churn proof. |
| nix MIT / Rust minimum1.69; rustix Apache2 with LLVM exception OR Apache2 OR MIT / Rust minimum1.65 | Upstream package facts only; no local license-file validation. |
| Lead grep found no regular sha2/digest helper in `apps/arena` | Syscall candidate does not solve digest implementation or approve another dependency. |

Adding nix would add a lock entry, arena edge/features and source-audit scope; no existing pin is implicitly upgraded.
All actual dependency/interface/source changes require separate approval; unavailable offline inputs mean STOP without acquisition fallback.

## 11. Future platform qualification — no observed capability

| Upstream requirement / policy | Future qualification boundary |
|---|---|
| memfd Linux3.17; execveat3.19; explicit MFD_EXEC at least6.3 | Version thresholds are not actual installed-source/configuration proof. |
| Effective PID-namespace hierarchy `vm.memfd_noexec`:0 default allows;1 defaults noexec but explicit EXEC can work;2 denies EXEC with EACCES | Qualify effective hierarchy and policy without lowering it. |
| `MFD_NOEXEC_SEAL` forbids later executable mode; mutually exclusive with MFD_EXEC | Reject incompatible creation policy; do not silently omit explicit EXEC. |
| Kernel/seccomp/LSM may deny or cause SIGSYS | STOP; no new caps, sysctl, profile or posture relaxation. |

The gregkh v7.0.12 source is a reference, not authentication of the previously reported kernel build.
Moby version data establishes no memfd seal or exec capability; no installed kernel/configuration was inspected.

## 12. Future verification obligations — NOT RUN, no new scripts/models

| Family | Required later cases |
|---|---|
| Artifact/closure | Source/build/ELF drift; missing GNU static inputs; PT_INTERP/DT_NEEDED, script and late executable edges. |
| Seals | Seal order; WRITE-only versus W/G/S; FUTURE_WRITE-only; non-executable state; writable mapping/pin refusal; final mask mismatch. |
| Identity/inheritance | Wrong FD; same hash but wrong dev/ino; descriptor reuse; CLOEXEC leakage; unrelated inherited descriptors. |
| Exec/lifecycle | Returning exec failure and post-teardown death/EOF; no invented `Child` or continued old-supervisor authority. |
| Accounting/time | Counter exists before owed work; no restore/prepayment/replacement; original clock not renewed or startup time silently excluded. |
| Remaining F9 | Native full-policy/init, actual Node custody, mixed closure and continuing endpoint checks remain independently required. |

Only after actual source AND operational approvals may a static program executing the same sealed object qualify kernel properties.
Code fixtures and model flags cannot supply genuine authority; no hardware qualification is attempted in this research pass.
The existing5017-byte/190-line arithmetic fence and historical561348 assertions remain unchanged, old-scope evidence; no rerun or new model is needed here.

## 13. Supplied references and next checkpoint

- [nix safe execveat](https://docs.rs/nix/0.31.3/nix/unistd/fn.execveat.html), [source](https://docs.rs/nix/0.31.3/src/nix/unistd.rs.html#1221-1245), [MFdFlags](https://docs.rs/nix/0.31.3/nix/sys/memfd/struct.MFdFlags.html).
- [nix fcntl](https://docs.rs/nix/0.31.3/nix/fcntl/fn.fcntl.html), [nix memfd_create](https://docs.rs/nix/0.31.3/nix/sys/memfd/fn.memfd_create.html).
- [rustix unsafe experimental runtime source](https://docs.rs/rustix/1.1.5/src/rustix/runtime_448b8ad740e2a26f.rs.html#456-464), [rustix memfd_create](https://docs.rs/rustix/1.1.5/rustix/fs/fn.memfd_create.html), [rustix get seals](https://docs.rs/rustix/1.1.5/rustix/fs/fn.fcntl_get_seals.html).
- [Kernel executable-memfd policy](https://docs.kernel.org/userspace-api/mfd_noexec.html), [reference v7.0.12 memfd source](https://github.com/gregkh/linux/blob/v7.0.12/mm/memfd.c), [execveat semantics](https://man7.org/linux/man-pages/man2/execveat.2.html), [Rust static/dynamic C runtimes](https://doc.rust-lang.org/reference/linkage.html#static-and-dynamic-c-runtimes).
- Local planning owners: [ownership §13](native-ingress-ownership.md#13-immutable-rust-owner-launch--first-prerequisite-contract), [mechanisms §14](native-ingress-mechanisms.md#14-sealed-launch--selected-design-source-catalog), [implementation §14](native-ingress-implementation.md#14-sealed-launch--design-catalog-not-an-implementation-assignment).

Current checkpoint: route B design-selected; a safe syscall-API candidate is identified, NOT approved or installed.
Next resolve bounded artifact-preparation/bootstrap classification, trusted launch and original time origin, exact dependency/interfaces, selected source/native graph, installed-byte/static-artifact recipe, fees and physical envelope BEFORE code/build/full-plan freeze.
Complete and review this proposal first; do not repeat route/accounting/root/mapping choices or ask a generic approval question.
No realm, Native DTO/API, host provisioning, complete recipe/invoice, source implementation or operational permission is selected.
Full-training-closure, genuine-native-authority, whole-decision-adequacy, calibration and training-readiness remain not established; `trainingReady:false`.

## 14. Scoped dossier and selection review

Lead's five-document scope, published-history preservation, accepted bf38/M1/M2/feasibility program identities, unchanged direct accounting/model,29 local links/anchors and whitespace checks passed. No model rerun, Cargo resolution, dependency installation, local kernel/descriptor/proc qualification, build or daemon operation ran.

Read-only Adversarial `ses_e9f978361ffecmqmQy8Snxmwq4` and Security `ses_e9f9782b6ffeuga4zapbOPHxJ4` reported no findings and DOCS READY for DESIGN INVESTIGATION ONLY. Neither verdict accepts dependencies, bootstrap classification, a realm, implementation or operations. The API catalog and selected route remain subsequent uncommitted planning after publication `ae80f3c8`.

## 15. Preparation classification and original launch clock

**[Unverified] 2026-10-22 · PROPOSED, NOT ACCEPTED / PREPARATION CLASSIFICATION + CLOCK MECHANISM OPEN / NOT RUNTIME QUALIFIED · trainingReady:false.**

### 15.1 Precedence and unchanged authorization

This appendix refines the OPEN obligations in §§4/8; their text remains retained history, not rewritten approval.
[Ownership §15](native-ingress-ownership.md#15-ts-to-rust-bootstrap-correspondence-and-remaining-gates) records the supplied TS audit, correction of the bootstrap-invention overstatement and unselected Rust base case.
Executor selected audit coverage and authorized planning updates, not an exception to B1/DIRECT or an accepted preparation/clock mechanism.
Source baseline `6c146887` and user-approved branch `docs/f9-bootstrap-correspondence` identify this documentation context only.
Earlier uncommitted/publication labels retain checkpoint scope; this appendix asserts no new review, verification, publication or PR result.

### 15.2 Classify the actual operation, not its fixed input

| Proposed class | Qualification before acceptance |
|---|---|
| REUSABLE fixed-software materialization | Potentially eligible only under a complete registered recipe independent of the F9 session, recipient, live window, history and model. Fixed bytes do not automatically make work free or establish an accepted exemption. |
| PER-LAUNCH object preparation | Creating/populating/sealing/hashing/checking the selected memfd is launch-causal even with fixed bytes. Include it in the applicable launch interval; no blanket fixed-software exclusion applies. |
| Owed public work | Classification never automatically exempts copying, hashing, selection, checking or control work. If owed work would precede its owner, STOP before effects. |
| Actual owner binding | After the ONE owner exists, prepay actual type/seals/length/digest/dev-inode/source checks regardless of any accepted preparation class. No earlier preparation substitutes for these checks. |

A fixed-software handle or diagnostic report is neither Native authority nor paid credit.
No pre-owner owed public effects, post-hoc debit, counter handoff, restored meter or replacement allowance follows.
The exact bootstrap construction/first-gate base case remains unselected; the TS source example is not its automatic Rust implementation.

Acceptance requires exact recipe identity and an offline allowlist of available inputs, not an acquisition permission.
Declare current operation counts/bytes, CPU/RSS/PID/time, FD counts, output/staging/storage peaks, coexistence and failure bounds before acceptance.
Required source audits and consequential human decisions remain OPEN; this appendix supplies no new numerical envelope.
Private supervision cannot conceal public/R4 work or bypass the existing accepted boundary.

### 15.3 Original launch origin — proposed obligations, no selected clock

Proposed `S0` precedes the first applicable launch operation, including launch-causal materialization and loading.
Do not exclude earlier preparation without its exact accepted classification and registered recipe.
Cold absolute10s covers launch, BOTH endpoint initializations, open/pass/window work, independent comparison and F1 under the original contract.
Lifecycle300s includes the reserved3s cleanup; neither helper startup nor owner entry renews either origin.
Freeze the exact placement of close, EOF/reap and the cold barrier in the recipe; do not assume cleanup sits outside10s by default.

An outer clock retaining original `S0` across child exec, with independent barrier checks, is a candidate only; no outer topology is approved.
An inner-compatible clock still needs fresh local gates, a bounded nonrenewing residual and pre/post checks tied to that original origin.
Serialized `Instant`, arbitrary remaining-ms, eventual JSON, proc age or an outer timeout alone supplies no live clock proof.
No selected mechanism establishes preemption of synchronous F1.
An overrun revokes future loans and staged publication; it does not roll back already-read facts or private F1 updates.

Reserved physical3s is not a new public cleanup-work counter.
Budget refusal does not waive mandatory bounded cleanup, but it grants no free public cleanup either.
Incomplete EOF/reap fails positive proof; forced teardown is not clean-close evidence.
No new proc/clock-data permission, safe clock API, dependency, authority realm or wire DTO is selected.

### 15.4 Ordered remaining gates

1. Freeze exact Rust bootstrap correspondence, disjoint invoice/first-failure coverage and private entry boundary; preserve public Rust/F1 APIs.
2. Resolve exact preparation classification and the complete registered recipe, offline inputs and physical/failure envelopes.
3. Qualify the original-clock bridge and live/staged gates with source-bound safe mechanisms, without renewal or rollback claims.
4. Complete captured closure, trusted launch/loading premises, actual custody, full-policy/init checks, continuing confinement and aggregate bounds.
5. Review the full file/API/recipe/invoice plan, then obtain exact human implementation and operational approvals separately.

Parent owns PLAN navigation and subsequent review/verification; earlier reviews do not approve this delta.
The keeper ran no tests, model runs, commands, hashes or probes while authoring these appendices; parent documentation checks and reviews remain separately scoped. No source/dependency edit, acquisition or runtime operation follows.
Route B remains design-selected only; bf38/D1/B1/O9, fixed1_048_576/cold10s/lifecycle300s/reserved3s/generator2048, unchanged F1 and all five exclusions remain.
No collection, fitting, calibration, training, activation or deployment follows. `trainingReady:false`.

## 16. R-OUT launch responsibilities and original clock

**[Unverified] 2026-10-22 · HOST OWNER + DEDICATED APPLICATION ENTRY DESIGN-SELECTED ONLY / PREPARATION + CLOCK + HANDOFF UNQUALIFIED / IMPLEMENTATION + OPERATIONS BLOCKED · trainingReady:false.**

[Ownership §18](native-ingress-ownership.md#18-r-out-host-owner-and-dedicated-entry-direction) records both actual TUI selections and their limited precedence; [implementation §17](native-ingress-implementation.md#17-r-out-fixed-entry-and-role-specific-invoice-design) owns the proposed application-entry boundary.
Root A, DIRECT, route B and accepted private-initializer classification remain unchanged; the earlier realm/entry labels retain checkpoint scope.
R-OUT selects the host-owner direction, not ownership §13.6's main/ExecID topology, any safe API, clock feature, new helper or source target.

| Responsibility | Ordered launch/time obligation |
|---|---|
| C | Retain original S0 BEFORE applicable per-launch materialization/loading AND root entry; remain outside the owner-replacing child exec. A surviving responsibility does not select a new process/channel. |
| L | Preserve exact sealed-object/FD identity through the qualified loader; transfer no counter, paid credit or Native permission across exec. Safe spawn, descriptor handoff and error custody remain OPEN. |
| O | Enter the proposed fixed root under the accepted classification, then perform separately prepaid actual binding and fresh local clock gates. Local entry never renews S0 or excludes earlier loading. |

Reusable versus per-launch preparation remains PROPOSED, NOT ACCEPTED under §15.2; fixed public copies/hashes do not become physically or economically free.
Classify every C/L pre-owner operation explicitly. O's placement outside the container supplies no exemption; any owed public work before its owner means STOP before effects.
One counter exists only in O; no active-meter re-exec, snapshot, replacement, handoff or restored credit follows.

Cold absolute10s covers launch, BOTH initializations, window/reference comparison and F1 under the original contract.
Lifecycle300s includes reserved3s cleanup; no actor, failure or cleanup renews it. Exact close/EOF/reap/cold-barrier placement remains OPEN, not implicitly outside10s.
Qualify clock-domain identity, origin binding, fresh local issuance/accessor gates, bounded nonrenewing residual and before/after checks.
An outer timeout supervises termination but does not prove local gates refused on time. Synchronous F1 has no established hard-preemption guarantee.
Serialized `Instant`, a remaining-ms flag or eventual JSON cannot authenticate the origin; a late postcheck prevents future/staged acceptance without rolling back prior reads/private F1 state.
Ordinary host clocks do not automatically establish comparable origins: actual time-namespace provenance and possible offsets remain unqualified.
No clock API/feature, timestamp/control schema or safe std executable-FD handoff is selected by these design choices.

The dedicated-entry design must avoid F9 application argument collection/decoding before root entry; it does not eliminate all Rust-loader/stdlib allocation.
Selected physical startup, loading and stdlib/native expansion still need source classification, finite bounds and original-clock coverage; any pre-owner owed public operation remains STOP.
C/L/O need separate finite resource/failure envelopes and peak coexistence; Node-container caps do not automatically cover them.
[Mechanisms §15](native-ingress-mechanisms.md#15-r-out-actual-custody-and-safe-api-research) records upstream-only custody/clock APIs without dependency approval or local qualification.
The keeper ran no commands, tests or runtime probes while authoring this appendix. Parent owns PLAN navigation, documentation review/verification and separately authorized Git/publication; no source/dependency/target change or runtime access follows from this design. All five exclusions remain; `trainingReady:false`.

## 17. Native origin candidate profile and launch binding

**[Unverified] 2026-10-22 · METHOD INVESTIGATION SELECTED / CANDIDATE PROFILE PROPOSED, UNSELECTED / NO CARRIER, ABI, CLOCK API OR OPS APPROVAL · trainingReady:false.**

[Ownership §19](native-ingress-ownership.md#19-native-origin-record--selected-approach-unselected-carrier) records the actual method-only choice; no human selected PIPE or this grammar.
Backend's supplied candidate is a concrete 32-byte LITTLE-ENDIAN frame, not an accepted new ABI or an existing Native IPC/model DTO/core field.
Configuration26, Versions21, O9 and all existing Node protocols remain unchanged; no instance bytes were produced.

### 17.1 Proposed frame — every field and count remains unapproved

| Offset | Bytes | Proposed field / validation |
|---|---|---|
| 0 | 8 | Magic `NORIGIN\0`: hex `4e 4f 52 49 47 49 4e 00`. |
| 8 | 2 | Unsigned u16 version, exactly1. |
| 10 | 2 | Unsigned u16 source-fixed expected K_tag; clock-profile ASSERTION, never clock selector. |
| 12 | 4 | Reserved, all zero. |
| 16 | 8 | Signed i64 native-origin seconds. |
| 24 | 4 | Unsigned u32 native-origin nanoseconds, `0≤n<1_000_000_000`. |
| 28 | 4 | Reserved, all zero. |

Freezing field widths/order/counts requires the full plan; this candidate selects neither a 32-byte quota nor a carrier contract.
The native-source K tag must match independently qualified source-fixed K in the expected code profile; callers and records never choose ClockId.
There is no PID/nonce/hash field with authority. Magic/version/shape agreement cannot qualify the actual producer, launch or source.

### 17.2 Producer and once-per-launch qualification

C captures the actual native-clock-read event S0 ONCE before applicable launch materialization/loading/root entry under independently expected captured-source and declared root-trust/kernel/launcher premises.
Encoding/delivery/read completion is not S0; no data producer becomes a Native issuer, and work state never transfers across exec.
O requires actual producer/source/channel and owned-launch binding, actual time-namespace identity/comparability and the independently qualified fixed clock domain, not merely matching record contents.
Accept only one complete record for that owned launch: no concatenation, trailing data, duplicate adoption, stale record, producer substitution or cross-attempt reuse.
Exact extent requires a qualified carrier completion boundary; 32 accumulated bytes alone cannot prove that boundary.

### 17.3 Paid validation and nonrenewing meaning

After B's fixed accounting-only gate, ordinarily precharge acquisition, snapshot, parse and independent binding before effects; no origin FD inspection or read belongs to the root header.
Validate exact extent, magic/version, every reserved zero, typed ranges and checked time conversions/deadline arithmetic against the qualified source profile.
Use no floating point, wrap, saturation, clamping, unchecked narrowing or generic JSON parser as this bounded-frame proof.
`OriginData` remains untrusted data until actual binding; no timestamp constructor, normalized flag, serialized Instant or arbitrary remaining-ms value installs a positive private clock context.
Clock kind, namespace/suspend behavior, clock API and additional time feature remain UNAPPROVED; MONOTONIC and BOOTTIME are not selected here.
Missing/corrupt/late data means failure, not a fresh local deadline, renewed allowance or permission while waiting. C retains supervision against original S0.
Preserve original cold10s/lifecycle300s/reserved3s and MIN-only phase tightening; qualified fresh local checks plus independent C completion barriers remain required.
Exact cold close/EOF/reap barrier placement remains OPEN; synchronous work has no established hard-preemption guarantee or postcheck rollback.

[Mechanisms §16](native-ingress-mechanisms.md#16-safe-origin-carrier-primitives--research-only) owns upstream carrier research; [implementation §18](native-ingress-implementation.md#18-origin-acquisition-and-carrier-decision-boundary) owns source-before-effect obligations and the next carrier-only decision.
Registration, source/clock qualification, full-plan review and implementation/operational approvals remain separate and unperformed; no source/DTO/ABI/dependency/permission change follows.
The keeper ran no commands, tests, hashes, probes, agents or web fetches; parent owns PLAN navigation, review/verification and feature-PR publication. All prior text and five exclusions remain; `trainingReady:false`.
