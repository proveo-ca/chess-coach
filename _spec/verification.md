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
- [host-entrypoint.puml](host-entrypoint.puml): host mise metadata preflight, separately granted provisioning and supported sbx execution.

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
| `tooling/runtime/tests/test_supervise.py` | Fake manager/cgroup controls, original deadlines, owned cleanup, evidence failure and no operational retry |
| `tooling/runtime/tests/test_evidence.py` | Bounded exclusive fsynced evidence, retained failure reservations and packet-wide storage refusal |
| `tooling/runtime/tests/test_state_mount.py` | C13 exact selected private bind source/target and substituted/extra mount refusal |
| `tooling/runtime/tests/test_recipe.py` | Unexecuted pinned multi-stage recipe, network-disabled builds, nonroot/init and six fixed reference outputs |
| `tooling/runtime/tests/test_host_inventory.py` | C16 bounded CPU/projection calculations and refusal to promote sandbox observations to daemon-host authority |
| `tooling/runtime/tests/test_host_view.py` | C17 bounded mountinfo projection, local/cgroup selection and malformed-input refusal |
| `tooling/runtime/tests/test_host_preflight.py` | Fixed metadata/help argv, tool identity, absent tools, failure/byte/deadline cleanup, host assertion and actual mise parser with empty offline Bun/Rust tool directories |

The persisted process e2e tests use explicitly synthetic source/model/return fixtures.
The whole-match fixture uses actual canonical game transitions and native Burn updates, not a genuine corpus/strategic rollout or a measured training experiment.
The separately authorized historical one-shot Docker proof remains in [native-job.md](native-job.md).
It is not the final production envelope or a current live host e2e qualification.

## Results

- Rust: 38 tests pass with locked, offline dependencies and 2 Cargo jobs.
- Rust formatting: passes.
- Clippy: passes with warnings denied.
- Bun after host-mise/storage refresh: 489 tests pass across 66 files, with 29,887 assertions.
- TypeScript: source and tests pass strict static analysis, including unused-symbol checks.
- Python: all 42 fake/synthetic/static tests pass, including the host preflight/parser, C16/C17 calculations and unexecuted C19 parser fixtures.
- PlantUML: all 23 diagrams pass syntax checking and SVG rendering in `/tmp/opencode/chess-coach-ii-host-mise-verification-uxq71elx/`.
- Synthetic Docker: one container passed limit, inheritance, CPU/PID/memory pressure and manager-cleanup checks within 7.477 seconds; no production-admission claim.
- New JSON manifests and whitespace: pass.

Rust verification uses the operator-approved installed Zig 0.15.2 through temporary C-driver scripts outside the repository. A normal GCC/Clang development toolchain remains sufficient on a standard host. No repository compiler shim or runtime bootstrap is required.

The fresh complete Rust build/tests/formatting/Clippy, Bun, TypeScript, Python, actual mise parser/task-discovery and diagram receipts are in `/tmp/opencode/chess-coach-ii-host-mise-verification-uxq71elx/`.
The parser check invokes no real sbx command.
The refreshed selected Cargo/Bun/TypeScript/native/development-Python closure receipt is `/tmp/opencode/chess-coach-ii-host-mise-closure-reed_eg3/`.
It remains development evidence rather than independent Gate0 registration or actual host/runtime qualification.
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
The new host-executed mise architecture and missing host interface are recorded in [host-entrypoint.md](host-entrypoint.md).
C19 remains authorized but unexecuted and paused.
No real host sbx command, provisioning or training occurred.

## Remaining gates

[gate-closure.md](gate-closure.md) records the retained/superseded/unresolved acceptance matrix and source/test critical path. Proposed paths are not passing evidence. Gate0, F9 and R4 remain open. Executor selected the supported-runtime rebaseline under C1; full implementation and runtime evidence remain pending. Existing development authorization remains separate from fresh capture/build/runtime/native-proof grants.

Complete physics, causal recipients/economics, closed native/policy/match protocols, redundant Burn numerics and synthetic whole-match/SQLite publication now have persisted checks.
Actual captured runtime, loading, effective controls, independent confined reference/lifecycle, durable target and original-clock qualification remain open.
Training readiness remains false.
Reviewers remain deferred.
Publication and game-data training require separate authorization.

The scoring subprocess consumes actual feature encoding derived from bounded synthetic fixtures, including continuing observations produced by the actual causal source pipeline. Hidden-state-twin e2e checks compare candidate order, feature values and frozen native Burn scores. The new representation, context-dependent MLP and feature/model-artifact binding have source tests. No placeholder economic readout, custom estimator or missing-channel zero padding ships. The operator approved replacing DIRECT metering with shared standard OS-resource limits. The one-shot synthetic grant is consumed. Production resource admission still requires concrete limits, separate host-operation authorization and applicable pipeline/deadline verification; byte caps and the synthetic proof do not establish it.
