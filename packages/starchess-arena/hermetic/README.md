# Hermetic R2 execution image — WIP

SPEC: `_spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml`

Run the CLI from any directory with Node supporting ESM JSON import attributes.
Use the returned immutable `sha256:…` image ID for every subsequent command.

## Commands

```sh
node packages/starchess-arena/hermetic/run.mjs build --dependencies --no-cache
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
`--no-cache` is a build-only boolean flag that adds Docker's `--no-cache` argument.
Omit the flag to retain Docker's default build-cache behavior.
The CLI rejects duplicate options, boolean values such as `--no-cache=true`, and options that do not apply to the selected command.
Fresh dependency acquisition requires `build --dependencies --no-cache` after freezing source and controls.
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
The acquisition workspace contains the core, arena, and training manifests and the unmodified lockfile.
The acquisition workspace omits a root package manifest.
The acquisition workspace retains `workspace:*` and allows esbuild's dependency build.
The final source capture restores the original root manifest and workspace configuration.

The acquisition stage starts a fresh `/pnpm/store` and disables lifecycle scripts.
The clean dependency stage copies only that store and the acquisition manifests.
The dependency stage installs development dependencies with `--offline --frozen-lockfile` inside `RUN --network=none`.
The dependency stage executes the esbuild postinstall without networking.
`closure.mjs` checks every direct dependency, each selected name→manifest workspace link, TypeScript, Vitest, and esbuild transformation.
`workspace-policy.mjs` closes acquisition, installed roots, capture inputs, and measurement to the same three packages.
Training declares exact `@noble/hashes` 2.4.0.
It rejects installed Nx, Storybook, workerd, and wrangler packages.
It verifies that installation preserved the captured lockfile and package manifests.
The image retains `/pnpm/store` as an immutable artifact.

## Source capture and manifests

The final capture includes:

- The complete core, arena, and training package trees, including tests and fixtures.
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
Every copied directory and intermediate context directory has mode `0755`, including under host umask `077`.
Context preparation preserves the scratch root's private mode.
The root environment and unrelated workspace packages never enter the context.

`/hermetic-evidence/dependencies.json` records installed-tree, tool-tree, and frozen-store entries.
`/hermetic-evidence/source.json` records captured source and test entries.
Entries include relative paths, modes, file lengths, SHA-256, and symlink targets.
Group hashes use SHA-256 over ordered JSON entries.
The source manifest excludes every `node_modules` tree and the writable R2 output path.
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
| Writable bind mount | `/app/_spec/evidence/ml-adjutant-r2-refresh` only |
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

## R2 integration contract

The lead must integrate `scripts/challenge-contract-evidence.ts` before the final image build.
`verification-plan.mjs` freezes exactly eleven executable/cwd/argv records:

1. Execute the complete baseline schedule with `--suite all --rerun`; require 54 rows and 54 equal semantic reruns.
2. Produce baseline migration, original coverage, contract, and `r2-composition-report.json` through arena's installed `tsx`.
3. Typecheck core.
4. Typecheck arena.
5. Typecheck training, including its tests.
6. Strictly typecheck every core/arena test and fixture plus both evidence scripts.
7. Run the full core Vitest suite with JSON output.
8. Run the full arena Vitest suite with JSON output.
9. Run the full training Vitest suite with JSON output.
10. Run the three Node suites: evidence bundle, image measurement, and tar.
11. Run `node scripts/check-public-closure.mjs`; retain its exact stdout as `public-closure-report.json`.

The runner compares source/dependency/tool manifests before and after execution.
It emits `hermetic-verification-v3` with versioned assertion floors only after every command succeeds.
The importer independently recounts all three Vitest reports.
The lead must freeze floors from actual full-suite results before the final image build.

The diagnostic receives `HERMETIC_OUTPUT_DIRECTORY=/app/_spec/evidence/ml-adjutant-r2-refresh`.
It consumes the generated `baseline-report.json` at that path.
It writes contract, migration, original coverage, and R2 composition artifacts before the test suites run.
The R2 diagnostic observes fixed host SCFEN fixtures for both seats.
It records primitive versus retained membership, quotas, attempts, and actual omissions.
It implements no learned policy, training run, model weights, or winning-coverage claim.
It must not publish `verification.json` before the runner completes its checks.
Tests may consume the diagnostic artifacts before the completion marker exists.
The runner records failures in `hermetic-failure.json`.
The runner makes generated evidence files host-readable after completion.
The immutable Phase1 evidence stays at its original image path.

The final image build and the exhaustive baseline execution belong to the lead's source-freeze handoff.

## Infrastructure verification

```sh
node scripts/challenge-infrastructure-evidence.mjs --image sha256:...
```

Use the immutable dependency image ID returned by `build --dependencies --no-cache`.
This mandatory capture runs all six infrastructure tests, including the real Docker probe.
It returns the path to an `infrastructure.json` envelope with version `r2-infrastructure-verification-v1`.
The envelope binds the dependency image measurements, control snapshot, host runtime, exact command, bounded logs, six-test TAP recount, probe artifacts, and container inspections.
Retain that path for the importer's mandatory `--infrastructure` argument.

| Test file | Purpose |
| --- | --- |
| `infra.test.mjs` | Parse Dockerfile stage policy; preserve lock/workspace links; verify recursive JSONC capture, `0755` directories under umask `077`, and ancestor boundaries; reject malformed CLI options, public output parents, and mount injection; validate bounded success/failure logs; execute the real restricted container. |
| `probe.mjs` | Verify restricted execution, fresh temporary inventory setup, isolated source-only inventory, offline TS/Vitest JSON counts, persisted command logs, and unchanged dependency/store/tool hashes. |

The capture supplies `HERMETIC_DEPENDENCY_IMAGE` to execute the Docker test.
For direct diagnostics, run `HERMETIC_DEPENDENCY_IMAGE=sha256:... node --test packages/starchess-arena/hermetic/infra.test.mjs`.
Without that environment variable, the direct suite's Docker test fails.
Direct test output does not replace the mandatory infrastructure envelope.
Run this host/daemon suite separately from the eleven restricted-container commands.

## Fresh R2 evidence publication

The host measures image files through bounded tar streams from an unstarted container.
It checks the Node interpreter against the binary SHA-256 measured from the digest-pinned official base.
It never executes image code to obtain trusted measurements.
The archive checker binds the config or OCI image ID and every positional uncompressed layer digest.

`evidence-limits.mjs` owns the approved limits: 16 MiB per input, 64 MiB retained evidence,
512 MiB archive, 2 GiB scan/expansion, 16 MiB metadata, 262144 entries, and 4096-byte paths.
The importer reads bounded descriptors and binds all three Vitest reports to their commands.
The validator requires exactly eight arguments:
`[baseline, original, originalVerification, migration, coverage, contract, r2report, frozenRoot]`.
It replays original/current baseline semantics and independently remeasures original coverage and R2 composition.
The importer binds command 11 stdout to its standalone report and remeasures the public graph with trusted host code.

Publish the refresh with the importer’s `--destination _spec/evidence/ml-adjutant-r2-refresh` option.
Supply the mandatory host infrastructure envelope alongside the source-image execution, build, and export envelopes:

```sh
node scripts/challenge-import-evidence.mjs \
  --execution /tmp/opencode/.../execution.json \
  --build /tmp/opencode/.../build.json \
  --export /tmp/opencode/.../export.json \
  --infrastructure /tmp/opencode/challenge-infrastructure-.../infrastructure.json \
  --image sha256:... \
  --destination _spec/evidence/ml-adjutant-r2-refresh
```

Use the final source image ID for `--image` in this import command.
The importer remeasures the dependency image and requires all six named infrastructure tests to pass without skipped or omitted tests.
Keep the existing phase-2 bundle unchanged.
Publication uses exclusive creation and an atomically linked, hash-bound completion marker.
Readers require the marker and its complete inventory; marker presence does not prove crash durability.
Postcommit errors retain the bundle and report committed state.

In-image tests use `HERMETIC_OUTPUT_DIRECTORY` and require that generation’s files without fallback.
Import-test fixtures derive from pinned phase-1 rows and synthetic test-only tool reports.
They never read their enclosing suite’s unfinished Vitest output.
Local tests prefer a marker-validated published R2 refresh.
Otherwise they read only the four byte-locked Phase2 historical JSON files.
Recovered R0 markers, absent logs, old image IDs, and old review verdicts supply no current authorization.
Live-pin assertions require actual v3 pins in the fresh generation.
Historical v1 inventory/v2 pins remain explicitly typed read-only history.
Status remains WIP until the lead completes the fresh image build, eleven-command run, host infrastructure probe, independent image/archive measurement, publication, and reviews.

## Previous host checks and current lead handoff

Previous full host Vitest runs measured core **469**, arena **811**, and training **50** passing assertions.
`r2-assertion-floors-v1` records those floors in `verification-plan.mjs`.
These host runs do not constitute the frozen-image eleven-command proof.
Previous checks recorded passing package typechecks and focused strict checks for the owned verification tests, bridge tests, and both scripts.
Previous runs recorded **109** passing tests across the three Node suites and five passing static infrastructure tests.
Those historical results do not establish current verification results.
The host Docker probe requires a freshly built dependency image.

The native owner fixed command 6's previously recorded **19 type errors in ten core-owned test files**:
`adjutant.test.ts`, `ai/charonHunt.test.ts`, `collision/collisionRaces.test.ts`,
`gas/marineGasStackOrder.test.ts`, `packed.test.ts`, `planningOrder.test.ts`,
`replay/record.test.ts`, `strategic/economy.test.ts`, `strategic/economyAllyCrush.test.ts`,
and `strategic/orchestrator.test.ts`, all under `packages/starchess-core/src/__tests__/`.
Those fixture typing fixes do not establish the current full strict-invoice result.
The full strict invoice retains every core/arena TypeScript test and fixture.
It enables `allowImportingTsExtensions` for existing native test imports.

Execute the current command-6 invoice from the repository root with the installed arena TypeScript binary:

```sh
node --input-type=module <<'NODE'
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { verificationCommands } from './packages/starchess-arena/hermetic/verification-plan.mjs';
const root = process.cwd();
const command = verificationCommands(root)[5];
const local = (value) => value.startsWith('/app/') ? resolve(root, value.slice(5)) : value;
execFileSync(local(command.executable), command.args.map(local), {
  cwd: local(command.cwd), stdio: 'inherit',
});
NODE
```

This derives the full current invoice and flags from `verification-plan.mjs` instead of substituting a focused file list.
Record the actual exit status and diagnostics before source freeze.

Freeze source and controls before dependency acquisition.
Build and measure the fresh dependency image with `build --dependencies --no-cache`.
Capture the mandatory `r2-infrastructure-verification-v1` envelope with its immutable dependency image ID and all six tests.
Build the fresh source image from those exact dependency/control bytes.
Run all eleven commands under the restricted policy.
Export and independently validate the image archive.
Import into the new R2 namespace with mandatory `--infrastructure`, complete logs, and marker-bound artifacts.
Complete adversarial, security, and spec review before declaring closure.
