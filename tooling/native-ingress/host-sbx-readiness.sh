#!/usr/bin/env bash
set -euo pipefail

[[ $# == 0 ]] || { printf 'STOP: no arguments accepted\n' >&2; exit 2; }

declared() {
  if [[ -n $1 ]]; then printf 'DECLARED'; else printf 'UNSPECIFIED'; fi
}

directory_candidate() {
  if [[ $1 == /* && -d $1 && ! -L $1 ]]; then printf 'DIRECTORY_CANDIDATE'; else printf 'ABSENT_OR_UNSET'; fi
}

executable_candidate() {
  if [[ $1 == /* && -f $1 && -x $1 && ! -L $1 ]]; then printf 'FILE_CANDIDATE'; else printf 'ABSENT_OR_UNSET'; fi
}

printf 'F9_HOST_READINESS_V1\n'
printf 'DEDICATED_IDENTITY=%s\n' "$(declared "${F9_DEDICATED_USER:-}")"
printf 'DEDICATED_UNIT=%s\n' "$(declared "${F9_DEDICATED_UNIT:-}")"
printf 'INPUTS=%s\n' "$(directory_candidate "${F9_INPUTS:-}")"
printf 'EVIDENCE=%s\n' "$(directory_candidate "${F9_EVIDENCE:-}")"
printf 'GUARD=%s\n' "$(executable_candidate "${F9_HOST_GUARD:-}")"
printf 'VERIFIER=%s\n' "$(executable_candidate "${F9_PROVENANCE_VERIFIER:-}")"
if command -v sbx >/dev/null 2>&1; then
  printf 'SBX=PATH_CANDIDATE\n'
else
  printf 'SBX=NOT_FOUND_IN_PATH\n'
fi
if [[ -r /sys/fs/cgroup/cgroup.controllers ]]; then
  printf 'CGROUP2=CONTROLLERS_FILE_READABLE\n'
else
  printf 'CGROUP2=CONTROLLERS_FILE_UNAVAILABLE\n'
fi
if [[ -c /dev/kvm ]]; then
  printf 'KVM=DEVICE_CANDIDATE_FOR_CURRENT_IDENTITY\n'
else
  printf 'KVM=DEVICE_UNAVAILABLE\n'
fi
printf 'RESULT=STOP\n'
exit 2
