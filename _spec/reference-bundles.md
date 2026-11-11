# C14: standard pinned Bun reference bundles

Status: PINNED BUN BUNDLES SELECTED / AUTHENTICATED OBJECT GRAPH IMPLEMENTED / VERIFIED TEST SUBSET / SOURCE_REVIEWS_ACCEPTED_SCOPED / OPERATIONAL QUALIFICATION OPEN / NO FINAL CAPTURE OR IMAGE BUILD.

## CURRENT — implemented source, verified subset, scoped source acceptance

The architect-approved repair now exists in `packages/runtime/tests/reference-bundles.test.ts`; this source delta changes no other source file.
The [sequence](reference/object-graph-authentication.puml) documents implemented authentication and its retained proof limits, not operational qualification.
`review-corrections.json` records filter execution, object ancestry, and lazy-object-fetch as `CLEARED_CURRENT_PACKET_5` under `REVIEWED_SOURCE_ACCEPTED_OPERATIONAL_QUALIFICATION_OPEN`, with `allListedSourceFindingsCleared:true`.
`_work/gpu-owner-recovery/runs/authenticated-git-objects-1/` records 25 tests / 194 assertions, zero failures, and one full C14 test filtered out; its receipt reports `PASS`, exit 0, and `sourceChanged:false`.
`authenticated-git-objects-types-1` passes the affected test TypeScript check with the same recorded source-manifest digest and no source change.
The prior 16/108 result remains `PRE_OBJECT_GRAPH_AUTHENTICATION`; the parent's earlier adversarial acceptance of that snapshot does not accept this repair.
`security-typescript-baseline-packet-5/{command.stdout,sources.json,receipt.json}` retains the full 18-file baseline diff and source/stream binding, not a new verdict.
`security-typescript-authenticated-review.json` accepts the full 18-file packet-5 source-security scope with zero remaining concrete findings; `adversarial-final-review.json` accepts reviewed source only, clears object ancestry/lazy fetching, preserves prior clearances, and reports no new or remaining in-scope findings.
These persisted current verdicts, not the old 16/108 acceptance, establish scoped source acceptance; [verification.md](verification.md#current-scoped-source-review-acceptance) records the exact boundaries.
The fresh `closure-reference-1` rerun also records 25/194 with zero failures and one C14 test filtered, and `closure-test-types-1` passes with `sourceChanged:false`; their snapshots do not imply one global all-files hash.
`closure-verification-integrity-2` validates the complete closure-reference/test-type selected manifests, packet 5's entire 198-input manifest, and stream hashes/lengths; this is not an atomic snapshot or a whole-current claim for the historical Rust packet.
`source-accepted-diagrams-2` passes the final three-diagram render; `closure.json` separately indexes staged namespace/scoped-whitespace evidence, not additional source-review verdicts.

### Why the inventory must authenticate its ancestry

An ODB pathname containing an expected OID does not prove that the stored object body hashes to that OID.
A malicious owned clone can shadow an original subtree OID with an altered compressed body, without finding a SHA-1 collision.
An unauthenticated `git ls-tree` inventory can then agree with forged physical bytes and staged entries while describing a different tree from the independently pinned commit.
The inventory must therefore derive only from the authenticated commit-to-tree graph, never from unauthenticated `ls-tree` output.

### Authenticate before interpreting

1. Retain the independent SHA-1 commit pin in `tooling/reference-entrypoints.json`, corroborated by `packages/runtime/tests/fixtures/reference-sources.json`, and the canonical Git top-level/SHA-1/no-replace checks.
2. Read the raw required commit body using `git cat-file commit <independentPin>`; require `SHA1("commit " + byteLength + NUL + body) == independentPin` before interpreting it.
   This command returns the raw body, not a batch frame. Parse its first strict `tree <40 lowercase hex digits>\n` record only after authentication; malformed or missing root identity fails closed.
3. Traverse required trees breadth-first using bounded raw `cat-file` batches.
   For every tree, require `SHA1("tree " + byteLength + NUL + body) == requestedOID`, where the requested root comes from the authenticated commit and each requested child comes from an authenticated parent.
   Validate response OID, expected object type, declared byte size, exact body boundaries, and the trailing protocol newline; reject missing, malformed, truncated, or unexpected responses.
4. Decode each authenticated binary tree as mode/name/NUL/raw-OID entries, not textual listing output.
   Require strict supported modes, valid UTF-8 nonempty component names, no path separators, no `.` or `..`, and no duplicate names within a parent.
   Retain regular/executable blob modes, directory entries, and only the already allowed empty gitlink placeholder; reject symlinks and unsupported modes.
5. Cache authenticated nodes only within one validation.
   A reused tree OID must still instantiate its entries beneath every parent path; node deduplication must not discard path membership or evade path-entry/depth limits.
   Apply the independent graph-work, metadata, path, entry, depth, and deadline limits below; reused nodes do not excuse path expansion from those bounds.
6. Derive the complete inventory from that verified graph, then retain raw physical blob Git SHA-1/executable-mode checks, directory/symlink/submodule checks, exact mode/OID/path stage-0 index equality, and H-flag checks.
   Missing, extra, duplicate, unmerged, or mismatched index entries still fail.
   Authenticate every consumed bundle input's original-graph membership, byte length, and SHA-256 before imports; reauthenticate physical inputs after inventory capture.
7. Retain the ban on validator worktree/cached Git diffs and source clean/textconv pipelines.
   No history-wide fsck, automatic fetch, or repair operation substitutes for this bounded validation.

### Missing objects cannot trigger acquisition

Every reference Git helper invocation must set `GIT_NO_LAZY_FETCH=1` and `GIT_TERMINAL_PROMPT=0`.
The fresh missing-object regression verifies these guardrails against the owned local promisor canary.
Missing required commit/tree objects must fail closed without invoking promisor helpers, local transport canaries, or network acquisition.
This is a read-only validation requirement, not permission to obtain missing objects.

### Implemented bounds

| Limit | Exact scope |
|---|---|
| 4 MiB | Git helper output cap, raw commit/tree-body and tree-batch response cap, individual batch stdin cap, cumulative tree-batch stdin plus stdout work, and aggregate instantiated UTF-8 path bytes; these are separate checks, not one combined budget |
| 4,096 trees | Distinct authenticated tree nodes cached within one validation; batch OID requests are unique and bounded |
| 16,384 entries | Parsed entries per binary tree and total instantiated inventory entries, including every reused parent-relative path |
| Depth 32 | Maximum pending tree depth with root at depth 0, not a claim that every file path has at most 32 components |
| 4,096 bytes | Maximum individual instantiated UTF-8 inventory path |
| 20 seconds | Graph deadline starts before raw commit retrieval; each tree helper uses at most 10 seconds, capped by remaining graph time |
| 16 MiB / 128 MiB | Maximum physical file size / aggregate physical blob bytes |

The 20-second graph deadline is not a whole-validator or atomic-filesystem-snapshot guarantee; physical scanning follows graph authentication.
These constants come from the implemented guard. The selected tests exercise named parser/batch/entry/expired-deadline/reused-expansion/depth refusals, not exhaustive coverage of every limit combination.

### Verified owned fixtures

| Regression family | Fresh observation within the 25-case suite |
|---|---|
| Raw commit and subtree-body corruption | Loose-object shadows make ordinary Git return forged commit/root or leaf inventory while HEAD retains the genuine pin; the new guard rejects `COMMIT_HASH_MISMATCH` or `TREE_HASH_MISMATCH` |
| Missing required tree with a local `ext::` Bun canary | The old `ls-tree` counterfactual invokes the owned local canary while failing; current validation rejects with no marker |
| Reused subtree OID | Every parent-relative inventory path survives node caching; removing a local object before a second validation proves no cache survives across validations |
| Binary/protocol/resource negatives | Wrong OID/type/size/framing, truncation, invalid names/modes/duplicates, batch bytes, binary entry count, expired graph reads, reused-tree expansion, and excessive graph depth reject |
| Retained controls | Index/H-flag, physical blob/mode/symlink/submodule, no-filter, and all-consumed-input membership/size/SHA-256 refusals remain passing cases |

Corruption fixtures write only the owned clone's local loose-object store, never a shared alternate or the parent object database.
The `ext::` counterfactual uses only an owned local canary; it authorizes no actual network or host operation.
The 25 tests already include the no-lazy-fetch and object/parser/cache/bound cases; nested negative vectors are not additional top-level tests.
This repair retains the existing SHA-1 pin model rather than upgrading collision resistance, and it claims no atomic filesystem snapshot.
Full C14/native/F9/runtime qualification remains open, as do all actual host/GPU/container/capture/build/publication/training grants.
Frozen F9, CPU initialization, Bun inputs, GPU leaf source, disabled normal mains, and `trainingReady:false` remain unchanged.

## Retained bundle-selection contract

Executor selected `Pinned Bun bundles` in C14.
Keep the original reference read-only.
`tooling/reference-entrypoints.json` selects six exact source entrypoints from the pinned reference.
`tooling/build-reference.ts` invokes the installed pinned Bun CLI with no environment-file loading, no automatic installation and unresolved dynamic imports rejected.
It uses standard bundler metadata, filesystem APIs and SHA-256 to inventory selected source/package bytes and built outputs separately.
It implements no replacement module resolver, compiler or authorization registry.

Produce JavaScript modules at the existing six fixed `/app/reference/.../*.ts` paths.
The `.ts` suffix preserves the adapter paths; the registered content is a standard Bun-generated JavaScript module, not claimed to be the original source bytes.
Preserve the corpus manifest/source at their existing fixed reference-root paths.
Keep the native/reference proof adapter and all current game code outside the old-source bundle input graph.
Register build inputs and physical output bytes independently before qualification.

The old workspace's `pnpm-lock.yaml` remains provenance for its selected third-party packages.
It is not the current workspace's Bun lockfile.
The selected old-source/package input tree must be captured and registered explicitly under a separate capture grant.
Do not copy a broad development cache, rewrite the old lockfile or silently run a new online installation.
No pnpm tool or dependency cache ships in the final runtime.
The offline Bun build must fail on any absent selected package or unresolved import.

The development fixture builds six temporary bundles from the read-only reference and checks named exports, original init/open/pass fingerprints, both frozen strategic opening fingerprints and the existing corpus audit.
Those bounded in-process checks establish neither final-base loading nor a cold confined F9 proof.
Final strategic behavior, runtime loading and source/output expectations remain independently checked qualification obligations.
