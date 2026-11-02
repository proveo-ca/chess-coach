#!/bin/sh
set -eu

archive=/home/agent/workspace/devrust-tools.tar
target=/home/agent/workspace/devrust-tools
expected=$1
test "${#expected}" -eq 64 || exit 2
printf '%s  %s\n' "$expected" "$archive" | sha256sum -c - >/dev/null
test ! -e "$target" || { printf 'STOP: tools directory exists\n' >&2; exit 2; }
mkdir -m 700 "$target"
tar --no-same-owner --no-same-permissions -xf "$archive" -C "$target"
test -x "$target/bin/rustc" && test -x "$target/bin/cargo"
"$target/bin/rustc" -vV | grep -Fx 'release: 1.95.0'
"$target/bin/cargo" --version | grep -E '^cargo 1\.95\.0[ (]'
printf 'RESULT=DEV_ONLY_RUST_1_95_SEEDED\n'
