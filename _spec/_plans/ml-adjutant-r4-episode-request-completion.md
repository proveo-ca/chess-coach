<!-- Acceptance, persistence and execution metadata: outside the exact accepted request-completion body. -->
**CURRENT DISPOSITION: EXACT REQUEST COMPLETION ACCEPTED; NORMATIVE PERSISTENCE, PERSISTED REVIEWS AND RESULTING FULL R4 SOURCE BUILD AUTHORIZED.** Executor actually selected **`Accept both (Recommended)`** for this request text and [B1](ml-adjutant-r4-accounting-bootstrap-clarification.md), then separately selected **`Persist and build (Recommended)`**. The first choice accepts the exact two latest TEMP texts. The second grants verbatim normative persistence, persisted reviews and the resulting full R4 source build. Prior drafting selections granted no exact acceptance; the earlier source grant did not waive it. These actual choices now supply it without another schema-preference prompt.

This completion supplies the concrete closed fields omitted from original contracts §12 for the amended episode-v2 profile. It does not claim that these field names were historically frozen. The accepted nine-key request retains the closed corpus variant and live variant `{suite:'live-strategic',candidateSide:Side}` without a seed selector. Native settlement stays deterministic, policy/opponent streams stay persistent, environment stays unused and live-seat determination consumes no selection draw. Configuration26, Versions21, the seven IPC kinds, private economic wrapper,54-case evaluation gate, permit boundaries and all other frozen contracts/D1 remain unchanged.

Lead reports all three prospective reviewers—spec, adversarial and security—explicitly READY for both latest exact texts. B1's prior HIGH on the missing exact source-authority chain is resolved in its latest §6; its classification is O3-compatible, not an O9 amendment. These are prospective text verdicts, not persisted-revision reviews, source verification or independent identity measurements. Persisted reviews and lead preservation checks are authorized and PENDING here.

Accepted TEMP identity, **supplied by lead, not measured by spec-keeper**: `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/r4-episode-request-completion-proposal.md`, **8959 bytes**, SHA-256 **`78f7032e39afece3497208b9d774f8192894cbe29ddcfdc2218209de994c7049`**. The complete TEMP text, including its original title, proposal/conditional wording and final newline, is copied between the unique markers below. Extract immediately after the opening marker's LF through immediately before the closing marker; retain the body's final LF. No trimming, rewriting or newline normalization is intended. Keeper read the whole TEMP and performs manual readback only; lead owns actual extraction, byte-count/hash comparison and preservation verification.

The body remains an exact accepted reading snapshot. Its embedded “proposal only” title and then-pending acceptance/persistence/build language remain unchanged; this outside-body record governs current lifecycle authority. Existing protected bodies, original roadmap/D1 suffixes, archives, evidence and recovery remain untouched. This persistence creates no runtime authority record and adds no O9 constituent or EconomicAuthority field/version; it repoints no ownedIngressRef. [D1](ml-adjutant-r4-owned-ingress-addendum.md), [B1](ml-adjutant-r4-accounting-bootstrap-clarification.md), the [ledger](ml-adjutant-r4-implementation.md) and [roadmap](PLAN-ml-adjutant.md) retain their distinct scopes.

Full R4 source completion remains **IN PROGRESS**. Prior private217/scoped READY and lead-reported types/contracts11 and registeredBytes57 PASS remain separate scoped checkpoints, not new full R4, read-only loading, runtime, whole-cap or calibrated-estimator proof. Weights NONE/not training-ready. No collection/fitting/calibration/transfer/training run, publication, deployment, registry activation or global R5 grant follows. Spec-keeper edits only the authorized spec documents and runs no commands/tests/hashes/nested agents/TUI.

<!-- BEGIN R4 EPISODE REQUEST COMPLETION ACCEPTED BODY -->
# Private EpisodeRequestV2 schema completion — proposal only

## 1. Scope and authority

Original contracts §12 identifies the logical request bindings but omits their concrete closed record. This completion supplies those field names, nested productions and validation joins for the amended episode-v2 profile. It does not claim that these names were historically frozen.

EpisodeRequestV2 and OriginalEpisodeRequestV2 alias the same closed record below. No generic or extensible request remains. Configuration26, Versions21, feature definitions, horizon, curriculum, RNG ownership, deadlines, work cap, eligibility and checkpoint rules, public API and operator authority stay unchanged.

## 2. Primitives

`I[a,b]` is an inclusive safe integer; `Master=101|102|103|104|105`; `Side='w'|'b'`; `uint32=I[0,4294967295]`.

`Ref={byteLength:I[0,MAX_SAFE_INTEGER],sha256:64 lowercase hexadecimal characters}` retains the frozen ByteRef schema.

`H={hex:16 lowercase hexadecimal characters}` retains finite big-endian binary64 Float64Hex, including signed zero. Reject NaN/Infinity encodings.

`AttemptId` matches ASCII `[A-Za-z0-9_-]{1,64}`. Reject colons, slashes, whitespace and non-ASCII. The parent reserves each ID once in its trusted attempt ledger, unique across all five masters in the experiment. Aborts retain consumed IDs. An ID is not a secret, permit, context selector or credential.

## 3. Exact request

OriginalEpisodeRequestV2 has exactly nine keys:

```text
{
  version:'starchess-training-episode-v2',
  attemptId:AttemptId,
  master:Master,
  startedOrdinal:I[0,999],
  weightsRef:Ref,
  manifestRef:Ref,
  baseline:H,
  schedule:ScheduleDescriptor,
  streams:EpisodeStartStreams
}
```

startedOrdinal is the zero-based STARTED slot `a` in original §14. The consumed started counter is `a+1`, in 1..1000. It is not checkpoint actualEpoch or a one-based ordinal. The parent checks master, ordinal and ID against its durable STARTED descriptor and serial-master state. Range validity alone grants no scheduling authority. Consume the STARTED/curriculum cursor durably before launch under original §13; failure rolls back neither ID nor cursor.

## 4. Separate weight and manifest references

weightsRef identifies parent-registered frozen episode coefficient bytes: a canonical JSON array of exactly418 H records in the independently expected manifest order. It has no version/dimension/manifest/provenance/self-hash field. Physical length is exactly11287 bytes: `418*26+417+2`.

The parent selects weightsRef from its authoritative episode-start coefficients for that master. Verify physical length and SHA256 over the same stable registered bytes decoded. Decode418 finite coefficients without padding/truncation; preserve their bits throughout the episode. Slot0 satisfies existing zero initialization; later slots use only that master's committed coefficients. Neither a checkpoint nor a final policy artifact substitutes for this payload.

manifestRef identifies the canonical registered challenge-feature-manifest-v3 record with dimension418 and the exact approved names/entries/meanings/scales. Compare it with independent expectations, training recipe/provenance joins and the economic pin's featureManifestRef. Self-consistent worker references do not establish expectations. The trusted attempt binding pairs weightsRef and manifestRef; coefficient j belongs to expected manifest name j.

## 5. Frozen baseline

baseline decodes to a finite value in `[-1,1]`. Its bits equal H encoding of the parent's episode-start value `baselineCount=0 ? 0 : baselineSum/baselineCount`. Use only previously eligible completed returns for this master, excluding current return and other masters. The sum/count stay parent-owned, not request fields. Freeze before sampling; preserve zero-sample exclusion and completion/update ordering.

## 6. ScheduleDescriptor

Exactly one recursively closed variant:

```text
{suite:'corpus',candidateSide:'b',caseIndex:I[0,17]}
{suite:'live-strategic',candidateSide:Side}
```

Reject cross-variant keys, arenaSeedSlot, arenaSeed, inferenceSeed and every undeclared key. caseIndex addresses audited manifest cases in manifest order. Supply no roster/path/URL/trace/historical result/opening/future queue/opponent revision. Both variants use independently pinned canonical opening, bank3:3, empty queues, fresh history/ledger/strategic memory and existing deterministic native settlement.

For `a=startedOrdinal`, even a requires corpus: occurrence `k=a/2`, epoch `floor(k/18)`, permutation position `k%18`, caseIndex equals the parent-owned permutation at that position. Reconstruct permutations with frozen manifest-order descending Fisher–Yates and persistent selection stream. Consume position on STARTED, not success.

Odd a requires live-strategic: occurrence `l=floor(a/2)`, candidateSide is w for even l, b for odd l. Corpus White uses only independently checked recorded trace. Live opponent is pinned strategic with fresh memory, feed off, movetimeMs0 and only the checked persistent opponent RNG callback. Policy sampling uses only the checked persistent policy-sampling stream. Reset neither stream per episode; substitute neither runner seeds nor default RNG.

Environment-settlement stays unused with state=root/drawCount0. Selection advances only for existing corpus shuffles; live-seat determination consumes no selection draw. There is no training arena-seed selector/slot, extra RNG root/draw or replacement request field. The evaluation gate stays unchanged: corpus arena0, inference0 and live arena0..17 both seats. Removing the unnecessary prospective seed-slot field changes no frozen training/evaluation selection law.

## 7. EpisodeStartStreams

Exactly four keys:

```text
{
  selection:ActiveStreamState,
  'environment-settlement':UnusedEnvironmentState,
  'policy-sampling':ActiveStreamState,
  opponent:ActiveStreamState
}
ActiveStreamState={status:'active',root:uint32,state:uint32,drawCount:I[0,MAX_SAFE_INTEGER]}
UnusedEnvironmentState={status:'unused',root:uint32,state:uint32,drawCount:0}
```

Unused environment state equals root. Selection/policy/opponent remain active even with drawCount0. No generator entry exists in this four-stream request; the unused generator state elsewhere stays unchanged.

Each root equals independently checked §11 derivation for master/exact label; preserve20-root collision rejection. No measured roots are supplied here. selection equals the parent's post-STARTED-consumption state, including needed shuffles. With `c=ceil((a+1)/2)` and `e=floor((c-1)/18)`, require selection.drawCount=`17*(e+1)` and exact root/state/count equality with reconstructed shuffle history.

Policy/opponent root/state/count equal authoritative committed start states; do not reset per episode. Child advances neither selection nor environment; completion summaries equal their start states. Corpus makes no opponent draws while status stays active. Policy/opponent changes remain tentative until existing parent verification/ACK. Request validity grants no draws before genuine planning permission.

## 8. Transport, rejection and runtime boundary

Retain the separate wrapper exactly:

```text
{version:'starchess-training-economic-request-v2',originalRequest:OriginalEpisodeRequestV2,economicPinRef:Ref}
```

economicPinRef appears only in this wrapper. Add no economic key to request/messages. Trusted private startup transport pairs the wrapper with the original protocol; it is not an eighth message kind, new permit field or report authority.

Retain the seven original kinds/payloads with already-approved episode-v2/418 substitutions: ready, turn-open-result, turn-open-accepted, decision-result, decision-accepted, settlement, complete.

All records are recursively closed. Apply existing canonical physical bytes and bounded ingress. Reject duplicate/missing/unknown fields, wrong variants, malformed UTF8/noncanonical bytes, invalid primitives/roles, unresolved/substituted references and failed independent joins. No unrestricted graph validation: admit local required-role objects or bounded registered bytes under D1. Parsing/self-consistency creates no host/model/session/permit authority.

Schema/reference/schedule/stream/session failures keep infrastructure classification. Create no reward/accepted successor/learning update/retry/replacement attempt.

Accepted request permits only existing supervised startup validation and native initialization. It grants no planning Meter or history preparation/candidate/feature/scoring/sampling/opponent work. Those require accepted nonnull genuine PlanPermit. Preserve startup10s/plan10s/match300s, resource/frame/message limits and one cap1048576.

Proposal grants drafting/review only. Exact-text acceptance, separate normative persistence and applicable implementation authority remain required. No collection/fitting/calibration/training/publication/deployment/activation/globalR5 grant follows.
<!-- END R4 EPISODE REQUEST COMPLETION ACCEPTED BODY -->
