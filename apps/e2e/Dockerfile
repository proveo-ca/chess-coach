# Playwright e2e image — browsers ship in the base image (no `npx playwright install`).
# Default target is standalone StarChess (`E2E_TARGET=starchess`): vite from apps/starchess.
# Classical Coach (`web-no-llm`) still installs apps/ui for e2e-full / overrides.
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /work

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages packages
# Workspace install covers starchess + starchess-core. e2e still uses its own npm lock
# for @playwright/test (kept for host `npm test --prefix apps/e2e` parity).
COPY apps/e2e/package.json apps/e2e/package-lock.json* apps/e2e/
COPY apps/starchess/package.json apps/starchess/
COPY apps/ui/package.json apps/ui/package-lock.json* apps/ui/

RUN pnpm install --frozen-lockfile --filter @chess-coach/starchess... \
  && cd apps/e2e && npm install \
  && cd ../ui && npm install

COPY packages packages
COPY apps/e2e apps/e2e
COPY apps/starchess apps/starchess
COPY apps/ui apps/ui

WORKDIR /work/apps/e2e

ENV E2E_TARGET=starchess
ENV CI=1

# StarChess-focused chromium smoke. Override for classical Coach:
#   docker compose run --rm -e E2E_TARGET=web-no-llm e2e npx playwright test --project=chromium
CMD ["npx", "playwright", "test", "tests/starchess-queue.spec.ts", "tests/starchess-exceptions.spec.ts", "tests/starchess-promotion.spec.ts", "tests/starchess-gas-used.spec.ts", "tests/starchess-gas-step.spec.ts", "--project=chromium"]
