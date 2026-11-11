# Typed causal journal

## Goal

Emit a newly versioned flat TypeScript/Zod journal from actual resolver mutation sites.
Do not copy the old companion wire, frame keys, canonical codecs, authority receipts or ownership registries.
Retain the actual stable unit/mine identities, accepted action references, deployment dispositions, causal visibility and successful consumed-target facts required by [provenance.md](provenance.md).

## Data and ownership

`chess-coach.causal-state.v1` holds private engine entities, native mine order, counters, CC lives, turn and native-call ordinal.
Engine IDs stay private.
Recipient producers allocate independent side-local public IDs and sequences.
The state is game data, not a native execution permission.
Parsing a journal, constructing a collector or matching a digest grants no session/model authority.

`chess-coach.causal-journal.v1` contains flat mutation and recipient-visibility-delta events, plus bounded private discovery traces.
Group ordinals identify simultaneous causal preimages without serializing old before/after engine frames.
Every event has a contiguous call-local ordinal.
Effects carry the actual accepted native action sequence or null for automatic turn-open effects.
The coordinator maps those sequences to the already accepted recipient-local action references.

Use plain engine state and standard serialization.
Use object-to-entity lookup only to preserve actual game operand identity across native board reparsing.
Do not treat that lookup as an authorization registry or transfer it between realms.
The collector lives on a host-only producer subpath.
Pure kernel source depends only on constructor-free effect-sink types.
Keep the collector out of model-facing runtime/type/reexport closures.

## Mutation groups

Capture recipient geometry from the actual live state before each logical mutation group.
Record unit births, movements, type changes, destruction, Tank mode changes, mine births/removals, CC damage and every requested deployment disposition.
Retire attack-wave casualties and staged mine removals under their common preimage.
Preserve native mine order and multiplicity.
After the group, emit only changed recipient cells.
Do not expose raw private ordinals or hidden events through recipient sequences.

Record own lifecycle events regardless of enemy visibility.
An enemy casualty becomes a witness only if the actual live victim was geometrically observed in that group's preimage or an actual native application consumed its target.
Retiring a vision source changes subsequent visibility.
Final snapshots cannot retroactively justify witnesses.

## Native path discovery

Keep query inputs/results private, including actual mode/mines inputs, evaluated squares and returned discovery step.
Speculative intermediate squares do not become public observations or `everLit` tiles.
Only successful native application can authorize its target-only assertion.
Failed actor/victim guards, dropped or stationary-siege applications authorize no target fact.

Retain evaluation and applied operand IDs separately.
Do not impose a new equality rule between those IDs.
Bind the actual applied target to its live pre-destruction entity and successful native operation.
Attach the consumed target observation to that causal casualty before publishing the completed journal.
The recipient reducer applies the target assertion before casualty clearing and later visibility deltas.
Never reintroduce a dead target after a mine death or hidden replacement.

## Bounds and transactions

Keep at most 64 live units, 6 live mines, 1,152 mutation effects, 4 ray queries and 4,096 flat journal events per native call.
Keep standard private journal JSON within the retained 16 MiB completion bound.
Bound every cell delta to 64 entries and every query trace to 6 intermediate squares.
Do not truncate support or discard facts to satisfy a bound.
Exhaustion fails the staged operation as infrastructure failure.

The native wrapper checks the private starting state against the actual kernel snapshot.
It validates resulting unit placement/types/modes, ordered mines and CC lives against the actual result before publishing state/journal successors.
The session coordinator must stage both recipients and reject partial commits.
The collector never issues a planning permit or authorizes training.

## Required verification

- Physical results remain identical with and without the sink.
- Birth, transform, movement and destruction retain actual IDs.
- Paid deployment dispositions distinguish no birth from immediate post-birth loss.
- Mine selection/removal preserves actual ordered identities.
- The retained privacy twins in [provenance.md](provenance.md) produce identical recipient bytes where authorized histories agree.
- Failed native consumption emits no assertion.
- Casualty memory clears before subsequent deltas/replacements.
- Dead vision sources cannot witness later fire-and-forget losses.
- Standard JSON/Zod rejects malformed, oversized, unordered or inconsistent journal data.
- Model-facing source closure rejects collector imports, including type-only and transitive paths.

## Current source evidence

`packages/game-core/src/causal-events.ts` implements the collector.
`classical-resolution.ts` and `resolve.ts` emit effects at actual mutation sites through constructor-free sink types.
`packages/game-core/src/causal-producer.ts` exposes host-only begin/end wrappers with starting/final snapshot checks.
`packages/contracts/src/causal-journal.ts` implements the bounded standard JSON/Zod state/journal codec and exports JSON Schema.
Model-facing roots do not reexport collector constructors or host producer/codec/session entrypoints.

The persisted sink-parity suite checks all 11,045 canonical begin/admission/settlement outcomes with and without the sink.
Collector tests check identity, mine multiplicity, common causal preimages, promotion, snapshot drift, failure closure and separate evaluation/applied operands.
Contract tests reject malformed ordering, targets, traces, counters, side/mode substitutions and byte exhaustion.
[recipient-production.md](recipient-production.md) records the implemented continuing recipient, bank-owner and replay slice.
These are bounded static source fixtures, not an independently qualified F9 runtime or a training-ready claim.
