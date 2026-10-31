#!/usr/bin/env bash
set -euo pipefail

die() { printf 'STOP: %s\n' "$*" >&2; exit 1; }
pin() {
  local name=$1 path=${!1:-} expected=${!2:-} actual part owner mode
  [[ $path == /* && -f $path && -x $path && ! -L $path ]] || die "set $name to an absolute, reviewed executable"
  [[ $(realpath -e -- "$path") == "$path" ]] || die "$name path contains a symlink"
  part=$path
  while :; do
    owner=$(stat -c %u -- "$part") || die "cannot inspect $name path"
    mode=$(stat -c %a -- "$part") || die "cannot inspect $name permissions"
    [[ $owner == 0 && $mode =~ ^[0-7]+$ ]] || die "$name must be installed under root-owned directories"
    (( (8#$mode & 0022) == 0 )) || die "$name path is group/world writable"
    [[ $part == / ]] && break
    part=$(dirname -- "$part")
  done
  [[ $expected =~ ^[[:xdigit:]]{64}$ ]] || die "set independently registered $2"
  actual=$(sha256sum "$path") || die "cannot hash $name"
  [[ ${actual%% *} == "$expected" ]] || die "$name digest mismatch"
}

[[ $# == 2 ]] || die 'usage: host-sbx-kunit.sh ABSOLUTE_INPUT_DIRECTORY ABSOLUTE_EVIDENCE_DIRECTORY'
[[ $1 == /* && $2 == /* && -d $1 && -d $2 && ! -L $1 && ! -L $2 ]] || die 'use existing absolute input/evidence directories without symlinks'
inputs=$(realpath -e -- "$1")
evidence=$(realpath -e -- "$2")
[[ $inputs != "$evidence" ]] || die 'input and evidence directories must differ'
pin F9_PROVENANCE_VERIFIER F9_PROVENANCE_VERIFIER_SHA256
pin F9_HOST_GUARD F9_HOST_GUARD_SHA256
[[ ${F9_HOST_PREFLIGHT_SHA256:-} =~ ^[[:xdigit:]]{64}$ ]] || die 'set independently registered F9_HOST_PREFLIGHT_SHA256'
preflight="$(dirname -- "$(realpath -e -- "$0")")/host-sbx-preflight.sh"
preflight_hash=$(sha256sum "$preflight") || die 'cannot hash installed preflight'
[[ ${preflight_hash%% *} == "$F9_HOST_PREFLIGHT_SHA256" ]] || die 'installed preflight digest mismatch'

exec "$F9_HOST_GUARD" --inputs "$inputs" --evidence "$evidence" --preflight "$preflight" --verifier "$F9_PROVENANCE_VERIFIER" --patch "$inputs/linux-6.16-original-custody.patch" --filter 'exec.exec_test_original_custody*'
