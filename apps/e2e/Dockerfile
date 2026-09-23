FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /work
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages packages
COPY apps/e2e/package.json apps/e2e/
COPY apps/starchess/package.json apps/starchess/
COPY apps/chess/package.json apps/chess/

RUN pnpm install --frozen-lockfile --filter chess-coach-e2e --filter chess-coach-ui... --filter @chess-coach/starchess...

COPY apps/e2e apps/e2e
COPY apps/starchess apps/starchess
COPY apps/chess apps/chess

WORKDIR /work/apps/e2e
ENV E2E_TARGET=web-no-llm
ENV CI=1
CMD ["pnpm", "exec", "playwright", "test"]
