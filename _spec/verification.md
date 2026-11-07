# Verified source pipeline and open runtime gates

## Goals

- [architecture.puml](architecture.puml): separate game, learning, rollout/evaluation and product boundaries.
- [game-core.puml](game-core.puml): retain canonical native moves, fog, economy and terminal semantics without legacy planners.
- [observations.puml](observations.puml): preserve recipient-local observation invariants through standard schemas and serialization.
- [learning.puml](learning.puml): preserve the episodic policy objective through Burn operations and autodiff.
- [policy-io.puml](policy-io.puml): bound and pin numeric inference through standard process I/O.
- [representation.puml](representation.puml): encode recipient facts and ordered actions for a standard nonlinear candidate scorer.
- [native-job.puml](native-job.puml): synthetic resource proof passed; production envelope/admission pending.
- [turn-planning.puml](turn-planning.puml): recipient eligibility and separate authoritative queue mutation.
- [candidate-generation.puml](candidate-generation.puml): newly approved bounded selection without legacy family quotas.
- [resolution-primitives.puml](resolution-primitives.puml): canonical deterministic collision prerequisites before typed causal-event integration.
- [gate-closure.puml](gate-closure.puml): open Gate0/F9/R4 dependencies, explicit profile decision and separately authorized runtime/native proof.
- [initialization.puml](initialization.puml): actual canonical opening and both initial recipient observations; no cold F9 process-proof claim.
- [classical-resolution.puml](classical-resolution.puml): canonical classical attack/movement/path settlement with actual-mutation effects.
- [turn-resolution.puml](turn-resolution.puml): complete canonical B/C/F physics, native actor transfers and causal effects.
- [causal-journal.puml](causal-journal.puml): stable private identities, causal preimages, target-only native consumption and bounded standard journals.
- [recipient-production.puml](recipient-production.puml): continuing local knowledge, explicit economic ownership, atomic BOTH data successors and deterministic source-bound replay.
- [runtime-protocol.puml](runtime-protocol.puml): closed private staged native/reference transactions and owned process lifecycle.
- [policy-runtime.puml](policy-runtime.puml): frozen exact policy reconstruction, sampling and one ACKed admission.
- [learning-runtime.puml](learning-runtime.puml): supported Burn accumulation, declared numerical coverage and record proposals.
- [supervision.puml](supervision.puml): outside original-clock deadline supervision and exact owned-cgroup observation.
- [checkpoint-runtime.puml](checkpoint-runtime.puml): private SQLite completion/checkpoint ownership and abort-all publication.
- [match-runtime.puml](match-runtime.puml): whole-match child barriers, owner stop proofs and redundant native learners.
- [host-entrypoint.puml](host-entrypoint.puml): operator-run host mise metadata, separately granted provisioning and selected shared-GPU host Docker learning.
- [gpu-readiness.puml](gpu-readiness.puml): mandatory actual-target F64 GPU scoring/learning, preserved host driver attachment and unqualified GPU/runtime/VRAM/cleanup gates.

## Persisted tests

| Test filepath | Purpose |
|---|---|
| `crates/learning/tests/model.rs` | Bounded 2,271-feature input, zero output head, controlled MLP SGD golden and nonzero native-record round-trip |
| `crates/learning/tests/context.rs` | Candidate preference reverses with state through a standard nonlinear model |
| `crates/learning/tests/initialization.rs` | Seeded hidden initialization reproduces results and receives gradients after the first head update |
| `crates/learning/tests/episode.rs` | Summed policy-gradient objective, baseline scaling, L2, empty episodes and bounds |
| `crates/policy-io/tests/score.rs` | Native-record identity, nonzero scores, F64 JSON, shape/domain rejection and executable success/failure |
| `crates/policy-io/tests/f32.rs` | Reject silent F32 inference |
| `packages/game-core/tests/board.test.ts` | Placement, coordinates, blocked rays, mutual CC attacks, checker order and visibility |
| `packages/game-core/tests/initialization.test.ts` | Exact reference opening, initial geometry, zero endowed paid basis, CC exclusion and detached game state |
| `packages/game-core/tests/economy.test.ts` | Caps, costs, income, turn clocks, stored banks, deployed material and overlay gas |
| `packages/game-core/tests/outcome.test.ts` | CC deaths and turn-cap outcomes |
| `packages/game-core/tests/moves.test.ts` | Marine bands/promotion, siege fire, mine targets and shape-only intents |
| `packages/game-core/tests/mines.test.ts` | Ray contact, exemptions, packing and three-mine cap |
| `packages/game-core/tests/vision.test.ts` | Unit/side fog, dark BattleShip pings, own mine light and path-reveal taps |
| `packages/game-core/tests/canonical.test.ts` | Canonical fingerprints for 1,536 move/fog boards and 49,152 shape queries |
| `packages/game-core/tests/planning.e2e.test.ts` | Public planning-API flow from placement through fog filtering to recipient intents |
| `packages/game-core/tests/native-classical.test.ts` | Heads-first ordering, transfer identity, insertion/result contexts, promotions and native drops |
| `packages/game-core/tests/planning-intents.test.ts` | Known-board shape, vacancy, special anchors, CC crushing exclusions and timing |
| `packages/game-core/tests/queue-action.test.ts` | Pure authoritative append/remove, gas debit/refund, stable sequence IDs and failure nonmutation |
| `packages/game-core/tests/canonical-planning.test.ts` | 49,152 dependency checks and 344,064 append decisions against recorded canonical fingerprints |
| `packages/game-core/tests/canonical-queue.test.ts` | 92,518 authoritative append attempts and 6,502 removals against the canonical fingerprint |
| `packages/game-core/tests/resolution-primitives.test.ts` | Mine ordering/chase, timed collisions/deaths, path taps and Charon screens/fire-and-forget |
| `packages/game-core/tests/canonical-resolution.test.ts` | 554,496 canonical schedule/contact/mine/Charon/ray cases |
| `packages/game-core/tests/collision-primitives.e2e.test.ts` | Mine landing death through travel schedule to later-contact cancellation |
| `packages/game-core/tests/classical-resolution.test.ts` | Common-board attack wave, fogged swaps, timed collisions, CC contacts, landing death, promotions, siege, pending rays and live path operands |
| `packages/game-core/tests/canonical-classical.test.ts` | 122,160 canonical classical-phase cases with full intermediate/result fingerprints |
| `packages/game-core/tests/turn-resolution.test.ts` | B/C/F Marine walks, native doubles, held/chasing mines, F actor anchors, promotions, dead-actor Charon, siege, jumps and terminal chips |
| `packages/game-core/tests/canonical-turn.test.ts` | 11,045 canonical begin/admission/settlement cases, including 1,727 retained rejections |
| `packages/game-core/tests/turn-resolution.e2e.test.ts` | Both canonical seats staged from the same opened board through actual simultaneous B/C/F settlement |
| `packages/game-core/tests/causal-events.test.ts` | Stable identities, immediate birth/loss, ordered mine multiplicity, common preimages, promotion, snapshot/failure guards and separate evaluation/applied operands |
| `packages/game-core/tests/causal-parity.test.ts` | All 11,045 canonical begin/admission/settlement outcomes with and without the journal sink and standard journal round trips |
| `packages/contracts/tests/observation.test.ts` | JSON round-trips, readonly copies, field bounds, visibility/memory, lineage and economic conservation |
| `packages/contracts/tests/initialization.test.ts` | Both actual initial recipients, fogged opening knowledge without fabricated sightings, zero ledgers and producer/root separation |
| `packages/contracts/tests/recipient.e2e.test.ts` | Recipient JSON through validation and serialization to core move generation |
| `packages/contracts/tests/inference.test.ts` | Numeric JSON request/response bounds and identity matching |
| `packages/contracts/tests/causal-journal.test.ts` | Standard state/journal schemas, field/byte bounds and ordering, target, trace, counter, mode and substitution rejection |
| `packages/contracts/tests/recipient-privacy.test.ts` | Actual-kernel hidden-prefix/siege/replacement twins, incidental ships, casualty-memory ordering, nonacting recipients, failed consumption and dead vision sources |
| `packages/contracts/tests/recipient-codec.test.ts` | Public standard batch round trip, private-field exclusion, side isolation and sequence-gap rejection |
| `packages/contracts/tests/game-session.test.ts` | Actual canonical init/open, explicit banks, paid lifecycle/promotion/waste, capped grants, atomic pair failure and replay gap/conflict/idempotence |
| `packages/policy/tests/features.test.ts` | Actual board/resource/action layout, color-relative symmetry, fog/memory separation, bounds and fresh buffers |
| `packages/policy/tests/initialization.e2e.test.ts` | Canonical initialization through both recipient producers, generated candidates, private queue admission and mirrored actual features |
| `packages/policy/tests/source-boundary.test.ts` | Pinned TypeScript first-party closure; runtime/type-only/transitive producer-import negatives, host builtins and dynamic-loader rejection |
| `packages/policy/tests/policy-process.e2e.test.ts` | Validated observation/candidates through actual encoding and native Burn scoring, with checkpoint-hash mismatch rejection |
| `packages/policy/tests/recipient-noninterference.e2e.test.ts` | Actual continuing recipient hidden-state twins through candidate generation, encoding and frozen native Burn scoring with a synthetic checkpoint |
| `packages/policy/tests/queue-planning.e2e.test.ts` | Recipient JSON through eligibility, separate authoritative queue edits and actual feature encoding |
| `packages/policy/tests/candidates.test.ts` | New enumerator bounds, family/depth coverage, resource/mine/dependency constraints and mirrored recipient order |
| `packages/policy/tests/enumeration-golden.test.ts` | New enumeration-version order and capacity/attempt/exhaustion boundaries |
| `crates/learning/tests/accumulation.rs` | C6 accumulated gradients equal the summed episode objective/SGD; frozen baseline, bounds and reload |
| `crates/learning/tests/finite_difference.rs` | C7 active/inactive ReLU fixtures check 4,670 declared coordinates with unchanged tolerances |
| `crates/policy-io/tests/channel.rs` | Closed frozen score/ACK/finish/close protocol, logical F64 digest and emitted-record reload |
| `crates/policy-io/tests/initialize.rs` | C10 master seeds 101..105, exact hidden reproducibility and zero bias-free output head |
| `packages/contracts/tests/native-protocol.test.ts` | Closed native worker phases, binding, replay and post-close rejection |
| `packages/contracts/tests/native-intents.test.ts` | Separate 65 recorded/opponent intents from four learned actions; typed actual side/index rejection |
| `packages/runtime/tests/artifacts.test.ts` | Independent manifest expectation, required roles, bounded bytes, symlinks and substitution negatives |
| `packages/runtime/tests/native-session.test.ts` | BOTH comparison/commit barriers, wrong identity/order, replay/reentry, cleanup and close receipts |
| `packages/runtime/tests/reference.test.ts` | Original source-bound init/open/pass fingerprints and missing-export refusal |
| `packages/runtime/tests/closure.test.ts` | Supported Bun runtime closure excludes current resolver from reference and policy/learning/model-input/storage dispatch from native-only workers/job |
| `packages/runtime/tests/process-transport.test.ts` | Actual owned synthetic process pipes, EOF/reap, byte limits, unsolicited output and nonzero exit |
| `packages/runtime/tests/job.test.ts` | Native-only no-work boot barrier, fixed command, original guard and no retry |
| `packages/runtime/tests/policy-session.test.ts` | Full 512-candidate transaction plus exact permit/action/RNG/distribution/ACK/admission negatives |
| `packages/runtime/tests/rng.test.ts` | Twenty roots, 5,120 frozen reference draws, restore-next-draw and impossible-prefix rejection |
| `packages/runtime/tests/native-learner.e2e.test.ts` | Real fixed Burn child with synthetic ACK/return, diagnostic empty completion and record reload |
| `packages/runtime/tests/learner-pair.test.ts` | Logical proposal/counter/objective comparison, distinct channels, dual abort and concurrent revocation |
| `packages/runtime/tests/learner-pair.e2e.test.ts` | Two actual Burn children compare a synthetic full-F64 proposal and reload digest |
| `packages/runtime/tests/curriculum.test.ts` | Exact 1000-slot A schedule, Fisher–Yates prefixes, alternating seats, no slot 1001 and root/order negatives |
| `packages/runtime/tests/training-store.test.ts` | SQLite STARTED/atomic completion, delayed cadence checkpoint at actual epoch 101, rollback failure and abort-all |
| `packages/runtime/tests/corpus.test.ts` | Trusted audited source bounds, full consumed prefix, empty queues and roster/pin/order negatives |
| `packages/runtime/tests/strategic.test.ts` | Frozen private opponent context, tentative RNG, exact replay/ACK and mutation/spend/deadline negatives |
| `packages/runtime/tests/match-session.test.ts` | Child-owned whole-match ordering, actual native/recorded stop proof, known-prefix cutoff and infrastructure refusal |
| `packages/runtime/tests/match-process.test.ts` | Supported owned process group, natural close/reap, cutoff and retained competing integrity fault |
| `packages/runtime/tests/match-session.e2e.test.ts` | Separate synthetic match child/native scorer/two Burn learners through verified retained-byte SQLite completion, retained initial bytes and post-close scratch release |
| `packages/runtime/tests/private-state.test.ts` | Actual exclusive journal segment bytes, cumulative SHA-256/global ordinals, reservation/exhaustion and no overwrite |
| `packages/runtime/tests/training-coordinator.test.ts` | STARTED before process construction, publication failure, original-clock postcommit abort and reentry revocation |
| `packages/runtime/tests/storage-bounds.test.ts` | Exact fixed-write byte/entry calculation below nominal 200 GB without claiming an allocation or qualified physical fit |
| `packages/runtime/tests/model-inputs.test.ts` | Serial owned scratch release without accumulation; retained failed inputs and refusal to remove unexpected files |
| `packages/runtime/tests/training-artifact.test.ts` | Closed synthetic final metadata, exact five-master roster/primary and no private scheduling/RNG fields |
| `packages/runtime/tests/reference-bundles.test.ts` | C14 six standard Bun bundles, selected input scope, exports and original reference/strategic/corpus fixtures |
| `packages/runtime/tests/host-facts-task.test.ts` | Four prebuilt-handoff tests: literal closed artifact/task expectations, unchanged Python tasks/disabled auto-install, real mise fake-artifact literal-argument forwarding with empty stores, and missing bytes failing without staging/build/install/download |
| `tooling/runtime/tests/test_supervise.py` | Fake manager/cgroup controls, original deadlines, owned cleanup, evidence failure and no operational retry |
| `tooling/runtime/tests/test_evidence.py` | Bounded exclusive fsynced evidence, retained failure reservations and packet-wide storage refusal |
| `tooling/runtime/tests/test_state_mount.py` | C13 exact selected private bind source/target and substituted/extra mount refusal |
| `tooling/runtime/tests/test_recipe.py` | Unexecuted pinned multi-stage recipe, network-disabled builds, nonroot/init and six fixed reference outputs |
| `tooling/runtime/tests/test_host_inventory.py` | C16 bounded CPU/projection calculations and refusal to promote sandbox observations to daemon-host authority |
| `tooling/runtime/tests/test_host_view.py` | C17 bounded mountinfo projection, local/cgroup selection and malformed-input refusal |
| `tooling/runtime/tests/test_host_preflight.py` | V2 bounded/explicitly skipped hashes, six-command contract-help allowlist, retained partial/exception receipts, symlink invocation, task schema guard, actual mise/parser/basic/contract e2e with synthetic tools and failure/byte/deadline cleanup |
| `tooling/runtime/tests/test_host_admission.py` | Sixteen synthetic/static admission cases: fixed CPU/RAM/filesystem projections, no creation/source overlap/symlink substitution, byte/DRM/card bounds, exact non-process NVIDIA query, retained facts on missing Docker, fail-stop/no follow-up, separate fake-Docker CLI e2e and task-schema/profile guards |
| `crates/host-facts/src/socket.rs` · inline unit tests | Four real Unix-listener pin/probe tests: leaf replacement, parent replacement, unlink/replacement and unsafe/absent endpoint refusal; replacement listeners receive nothing |
| `crates/host-facts/src/http.rs` · inline unit tests | Fixed HTTP/EOF/timerfd bounds; test-only fdinfo/simulated expiry; bounded nonblocking BOOTTIME fixture accepts and zero-duration client/server-join regression |
| `crates/host-facts/src/cgroup.rs` · inline unit tests | Eleven cases, including eight new descriptor/statx mount-ID, topology/order/escape, missing-mask/ID/error, directory-replacement and no-follow cases; four content paths only; synthetic cgroup2 rows are not filesystem qualification |
| `crates/host-facts/src/projection.rs` · inline unit tests | Typed Serde fields/types/ranges/duplicates, UTF-8 and lexical depth guard, bounded options/runtime keys, ignored-value grammar validation and secret-canary exclusion |
| `crates/host-facts/src/lib.rs` · inline unit tests | Caller guard, sole endpoint, held cgroup guard and mount-binding failure before RPC; synthetic sequencing/failure retention, false gates and encoded-stdout bound including escaping/newline |
| `crates/host-facts/tests/cli.rs` | Child `--help` and invalid-argument paths only; no host metadata collection |
| `crates/host-facts/tests/recipe.rs` | Exact three-policy-binary build/copy allowlist; reject host-tool copy and workspace-wide native build without changing the Docker recipe |

The persisted process e2e tests use explicitly synthetic source/model/return fixtures.
The whole-match fixture uses actual canonical game transitions and native Burn updates, not a genuine corpus/strategic rollout or a measured training experiment.
The separately authorized historical one-shot Docker proof remains in [native-job.md](native-job.md).
It is not the final production envelope or a current live host e2e qualification.

## Existing results before the Docker runtime metadata slice

- Rust: 38 tests pass with locked, offline dependencies and 2 Cargo jobs.
- Rust formatting: passes.
- Clippy: passes with warnings denied.
- Bun after host-mise/storage refresh: 489 tests pass across 66 files, with 29,887 assertions.
- TypeScript: source and tests pass strict static analysis, including unused-symbol checks.
- Python after the admission/GPU addition and facts-first correction: all 74 fake/synthetic/static tests pass, including 16 admission tests and the retained host-preflight/contract/C16/C17/C19 fixtures.
- PlantUML: all 24 diagrams pass syntax checking and SVG rendering in `/tmp/opencode/chess-coach-ii-gpu-host-facts-final-d9vaickr/`.
- Synthetic Docker: one container passed limit, inheritance, CPU/PID/memory pressure and manager-cleanup checks within 7.477 seconds; no production-admission claim.
- New JSON manifests and whitespace: pass.

Rust verification uses the operator-approved installed Zig 0.15.2 through temporary C-driver scripts outside the repository. A normal GCC/Clang development toolchain remains sufficient on a standard host. No repository compiler shim or runtime bootstrap is required.

The current admission/GPU Python/AST/TOML/whitespace, actual mise parser/discovery and 24-diagram receipt is `/tmp/opencode/chess-coach-ii-gpu-host-facts-final-d9vaickr/`.
It includes the separate fake-Docker CLI e2e and retained synthetic basic/contract task e2e checks.
Its import-only `development-admission-import-inventory.stdout` records the isolated development Python dependency files without calling the metadata entrypoint or querying hardware.
Its current source hashes bind the final facts-first correction and refreshed spec/test indexes.
Its `operator-reported-contract-and-decisions.json` preserves the earlier structured operator report/decisions; it is not an agent host-execution receipt.
The preceding `/tmp/opencode/chess-coach-ii-gpu-host-facts-verification-vw4rtfoq/` passed 73 tests before the final facts-first change and cannot verify that change.
The new profile collects hardware/filesystem metadata before local Docker client discovery, preserving those facts when Docker is absent.
It keeps GPU learning required, GPU qualification absent and `trainingReady:false`.
No actual host admission-facts invocation, GPU computation, provisioning or training occurred in this verification.
Executor subsequently selected `Commit + push (Recommended)` for the 19-file admission/GPU source/spec/test phase and the exact one-shot operator-run facts command.
The post-approval source/verification publication receipt is `/tmp/opencode/chess-coach-ii-gpu-host-facts-publication-pj4qpqli/`.
It preserves the preceding verification receipt without overwriting its source manifest.
Executor subsequently supplied the admission report recorded below; the earlier verification receipt remains unchanged.

## Operator-reported admission evidence

The complete returned JSON message is `/tmp/opencode/chess-coach-operator-host-admission-FenA0l/operator-message.json`.
Its adjacent `provenance.json` labels it `OPERATOR_MESSAGE_NOT_AGENT_HOST_EXECUTION`.
The receipt records a 3,796-byte report with SHA-256 `93a91d87976953e69b3d71521a1469ab5e47673d23c7261ea54431bb8984fad2` in `derived-summary.json`.
That summary derives arithmetic from the message; it is not a second independent observation or host qualification.
The canonical reported inventory and unchanged acceptance boundary are in [host-entrypoint.md](host-entrypoint.md#received-observations-and-provenance-boundary).

The executed source commit, exact operator invocation, execution timestamp and standalone stdout/stderr byte records are unknown (`null`).
The expected handoff command is not evidence of the executed invocation.
Do not retrospectively bind this report to current development commit `875378db96ca80e12a6deaeb5de858ba3ebd3a23` or to any later source snapshot.
The local receipt digest binds the retained message bytes, not independently selected host/tool/runtime identities.
Retain the original message and its provenance without replacing them with the derived summary or silently filling missing fields.

The report keeps `OPERATOR_ASSERTED_HOST_UNQUALIFIED`, runtime admission false, GPU `NOT_QUALIFIED`, provisioning/training authorization false and `trainingReady:false`.
The available-byte/RAM samples reserve nothing; zero btrfs entry counters do not prove exhausted inodes or successful entry admission.
No daemon, runtime/GPU qualification, allocation, provisioning or training evidence follows from this metadata report.

## Rust host-facts v2: implemented source evidence

Status: GNU AND MUSL RUST SOURCE TESTS PASS, 72 EACH / BOTH EARLIER RUST SOURCE REVIEWS ACCEPTED / LOCAL STATIC ASSET AND PREBUILT TASK VERIFIED / LATEST HANDOFF-FILE REVIEWS PENDING / NO APPROVED RUNNABLE HOST HANDOFF OR HOST/PUBLICATION GRANT.
The implemented contract is [host-runtime-inventory-request.md](host-runtime-inventory-request.md); `crates/host-facts`, package `chess-coach-host-facts`, is a separate development/control-plane source boundary.
Executor approved necessary coding-sandbox tooling installation through `mise install`; the lead reports Rust 1.95 installed.
That tooling approval neither grants host installation/execution nor relaxes the prebuilt-only operator entrypoint.

The fresh private receipt is `/tmp/opencode/chess-coach-rust-host-facts-verification-YYp6eH/`.
Its current `rust-tests-mountid.stdout`/`rust-tests-mountid.stderr` record 72 passing Rust tests: 69 library unit tests, one CLI parser integration test and two native-recipe partition tests, with no failures.
The earlier `rust-tests-timerfd.stdout`/`rust-tests-timerfd.stderr` retain the 62-test timerfd checkpoint; `rust-tests.stdout`/`rust-tests.stderr` and `phase-57-pre-review.json` retain the 57-test pre-review phase.
Neither earlier checkpoint is final verification or review acceptance for the latest three source files.
The socket module's four tests include real leaf/parent/unlink replacement checks that deliver only to the original held socket, plus unsafe/absent probe cases.
Its `python-final.stdout`/`python-final.stderr` retain 74 passing restored Python tests in 0.495 seconds before the latest mise tool-option addition; the preceding `python-baseline.*` receipt remains preserved.
That baseline is historical; the new post-mise/task 74-test pass is retained in the separate static/handoff receipt below.
The complete Rust collector ran only against synthetic temporary-root Unix fixtures; executable child tests used `--help` or invalid arguments, never real host collection.

Five new HTTP tests inspect only their own timer fdinfo under `cfg(test)` to confirm clock ID 7, absolute-arm flag 1 and CLOEXEC/NONBLOCK; observe timer-only expiry; simulate expiry with a socket already readable; reject zero/range setup before RPC; and discard a projection completed after expiry.
The simulated expiry test re-arms only its own test timer; production creates/arms once per valid request and performs no fdinfo read or timer read/rearm.
The request origin/end precede timer creation; absolute BOOTTIME timerfd readiness backs every socket wait and defeats the suspend-excluding relative `ppoll` timeout.
Checked setup failures retain fixed initialized receipts without connecting, and timer expiry/error wins over socket progress while clock checks remain before I/O, after poll and after projection.
Expiry is observable when execution resumes; these tests do not show actual suspend, host-clock qualification or exact-deadline socket closure while execution is suspended/unscheduled.
The implementation validates UTF-8 and lexical nesting depth below 128 before standard Serde parsing, including ignored fields/runtime definitions; this is a bounded preflight, not a general JSON parser or bespoke codec.
The cgroup view now pins `/sys/fs/cgroup` and its fixed parents using descriptor-relative no-follow directory opens, requires ordinary statx MNT_ID mask/nonzero identity on the held FD, and selects its unique matching mountinfo row after standard escape/ancestry validation.
The collector retains that guard throughout collection and opens the two controller files relative to the same directory; the mount ID remains internal and `exposesCgroupV2` refers to this pinned observation, not an atomic/global-path or enforcement claim.
The four content-file allowlist entries remain unchanged; only fixed read-only directory metadata/statx calls were added.
Eight new cgroup cases combine real statx and independently obtained fixture-FD IDs with parser-level hidden-overmount/order/escape checks, missing/duplicate/malformed-row refusal, unsupported/missing ID masks and replaced-controller-directory tests.
Their cgroup2-labelled rows are synthetic metadata, not evidence that the fixture filesystem is a real cgroup filesystem.
A new collector negative blocks binding failure before Docker RPC and leaves the view unknown; a new HTTP fixture regression makes a zero-duration client's server join terminate without any connection.
Both formerly blocking HTTP fixture accept sites now use one-second nonblocking BOOTTIME loops; 150 ms client deadlines and 300 ms EOF holds remain test controls, not changes to the production 10-second bound.
The 128 KiB stdout ceiling includes the final newline; encoding overflow emits no report bytes and only fixed `HOST_FACTS_REPORT_BOUND` stderr with exit 1.
All runtime/GPU qualification and provisioning/training authorization/readiness gates remain false.

`host-cargo-tree.stdout` retains the successful offline host-tool dependency inventory; it contains no Burn, learning or policy dependency.
`workspace-metadata.json` retains standard Cargo `--no-deps` metadata; root/member manifests and direct dependency declarations separate the host tool from application direct dependencies.
Workspace load inputs are not the selected build/runtime closure: [gate0-packet.md](gate0-packet.md#input-registration-roles) now includes every root workspace member's required manifest/source, while the unchanged Docker recipe builds/copies only the three policy binaries.
The two persisted recipe tests enforce that exact allowlist and reject host-tool copying or `--workspace` builds.

The application offline Cargo-tree attempt failed because cached `addr2line v0.27.1` was missing; `policy-cargo-tree.stderr` preserves that failure.
No online fallback ran, and this record supplies no complete application Cargo closure, workspace/model Rust rerun, production build or GPU proof.

`bun-partition.stdout`/`bun-partition.stderr` retain 22 passing partition tests, zero failures and 121 assertions across the two selected source-boundary/closure files; this is not a full Bun/TypeScript rerun.
The current supplied `fmt-mountid.stdout`/`fmt-mountid.stderr` and `clippy-mountid.stdout`/`clippy-mountid.stderr` retain passing formatting-all and host-tool Clippy with warnings denied after the mount/fixture changes; the timerfd-phase static receipts remain historical.

The contained Rust security review reported MEDIUM CWE-400 because relative `ppoll` excludes suspend time.
The architect approved the absolute BOOTTIME timerfd backstop, and the lead implemented it with the five new tests.
Security accepted the timerfd/privacy state with `READY TO MERGE: yes` at the earlier 62-test checkpoint.
Adversarial review still identified MEDIUM mount-selection topology and unbounded HTTP fixture-accept findings; the architect approved the pinned ordinary-mount-ID binding and bounded fixture fixes now represented by the 72-test receipt.
The lead subsequently supplied adversarial `READY TO MERGE: yes` for the 72-test mount/fixture corrections and security `READY TO MERGE: yes` for the 72-test source, privacy/timerfd and targeted statx changes.
Both source-review acceptances are true for that reviewed Rust diff only; they grant no host, artifact registration, source publication or distribution operation.
The later mise task, closed artifact metadata and persisted Bun task test passed their development checks and separate targeted adversarial/security reviews, both returning `READY TO MERGE: yes`.
Security retains the independent staging/hash-verification requirement because the task trusts its pathname; neither a digest-named directory nor mode 0555 enforces integrity.
Actual artifact bytes are now locally frozen and the task exists, but no production/host artifact registration, approved actual-host path or approved runnable host handoff follows.
Keep the private Python receipts below historical; they verify neither this Rust source nor its eventual packet.

## Static HTTPS artifact and prebuilt handoff: local preparation verified

Executor selected `Static HTTPS artifact (Recommended)` for preparation only; no GNU loader bundle or actual-host build was selected.
The initial Zig-musl link failed with duplicate `_start` from competing Zig/Rust CRT startup objects; `/tmp/opencode/chess-coach-host-facts-static-1cCOX8/` remains unchanged failed-attempt evidence.
Stable Rust 1.95 rejected the read-only `gnu-lld` linker-flavor probe as unstable; the corrected recipe uses bundled Rust LLD with stable `ld.lld` and Rust-provided self-contained musl CRT.
No nightly, `RUSTC_BOOTSTRAP`, handwritten CRT or application recipe/target/feature change followed.

The successful private receipt is `/tmp/opencode/chess-coach-host-facts-static-lld-6OVK2f/`.
Its private `build-recipe.json`, `build.stdout` and `build.stderr` record the package-only musl release, locked/offline and two jobs, with source/cache remapping and symbol stripping.
Never publish raw recipes or LLVM inspection files containing builder paths.
The frozen local `artifact/host-docker-runtime-facts-linux-x86_64-musl` is 674,400 bytes, mode 0555, SHA-256 `67541b7b2fb0388cd7bfefedfb69fcc74a7cca2e34cdf7f937fea15d2880538a`.
Private `verify-artifact.ts`, `artifact-inspection.json` and `elf-inspection-final.json` bind standard LLVM inspection to those bytes: no interpreter, needed library, RPATH or RUNPATH; five unsafe-ELF negatives rejected; four help/invalid smokes and the private-builder-path scan pass.
Static PIE `ET_DYN` with `PT_DYNAMIC` is allowed; these headers alone do not mean an external loader dependency.
No real `--confirm-host` profile ran, and real-host compatibility, deployment/runtime/GPU qualification and training readiness remain false.

`musl-tests.stdout`/`musl-tests.stderr` retain the actual release-musl 72-test pass: 69 unit, one CLI parser and two native-recipe tests.
The GNU 72-test and earlier Python/source receipts remain separate valid evidence, not a combined workspace/model test count.
`bun-handoff.stdout`/`bun-handoff.stderr` retain 26 passing tests across three files with 137 assertions: 22 partition tests plus the four new persisted handoff cases.
`typecheck.stdout`/`typecheck.stderr` retain the full strict source/test TypeScript check; `python-handoff.stdout`/`python-handoff.stderr` retain 74 passing post-mise/task Python tests in 0.593 seconds.
These do not claim a full Bun suite, full model Rust rerun, host execution or GPU e2e.

The architect accepted the source handoff plan; the new task now invokes the single literal digest-qualified prebuilt path, with raw_args/raw/quiet and no build/install/download/staging/dependencies/env/implicit confirmation.
The new closed `tooling/runtime/host-facts-artifact.json` records actual expectations while keeping deployment/runtime admission/host execution/provisioning/training/readiness false and GPU `NOT_QUALIFIED`.
The real-mise tests use fake bytes and empty tool/Cargo/Rustup stores; metacharacters remain literal arguments, while missing bytes fail without creating a target or falling back.
The actual binary still accepts only an explicit single `--help` or `--confirm-host` argument.
The proposed relative host store is not an accepted actual-host deployment; 0555 and a digest directory name supply neither confidentiality nor strong immutability under writable ancestors.
Independently accepted expected hash/size, approved exclusive HTTPS placement with no overwrite, operator-controlled/private-to-job storage and an exact fresh query grant remain prerequisites; cleanup or `cargo clean` invalidates staging without fallback.

The Rust tool options retain 1.95.0/minimal/rustfmt/Clippy plus installed llvm-tools/musl target; auto-install remains false and the three Python task bodies remain unchanged.
Root mise now also contains the new prebuilt task; it is no longer a tool-options-only diff.
Reviewers are rechecking the latest mise/metadata/test files; do not transfer the earlier Rust-source READY verdicts to that later handoff diff.
There is NO APPROVED RUNNABLE HOST HANDOFF until fresh publication or approved transfer, staging/deployment selection and exact host-invocation approval; preparation and task-plan acceptance grant none of those operations.

## Blocked Docker metadata proposal: Python verification

Status: PYTHON CLI PROPOSAL BLOCKED, SUPERSEDED AND REMOVED / RUST SOURCE-ONLY SUCCESSOR PLAN ACCEPTED / NO REGISTERED OPERATOR PACKET OR NEW HOST/PUBLICATION APPROVAL.
The CLI draft retained in the private receipt is historical; the [current Rust contract](host-runtime-inventory-request.md) replaces it with separate source evidence recorded above.
The Python results below supply no Rust implementation verification.

The private Python development receipt is `/tmp/opencode/chess-coach-docker-runtime-verification-pYJinp/`, separate from the operator-admission receipt.
Its later `python-tests-final.stdout` is empty; `python-tests-final.stderr` records all 98 Python tests passing in 0.892 seconds: baseline 74 plus 24 added proposal tests.
The preceding `python-tests.stdout`/`python-tests.stderr` retain the 97-test caller-guard run in 0.994 seconds; the later run adds the independent literal-allowlist regression.
`verification.json` records both runs and a prior focused-test depth-expectation failure; retain that failed-development chronology rather than replacing it with the final pass.
It also lists AST/TOML/local-link/receipt-JSON/whitespace checks and the existing gate-closure diagram's check/render; the actual `gate-closure.svg` and `plantuml.stderr` remain retained.
No other diagram or Cargo/Rust/Bun/TypeScript source changed in that Python slice, so those full suites were not rerun; this skip rationale does not cover a later Rust implementation.

The review sequence overrides any suggestion that passing Python fixtures accepted the packet:

1. Security reported MEDIUM CWE-200 exposure in the new tracked inventory summary and `READY TO MERGE: no`; the summary was redacted while the private report stayed unchanged, and subsequent privacy review resolved that finding.
2. Adversarial review then reported HIGH unregistered CLI plugin execution through `create --help`/`info`, plus help's possible daemon contact and hidden failure.
3. Adversarial review also reported MEDIUM socket-path/executable-path metadata-to-use races.
4. The Python operator proposal is blocked and superseded; security redaction does not resolve the separate HIGH findings.

These review findings were supplied by the lead; the private `verification.json` review field records rejection after the adversarial HIGH finding, not a later pass.
The adjacent `operator-packet-draft.json` explicitly marks the unpublished Python proposal rejected and forbidden for execution; it has no frozen source manifest and must not be presented as the Rust packet.
The lead removed only the added Python runtime profile/helpers/test/task, preserving the earlier Python tasks; the fresh Rust-slice receipt above retains the restored 74-test baseline pass.
The existing Python helper and preserved Python task bodies no longer contain the proposed Python runtime profile, and its new Python test file is absent.
The original failed-source and test logs remain retained; removal does not turn the failed proposal into an accepted packet or supply Rust proof, a source freeze, daemon contact, host qualification or publication approval.
Keep all Gate0/F9/R4/GPU qualification and training-readiness results unchanged.

## Earlier verification chronology

The preceding bounded-contract receipt is `/tmp/opencode/chess-coach-ii-sbx-contract-verification-d2noe53n/`.
Its private `operator-reported-root-preflight.json` retains the returned v2 report and warnings.
The contract task selects sbx once and queries exactly six fixed help pages, retaining earlier receipts even after a query exception.
Executor subsequently returned the successful six-command help packet without executing the listed operations.
Those reports do not establish actual resource admission, provisioning or training.
The preceding preflight-v2 correction receipt is `/tmp/opencode/chess-coach-ii-preflight-v2-verification-rt8qi3t6/`.
It reproduces the original combined size/type failure with a synthetic four-byte limit and proves explicit metadata-only skipping without reading the oversized fixture.
It preserves the two operator-reported host failures separately from agent-executed synthetic checks.
Executor reported host mise 2026.5.16 rejecting task-level `output`, then a v1 executable-check failure after independently updating to 2026.11.3.
The corrected task uses supported `raw`/`quiet` fields and no task-level `output`.
The actual installed-2026.5.16 binary was not part of local verification.
At correction delivery, actual host root help remained pending.
Executor subsequently supplied a passing v2 metadata/root-help report, preserving both skipped hashes and denied-home initialization warnings.
That operator report supplies no provisioning, workload, final artifact or runtime-control qualification.
The current diff leaves the previously verified Rust/Bun learning/game runtime unchanged.
Its complete pipeline results below remain the last full pass rather than a new full-pipeline run or host qualification.

The fresh complete Rust build/tests/formatting/Clippy, Bun, TypeScript, Python, actual mise parser/task-discovery and diagram receipts are in `/tmp/opencode/chess-coach-ii-host-mise-verification-uxq71elx/`.
The parser check invokes no real sbx command.
The preceding selected Cargo/Bun/TypeScript/native/development-Python closure receipt is `/tmp/opencode/chess-coach-ii-host-mise-closure-reed_eg3/`.
The current admission import inventory supplements its Python portion without claiming a new Cargo/Bun/native build or GPU runtime closure.
Both remain development evidence rather than independent Gate0 registration or actual host/runtime qualification.
The previous complete C15 receipts and development-source hashes remain in `/tmp/opencode/chess-coach-ii-c15-final-source-verification-e7dwst2t/`.
The preceding full corpus/RNG/strategic static-fixture receipts remain in `/tmp/opencode/chess-coach-ii-whole-match-verification-ks8hbbpi/`.
The fresh complete Rust/formatting/Clippy pass remains in `/tmp/opencode/chess-coach-ii-whole-match-rust-9nm840m8/`.
The development current/old-reference/type/native/control-plane inventory remains in `/tmp/opencode/chess-coach-ii-whole-match-closure-vt35ni4l/`.
All previous failures and synthetic evidence remain preserved.
The real separate-process fixture first exposed incomparable parent/child `hrtime` values; the corrected worker uses local guards while the owner retains raw deadline authority.
The C3 Docker queries and earlier synthetic Docker grant remain consumed.
C16 subsequently received and consumed its own exact read-only grant.
Its two formatted Docker queries and listed self/cgroup/CPU/statvfs/executable-metadata observations completed in 172.403 ms.
That partial inventory is recorded in [host-binding-inventory-request.md](host-binding-inventory-request.md).
No container, image-layer capture, production image build, controller write, workload inspection or game-data training operation occurred.
The subsequent separately authorized C17 self-path/mount-view observation completed in 22.109 ms and is consumed.
It found usable cgroup-view proposals but no accepted full-ceiling private storage target.
See [host-view-followup-request.md](host-view-followup-request.md).
These receipts do not register Gate0 artifacts or authorize execution.
Executor subsequently corrected their realm to sbx-local observations.
Do not promote C16/C17 to actual host CPU/storage/cgroup authority or treat their free-space samples as host provisioning limits.
The host-executed mise amendment, completed sbx-help discovery and received operator-reported Docker-client/GPU/filesystem facts are recorded in [host-entrypoint.md](host-entrypoint.md).
C19 remains authorized but unexecuted and paused.
The agent has executed no actual host sbx commands.
The subsequent operator-reported root and six subcommand help reports contain no provisioning or workload operation.
Executor selected host-backed state and actual F64 GPU learning in a shared-GPU host Docker job while keeping the coding agent in sbx and the active GPU attached to its host driver.

## Remaining gates

[gate-closure.md](gate-closure.md) records the retained/superseded/unresolved acceptance matrix and source/test critical path. Proposed paths are not passing evidence. Gate0, F9 and R4 remain open. Executor selected the supported-runtime rebaseline under C1; full implementation and runtime evidence remain pending. Existing development authorization remains separate from fresh capture/build/runtime/native-proof grants.

Complete physics, causal recipients/economics, closed native/policy/match protocols, redundant Burn numerics and synthetic whole-match/SQLite publication now have persisted checks.
Actual captured runtime, loading, effective controls, independent confined reference/lifecycle, durable target and original-clock qualification remain open.
The current manifests and three native entrypoints still select CPU Flex.
No supported GPU backend implementation, GPU build or real F64 GPU forward/backward/SGD/reload/redundant-learner/VRAM/cleanup proof exists.
The metadata task and synthetic tests do not satisfy mandatory GPU learning readiness.
Training readiness remains false.
Apply active AGENTS.md adversarial and applicable security review gates after implementation and feasible verification, before completion; do not defer them until readiness.
The corrected [gate-closure.puml](gate-closure.puml) applies active AGENTS adversarial/security gates; it does not defer each implementation slice's reviews until readiness.
The scoped admission/GPU publication approval does not authorize further publication or game-data training.

The scoring subprocess consumes actual feature encoding derived from bounded synthetic fixtures, including continuing observations produced by the actual causal source pipeline. Hidden-state-twin e2e checks compare candidate order, feature values and frozen native Burn scores. The new representation, context-dependent MLP and feature/model-artifact binding have source tests. No placeholder economic readout, custom estimator or missing-channel zero padding ships. The operator approved replacing DIRECT metering with shared standard OS-resource limits. The one-shot synthetic grant is consumed. Production resource admission still requires concrete limits, separate host-operation authorization and applicable pipeline/deadline verification; byte caps and the synthetic proof do not establish it.
