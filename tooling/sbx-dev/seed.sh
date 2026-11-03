#!/usr/bin/env bash
# SPEC: _spec/tooling/bun-first-party-tooling.puml, _spec/tooling/sbx-dev/preparation-workflow.puml
set -euo pipefail
printf 'STOP: combined seed is disabled; use dev:sbx:prepare or the separate provision/install tasks with workflow state.\n' >&2
exit 2
