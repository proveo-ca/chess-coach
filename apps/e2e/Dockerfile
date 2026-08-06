# Playwright e2e image — browsers ship in the base image (no `npx playwright install`).
# webServer starts vite from ../ui (`npm run dev:web-no-llm:vite`), so UI deps are installed too.
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /work

COPY apps/e2e/package.json apps/e2e/package-lock.json* apps/e2e/
COPY apps/ui/package.json apps/ui/package-lock.json* apps/ui/

RUN cd apps/e2e && npm install && cd ../ui && npm install

# Vite aliases @chess-coach/engine-core → packages/engine-core/src
COPY packages packages
COPY apps/e2e apps/e2e
COPY apps/ui apps/ui

WORKDIR /work/apps/e2e

ENV E2E_TARGET=web-no-llm
ENV CI=1

# StarChess-focused web smoke (chromium). Override for the full suite:
#   docker compose run --rm e2e npx playwright test --project=chromium
CMD ["npx", "playwright", "test", "tests/starchess-queue.spec.ts", "tests/starchess-exceptions.spec.ts", "tests/starchess-promotion.spec.ts", "--project=chromium"]
