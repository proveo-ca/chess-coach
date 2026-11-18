# Qualification packet — source preparation only

Current authority covers source preparation and bounded local mocked verification.
It covers no HOST command, container, source transfer, reference evaluation/build, native execution, GPU kernel/JIT, training, commit, push, or publication.
Do not execute either operator mode during this preparation.

## Prepared components

- `qualification-operator.ts`: fixed future operator/worker composition.
- `qualification-policy-score.ts` and `qualification-policy-channel.ts`: task-local native adapters.
- `FixedAttemptFactory` fourth callback: passive request/reply/finish observations.
- `qualification-evidence.ts`: retained functional-evidence checks and settled read-only SQLite readback.
- `qualification-input-documents.ts`: static source inventory and fourteen actual document references.
- `plan.json`: proposed limits and unapproved delivery/execution scope.

The existing canonical and R4 observers keep their original scope fields.
The R4 observer always returns `qualified:false`.
An evidence-check PASS does not establish actual execution, full-assurance qualification, functional acceptance, or `trainingReady:true`.

## Required future delivery

1. Deliver the exact base source plus reviewed packet delta into a fresh task workspace.
2. Provide the physical runtime dependency payload and fresh workspace aliases there.
3. Choose separately approved reference delivery: transfer the six retained bundles plus corpus/metadata/notices, or authorize offline assembly and six bounded builds.
4. Copy the fourteen documents listed by `binding-documents.json` to their declared `/app/qualification-inputs/<role>.bin` paths without changing bytes.
5. Supply the declared input manifest and verify provided payload hashes.
6. Stage executable adapters at the fixed native entrypoints and mount retained binaries/toolchain inputs read-only.

No step may overwrite, switch, or repair the original dirty checkout.
No package-manager installation or root Zod alias repair belongs to this packet.
The current reference bundles reside only in ignored local scratch until a transfer/build decision grants another operation.

Create or mount writable parents `/state`, `/tmp`, `/scratch/home`, and `/evidence`.
Leave `/state/run` and `/tmp/episode-model` absent for their owning constructors.
Use the retained Bun interpreter, not the legacy PATH Bun.

## Proposed execution, not permission

One owned container uses the selected GPU UUID, the existing fixed image with `--pull=never`, network disabled, two CPUs, and an 8-GiB RAM/swap ceiling.
The original 800-second outer budget includes admission, monitoring, administration, and cleanup.
Canonical failure stops the packet.
CPU initialization selects master101 once.
R4 runs exactly corpus ordinal0 followed by live ordinal1 under the existing per-attempt deadlines.
The packet calls no campaign or finalization API.
Readback and receipt output share one proposed 60-second deadline after owned attempt settlement.

The parent monitors cooperative headroom without reserving GPU memory.
It stops only its owned container on failure.
Retain partial evidence without retry, resume, or automatic re-execution.
The proposed native trace admits at most 800 events and 1 GiB of serialized data including framing.
Its proposed workspace soft cap is 2 GiB.
These practical limits do not guarantee capacity for every protocol-valid worst case or prove RAM fit.
Trace exhaustion preserves the prefix and marks evidence incomplete.

The source plan grants none of these proposed operations.
Issue an operator command only after exact delivery/execution approval and any required checked publication.

Input-document snapshots use exclusive `source-N/` generations.
Preserve earlier snapshots after source corrections.
The final generation contains its source manifest, verification receipt, and binding-document map.

## Corrected final generation

Use `source-3/source-manifest.json` for the reviewed execution-source snapshot.
Accept its verification only when `source-3/verification.json` records all twelve fresh categories passing.
Use `source-3/binding-documents.json` for the fourteen final document references.
These documents do not stage physical payloads or grant execution.

Preserve `source-1` as provisional history.
Preserve `source-2` and the green `qualification-2` run as known-bug history, not final acceptance.
The final checker hashes retained game records in their original validated order.
It hashes strategic snapshots using the unchanged driver's normalized representation.
The settlement regressions exercise the real engine and strategic driver with injected API stubs.

| Test filepath | Purpose |
|---|---|
| `artifacts/training-functional/qualification-evidence.test.ts` | Strict parser parity, producer hashes, retained evidence, settled readback |
| `artifacts/training-functional/qualification-operator.e2e.test.ts` | Mocked lifecycle, budgets, ownership, and incomplete trace output |
| `artifacts/training-functional/qualification-packet.test.ts` | Passive native-channel observations |
| `artifacts/training-functional/qualification-adapters.test.ts` | Adapter environment, streams, exits, and abort grace |
| `artifacts/training-functional/qualification-adapter-launch.test.ts` | Local extensionless Bun syntax and argv without native entrypoints |
| `artifacts/training-functional/qualification-input-documents.test.ts` | Static input inspection, bounds, and shebang parsing |
