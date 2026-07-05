#!/usr/bin/env bash
# E2E_TARGET=android web server: serves exactly what the Android APK embeds.
#
# Mirrors the Gradle buildWeb → syncWeb pipeline for the default
# webTarget=web-no-llm (apps/android/app/build.gradle.kts), then serves the
# synced webroot with the SAME Go static host the APK uses (thinserver via
# cmd/devserver): the //go:embed'ed files, COOP/COEP headers, /chess/ base
# path, and SPA fallback all come from apps/android/gomobile/thinserver.
#
# PORT (set by apps/e2e/target.ts) pins the devserver's listen port.
set -euo pipefail
cd "$(dirname "$0")"

(cd ../ui && npm run build:web-no-llm)

# Gradle syncWeb equivalent: mirror dist → webroot, minus WebLLM's model
# runtime (dead weight without WebLLM); keep webroot's tracked files.
rsync -a --delete \
  --exclude=models --exclude=.gitignore --exclude=placeholder.html \
  ../ui/dist/chess/ ../android/gomobile/thinserver/webroot/

# share.spec.ts imports the app's real share encoder in-page (SHARE_MODULE in
# target.ts). Vite targets serve it as a source module; this production build
# doesn't, so bundle the same source into the webroot. E2e-only artifact: the
# next gradle syncWeb (or this rsync --delete) drops it from the webroot.
(cd ../ui && node_modules/.bin/esbuild src/services/gameShare.ts \
  --bundle --format=esm --alias:~=./src \
  --define:import.meta.env.BASE_URL='"/chess/"' \
  --outfile=../android/gomobile/thinserver/webroot/e2e-gameShare.js)

cd ../android/gomobile
exec go run ./cmd/devserver
