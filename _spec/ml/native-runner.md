# Native Rust composition and full-match runner — implementation contract

**2026-10-17 · BOUNDED NATIVE BASELINE COMPLETE / WHOLE GATE 3 PASS / ALL THREE CLOSING REVIEWS READY.**
This contract guides the active Rust composition, native full-match, schedule, replay and evaluation delivery; source presence is not a passing whole gate or a readiness verdict.
Architect and backend design consultations are complete per the lead; they are not reviews. Do not invoke reviewers until every required fresh gate below passes on unchanged source.

## 1. Checkpoint, authority and ownership

- Lead-supplied prior checkpoint: published commit `238700831819680bae750e5c3233beb40afd1133`, source identity `bf42b7c3020d5f55b87fd14a35b24ec502ae83cb7a4f92882bfc9ab9ad58d7f6`, 24 commands PASS, 76 Rust / 27 Node / 668 core tests, three bounded closing reviews READY. These are historical compatibility results, not new-runner proof or this author's verification.
- Preserve [runtime research](rebuild-runtime-research.md), the [compatibility milestone](../_plans/burn-flex-compat.md), all frozen roadmaps, accepted contracts, evidence and pins. No new Git, publication, deployment, activation, real training, calibration, profiling, data collection or dataset-rewrite authority follows.
- Leave legacy `packages/starchess-core`, `packages/starchess-arena`, `packages/starchess-training`, server and web consumers unchanged. Delete legacy code only after FINAL consumer parity and a separately authorized rollback boundary, never in this delivery.
- Rust owns model-facing contracts in `packages/training/src/contracts.rs`, composition in `candidates.rs`, selectors in `policy.rs`, and arena orchestration/records/schedules/replay/evaluation in `apps/arena/src/`. Reuse native rules; do not copy them into Rust.
- Node owns the fixed native adapter, private engine/session/bank, observation projection and pure planning helpers. Production imports no old arena/training implementation; test-only differential checks may call the legacy public V3 candidate export.
- Keep the six-owner [ML graph](projects.yaml) unchanged. The existing [training](../packages/training/burn-compat.puml) and [arena](../apps/arena/burn-compat.puml) diagrams own the new boundaries; their v1 compatibility behavior remains valid, not OUTDATED.
- The two owning diagrams separate retained v1 compatibility from native baseline source contracts. Their lifecycle-neutral labels point here for current receipts; the gate hashes both diagrams and the index. No historical/frozen body or unrelated index entry changes.
- The lead reconciled late CLI, runner/replay/schedule and candidate/policy/native-support files after implementation handoff. Coverage includes the pointer-bearing test-only `legacy.mjs` oracle and the seeded CLI fixture; the verifier checks MJS pointers and renders both diagrams into private receipt subdirectories.

## 2. Rust contracts, identity and fog boundary

- Use the frozen seven-kind Rust `Action` grammar mirrored in `engine/wire-v2.ts`: classical `C` with destination; specials `B|F`; deploy units `p,n,b,r,q`; optional classical/stim promotions `n,b,r,q`; no destination on mine/siege actions. Validate schema/color separately from native legality; generated queues contain at most four actions.
- Canonical keys are compact canonical JSON of the entire ordered action array: sort object keys, preserve array order, omit absent optional fields and compare UTF-8 bytes. Pass is `[]`; deduplicate by complete bytes, never a digest alone, and sort the final retained array by those bytes.
- Keep envelope fields `version,key,actions,ownSpend`, with native versions `arena-candidate-v1` and `arena-composition-v1`, not legacy version aliases. Validate complete canonical keys and zero pass spend in DTOs; compose spend from native proposal costs and compare it during replay. Preserve V3 B diagnostic semantics without production legacy imports.
- Use closed data-only `AuthorizedView` (`arena-observation-v2`), never a private Session object or a case/fixture/seed identity. It contains side, native turn, exactly 64 canonical cells and own pieces/minerals/gas/gasIncome/ccLives/mines/sieged tanks; exclude opponent resources, hidden pieces, snapshots and raw native results.
- Cells remain file-major `a1..a8,b1..b8,...,h1..h8`. Build planning knowledge only from lit/revealed cells and own facts; an unknown cell has no `piece` field. Validate own facts against the visible representation without consulting private state during generation.
- Own mines are a sorted multiset, including duplicate-square entities. Count entities with array length, not Set cardinality; derive occupancy separately and use native `MAX_MINES_PER_SIDE = 3` in the new native view. Keep the existing v1 smoke observation's two-mine limit unchanged, separately from its two permitted white moves.
- Decode declared unit enums only from JSON strings. Decode seat pairs, host schema objects and tagged RPC objects only from closed JSON objects; reject positional arrays, unit-map aliases, missing required fields, duplicates and unknown fields without changing canonical serialization or required nullable fields.

## 3. Exact profile-B composition

- Preserve `maxActions=4`, `maxAttemptedExtensions=2048`, `maxRetainedIncludingPass=512`; reserve one slot for pass. Initial funding is seven family lanes × 48 plus shared-composition 175, with inactive-family capacity redistributed exactly as the legacy algorithm specifies.
- Availability probes enumerate only the queried family and stop at its first append-valid primitive or exhaustion. They determine active families without increasing attempted-extension counts; retain their separate pull counters.
- Every family lane and the shared lane then enumerate the COMPLETE primitive domain at every root/continuation; do not prefilter a lane to its owner. Only availability probes use a family filter.
- Preserve lane order `classical, deploy, stimStep, spiderMine, charonMissiles, siegeMode, tacticalJump, shared-composition`, round-robin lane visits, four depth-frontier queues, FIFO cursors and the per-lane rotating depth cursor.
- For each consumed primitive, increment one attempt and apply append pruning. For every append-valid child of length <4, enqueue its continuation BEFORE owner, duplicate or quota skips, so skipped children can still produce retained descendants.
- The semantic owner is the first action kind; a family lane retains only its owner and shared retains only length ≥2. Apply skips in order owner → duplicate → quota, then retain and account for the funding lane separately from semantic owner.
- Redistribute inactive capacity in ordered rounds among active families, or to shared if none are active. Proven family exhaustion releases unused funding to shared; once shared is exhausted, redistribute its spare capacity in ordered rounds among non-exhausted families, including later releases.
- Preserve all pool records, active/exhausted ordering, retained-by-owner/length, pruning categories and runtime counters (`roots`, `continuationNodes`, `peakLiveNodes`, `domainCursors`, `cursorPulls`, `availabilityPulls`, `appendAttempts`, `maximumQueueLength`). Exhaustion must be observed, not guessed from a filled quota.
- Enforce `attemptedExtensions = retainedNonPass + duplicates + ownerSkipped + quotaSkipped + sum(pruned)` and `uniqueIncludingPass = retainedNonPass + 1`. Preserve stop precedence `capacity-cap` → `attempt-cap` → `exhausted`, including simultaneous caps; close every surviving cursor.
- Require positive native fixtures and test-only legacy-public V3 differential parity for keys, actions, spend, diagnostics, counters and ordering. A profile-B divergence is a stop condition: ask Executor to choose repair, a separately named/versioned profile, or deferral; never silently waive parity.

## 4. Pure native planning adapter and bounded cursors

- `apps/arena/engine/planning.ts` imports only `@chess-coach/starchess-core/planning-v1` plus local `wire-v2.ts` DTO/wire helpers. It must not import private sessions, actual admission, old arena/training modules or a hidden board; wire helpers must not create a transitive private-state path.
- Native primitive ordering is kind order above, then file-major sources, native timings (`C` for classical, `B` then `F` for specials), file-major destinations where applicable, deploy units `p,n,b,r,q` and generated promotions `n,b,r,q`.
- Reuse native actor/shape/coordinate-rewrite/deploy-anchor/special-target helpers, including B/C/F interactions and promotions. The conceptual native row is frozen as `PrimitiveProposal:{action,nativeFailure,anchor,cost}`; nullable failure/anchor fields remain explicit. Node does not own Rust's search or retention decisions.
- Compute one-action cost from native `UNIT_COST` and `specialGasCost`; `requestedSpend` is NOT a core export. Rust accumulates returned costs and maintains prefix actions, append anchors, mine reservations, queues, quotas, deduplication and counters.
- Preserve append-failure priority: native actor/shape/timing → cumulative resources → counted mine cap → reserved/current own-mine occupancy → remaining native failure. Count duplicate own mines toward cap while checking both current and prefix-reserved occupancy at the append-time anchor.
- Wire operations `plan.open:{view}`, `plan.next:{planning,pulls}`, `plan.close:{planning}` return `planning-opened`, `planned`, `planning-closed` result kinds. Pulls are `start:{prefix,family}` (explicit nullable family) or `resume:{cursor}`; ordered `DomainStep:{cursor,proposal}` uses `proposal:null` for exhaustion. Bind cursors to the authorized view/prefix/mode, not a private session.
- Allow at most eight requested pulls per RPC, at most two live planning contexts, and at most 2063 cursors created per view: seven availability + eight roots + 2048 continuations. Delete exhausted cursors and close all remaining cursors on completion/error; reject stale, foreign or over-limit handles.
- Do not prefetch unrequested primitives or inflate logical counts through RPC batching. Count only consumed primitives as attempts; count exhaustion pulls and availability pulls under their original distinct runtime semantics. No native actual-state probe, queued-action trial or fallback candidate generation is permitted.

## 5. Persistent engine v2 and simultaneous settlement

- Add fixed `apps/arena/engine/worker-v2.ts` with exact protocol `arena-engine-v2`; leave v1 `worker.ts`, its protocol, smoke behavior and two white tiny moves untouched. Use one persistent fixed Node/tsx worker per match, never caller-selected modules, paths, executables, shell, eval or installation.
- `engine/wire-v2.ts` fixes request `{protocol,id,op,...operationFields}` and reply `{protocol,id,ok:true,result}` or `{protocol,id,ok:false,error:{code,message,context,witness}}`. Use fatal-UTF-8 NDJSON, request ≤64 KiB/reply ≤1 MiB/cumulative stderr ≤64 KiB, increasing u32 IDs and one outstanding operation; correlate protocol/id and expected result kind, not a nonexistent reply `op` field.
- Fix child cwd to `apps/arena` and entrypoint at the known worker-v2 path; clear inherited execution-affecting environment including `NODE_OPTIONS`. Support Linux/Unix trusted built-in workers/descendants only; this is not a hostile-code sandbox or a portability claim.
- Enforce one absolute 300-second per-match deadline including a three-second cleanup reserve, plus one absolute ten-second decision deadline covering composition and all its RPCs without renewal. Preserve compatibility's 30=27+3-second bound and verifier's 600=597+3-second bound; terminate/reap owned processes with separately recorded cleanup status.
- `session.start:{fixture}` returns `started:{session,fixture,initial,outcome}`; retain its initial image as host-only record data, never model input. `session.open:{session,planningOrdinal}`, `session.commit:{context,requests}`, `session.close:{session}` use the frozen wire variants. Check initial native outcome before planning; callers cannot supply snapshots/banks.
- `session.open({session,planningOrdinal})` performs the required native begin once and returns both seat views from the SAME post-begin state plus `context:{session,planningOrdinal,turn}`, or an actual terminal reply. Reject stale/repeated/out-of-sequence contexts and bind subsequent commit to that context.
- Nonterminal open exposes only context and limited views. Defer per-window raw begin/settlement truth until BOTH selections; terminal replies or closing abandoned/limited planning may release pending begin truth to the host record after decisions stop. No full-truth image ever enters model views or a later selector.
- Select both Rust plans before private admission. On commit, stage each side in isolation against copies of the same opening, verify bank/gas and native sequence invariants, then merge in stable white/black order; expose no partial live mutation if either side fails.
- Resolve through native `endScTurn(...,{skipTurnStartChecks:true})`. Apply native `applyStoredIncome` ONCE at settlement, never at begin, including terminal begins that advance native turn; retain/reapply the separately held bank when native results omit `stored`.
- Check actual native outcomes at start, after begin and after resolve, before a host window-limit decision. A terminal begin produces no invented income or settlement. Native queue rejection ends the run; never rescue it with pass, a substitute engine or automatic mutation retry.
- On transport/engine failure, preserve the independently verified prefix and an explicit unverified pending operation (including unknown commit status). Keep unconfirmed prefix data unverified until replay; never fabricate a final state, outcome or draw, and never retry an uncertain mutation.

## 6. Baseline selectors and seed contract

- `pass-v1` returns the empty action array without opening a composition context; record `generation:null`. `first-v1` selects the lowest complete canonical key INCLUDING pass; it is not a strength claim or a rename of legacy `naive`/`strategic`.
- `seeded-v1` selects from the complete canonical retained array INCLUDING pass using explicit u32 xorshift32: `x ^= x << 13; x ^= x >> 17; x ^= x << 5`, masking to u32 with logical right shift, then `index = x % candidateCount`. Zero remains zero; claim no uniformity or statistical quality.
- Preserve agreed `arena-policy-seeds-v1` from `apps/arena/src/record.rs`: `decisionSeed = (policySeeds[seat] + (planningOrdinal+1)*0x9e3779b9 + (seat==b ? 0x85ebca6b : 0)) mod 2^32`, with zero-based ordinal. Record bases/version/derived seeds; restart xorshift for each decision. This replaces the prior document-only XOR proposal; do NOT rewrite the agreed source or training RNG.
- Required xorshift golden controls include seed 0 → 0 and seed 1 → `270369,67634689,2647435461` across three successive draws; these are required expectations, not executed results. Test seat/ordinal separation, repeatability, canonical indexing and seed tampering.
- Retain the direct Burn synthetic library and smoke path, but the new full runner uses these baseline selectors without claiming a learned scorer, an R4 feature encoder or necessary score vectors. Reports remain `assurance:NON_ADMITTED`, `learned:false`, `modelArtifact:null`; `fullRunner:true` means multi-window capable, not trained.

## 7. Native fixtures, schedules and CLI surface

- Native-validate explicit fixture IDs `tiny-v1`, `standard-v1`, `all-actors-v1`. Add bounded test fixtures for terminal chips, promotions and duplicate mines; these are new controls, not rewriting a dataset, the pinned 54-case corpus or existing compatibility fixtures.
- Frozen `MatchSpec` (`arena-match-v1`) fields are `version,caseId,fixture,players:{w,b},environmentSeed,policySeeds:{w,b},maxWindows`; `caseId` is 1..128 UTF-8 bytes. Frozen `SuiteSpec` (`arena-schedule-v1`) fields are `version,fixtures,pairings,repeats,environmentSeed,policySeed,maxWindows`; there is NO seed-list or run/suite-config-v1 interface.
- `schedule.rs` expands repeat → fixture-list order → pairing-list order. Validate repeats 1..16, windows 1..45, nonempty fixture/pairing lists each ≤64 and their checked product ≤64 BEFORE case allocation/worker creation. For zero-based case index `i`, use `caseId="case-"+i`, `environmentSeed=base+i`, policy bases `w=policySeed+2*i,b=policySeed+2*i+1`, all modulo 2^32.
- Match/suite environment and policy bases are explicit u32 inputs, not training RNG settings. The fixed fixtures do NOT use environment seed; always record `environmentSeedUsed:false`. Keep case/fixture IDs, configuration and seed-version metadata host-only, outside model views.
- Retain `arena smoke`; native CLI surfaces are `arena run --config <file>`, `arena suite --config <file> --out <fresh-dir>`, `arena replay --record <file>`. Reports use `arena-run-v1`, `arena-suite-v1`, `arena-replay-v1`, `arena-evaluation-v1`, distinct from compatibility; configs use the frozen MatchSpec/SuiteSpec versions above.
- Bound config reads to 64 KiB and record reads/serialization to 16 MiB. Create private fresh outputs with exclusive `create_new` semantics outside protected legacy source roots, including `scripts`, and specification/evidence/dataset roots; resolve parent aliases before checking. Never overwrite, publish or interpret paths as executable input. Preserve every scheduled match error rather than dropping it from results.

## 8. Records, independent replay and evaluation

- Rust owns each run record: version/scope, exact fixture and config, schedule position, environment/policy/decision seeds and selector versions, both views/context, selected queues/keys/generation diagnostics and the complete ordered native operation/frame sequence.
- Retain initial/open/committed/settled SCFEN, explicit bank transitions, all raw begin/resolve payloads, grants, requested actions, actual final native outcome and explicit stop reason. Full native JSON is host reporting/replay data only; never feed it back into policy inputs.
- Enforce ≤45 selected planning windows, ≤4 actions per seat per window and ≤128 native frames, plus the total byte cap. Record terminal-begin and empty-pass frames rather than omitting them; host window exhaustion of a nonterminal state is `window-limit`, NOT a native draw.
- `apps/arena/engine/replay.ts` independently reconstructs a fixture, projects views and stages/reduces through public native APIs behind `replay.start/open/commit/close`. It must NOT call/import live `session.ts`, Rust `run_match`, or `commitWindow`, or treat the live transcript as an expected-state oracle; Rust may reuse the deterministic selector while independently checking its recorded inputs/results.
- Replay compares every action, native frame order, SCFEN, bank, raw begin/resolve payload, grant, outcome and stop classification, including terminal/omitted frames. Rust regenerates decisions from independently reconstructed views and recorded seeds, comparing views, keys, actions, spend and generation diagnostics. Runtime counters remain composer/parity controls, not an invented RunRecord field.
- Only Rust replay may construct private-field `VerifiedRun` after native AND policy verification. Evaluation counts terminal W/D/L only from verified terminals, keeps verified window limits separate, and accepts explicit failed-case metadata without treating unchecked records as verified. Independently verified native rejections still count in `failedUnverified` (with a separate rejection counter), not W/D/L.
- Enforce `scheduled = verified-terminal + verified-window-limited + failed/unverified`. A failed match with a verified prefix remains failed/unverified as a whole; no fabricated draws, fallback outcomes, headline learned win rate or reuse of old 54-case evidence.

## 9. Implementation sequence and fresh gate lock

1. Add typed Rust contracts/codec and pure native planning with exact B composition; prove positive differential parity before relying on its candidates. Preserve v1 controls throughout.
2. Add persistent v2 transport/session lifecycle, two-seat selectors, atomic settlement and bounded full-match driver; then add schedule/config/output contracts.
3. Add independent native plus Rust policy replay, private `VerifiedRun` and conserved evaluation; integrate root verification, then extend the two owning diagrams/coverage without rewriting old contracts.
4. Run ALL lint/types, Rust fmt/check/Clippy, unfiltered unit/integration tests, affected core regressions, dependency/legacy/evidence preservation, diagrams and matching before/after source identity. Any failure keeps every reviewer forbidden; any subsequent source change requires a fresh complete matching-source gate.

| Required controls; G3 suites PASS, closing rereviews READY | Required scope |
|---|---|
| Grammar/native planning | All seven kinds, both colors, B/C/F interactions, promotions, mine entity counts 0..3 and duplicate-square occupancy; fog invariance and absence of private-generation imports. |
| Composition | Exact B funding/redistribution, full-domain family lanes, continuation-before-skip, byte-identity collision safety, canonical order, accounting, exhaustion and simultaneous-cap stop precedence; positive public V3 differential controls. |
| Sessions/economy | Both views/selections before admission, stale contexts, isolated/atomic bank+sequence, exactly-once grants, terminal begin without income, turn-45 boundaries and live 45-window pass/pass with actual native outcome or explicit nonterminal limit. |
| Real worker/failure | Seeded multi-window plans through worker-v2, prefix failure with no rescue/retry, eight-pull batching and cursor cleanup/caps; no latency, wall-clock fit or benchmark claim before measured tests. |
| Replay/evaluation | Tamper actions, bank, SCFEN, raw resolve/begin, keys, seeds, diagnostics, stop/outcome and omitted frames; independent reconstruction, private verification capability, schedule bounds/order and denominator conservation. |
| Transport/process | Partial frames, EOF, invalid UTF-8, byte caps, extra replies, wrong/repeated IDs, fixed entrypoint/cwd/environment, absolute decision/match deadlines, owned-process cleanup and explicit pending mutation state. |
| Preservation/full gates | Retain every existing v1 assertion from the historical 76 Rust / 27 Node / 668 core controls; rerun complete affected suites and static checks with new controls, preservation and both diagrams on one unchanged source. Never recycle historical counts as new passes. |

**Bounded checkpoint: COMPLETE. G2 passed before review; adversarial review then returned READY TO MERGE: no. N1–N3 have reproduced RED controls and GREEN repairs. The complete unchanged-source G3 gate passed all 29 commands; all three closing rereviews returned READY only after that pass. Economy/belief/features, payout calibration, trained models and R4 readiness remain pending.**

## 10. Authored note register — readability only, not source verification

Apply FK `0.39*(words/sentences)+11.8*(syllables/words)-15.59` to unmarked prose; split hyphenated words for counting. Syllable counts use explicit pronunciation estimates; all rewritten/new reasoning notes have two sentences, five lines at most and at most 45 text columns. Unchanged compatibility notes retain only their earlier receipt-scoped estimates in the historical milestone, not new verification.

| Diagram / note anchor | Words / sentences / syllables | FK |
|---|---|---|
| training/burn-compat.puml · bottom of LIB | 31 / 2 / 53 | 10.6 |
| training/burn-compat.puml · bottom of CONTRACTS | 29 / 2 / 55 | 12.4 |
| training/burn-compat.puml · bottom of COMPOSER | 32 / 2 / 55 | 10.9 |
| training/burn-compat.puml · bottom of PLANNER | 29 / 2 / 50 | 10.4 |
| training/burn-compat.puml · bottom of XTASK | 25 / 2 / 49 | 12.4 |
| arena/burn-compat.puml · bottom of SESSION | 31 / 2 / 53 | 10.6 |
| arena/burn-compat.puml · right of SESSION | 27 / 2 / 50 | 11.5 |
| arena/burn-compat.puml · bottom of REPLAY_NATIVE | 34 / 2 / 58 | 11.2 |
| arena/burn-compat.puml · bottom of EVAL | 32 / 2 / 58 | 12.0 |

## 11. Whole-gate ledger

| Attempt | Source identity | Result / retained receipt |
|---|---|---|
| Native runner 1 | `dbb7f85fc549e99971e41dedbf30159ab05ff7713ffd7ab13fe72ceb090bfba5` | **STOP / reviewEligible=false** at root `lint-engine`: `require-yield` rejected the input-failure test's empty async generator. [Receipt](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-86026-1792203736469800854-0/receipt.json). Before/after identities matched; this is not a passing test invoice. |
| Native runner 2 | `e582b0b61ff5edfd20d8e7867fea53ca454c969fe40c53448203508362368419` | **PASS / reviewEligible=true**, 29 commands; **164 Rust / 93 Node adapter / 668 core tests**, no failed/ignored/skipped/filtered tests. [Receipt](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-86573-1792203830108203684-0/receipt.json). Before/after identities matched. Both owner diagrams also produced private bounded SVG artifacts. |
| Native runner 3 — contract repairs | `f5ad0c3ea838cec3ff537e6533c9404fe5e5b7d6f89355f4cc07579a6365099f` | **PASS / reviewEligible=true**, 29 commands; **180 Rust / 93 Node adapter / 668 core tests**, no failed/ignored/skipped/filtered tests. [Receipt](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-99075-1792205198177446120-0/receipt.json). Before/after identities matched. Both owner diagrams passed syntax checks and produced private bounded SVG artifacts; legacy tracked/untracked preservation passed before and after. |

The lead replaced that fixture with an explicit rejecting async iterator without changing the expected failure envelope.
The second complete `cargo xtask check` attempt passed on the repaired source.
Leaf-agent passes do not replace the whole-gate invoice or unlock reviewers.
The G2 invoice unlocked the first read-only review cycle; it does not verify subsequent repair source.
No commit, push, real training, profiling, dataset rewrite, activation or legacy deletion occurred.

## 12. Closing review cycle 1

All reviews below started after the complete G2 pass and target source `e582b0b61ff5edfd20d8e7867fea53ca454c969fe40c53448203508362368419`.

| Review | Session | Result |
|---|---|---|
| Security | `ses_eb84fd9dbffee3DZ1jZuvB8u18` | **READY TO MERGE: yes** for the bounded NON_ADMITTED native baseline; no concrete findings; low residual risk. No commands rerun or files edited. |
| DevOps | `ses_eb84f58a6ffeBSA6GYa7ibDMuR` | **READY TO MERGE: yes** for the bounded baseline, based on static inspection and the supplied G2 receipt; no concrete findings. No commands rerun or files edited. |
| Adversarial | `ses_eb85050ecffe0Fk1VjUQGCYUt9` | **READY TO MERGE: no**, with three medium findings inferred from static inspection. Repairs and persisted RED/GREEN controls are in progress. |

Security identified installed Node/tsx byte binding as future hardening, not a current finding or a hermeticity guarantee.
These verdicts authorize neither learned-model admission nor training, deployment, hostile-code containment or R4 readiness.

| Finding | G2 source location | Review finding / repair boundary |
|---|---|---|
| N1 — MEDIUM | `apps/arena/src/cli.rs:249` | Output permits `<repo>/scripts/fresh-dir`, although preservation protects `scripts`. Reproduce with a pure destination guard and private fake repository; do not write RED repro output into real protected paths. |
| N2 — MEDIUM | `apps/arena/src/record.rs:17` | Default Serde unit-enum decoding accepts object aliases such as `{"tiny-v1":null}` instead of the declared string grammar. Enforce string-only host/config/RPC enums and baseline selectors without changing canonical serialization. |
| N3 — MEDIUM | `apps/arena/src/record.rs:30` | Default struct decoding accepts positional seat pairs such as `["pass-v1","pass-v1"]` instead of `{w,b}`. Enforce object-shaped pairs and retain required/missing/duplicate/unknown-field checks. |

No risk waiver closes these findings.
No rereviewer may run before the repaired source passes a fresh whole gate.

### Baseline selector N2 scope check

`BaselinePolicy` already uses a String-only Serde conversion in `packages/training/src/policy.rs`.
All three unit-object aliases failed decoding before any production edit.
The two new tests in `packages/training/tests/policy.rs` passed against that unchanged implementation; this scope produced no RED reproduction.
Only the test file changed; selection, RNG and canonical serialization remain unchanged.

| Leaf check | Result / retained log |
|---|---|
| Pre-change alias controls | 2 passed / 6 filtered; targeted reproduction only, not a whole-suite pass. [Log](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/policy-n2-wire-a1nowxh2/prechange.log). |
| Unfiltered training all-targets | 74 passed; all previous 72 retained. [Log](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/policy-n2-wire-a1nowxh2/green-training-all-targets.log). |
| Training Clippy / owned-file format | Passed. [Clippy](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/policy-n2-wire-a1nowxh2/green-clippy.log) / [format](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/policy-n2-wire-a1nowxh2/green-format-check.log). |

This result narrows N2's baseline-selector scope; it does not itself close the separate host-enum finding or replace a whole gate.

### Arena N1–N3 repair handoff

The implementer reproduced N1, host-enum N2 and pair/object N3 before repairs.
All protected-path reproduction tests used a private fake repository; no real protected path received output.
The repaired source adds `scripts` to the canonical output guard, requires string-only wire enums and requires object-shaped host/pair/RPC decoding.
Canonical JSON, required nullable fields, borrowed `Pair<T>` support and all v1 controls remain intact.

| Regression | Persisted tests | Retained RED evidence |
|---|---|---|
| N1 — protected output paths and canonical aliases | `apps/arena/src/cli.rs` · `n1_*` | [RED](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/arena-n123-fixes-Mqo5bC/n1-red.log) |
| N2 — new host/config/RPC unit enums | `apps/arena/src/{record,engine_v2}.rs`, `apps/arena/tests/{runner,schedule}.rs` · `n2_*` | [RED](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/arena-n123-fixes-Mqo5bC/n2-red.log) |
| N3 — pairs, nested host objects and tagged RPC objects | `apps/arena/src/{record,engine_v2}.rs`, `apps/arena/tests/{runner,replay,schedule}.rs` · `n3_*` | [Pair RED](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/arena-n123-fixes-Mqo5bC/n3-red.log), [nested RED](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/arena-n123-fixes-Mqo5bC/n3-nested-red.log), [tagged RED](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/arena-n123-fixes-Mqo5bC/n3-tagged-red.log) |

Unfiltered arena all-targets passed **76 tests**: 43 unit / 9 replay / 10 runner / 7 schedule / 7 retained smoke.
The suite retains all prior 62 tests and adds 14 regressions.
The [GREEN suite log](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/arena-n123-fixes-Mqo5bC/arena-test.log) lists every regression; sibling `arena-check.log`, `arena-clippy.log` and `arena-fmt.log` record passing leaf checks.
These are package-level results, not a closing rereview verdict; G3 subsequently reran their complete suites on unchanged source.

## 13. Closing review cycle 2

All three read-only rereviews started after the complete G3 pass and target source `f5ad0c3ea838cec3ff537e6533c9404fe5e5b7d6f89355f4cc07579a6365099f`.
The source remains frozen; only Markdown lifecycle records may change during review.

| Review | Session | Result |
|---|---|---|
| Adversarial N1–N3 closure and regressions | `ses_eb85050ecffe0Fk1VjUQGCYUt9` | **READY TO MERGE: yes**, bounded NON_ADMITTED baseline only. **N1 CLOSED**, canonical output guard including scripts/aliases; **N2 CLOSED**, string-only host/schedule/RPC enums; **N3 CLOSED**, object-only pairs/nested/tagged schema. No new findings. |
| Security boundary/codec/output delta | `ses_eb84fd9dbffee3DZ1jZuvB8u18` | **READY TO MERGE: yes**, this exact source's bounded NON_ADMITTED baseline only; no new concrete findings; risk low. Canonical JSON, required nullables, duplicate/unknown-field rejection and replay integrity remain intact. BaselinePolicy tests cover existing behavior, not a repaired production defect. |
| DevOps/configuration/verification delta | `ses_eb84f58a6ffeBSA6GYa7ibDMuR` | **READY TO MERGE: yes**, bounded native baseline only; no new concrete findings. Static rereview relies on the G3 receipt and binds to its exact source; no commands rerun or files edited. |

All three closing verdicts bind to G3 source `f5ad0c3ea838cec3ff537e6533c9404fe5e5b7d6f89355f4cc07579a6365099f`.
No finding received a risk waiver.
Installed Node/tsx byte binding remains disclosed future hardening, not a current hermeticity claim.
No code, test, configuration, lock or diagram changed after G3.

## 14. Delivered boundary and next goals

- Delivered: strict Rust contracts, exact quota-B native candidate composition, versioned baseline selectors, persistent native full-match orchestration, bounded fixture schedules, independent native/policy replay, conserved evaluation and `run`/`suite`/`replay` CLI commands.
- Preserved: v1 synthetic Burn/Flex f64 compatibility, the unchanged native game engine, legacy consumers, frozen contracts/pins, historical failures, corpora and evidence.
- Verification: `cargo xtask check`, G3 **29 commands PASS / 180 Rust / 93 Node adapter / 668 core tests**, matching before/after identity; both owning diagrams validated/rendered; adversarial/security/DevOps closing verdicts READY.
- Not delivered or admitted: economic belief/features, historical feature-encoder parity, payout calibration, trained artifacts, learned-policy zero-fallback acceptance, R4/R5 or learner readiness. `fullRunner:true` continues to mean multi-window baseline capability only.
- Next engineering scope: specify and verify economic belief/features and the learner integration/readiness contract before any separately authorized data rewriting, fitting, training, activation or legacy cleanup.
- Repository state: implementation remains uncommitted; no commit, push, publication, deployment, real training, profiling, dataset rewrite, activation or legacy deletion occurred in this delivery.

Spec stewardship (`ses_eb87b6191ffeT08CIydGc4Ri1U`) reported **SPEC STATUS: in-sync** for the bounded contracts using the supplied G3 receipt.
The two header/index projections agree: 23 training and 41 arena declarations, including the MJS parity oracle and seeded CLI JSON fixture.
Neither scoped owner has unresolved or empty coverage; unrelated historical debt remains unchanged.
The steward corrected one current navigation label without editing diagrams, index or source and without rerunning verification.
The lead then recorded the completed closing verdicts in current Markdown navigation only.
