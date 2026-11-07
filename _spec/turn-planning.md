# Recipient-local queue eligibility

## Scope

Selectively adapt canonical `rules/planning-order.ts`, `rules/nativeClassical.ts`, `rules/planning-intents.ts` and their required geometry from the read-only reference at `b4b241481fb12de4a7344e6dba8eda775af57675`. Keep the new flat game-core layout. Do not migrate legacy planners, economic estimators, ownership kernels or operational grants.

`knownAppendFailure` applies known-board actor, shape, timing, mine-cap and vacancy constraints. It accepts player knowledge, not a simulator snapshot. A caller must provide currently known pieces, not unseen occupancy or stale sightings as current blockers. Hidden paths remain resolution concerns. This recipient helper does not enforce gas/mineral affordability, charge resources, enforce the complete queue contract or resolve actions.

`orderBHeadsFirst` sorts by authored sequence, repeatedly selects an unblocked dependency head, excludes a mover's own origin from head blocking, and retains sequence fallback for cycles. Deployments participate in the same predicate rather than a separate kind sort. Structural classical rewriting uses the first matching own B relocation and canonical Marine-band/warp requirements.

`nativeClassicalChecks` separates the insertion-time actor/siege context from the resulting queue context. Later births, replacements, transfers, held/immediate promotion and siege toggles can change the resulting actor. The fold uses local transfer tags to distinguish pieces that occupied the same square. These tags are temporary rule-evaluation data, not paid lineage IDs, authorization tokens or a persistence framework.

Preserve lawful native drops, reject invented Marine doubles, and retain insertion diagnostics even when later actions change the resulting state. Ignore opponent actions when evaluating an own classical dependency. Do not query visibility, hidden mines, opponent queues or speculative resolution.

Deploy anchors use the living CC for B, and its projected same-side classical landing for F. Non-CC occupants are crushable; both sides' CC squares remain undeployable. Charon aim accepts diagonal empty squares and does not require a known target. Mine drops and Charon F aim use the authored classical landing. Full collision, resolution-time resource accounting, death and provenance handling remains pending.

## Authoritative edits

`queue-validation.ts` and `queue-action.ts` separately adapt the canonical trusted-snapshot command path. They are not actor-safe planning APIs. They may read full occupancy and mine state. Never call them from recipient feature extraction or use their hidden-dependent errors as policy observations. A future host bridge must distinguish recipient admission from authoritative resolution and receipt production.

`addScAction` requires planning phase, checks canonical CC/action admission, enforces one C per side and one special per original actor square, assigns monotonically increasing sequence numbers, validates both insertion/result dependencies, and debits special gas only after validation succeeds. `removeScAction` validates remaining dependencies before returning an edit, refunds special gas up to current income, preserves remaining sequence numbers, and clears the removed origin's special-used marker. Failed edits leave the source snapshot unchanged.

Queue gas accounting remains separate from mineral accounting. These helpers neither debit deployment minerals nor emit paid receipts. The trusted typed-snapshot API assumes valid input field domains; it is not an arbitrary JSON validator. Snapshot decoding, full economy ownership, collision resolution and provenance-backed receipts remain pending.

## Verification goals

The persisted planning corpus spans both colors, all six actor types, all origins and blocked/unblocked worlds. It checks 49,152 native dependency results and 344,064 append decisions across 1,536 worlds. Tests normalize siege sets, retain actor transfer tags and diagnostics, serialize each result as JSON plus LF and hash it with SHA-256. `tests/planning-corpus.ts` defines the exact corpus. Its fingerprints match the original modules at the recorded reference commit.

`tests/queue-corpus.ts` independently fingerprints authoritative edits across 1,536 worlds. It makes 92,518 append attempts, including duplicate attempts after successful additions, and 6,502 removals. The 6,502 first-add successes preserve snapshots, assigned actions and gas results. Rejections preserve error name, code and message. This fingerprint matches the original `commands/queue-action.ts` implementation. Persisted corpus tests load recorded hashes, not the old worktree.

The integration test starts with validated recipient observations and candidates, performs append/dependency checks, then separately exercises authoritative in-memory queue edits and the actual feature encoder. This is not a turn resolver or a host execution test. The full workspace passes 238 Bun tests with 5,168 assertions after adding candidate enumeration and collision prerequisites; source and tests pass strict TypeScript checks. Do not transfer old suite status or call this a complete playable engine.
