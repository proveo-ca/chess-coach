#!/usr/bin/env bash
set -euo pipefail

[[ $# == 0 ]] || { printf 'STOP: no arguments accepted\n' >&2; exit 2; }

file_candidate() {
  if [[ -f $1 && ! -L $1 ]]; then printf 'FILE_CANDIDATE'; else printf 'UNSEEN'; fi
}

directory_candidate() {
  if [[ -d $1 && ! -L $1 ]]; then printf 'DIRECTORY_CANDIDATE'; else printf 'UNSEEN'; fi
}

printf 'F9_HOST_BOUNDARY_INVENTORY_V1\n'
printf 'UNIT_FILE=%s\n' "$(file_candidate /etc/systemd/system/f9-sbx.service)"
printf 'SLICE_FILE=%s\n' "$(file_candidate /etc/systemd/system/f9-sbx.slice)"
printf 'HOME_DIR=%s\n' "$(directory_candidate /var/lib/f9-sbx)"
printf 'RUNTIME_DIR=%s\n' "$(directory_candidate /run/f9-sbx)"
printf 'INVENTORY=COMPLETE\n'
printf 'BOUNDARY=UNVERIFIED\n'
