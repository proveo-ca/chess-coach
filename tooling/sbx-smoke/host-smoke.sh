#!/usr/bin/env bash
set -euo pipefail

stop() { printf 'STOP: %s\n' "$*" >&2; exit 2; }

[[ $# == 3 || $# == 5 ]] || stop 'usage: host-smoke.sh --confirm-dev-shared-daemon --sbx ABSOLUTE_EXECUTABLE [--create-seconds 1..60]'
[[ $1 == --confirm-dev-shared-daemon && $2 == --sbx && $3 == /* && -f $3 && -x $3 ]] || stop 'explicit confirmation and absolute sbx executable required'
sbx=$3
create_seconds=60
if (( $# == 5 )); then
  [[ $4 == --create-seconds && $5 =~ ^([1-9]|[1-5][0-9]|60)$ ]] || stop 'create deadline must be 1..60 seconds'
  create_seconds=$5
fi
[[ -n ${HOME:-} ]] || stop 'HOME is required by sbx'
name="f9smoke-$(/usr/bin/od -An -N12 -tx1 /dev/urandom | /usr/bin/tr -d ' \n')"
[[ $name =~ ^f9smoke-[0-9a-f]{24}$ ]] || stop 'cannot generate smoke name'
owned=0
phase=preflight

listed() {
  local output line
  output=$(/usr/bin/timeout --kill-after=2s 8s "$sbx" ls -q) || return 2
  while IFS= read -r line; do
    [[ $line == "$name" ]] && return 0
  done <<< "$output"
  return 1
}

cleanup() {
  local result=$? listing_result
  trap - EXIT INT TERM
  if (( owned )); then
    trap 'printf "REMOVE_UNCONFIRMED_NAME=%s\n" "$name" >&2; exit 2' INT TERM
    if ! /usr/bin/timeout --kill-after=2s 60s "$sbx" rm --force "$name"; then
      printf 'REMOVE_UNCONFIRMED_NAME=%s\n' "$name" >&2
      exit 2
    fi
    if listed; then
      printf 'REMOVE_UNCONFIRMED_NAME=%s\n' "$name" >&2
      exit 2
    else
      listing_result=$?
      if (( listing_result != 1 )); then
        printf 'REMOVE_UNCONFIRMED_NAME=%s\n' "$name" >&2
        exit 2
      fi
    fi
    printf 'NAME_ABSENT_AFTER_RM=%s\n' "$name"
    if (( result == 0 )); then
      printf 'RESULT=DEV_SMOKE_ONLY\n'
    fi
  fi
  exit "$result"
}
trap cleanup EXIT
on_signal() {
  if (( ! owned )) && [[ $phase == creating || $phase == checking ]]; then
    printf 'CREATE_UNCONFIRMED_NAME=%s\n' "$name" >&2
  fi
  exit "$1"
}
trap 'on_signal 130' INT
trap 'on_signal 143' TERM

printf 'ATTEMPT_NAME=%s\n' "$name"
if listed; then
  stop 'smoke name already exists; no creation attempted'
else
  listing_result=$?
  (( listing_result == 1 )) || stop 'cannot confirm name is absent; no creation attempted'
fi

phase=creating
if ! /usr/bin/timeout --kill-after=2s "${create_seconds}s" "$sbx" create --name "$name" --pull never --skills off --deny-network '**' --cpus 1 --memory 512m shell; then
  printf 'CREATE_UNCONFIRMED_NAME=%s\n' "$name" >&2
  exit 2
fi
phase=checking
if listed; then
  owned=1
  phase=owned
else
  printf 'OWNERSHIP_UNCONFIRMED_NAME=%s\n' "$name" >&2
  exit 2
fi
if ! /usr/bin/timeout --kill-after=2s 15s "$sbx" exec "$name" /bin/true; then
  printf 'EXEC_FAILED_NAME=%s\n' "$name" >&2
  exit 2
fi
