# Typed causal journal

## Goal

Emit a newly versioned flat TypeScript/Zod journal from actual resolver mutation sites.
Do not copy the old companion wire, frame keys, canonical codecs, authority receipts or ownership registries.
Retain the actual stable unit/mine identities, accepted action references, deployment dispositions, causal visibility and successful consumed-target facts required by [provenance.md](provenance.md).

## Data and ownership

The consolidation places implementation ownership in `packages/starchess-core/src/engine`, with actual physical mutations in `src/resolve/submit-turn.ts` and `src/resolve/resolve-turn.ts`. [engine-consolidation.puml](engine-consolidation.puml) states the contract. **Move tests; retire shim** removes the former `packages/game-core` forwarding workspace and places the retained causal suites at `packages/starchess-core/tests/native/causal-events.test.ts` and `causal-parity.test.ts`. All canonical core source stays byte-identical during that layout task. Fresh layout verification is pending; the earlier scoped Bun pass is historical. Native/runtime/training qualifications remain separate.

Current command: `bun test packages/starchess-core/tests/native`. Retained fixture bytes/modes and historical source fields do not change. New source/closure receipts belong under `artifacts/engine-layout`; old verification commands and frozen evidence remain as recorded. Canonical product/native closures must still exclude the host producer, while obsolete retired-package negatives now reject unapproved or unresolved imports.

`@chess-coach/starchess-core/causal-producer` remains host-only. `/causal-types` exposes constructor-free contracts, and `/engine` exposes pure rules/planning without collector constructors. Product and native ML admission keep explicit, distinct contracts around one physical kernel. Neither the sink's presence nor journal construction may choose validation. A per-game `ResolutionEffects` sink records actual mutations; final-state diffing and app-facing product events cannot substitute for it.

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
Do not impose a general equality rule between those IDs. The private producer's stationary CC-shot fallback below requires evaluated/applied actor identity without imposing target equality. The codec's separate serialized exception below has stricter consistency conditions; it does not redefine private producer proof.
Bind the actual applied target to its live pre-destruction entity and successful native operation.
Attach the consumed target observation to that causal casualty before publishing the completed journal.
The recipient reducer applies the target assertion before casualty clearing and later visibility deltas.
Never reintroduce a dead target after a mine death or hidden replacement.

### Stationary CC-shot consumption

A valid path-discovered CC shot can apply with `stopAt === pathRevealFrom`: the `C-path` group damages the target without relocating its actor. Requiring a `unit-moved` effect rejected that valid operation even though unobserved physics succeeded. Removing the movement guard without another application proof would instead admit forged target consumption. Stationary here describes the shot group, not the whole turn; a later physical movement group can still relocate the actor.

`CausalJournal.move(actor, from, from, actionSeq)` records the actual zero-displacement call in a private map attached to its mutation group. The record binds the actual actor ID, origin and action sequence. It emits no synthetic `unit-moved` event and changes neither physical state nor the `v1` journal/state wire. Any real movement by that actor within the group permanently invalidates its stationary proof, even if the actor returns to its origin or a supplied span omits movement effects.

The stationary fallback accepts only `cc-shot`. It requires the same evaluated actor ID, a still-live actor at the evaluated origin with the applied operand's type and side, the matching group-bound zero-displacement call and action sequence, and an actual matching `cc-damaged` effect from that `C-path` span. The actual target must still match its live CC identity, square, side and type. Existing deferred-discovery, action-sequence and single-consumption guards remain mandatory. This narrow actor-identity requirement does not impose evaluation/applied target equality on ordinary captures. Captures still require actual movement from the query origin to its target.

The source regressions exercise stationary-shot physical/journal parity without invented movement, unbound damage, repeated consumption, wrong actor origins, replacement actors, mismatched action sequences, displaced targets, hidden same-group movement and captures supported only by a zero-displacement call. `packages/starchess-core/src/__tests__/engine-consolidation.test.ts` also checks readonly, unsequenced siege-helper inputs; the helpers only read intent fields, so that type correction changes no algorithm. These regressions passed within the recorded post-codec scoped Bun run. Earlier passes remain separate historical evidence. Source23 math, selection rules, frozen records and training authority remain unchanged.

### Stationary CC-shot wire validation

The producer correction exposed a separate codec boundary: a generated stationary CC-shot journal contains actual `C-path` damage but no movement effect in that group. Requiring movement for every applied discovery rejects that valid wire representation. Serializing the producer's private proof map or inventing a movement event would instead change the contract. `packages/contracts/src/causal-journal.ts` therefore retains the `v1` wire and JSON Schema shape while narrowly refining serialized consistency through `stationaryCCShot`.

The no-movement exception requires all of these conditions:

- The applied operation is `cc-shot`, the query is deferred at `scan-ray`, `returnedStep` is 1, and its entire trace is one visible step at the target. The target must also be the first intermediate square from `rayBetween(query.from, query.to)`. Step 1 alone is insufficient: a CC on a3 can become visible at the first discovery step while still requiring actual approach movement. The a6 case also retains its movement requirement.
- Applied/evaluated actor IDs match each other, and applied/evaluated target IDs match each other. Exactly one applied discovery may use that action sequence. These are conditions of this serialized exception, not general identity-equality rules for captures or the private producer.
- The applied group contains exactly one non-visibility effect: `cc-damaged` in `C-path`, with the matching action sequence, opposing target side and exactly one bound target assertion for this discovery. Existing target bindings still match the group, recipient, square, piece and operand IDs. Unexpected same-group movement or other extra effects do not qualify.
- Reconstruct the recipient's pre-group cells from initial cells and preceding visibility deltas. The origin must hold a lit friendly slider (`r`, `b` or `q`), and the target must hold a lit CC of the damaged side. Preceding actor creation, movement and destruction history must remain coherent with that actor at the query origin. Duplicate traces or assertions remain invalid.

Ordinary captures and nonstationary CC shots still require their actual same-group movement. The codec still rejects synthetic zero-displacement movement events. It checks only the consistency of serialized claims: it cannot inspect the private producer's group-bound proof or establish that the kernel actually performed the operation. Source-bound replay remains the authority; parsing does not replace it or authorize recipient facts independently.

`packages/contracts/tests/causal-journal.test.ts` requires an actual generated stationary-shot journal to encode without rewriting its bytes and to round-trip journal/state decoding. Both recipient projections must retain the correct target visibility assertion, own movement/lineage, CC lives and mineral values without leaking private engine IDs or discovery fields. Negative variants retain movement requirements for captures and nonstationary a3/a6 CC shots, and reject mismatched actor/target IDs, group/sequence/phase, target/ray squares, prior cells or actor origin, conflicting movement, malformed traces and duplicate targets/discoveries.

The historical post-codec scoped Bun regression run passed all 13 gates; [architecture.md](architecture.md#current-consolidation-verification--scoped-bun-pass) records its receipt and source scope. That run predates the layout change and cannot substitute for pending layout checks. No physics, fake event, `v1` wire, frozen math or training-authority change follows. Native/runtime/training qualifications remain separate. Native PlantUML rendering is skipped under Bun/Rust-only scope; full-theme rendering remains unverified.

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

## Source ownership and historical evidence

The implementation places the private `CausalJournal` collector in `packages/starchess-core/src/engine/causal-events.ts`.
`packages/starchess-core/src/resolve/resolve-turn.ts` and `submit-turn.ts` emit effects at actual mutation sites through constructor-free sink types.
`packages/starchess-core/src/engine/causal-producer.ts` exposes host-only begin/end wrappers with starting/final snapshot checks.
`packages/contracts/src/causal-journal.ts` implements the bounded standard JSON/Zod state/journal codec and exports JSON Schema.
Model-facing roots do not reexport collector constructors or host producer/codec/session entrypoints.

The earlier persisted sink-parity suite checked all 11,045 canonical begin/admission/settlement outcomes with and without the sink.
Historical collector tests checked identity, mine multiplicity, common causal preimages, promotion, snapshot drift, failure closure and separate evaluation/applied operands.
Historical contract tests rejected malformed ordering, targets, traces, counters, side/mode substitutions and byte exhaustion.
[recipient-production.md](recipient-production.md) records the implemented continuing recipient, bank-owner and replay slice.
Those bounded static fixtures are not fresh verification of consolidation, an independently qualified F9 runtime or a training-ready claim. Fresh checks must retain grouping preimages, deployment/no-birth dispositions, mine order, deferred discovery consumption and `v1` identities while covering both approved corrections.
