# Current-profile Gate0 input and output-registration packet

Status: DRAFT / HOST BINDINGS MISSING / NOT ACCEPTED / NO OPERATIONAL GRANT.

This packet supplies the current design, source/test index and registration procedure.
It does not substitute development artifacts for captured runtime inputs.
Executor must independently accept the final frozen physical input bytes and this method before any capture/build request.

## Accepted design references

| Decision | Selected design |
|---|---|
| C1 | Trusted supported host/manager/kernel and immutable artifacts; no kernel/opened-object custody claim |
| C2 | CPU quota 400000/100000, 8,589,934,592 bytes RAM, zero extra swap, 512 tasks, 2,147,483,648-byte charged tmpfs |
| C5 | Exact Linux/amd64 Bun/Rust manifest and Tini checksum candidates in `runtime-inputs.json` |
| C6/C7 | Burn gradient accumulation; 4,670 declared central differences with unchanged tolerances |
| C8/C9 | Outside read-only exact owned-cgroup observer; Balanced FD/inode/file/stream/evidence ceilings |
| C10/C11/C12 | Master-seeded initialization; private SQLite completion/checkpoints; two owned redundant Burn learners |
| C13 | One exact operator-selected private state mount at `/state` for policy jobs; native F9 stays tmpfs-only |
| C14 | Six standard pinned Bun reference bundles; no reference fallback or runtime package manager |
| C15 | Fifty fixed 100-STARTED-slot private evidence packets; 4 GiB / 16,384 entries each; 200 GiB aggregate payload planning ceiling; no failure rollover |
| Host entrypoint | Host `mise` preflight/seeding/provisioning; Executor explicitly amended training to a supported shared-GPU host Docker job while the coding agent stays in sbx |
| GPU + state placement | Actual F64 GPU scoring/learning is mandatory; keep the active GPU attached to the host driver and use host-backed private state; vendor/backend/driver/target admission remains open |

## Input-registration roles

Use standard SHA-256/length/path manifests with strictly ordered paths.
Keep physical source bytes and generated output bytes as distinct roles.
The trusted launcher holds the expected manifest hash independently of any worker response.
Do not update a pin automatically after failure.

| Input role | Exact content / registration obligation |
|---|---|
| Source and tests | Complete current workspace snapshot, `_spec` goals, persisted tests, tooling, manifests, locks and layout; no Git commit/publication requirement |
| `current-native/` | Frozen root Cargo manifest/lock plus every root workspace member's manifest/source required for standard Cargo loading, including `crates/host-facts`; native build selection remains only the three policy executable targets |
| `current-runtime/` | Exact four workspace package manifests and selected `src` trees, root package manifest and Bun lock; no tests, secrets, toolchain, cache or unselected project files |
| `cargo-home/` | Newly captured locked public registry/source inputs selected by standard Cargo evidence; no credentials, user configuration or developer cache mount |
| `bun-cache/` | Newly captured anonymous public package inputs for the current frozen production install |
| `reference-input/` | Pinned reference revision's six entrypoints and selected transitive source/package/manifests/installed resolution inputs, original pnpm lock, corpus manifest and 664,540-byte source; no unrelated workspace/cache tree |
| `builder-tools/` | Frozen `tooling/build-reference.ts` as `build-reference.ts` and `reference-entrypoints.json` |
| `init/` | Independently captured Tini bytes matching the selected published SHA-256 and length expectation |
| Images | Exact selected platform manifest/config/layer bytes, not mutable tags or developer images |
| GPU runtime inputs | Actual vendor/backend, selected driver/container-runtime/toolkit/library closure and device identity; reconcile supported runtime-managed injection with exact C2/C13 mount/device policy before accepting the amended GPU recipe |
| Recipe | `tooling/runtime/Dockerfile`, context-role manifest, supported builder/control-plane tool bytes and exact future command allowlist |

`tooling/runtime/Dockerfile` is an unexecuted standard multi-stage recipe.
Its three build commands disable networking.
The native Cargo command selects only `policy-score`, `policy-channel` and `policy-initialize`, and the final image copies only those three native binaries.
Including host-facts manifest/source for workspace loading does not select that crate for the application native build, copy, runtime dependency closure or final image.
`crates/host-facts/tests/recipe.rs` persists the exact native build/copy allowlist and rejects host-tool copying or workspace-wide native builds; the Docker recipe itself is unchanged.
Keep the host tool's development/control-plane dependency inventory separate from the application's selected Cargo closure and the future host-tool deployment/loader registration.
The Bun install uses frozen production inputs and disables lifecycle scripts.
The reference build rejects unresolved dynamic imports.
The final stage contains the curated runtime, three native binaries, six reference bundles, corpus bytes and selected image-contained init.
Native library compatibility still comes from actual final image/build outputs, not the development ELF findings.
Missing inputs, unresolved libraries or incompatible outputs fail the approved attempt without silent fallback/rebuild.

## Output-registration method fixed before build

1. Executor retains the accepted input-manifest and recipe hashes outside the job.
2. A separately scoped build produces immutable output files and standard build receipts.
3. A trusted read-only registration step inventories actual output bytes against those retained input/recipe roles.
4. Register exact image ID/config/platform, Bun executable/runtime libraries, init, three native executables and their complete interpreter/needed-library closure.
5. Register current worker/coordinator/contract/policy production resolution files, six reference bundles and corpus bytes at their fixed paths.
6. Include actual build-script/proc-macro/generated-output receipts and production dependency/native inventories.
7. Publish the physical output manifest into the operator-controlled immutable store and retain its external hash independently.
8. Select qualification only from those registered outputs under a fresh exact grant.

The builder's report is evidence for registration, not authority to select its own expected image or source identity.
Workers never nominate executable paths, runtime hashes, reference expectations, state sources or readiness flags.
No output hash can be filled prospectively with a placeholder.

## Host bindings required before acceptance

The following values remain deliberately unset:

```json
{
  "approvedEligibleCpuIds": null,
  "jobCpuIds": null,
  "approvedDaemonHostCgroupParent": null,
  "daemonHostProcObservationRoot": null,
  "daemonHostCgroupObservationRoot": null,
  "privateStateHostSource": null,
  "outsideEvidencePacketRoot": null,
  "outsideInterpreterAndManagerSelection": null,
  "outsideControlPlaneRamAndCpuAdmission": null
}
```

The GPU amendment also leaves `selectedGpuIdentity`, `gpuBackend`, `gpuDriverAndRuntimeClosure`, `gpuVramPolicy` and `gpuTargetQualification` unset.
The existing CPU-only Dockerfile and development binaries do not satisfy those roles.

CPU IDs must come from Executor's approved set of at most 12 eligible threads.
The hard aggregate ceiling remains 24,000,000,000 bytes.
Do not infer CPU IDs, host filesystem mappings, state paths or live headroom from the development sandbox or the consumed metadata receipt.
C16/C17 supply only sbx-local proposals: eligible 0..11, job 0..3, outside control 4..5, observer `/proc` + `/sys/fs/cgroup`, parent `/docker`, Python `/usr/bin/python3.14` and Docker `/usr/bin/docker`.
Executor's realm correction prevents promoting them to actual host bindings or provisioning limits.
The sbx-local daemon reported 20,445,216,768 bytes RAM and 16 CPUs at C16; this is not an actual-host capacity receipt.
The proposed 8 GiB job plus 2 GiB outside reserve totals 10,737,418,240 bytes before separately admitted concurrent work.
The cgroup parent and observation view must refer to the actual selected daemon host.
Executor stated these values are unknown and must be calculated.
[host-binding-inventory-request.md](host-binding-inventory-request.md) retains the consumed C16 receipt and exact historical scope.
Select actual private storage and outside control-plane headroom before freezing the complete command packet.
The bounded `/state` design and temporary SQLite tests do not qualify that target's durability or full-experiment physical fit.
C15's 200 GiB persistent-payload ceiling is distinct from RAM and grants no storage allocation.
C17 describes sbx-visible mounts only; its free-space samples do not limit host provisioning.
Executor states the actual host can provision `200gb` and selected host-executed mise as the entrypoint.
The enforced pipeline write bound is 182,806,749,184 payload bytes including outside evidence, or 191,396,683,776 free usable bytes with the explicit 8 GiB planning allowance.
The earlier 204 GiB sum of configured ceilings is not the fixed pipeline's minimum.
Exact units, usable bytes/entries, host view and control-plane mapping still require actual target selection and qualification.
Executor subsequently supplied passing v2 host metadata and Docker Sandboxes root help, with both executable hashes explicitly skipped.
Executor subsequently supplied that six-command help packet, selected host-backed state, and amended training execution to a shared-GPU host Docker job.
Executor returned operator-reported self CPU/RAM/GPU and candidate state-parent filesystem metadata without a daemon/workload query or allocation.
The report's executed source commit, invocation and timestamp remain unknown; see [verification.md](verification.md#operator-reported-admission-evidence).
Do not fill the independent host-binding fields above from reported identities, sampled headroom or the proposed application path.
The Python CLI proposal is superseded and removed; the [Rust fixed-API v2 collector](host-runtime-inventory-request.md) has accepted Rust/handoff-source reviews, verified local static bytes/ELF properties and passing release-musl/task/configuration tests, while actual-host compatibility/deployment registration and publication/transfer/query approvals remain pending.
The digest-qualified relative store and closed artifact JSON are proposed handoff expectations, not self-issued production registration or an independently accepted actual-host path; missing bytes fail without build/download fallback.
Neither the Rust synthetic results, historical Python fixtures nor any proposed metadata endpoint selects an execution target, registers runtime artifacts or closes Gate0/F9/R4/GPU readiness.
The offline host-tool Cargo tree and standard `--no-deps` metadata pass do not establish a complete application closure; the application offline-tree attempt failed on missing cached `addr2line v0.27.1` without online fallback.
See [host-entrypoint.md](host-entrypoint.md) and [storage-admission-decision.md](storage-admission-decision.md).
Private state storage is therefore a genuine remaining allocation/contract boundary, not a field to fill with a guessed path.

## Qualification order

Gate0 acceptance grants no execution.
Request exact capture/build approval next.
Register actual outputs before requesting supported-runtime resource/loading/clock/cleanup qualification.
Request the cold BOTH init/open/pass/reference/clean-close proof separately.
Keep S0 before launch-causal work, S0+10s cold proof, S0+297s normal-work cutoff and S0+300s final absence/reap checks.
Keep 10-second nonrenewing planning permits and no retry/reset after failure.
Do not run collection or training to prove technical readiness.
