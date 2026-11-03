#!/bin/sh
# SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
set -eu

test "$#" -eq 1 || test "$#" -eq 2 || exit 2
archive=/home/agent/workspace/devrust-tools.tar
target=/home/agent/workspace/devrust-tools
expected=$1
test "${#expected}" -eq 64 || exit 2
case "$expected" in *[!0-9a-f]*) exit 2 ;; esac
if test "$#" -eq 2; then
  attempt=$2
  test "${#attempt}" -eq 16 || exit 2
  case "$attempt" in *[!0-9a-f]*) exit 2 ;; esac
  archive="/home/agent/workspace/devrust-tools-${attempt}.tar"
fi
printf '%s  %s\n' "$expected" "$archive" | sha256sum -c - >/dev/null
test ! -e "$target" && test ! -L "$target" || { printf 'STOP: tools directory exists or is a symlink\n' >&2; exit 2; }
mkdir -m 700 "$target"
tar --no-same-owner --no-same-permissions -xf "$archive" -C "$target"
test -x "$target/bin/rustc" && test -x "$target/bin/cargo"
"$target/bin/rustc" -vV | grep -Fx 'release: 1.95.0'
"$target/bin/rustc" -vV | grep -Fx 'host: x86_64-unknown-linux-gnu'
"$target/bin/cargo" --version | grep -E '^cargo 1\.95\.0[ (]'
printf 'RESULT=DEV_ONLY_RUST_1_95_SEEDED\n'
