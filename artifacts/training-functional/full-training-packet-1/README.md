# Full-training packet — source preparation

Readiness publication: `dad29306a83268aeed720b7e9b8311a6d9d941e1`, existing PR51 against `main`.
This packet remains local and unpublished.
Training, HOST preparation, native/GPU/container operations, acquisition, installation and reference builds remain unauthorized.

## Selected envelope

Executor selected **18-day envelope (Recommended)** for source-only preparation.

| Limit | Selected value |
|---|---|
| Campaign work | 18 days |
| Result validation | At most 12 hours |
| Final cleanup/receipt | Within the original outer deadline; 10 minutes reserved |
| Fresh writable workspace | 256 GiB soft budget |
| Initially usable free space | At least 264 GiB |
| Free filesystem entries | At least 835,600 |
| No verified-attempt/validation progress | 600 seconds |
| CPU / RAM / additional swap | 2 / 8 GiB / none |
| GPU free-memory policy | 3 GiB admission / 2 GiB running |

These limits do not guarantee completion or confirm HOST capacity.
One monotonic origin precedes preflight and fixes the outer deadlines.
An early validation start does not grant more than twelve hours of validation.
GPU telemetry does not reset inactivity.
Compact telemetry streams to disk; the qualification's 800-event raw-trace array is not reused.
The HOST opens the telemetry descriptor exclusively before container startup and never appends through the container-writable pathname.
Final worker-report reads reserve time for owned-CID removal.
Workspace checks tolerate normal scratch/journal removal, and progress reads accept stable snapshots across atomic replacement.
Existing 64-MiB SQLite and 4-GiB-per-packet ceilings remain unchanged.

## Source and inputs

- Extend the immutable 108-file qualification closure with `TrainingCampaign` and the three campaign modules.
- Keep all 108 original file bytes and the fourteen original document bytes unchanged.
- Create a new source manifest and new source/tests/runtime-configuration/recipe bindings for this campaign.
- Preserve the other ten document references, all nine retained reference rows, and the retained Zod dependency payload pins.
- Future preparation copies retained prepared inputs read-only into fresh delivery/input roots.
- Future preparation creates the existing workspace aliases and executable adapter modes in the fresh copy.
- Future preparation creates empty `app/reference` and `app/qualification-inputs` mountpoints.
- No reference build, dependency installation, acquisition, qualification rerun or numerical rerun belongs to preparation.

Proposed HOST roots are `training-campaign-delivery-1`, `training-campaign-inputs-1` and `training-campaign-1` beneath the existing runs directory.
Their availability has not been inspected.
Each future owner must reject an existing root rather than delete, adopt or retry it.
Keep qualification roots, the failed full1 writable cache, partial workspaces, halted LLVM work and the protected original checkout untouched.
Use fresh writable state/tmp/home/evidence directories and read-only retained native/toolchain mounts.

## Campaign and result contract

The existing `TrainingCampaign.run()` owns one persistent coordinator/factory, serial masters101–105, exactly1,000 verified attempts per master, one finalization and one close.
Five CPU initializers supply the five initial records.
The separate full-campaign native path requires explicit future approval.
It does not broaden GPUv1's master101/ordinal0 protocol or enable either ordinary GPU main.
F64, all4,670 finite-difference coordinates, distinct C12 assertions and the accepted tolerances remain unchanged.

After coordinator closure, a separate reader validates the retained SQLite rows and artifacts sequentially.
It checks five complete masters,5,000 exact completed ordinals, model handoffs, cumulative journal hashes across master boundaries, histories, checkpoints and five VALID final artifacts with primary master101.
It reports native-score replay as absent rather than claiming another numerical/native qualification.
It records existing counters, returns, reasons, sample counts, declared objective ranges and a compact chain of declared parameter digests without inventing learning-quality thresholds.
It does not recompute native parameter digests.
Held-out quality metrics remain unrecorded.

## Future approval and handoff

`request.json`, when assembled and verified, binds this source generation, its tests, the fourteen bindings and its prepared-input manifest.
It deliberately records `trainingExecutionAuthorized:false` and `publicationAuthorized:false`.
Operational modes require a separate `chess-coach.training-execution-approval.v1` record matching the request SHA-256 and the full-five-master native scope.
A CLI mode, technical readiness flag or budget selection does not create that approval.
No approval record or runnable HOST command is issued by this preparation.

Future preparation places the request and binding-document manifest in the fresh read-only `qualification-inputs` directory alongside its fourteen role files and `input-manifest.json`.
A separately approved execution places its matching approval there too.
The operator creates the original invocation timing in the fresh evidence directory before starting its newly owned container.
It inspects and removes only that exact owned CID.
Failures preserve partial evidence without automatic retry or root reuse.

Complete all planned training and validate its results before security/privacy/isolation/custody/strict-stop/crash/full-assurance hardening.
