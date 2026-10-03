# Hermetic arena execution image

SPEC: `_spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml`

Run the CLI from any directory with Node supporting ESM JSON import attributes.
Use the returned immutable `sha256:…` image ID for every subsequent command.

## Commands

```sh
node packages/starchess-arena/hermetic/run.mjs build --dependencies
node packages/starchess-arena/hermetic/run.mjs preflight --image sha256:...

# Execute after the lead freezes and integrates the Phase2 source.
node packages/starchess-arena/hermetic/run.mjs build --from-dependencies sha256:...
node packages/starchess-arena/hermetic/run.mjs preflight --image sha256:...
node packages/starchess-arena/hermetic/run.mjs run --image sha256:...
node packages/starchess-arena/hermetic/run.mjs run --image sha256:... -- code scripts/example-test.ts argument
node packages/starchess-arena/hermetic/run.mjs export --image sha256:...
```

`preflight` supports the dependency image and the final source image.
The dependency preflight executes TypeScript and Vitest probes under the container policy.
The source preflight recomputes source, installed-tree, tool-tree, and frozen-store hashes.
`run` requires the final source image.
`build --from-dependencies` freezes source on the prepared dependency image without running acquisition stages.
The CLI validates the dependency image's lock and tools and creates an image-ID-derived local build tag.
The package manifests and `hermetic/` snapshot must match the prepared image exactly.
It verifies that tag's inspected image ID before building.
It supplies `--network=none` and verifies that the resulting dependency artifact manifest stayed unchanged.
`build --dependencies --from-dependencies` validates dependency-image reuse without capturing source.
`code` executes a captured repository-relative `.ts` file through the installed arena `tsx` binary.
The CLI passes arguments directly to executables.

Every command creates an evidence directory under `/tmp/opencode/starchess-hermetic-*`.
`run` and `preflight` accept `--out /absolute/empty-directory`.
The output directory must have a real existing parent.
An ancestor of that parent must belong to the host user and grant no group or other permissions (mode 0700).
The default command work directory supplies that private ancestor.
The CLI rejects commas, carriage returns, and newlines in output paths.
The CLI makes the dedicated output directory writable by UID 10001.

`export` writes `image.tar`, `image.tar.sha256`, and `export.json` outside the workspace.
Import the archive with `docker image load --input /tmp/opencode/.../image.tar`.
Verify `image.tar.sha256` before importing.
Use the image ID recorded in `export.json` after importing.

## Pins and dependency stages

`pins.json` records the official Node 22.23.2 bookworm-slim index and Linux/amd64 manifest digests.
The Dockerfile uses the platform manifest digest.
`acquire-tool.mjs` verifies pnpm 10.33.0's exact registry tarball against SHA-512 integrity and SHA-256.
The image retains that tarball and its expanded tool tree.

`context.mjs` creates a dedicated allowlisted Docker context.
The acquisition workspace contains only the core and arena manifests and the original unmodified lockfile.
The acquisition workspace omits a root package manifest.
The acquisition workspace retains `workspace:*` and allows esbuild's dependency build.
The final source capture restores the original root manifest and workspace configuration.

The acquisition stage starts a fresh `/pnpm/store` and disables lifecycle scripts.
The clean dependency stage copies only that store and the acquisition manifests.
The dependency stage installs development dependencies with `--offline --frozen-lockfile` inside `RUN --network=none`.
The dependency stage executes the esbuild postinstall without networking.
`closure.mjs` checks every direct dependency, the arena→core workspace link, TypeScript, Vitest, and esbuild transformation.
It rejects installed Nx, Storybook, workerd, and wrangler packages.
It verifies that installation preserved the captured lockfile and package manifests.
The image retains `/pnpm/store` as an immutable artifact.

## Source capture and manifests

The final capture includes:

- The complete core and arena package trees, including tests and fixtures.
- The arena `hermetic/` infrastructure and all repository `scripts/`.
- Root `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml`.
- The pinned corpus JSON selected by `_spec/corpora/ml-adjutant-corpus.manifest.json`.
- All `_spec/corpora/` files.
- Immutable Phase1 `baseline-report.json` and `verification.json` under `_spec/evidence/ml-adjutant-phase1/`.
- Present optional root runtime configs listed in `context.mjs`.

The capture records absent optional configs explicitly.
Package-manager overrides require context review before capture.
The capture excludes host `node_modules`, stores, Git metadata, generated caches, coverage, and build outputs.
The capture rejects symlinks, special files, and secret-bearing filenames in allowlisted trees.
It validates every ancestor and canonical repository containment before reading or copying host inputs.
It parses TypeScript configs with the arena's existing TypeScript JSONC parser.
It captures recursive relative `extends` targets at their repository paths.
It rejects missing, ambiguous, cyclic, external, and symlinked config targets.
The root environment and unrelated workspace packages never enter the context.

`/hermetic-evidence/dependencies.json` records installed-tree, tool-tree, and frozen-store entries.
`/hermetic-evidence/source.json` records captured source and test entries.
Entries include relative paths, modes, file lengths, SHA-256, and symlink targets.
Group hashes use SHA-256 over ordered JSON entries.
The source manifest excludes every `node_modules` tree and the writable Phase2 output path.
The manifests live outside `/app` and outside their own inventoried roots.
`capture.json` records the allowlist snapshot and acquisition configuration.
The build compares the image source manifest with the allowlisted snapshot.
The Docker image ID lives only in the external assurance envelope.

## Runtime policy

The runner creates a container and inspects its policy before starting it.
It records the initial and final Docker inspection in `execution.json`.
It verifies the inspected bind source equals the validated output directory.

| Setting | Value |
| --- | --- |
| Image selection | Explicit image ID, `--pull=never`, Linux/amd64 |
| User | UID/GID `10001:10001` |
| Network | `none` |
| Root filesystem | Read-only |
| Privilege | `no-new-privileges=true`, all capabilities dropped |
| Resources | 2 CPUs, 4 GiB memory, 4 GiB memory+swap, 256 PIDs |
| Temporary filesystem | `/tmp`, 1 GiB, `nosuid,nodev`, mode 1777 |
| Writable bind mount | `/app/_spec/evidence/ml-adjutant-phase2` only |
| Init | Daemon-provided `docker-init` 0.19.0, Git commit `de40ad0` |

The assurance envelope records Docker, containerd, runc, and daemon-init versions.
The CLI verifies the daemon-init version and commit before execution.
The daemon supplies the init binary externally through `--init`.

HOME, PNPM_HOME, TMPDIR, and XDG cache/config/data directories point into `/tmp`.
Runtime preflight creates `/tmp/opencode` for isolated inventory and test fixtures.
The runner creates temporary Vitest configs with `/tmp` cache directories and `--configLoader native`.
It disables Vitest's persistent test cache.
It limits Vitest to two workers.
Runtime execution performs no dependency installation.

Each command retains separate stdout and stderr logs with an 8 MiB limit per stream.
The logger continues draining output after reaching the limit.
Command records include log paths, retained byte counts, observed byte counts, SHA-256, and truncation flags.
Failed commands retain partial logs.
The host prints concise command statuses.
Vitest also writes JSON reports whose actual test counts and hashes enter command records.
The Docker build and attached-container command retain bounded host logs alongside the external envelope.

## Phase2 integration contract

The lead must integrate `scripts/challenge-contract-evidence.ts` before the final image build.
The standard runner executes the following sequence:

1. Recompute and verify image artifact manifests.
2. Execute the complete baseline schedule with `--suite all --rerun`.
3. Require 54 baseline rows and 54 successful deterministic rerun comparisons.
4. Invoke `scripts/challenge-contract-evidence.ts` through arena's installed `tsx`, with no CLI arguments.
5. Require generated `contract-report.json`, `pin-migration.json`, and `coverage.json`.
6. Typecheck core and arena.
7. Strictly typecheck the integrity tests and both evidence scripts, then execute core and arena test suites.
8. Execute `evidence-bundle.test.mjs`, `image-measurement.test.mjs`, and `tar.test.mjs` through the pinned Node interpreter.
9. Recompute and compare immutable artifact manifests.
10. Publish `hermetic-verification-v2` with the exact eight successful command records and output artifact hashes.

The diagnostic receives `HERMETIC_OUTPUT_DIRECTORY=/app/_spec/evidence/ml-adjutant-phase2`.
It consumes the generated `baseline-report.json` at that path.
It writes contract, migration, and coverage artifacts into that path before the test suites run.
It must not publish `verification.json` before the runner completes its checks.
Tests may consume the diagnostic artifacts before the completion marker exists.
The runner records failures in `hermetic-failure.json`.
The runner makes generated evidence files host-readable after completion.
The immutable Phase1 evidence stays at its original image path.

The final image build and the exhaustive baseline execution belong to the lead's source-freeze handoff.

## Infrastructure verification

```sh
HERMETIC_DEPENDENCY_IMAGE=sha256:... node --test packages/starchess-arena/hermetic/infra.test.mjs
```

| Test file | Purpose |
| --- | --- |
| `infra.test.mjs` | Parse Dockerfile stage policy; preserve lock/workspace links; verify recursive JSONC capture and ancestor boundaries; reject public output parents and mount injection; validate bounded success/failure logs; execute the real restricted container. |
| `probe.mjs` | Verify restricted execution, fresh temporary inventory setup, isolated source-only inventory, offline TS/Vitest JSON counts, persisted command logs, and unchanged dependency/store/tool hashes. |

Run the suite with `HERMETIC_DEPENDENCY_IMAGE` to execute the Docker test.
Without that environment variable, the suite skips the Docker test.

## R0 evidence refresh

The host measures image files through bounded tar streams from an unstarted container.
It checks the Node interpreter against the binary SHA-256 measured from the digest-pinned official base.
It never executes image code to obtain trusted measurements.
The archive checker binds the config or OCI image ID and every positional uncompressed layer digest.

`evidence-limits.mjs` owns the approved limits: 16 MiB per input, 64 MiB retained evidence,
512 MiB archive, 2 GiB scan/expansion, 16 MiB metadata, 262144 entries, and 4096-byte paths.
The importer reads bounded descriptors, binds both Vitest reports to their commands,
and authoritatively validates all seven data inputs against a retained source capture.

Publish the refresh with the importer’s `--destination _spec/evidence/ml-adjutant-r0-refresh` option.
Keep the existing phase-2 bundle unchanged.
Publication uses exclusive creation and an atomically linked, hash-bound completion marker.
Readers require the marker and its complete inventory; marker presence does not prove crash durability.
Postcommit errors retain the bundle and report committed state.

In-image tests use `HERMETIC_OUTPUT_DIRECTORY` and require that generation’s files without fallback.
Import-test fixtures derive from pinned phase-1 rows and synthetic test-only tool reports.
They never read their enclosing suite’s unfinished Vitest output.
Local tests prefer the published R0 refresh; only exact byte-pinned historical inputs use historical mode.
The two live-pin assertions run on the fresh generation before R0 can close.
