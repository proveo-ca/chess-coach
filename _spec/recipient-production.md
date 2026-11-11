# Continuing recipient production

## Goal

Project only actual causal effects into new recipient-local batches and the existing versioned observation contract.
Keep engine IDs, hidden events, query traces and private ordinals out of public bytes.
Persist independent own unit/mine/witness counters for each side.
Retain actual paid basis across movement and promotion.

## Ownership

The host-only recipient producer accepts a genuine native journal, its successor state, the actual kernel result and explicitly owned bank values.
Standard decoding checks data consistency; it grants no runtime or session authority.
Initial fixture endowments carry zero paid basis.
Only accepted deployment actions create paid receipts.
Receipt references use the recipient's accepted action ordinal, never the combined native action sequence.
The bank owner debits accepted deployments exactly once and applies the actual capped settlement grant exactly once.
Turn-open effects grant no minerals, including terminal chips.
Never estimate mineral history from the turn or use missing core `stored` fields as a reset.

## Recipient fold

For each logical mutation group, emit successful consumed-target assertions before casualty clearing.
Apply own lifecycle and genuinely witnessed enemy losses before the group's completed visibility deltas.
Do not emit hidden effects or use their private ordinal for public numbering.
Count witnessed enemy losses once by actual private victim identity.
Publish no enemy paid basis or global casualty count.
Retain stale enemy memory only where later authorized knowledge does not clear it.
Fold final geometric cells at the successor turn.
Do not include speculative prefix cells in memory or `everLit`.

Maintain `paidDebits = paidSurviving + paidDestroyed + paidWasted` after every batch.
Bind each materialized receipt to the actual created own identity, even if it immediately dies.
Keep CC replacement value zero.
Preserve actual ordered private mines while exposing only own identities and deduplicated own lit squares.

## Verification

Use the actual instrumented kernels for privacy twins, paid replacement/crush/mine/promotion fixtures and bounded scripted init/open/pass transitions.
Check both recipients before returning a successor.
Reject partial failure without mutating the parent.
Persist source-level replay/conflict/gap and bank-conservation tests.
These static fixtures authorize no gameplay collection, training, operational runtime admission or publication.

Runtime-owned session/cursor binding, independent reference execution, native process lifecycle and R4 learning remain separate unfinished gates.

## Current source

- `packages/contracts/src/recipient.ts`: side-local effect fold, memory/light history, lifecycle IDs, witnessed losses and paid receipts.
- `packages/contracts/src/recipient-codec.ts`: closed bounded standard JSON/Zod recipient batches with JSON Schema export.
- `packages/contracts/src/game-session.ts`: explicit bank owner, independent same-open-board staging, atomic BOTH-recipient successor construction and deterministic source-bound record replay.
- `packages/contracts/tests/recipient-privacy.test.ts`: actual-kernel privacy twins and casualty-ordering regressions.
- `packages/contracts/tests/game-session.test.ts`: real init/open/settlement data, banks, receipts, promotion/crush, immediate mine loss, terminal waste, pair failures and replay gaps/conflicts/identical repeats.
- `packages/policy/tests/recipient-noninterference.e2e.test.ts`: continuing actual recipient twins through candidate enumeration, encoding and frozen native Burn scoring with a synthetic checkpoint.

`seedGame` constructs explicit zero-paid fixture endowments.
`initializeGame` uses only the approved canonical opening.
Neither function grants runtime permission.
The replay history retains only standard SHA-256 equality receipts for bounded records, not an authorization registry.
Replaying a fresh record reexecutes the actual source and compares both public batches, banks and snapshots.
Identical prior records return unchanged facts; gaps, conflicting bytes and recomputed mismatches fail.
Both recipients must validate before the new session is returned.
No parent mutation occurs on staging, native, projection or replay failure.
