#!/usr/bin/env bash
set -euo pipefail

stop() { printf 'STOP: %s\n' "$1" >&2; exit 2; }

if [[ ${1:-} == --offline-check ]]; then
  [[ $# == 7 && $2 == --inputs && $4 == --trust-record && $6 == --expected-record-sha256 ]] || stop 'invalid offline check arguments'
  [[ $3 == /* && $5 == /* && $7 =~ ^[0-9a-f]{64}$ ]] || stop 'invalid offline check paths or pin'
  [[ $0 == /* && ! -L $0 ]] || stop 'use an absolute non-symlinked offline guard'
  exec /usr/bin/python3 "${0%/*}/host-sbx-provenance-candidate.py" --offline-only --inputs "$3" --trust-record "$5" --expected-record-sha256 "$7"
fi

[[ $# == 12 ]] || stop 'expected six fixed option/value pairs'
[[ $1 == --inputs && $3 == --evidence && $5 == --preflight && $7 == --verifier && $9 == --patch && ${11} == --filter ]] || stop 'unexpected option order'
for value in "$2" "$4" "$6" "$8" "${10}"; do
  [[ $value == /* ]] || stop 'paths must be absolute'
done
[[ ${12} == 'exec.exec_test_original_custody*' ]] || stop 'unexpected KUnit filter'

stop 'offline candidate: no approved guard, provenance, dedicated service or host quotas'
