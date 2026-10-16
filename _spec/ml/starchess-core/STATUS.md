# starchess-core — current status

**[Unverified] 2026-10-16 · lead-observed current frozen source; not current integrated R4 proof.**

## Responsibility

- Own [`@chess-coach/starchess-core`](../../../packages/starchess-core/package.json), native legality, and atomic queue admission.
- Own board/vision, resolution/outcome, native causal provenance, and the canonical adjutant registry.
- Export `.` and pure `/planning-v1`; keep the core free of workspace/ML dependencies.
- Keep native admission authoritative when a caller supplies generated queues.

## Current findings

- The accepted R3 native correction is already implemented; do not propose a duplicate engine repair.
- Missing-actor refusal compatibility was restored while retaining white/black refusal and atomicity controls.
- No new active engine-specific defect is established by this snapshot.
- The public CLI names `src/board/siege.ts` at an **auditor analysis resource refusal**; that path does not establish a validator bug or authorize an engine patch.
- The [registry](../../../packages/starchess-core/src/ai/definitions.ts) enables only `naive` and `strategic`; ML/RLHF/RLCD remain placeholders.

## Latest suggested repairs

R4 mapping: [detailed next-repair plan](../R4.md#ordered-next-implementation--pending-source-owner-work).
Arena owns [P1](../R4.md#p1)–[P8](../R4.md#p8); core retains the native-engine boundary, not those private solvers.
No new engine defect or ML dependency is assigned by this pre-implementation plan.

1. Retain native admission checks, atomicity, and existing refusal-string compatibility tests.
2. Revalidate core with the final integrated source only after the independent auditor gates close.
3. Keep model-facing planning pure; add no ML dependency, second legality implementation, or admission weakening to bypass an auditor stop.

No new engine TODO follows from an audit failure alone.

## Verification + References

- Lead's latest bounded core-file checkpoint: **668 PASS**, before the final auditor source freeze; not a full R4 result.
- No new tests, hashes, renders, or commands run in this documentation task.
- [Arena's current auditor findings](../starchess-arena/STATUS.md) own the four public HIGH failures and analysis ceiling.
- [Native legality source](../../../packages/starchess-core/src/rules/nativeClassical.ts).
- [Native provenance diagram](../../packages/starchess-core/native-provenance.puml).
- [Registry and availability owner](../../packages/starchess-core/adjutant-definitions.puml).
- [Accepted R3 seam/correction authority](../../_plans/ml-adjutant-r3-seam-addendum.md).
- [Accepted native correction](../../_plans/ml-adjutant-r3-native-promotion-fix.md).
- [Current ownership overview](../overview.puml).
