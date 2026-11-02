#!/usr/bin/env bash
set -euo pipefail

stop() { printf 'STOP: %s\n' "$*" >&2; exit 2; }
[[ $# == 2 && $1 == --sbx ]] || stop 'usage: create.sh --sbx ABSOLUTE_EXECUTABLE'
[[ $2 == /* && -f $2 && -x $2 && ! -L $2 ]] || stop 'sbx path must be an existing absolute, regular, executable file (not a symlink)'
sbx=$2
name="devrust-$(/usr/bin/od -An -N12 -tx1 /dev/urandom | /usr/bin/tr -d ' \n')"
[[ $name =~ ^devrust-[0-9a-f]{24}$ ]] || stop 'name generation failed'

listed() {
  local output line
  output=$(/usr/bin/timeout --kill-after=2s 10s "$sbx" ls -q | /usr/bin/head -c 65537) || return 2
  (( ${#output} <= 65536 )) || return 2
  while IFS= read -r line; do
    [[ $line == "$name" ]] && return 0
  done <<< "$output"
  return 1
}

if listed; then
  stop 'generated name already exists'
else
  rc=$?
  (( rc == 1 )) || stop 'cannot establish name absence'
fi

printf 'ATTEMPT_NAME=%s\n' "$name"
if ! /usr/bin/timeout --kill-after=2s 90s "$sbx" create --name "$name" \
  --pull never --skills off --deny-network '**' --cpus 2 --memory 4g shell; then
  printf 'CREATE_UNCONFIRMED_NAME=%s\n' "$name" >&2
  exit 2
fi

if listed; then
  printf 'DEV_CREATED_NAME=%s\nRESULT=DEV_ONLY_CREATED\n' "$name"
else
  printf 'OWNERSHIP_UNCONFIRMED_NAME=%s\n' "$name" >&2
  exit 2
fi
