# SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
ARG FROZEN_DEPENDENCIES=dependencies
FROM docker.io/library/node:22.23.2-bookworm-slim@sha256:43aeff40f4afc22e83f7589a2f37e111cff5ca84529571f1c8415bcc5fcc21b2 AS tools
COPY hermetic/ /hermetic/
RUN node /hermetic/acquire-tool.mjs
ENV PATH="/opt/pnpm/bin:${PATH}" CI=true PNPM_HOME=/tmp/pnpm HOME=/tmp/home XDG_CACHE_HOME=/tmp/cache XDG_CONFIG_HOME=/tmp/config XDG_DATA_HOME=/tmp/data TMPDIR=/tmp npm_config_update_notifier=false
RUN --network=none node /hermetic/closure.mjs tools

FROM tools AS acquisition
WORKDIR /app
COPY deps/ /app/
RUN pnpm --filter @chess-coach/starchess-training... install --frozen-lockfile --ignore-scripts --store-dir /pnpm/store --config.side-effects-cache=false

FROM tools AS dependencies
WORKDIR /app
COPY deps/ /app/
COPY --from=acquisition /pnpm/store/ /pnpm/store/
COPY capture.json /hermetic-evidence/capture.json
RUN --network=none pnpm --filter @chess-coach/starchess-training... install --offline --frozen-lockfile --store-dir /pnpm/store --config.side-effects-cache=false
RUN --network=none node /hermetic/closure.mjs record && node /hermetic/manifest.mjs dependencies

FROM ${FROZEN_DEPENDENCIES} AS frozen

FROM frozen AS runtime
COPY runtime/ /app/
COPY capture.json /hermetic-evidence/capture.json
RUN --network=none mkdir -p /app/_spec/evidence/ml-adjutant-r2-refresh && node /hermetic/manifest.mjs source && node /hermetic/closure.mjs dependencies
USER 10001:10001
WORKDIR /app
ENTRYPOINT ["node", "/app/packages/starchess-arena/hermetic/runtime.mjs"]
CMD ["verify"]
