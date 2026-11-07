# Frozen policy decision and ACK boundary

## Scope

The private runtime owns immutable model identity, actual recipient history, permit/deadline context and last-ACKed RNG state.
The model-facing enumeration/encoder receive only the validated side-local observation.
Model outputs cannot select an artifact, history replacement, native path or eligibility flag.
Keep policy preparation forbidden before the exact issued permit.

## Determinism

Use the existing four named SHA-256/mulberry32 stream derivation and masters 101..105.
Keep selection, policy-sampling and opponent streams separate.
Keep environment-settlement and generator unused as previously selected.
Validate the 20 derived roots for cross-roster collisions without salts or retries.
Serialized stream state uses closed standard JSON fields and safe integer counters.

Create candidate keys with standard `JSON.stringify` on the validated action arrays.
Hash the ordered key array through standard SHA-256.
Evaluation chooses maximum finite logit and breaks exact ties by key ascending.
Training uses stable shifted log-softmax at temperature 1 and exactly one uniform draw, including a single pass candidate.
Keep exponential underflow to zero permitted, but compute selected log probability directly from logits.
Require finite log probabilities/probabilities and probability sum error at most `1e-12`.
Use the last nonzero candidate only for cumulative floating-point rounding within that tolerance, never as strategic rescue.

## Transaction

The child returns a bounded compact decision journal, not feature/probability matrices or gradients.
It retains tentative stream changes until the exact ACK.
The owner checks raw complete-frame receipt against the original permit deadline before parsing.
It independently reconstructs history, candidates, encoded features, scores, one draw, membership, actions, spend and selected log probability.
Owner verification remains within the original whole-job work deadline; it does not charge a timely child's result as a new candidate timeout.
Verification never grants a fresh origin.

Only after verification may the owner expose its recomputed feature batch to the Burn accumulator or release the selected actions to one native admission.
Do not expose the first seat's selected queue to the other seat's observation.
Native admission failure receives no retry, next candidate, prefix salvage or heuristic fallback.
Infrastructure failures remain ineligible for learned rewards.
The episode owner must prove any eligible stop against actual owned execution, not journal labels or exception strings.

This source boundary neither runs training nor supplies the remaining whole-match/strategic/corpus/checkpoint/runtime qualification.
See [readiness.md](readiness.md) and [learning-runtime.md](learning-runtime.md).

## Persisted reconstruction and RNG checks

The full policy transaction fixture retains all 512 candidates and uses an explicit 15-second test-harness limit for child planning plus independent owner reconstruction.
This test-harness bound does not change either original 10-second planning permit.
Transaction negatives use smaller valid zero-resource observations with the same real enumerator/encoder and schema assertions.
Development profiling attributed most reconstruction time to repeated validation of the 1,162,752-number inference request, not enumeration.
No runtime-fit or qualified timing result follows from this profile or the synthetic clocks.

`packages/runtime/tests/fixtures/rng-reference.json` freezes all 20 roots and 256-draw fingerprints per root from the pinned reference `mulberry32` export.
`tooling/verify-rng-reference.ts` checks 5,120 draws against that export without generating game data.
The stream schema rejects impossible root/state/draw-count prefixes.
Restore tests require exact next-draw equality and keep environment-settlement unused.
An ACKed worker retains its committed sampling prefix even if a subsequent invalid call revokes the session.
