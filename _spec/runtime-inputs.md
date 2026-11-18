# C5 official Bun runtime-input proposal

Status: DESIGN FAMILY SELECTED / IMMUTABLE CANDIDATES IDENTIFIED / NOT GATE0 ACCEPTED.

Executor selected `Official Bun base (Recommended)` in the C5 question.
The question explicitly authorized no Docker, capture/build or runtime execution.
This proposal used public documentation, registry JSON metadata and the upstream init checksum text only.
It reused no C3 or earlier operational grant.

## Independently selected candidate roles

[runtime-inputs.json](runtime-inputs.json) records exact candidate index, Linux/amd64 manifest and configuration identities.
Use the platform manifest, not a mutable tag, in the eventual recipe.
The selected roles are:

| Role | Candidate |
|---|---|
| Final application base | `docker.io/oven/bun@sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038` |
| Build-only Rust toolchain | `docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb` |
| Image-contained init | Tini `v0.19.0`, `tini-static-amd64`, upstream-published SHA-256 `c5b0666b4cb676901f90dfcb37106783c5fe2077b04590973b885950611b30ee` |

The Bun configuration labels identify version `1.4.0` and revision `34cbb9a40b4bd1bd767d134a7065e66c2432a676`.
Its configuration history identifies a Debian `trixie` base.
The selected Rust builder's upstream Dockerfile sets `RUST_VERSION=1.95.0` on `buildpack-deps:bookworm`.
These are metadata/source observations, not executed version checks or proof that the builder's native outputs fit the final base.
Do not infer GNU/native-library compatibility or an effective runtime closure from those labels.

The retained metadata evidence is `/tmp/opencode/chess-coach-ii-runtime-metadata-4wh3ycgc/`.
It contains raw selected indices, platform manifests, configuration JSON, published checksum text, SHA-256 receipts and `result.json`.
The bounded metadata collection completed in 2,785.464 ms.
Local SHA-256 checks matched both selected index digests, both platform manifest digests and both referenced configuration digests.
No image layer or executable was fetched.
The Tini value is its published checksum, not a hash of a locally captured executable.
GitHub's release metadata declared an 870,496-byte executable; that size was not checked against executable bytes.

## Standard recipe proposal

The following stages define the intended recipe rather than an executable or accepted build packet.
The native coordinator/reference/learner/supervisor source exists with synthetic fixtures.
Whole-match/Burn/SQL completion now passes a separate-process synthetic fixture.
Final captured mixed/native/control-plane closure and actual registration remain unfinished.
Do not build a partial image or replace missing outputs with stubs.

1. Freeze current source, tests, lockfiles, feature layout, reference closure and recipe roles independently before capture/build requests.
2. Under a separate exact capture grant, acquire only the selected immutable image layers, the selected Tini asset, the locked public Cargo/npm inputs and the selected reference rules closure.
3. Verify captured Tini length and SHA-256 against the independent selected expectation before allowing it into a build context.
4. Use the pinned Rust image only as a standard Cargo builder.
5. Populate its fresh anonymous dependency store through the separately approved locked capture, then use `cargo build --release --target x86_64-unknown-linux-gnu --locked --offline --jobs 2 --bin policy-score --bin policy-channel --bin policy-initialize` with build-stage networking disabled.
6. Use the pinned Bun image to install the exact workspace production graph with `bun --no-env-file install --frozen-lockfile --production --ignore-scripts --cache-dir=/capture/bun-cache` from the newly captured anonymous locked-input cache, with build-stage networking disabled through supported `RUN --network=none`.
7. Build the final stage from the pinned Bun platform manifest, not from the builder.
8. Build C14's six reference bundles through the pinned standard Bun CLI from independently captured selected old source/package inputs; copy only registered application source/manifests, production dependencies, reference bundles/corpus, three native executables, required native libraries and checked init into fixed read-only paths.
9. Override the base entrypoint with `ENTRYPOINT ["/sbin/chess-init", "-g", "--"]` and a fixed Bun coordinator command with `--no-env-file --no-install`.
10. Select numeric nonroot `USER 1000:1000` and `/app` as the fixed work directory.
11. Register the actual built image/config, init, Bun, native libraries, application/reference entrypoints and scorer outputs before selecting qualification.

Do not use daemon-injected `--init` under C1.
Tini's documented `-g` option forwards signals to its child's process group.
The outside supervisor must still stop the complete admitted job and verify descendant/cgroup disappearance.
Tini is not a substitute for that verification.
Do not remap nonzero exits to success or include a shell launcher that obscures the owned direct child.

The current standard lockfile installation path must demonstrate a complete offline production closure during its separately authorized capture/build verification.
It may not silently fetch missing inputs during the offline build or qualified runtime.
The installed Bun 1.4.0 `install --help` lists the selected frozen-lockfile, production, ignore-scripts and cache-directory controls but exposes no offline-install flag.
Do not invent an `--offline` option or rely on preference-only caching.
The supported build network boundary must reject missing cache entries instead of allowing a network fetch.
The captured build cache is a new independently inventoried public-dependency input, not a mount of a user home or broad development cache.
The final runtime contains no dependency cache or build toolchain.
The native-library copy list must come from the actual supported build and loading audit.
No guessed library list, unregistered fallback image or development Zig/Cargo cache enters the final runtime.

## Remaining acceptance and authorization boundaries

- Independently register the final current source/recipe/reference inputs after implementation and audits finish.
- Complete the selected Cargo/build-script/proc-macro/native and TypeScript runtime/type/reexport closure audits.
- Complete runtime-owned native/reference and policy/learner protocol source/tests.
- Fix output/storage/inode/FD limits and the supported observation of whole-job absence.
- Obtain operator-approved CPU-set IDs/effective CPU placement where required; C2's quota does not supply affinity.
- Select and audit the control-plane interpreter/supervisor closure.
- Obtain Executor's acceptance of the complete exact Gate0 packet.
- Request fresh exact capture/build, output registration, runtime qualification and native proof grants in their prescribed order.

C5 does not close Gate0, F9 or R4.
The existing 24 GB / 12-thread aggregate host ceiling and C2 Headroom job design remain unchanged.
No capacity/fit or enforcement claim follows from artifact metadata.
Keep `trainingReady:false`.

`tooling/runtime/Dockerfile` now persists the unexecuted multi-stage recipe.
[gate0-packet.md](gate0-packet.md) defines its exact context roles and pre-build output-registration method.
[reference-bundles.md](reference-bundles.md) records C14's explicit handling of the old pnpm-locked reference instead of pretending it shares the current Bun lockfile.

## Official sources

- [Bun Docker guide](https://bun.sh/guides/ecosystem/docker): official `oven/bun` image, standard multi-stage structure and nonroot usage.
- [Bun image tags](https://hub.docker.com/r/oven/bun/tags): discovery only; the selected proposal uses immutable registry manifests.
- [Rust builder Dockerfile at the selected upstream revision](https://raw.githubusercontent.com/rust-lang/docker-rust/dd106de2954f52f336c3d2c1326ae778c51830f3/stable/bookworm/Dockerfile): standard Rust 1.95.0 builder recipe.
- [Tini v0.19.0 release](https://github.com/krallin/tini/releases/tag/v0.19.0): selected static asset and published checksum.
- [Tini v0.19.0 documentation](https://github.com/krallin/tini/blob/v0.19.0/README.md): PID 1, direct child exit propagation, signal forwarding and process-group behavior.
