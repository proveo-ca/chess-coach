# SPEC: _spec/runtime-inputs.md, _spec/reference-bundles.md
FROM docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb AS native
ENV CARGO_HOME=/capture/cargo-home CARGO_BUILD_JOBS=2 RAYON_NUM_THREADS=2
WORKDIR /build/native
COPY cargo-home/ /capture/cargo-home/
COPY current-native/ /build/native/
RUN --network=none cargo build --release --target x86_64-unknown-linux-gnu --locked --offline --jobs 2 --bin policy-score --bin policy-channel --bin policy-initialize

FROM docker.io/oven/bun@sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038 AS javascript
WORKDIR /build/current
COPY current-runtime/ /build/current/
COPY bun-cache/ /capture/bun-cache/
RUN --network=none bun --no-env-file install --frozen-lockfile --production --ignore-scripts --cache-dir=/capture/bun-cache
COPY reference-input/ /build/reference-input/
COPY builder-tools/ /build/builder-tools/
RUN --network=none bun --no-env-file --no-install /build/builder-tools/build-reference.ts /build/reference-input /build/reference-output

FROM docker.io/oven/bun@sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038
WORKDIR /app
COPY --from=javascript /build/current/ /app/
COPY --from=native /build/native/target/x86_64-unknown-linux-gnu/release/policy-score /usr/local/bin/policy-score
COPY --from=native /build/native/target/x86_64-unknown-linux-gnu/release/policy-channel /usr/local/bin/policy-channel
COPY --from=native /build/native/target/x86_64-unknown-linux-gnu/release/policy-initialize /usr/local/bin/policy-initialize
COPY --from=javascript /build/reference-output/packages/starchess-core/src/index.ts /app/reference/packages/starchess-core/src/index.ts
COPY --from=javascript /build/reference-output/packages/starchess-arena/src/challenge/r3Session.ts /app/reference/packages/starchess-arena/src/challenge/r3Session.ts
COPY --from=javascript /build/reference-output/packages/starchess-arena/src/challenge/admission.ts /app/reference/packages/starchess-arena/src/challenge/admission.ts
COPY --from=javascript /build/reference-output/packages/starchess-arena/src/run/bank.ts /app/reference/packages/starchess-arena/src/run/bank.ts
COPY --from=javascript /build/reference-output/packages/starchess-arena/src/players/strategic.ts /app/reference/packages/starchess-arena/src/players/strategic.ts
COPY --from=javascript /build/reference-output/packages/starchess-arena/src/challenge/corpus.ts /app/reference/packages/starchess-arena/src/challenge/corpus.ts
COPY --from=javascript /build/reference-input/_spec/corpora/ml-adjutant-corpus.manifest.json /app/reference/_spec/corpora/ml-adjutant-corpus.manifest.json
COPY --from=javascript /build/reference-input/starchess-match-history-20260929-203446.json /app/reference/starchess-match-history-20260929-203446.json
COPY --chmod=0555 init/tini-static-amd64 /sbin/chess-init
USER 1000:1000
ENTRYPOINT ["/sbin/chess-init", "-g", "--"]
CMD ["/usr/local/bin/bun", "--no-env-file", "--no-install", "/app/packages/runtime/src/job.ts"]
