# GPU cooperative policy — reconstructed source contract

CURRENT: `SOURCE_RECONSTRUCTED` / `VERIFIED_TEST_SUBSETS` / `SOURCE_REVIEWS_ACCEPTED_SCOPED` / OPERATIONAL QUALIFICATION OPEN / `trainingReady:false`.

See [recovery.md](recovery.md) for provenance, consumed grants, missing bytes, and historical-only results.
`runs/closure-policy-1/` freshly records 352 passing Bun tests / 1,262 assertions with `sourceChanged:false` beneath `_work/gpu-owner-recovery/`; `custody-policy-final-1` remains a distinct prior generation.
The corrected owner run `runs/corrected-source-owner-final-2/` also passes all 33 semantic traces inside one Rust conformance case; source/test typechecks pass in the recorded custody runs.
Current Rust C1 security, authenticated TypeScript packet-5 security, scoped integer-contract, and final adversarial source-only verdicts are accepted, as scoped in [verification.md](verification.md#current-scoped-source-review-acceptance); operational qualification remains open.
The old TypeScript security verdict is historical before physical-reference pinning and integer regressions; it accepts no current source, full legacy suite, or operational behavior.
The [sequence diagram](gpu-cooperative-policy.puml) describes the pure policy contract.
[gpu-owner.md](gpu-owner.md) owns clocks, queries, launch, ownership, cleanup, and the separate Bun job.
This policy neither reserves VRAM nor guarantees uninterrupted host/display use.

## Exact recovered file boundary

The Bun implementation is `tooling/runtime/gpu-policy.ts`.
Its tests are `packages/runtime/tests/gpu-policy.test.ts` and `packages/runtime/tests/gpu-policy-conformance.test.ts`.
The corresponding reconstructed Rust policy lives inside `crates/gpu-owner` and is connected to `run_once` / `run_once_with`.
Both suites consume `tooling/runtime/fixtures/gpu-policy-traces.json`.
These are the recovered historical paths, not proposed replacements under runtime source.

## Pure boundary and exact objects

The policy has no provider, filesystem, child-process, Docker, clock-reading, or GPU side effects.
The caller supplies `S0`, `now`, configuration, and samples.
An emitted abort action is an instruction for the caller's bounded owned cleanup, not permission to select a target.

Configuration is an exact own-field object:

```text
selectedUuid
startupMinFreeBytes
runningStopBelowFreeBytes
samplePeriodNs
maxSampleAgeNs
```

Samples are exact own-field objects:

```text
uuid
freeBytes
totalBytes
observedBoottimeNs
```

Reject unknown, missing, inherited-substitute, accessor, symbol, or incorrectly typed fields.
Accept ordinary `Object.prototype` and null-prototype objects with the exact own data fields; frozen, sealed, and nonenumerable data properties do not invalidate that shape.
JavaScript must use native `node:util` `types.isProxy` before reflection, property lookup, descriptor inspection, or accessor execution on each untrusted object boundary.
Reject **all** Proxy objects, including revoked Proxies.
Do not dispatch through a caller-supplied JavaScript proxy detector or custom validation hook.
JSON trace tests cannot express this guarantee; keep direct JavaScript Proxy/trap-canary tests separate.

JavaScript configuration integers use `bigint`, not floating-point `number`.
All numeric policy values fit signed i64.
Thresholds and durations are positive, `runningStopBelowFreeBytes <= startupMinFreeBytes`, and `0 < samplePeriodNs <= maxSampleAgeNs`.
Clock values are nonnegative within the same representable range.
The owner manifest serializes these integers as canonical unsigned decimal strings; this does not change the pure JavaScript type.

The GPU identifier is the canonical 40-character `GPU-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` shape with hexadecimal groups.
Compare the accepted string case-sensitively; do not lowercase or normalize it into another identity.
Sample `uuid` must exactly match `selectedUuid`.

Require `0 <= freeBytes <= totalBytes`, `totalBytes > 0`, and `totalBytes <= i64::MAX`.
The first accepted total establishes `stableTotal`; every later sample must retain it.
Do not infer a memory reservation from `freeBytes` or change total to excuse a threshold failure.

## Failure classification and precedence

Preserve terminal state, initial configuration/origin failure, caller clock, method/state, original absolute deadline, and old-lease gates before inspecting any new sample.
An expired old lease must not trigger new-sample reflection, even if that sample would fail shape or identity.
Within a reached JavaScript object boundary, native `types.isProxy` runs first and rejection executes zero proxy traps.

After those earlier gates, validate a new sample in this exact order:

| Stage | Rejection |
|---|---|
| SHAPE | `TELEMETRY`: closed-object violation, invalid UUID syntax, any non-bigint/out-of-unsigned-i64 numeric value (including timestamp), nonpositive total, or `freeBytes > totalBytes` |
| DEVICE | `DEVICE`: a valid canonical UUID differs case-sensitively from the selected UUID |
| Sample time | `SAMPLE_TIME`: a representable timestamp lies before S0 or after caller `now` |
| Sample order | `SAMPLE_ORDER`: timestamp fails strict increase over the last accepted sample |
| Capacity | `CAPACITY`: startup threshold exceeds a valid positive total, or a later valid total differs from the accepted stable total |
| New-sample age | `STALE_SAMPLE` before `MISSED_SAMPLE` on equal age/cadence boundaries |
| Headroom | `HEADROOM`: free bytes fall strictly below the applicable startup/running threshold |

An invalid total/free range or malformed UUID is `TELEMETRY`, not `CAPACITY` or `DEVICE`; a representable future/before-origin timestamp is `SAMPLE_TIME`, not a shape violation.
Use `CAPACITY` only for the threshold-versus-total and stable-total checks above.
This correction preserves terminal latching, once-only actions, and all earlier config/clock/deadline/old-lease precedence.

## Clocks, thresholds, and strict boundaries

- Require `now >= S0` and nondecreasing caller `now` values.
- Require `S0 <= observedBoottimeNs <= now`.
- Accepted sample timestamps strictly increase; equal timestamps are not a refresh.
- Threshold equality passes: startup requires `freeBytes >= startupMinFreeBytes`; running requires `freeBytes >= runningStopBelowFreeBytes`.
- Freshness is exclusive: a sample is usable only while `now < observedBoottimeNs + maxSampleAgeNs`.
- Cadence is exclusive: the current lease must be refreshed before `observedBoottimeNs + samplePeriodNs`.
- Check the old lease's cadence/freshness and original absolute deadlines **before** considering a newly supplied sample.
- A sample arriving at the old expiry cannot rescue the lease, even if the new sample is otherwise fresh and above threshold.
- Admission must occur strictly before `S0 + 10s`; it never creates a new origin.
- Normal work ends at `S0 + 297s`; cleanup must finish before `S0 + 300s`.

For an accepted sample, compute in wide arithmetic:

```text
nextCheck = min(
  observedBoottimeNs + samplePeriodNs,
  observedBoottimeNs + maxSampleAgeNs,
  S0 + 297 seconds
)
```

Use checked/wide addition before comparison.
Never overflow i64, wrap a deadline, or clamp an expired interval into a renewed lease.
During `awaiting`, the original cold admission deadline is an additional active check; `nextCheck` cannot replace it.

## States and terminal behavior

| State | Allowed progress | Failure behavior |
|---|---|---|
| `awaiting` | Validate one origin/configuration and an admissible initial sample, then emit admission once | First prelaunch rejection latches its reason and becomes terminal |
| `running` | Accept timely increasing same-UUID/stable-total samples above the running threshold; update `nextCheck` | First post-admission failure latches its reason, emits `abort-owned` once, and becomes terminal |
| `terminal` | No admission, refresh, or abort repetition | Preserve the first reason; later events cannot revive the attempt or replace it |

Prelaunch rejection never emits an owned-job abort for a job that was not admitted.
Post-admission abort never names a worker-selected container or grants a second launch.
The owner preserves cleanup faults separately without replacing the policy's first failure.
No retry, implicit successful completion, or CPU fallback follows from any terminal state.

## Telemetry adapter obligations

The pure policy does not certify a provider timestamp or query result.
The owner supplies validated samples using the conservative query-start BOOTTIME anchor `q0`.
`q0` is not a hardware observation timestamp.
Provider caching behavior and actual observation latency remain unqualified.

Let `I` be refresh interval, `Q` query budget, and `J` scheduling reserve.
Require `0 < I,Q,J` and `I + Q + J < samplePeriodNs <= maxSampleAgeNs` in wide arithmetic.
Schedule the next query at `q0 + I`, but no later than `nextCheck - Q - J`.
Do not add grace at cadence, freshness, cold-start, normal-work, or final-cleanup boundaries.
Maintain at most one query while multiplexing manager, attach, query, and timer readiness.

## Reconstruction verification targets

Exactly 33 shared Rust/Bun JSON traces reconstruct the accepted semantics; five reason expectations were corrected without changing the trace count.
Do not claim their bytes match the lost historical fixtures.
The recreated `tooling/runtime/fixtures/gpu-policy-traces.json` may receive a new content identity for fresh verification; no original fixture bytes or historical fixture hash were recovered.
Cover field closure, ranges, UUID identity, stable total, clock regressions, duplicate samples, threshold equality, old-expiry precedence, wide addition, absolute deadlines, terminal latching, and exactly-once admission/abort actions.
Test native Proxy rejection separately before traps or reflection can run.
All fixtures and bounded receipts belong inside the repository.
Earlier 276-test policy passes are `PRE_FIDELITY_CORRECTION`; they do not verify this corrected precedence contract.
No policy trace qualifies the real GPU, provider, runtime, storage, clock scheduling, or actual cleanup.
