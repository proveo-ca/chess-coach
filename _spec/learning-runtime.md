# Frozen MLP episode accumulation and numerical closure

Status: C6 / C7 IMPLEMENTED AND NUMERICALLY CHECKED / NATIVE CHANNEL SOURCE VERIFIED / NOT TRAINING READY.

Executor selected `Burn accumulation (Recommended)` for C6.
Executor selected `Feature-complete sweep (Recommended)` for C7.
Neither decision authorizes collection, training, capture/build or runtime qualification.

## C6: bounded frozen derivative ownership

Use Burn's supported `GradientsAccumulator<PolicyModel>` and `GradientsParams`.
After a candidate decision receives its trusted ACK, differentiate its negative selected log probability against the unchanged episode model.
Accumulate those framework-owned parameter gradients without averaging.
Do not retain all candidate feature tensors or backward graphs across decisions.
Retain bounded compact ACK journals and one model-sized gradient set.
The model has 72,736 trainable F64 coordinates: 72,672 hidden weights, 32 hidden biases and 32 output weights.
This is a tensor-coordinate count, not a measured memory/fit claim.

At eligible completion, multiply the accumulated negative-log-probability gradient by the frozen advantage.
Obtain L2 gradients through Burn autodiff once.
Combine gradients through Burn's accumulator and execute one standard SGD step at .001.
Check logits, selected log probabilities, summed gradients, objective, combined gradients and proposed model for finite F64 values.
An invalid operation closes the staged episode.
An empty episode emits no model proposal, no L2-only update and no baseline insertion.
The coordinator, not the accumulator constructor or a JSON flag, establishes ACK and return eligibility.

The updated episode/checkpoint protocol uses standard bounded JSON/Serde and Burn-native model records.
It stores completed model/counter/RNG/journal metadata only at verified eligible boundaries.
It does not serialize pending gradient buffers, enable mid-episode checkpointing or authorize retry/resume.
Per-decision ACK verification and all original absolute/per-permit deadlines remain required.

## C7: explicit finite-difference coverage

Preserve `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`.
Use the retained coordinate-wise rule:

```text
gFD = (L(theta + eps*e_i) - L(theta - eps*e_i)) / (2*eps)
abs(gBurn - gFD) <= atol + rtol * max(abs(gBurn), abs(gFD))
```

For each active/inactive ReLU fixture, check exactly 2,335 distinct parameter coordinates:

- For every input `i=0..2270`, hidden weight `[i, i mod 32]`.
- Every hidden bias `j=0..31`.
- Every output weight `[j,0]`, `j=0..31`.

Use nonzero fixture weights and dense, candidate-distinct inputs.
Keep the active/inactive fixtures away from the ReLU nondifferentiable zero boundary.
Cover all input coordinates and hidden/output channels without claiming all 72,736 parameters received coordinate-wise checks.
Add separate extrema, single-candidate, zero-advantage, empty, bound, failure and native-record reload fixtures.
Compare accumulated updates with the existing whole-episode Burn objective.

These synthetic numeric checks establish neither game-data improvement nor runtime resource qualification.
The remaining acceptance path is [readiness.md](readiness.md).

## Native channel boundary

`crates/policy-io/src/channel.rs` and `src/bin/policy-channel.rs` implement closed bounded standard JSONL on an independently selected frozen native record.
Every request/reply binds one session, frozen model identity and contiguous message ordinal.
Begin fixes the baseline once.
Score leaves the model unchanged.
ACK consumes at most 64 unique decision IDs and journal digests, with bounded reconstructed feature batches.
Finish returns either no record for an empty diagnostic or one uncommitted finite native-record proposal.
The channel requires explicit close, input EOF and successful natural exit.
It closes after malformed input, wrong phases/identity, duplicate ACKs, nonfinite values or frame/message exhaustion.

`packages/runtime/src/native-learner.ts` owns the transport, immutable absolute work/cleanup deadlines, raw receipt checks and proposal-byte/config validation.
It does not establish return eligibility merely by accepting a numeric return or an ACK-shaped object.
The whole-match coordinator must own the reconstructed ACKs and prove the eligible completion before calling Finish.
It must compare independent learner proposals and commit model, baseline, counters, streams and journal/checkpoint state atomically once.
The checked whole-match and private completion path now exists in [match-runtime.md](match-runtime.md) and [state-persistence.md](state-persistence.md).
Its synthetic process/SQLite verification does not qualify the actual mounted target or runtime.

Persisted Rust channel fixtures and `packages/runtime/tests/native-learner.e2e.test.ts` exercise real Burn processes with synthetic records and bounded inputs.
They verify frozen scoring before/after ACK, accumulated proposals, empty diagnostics, identity failure and record reload.
They run neither a game-data training episode nor a qualified confined runtime.

The original 32-test Rust pass and 4,670 central differences remain in `/tmp/opencode/chess-coach-ii-burn-verification-2aiuuann/`.
The new channel-targeted pass/build remains in `/tmp/opencode/chess-coach-ii-channel-check-f1__1wnj/`.
The preceding device-reconfiguration fixture failure remains in `/tmp/opencode/chess-coach-ii-channel-check-og467qb_/`.

## C10: exact initial hidden seeds

Executor selected `Seed by master (Recommended)` in C10.
Call the configured standard Burn device's `seed(master)` once before each master's initial model construction, with exact masters 101,102,103,104,105.
Keep Burn's default hidden initializer and the zero bias-free output head.
Consume no selection, policy-sampling, environment, opponent or generator draws for model initialization.
The host-only initial-record metadata must record that master/seed and bind the actual captured record/config bytes.
Inference still receives only its bounded config/native record, never curriculum or RNG metadata.

`crates/policy-io/src/bin/policy-initialize.rs` accepts only the five selected master arguments and emits one finite bounded Burn-native record.
It does no game, feature, scoring, accumulation or checkpoint work.
F9's fixed native-only job never dispatches it.
Its five-master reproducibility fixtures compare parameter values, including the hidden weights, rather than assuming that independent native serializations share incidental parameter identifiers.
The existing seed-42 `initial-record` example remains an explicitly synthetic test fixture, not the selected five-master initialization recipe.

## C12: coordinator-owned redundant native learners

Executor selected `Coordinator pair (Recommended)` in C12.
The in-envelope coordinator owns two separate fixed Burn learner processes.
It feeds both only independently reconstructed ACKed batches.
The whole-match child owns frozen scoring, not a gradient checkpoint or a learner-supplied eligibility flag.
This explicitly replaces the historical linear child-score-accumulator comparison mechanism.
It retains exact decision/RNG/native/opponent reconstruction and the frozen objective.

`packages/runtime/src/learner-pair.ts` rejects shared channels/model/session substitution and compares sampled counts, objective, nonzero-PG classification and logical parameter digests before returning an uncommitted proposal.
It aborts both owned learners on mismatch, reentry, invalid phase or close failure without choosing a fallback result.
Both learners retain the original absolute work/cleanup deadlines.
After a proved candidate timeout, the coordinator must first stop/reap the match child and then finish only its known ACKed prefix within those unchanged deadlines.
An infrastructure or learner failure never earns that prefix reward.

The native `parameterSha256` hashes a versioned architecture/feature prefix, the three ordered validated tensor shapes and every finite F64 value's standard little-endian bytes.
It excludes incidental native-record parameter identifiers.
The native channel reloads the emitted Burn record and requires its logical digest to match before replying.
The wire carries a bounded SHA-256 string, not gradients, tensors, a replacement numeric codec or a pending-episode checkpoint.
The pair selects the first physical native record only after both logical proposals agree.
Its record bytes/config SHA-256 remain independently checked by the owned channel adapter.
These are redundant executions of the same supported Burn implementation, not independent mathematical implementations or a kernel-custody proof.
