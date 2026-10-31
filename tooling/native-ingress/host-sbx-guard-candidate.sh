#!/usr/bin/env bash
set -euo pipefail

stop() { printf 'STOP: %s\n' "$1" >&2; exit 2; }

[[ $# == 12 ]] || stop 'expected six fixed option/value pairs'
[[ $1 == --inputs && $3 == --evidence && $5 == --preflight && $7 == --verifier && $9 == --patch && ${11} == --filter ]] || stop 'unexpected option order'
for value in "$2" "$4" "$6" "$8" "${10}"; do
  [[ $value == /* ]] || stop 'paths must be absolute'
done
[[ ${12} == 'exec.exec_test_original_custody*' ]] || stop 'unexpected KUnit filter'

stop 'offline candidate: no approved guard, provenance, dedicated service or host quotas'
